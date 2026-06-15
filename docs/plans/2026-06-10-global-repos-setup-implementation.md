# Global Repository Environment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:delegated-execution or godmode:task-runner to implement this plan task-by-task.

**Goal:** Set up a centralized repository environment at `/opt/repos/` with three cloned repositories, environment configuration, manifest, documentation, and automated setup script.

**Architecture:** Create `/opt/repos/` as the root directory, clone Obsidian-Vault-, fincast-suite, and ECC there. Write configuration files (`.env.repos`, `repos-manifest.json`), create an automated `setup-repos.sh` script, and comprehensive `README.md`. Use shell aliases and symlinks for convenient access. All setup files are committed to the Obsidian Vault for reproducibility.

**Tech Stack:** Bash, JSON, Git, standard Unix utilities

---

## Task 1: Create `/opt/repos/` Directory Structure

**Files:**
- Create: `/opt/repos/` (directory)
- Create: `/opt/repos/.gitkeep` (placeholder)

**Step 1: Create the directory**

```bash
sudo mkdir -p /opt/repos
sudo chown $(whoami):$(whoami) /opt/repos
chmod 755 /opt/repos
```

Expected: `/opt/repos/` exists with your user as owner

**Step 2: Verify permissions**

```bash
ls -ld /opt/repos
```

Expected output should show: `drwxr-xr-x ... <username> <groupname> ... /opt/repos`

**Step 3: Create .gitkeep placeholder**

```bash
touch /opt/repos/.gitkeep
```

Expected: `.gitkeep` file exists in `/opt/repos/`

**Step 4: Verify directory is ready**

```bash
ls -la /opt/repos/
```

Expected: Shows `.gitkeep` and nothing else

**Step 5: Commit setup reference to Obsidian Vault**

```bash
git add -A
git commit -m "docs: Add setup plan for global /opt/repos/ environment"
```

Expected: Commit successful

---

## Task 2: Write `.env.repos` Configuration File

**Files:**
- Create: `/opt/repos/.env.repos`
- Reference: `/home/user/Obsidian-Vault-/docs/plans/2026-06-10-global-repos-setup-design.md`

**Step 1: Create `.env.repos` file**

```bash
cat > /opt/repos/.env.repos << 'EOF'
#!/bin/bash
# Global Repository Environment Configuration
# Source this file in ~/.bashrc or ~/.zshrc to load repo paths and aliases

# Root directory for all repositories
export REPOS_ROOT="/opt/repos"

# Individual repository paths
export OBSIDIAN_VAULT="${REPOS_ROOT}/obsidian-vault-"
export FINCAST_SUITE="${REPOS_ROOT}/fincast-suite"
export ECC_FRAMEWORK="${REPOS_ROOT}/ecc"

# Add repos scripts to PATH (if scripts directory exists)
if [ -d "${REPOS_ROOT}/scripts" ]; then
  export PATH="${REPOS_ROOT}/scripts:${PATH}"
fi

# Shell aliases for quick navigation
alias dev-global='cd ~/dev-global 2>/dev/null && pwd || echo "~/dev-global not yet created"'
alias vault='cd "${OBSIDIAN_VAULT}" && pwd'
alias fincast='cd "${FINCAST_SUITE}" && pwd'
alias ecc='cd "${ECC_FRAMEWORK}" && pwd'

# Utility: List all repos
alias repos-list='echo "Available repos:"; echo "  $OBSIDIAN_VAULT"; echo "  $FINCAST_SUITE"; echo "  $ECC_FRAMEWORK"'

# Utility: Show repo info
repos-info() {
  echo "=== Repository Environment ==="
  echo "REPOS_ROOT: $REPOS_ROOT"
  echo ""
  echo "Repositories:"
  echo "  OBSIDIAN_VAULT: $OBSIDIAN_VAULT"
  echo "  FINCAST_SUITE: $FINCAST_SUITE"
  echo "  ECC_FRAMEWORK: $ECC_FRAMEWORK"
  echo ""
  echo "Quick access: vault, fincast, ecc, dev-global"
}
EOF
```

Expected: `.env.repos` file created with all configuration

**Step 2: Verify file contents**

```bash
cat /opt/repos/.env.repos | head -20
```

Expected: First 20 lines show shebang, comments, and REPOS_ROOT export

**Step 3: Test sourcing the file**

```bash
source /opt/repos/.env.repos
echo "REPOS_ROOT is: $REPOS_ROOT"
```

