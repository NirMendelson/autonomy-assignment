"""
Code transformation utilities for i18n implementation.
"""

import os
import re
import json
from typing import List, Dict, Any, Optional, Tuple


class CodeTransformer:
    """Transforms code by replacing strings with i18n calls."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.i18n_config = config.get("i18n", {})
        self.default_locale = self.i18n_config.get("default_locale", "en")
        self.locales = self.i18n_config.get("locales", ["en"])
        self.namespace = self.i18n_config.get("namespace", "common")

    # ---------- Public API ----------

    def transform_file(
        self, file_path: str, transformations: List[Dict[str, Any]]
    ) -> Tuple[str, List[str]]:
        """
        Apply i18n replacements to a single file content.
        Fix import and hook placement after replacements.
        """
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        applied_transformations: List[Dict[str, Any]] = []
        if not transformations:
            return content, applied_transformations

        # Sort by descending line to keep indices stable
        transformations.sort(key=lambda x: x["line"], reverse=True)
        lines = content.split("\n")

        for tr in transformations:
            if tr.get("action") != "replace":
                continue
            idx = tr["line"] - 1
            if 0 <= idx < len(lines):
                new_line = self._transform_line(lines[idx], tr)
                if new_line != lines[idx]:
                    lines[idx] = new_line
                    applied_transformations.append(
                        {"key": tr["key"], "original": tr["text"], "line": tr["line"]}
                    )

        new_content = "\n".join(lines)

        # Write file so the fixer can detect t( usage
        if new_content != content:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            # Ensure imports and hook usage inside components
            self._ensure_use_translation_import(file_path)
            self._ensure_t_hook_in_components(file_path)
            with open(file_path, "r", encoding="utf-8") as f:
                new_content = f.read()

        return new_content, applied_transformations

    def generate_locale_files(
        self, transformations: List[Dict[str, Any]], output_dir: str
    ) -> Dict[str, str]:
        """Generate locale JSONs for each configured locale."""
        locale_files: Dict[str, str] = {}
        os.makedirs(os.path.join(output_dir, "locales"), exist_ok=True)

        keys = [
            (tr["key"], tr["text"])
            for tr in transformations
            if tr.get("action") == "replace"
        ]

        for locale in self.locales:
            data: Dict[str, str] = {}
            for key, default_text in keys:
                data[key] = default_text if locale == self.default_locale else default_text

            locale_dir = os.path.join(output_dir, "locales", locale)
            os.makedirs(locale_dir, exist_ok=True)
            locale_file = os.path.join(locale_dir, f"{self.namespace}.json")
            with open(locale_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            locale_files[locale] = locale_file

        return locale_files

    def generate_i18n_config(self, output_dir: str) -> str:
        """Create a minimal i18n.js config."""
        cfg = f"""import i18n from 'i18next';
import {{ initReactI18next }} from 'react-i18next';

const resources = {{
  en: {{
    {self.namespace}: require('./locales/en/{self.namespace}.json'),
  }},
  he: {{
    {self.namespace}: require('./locales/he/{self.namespace}.json'),
  }},
}};

i18n
  .use(initReactI18next)
  .init({{
    resources,
    lng: '{self.default_locale}',
    fallbackLng: '{self.default_locale}',
    interpolation: {{ escapeValue: false }},
    react: {{ useSuspense: false }},
  }});

export default i18n;
"""
        path = os.path.join(output_dir, "i18n.js")
        with open(path, "w", encoding="utf-8") as f:
            f.write(cfg)
        return path

    def update_app_jsx(self, app_file_path: str) -> bool:
        """Add i18n import to _app.jsx if missing."""
        try:
            with open(app_file_path, "r", encoding="utf-8") as f:
                src = f.read()
            if "import '../i18n';" in src or "import \"../i18n\";" in src:
                return False

            lines = src.splitlines()
            insert_at = 0
            for i, ln in enumerate(lines):
                if ln.strip().startswith("import "):
                    insert_at = i + 1
            lines.insert(insert_at, "import '../i18n';")
            with open(app_file_path, "w", encoding="utf-8") as f:
                f.write("\n".join(lines))
            return True
        except Exception as e:
            print(f"[warn] update_app_jsx failed for {app_file_path}: {e}")
            return False

    def create_language_switcher(self, output_dir: str) -> str:
        """Create a tiny language switcher component."""
        content = """import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const changeLanguage = (lng) => i18n.changeLanguage(lng);
  return (
    <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 1000 }}>
      <button onClick={() => changeLanguage('en')}>EN</button>
      <button onClick={() => changeLanguage('he')}>עבר</button>
    </div>
  );
};

