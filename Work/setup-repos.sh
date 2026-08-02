#!/bin/bash
################################################################################
# Global Repository Setup Script
#
# Objective: Automated setup for cloning repositories, creating symlinks,
#            and configuring the shell environment
#
# Usage: ./setup-repos.sh
#
# Features:
#   - Idempotent (safe to run multiple times)
#   - Color-coded status messages
#   - Comprehensive error handling
#   - Backs up shell configuration files
#   - Creates symlinks and environment setup
#   - Detailed verification output
################################################################################

set -euo pipefail

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Script configuration
readonly REPOS_ROOT="/opt/repos"
readonly DEV_GLOBAL="${HOME}/dev-global"
readonly ENV_FILE="${REPOS_ROOT}/.env.repos"
readonly BACKUP_SUFFIX="_backup_$(date +%Y%m%d_%H%M%S)"

# Repository definitions
declare -A REPOS=(
  [obsidian-vault]="https://github.com/etblues449/Obsidian-Vault-"
  [fincast-suite]="https://github.com/etblues449/fincast-suite"
  [ecc]="https://github.com/affaan-m/ECC"
)

declare -A REPO_PATHS=(
  [obsidian-vault]="${REPOS_ROOT}/obsidian-vault-"
  [fincast-suite]="${REPOS_ROOT}/fincast-suite"
  [ecc]="${REPOS_ROOT}/ecc"
)

declare -A SYMLINK_NAMES=(
  [obsidian-vault]="vault"
  [fincast-suite]="fincast"
  [ecc]="ecc"
)

################################################################################
# Helper Functions
################################################################################

# Print status message with BLUE prefix
status() {
  echo -e "${BLUE}[INFO]${NC} $*"
}

# Print success message with GREEN prefix
success() {
  echo -e "${GREEN}[SUCCESS]${NC} $*"
}

# Print warning message with YELLOW prefix
warn() {
  echo -e "${YELLOW}[WARN]${NC} $*"
}

# Print error message with RED prefix and exit
error() {
  echo -e "${RED}[ERROR]${NC} $*" >&2
  exit 1
}

# Verify root directory exists and is writable
verify_repos_root() {
  status "Verifying /opt/repos directory..."

  if [ ! -d "${REPOS_ROOT}" ]; then
    error "/opt/repos directory does not exist. Run: sudo mkdir -p ${REPOS_ROOT}"
  fi

  if [ ! -w "${REPOS_ROOT}" ]; then
    error "No write permission to ${REPOS_ROOT}. Run: sudo chown -R \$USER:\$USER ${REPOS_ROOT}"
  fi

  success "/opt/repos directory is accessible"
}

# Clone a single repository
clone_repo() {
  local repo_name="$1"
  local repo_url="${REPOS[$repo_name]}"
  local repo_path="${REPO_PATHS[$repo_name]}"

  status "Processing repository: ${repo_name}"

  if [ -d "${repo_path}" ]; then
    warn "Repository already exists at ${repo_path}"
    status "Skipping clone (idempotent behavior)"
    return 0
  fi

  status "Cloning ${repo_name} from ${repo_url}..."

  if git clone "${repo_url}" "${repo_path}"; then
    success "Successfully cloned ${repo_name}"
    return 0
  else
    error "Failed to clone ${repo_name} from ${repo_url}"
  fi
}

# Clone all repositories
clone_all_repos() {
  status "=========================================="
  status "Phase 1: Cloning Repositories"
  status "=========================================="

  for repo_name in "${!REPOS[@]}"; do
    clone_repo "${repo_name}"
  done

  status "Repository cloning phase complete"
}

# Create dev-global symlink directory
create_symlink_directory() {
  status "=========================================="
  status "Phase 2: Creating Symlink Directory"
  status "=========================================="

  if [ ! -d "${DEV_GLOBAL}" ]; then
    status "Creating ${DEV_GLOBAL} directory..."
    mkdir -p "${DEV_GLOBAL}"
    success "Created ${DEV_GLOBAL}"
  else
    status "${DEV_GLOBAL} already exists"
  fi
}

# Create symlinks for quick access
create_symlinks() {
  status "=========================================="
  status "Phase 3: Creating Symlinks"
  status "=========================================="

  for repo_name in "${!REPOS[@]}"; do
    local link_name="${SYMLINK_NAMES[$repo_name]}"
    local repo_path="${REPO_PATHS[$repo_name]}"
    local link_path="${DEV_GLOBAL}/${link_name}"

    status "Creating symlink: ${link_path} -> ${repo_path}"

    if [ -L "${link_path}" ]; then
      # Symlink exists - check if it points to the correct location
      local current_target
      current_target=$(readlink "${link_path}")

      if [ "${current_target}" == "${repo_path}" ]; then
        status "Symlink already correct: ${link_path}"
        continue
      else
        warn "Symlink points to wrong target: ${current_target}"
        status "Removing and recreating symlink..."
        rm -f "${link_path}"
      fi
    elif [ -e "${link_path}" ]; then
      error "Path exists but is not a symlink: ${link_path}"
    fi

    ln -s "${repo_path}" "${link_path}"
    success "Created symlink: ${link_name} -> ${repo_path}"
  done

  status "Symlink creation phase complete"
}