Expected: Output shows `REPOS_ROOT is: /opt/repos`

**Step 4: Test aliases are loaded**

```bash
source /opt/repos/.env.repos
alias | grep -E "vault|fincast|ecc"
```

Expected: Shows aliases like `vault='cd "/opt/repos/obsidian-vault-"...'`

**Step 5: Commit to Obsidian Vault**

```bash
cp /opt/repos/.env.repos ~/Obsidian-Vault-/
cd ~/Obsidian-Vault-
git add .env.repos
git commit -m "config: Add .env.repos for global repository environment"
```

Expected: Commit successful

---

## Task 3: Write `repos-manifest.json`

**Files:**
- Create: `/opt/repos/repos-manifest.json`
- Reference: Design document section "Repository Manifest"

**Step 1: Create manifest file**

```bash
cat > /opt/repos/repos-manifest.json << 'EOF'
{
  "repos_root": "/opt/repos",
  "last_updated": "2026-06-10",
  "description": "Centralized repository environment with environment variables, symlinks, and automation",
  "repositories": [
    {
      "name": "obsidian-vault",
      "display_name": "Obsidian Vault",
      "description": "Personal knowledge vault with projects, notes, work context, and Claude session memory",
      "path": "/opt/repos/obsidian-vault-",
      "github_url": "https://github.com/etblues449/Obsidian-Vault-",
      "usage_types": ["reference", "context", "documentation"],
      "key_features": [
        "SessionStart hook for auto-loading context",
        "Cross-device sync via Obsidian",
        "Claude Memory + Projects organization",
        "Work directory with active items"
      ],
      "subdirectories": [
        "Claude Memory/",
        "Work/",
        "scripts/"
      ],
      "commands": {
        "navigate": "vault",
        "env_var": "OBSIDIAN_VAULT"
      }
    },
    {
      "name": "fincast-suite",
      "display_name": "Fincast Suite",
      "description": "Unified fincast application monorepo combining dashboard, backend, and frontend services",
      "path": "/opt/repos/fincast-suite",
      "github_url": "https://github.com/etblues449/fincast-suite",
      "usage_types": ["development", "reference", "dependency"],
      "key_features": [
        "Dashboard: Financial analytics UI",
        "Backend: Worker services and APIs",
        "Frontend: Web application interface",
        "Web Version: Alternative web implementation"
      ],
      "subdirectories": [
        "dashboard/",
        "backend/",
        "frontend/",
        "web-version/"
      ],
      "commands": {
        "navigate": "fincast",
        "env_var": "FINCAST_SUITE"
      }
    },
    {
      "name": "ecc",
      "display_name": "ECC Framework",
      "description": "Comprehensive AI agent framework with 250+ skills and integrations for multiple AI platforms",
      "path": "/opt/repos/ecc",
      "github_url": "https://github.com/affaan-m/ECC",
      "usage_types": ["reference", "learning", "skill-extraction"],
      "key_features": [
        "253+ reusable skills",
        "Multiple AI IDE integrations (Claude, Cursor, Codex, etc.)",
        "Agent framework and protocols",
        "MCP server configurations",
        "Security and testing guidelines"
      ],
      "subdirectories": [
        "skills/",
        "docs/",
        "tests/",
        "integrations/"
      ],
      "commands": {
        "navigate": "ecc",
        "env_var": "ECC_FRAMEWORK"
      }
    }
  ],
  "symlinks": {
    "home_directory": "~/dev-global/",
    "links": [
      {
        "name": "vault",
        "target": "/opt/repos/obsidian-vault-"
      },
      {
        "name": "fincast",
        "target": "/opt/repos/fincast-suite"
      },
      {
        "name": "ecc",
        "target": "/opt/repos/ecc"
      }
    ]
  },
  "environment_variables": {
    "REPOS_ROOT": "/opt/repos",
    "OBSIDIAN_VAULT": "${REPOS_ROOT}/obsidian-vault-",
    "FINCAST_SUITE": "${REPOS_ROOT}/fincast-suite",
    "ECC_FRAMEWORK": "${REPOS_ROOT}/ecc"
  }
}
EOF
```

Expected: `repos-manifest.json` file created with all repository metadata

**Step 2: Validate JSON syntax**

```bash
python3 -m json.tool /opt/repos/repos-manifest.json > /dev/null && echo "✓ JSON is valid"
```

