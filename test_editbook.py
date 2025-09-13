#!/usr/bin/env python3
"""
Test script to debug i18n transformation on EditBook.jsx only
"""

import os
import sys
sys.path.append('.')

from agent.ast_js import JavaScriptASTParser
from agent.safety import SafetyValidator
from agent.llm import LLMClassifier
from agent.transformer import CodeTransformer
from agent.backup import BackupManager
import yaml

def test_editbook():
    # Load config
    with open('agent/config.yaml', 'r') as f:
        config = yaml.safe_load(f)
    
    # Initialize components
    ast_parser = JavaScriptASTParser()
    safety_filter = SafetyValidator(config)
    llm_classifier = LLMClassifier(config)
    transformer = CodeTransformer(config)
    backup_manager = BackupManager('.')
    
    # Test file
    test_file = 'components/admin/EditBook.jsx'
    
    print(f"🔍 Testing i18n transformation on {test_file}")
    print("=" * 60)
    
    # Step 1: Parse file and find strings
    print("1. Parsing file for string candidates...")
    result = ast_parser.parse_file(test_file)
    if result is None:
        print("   Error: Could not parse file")
        return
    
    tree, content = result
    candidates = ast_parser.find_string_literals(tree, test_file, content)
    print(f"   Found {len(candidates)} string candidates")
    
    # Step 2: Filter UI strings
    print("2. Filtering UI strings...")
    ui_candidates = []
    for i, candidate in enumerate(candidates):
        text = candidate['text']
        print(f"   DEBUG: Processing candidate {i+1}: '{text}' at line {candidate['line']}")
        
        # Check if should skip - pass the full candidate context
        should_skip = safety_filter.should_skip_string(candidate)
        print(f"   DEBUG: should_skip_string('{text}') = {should_skip}")
        
        if not should_skip:
            ui_candidates.append(candidate)
            print(f"   DEBUG: Added to UI candidates")
        else:
            print(f"   DEBUG: Skipped (technical string)")
    
    print(f"   Found {len(ui_candidates)} UI string candidates")
    for i, candidate in enumerate(ui_candidates[:5]):  # Show first 5
        print(f"   {i+1}. Line {candidate['line']}: '{candidate['text']}' ({candidate.get('jsx_tag', 'unknown')})")
    
    # Step 3: Classify with LLM
    print("3. Classifying with LLM...")
    classified = llm_classifier.classify_strings(ui_candidates)
    to_replace = [c for c in classified if c.get('action') == 'replace']
    print(f"   {len(to_replace)} strings to replace")
    
    # Step 4: Show transformations
    print("4. Showing planned transformations...")
    for i, tr in enumerate(to_replace):
        print(f"   {i+1}. '{tr['text']}' -> t('{tr['key']}') (Line {tr['line']})")
    
    # Debug: Check if "Github repo is required" is in the transformations
    github_repo_found = False
    for tr in to_replace:
        if 'Github repo is required' in tr['text']:
            github_repo_found = True
            print(f"   DEBUG: Found 'Github repo is required' in transformations: {tr}")
            break
    
    if not github_repo_found:
        print("   DEBUG: 'Github repo is required' NOT found in transformations!")
        print("   DEBUG: All transformations:")
        for i, tr in enumerate(to_replace):
            print(f"     {i+1}. Line {tr['line']}: '{tr['text']}'")
    
    # Step 5: Apply transformations
    print("5. Applying transformations...")
    
    # Debug: Check if "Github repo is required" is in the transformations being applied
    github_repo_in_transformations = False
    for tr in to_replace:
        if 'Github repo is required' in tr['text']:
            github_repo_in_transformations = True
            print(f"   DEBUG: 'Github repo is required' is in transformations to apply: {tr}")
            break
    
    if not github_repo_in_transformations:
        print("   DEBUG: 'Github repo is required' is NOT in transformations to apply!")
    
    new_content, applied = transformer.transform_file(test_file, to_replace)
    
    print(f"   Applied {len(applied)} transformations")
    
    # Debug: Check what was actually applied
    print("   DEBUG: Applied transformations:")
    for i, app in enumerate(applied):
        print(f"     {i+1}. Line {app['line']}: '{app['original']}' -> {app['key']}")
    
    # Step 6: Show before/after
    print("6. Before/After comparison:")
    print("-" * 40)
    
    with open(test_file, 'r') as f:
        original = f.read()
    
    print("BEFORE:")
    lines = original.split('\n')
    for tr in to_replace[:3]:  # Show first 3 transformations
        line_num = tr['line'] - 1
        if 0 <= line_num < len(lines):
            print(f"Line {tr['line']}: {lines[line_num]}")
    
    print("\nAFTER:")
    new_lines = new_content.split('\n')
    for tr in to_replace[:3]:  # Show first 3 transformations
        line_num = tr['line'] - 1
        if 0 <= line_num < len(new_lines):
            print(f"Line {tr['line']}: {new_lines[line_num]}")
    
    print("\n" + "=" * 60)
    print("✅ Test complete!")

if __name__ == "__main__":
    test_editbook()
