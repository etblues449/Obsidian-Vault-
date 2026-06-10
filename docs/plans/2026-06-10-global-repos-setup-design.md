# Global Repository Environment Setup - Design Document

**Date:** 2026-06-10  
**Status:** Approved  
**Objective:** Create an environment-wide repository structure at `/opt/repos/` with automation, documentation, and tooling integration

## Overview

This design establishes a centralized repository environment where all active projects (Obsidian-Vault-, fincast-suite, ECC) are cloned to `/opt/repos/` and made accessible via environment variables, shell aliases, and symlinks. The setup supports mixed usage patterns: reference material, active development, and dependency injection across projects.

## Architecture

### Directory Structure

**Primary location: `/opt/repos/`**
```
/opt/repos/
├── obsidian-vault-/              # Main knowledge vault
├── fincast-suite/                # Application monorepo
├── ecc/                          # AI agent framework reference
├── .env.repos                    # Environment variables
├── repos-manifest.json           # Repository metadata
├── setup-repos.sh                # Automated setup script
└── README.md                     # Usage documentation
```

**Convenience symlinks: `~/dev-global/`**
```
~/dev-global/
├── vault → /opt/repos/obsidian-vault-/
├── fincast → /opt/repos/fincast-suite/
└── ecc → /opt/repos/ecc/
```

### Environment Setup

**`.env.repos` exports:**
- `REPOS_ROOT=/opt/repos` — Root directory for all repos
- `OBSIDIAN_VAULT=${REPOS_ROOT}/obsidian-vault-` — Vault location
- `FINCAST_SUITE=${REPOS_ROOT}/fincast-suite` — Fincast monorepo
- `ECC_FRAMEWORK=${REPOS_ROOT}/ecc` — ECC framework reference

**Shell integration:**
- Source `.env.repos` in `.bashrc` and `.zshrc`
- Add aliases: `vault`, `fincast`, `ecc` for quick navigation
- Add `$REPOS_ROOT/scripts` to PATH for tooling access

### Repository Manifest

**`repos-manifest.json` contains:**
- Repository name, description, and GitHub URL
- Local path and environment variable name
- Usage types: reference, development, dependency
- Key features and subdirectories
- Quick-access commands and navigation aliases

**Structure:**
```json
{
  "repos_root": "/opt/repos",
  "repositories": [
    {
      "name": "obsidian-vault",
      "description": "...",
      "path": "/opt/repos/obsidian-vault-",
      "github_url": "...",
      "usage_types": ["reference", "context"],
      "commands": { ... }
    }
  ]
}
```

### Documentation

**`README.md` includes:**
- Overview of the global environment
- Directory structure and purpose of each repo
- How to navigate using aliases and environment variables
- Usage patterns for reference, development, and dependency injection
- Instructions for adding new repositories
- Command to update/refresh all repos

## Implementation Artifacts

### Files to Create

1. **`.env.repos`** — Environment variable configuration
2. **`repos-manifest.json`** — Repository metadata manifest
3. **`setup-repos.sh`** — Automated setup and cloning script
4. **`README.md`** — User documentation and usage guide

### Script Responsibilities (`setup-repos.sh`)

- Verify/create `/opt/repos/` directory structure
- Clone three repositories (if not already present)
- Create symlinks in `~/dev-global/`
- Write `.env.repos` to `/opt/repos/`
- Append `.env.repos` source to shell startup files (with backups)
- Generate and place `repos-manifest.json`
- Generate and place `README.md`
- Verify all repos cloned successfully
- Print summary report

## Usage Patterns

### Reference & Learning
```bash
# Access repo via environment variable
cat $FINCAST_SUITE/README.md

# Quick navigation with alias
vault
cd "Claude Memory/Projects"
```

### Active Development
```bash
# Navigate to repo
fincast
cd backend/
git checkout -b feature/new-api

# Commit and push as normal
git add .
git commit -m "..."
git push origin feature/new-api
```

### Dependency Injection (Scripts/Code)
```bash
# Shell scripts can reference repos
source $OBSIDIAN_VAULT/.env.repos
find $FINCAST_SUITE -name "*.json"

# Python/Node scripts can read REPOS_ROOT env var
import os
repos = os.environ['REPOS_ROOT']
```

## Success Criteria

✅ All three repositories cloned to `/opt/repos/`  
✅ Environment variables accessible in all shells  
✅ Symlinks in `~/dev-global/` point to active repos  
✅ Shell aliases (`vault`, `fincast`, `ecc`) work correctly  
✅ Manifest file is accurate and complete  
✅ Documentation is clear and discoverable  
✅ Setup script is idempotent (safe to run multiple times)  
✅ Full integration verified with test navigation and env var access

## Next Steps

Implementation will follow the task-planning handoff, with sequential execution of:
1. Create `/opt/repos/` directory structure
2. Write configuration files (`.env.repos`, `repos-manifest.json`)
3. Write `setup-repos.sh` script with clone and setup logic
4. Write comprehensive `README.md`
5. Execute setup script to verify everything
6. Test all access patterns (aliases, env vars, symlinks)
7. Commit setup files to Obsidian Vault for version control

---

**Design approved by user on:** 2026-06-10  
**Implementation tracked by:** task-planning skill