# Update shell configuration files
update_shell_configs() {
  status "=========================================="
  status "Phase 4: Updating Shell Configuration"
  status "=========================================="

  # Array of shell rc files to update
  local shell_configs=("${HOME}/.bashrc" "${HOME}/.zshrc")
  local env_source_line="source ${ENV_FILE}"

  for rc_file in "${shell_configs[@]}"; do
    if [ -f "${rc_file}" ]; then
      status "Checking ${rc_file}..."

      if grep -q "source.*\.env\.repos" "${rc_file}" 2>/dev/null; then
        status "Environment already sourced in ${rc_file}"
        continue
      fi

      # Backup the original file
      status "Creating backup: ${rc_file}${BACKUP_SUFFIX}"
      cp "${rc_file}" "${rc_file}${BACKUP_SUFFIX}"

      # Add source command to rc file
      {
        echo ""
        echo "# Global Repository Environment (added by setup-repos.sh on $(date))"
        echo "if [ -f \"${ENV_FILE}\" ]; then"
        echo "  ${env_source_line}"
        echo "fi"
      } >> "${rc_file}"

      success "Updated ${rc_file}"
    else
      warn "Shell config file not found: ${rc_file}"
    fi
  done

  status "Shell configuration update phase complete"
}

# Verify all repositories are cloned
verify_repos() {
  status "=========================================="
  status "Phase 5: Verification"
  status "=========================================="

  status "Verifying cloned repositories..."

  local all_present=true

  for repo_name in "${!REPO_PATHS[@]}"; do
    local repo_path="${REPO_PATHS[$repo_name]}"

    if [ -d "${repo_path}" ]; then
      # Check if it's a git repository
      if [ -d "${repo_path}/.git" ]; then
        success "Repository found: ${repo_name} at ${repo_path}"
      else
        warn "Directory exists but not a git repo: ${repo_path}"
        all_present=false
      fi
    else
      error "Repository not found: ${repo_path}"
    fi
  done

  if [ "${all_present}" = true ]; then
    success "All repositories verified"
  fi
}

# Verify symlinks
verify_symlinks() {
  status "Verifying symlinks..."

  for repo_name in "${!SYMLINK_NAMES[@]}"; do
    local link_name="${SYMLINK_NAMES[$repo_name]}"
    local repo_path="${REPO_PATHS[$repo_name]}"
    local link_path="${DEV_GLOBAL}/${link_name}"

    if [ -L "${link_path}" ]; then
      local target
      target=$(readlink "${link_path}")

      if [ "${target}" == "${repo_path}" ]; then
        success "Symlink verified: ${link_name} -> ${repo_path}"
      else
        warn "Symlink target mismatch: ${link_name} points to ${target}"
      fi
    else
      error "Symlink not found: ${link_path}"
    fi
  done
}

# Verify environment variables
verify_env_vars() {
  status "Verifying environment variables..."

  if [ -f "${ENV_FILE}" ]; then
    success "Environment file exists: ${ENV_FILE}"

    # Show key variables from the file
    status "Environment file contents:"
    echo ""
    grep -E '^export (REPOS_ROOT|OBSIDIAN_VAULT|FINCAST_SUITE|ECC_FRAMEWORK)=' "${ENV_FILE}" | sed 's/^/  /'
    echo ""
  else
    warn "Environment file not found: ${ENV_FILE}"
  fi
}

# Display final summary
display_summary() {
  status "=========================================="
  status "Setup Summary"
  status "=========================================="

  echo ""
  echo "Repository Locations:"
  for repo_name in "${!REPO_PATHS[@]}"; do
    local repo_path="${REPO_PATHS[$repo_name]}"
    if [ -d "${repo_path}" ]; then
      echo "  ✓ ${repo_name}: ${repo_path}"
    else
      echo "  ✗ ${repo_name}: ${repo_path} (NOT FOUND)"
    fi
  done

  echo ""
  echo "Quick Access Symlinks (~/dev-global/):"
  for repo_name in "${!SYMLINK_NAMES[@]}"; do
    local link_name="${SYMLINK_NAMES[$repo_name]}"
    local link_path="${DEV_GLOBAL}/${link_name}"
    if [ -L "${link_path}" ]; then
      echo "  ✓ ${link_name} -> $(readlink "${link_path}")"
    else
      echo "  ✗ ${link_name} -> NOT LINKED"
    fi
  done

  echo ""
  echo "Environment Setup:"
  echo "  ✓ Environment file: ${ENV_FILE}"
  echo "  ✓ Shell configs updated: ~/.bashrc, ~/.zshrc"

  echo ""
  echo "Next Steps:"
  echo "  1. Reload your shell or run: source ~/.bashrc"
  echo "  2. Test navigation: vault, fincast, ecc"
  echo "  3. Verify environment: repos-info"

  echo ""
  success "Setup Complete!"
}

# Display help message
show_help() {
  cat << 'EOF'
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

EOF
}

################################################################################
# Main Execution
################################################################################

main() {
  local mode="full"

  # Parse command-line arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help)
        show_help
        exit 0
        ;;
      -v|--verify)
        mode="verify"
        shift
        ;;
      -c|--clone)
        mode="clone"
        shift
        ;;
      -s|--symlinks)
        mode="symlinks"
        shift
        ;;
      *)
        echo "Unknown option: $1"
        show_help
        exit 1
        ;;
    esac
  done

  # Display header
  echo ""
  echo -e "${BLUE}===============================================${NC}"
  echo -e "${BLUE}  Global Repository Setup Script${NC}"
  echo -e "${BLUE}===============================================${NC}"
  echo ""

  # Execute based on mode
  case "${mode}" in
    full)
      verify_repos_root
      clone_all_repos
      create_symlink_directory
      create_symlinks
      update_shell_configs
      verify_repos
      verify_symlinks
      verify_env_vars
      display_summary
      ;;
    clone)
      verify_repos_root
      clone_all_repos
      ;;
    symlinks)
      create_symlink_directory
      create_symlinks
      verify_symlinks
      ;;
    verify)
      verify_repos_root
      verify_repos
      verify_symlinks
      verify_env_vars
      ;;
  esac

  echo ""
}

# Run main function
main "$@"
