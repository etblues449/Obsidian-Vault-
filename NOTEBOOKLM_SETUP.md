# NotebookLM Integration Setup & Authentication

**Status**: Authentication framework implementation  
**Last Updated**: 2026-07-23  
**Branch**: `claude/notebooklm-setup-auth-z0rw4a`

## Overview

NotebookLM is a research tool that transforms documents into interactive notebooks and generates audio summaries (podcasts). This integration enables JARVIS to automatically create learning resources from captured notes.

**Key Features**:
- Document-to-notebook conversion
- Audio podcast generation
- Citation tracking and fact-checking
- Integration with Claude API for enhanced analysis

## Installation

### Prerequisites
- Python 3.10+
- `uv` package manager installed
- Google account (for authentication)

### Install notebooklm-py

```bash
uv tool install "notebooklm-py[browser]"
```

**What this installs**:
- `notebooklm-py`: Python CLI for NotebookLM
- `[browser]`: Chromium browser for automated Google login
- Automatically downloads ~170 MB Chromium on first run

### Verify Installation

```bash
notebooklm --version
```

## Authentication Setup

NotebookLM requires Google authentication. The process is automated but interactive on first run.

### Step 1: Initial Login

```bash
notebooklm login
```

**First Run Behavior**:
1. Auto-downloads Chromium browser (~170 MB)
2. Launches automated browser window
3. Navigates to Google Sign-In page
4. Awaits manual authentication (you sign in via browser)
5. Stores credentials locally in `~/.notebooklm/credentials.json`

### Step 2: Verify Authentication

```bash
notebooklm auth check --test --json
```

**Expected Output** (on success):
```json
{
  "status": "ok",
  "authenticated": true,
  "user": "your-email@gmail.com"
}
```

### Step 3: Test Notebook Creation

```bash
# Create a test notebook from a URL
notebooklm create --source https://example.com --title "Test Notebook"
```

## Credential Storage & Security

### Local Storage
- **Location**: `~/.notebooklm/credentials.json`
- **Format**: Encrypted OAuth 2.0 tokens
- **Permissions**: User-readable only (`600`)

### GitHub Integration
- **DO NOT** commit credentials to the repository
- **DO NOT** include `~/.notebooklm/` in git
- Use GitHub Secrets for CI/CD: `NOTEBOOKLM_CREDENTIALS` (if needed for automation)

### Device Sync (Fold 7 / Termux)
On Termux, credentials are device-local and not synced via Obsidian Git:
1. Re-run `notebooklm login` on each device
2. Or: manually copy `~/.notebooklm/credentials.json` after encryption/password management
3. Recommended: one login per device, credentials stay local

## CLI Commands

### Core Operations

```bash
# List notebooks
notebooklm list

# Get notebook details
notebooklm get NOTEBOOK_ID

# Create a notebook from file, URL, or text
notebooklm create --source path/to/document.pdf --title "My Research"

# Generate an audio summary (podcast)
notebooklm podcast NOTEBOOK_ID

# Delete a notebook
notebooklm delete NOTEBOOK_ID
```

### Authentication Commands

```bash
# Check auth status
notebooklm auth check

# Detailed auth status (JSON)
notebooklm auth check --test --json

# Clear cached credentials (logout)
notebooklm auth logout

# Force re-authentication
notebooklm auth refresh
```

## Integration with JARVIS

### Phase 1: Manual Workflow (Current)
1. Capture note via JARVIS (Alt+J)
2. Tag with `#notebook` in the title or body
3. Manual: Export markdown → run `notebooklm create`
4. Manual: Review notebook → generate podcast if needed

### Phase 2: Automated (Future)
- GitHub Actions workflow watches vault for `#notebook` tags
- Automatically calls NotebookLM API
- Stores notebook IDs + links back in the note
- Optionally posts podcast link to Discord

### Example Note Format
```markdown
# My Research Topic #notebook

## Key Insights
- Point 1
- Point 2

## References
- Source A
- Source B
```

## Troubleshooting

### Issue: "Chromium not found"
```
ERROR: browser.chromium() not found
```
**Solution**: Re-run `notebooklm login` to trigger fresh download.

### Issue: "Authentication timeout"
```
ERROR: Google sign-in timed out after 60s
```
**Solution**: Check internet connection; retry with `notebooklm login --timeout 120`.

### Issue: "Invalid credentials"
```
ERROR: oauth token invalid or expired
```
**Solution**: Clear and re-authenticate:
```bash
notebooklm auth logout
notebooklm login
```

### Issue: "Rate limited"
```
ERROR: API rate limit exceeded
```
**Solution**: Wait 1 hour; NotebookLM has free tier limits (~10 notebooks/hour).

## API Reference

### Authentication Endpoints (Internal)
- `oauth.google.com` → user consent & token exchange
- `notebooklm.google.com/api/v1/auth/verify` → token validation

### Notebook Operations
- `GET /notebooks` → list all notebooks
- `POST /notebooks` → create notebook
- `GET /notebooks/{id}` → get notebook metadata
- `POST /notebooks/{id}/podcast` → generate audio summary
- `DELETE /notebooks/{id}` → delete notebook

## Next Steps

### Immediate (This Branch)
- [x] Document setup process
- [ ] Create example integration script
- [ ] Test on Fold 7 (Termux)
- [ ] Verify auth with `notebooklm auth check --test --json`

### Short-term
- Build GitHub Actions router for `#notebook` tags
- Create `notebooklm.py` wrapper for JARVIS v3 (Obsidian macros)
- Add podcast links to notes automatically

### Long-term
- RAG over generated notebooks (search in podcast transcripts)
- Integration with Discord for podcast sharing
- Batch processing of vault documents

## References

- **Official Docs**: https://github.com/notebooklm-py/notebooklm-py
- **Google NotebookLM**: https://notebooklm.google.com
- **Installation Guide**: [[#Installation]]
- **Related Skill**: "Doc to Learning" project uses NotebookLM for content generation

---

**Author**: Claude Code  
**Date**: 2026-07-23  
**Status**: Ready for authentication testing
