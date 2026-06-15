# Task 4: Write Setup Script (`setup-repos.sh`)

**Date Completed:** 2026-06-10  
**Status:** COMPLETED

## Objective
Create an automated bash script that clones all repositories, creates symlinks, and configures the shell environment.

## Implementation Details

### File Created
- **Location:** `/opt/repos/setup-repos.sh`
- **Permissions:** `-rwxr-xr-x` (executable)
- **Size:** ~11.3 KB
- **Lines:** 450+ lines of production-ready bash code

### Script Features

#### 1. Error Handling
- Proper shebang: `#!/bin/bash`
- Strict error handling: `set -euo pipefail`
- Comprehensive exit codes and error messages

#### 2. Color-Coded Output
- **GREEN:** Success messages `[SUCCESS]`
- **BLUE:** Status/info messages `[INFO]`
- **YELLOW:** Warning messages `[WARN]`
- **RED:** Error messages `[ERROR]`

#### 3. Helper Functions
```bash
status()   # Print status message with BLUE prefix
success()  # Print success message with GREEN prefix
warn()     # Print warning message with YELLOW prefix
error()    # Print error message with RED prefix and exit
```

#### 4. Main Functionality

**Phase 1: Verify Repos Root**
- Checks `/opt/repos` directory exists
- Verifies write permissions
- Fails gracefully with instructions if issues found

**Phase 2: Clone Repositories**
- Clones 3 repositories from GitHub:
  1. `obsidian-vault-` from `https://github.com/etblues449/Obsidian-Vault-`
  2. `fincast-suite` from `https://github.com/etblues449/fincast-suite`
  3. `ecc` from `https://github.com/affaan-m/ECC`
- Idempotent: skips if repos already cloned
- Full error handling for network failures

**Phase 3: Create Symlink Directory**
- Creates `~/dev-global/` directory if it doesn't exist
- Ensures proper directory structure

**Phase 4: Create Symlinks**
- vault → /opt/repos/obsidian-vault-
- fincast → /opt/repos/fincast-suite
- ecc → /opt/repos/ecc
- Validates symlink targets
- Recovers from broken symlinks

**Phase 5: Update Shell Configuration**
- Updates `.bashrc` and `.zshrc`
- Creates backups with timestamps: `filename_backup_YYYYMMDD_HHMMSS`
- Adds conditional sourcing of `.env.repos`
- Idempotent: skips if already configured

**Phase 6: Verification**
- Verifies all repositories cloned and are git repos
- Verifies all symlinks exist and point correctly
- Displays environment variables from `.env.repos`

**Phase 7: Final Summary**
- Shows repository locations with ✓/✗ status
- Lists quick-access symlinks
- Displays environment setup status
- Provides next steps for user

#### 5. Command-Line Options

```bash
-h, --help       # Show help message
-v, --verify     # Run verification only (no setup)
-c, --clone      # Clone repositories only
-s, --symlinks   # Create symlinks only
```

### Idempotent Behavior
- Safe to run multiple times
- Skips cloning if repos already exist
- Detects existing symlinks and verifies targets
- Skips shell config updates if already sourced
- Never duplicates environment sourcing

### Script Configuration
```bash
REPOS_ROOT="/opt/repos"
DEV_GLOBAL="${HOME}/dev-global"
ENV_FILE="${REPOS_ROOT}/.env.repos"
BACKUP_SUFFIX="_backup_$(date +%Y%m%d_%H%M%S)"
```

### Repository Definitions
- obsidian-vault: GitHub user etblues449
- fincast-suite: GitHub user etblues449
- ecc: GitHub user affaan-m (external reference repo)

## Testing & Verification

### Syntax Check
```bash
$ bash -n /opt/repos/setup-repos.sh
Syntax check passed!
```

### Execution Permissions
```bash
$ ls -la /opt/repos/setup-repos.sh
-rwxr-xr-x 1 root root 11296 Jun 10 01:13 /opt/repos/setup-repos.sh
```

### Help Output
```bash
$ /opt/repos/setup-repos.sh --help
Global Repository Setup Script

Usage: setup-repos.sh [OPTIONS]

Options:
  -h, --help       Show this help message
  -v, --verify     Run verification only (no setup)
  -c, --clone      Clone repositories only
  -s, --symlinks   Create symlinks only

Examples:
  ./setup-repos.sh              # Full setup
  ./setup-repos.sh --verify     # Verify existing setup
  ./setup-repos.sh --clone      # Clone repos only
```

## Integration with Environment

The script works seamlessly with:
- `.env.repos` file (shell environment configuration)
- `.bashrc` and `.zshrc` (shell startup scripts)
- `repos-manifest.json` (repository metadata)

### Environment Variables Created
```bash
export REPOS_ROOT="/opt/repos"
export OBSIDIAN_VAULT="${REPOS_ROOT}/obsidian-vault-"
export FINCAST_SUITE="${REPOS_ROOT}/fincast-suite"
export ECC_FRAMEWORK="${REPOS_ROOT}/ecc"
```

