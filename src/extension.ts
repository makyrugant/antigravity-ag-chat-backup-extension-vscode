import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
	// 1. Setup paths
	const config = vscode.workspace.getConfiguration('agChatBackup');
	const userProfile = process.env.USERPROFILE || '';
	const agStoragePath = path.join(userProfile, '.gemini', 'antigravity');
	let backupDir = config.get<string>('backupPath') || path.join(userProfile, 'Desktop', 'AG_Chat_Backups');

	vscode.window.setStatusBarMessage("AG Backup: Initializing...", 3000);

	if (!fs.existsSync(backupDir)) {
		fs.mkdirSync(backupDir, { recursive: true });
	}

	// 2. Setup Status Bar
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = `$(shield) AG Backup: Active`;
	statusBarItem.tooltip = `Antigravity Chat Backup is monitoring ${agStoragePath}`;
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	// 3. Handle Initial Backup Choice
	let fullBackupChoice = config.get<boolean | null>('fullInitialBackup');
	
	if (fullBackupChoice === null) {
		const selection = await vscode.window.showInformationMessage(
			"Would you like to perform a full initial backup of all existing Antigravity logs?",
			"Yes", "No"
		);
		if (selection === "Yes") {
			fullBackupChoice = true;
			await config.update('fullInitialBackup', true, vscode.ConfigurationTarget.Global);
		} else if (selection === "No") {
			fullBackupChoice = false;
			await config.update('fullInitialBackup', false, vscode.ConfigurationTarget.Global);
		}
	}

	if (fullBackupChoice === true) {
		await performFullBackup(agStoragePath, backupDir);
	}

	// 4. Setup File Watcher
	const watcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(agStoragePath, '**/*')
	);

	watcher.onDidChange(uri => backupFile(uri.fsPath, agStoragePath, backupDir));
	watcher.onDidCreate(uri => backupFile(uri.fsPath, agStoragePath, backupDir));

	context.subscriptions.push(watcher);

	// 5. Register Commands
	context.subscriptions.push(
		vscode.commands.registerCommand('ag-chat-backup.showManager', () => {
			ManagerPanel.createOrShow(context.extensionUri, agStoragePath, backupDir);
		})
	);
}

async function performFullBackup(source: string, destination: string) {
	statusBarItem.text = `$(sync~spin) AG Backup: Syncing...`;
	try {
		if (fs.cpSync) {
			fs.cpSync(source, destination, { recursive: true, force: true });
		} else {
			copyDirRecursive(source, destination);
		}
		vscode.window.setStatusBarMessage("Initial backup completed successfully.", 5000);
	} catch (err) {
		vscode.window.showErrorMessage(`Initial backup failed: ${err}`);
	} finally {
		statusBarItem.text = `$(shield) AG Backup: Active`;
	}
}