Expected: Output shows `✓ JSON is valid`

**Step 3: Query manifest to verify structure**

```bash
python3 -c "import json; m = json.load(open('/opt/repos/repos-manifest.json')); print(f'Repos: {len(m[\"repositories\"])}'); [print(f'  - {r[\"name\"]}') for r in m['repositories']]"
```

Expected: Shows 3 repositories (obsidian-vault, fincast-suite, ecc)

**Step 4: Commit to Obsidian Vault**

```bash
cp /opt/repos/repos-manifest.json ~/Obsidian-Vault-/
cd ~/Obsidian-Vault-
git add repos-manifest.json
git commit -m "config: Add repos-manifest.json with repository metadata"
```

Expected: Commit successful

---

## Task 4: Write Setup Script (`setup-repos.sh`)

**Files:**
- Create: `/opt/repos/setup-repos.sh`
- Make executable

**Step 1: Create setup script**

```bash
cat > /opt/repos/setup-repos.sh << 'SCRIPT'
#!/bin/bash
set -euo pipefail

# Global Repository Setup Script
# Clones all repositories, creates symlinks, and configures environment

echo "=========================================="
echo "Global Repository Setup"
echo "=========================================="
echo ""

REPOS_ROOT="/opt/repos"
SYMLINK_BASE="$HOME/dev-global"
BACKUPS_DIR="$HOME/.repo-setup-backups"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Step 1: Verify /opt/repos/ exists
status "Checking /opt/repos/ directory..."
if [ ! -d "$REPOS_ROOT" ]; then
    warn "/opt/repos/ does not exist. Creating..."
    sudo mkdir -p "$REPOS_ROOT"
    sudo chown $(whoami):$(whoami) "$REPOS_ROOT"
fi
success "/opt/repos/ is ready"
echo ""

# Step 2: Clone repositories
status "Cloning repositories..."
REPOS=(
    "https://github.com/etblues449/Obsidian-Vault-:obsidian-vault-"
    "https://github.com/etblues449/fincast-suite:fincast-suite"
    "https://github.com/affaan-m/ECC:ecc"
)

for repo_info in "${REPOS[@]}"; do
    IFS=':' read -r url dirname <<< "$repo_info"
    repo_path="$REPOS_ROOT/$dirname"
    
    if [ -d "$repo_path/.git" ]; then
        status "$dirname already cloned, skipping..."
    else
        status "Cloning $url..."
        git clone "$url" "$repo_path"
        success "Cloned: $repo_path"
    fi
done
echo ""

# Step 3: Create symlink directory
status "Setting up symlinks in ~/dev-global/..."
mkdir -p "$SYMLINK_BASE"
success "Created $SYMLINK_BASE"

# Create symlinks
ln -sfv "$REPOS_ROOT/obsidian-vault-" "$SYMLINK_BASE/vault"
ln -sfv "$REPOS_ROOT/fincast-suite" "$SYMLINK_BASE/fincast"
ln -sfv "$REPOS_ROOT/ecc" "$SYMLINK_BASE/ecc"
success "Symlinks created"
echo ""

# Step 4: Update shell configurations
status "Updating shell configurations..."
mkdir -p "$BACKUPS_DIR"

for shell_rc in ".bashrc" ".zshrc"; do
    shell_config="$HOME/$shell_rc"
    
    if [ -f "$shell_config" ]; then
        # Backup the original
        if [ ! -f "$BACKUPS_DIR/$shell_rc.backup" ]; then
            cp "$shell_config" "$BACKUPS_DIR/$shell_rc.backup"
            status "Backed up $shell_config to $BACKUPS_DIR/"
        fi
        
        # Check if .env.repos is already sourced
        if ! grep -q "source /opt/repos/.env.repos" "$shell_config"; then
            echo "" >> "$shell_config"
            echo "# Global repository environment (added by setup-repos.sh)" >> "$shell_config"
            echo "[ -f /opt/repos/.env.repos ] && source /opt/repos/.env.repos" >> "$shell_config"
            success "Added .env.repos source to $shell_rc"
        else
            status "$shell_rc already has .env.repos sourced"
        fi
    fi
done
echo ""

# Step 5: Verify setup
status "Verifying setup..."
echo ""
echo "Repository locations:"
for repo_dir in "$REPOS_ROOT"/*; do
    if [ -d "$repo_dir/.git" ]; then
        repo_name=$(basename "$repo_dir")
        echo "  ✓ $repo_name: $repo_dir"
    fi
done

echo ""
echo "Symlinks:"
for symlink in "$SYMLINK_BASE"/*; do
    if [ -L "$symlink" ]; then
        name=$(basename "$symlink")
        target=$(readlink "$symlink")
        echo "  ✓ $name → $target"
    fi
done

echo ""
status "Testing environment variables..."
source /opt/repos/.env.repos
echo "  REPOS_ROOT=$REPOS_ROOT"
echo "  OBSIDIAN_VAULT=$OBSIDIAN_VAULT"
echo "  FINCAST_SUITE=$FINCAST_SUITE"
echo "  ECC_FRAMEWORK=$ECC_FRAMEWORK"

echo ""
echo "=========================================="
success "Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Reload your shell: source ~/.bashrc (or ~/.zshrc)"
echo "2. Test aliases: vault, fincast, ecc"
echo "3. Test navigation: vault && pwd"
echo ""
echo "Backup of original shell configs: $BACKUPS_DIR/"
echo ""
SCRIPT

chmod +x /opt/repos/setup-repos.sh
```