### Aliases Created
```bash
alias vault='cd "${OBSIDIAN_VAULT}" && pwd'
alias fincast='cd "${FINCAST_SUITE}" && pwd'
alias ecc='cd "${ECC_FRAMEWORK}" && pwd'
alias dev-global='cd ~/dev-global && pwd'
alias repos-list='...'
alias repos-info='...'
```

## Usage Examples

### Full Setup (Recommended)
```bash
/opt/repos/setup-repos.sh
```

### Clone Repositories Only
```bash
/opt/repos/setup-repos.sh --clone
```

### Create Symlinks Only
```bash
/opt/repos/setup-repos.sh --symlinks
```

### Verify Existing Setup
```bash
/opt/repos/setup-repos.sh --verify
```

### Show Help
```bash
/opt/repos/setup-repos.sh --help
```

## Output Example (Expected)

```
===============================================
  Global Repository Setup Script
===============================================

[INFO] Verifying /opt/repos directory...
[SUCCESS] /opt/repos directory is accessible
[INFO] ==========================================
[INFO] Phase 1: Cloning Repositories
[INFO] ==========================================
[INFO] Processing repository: obsidian-vault
[INFO] Cloning obsidian-vault from https://github.com/etblues449/Obsidian-Vault-...
[SUCCESS] Successfully cloned obsidian-vault
[INFO] Processing repository: fincast-suite
[INFO] Cloning fincast-suite from https://github.com/etblues449/fincast-suite...
[SUCCESS] Successfully cloned fincast-suite
[INFO] Processing repository: ecc
[INFO] Cloning ecc from https://github.com/affaan-m/ECC...
[SUCCESS] Successfully cloned ecc
[INFO] Repository cloning phase complete
[INFO] ==========================================
[INFO] Phase 2: Creating Symlink Directory
[INFO] ==========================================
[INFO] Creating ~/dev-global directory...
[SUCCESS] Created ~/dev-global
[INFO] ==========================================
[INFO] Phase 3: Creating Symlinks
[INFO] ==========================================
[SUCCESS] Created symlink: vault -> /opt/repos/obsidian-vault-
[SUCCESS] Created symlink: fincast -> /opt/repos/fincast-suite
[SUCCESS] Created symlink: ecc -> /opt/repos/ecc
[INFO] Symlink creation phase complete
[INFO] ==========================================
[INFO] Phase 4: Updating Shell Configuration
[INFO] ==========================================
[SUCCESS] Updated ~/.bashrc
[SUCCESS] Updated ~/.zshrc
[INFO] Shell configuration update phase complete
[INFO] ==========================================
[INFO] Phase 5: Verification
[INFO] ==========================================
[SUCCESS] All repositories verified
[SUCCESS] All symlinks verified
[INFO] ========================================

Setup Summary
[INFO] ========================================

Repository Locations:
  ✓ obsidian-vault: /opt/repos/obsidian-vault-
  ✓ fincast-suite: /opt/repos/fincast-suite
  ✓ ecc: /opt/repos/ecc

Quick Access Symlinks (~/dev-global/):
  ✓ vault -> /opt/repos/obsidian-vault-
  ✓ fincast -> /opt/repos/fincast-suite
  ✓ ecc -> /opt/repos/ecc

Environment Setup:
  ✓ Environment file: /opt/repos/.env.repos
  ✓ Shell configs updated: ~/.bashrc, ~/.zshrc

Next Steps:
  1. Reload your shell or run: source ~/.bashrc
  2. Test navigation: vault, fincast, ecc
  3. Verify environment: repos-info

[SUCCESS] Setup Complete!
```

## Files Involved

- **Primary Script:** `/opt/repos/setup-repos.sh` (450+ lines)
- **Backup Copy:** `/home/user/Obsidian-Vault-/Work/setup-repos.sh`
- **Related Config:** `/opt/repos/.env.repos`
- **Related Manifest:** `/home/user/Obsidian-Vault-/repos-manifest.json`

## Status

✓ Script created with 450+ lines of production code  
✓ Syntax validated with `bash -n`  
✓ Made executable with proper permissions  
✓ Color-coded output implemented  
✓ Helper functions implemented  
✓ Error handling with `set -euo pipefail`  
✓ Idempotent behavior ensured  
✓ Command-line options implemented  
✓ Comprehensive verification phases  
✓ Backup functionality for shell configs  
✓ Copied to Obsidian Vault for backup  
✓ Ready for execution  

## Next Steps

The script is ready to run. To execute the full setup:

```bash
/opt/repos/setup-repos.sh
```

This will:
1. Clone all 3 repositories
2. Create ~/dev-global symlinks
3. Update shell configuration files
4. Verify everything is working
5. Display comprehensive summary

For subsequent tasks (Task 5+), the setup can be verified by running:
```bash
/opt/repos/setup-repos.sh --verify
```
