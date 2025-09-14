#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = 'backups';
const I18N_FILES = [
  'components/LanguageSwitcher.jsx',
  'components/I18nProvider.jsx', 
  'lib/i18n.js',
  'locales/en/common.json',
  'locales/es/common.json'
];

function createBackup() {
  const timestamp = Date.now();
  const backupPath = path.join(BACKUP_DIR, `i18n-${timestamp}`);
  
  console.log(`📦 Creating backup: ${backupPath}`);
  
  // Create backup directory
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }
  
  // Backup original files
  const filesToBackup = [
    'components/Header.jsx',
    'components/MenuWithAvatar.jsx',
    'components/Notifier.jsx',
    'components/admin/EditBook.jsx',
    'components/customer/BuyButton.jsx',
    'pages/_app.jsx',
    'pages/_document.jsx',
    'pages/index.jsx',
    'pages/admin/add-book.jsx',
    'pages/admin/book-detail.jsx',
    'pages/admin/edit-book.jsx',
    'pages/admin/index.jsx',
    'pages/customer/my-books.jsx',
    'pages/public/login.jsx',
    'pages/public/read-chapter.jsx'
  ];
  
  let backedUpFiles = 0;
  for (const filePath of filesToBackup) {
    const sourcePath = filePath;
    const destPath = path.join(backupPath, filePath);
    const destDir = path.dirname(destPath);
    
    if (fs.existsSync(sourcePath)) {
      // Create destination directory
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      // Copy file
      fs.copyFileSync(sourcePath, destPath);
      backedUpFiles++;
      console.log(`  ✅ Backed up: ${filePath}`);
    }
  }
  
  // Create metadata
  const metadata = {
    timestamp,
    filesBackedUp: backedUpFiles,
    i18nFiles: I18N_FILES
  };
  
  fs.writeFileSync(
    path.join(backupPath, 'metadata.json'), 
    JSON.stringify(metadata, null, 2)
  );
  
  console.log(`✅ Backup complete! ${backedUpFiles} files backed up to ${backupPath}`);
  return backupPath;
}

function restoreBackup() {
  // Find the most recent backup
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(dir => dir.startsWith('i18n-'))
    .sort()
    .reverse();
  
  if (backups.length === 0) {
    console.log('❌ No backups found!');
    return false;
  }
  
  const latestBackup = backups[0];
  const backupPath = path.join(BACKUP_DIR, latestBackup);
  const metadataPath = path.join(backupPath, 'metadata.json');
  
  let metadata = null;
  if (fs.existsSync(metadataPath)) {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  }
  
  console.log(`🔄 Restoring from backup: ${backupPath}`);
  
  // Restore original files
  let restoredFiles = 0;
  const filesToRestore = [
    'components/Header.jsx',
    'components/MenuWithAvatar.jsx', 
    'components/Notifier.jsx',
    'components/admin/EditBook.jsx',
    'components/customer/BuyButton.jsx',
    'pages/_app.jsx',
    'pages/_document.jsx',
    'pages/index.jsx',
    'pages/admin/add-book.jsx',
    'pages/admin/book-detail.jsx',
    'pages/admin/edit-book.jsx',
    'pages/admin/index.jsx',
    'pages/customer/my-books.jsx',
    'pages/public/login.jsx',
    'pages/public/read-chapter.jsx'
  ];
  
  for (const filePath of filesToRestore) {
    const sourcePath = path.join(backupPath, filePath);
    const destPath = filePath;
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      restoredFiles++;
      console.log(`  ✅ Restored: ${filePath}`);
    }
  }
  
  // Delete i18n files created by the agent
  console.log('🗑️  Cleaning up i18n files created by agent...');
  let deletedFiles = 0;
  for (const filePath of I18N_FILES) {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        deletedFiles++;
        console.log(`🗑️  Deleted: ${filePath}`);
      } catch (error) {
        console.log(`⚠️  Failed to delete ${filePath}: ${error.message}`);
      }
    }
  }
  
  // Clean up empty directories
  const directoriesToClean = ['locales/en', 'locales/es', 'locales'];
  for (const dirPath of directoriesToClean) {
    if (fs.existsSync(dirPath)) {
      try {
        const files = fs.readdirSync(dirPath);
        if (files.length === 0) {
          fs.rmdirSync(dirPath);
          console.log(`🗑️  Removed empty directory: ${dirPath}`);
        }
      } catch (error) {
        // Directory not empty or other error, ignore
      }
    }
  }
  
  console.log(`✅ Restore complete! ${restoredFiles} files restored, ${deletedFiles} i18n files deleted`);
  return true;
}

function showBackupInfo() {
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(dir => dir.startsWith('i18n-'))
    .sort()
    .reverse();
  
  if (backups.length === 0) {
    console.log('📦 No backups found!');
    return;
  }
  
  console.log('📦 Available backups:');
  for (const backup of backups) {
    const backupPath = path.join(BACKUP_DIR, backup);
    const metadataPath = path.join(backupPath, 'metadata.json');
    
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      const date = new Date(metadata.timestamp);
      console.log(`  📅 ${backup} - ${date.toLocaleString()} (${metadata.filesBackedUp} files)`);
    } else {
      // Extract timestamp from directory name
      const timestamp = parseInt(backup.replace('i18n-', ''));
      const date = new Date(timestamp);
      console.log(`  📅 ${backup} - ${date.toLocaleString()} (legacy backup)`);
    }
  }
}

// Main execution
const command = process.argv[2];

switch (command) {
  case 'backup':
    createBackup();
    break;
  case 'restore':
    restoreBackup();
    break;
  case 'info':
    showBackupInfo();
    break;
  default:
    console.log('Usage: node backup-restore.js [backup|restore|info]');
    process.exit(1);
}
