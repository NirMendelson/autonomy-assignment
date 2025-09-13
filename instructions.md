# 🧑‍💻 i18n Agent

This project includes a Python agent that scans the React/Next.js codebase, finds hardcoded UI strings, and replaces them with t() or <Trans> calls for internationalization (i18n).
It also generates locale JSON files (public/locales/en/*.json) so the app is translation-ready.

The agent is end-to-end automated: run it in dry-run, apply transforms safely, backup/restore the original frontend code without touching backend files or agent code, iterate, and repeat.

## ⚙️ Setup

### 1) Python venv
```bash
# Create venv
python -m venv venv

# Activate it
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install
pip install -r requirements.txt
```

requirements.txt should include:

- openai
- python-dotenv
- tree-sitter
- tree-sitter-javascript
- pathspec
- pyyaml
- click
- rich

### 2) Environment variables

Create .env in repo root:

```env
OPENAI_API_KEY=sk-xxxx
MODEL=gpt-4o-mini
DRY_RUN=true     # true = preview only; set false to apply
```

### 3) What the agent touches

**Important:** the agent only scans and changes frontend files. It will never modify backend files (e.g. server/, lib/api/, models/).

It works on:

- pages/**/*.jsx
- components/**/*.jsx

It may also:

- Wire i18n by editing pages/_app.jsx
- Create i18n.js
- Create public/locales/en/*.json (and optional he/*.json)
- Add a tiny language switcher for demo purposes

Backend code under server/ or database models will not be touched.

## 🛠️ Agent pipeline (end-to-end, no hand edits)

### Repo checkpoint

We keep git around, but you don't have to reset --hard each time. The agent provides backup and restore commands that snapshot only the original frontend app files and cleanly roll back without touching the backend or agent/ folder.

### Static scan to find candidates

- Walk only frontend sources: pages/**/*.jsx, components/**/*.jsx
- Parse with tree-sitter-javascript to get a real AST (not regex)
- Collect candidate literals:
  - JSXText nodes
  - String literals in JSX attributes (aria-label, title, alt, placeholder)
- Skip obvious non-UI strings: routes, urls, ids, className, data-*, emails, numbers, logger calls, API payloads, backend files

### LLM pass to classify and keygen

For each candidate, send compact code context to the LLM to decide:

- Is it user-visible?
- If yes, propose stable key, default English message, and wrapper:
  - t() for simple text/attrs
  - <Trans> for nested markup

Output structured JSON like:

```json
{ "action": "replace", "key": "common.checkout", "defaultMessage": "Checkout", "wrapper": "t" }
```

### Transform step (safe edits)

Replace literals safely:

- "Checkout" → {t('common.checkout')}
- placeholder="Search" → placeholder={t('search.placeholder')}

Complex/nested cases:

- Nested markup → <Trans i18nKey="..." />
- Interpolations → t('greeting.helloUser', { name: user.name })

Generate patch files, re-parse with AST, apply only if valid

### Locale file generation

- Create public/locales/en/common.json
- Optionally create public/locales/he/common.json with English defaults
- Insert key: defaultMessage

### Wire up i18next

- Add i18n.js config
- Wrap provider in _app.jsx
- Add demo language switcher

### Verification

- Re-parse transformed files with tree-sitter
- Run yarn dev and log missing keys
- Emit a summary report: files touched, keys added, skipped strings with reasons

### Artifacts

- Updated repo with i18n applied
- Python agent (agent/)
- Markdown/JSON report
- Loom demo of python agent.py --apply

### Edge cases handled

- Interpolations: Hello, {user.name} → t('greeting.helloUser', { name: user.name })
- Pluralization: detects "1 item" vs "n items" → uses key_one, key_other
- Nested markup: <Trans> with components mapping
- Skip logic: numbers, ids, urls, logs, backend code, server files

## ▶️ CLI usage

```bash
# 0) Preview changes (no writes)
python -m agent.agent --scan --root .

# 1) Create a backup of original frontend files
python -m agent.agent --backup --root .

# 2) Apply transforms
python -m agent.agent --apply --root .

# 3) Produce a JSON/MD report
python -m agent.agent --report --root .

# 4) Restore original frontend files for another test run
python -m agent.agent --restore --root .
```

## 🧷 Backup/Restore: no more git reset --hard

The agent has built-in backup/restore:

- Backs up only frontend files (pages/ and components/ plus pages/_app.jsx)
- Restores them exactly while leaving agent/, backend code, backups, and logs intact
- Removes i18n files if they were created during wiring (e.g. i18n.js, public/locales/)

Backups are stored under:

```
.agent_backups/<timestamp>/
  manifest.json   # file list and hashes
  files/...       # original copies
```

Restore will:

- Put back originals from the latest backup (or by --backup-id)
- Remove generated files like i18n.js or public/locales/ if they didn't exist before

Ignored:

- .agent_backups/
- agent/
- node_modules/
- .env, .git

## 📂 Agent folder structure

```
agent/
  agent.py          # CLI entrypoint
  ast_js.py         # tree-sitter parsing helpers
  llm.py            # OpenAI classification/keygen
  transformer.py    # patching, locale writing
  safety.py         # skip rules, AST validation
  backup.py         # backup/restore implementation
  config.yaml       # optional rules
  reports/
  logs/
```

## 🔧 CLI flags

- `--root .`                     # project root
- `--include "pages/**/*.jsx"`   # optional extra includes
- `--include "components/**/*.jsx"`
- `--scan`                       # preview only
- `--apply`                      # write patches
- `--report`                     # write report
- `--backup`                     # snapshot originals
- `--restore`                    # restore originals
- `--backup-id <timestamp>`      # restore specific backup

## 🧪 Verifying locally

```bash
# install app deps
yarn

# run dev
yarn dev

# switch language, check missing keys in console/log
```