Expected: Script created and executable

**Step 2: Verify script is executable**

```bash
ls -l /opt/repos/setup-repos.sh
```

Expected: Shows `-rwxr-xr-x` permissions

**Step 3: Test script syntax**

```bash
bash -n /opt/repos/setup-repos.sh && echo "✓ Script syntax is valid"
```

Expected: Output shows `✓ Script syntax is valid`

**Step 4: Commit to Obsidian Vault**

```bash
cp /opt/repos/setup-repos.sh ~/Obsidian-Vault-/
cd ~/Obsidian-Vault-
git add setup-repos.sh
git commit -m "scripts: Add setup-repos.sh for automated global environment setup"
```

Expected: Commit successful

---

## Task 5: Write Comprehensive `README.md`

**Files:**
- Create: `/opt/repos/README.md`

**Step 1: Create README**

```bash
cat > /opt/repos/README.md << 'EOF'
# Global Repository Environment

Centralized workspace for managing multiple projects and frameworks with unified environment configuration, symlinks, and quick-access aliases.

## Overview

This `/opt/repos/` directory serves as the global home for all development projects. It includes:

- **Three main repositories** - Obsidian Vault, Fincast Suite, ECC Framework
- **Environment configuration** - `.env.repos` with variables and aliases
- **Repository metadata** - `repos-manifest.json` documenting all repos
- **Automated setup** - `setup-repos.sh` for easy initialization

## Directory Structure

```
/opt/repos/
├── obsidian-vault-/              # Knowledge vault with projects & context
├── fincast-suite/                # Unified fincast application monorepo
├── ecc/                          # AI agent framework reference (250+ skills)
├── .env.repos                    # Environment variables & shell aliases
├── repos-manifest.json           # Repository metadata & descriptions
├── setup-repos.sh                # Automated setup & cloning script
└── README.md                     # This file
```

## Quick Start

### Automated Setup (First Time)

```bash
# Clone/setup all repositories
bash /opt/repos/setup-repos.sh

# Reload your shell
source ~/.bashrc    # or ~/.zshrc
```

### Manual Setup

If you prefer step-by-step:

```bash
# Clone repositories
git clone https://github.com/etblues449/Obsidian-Vault- /opt/repos/obsidian-vault-
git clone https://github.com/etblues449/fincast-suite /opt/repos/fincast-suite
git clone https://github.com/affaan-m/ECC /opt/repos/ecc

# Create symlinks
mkdir -p ~/dev-global
ln -s /opt/repos/obsidian-vault- ~/dev-global/vault
ln -s /opt/repos/fincast-suite ~/dev-global/fincast
ln -s /opt/repos/ecc ~/dev-global/ecc

# Load environment
echo 'source /opt/repos/.env.repos' >> ~/.bashrc
source ~/.bashrc
```

## Navigation & Access

### Using Aliases

```bash
# Quick navigation
vault                  # Jump to Obsidian Vault
fincast                # Jump to Fincast Suite
ecc                    # Jump to ECC Framework
dev-global             # Jump to ~/dev-global symlink directory
```

### Using Environment Variables

```bash
# In shell scripts or code
cd $OBSIDIAN_VAULT
cd $FINCAST_SUITE
cd $ECC_FRAMEWORK

