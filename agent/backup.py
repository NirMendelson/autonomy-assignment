"""
Backup and restore functionality for frontend files.
"""

import os
import json
import shutil
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path


class BackupManager:
    """Manages backup and restore of frontend files."""
    
    def __init__(self, root_dir: str):
        self.root_dir = root_dir
        self.backup_dir = os.path.join(root_dir, '.agent_backups')
        self.ensure_backup_dir()
    
    def ensure_backup_dir(self):
        """Ensure backup directory exists."""
        os.makedirs(self.backup_dir, exist_ok=True)
    
    def create_backup(self, files: List[str], backup_id: Optional[str] = None) -> str:
        """Create a backup of specified files."""
        if not backup_id:
            backup_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        backup_path = os.path.join(self.backup_dir, backup_id)
        files_dir = os.path.join(backup_path, 'files')
        os.makedirs(files_dir, exist_ok=True)
        
        manifest = {
            'backup_id': backup_id,
            'created_at': datetime.now().isoformat(),
            'files': []
        }
        
        for file_path in files:
            if not os.path.exists(file_path):
                continue
            
            # Calculate relative path
            rel_path = os.path.relpath(file_path, self.root_dir)
            backup_file_path = os.path.join(files_dir, rel_path)
            
            # Create directory structure
            os.makedirs(os.path.dirname(backup_file_path), exist_ok=True)
            
            # Copy file
            shutil.copy2(file_path, backup_file_path)
            
            # Calculate file hash
            file_hash = self._calculate_file_hash(file_path)
            
            manifest['files'].append({
                'original_path': file_path,
                'relative_path': rel_path,
                'backup_path': backup_file_path,
                'hash': file_hash,
                'size': os.path.getsize(file_path)
            })
        
        # Write manifest
        manifest_file = os.path.join(backup_path, 'manifest.json')
        with open(manifest_file, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2)
        
        print(f"Backup created: {backup_id}")
        print(f"Files backed up: {len(manifest['files'])}")
        
        return backup_id
    
    def restore_backup(self, backup_id: str) -> bool:
        """Restore files from a backup."""
        backup_path = os.path.join(self.backup_dir, backup_id)
        manifest_file = os.path.join(backup_path, 'manifest.json')
        
        if not os.path.exists(manifest_file):
            print(f"Backup not found: {backup_id}")
            return False
        
        with open(manifest_file, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        
        restored_count = 0
        for file_info in manifest['files']:
            original_path = file_info['original_path']
            backup_file_path = file_info['backup_path']
            
            if not os.path.exists(backup_file_path):
                print(f"Backup file not found: {backup_file_path}")
                continue
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(original_path), exist_ok=True)
            
            # Restore file
            shutil.copy2(backup_file_path, original_path)
            restored_count += 1
        
        print(f"Restored {restored_count} files from backup: {backup_id}")
        return True
    
    def list_backups(self) -> List[Dict[str, Any]]:
        """List all available backups."""
        backups = []
        
        if not os.path.exists(self.backup_dir):
            return backups
        
        for backup_id in os.listdir(self.backup_dir):
            backup_path = os.path.join(self.backup_dir, backup_id)
            manifest_file = os.path.join(backup_path, 'manifest.json')
            
            if os.path.exists(manifest_file):
                with open(manifest_file, 'r', encoding='utf-8') as f:
                    manifest = json.load(f)
                backups.append(manifest)
        
        # Sort by creation time (newest first)
        backups.sort(key=lambda x: x['created_at'], reverse=True)
        return backups
    
    def delete_backup(self, backup_id: str) -> bool:
        """Delete a backup."""
        backup_path = os.path.join(self.backup_dir, backup_id)
        
        if not os.path.exists(backup_path):
            print(f"Backup not found: {backup_id}")
            return False
        
        shutil.rmtree(backup_path)
        print(f"Backup deleted: {backup_id}")
        return True
    
    def cleanup_old_backups(self, keep_count: int = 5) -> int:
        """Clean up old backups, keeping only the most recent ones."""
        backups = self.list_backups()
        
        if len(backups) <= keep_count:
            return 0
        
        deleted_count = 0
        for backup in backups[keep_count:]:
            if self.delete_backup(backup['backup_id']):
                deleted_count += 1
        
        return deleted_count
    
    def _calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA256 hash of a file."""
        hash_sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    
    def get_frontend_files(self) -> List[str]:
        """Get list of frontend files that should be backed up."""
        frontend_files = []
        
        # Files to include
        include_patterns = [
            'pages/**/*.jsx',
            'pages/**/*.js',
            'components/**/*.jsx',
            'components/**/*.js',
            'pages/_app.jsx',
            'pages/_document.jsx',
        ]
        
        for pattern in include_patterns:
            # Convert glob pattern to path
            if '**' in pattern:
                base_dir = pattern.split('**')[0].rstrip('/')
                if base_dir and os.path.exists(base_dir):
                    for root, dirs, files in os.walk(base_dir):
                        for file in files:
                            if file.endswith(('.js', '.jsx')):
                                file_path = os.path.join(root, file)
                                frontend_files.append(file_path)
            else:
                if os.path.exists(pattern):
                    frontend_files.append(pattern)
        
        return frontend_files
    
    def cleanup_generated_files(self):
        """Clean up files generated by the i18n agent."""
        files_to_remove = [
            'i18n.js',
            'public/locales',
            'components/LanguageSwitcher.jsx'
        ]
        
        removed_count = 0
        for file_path in files_to_remove:
            full_path = os.path.join(self.root_dir, file_path)
            if os.path.exists(full_path):
                if os.path.isdir(full_path):
                    shutil.rmtree(full_path)
                else:
                    os.remove(full_path)
                removed_count += 1
                print(f"Removed: {file_path}")
        
        if removed_count > 0:
            print(f"Cleaned up {removed_count} generated files")
        else:
            print("No generated files to clean up")
