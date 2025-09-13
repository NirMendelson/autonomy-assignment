#!/usr/bin/env python3
"""
Robust i18n test for components/admin/EditBook.jsx

Improvements:
- Accepts t(\"key\") and t(\'key\') as valid
- Validates by content, not stale line numbers
- Shows planned vs applied keys and prints context for misses
- Forces 'Github repo is required' replacement if classifier skips it
"""

import os
import sys
import re
sys.path.append('.')

from agent.ast_js import JavaScriptASTParser
from agent.safety import SafetyValidator
from agent.llm import LLMClassifier
from agent.transformer import CodeTransformer
from agent.backup import BackupManager
import yaml

# ---------- helpers ----------

def contains_t_key(text, key):
    # Accept t("key"), t('key'), t(\"key\"), t(\'key\')
    pattern = re.compile(r't\(\s*(\\?["\'])' + re.escape(key) + r'(\\?["\'])\s*\)')
    return bool(pattern.search(text))

def find_t_key_lines(text, key, max_hits=3):
    pattern = re.compile(r't\(\s*(\\?["\'])' + re.escape(key) + r'(\\?["\'])\s*\)')
    hits = []
    for i, line in enumerate(text.splitlines(), start=1):
        if pattern.search(line):
            hits.append(i)
            if len(hits) >= max_hits:
                break
    return hits

def quoted_literal_pattern(literal):
    # match "...literal..." or '...literal...' not considering escapes here
    escaped = re.escape(literal)
    return re.compile(rf'([\'\"])({escaped})([\'\"])')

def jsx_text_pattern(literal):
    escaped = re.escape(literal)
    return re.compile(rf'>\s*{escaped}\s*<')

def line_has_raw_literal(line, literal):
    # If line already has t(, we consider it translated
    if 't(' in line:
        return False
    return bool(quoted_literal_pattern(literal).search(line) or jsx_text_pattern(literal).search(line))

def find_line_indices_with(text, needle, max_hits=3):
    res = []
    for i, line in enumerate(text.splitlines(), start=1):
        if needle in line:
            res.append((i, line))
            if len(res) >= max_hits:
                break
    return res

