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
