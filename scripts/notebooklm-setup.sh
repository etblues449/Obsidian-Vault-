#!/bin/bash
# NotebookLM Setup & Authentication Script
# Purpose: Install notebooklm-py and configure Google OAuth
# Usage: bash scripts/notebooklm-setup.sh [--skip-login] [--test-only]

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SKIP_LOGIN=false
TEST_ONLY=false
NOTEBOOKLM_HOME="${HOME}/.notebooklm"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-login) SKIP_LOGIN=true; shift ;;
        --test-only) TEST_ONLY=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo -e "${BLUE}=== NotebookLM Setup & Authentication ===${NC}"
echo "Timestamp: $(date)"
echo ""

# Check prerequisites
echo -e "${BLUE}[1/5] Checking prerequisites...${NC}"
if ! command -v uv &> /dev/null; then
    echo -e "${RED}✗ 'uv' not found. Install via: pip install uv${NC}"
    exit 1
fi
echo -e "${GREEN}✓ uv is installed${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python 3 not found${NC}"
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
echo -e "${GREEN}✓ $PYTHON_VERSION${NC}"

# Install notebooklm-py
echo ""
echo -e "${BLUE}[2/5] Installing notebooklm-py with browser support...${NC}"
if uv tool install "notebooklm-py[browser]" 2>&1; then
    echo -e "${GREEN}✓ Installation successful${NC}"
else
    echo -e "${RED}✗ Installation failed${NC}"
    exit 1
fi

# Verify installation
echo ""
echo -e "${BLUE}[3/5] Verifying installation...${NC}"
if notebooklm --version 2>&1; then
    echo -e "${GREEN}✓ notebooklm CLI is available${NC}"
else
    echo -e "${RED}✗ notebooklm CLI not found in PATH${NC}"
    exit 1
fi

# Authenticate
if [ "$SKIP_LOGIN" = true ]; then
    echo ""
    echo -e "${YELLOW}[4/5] Skipping login (--skip-login provided)${NC}"
else
    echo ""
    echo -e "${BLUE}[4/5] Authenticating with Google...${NC}"
    echo -e "${YELLOW}Note: A browser window will open for Google Sign-In.${NC}"
    echo -e "${YELLOW}Ensure you're on the device where you want to authenticate.${NC}"
    echo ""

    if notebooklm login 2>&1; then
        echo -e "${GREEN}✓ Authentication successful${NC}"
    else
        echo -e "${RED}✗ Authentication failed${NC}"
        exit 1
    fi
fi

# Test authentication
echo ""
if [ "$TEST_ONLY" = true ] || [ "$SKIP_LOGIN" = false ]; then
    echo -e "${BLUE}[5/5] Testing authentication...${NC}"

    # Run auth check with JSON output
    TEST_OUTPUT=$(notebooklm auth check --test --json 2>&1) || TEST_OUTPUT_EXIT=$?

    if [ -z "${TEST_OUTPUT_EXIT:-}" ]; then
        # Parse JSON response
        if echo "$TEST_OUTPUT" | grep -q '"status":"ok"'; then
            echo -e "${GREEN}✓ Authentication verified${NC}"
            echo ""
            echo "Full response:"
            echo "$TEST_OUTPUT" | python3 -m json.tool 2>/dev/null || echo "$TEST_OUTPUT"
        else
            echo -e "${YELLOW}⚠ Response received but status unclear:${NC}"
            echo "$TEST_OUTPUT"
        fi
    else
        echo -e "${RED}✗ Authentication test failed${NC}"
        echo "$TEST_OUTPUT"
        exit 1
    fi
else
    echo -e "${BLUE}[5/5] Skipping auth test (--skip-login provided)${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Run: notebooklm auth check --test --json"
echo "2. List notebooks: notebooklm list"
echo "3. Create test notebook: notebooklm create --source https://example.com"
echo ""
echo "Credentials stored in: $NOTEBOOKLM_HOME"
echo -e "${YELLOW}Important: Do NOT commit ~/.notebooklm/ to git${NC}"
echo ""
