# 🤖 Autonomous I18n Agent

An intelligent AI-powered Python agent that automatically internationalizes React applications by finding hardcoded strings, transforming them to use translation functions, generating translations, and integrating everything into your Next.js app.


## 🔄 Agent Workflow

The autonomous agent follows an 8-phase workflow:

### Phase 1: 🔍 **Search**
- Discovers all React files (`.jsx`, `.js`, `.tsx`, `.ts`)
- Stores file list in agent memory

### Phase 2: 📊 **Analyze** 
- Uses AI to find hardcoded strings in each file
- Identifies user-facing text (buttons, labels, alt text, etc.)
- Generates semantic translation keys

### Phase 3: 🛠️ **Transform**
- Converts hardcoded strings to `t()` function calls
- Adds `useTranslation` hook imports
- Maintains all existing functionality

### Phase 4: 🌐 **Translate**
- Uses Claude AI to generate translations for target language
- Creates translation mappings

### Phase 5: 📝 **Locale**
- Creates locale files (`locales/en/common.json`, `locales/es/common.json`)
- Organizes translations by namespace

### Phase 6: ⚙️ **Setup**
- Creates i18n configuration (`lib/i18n.js`)
- Sets up React i18n provider (`components/I18nProvider.jsx`)

### Phase 7: 🔗 **Integrate**
- Updates `pages/_app.jsx` to include i18n provider
- Creates language switcher component
- Integrates switcher into header



## 🚀 Quick Start Guide

### Prerequisites

1. **Node.js** (v18.15.0 or higher)
2. **Python** (v3.8 or higher)
3. **API Keys** in your `.env` file:
   ```env
   ANTHROPIC_API_KEY=your-anthropic-key
   SESSION_SECRET=your-session-secret
   MONGO_URL=mongodb://localhost:27017/your-db
   I18N_TARGET_LANGUAGE=es
   ```

### Installation

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Set up Python virtual environment:**
   ```bash
   # Create virtual environment
   python -m venv venv
   
   # Activate virtual environment
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   
   # Install Python dependencies
   pip install -r pythonAgent/requirements.txt
   ```

### Commands

| Command | Description |
|---------|-------------|
| `npm run i18n:agent` | Run the Python autonomous agent on the full project |
| `npm run i18n:backup` | Create backup of current files |
| `npm run i18n:restore` | Restore files and delete i18n files |
| `npm run i18n:backup-info` | Show backup information |

**Python Agent Commands:**
| Command | Description |
|---------|-------------|
| `python -m venv venv` | Create Python virtual environment |
| `pip install -r pythonAgent/requirements.txt` | Install Python dependencies |

### Usage

```bash
# 1. Activate Python virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# 2. Create backup (optional but recommended)
npm run i18n:backup

# 3. Run the Python agent
npm run i18n:agent
# OR run directly:
python pythonAgent/main.py

# 4. If you want to undo everything
npm run i18n:restore
```

### Language Configuration

To choose the target language for translations, set the `I18N_TARGET_LANGUAGE` environment variable in your `.env` file:

```env
# Examples:
I18N_TARGET_LANGUAGE=es    # Spanish (default)
I18N_TARGET_LANGUAGE=fr    # French
I18N_TARGET_LANGUAGE=de    # German
I18N_TARGET_LANGUAGE=pt    # Portuguese
I18N_TARGET_LANGUAGE=it    # Italian
I18N_TARGET_LANGUAGE=zh    # Chinese
I18N_TARGET_LANGUAGE=ja    # Japanese
I18N_TARGET_LANGUAGE=ko    # Korean
I18N_TARGET_LANGUAGE=ar    # Arabic
I18N_TARGET_LANGUAGE=ru    # Russian
```
