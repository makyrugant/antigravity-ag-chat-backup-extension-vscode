# Antigravity Chat Backup (🛡️ AG)

**Antigravity Chat Backup** is a powerful VS Code extension designed to automatically and seamlessly mirror your Antigravity chat logs. It provides a robust, real-time backup solution that ensures your valuable conversations are never lost due to a crash or data corruption.

## 🌟 Features

### 🍱 Conversation Manager UI
A built-in dashboard that lets you visualize and sync your conversations with one click.
- **Sync Status**: Transparently shows which conversations are OK vs. MISSING between your live storage and your desktop backup.
- **Intelligent Restoration**: Missing a conversation from your live session? Simply click **"Restore to Live"** to retrieve it from your backup.
- **Manual Backups**: Force-mirror new conversations to your backup folder instantly.

### 🔄 Seamless "Drop-In" Recovery
Unlike complex backup solutions, this extension mirrors the **exact directory structure** of Antigravity's storage. Recovery is as simple as a copy-paste back into the original data folder.

### 🚀 Real-time Monitoring & Sync
- **Smart Watcher**: Automatically detects when you chat and mirrors the changes in real-time.
- **Broad Coverage**: Backs up both your message history records (`.pb`) and your conversation brain context (`brain/` folders).
- **Initial Full Backup**: On first run, choose whether to perform a comprehensive clone of all your existing history.

### 🛡️ Status Bar Feedback
A dedicated status bar item (`$(shield) AG Backup: Active`) keeps you informed about the backup activity without interrupting your workflow.

## 🛠️ Getting Started

### Installation
1. Search for **"Antigravity Chat Backup"** in the VS Code Marketplace and install it.
2. On first activation, you'll be prompted: *"Would you like to perform a full initial backup of all existing Antigravity logs?"*
3. Select **"Yes"** to secure all your current records immediately.

### Opening the Manager UI
To open the dashboard and manage your backups:
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
2. Search for: **"AG: Open Conversation Manager"**.

## ⚙️ Configuration

You can customize the extension through your VS Code Settings:
- `agChatBackup.fullInitialBackup`: Toggle the startup full backup prompt.
- `agChatBackup.backupPath`: Set a custom location for your logs. (Defaults to your Desktop).

## 🛡️ Privacy & Safety
- **Local First**: All backups are strictly local to your machine. No data is ever sent to a third-party server.
- **Safety Prompts**: Restoration actions involve overwrite confirmation to prevent accidental data loss.

---
**Made with ❤️ by makyrugant**
