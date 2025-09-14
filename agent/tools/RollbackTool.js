const fs = require('fs');
const path = require('path');
const BaseTool = require('./BaseTool');

class RollbackTool extends BaseTool {
  async createBackup() {
    this.log('💾 Creating backup...');
    
    // This will be called during initialization
    // The actual backup creation happens in individual tools
    return { success: true };
  }
  
  async execute() {
    this.log('🔄 Rolling back changes...');
    
    const results = {
      filesRestored: 0,
      errors: []
    };
    
    try {
      // Restore all files from backup
      const backupDir = this.agent.backupDir;
      
      if (!fs.existsSync(backupDir)) {
        this.error('No backup directory found');
        return { success: false, error: 'No backup directory found' };
      }
      
      // Find all backup files
      const backupFiles = this.findBackupFiles(backupDir);
      
      for (const backupFile of backupFiles) {
        try {
          const originalPath = this.getOriginalPath(backupFile, backupDir);
          const backupContent = fs.readFileSync(backupFile, 'utf8');
          
          // Restore the original file
          fs.writeFileSync(originalPath, backupContent);
          results.filesRestored++;
          
          this.success(`Restored ${originalPath}`);
        } catch (error) {
          results.errors.push(`Failed to restore ${backupFile}: ${error.message}`);
          this.error(`Failed to restore ${backupFile}: ${error.message}`);
        }
      }
      
      // Clean up backup directory
      this.cleanupBackup(backupDir);
      
      return { success: true, ...results };
    } catch (error) {
      this.error(`Rollback failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  findBackupFiles(backupDir) {
    const files = [];
    
    const scanDirectory = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    };
    
    scanDirectory(backupDir);
    return files;
  }
  
  getOriginalPath(backupFile, backupDir) {
    // Convert backup path back to original path
    const relativePath = path.relative(backupDir, backupFile);
    return relativePath;
  }
  
  cleanupBackup(backupDir) {
    try {
      // Remove the entire backup directory
      fs.rmSync(backupDir, { recursive: true, force: true });
      this.success('Backup directory cleaned up');
    } catch (error) {
      this.error(`Failed to cleanup backup directory: ${error.message}`);
    }
  }
}

module.exports = RollbackTool;