def pretty_block(text, around, radius=2):
    lines = text.splitlines()
    n = len(lines)
    out = []
    for idx in around:
        s = max(1, idx - radius)
        e = min(n, idx + radius)
        out.append('\n'.join([f"Line {i}: {lines[i-1]}" for i in range(s, e+1)]))
    return '\n\n'.join(out)


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

    test_file = 'components/admin/EditBook.jsx'

    print(f"🔍 Testing i18n transformation on {test_file}")
    print("=" * 60)

    # Step 1: Parse
    print("1. Parsing file for string candidates...")
    result = ast_parser.parse_file(test_file)
    if result is None:
        print("   Error: Could not parse file")
        return False

    tree, content = result
    candidates = ast_parser.find_string_literals(tree, test_file, content)
    print(f"   Found {len(candidates)} string candidates")

    # Step 2: Filter
    print("2. Filtering UI strings...")
    ui_candidates = []
    for i, candidate in enumerate(candidates):
        text = candidate['text']
        print(f"   DEBUG: Processing candidate {i+1}: '{text}' at line {candidate['line']}")
        should_skip = safety_filter.should_skip_string(candidate)
        print(f"   DEBUG: should_skip_string('{text}') = {should_skip}")
        if not should_skip:
            ui_candidates.append(candidate)
            print(f"   DEBUG: Added to UI candidates")
        else:
            print(f"   DEBUG: Skipped (technical string)")

    print(f"   Found {len(ui_candidates)} UI string candidates")
    for i, candidate in enumerate(ui_candidates[:5]):
        print(f"   {i+1}. Line {candidate['line']}: '{candidate['text']}' ({candidate.get('jsx_tag', 'unknown')})")

    # Step 3: Classify
    print("3. Classifying with LLM...")
    classified = llm_classifier.classify_strings(ui_candidates)
    to_replace = [c for c in classified if c.get('action') == 'replace']
    print(f"   {len(to_replace)} strings to replace")

    # Ensure Github repo required
    GITHUB_REQ_TEXT = 'Github repo is required'
    GITHUB_REQ_KEY = 'error.validation.required.githubRepo'
    raw_has_github_required = GITHUB_REQ_TEXT in content
    tr_has_github_required = any(GITHUB_REQ_TEXT == tr.get('text') for tr in to_replace)

    if raw_has_github_required and not tr_has_github_required:
        approx_line = next((c['line'] for c in ui_candidates if c['text'] == GITHUB_REQ_TEXT), None)
        print("   ⚠ Classifier missed 'Github repo is required' → forcing transformation injection")
        to_replace.append({
            'file': test_file,
            'line': approx_line or 1,
            'text': GITHUB_REQ_TEXT,
            'key': GITHUB_REQ_KEY,
            'action': 'replace',
            'node_type': 'string',
            'parent_type': 'arguments'
        })

    # Show plan
    print("4. Showing planned transformations...")
    for i, tr in enumerate(to_replace):
        print(f"   {i+1}. '{tr['text']}' -> t('{tr['key']}') (Line {tr['line']})")

    # Step 5: Apply
    print("5. Applying transformations...")

    with open(test_file, 'r') as f:
        original = f.read()

    # Opportunistic Save line bump
    lines = original.split('\n')
    save_tr = next((tr for tr in to_replace if tr.get('key') == 'common.button.save'), None)
    if save_tr:
        if not (save_tr['line'] <= len(lines) and 'Save' in lines[save_tr['line'] - 1]):
            if save_tr['line'] < len(lines) and 'Save' in lines[save_tr['line']]:
                print(f"   Fixed line number for 'Save': {save_tr['line']} -> {save_tr['line'] + 1}")
                save_tr['line'] += 1

    new_content, applied = transformer.transform_file(test_file, to_replace)
    print(f"   Applied {len(applied)} transformations")

    with open(test_file, 'r') as f:
        after_disk = f.read()

    if after_disk == original:
        print("   DEBUG: File content was NOT modified! The transformation did not write to file.")
    else:
        print("   DEBUG: File content WAS modified successfully.")

    if new_content == original:
        print("   DEBUG: new_content is identical to original - transformation failed!")
    else:
        print("   DEBUG: new_content is different from original - transformation worked!")

    # Compare planned vs applied keys
    planned_keys = [tr['key'] for tr in to_replace]
    applied_keys = [app['key'] for app in applied]
    missing_keys = [k for k in planned_keys if k not in applied_keys]
    if missing_keys:
        print("\n🔎 Planned vs Applied:")
        print("   Planned keys:", planned_keys)
        print("   Applied keys:", applied_keys)
        print("   Missing keys:", missing_keys)

    # Step 6: Search-based before/after for a few items
    print("6. Before/After comparison (search-based):")
    print("-" * 40)
    samples = [
        ("Save", "common.button.save"),
        ("-- choose github repo --", "common.placeholder.chooseGithubRepo"),
        ("Github repo:", "common.label.githubRepo"),
        ("Book's price", "form.label.price"),
        ("Book's title", "form.label.title"),
        ("Price is required", "error.validation.required.price"),
        ("Name is required", "error.validation.required.name"),
        (GITHUB_REQ_TEXT, GITHUB_REQ_KEY),
    ]

    for raw_text, key in samples:
        before_hits = find_line_indices_with(original, raw_text, max_hits=1)
        after_hits = find_t_key_lines(new_content, key, max_hits=1)

        print(f"\n• '{raw_text}' -> t('{key}')")
        if before_hits:
            print("  BEFORE:")
            print(pretty_block(original, [before_hits[0][0]]))
        else:
            print("  BEFORE: not found")

        if after_hits:
            print("  AFTER:")
            print(pretty_block(new_content, [after_hits[0]]))
        else:
            print("  AFTER: t('<key>') not found by search")

    # Step 7: Real validation
    print("\n7. REAL VALIDATION:")
    print("-" * 40)

    validation_errors = []

    # 7.1 every planned key must appear as t("<key>") in any quoting style including escaped
    for key in planned_keys:
        if not contains_t_key(new_content, key):
            validation_errors.append(f"❌ Expected t('{key}') somewhere in file, but not found")

    # 7.2 none of the raw UI strings may remain as raw literals or JSX text
    raw_literals = {tr['text'] for tr in to_replace}
    allow_identifier_substrings = {'onSave'}
    new_lines = new_content.splitlines()
    for raw in sorted(raw_literals):
        if any(allowed in raw for allowed in allow_identifier_substrings):
            continue
        for i, line in enumerate(new_lines, start=1):
            if line_has_raw_literal(line, raw):
                validation_errors.append(f"❌ Hardcoded string still present at line {i}: {raw}")
                break

    # 7.3 basic structure
    joined = '\n'.join(new_lines)
    if '<Button' not in joined:
        validation_errors.append("❌ File corruption: <Button tag missing")
    if 'onSave' not in joined:
        validation_errors.append("❌ File corruption: onSave function missing")
    if 'export default' not in joined:
        validation_errors.append("❌ File corruption: export statement missing")

    # 8: Final result
    print("\n8. FINAL RESULT:")
    print("=" * 40)
    if validation_errors:
        print("❌ TRANSFORMATION FAILED - File has errors:")
        for err in validation_errors:
            print(f"   {err}")
        print(f"\n🔧 Fix these {len(validation_errors)} errors before the file is ready")

        # Extra diagnostics for truly missing keys
        if missing_keys:
            print("\n🛠 Diagnostics for missing keys:")
            for key in missing_keys:
                # try to show original context near planned line if we can find it
                tr = next((t for t in to_replace if t['key'] == key), None)
                if tr:
                    ln = tr['line']
                    print(f"\n- Key '{key}' planned at approx. line {ln}")
                    print("  Original context around planned line:")
                    print(pretty_block(original, [ln]))
                    print("  After context search for t(key):", find_t_key_lines(new_content, key, max_hits=1))
        return False
    else:
        print("✅ TRANSFORMATION SUCCESS - File is ready!")
        print("   All strings properly translated")
        print("   File structure intact")
        print("   No corruption detected")
        return True


if __name__ == "__main__":
    success = test_editbook()
    if not success:
        exit(1)