# Or query from scripts
echo "My vault is at: $OBSIDIAN_VAULT"
find $FINCAST_SUITE -name "*.py"
```

### Direct Paths

```bash
cd /opt/repos/obsidian-vault-
cd /opt/repos/fincast-suite
cd /opt/repos/ecc
```

## Repository Descriptions

### Obsidian Vault (`obsidian-vault-`)

**Purpose:** Personal knowledge management and project context  
**Usage:** Reference, context, documentation  
**Key Features:**
- SessionStart hook for auto-loading Claude context
- Cross-device sync via Obsidian Sync
- Organized notes and project management
- Claude Memory with project-specific context

**Navigate:** `vault` or `$OBSIDIAN_VAULT`

**Example:**
```bash
vault
cd "Claude Memory/Projects/Smart Home"
cat _index.md
```

### Fincast Suite (`fincast-suite`)

**Purpose:** Unified financial forecasting application  
**Usage:** Active development, reference, dependency integration  
**Structure:**
- `dashboard/` - Financial analytics UI
- `backend/` - Worker services and APIs (pending merge)
- `frontend/` - Web application interface (pending merge)
- `web-version/` - Alternative web implementation (pending merge)

**Navigate:** `fincast` or `$FINCAST_SUITE`

**Example:**
```bash
fincast
cd dashboard
npm install
npm start
```

### ECC Framework (`ecc`)

**Purpose:** Comprehensive AI agent framework and skill library  
**Usage:** Reference, learning, pattern extraction  
**Key Features:**
- 250+ reusable skills for AI-assisted development
- Multiple AI IDE integrations (Claude, Cursor, Codex, etc.)
- Agent framework and protocol definitions
- MCP server configurations
- Security and testing best practices

**Navigate:** `ecc` or `$ECC_FRAMEWORK`

**Example:**
```bash
ecc
ls skills/ | head -20
cat skills/*/SKILL.md | grep "# " | head -10
```

## Usage Patterns

### Pattern 1: Reference & Learning

Quickly access repo documentation:

```bash
# Read repository info
vault && cat README.md
fincast && cat README.md
ecc && cat README.md

# Search for patterns
grep -r "pattern_name" $FINCAST_SUITE/
find $ECC_FRAMEWORK/skills -name "*specific-skill*"
```

### Pattern 2: Active Development

Work directly in a repo:

```bash
fincast
cd backend/
git checkout -b feature/new-endpoint
# ... make changes ...
git add .
git commit -m "feat: add new endpoint"
git push origin feature/new-endpoint
```

### Pattern 3: Dependency Integration

Reference repos from scripts or other projects:

```bash
#!/bin/bash
# Script using environment variables
VAULT_PROJECT="$OBSIDIAN_VAULT/Work/MyProject"
FINCAST_CONFIG="$FINCAST_SUITE/config"

cp "$FINCAST_CONFIG/default.json" "/tmp/config.json"
```

## Adding New Repositories

To add another repository to this environment:

1. Clone it to `/opt/repos/`:
   ```bash
   git clone <url> /opt/repos/<name>
   ```

2. Update `repos-manifest.json` with its metadata

3. Create a symlink if desired:
   ```bash
   ln -s /opt/repos/<name> ~/dev-global/<shortname>
   ```

4. Add environment variable to `.env.repos`:
   ```bash
   export MY_REPO="${REPOS_ROOT}/<name>"
   ```

5. Add alias to `.env.repos` (optional):
   ```bash
   alias myrepo='cd "${MY_REPO}" && pwd'
   ```

6. Reload: `source ~/.bashrc`

## Utilities

### Repo Info

Display current repository configuration:

```bash
repos-info
```

Output:
```
=== Repository Environment ===
REPOS_ROOT: /opt/repos

Repositories:
  OBSIDIAN_VAULT: /opt/repos/obsidian-vault-
  FINCAST_SUITE: /opt/repos/fincast-suite
  ECC_FRAMEWORK: /opt/repos/ecc

Quick access: vault, fincast, ecc, dev-global
```

### List Repos

```bash
repos-list
```

### Manifest Query

View repository metadata:

```bash
python3 -m json.tool /opt/repos/repos-manifest.json
```

## Troubleshooting

### Aliases not working

Make sure `.env.repos` is sourced:

```bash
source /opt/repos/.env.repos
alias | grep vault
```

### Symlinks broken

Verify symlink targets:

```bash
ls -la ~/dev-global/
readlink ~/dev-global/vault
```

### Repository not found

Check that clone succeeded:

```bash
ls -la /opt/repos/
```

If a repo is missing, clone it:

```bash
git clone <url> /opt/repos/<name>
```

## Shell Configuration

### For Bash

Add to `~/.bashrc`:

```bash
[ -f /opt/repos/.env.repos ] && source /opt/repos/.env.repos
```

### For Zsh

Add to `~/.zshrc`:

```bash
[ -f /opt/repos/.env.repos ] && source /opt/repos/.env.repos
```

### For Fish

Create `~/.config/fish/conf.d/repos.fish`:

```fish
test -f /opt/repos/.env.repos; and source /opt/repos/.env.repos
```

## Backup & Restore

The setup script creates backups of your shell configurations:

```bash
ls -la ~/.repo-setup-backups/
```

To restore a backup:

```bash
cp ~/.repo-setup-backups/.bashrc.backup ~/.bashrc
```

## FAQ

**Q: Can I work directly in these repos?**  
A: Yes! The fincast-suite and obsidian-vault are meant for active development. Just use normal git workflow.

**Q: How do I update all repos at once?**  
A: Create a simple script:
```bash
for repo in $REPOS_ROOT/*/; do
  (cd "$repo" && git pull origin main)
