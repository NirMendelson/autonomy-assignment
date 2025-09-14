# 🛠️ i18n Agent Workflow

This project automates the process of internationalizing a React codebase by using a single AI agent.  
We will use **GPT-5 Mini** as the model of choice since it balances strong code reasoning with affordable cost.

---

## 🔄 Process Overview

The agent works in **4 main stages**:

1. **Decide Targets**  
   - Scan the repository to determine which files are frontend/UI and require changes.  
   - Example criteria: React/JSX present, imports from UI libraries, excluded tests and backend files.  
   - Output: `targets.json` — a JSON list of files to process.

2. **Find Hardcoded Phrases & Suggest Keys**  
   - Parse each file and identify hardcoded user-facing strings (labels, placeholders, notifications, button text, etc).  
   - Suggest stable i18n keys for each string based on file context and usage.  
   - Output: `candidates.json` — a JSON mapping of raw strings → suggested keys.

3. **Edit Files**  
   - Replace hardcoded strings with calls to `t('key')`.  
   - Inject imports if missing.  
   - Update `i18n/en.json` with the extracted keys and their default English values.  
   - Output: changed source files + `locale_delta.json`.

4. **Validate**  
   - Run build checks (`npm run typecheck`, `npm run build`, `npm run dev`) to ensure no regressions.  
   - Rescan changed files to confirm no visible literals remain.  
   - Output: `validate.json` — success/failure report with suggested fixes.

---

## 💾 Backup & Restore

To safely test the agent’s edits, we provide commands to **backup** the code before running the agent and to **restore** it afterwards.

- **Backup**:  
  ```bash
  npm run i18n:backup
  Creates a snapshot of all target files in `.i18n-backup/`.

- **Restore**:
  ```bash
  npm run i18n:restore
  ```
  Restores files from `.i18n-backup/` back to their original state.

This allows repeatable testing:
1. Run the agent
2. Validate results  
3. Restore to original state
4. Re-run with adjustments

---

## 📂 Artifacts

During the run, the agent produces machine-readable artifacts for traceability:

- `.i18n-agent/targets.json` → list of frontend files to process
- `.i18n-agent/candidates.json` → all detected hardcoded strings with suggested keys
- `.i18n-agent/edits.json` → actual code changes applied
- `.i18n-agent/validate.json` → validation and error report

---

## 🚀 Usage

Typical workflow:
