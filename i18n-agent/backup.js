const fs = require('fs');
const path = require('path');

/**
 * Backup system for i18n agent
 * Creates snapshots of target files before processing
 */

const BACKUP_DIR = '.i18n-backup';
const TARGETS_FILE = '.i18n-agent/targets.json';

/**
 * Create backup of all target files
 */
async function createBackup() {
  try {
    // Create backup directory
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Read targets file
    if (!fs.existsSync(TARGETS_FILE)) {
      console.log('❌ No targets.json found. Run decide-targets first.');
      return false;
    }

    const targets = JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf8'));
    let backedUpFiles = 0;

    console.log('🔄 Creating backup...');

    for (const filePath of targets) {
      if (fs.existsSync(filePath)) {
        const backupPath = path.join(BACKUP_DIR, filePath);
        const backupDir = path.dirname(backupPath);
        
        // Create backup directory structure
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }

        // Copy file to backup
        fs.copyFileSync(filePath, backupPath);
        backedUpFiles++;
        console.log(`✅ Backed up: ${filePath}`);
      } else {
        console.log(`⚠️  File not found: ${filePath}`);
      }
    }

    // Create backup metadata
    const metadata = {
      timestamp: new Date().toISOString(),
      filesCount: backedUpFiles,
      targets: targets
    };

    fs.writeFileSync(
      path.join(BACKUP_DIR, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`✅ Backup complete! ${backedUpFiles} files backed up to ${BACKUP_DIR}/`);
    return true;

  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    return false;
  }
}

/**
 * Restore files from backup
 */
async function restoreBackup() {
  try {
    const metadataPath = path.join(BACKUP_DIR, 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      console.log('❌ No backup found. Run i18n:backup first.');
      return false;
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    let restoredFiles = 0;

    console.log('🔄 Restoring from backup...');

    for (const filePath of metadata.targets) {
      const backupPath = path.join(BACKUP_DIR, filePath);
      
      if (fs.existsSync(backupPath)) {
        // Create target directory if it doesn't exist
        const targetDir = path.dirname(filePath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // Restore file from backup
        fs.copyFileSync(backupPath, filePath);
        restoredFiles++;
        console.log(`✅ Restored: ${filePath}`);
      } else {
        console.log(`⚠️  Backup file not found: ${backupPath}`);
      }
    }

    // Delete i18n files created by the agent
    console.log('🗑️  Cleaning up i18n files created by agent...');
    const i18nFilesToDelete = [
      'components/LanguageSwitcher.jsx',
      'components/I18nProvider.jsx',
      'lib/i18n.js',
      'locales/en/common.json',
      'locales/es/common.json'
    ];

    let deletedFiles = 0;
    for (const filePath of i18nFilesToDelete) {
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

  } catch (error) {
    console.error('❌ Restore failed:', error.message);
    return false;
  }
}

/**
 * Check if backup exists
 */
function hasBackup() {
  return fs.existsSync(path.join(BACKUP_DIR, 'metadata.json'));
}

/**
 * Get backup info
 */
function getBackupInfo() {
  try {
    const metadataPath = path.join(BACKUP_DIR, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
    return null;
  } catch (error) {
    return null;
  }
}

module.exports = {
  createBackup,
  restoreBackup,
  hasBackup,
  getBackupInfo
};

// CLI usage
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'backup') {
    createBackup();
  } else if (command === 'restore') {
    restoreBackup();
  } else if (command === 'info') {
    const info = getBackupInfo();
    if (info) {
      console.log('📋 Backup Info:');
      console.log(`   Created: ${info.timestamp}`);
      console.log(`   Files: ${info.filesCount}`);
    } else {
      console.log('❌ No backup found');
    }
  } else {
    console.log('Usage: node backup.js [backup|restore|info]');
  }
}