done
```

**Q: Can I use these repos on multiple machines?**  
A: Yes. Run `setup-repos.sh` on each machine to get the same environment.

**Q: What if I delete a repo by mistake?**  
A: Just re-clone it:
```bash
git clone <url> /opt/repos/<name>
```

## Support

For issues with specific repositories, see their individual README files:

- **Obsidian Vault:** `/opt/repos/obsidian-vault-/README.md`
- **Fincast Suite:** `/opt/repos/fincast-suite/README.md`
- **ECC Framework:** `/opt/repos/ecc/README.md`

---

**Last Updated:** 2026-06-10  
**Setup Method:** Automated with `setup-repos.sh`  
**Configuration:** `.env.repos`, `repos-manifest.json`
EOF
```

Expected: `README.md` file created with comprehensive documentation

**Step 2: Verify README exists**

```bash
wc -l /opt/repos/README.md
```

Expected: Shows line count (should be 400+)

**Step 3: Commit to Obsidian Vault**

```bash
cp /opt/repos/README.md ~/Obsidian-Vault-/
cd ~/Obsidian-Vault-
git add README.md
git commit -m "docs: Add comprehensive README for global /opt/repos/ environment"
```

Expected: Commit successful

---

## Task 6: Execute Setup Script

**Files:**
- Execute: `/opt/repos/setup-repos.sh`
- Verify: All clones, symlinks, environment

**Step 1: Run the setup script**

```bash
bash /opt/repos/setup-repos.sh
```

Expected: Script output showing:
- ✓ /opt/repos/ is ready
- ✓ Cloned repositories or skipped if already exist
- ✓ Symlinks created
- ✓ Shell configuration updated
- ✓ Verification complete

**Step 2: Verify repositories are cloned**

```bash
ls -la /opt/repos/ | grep "^d"
```

Expected: Shows 4 directories:
- obsidian-vault-
- fincast-suite
- ecc
- (and hidden directories like .git if any)

**Step 3: Verify each repo has .git**

```bash
for repo in /opt/repos/obsidian-vault- /opt/repos/fincast-suite /opt/repos/ecc; do
  if [ -d "$repo/.git" ]; then
    echo "✓ $(basename $repo) is a git repository"
  else
    echo "✗ $(basename $repo) is NOT a git repository"
  fi
done
```

Expected: All three repos show ✓

**Step 4: Verify symlinks**

```bash
ls -l ~/dev-global/
```

Expected: Shows symlinks:
```
vault -> /opt/repos/obsidian-vault-
fincast -> /opt/repos/fincast-suite
ecc -> /opt/repos/ecc
```

**Step 5: Reload shell and test aliases**

```bash
source ~/.bashrc
alias | grep -E "vault|fincast|ecc"
```

Expected: Shows aliases are defined

**Step 6: Test navigation with alias**

```bash
source ~/.bashrc
vault && pwd
```

Expected: Output shows `/opt/repos/obsidian-vault-`

**Step 7: Test environment variables**