function copyDirRecursive(src: string, dest: string) {
	if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
	const entries = fs.readdirSync(src, { withFileTypes: true });

	for (let entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			copyDirRecursive(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

function backupFile(sourcePath: string, rootPath: string, backupDir: string) {
	if (fs.existsSync(sourcePath) && fs.lstatSync(sourcePath).isDirectory()) return;

	try {
		const relativePath = path.relative(rootPath, sourcePath);
		const destPath = path.join(backupDir, relativePath);
		fs.mkdirSync(path.dirname(destPath), { recursive: true });
		fs.copyFileSync(sourcePath, destPath);
		
		const originalText = statusBarItem.text;
		statusBarItem.text = `$(check) AG Backup: Saved ${path.basename(sourcePath)}`;
		setTimeout(() => {
			statusBarItem.text = originalText;
		}, 3000);

	} catch (error) {
		console.error("Failed to backup:", error);
		if (!(error as any).message?.includes("EBUSY")) {
			vscode.window.showErrorMessage(`Backup failed for ${path.basename(sourcePath)}: ${error}`);
		}
	}
}

/**
 * Manages Conversation Manager Webview Panel
 */
class ManagerPanel {
	public static currentPanel: ManagerPanel | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private _disposables: vscode.Disposable[] = [];

	private constructor(panel: vscode.WebviewPanel, private readonly _storagePath: string, private readonly _backupPath: string) {
		this._panel = panel;
		this._update();
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
		this._panel.webview.onDidReceiveMessage(
			async message => {
				switch (message.command) {
					case 'refresh':
						this._update();
						break;
					case 'copy':
						await this.syncConversation(message.id, message.direction);
						this._update();
						break;
				}
			},
			null,
			this._disposables
		);
	}

	public static createOrShow(extensionUri: vscode.Uri, storagePath: string, backupPath: string) {
		if (ManagerPanel.currentPanel) {
			ManagerPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'agChatManager',
			'Antigravity Conversation Manager',
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);

		ManagerPanel.currentPanel = new ManagerPanel(panel, storagePath, backupPath);
	}

	private async syncConversation(id: string, direction: 'toBackup' | 'toLive') {
		const srcRoot = direction === 'toBackup' ? this._storagePath : this._backupPath;
		const destRoot = direction === 'toBackup' ? this._backupPath : this._storagePath;

		try {
			// Copy both PB file and brain folder
			const filesToCopy = [
				path.join('conversations', `${id}.pb`),
				path.join('brain', id)
			];

			for (const relPath of filesToCopy) {
				const src = path.join(srcRoot, relPath);
				const dest = path.join(destRoot, relPath);

				if (fs.existsSync(src)) {
					if (fs.lstatSync(src).isDirectory()) {
						if (fs.cpSync) {
							fs.cpSync(src, dest, { recursive: true, force: true });
						} else {
							copyDirRecursive(src, dest);
						}
					} else {
						fs.mkdirSync(path.dirname(dest), { recursive: true });
						fs.copyFileSync(src, dest);
					}
				}
			}
			vscode.window.setStatusBarMessage(`Synced ${id} successfully.`, 3000);
		} catch (err) {
			vscode.window.showErrorMessage(`Sync failed: ${err}`);
		}
	}

	private _update() {
		this._panel.webview.html = this._getHtmlForWebview(this._getConversationStatus());
	}

	private _getConversationStatus(): any[] {
		const ids = new Set<string>();

		// Scan both places for GUIDs in conversations folder
		const scan = (root: string) => {
			const convPath = path.join(root, 'conversations');
			if (fs.existsSync(convPath)) {
				fs.readdirSync(convPath).forEach(file => {
					if (file.endsWith('.pb')) ids.add(file.replace('.pb', ''));
				});
			}
		};

		scan(this._storagePath);
		scan(this._backupPath);

		return Array.from(ids).map(id => {
			const liveExists = fs.existsSync(path.join(this._storagePath, 'conversations', `${id}.pb`));
			const backupExists = fs.existsSync(path.join(this._backupPath, 'conversations', `${id}.pb`));
			return {
				id,
				live: liveExists ? 'OK' : 'MISSING',
				backup: backupExists ? 'OK' : 'MISSING'
			};
		}).sort();
	}

	private _getHtmlForWebview(data: any[]) {
		const tableRows = data.map(item => {
			const liveClass = item.live === 'OK' ? 'status-ok' : 'status-missing';
			const backupClass = item.backup === 'OK' ? 'status-ok' : 'status-missing';
			const canCopy = item.live !== item.backup;
			const direction = item.live === 'MISSING' ? 'toLive' : 'toBackup';
			const btnLabel = item.live === 'MISSING' ? 'Restore to Live' : 'Backup to Desktop';

			return `
				<tr>
					<td class="id-cell">${item.id}</td>
					<td><span class="badge ${liveClass}">${item.live}</span></td>
					<td><span class="badge ${backupClass}">${item.backup}</span></td>
					<td>
						${canCopy ? `<button onclick="sync('${item.id}', '${direction}')">${btnLabel}</button>` : '<span class="up-to-date">Synced</span>'}
					</td>
				</tr>
			`;
		}).join('');

		return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<style>
					body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); }
					h1 { font-weight: 300; margin-bottom: 30px; letter-spacing: 1px; color: var(--vscode-textLink-foreground); }
					table { width: 100%; border-collapse: collapse; margin-top: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; }
					th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid var(--vscode-panel-border); }
					th { background-color: var(--vscode-editor-lineHighlightBackground); text-transform: uppercase; font-size: 0.8em; letter-spacing: 1px; color: var(--vscode-descriptionForeground); }
					.id-cell { font-family: monospace; font-size: 0.9em; opacity: 0.8; }
					.badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75em; font-weight: bold; }
					.status-ok { background-color: hsla(145, 63%, 42%, 0.2); color: #4caf50; border: 1px solid hsla(145, 63%, 42%, 0.3); }
					.status-missing { background-color: hsla(0, 75%, 60%, 0.15); color: #f44336; border: 1px solid hsla(0, 75%, 60%, 0.3); }
					button { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; transition: filter 0.2s; font-size: 0.85em; }
					button:hover { filter: brightness(1.2); }
					.up-to-date { opacity: 0.5; font-size: 0.85em; font-style: italic; }
					.header-actions { display: flex; justify-content: space-between; align-items: flex-end; }
					.refresh-btn { background: none; border: 1px solid var(--vscode-button-background); color: var(--vscode-button-background); }
				</style>
			</head>
			<body>
				<div class="header-actions">
					<h1>Conversation Sync Manager</h1>
					<button class="refresh-btn" onclick="refresh()">Refresh Status</button>
				</div>
				<table>
					<thead>
						<tr>
							<th>Conversation ID</th>
							<th>Live Storage</th>
							<th>Desktop Backup</th>
							<th>Sync Action</th>
						</tr>
					</thead>
					<tbody>
						${tableRows}
					</tbody>
				</table>

				<script>
					const vscode = acquireVsCodeApi();
					function sync(id, direction) {
						vscode.postMessage({ command: 'copy', id, direction });
					}
					function refresh() {
						vscode.postMessage({ command: 'refresh' });
					}
				</script>
			</body>
			</html>
		`;
	}

	public dispose() {
		ManagerPanel.currentPanel = undefined;
		this._panel.dispose();
		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) x.dispose();
		}
	}
}

export function deactivate() { }