export default LanguageSwitcher;
"""
        out = os.path.join(output_dir, "components", "LanguageSwitcher.jsx")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "w", encoding="utf-8") as f:
            f.write(content)
        return out

    # ---------- Replacement core ----------

    def _transform_line(self, line: str, tr: Dict[str, Any]) -> str:
        """
        Context-aware single-line transform.

        Rules:
          JSX text:            >Text<        -> >{t("key")}<
          JSX expr with quotes:{'Text'}      -> {t("key")}
          JSX attribute:       attr="Text"   -> attr={t("key")}
          Plain JS string:     "Text"        -> t("key")
        """
        if tr.get("wrapper") == "Trans":
            # Complex nodes should be handled in a separate AST-aware pass.
            return line

        raw = tr["text"]
        key = tr["key"]
        esc = re.escape(raw)
        
        # DEBUG: Show what we're transforming
        print(f"    DEBUG: Transforming line: '{line}'")
        print(f"    DEBUG: Looking for: '{raw}' -> t('{key}')")

        # 1) JSX text node
        new_line = re.sub(
            rf"(>)(\s*){esc}(\s*)(<)",
            rf"\1\2{{t(\"{key}\")}}\3\4",
            line,
        )
        if new_line != line:
            print(f"    DEBUG: Pattern 1 (JSX text) matched: '{line}' -> '{new_line}'")
            return new_line
        else:
            print(f"    DEBUG: Pattern 1 (JSX text) did NOT match: '{line}'")
            print(f"    DEBUG: Looking for pattern: (>)(\\s*){esc}(\\s*)(<)")
            print(f"    DEBUG: Escaped text: {esc}")

        # 2) JSX expression with quotes {'Text'} / {"Text"} / {`Text`}
        new_line = re.sub(
            rf"\{{\s*([\'\"`]){esc}\1\s*\}}",
            rf"{{t(\"{key}\")}}",
            line,
        )
        if new_line != line:
            print(f"    DEBUG: Pattern 2 (JSX expr) matched: '{line}' -> '{new_line}'")
            return new_line

        # 3) JSX attribute value
        new_line = re.sub(
            rf"(=\s*)([\'\"`]){esc}\2",
            rf"\1{{t(\"{key}\")}}",
            line,
        )
        if new_line != line:
            print(f"    DEBUG: Pattern 3 (JSX attr) matched: '{line}' -> '{new_line}'")
            return new_line

        # 4) Plain JS string literal fallback
        new_line = re.sub(
            rf"([\'\"`]){esc}\1",
            rf"t(\"{key}\")",
            line,
        )
        if new_line != line:
            print(f"    DEBUG: Pattern 4 (JS string) matched: '{line}' -> '{new_line}'")
            return new_line
        
        # 5) Standalone JSX text content (not between tags)
        new_line = re.sub(
            rf"^(\s*){esc}(\s*)$",
            rf"\1{{t(\"{key}\")}}\2",
            line,
        )
        if new_line != line:
            print(f"    DEBUG: Pattern 5 (standalone JSX text) matched: '{line}' -> '{new_line}'")
            return new_line
        
        return new_line

    # ---------- Fixers: imports and hooks ----------

    def _ensure_use_translation_import(self, file_path: str) -> None:
        """Ensure `import { useTranslation } from 'react-i18next'` exists if t( is used."""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                src = f.read()

            if "t(" not in src:
                return
            if "useTranslation" in src:
                return

            lines = src.splitlines()
            insert_at = 0
            for i, ln in enumerate(lines):
                if ln.strip().startswith("import "):
                    insert_at = i + 1
            lines.insert(insert_at, "import { useTranslation } from 'react-i18next';")

            with open(file_path, "w", encoding="utf-8") as f:
                f.write("\n".join(lines))
        except Exception as e:
            print(f"[warn] add useTranslation import failed for {file_path}: {e}")

    def _ensure_t_hook_in_components(self, file_path: str) -> None:
        """
        If a file uses t(, ensure each component has: const { t } = useTranslation();
        Heuristics:
          - function ComponentName(...) { ... }
          - const ComponentName = (...) => { ... }
        """
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                src = f.read()

            if "t(" not in src:
                return

            lines = src.splitlines()
            out: List[str] = []
            i = 0
            while i < len(lines):
                line = lines[i]

                fn_decl = re.match(
                    r"^\s*function\s+([A-Z][A-Za-z0-9_]*)\s*\([^)]*\)\s*\{", line
                )
                arrow_decl = re.match(
                    r"^\s*const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*\([^)]*\)\s*=>\s*\{",
                    line,
                )

                if fn_decl or arrow_decl:
                    comp_name = (fn_decl or arrow_decl).group(1)
                    out.append(line)
                    i += 1

                    # Look ahead limited lines for existing hook or early return
                    has_t = False
                    look_start = len(out)
                    j = i
                    while j < min(i + 20, len(lines)):
                        cur = lines[j]
                        if "const { t } = useTranslation();" in cur:
                            has_t = True
                            break
                        if re.match(r"^\s*return\b", cur):
                            break
                        if re.match(
                            r"^\s*(function\s+[A-Z]|const\s+[A-Z].*=>\s*\{)", cur
                        ):
                            break
                        j += 1

                    if not has_t:
                        out.append("  const { t } = useTranslation();")

                    continue

                out.append(line)
                i += 1

            new_src = "\n".join(out)
            if new_src != src:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(new_src)
        except Exception as e:
            print(f"[warn] ensure t() hook failed for {file_path}: {e}")