```bash
source ~/.bashrc
echo "Obsidian Vault: $OBSIDIAN_VAULT"
echo "Fincast Suite: $FINCAST_SUITE"
echo "ECC Framework: $ECC_FRAMEWORK"
```

Expected: Shows all three paths

**Step 8: Verify repos-manifest.json is valid**

```bash
python3 -m json.tool /opt/repos/repos-manifest.json > /dev/null && echo "✓ Manifest is valid JSON"
```

Expected: Output shows `✓ Manifest is valid JSON`

**Step 9: Commit all setup files to Obsidian Vault**

```bash
cd ~/Obsidian-Vault-
git add .env.repos repos-manifest.json setup-repos.sh README.md
git commit -m "feat: Complete global /opt/repos/ environment setup

- Clone all three repositories (Obsidian-Vault-, fincast-suite, ECC)
- Create symlinks in ~/dev-global/ for quick access
- Configure shell environment with .env.repos
- Add comprehensive documentation and manifest
- Automated setup script for reproducibility"
```

Expected: Commit successful

**Step 10: Push to remote**

```bash
cd ~/Obsidian-Vault-
git push origin main
```

Expected: Changes pushed to origin/main

---

## Task 7: Comprehensive Verification

**Files:**
- Verify: All components working together

**Step 1: Verify directory structure**

```bash
echo "=== Repository Locations ===" && \
find /opt/repos -maxdepth 2 -type d -name ".git" | sed 's|/.git||' | xargs -I {} basename {} && \
echo "" && \
echo "=== Symlink Targets ===" && \
ls -la ~/dev-global/ | grep " -> "
```

Expected: Shows all three repos and symlinks pointing correctly

**Step 2: Verify environment variables work across shells**

```bash
bash -c 'source /opt/repos/.env.repos; echo "bash: $OBSIDIAN_VAULT"'
zsh -c 'source /opt/repos/.env.repos; echo "zsh: $OBSIDIAN_VAULT"' 2>/dev/null || echo "zsh: (not installed or sourcing works)"
```

Expected: Shows vault path in both shells

**Step 3: Test real-world usage patterns**

```bash
# Pattern 1: Reference
source ~/.bashrc
cat $FINCAST_SUITE/README.md | head -5

# Pattern 2: Navigation
vault && pwd && cd .. && pwd

# Pattern 3: Git operations
fincast && git status | head -3
```

Expected: All commands execute successfully

**Step 4: Verify setup script is idempotent**

```bash
bash /opt/repos/setup-repos.sh 2>&1 | grep -i "already cloned\|already has\|skipping"
```

Expected: Shows at least one message indicating repos are already set up and script skips re-cloning

**Step 5: Final summary**

```bash
echo "=== Global Repos Setup Complete ===" && \
echo "Root: /opt/repos" && \
echo "Repos: $(ls -d /opt/repos/*/ 2>/dev/null | wc -l)" && \
echo "Symlinks: $(ls -l ~/dev-global/ 2>/dev/null | grep " -> " | wc -l)" && \
echo "Config files: $(ls -1 /opt/repos/.env.repos /opt/repos/repos-manifest.json /opt/repos/README.md 2>/dev/null | wc -l)" && \
echo "Status: ✓ COMPLETE"
```

Expected: Shows summary with all components in place

**Step 6: Final commit with verification report**

```bash
cd ~/Obsidian-Vault-
git log --oneline -5
echo "✓ All tasks complete - global /opt/repos/ environment fully functional"
```

Expected: Recent commits visible, verification successful

---

## Summary

**Total Tasks:** 7  
**Files Created:** 4 (`.env.repos`, `repos-manifest.json`, `setup-repos.sh`, `README.md`)  
**Repositories Cloned:** 3 (Obsidian-Vault-, fincast-suite, ECC)  
**Environment Configured:** Shell aliases, variables, symlinks  
**All Changes Committed:** Yes, to Obsidian Vault for reproducibility

---

## Next Steps

After implementation, the global repository environment will be ready for:
- Quick navigation to any project via aliases
- Cross-repository scripting using environment variables
- Reference material access without duplicating files
- Active development in fincast-suite
- New repository addition following established patterns

**Execution Method:**  
Choose one:

**Option 1: Delegated Execution (this session)**  
I dispatch fresh subagents for each task with code review between tasks

**Option 2: Task Runner (separate session)**  
Open new session in worktree with this plan, use godmode:task-runner for batch execution

**Which would you prefer?**
