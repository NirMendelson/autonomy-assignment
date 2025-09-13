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
    
    # Read original content first for comparison
    with open(test_file, 'r') as f:
        original = f.read()
    
    # Debug: Check if "Github repo is required" is in the transformations being applied
    github_repo_in_transformations = False
    for tr in to_replace:
        if 'Github repo is required' in tr['text']:
            github_repo_in_transformations = True
            print(f"   DEBUG: 'Github repo is required' is in transformations to apply: {tr}")
            break
    
    if not github_repo_in_transformations:
        print("   DEBUG: 'Github repo is required' is NOT in transformations to apply!")
    
    # Debug: Show what we're about to transform
    print("   DEBUG: About to transform these lines:")
    for tr in to_replace:
        line_num = tr['line'] - 1
        if 0 <= line_num < len(original.split('\n')):
            original_line = original.split('\n')[line_num]
            print(f"     Line {tr['line']}: '{original_line}'")
            print(f"       Will replace: '{tr['text']}' -> t('{tr['key']}')")
            print(f"       Context: node_type={tr.get('node_type')}, parent_type={tr.get('parent_type')}")
    
    # Debug: Show the actual Save button lines
    print("\n   DEBUG: Save button context (lines 125-130):")
    lines = original.split('\n')
    for i in range(124, min(130, len(lines))):
        print(f"     Line {i+1}: '{lines[i]}'")
    
    # Fix line number mismatches for multi-line JSX elements
    print("\n🔧 FIXING LINE NUMBER MISMATCHES:")
    for tr in to_replace:
        if tr['key'] == 'common.button.save':
            # Check if the planned line doesn't contain the text
            planned_line = lines[tr['line'] - 1] if tr['line'] <= len(lines) else ""
            if tr['text'] not in planned_line:
                # Check the next line
                next_line_num = tr['line']
                if next_line_num < len(lines):
                    next_line = lines[next_line_num]
                    if tr['text'] in next_line:
                        print(f"   Fixed line number for '{tr['text']}': {tr['line']} -> {next_line_num + 1}")
                        tr['line'] = next_line_num + 1
                    else:
                        print(f"   Could not find '{tr['text']}' in planned line or next line")
                else:
                    print(f"   Next line {next_line_num + 1} is out of bounds")
    
    new_content, applied = transformer.transform_file(test_file, to_replace)
    
    print(f"   Applied {len(applied)} transformations")
    
    # Debug: Check if the file was actually modified
    with open(test_file, 'r') as f:
        actual_file_content = f.read()
    
    if actual_file_content == original:
        print("   DEBUG: File content was NOT modified! The transformation didn't write to file.")
    else:
        print("   DEBUG: File content WAS modified successfully.")
    
    # Debug: Check if new_content is different from original
    if new_content == original:
        print("   DEBUG: new_content is identical to original - transformation failed!")
    else:
        print("   DEBUG: new_content is different from original - transformation worked!")
    
    # Debug: Check what was actually applied
    print("   DEBUG: Applied transformations:")
    for i, app in enumerate(applied):
        print(f"     {i+1}. Line {app['line']}: '{app['original']}' -> {app['key']}")
    
    # Step 6: Show before/after
    print("6. Before/After comparison:")
    print("-" * 40)
    
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
    
    # Show the specific "Github repo is required" transformation
    print("\nSPECIFIC: 'Github repo is required' transformation:")
    github_tr = next((tr for tr in to_replace if 'Github repo is required' in tr['text']), None)
    if github_tr:
        line_num = github_tr['line'] - 1
        print(f"BEFORE Line {github_tr['line']}: {lines[line_num]}")
        print(f"AFTER  Line {github_tr['line']}: {new_lines[line_num]}")
    else:
        print("ERROR: 'Github repo is required' transformation not found!")
    
    # Show ALL transformations for verification
    print("\nALL TRANSFORMATIONS VERIFICATION:")
    for i, tr in enumerate(to_replace):
        line_num = tr['line'] - 1
        if 0 <= line_num < len(lines) and 0 <= line_num < len(new_lines):
            print(f"{i+1}. Line {tr['line']}:")
            print(f"   BEFORE: {lines[line_num]}")
            print(f"   AFTER:  {new_lines[line_num]}")
            print()
    
    # Show the actual transformed file content around the key lines
    print("\nACTUAL FILE CONTENT AFTER TRANSFORMATION:")
    print("Lines 45-65 of transformed file:")
    for i in range(44, min(65, len(new_lines))):
        print(f"Line {i+1}: {new_lines[i]}")
    
    # Check for remaining hardcoded strings that should have been translated
    print("\n🔍 CHECKING FOR REMAINING HARDCODED STRINGS:")
    hardcoded_strings = [
        "Save",
        "Book's title", 
        "Book's price",
        "Github repo:",
        "-- choose github repo --",
        "Name is required",
        "Price is required", 
        "Github repo is required"
    ]
    
    for i, line in enumerate(new_lines):
        for hardcoded in hardcoded_strings:
            if hardcoded in line and f"t(\"" not in line:
                print(f"❌ FOUND HARDCODED: Line {i+1}: '{line.strip()}'")
                print(f"   Contains: '{hardcoded}' but no t() wrapper")
    
    # Check the Save button specifically
    print("\n🔍 CHECKING SAVE BUTTON (Line 129):")
    if len(new_lines) >= 129:
        save_line = new_lines[128]  # Line 129 (0-indexed)
        print(f"Line 129: '{save_line}'")
        if "Save" in save_line and "t(" not in save_line:
            print("❌ SAVE BUTTON NOT TRANSLATED!")
            
            # Debug: Check what the original line looked like
            if len(lines) >= 129:
                original_save_line = lines[128]
                print(f"Original Line 129: '{original_save_line}'")
                
                # Check if "Save" was in the transformations
                save_transformation = next((tr for tr in to_replace if 'Save' in tr['text']), None)
                if save_transformation:
                    print(f"Save transformation found: {save_transformation}")
                else:
                    print("❌ No Save transformation found in to_replace list!")
        else:
            print("✅ SAVE BUTTON PROPERLY TRANSLATED")
    
    # Debug: Check why only 7 transformations were applied instead of 8
    print(f"\n🔍 TRANSFORMATION COUNT DEBUG:")
    print(f"Planned transformations: {len(to_replace)}")
    print(f"Applied transformations: {len(applied)}")
    print(f"Missing: {len(to_replace) - len(applied)}")
    
    # Check which transformation was missed
    planned_keys = {tr['key'] for tr in to_replace}
    applied_keys = {app['key'] for app in applied}
    missing_keys = planned_keys - applied_keys
    if missing_keys:
        print(f"❌ MISSING TRANSFORMATIONS: {missing_keys}")
        
        # Debug: Check the Save button transformation specifically
        save_tr = next((tr for tr in to_replace if tr['key'] == 'common.button.save'), None)
        if save_tr:
            print(f"\n🔍 SAVE BUTTON TRANSFORMATION DEBUG:")
            print(f"Planned line: {save_tr['line']}")
            print(f"Actual 'Save' text is on line: 128")
            print(f"Line number mismatch: {save_tr['line']} vs 128")
            
            # Check if we can find "Save" on the planned line
            planned_line = lines[save_tr['line'] - 1] if save_tr['line'] <= len(lines) else "N/A"
            print(f"Planned line content: '{planned_line}'")
            print(f"Contains 'Save': {'Save' in planned_line}")
            
            # Check the next line (where Save actually is)
            if save_tr['line'] < len(lines):
                next_line = lines[save_tr['line']]
                print(f"Next line content: '{next_line}'")
                print(f"Contains 'Save': {'Save' in next_line}")
    else:
        print("✅ All planned transformations were applied")
    
    print("\n" + "=" * 60)
    print("✅ Test complete!")

if __name__ == "__main__":
    test_editbook()
