# NotebookLM Integration for JARVIS

Python wrapper and integration layer for Google's NotebookLM service via the `notebooklm-py` CLI tool.

## Installation

### 1. Install notebooklm-py

```bash
uv tool install "notebooklm-py[browser]"
```

### 2. Authenticate

```bash
notebooklm login
# Browser will open for Google Sign-In
```

### 3. Verify

```bash
notebooklm auth check --test --json
```

Expected output:
```json
{
  "status": "ok",
  "authenticated": true,
  "user": "your-email@gmail.com"
}
```

## Quick Start

### Python API

```python
from notebooklm import NotebookLMClient

client = NotebookLMClient()

# Check authentication
if not client.is_authenticated():
    client.authenticate()

# List notebooks
notebooks = client.list_notebooks()
for nb in notebooks:
    print(f"- {nb.title} ({nb.id})")

# Create a notebook
notebook = client.create_notebook(
    source="https://example.com",
    title="My Research Topic"
)

# Generate podcast
podcast = client.generate_podcast(notebook.id)
print(f"Podcast: {podcast.title}")
print(f"Duration: {podcast.duration_seconds}s")
```

### Command Line

```bash
# List notebooks
notebooklm list

# Create notebook from URL
notebooklm create --source https://example.com --title "My Research"

# Create notebook from file
notebooklm create --source ./document.pdf --title "Research Paper"

# Generate podcast
notebooklm podcast <NOTEBOOK_ID>

# Delete notebook
notebooklm delete <NOTEBOOK_ID>
```

## API Reference

### NotebookLMClient

Main client class for interacting with NotebookLM.

#### Methods

**`is_authenticated() -> bool`**
- Check if user is authenticated
- Returns: True if authenticated

**`authenticate() -> bool`**
- Trigger Google OAuth login flow
- Opens browser for user to sign in
- Returns: True if successful

**`check_auth_status() -> AuthStatus`**
- Get detailed auth status
- Returns: AuthStatus with email, token validity, etc.

**`list_notebooks() -> List[Notebook]`**
- Fetch all notebooks
- Returns: List of Notebook objects

**`create_notebook(source: str, title: str, description: Optional[str]) -> Optional[Notebook]`**
- Create new notebook from source
- Args:
  - `source`: File path, URL, or text
  - `title`: Notebook title
  - `description`: Optional description
- Returns: Created Notebook or None

**`get_notebook(notebook_id: str) -> Optional[Notebook]`**
- Fetch notebook details
- Args: `notebook_id` - ID of notebook
- Returns: Notebook object or None

**`generate_podcast(notebook_id: str) -> Optional[PodcastSummary]`**
- Generate audio podcast summary
- Args: `notebook_id` - ID of notebook
- Returns: PodcastSummary or None

**`delete_notebook(notebook_id: str) -> bool`**
- Delete a notebook
- Args: `notebook_id` - ID to delete
- Returns: True if successful

**`logout() -> bool`**
- Clear credentials and logout
- Returns: True if successful

### AuthManager

Manages authentication and credentials.

#### Methods

**`is_authenticated() -> bool`**
- Quick auth check
- Returns: True if authenticated

**`check_status() -> AuthStatus`**
- Detailed status check
- Returns: AuthStatus dataclass

**`authenticate() -> bool`**
- Trigger OAuth flow
- Returns: True if successful

**`logout() -> bool`**
- Clear credentials
- Returns: True if successful

**`refresh() -> bool`**
- Refresh token if expired
- Returns: True if successful

### Data Models

**`Notebook`**
- Attributes:
  - `id`: Notebook ID
  - `title`: Notebook title
  - `created_at`: Creation timestamp
  - `updated_at`: Last update timestamp
  - `source_url`: Source URL if applicable
  - `source_file`: Source file if applicable
  - `notes_count`: Number of notes
  - `citations_count`: Number of citations
  - `tags`: List of tags
  - `metadata`: Additional metadata

**`PodcastSummary`**
- Attributes:
  - `id`: Podcast ID
  - `notebook_id`: Associated notebook ID
  - `title`: Podcast title
  - `duration_seconds`: Duration in seconds
  - `audio_url`: URL to audio file
  - `transcript`: Podcast transcript
  - `speakers`: List of speakers
  - `key_points`: List of key points

**`AuthStatus`**
- Attributes:
  - `authenticated`: Is user authenticated
  - `user_email`: User email address
  - `token_valid`: Is token valid
  - `expires_at`: Token expiry timestamp
  - `last_checked`: Last status check time

## MCP Bridge - Bidirectional Integration

The MCP (Model Context Protocol) bridge enables **bidirectional** integration between Claude, Obsidian Vault, and NotebookLM.

### Setup

```bash
cd "Assistant Core/notebooklm"
bash setup-mcp.sh
```

This will:
1. Install the MCP package
2. Configure .mcp.json for Claude Code
3. Test the bridge connection

### How It Works

**Direction 1: Vault → NotebookLM**
- Claude reads Obsidian Vault notes tagged with `#notebook`
- Creates NotebookLM notebooks automatically
- Generates podcast summaries

**Direction 2: NotebookLM → Vault**
- Claude adds insights from notebooks back to vault notes
- Appends to "NotebookLM Insights" section
- Includes timestamps for each annotation

### MCP Tools Available to Claude

Once configured, Claude has access to these MCP tools:

**`vault_search_by_tag`**
- Search for notes with a specific tag
- Returns matching notes with paths and content
- Example: Find all `#notebook` tagged notes

**`notebooklm_create`**
- Create a notebook from vault content
- Supports text content or URLs
- Returns notebook ID and metadata

**`notebooklm_list`**
- List all notebooks
- Shows IDs, titles, creation dates
- Returns full notebook metadata

**`notebooklm_podcast`**
- Generate podcast summary for a notebook
- Returns audio URL, transcript, key points
- Includes speaker information

**`vault_annotate`**
- Add insights back to vault notes
- Automatically timestamps entries
- Appends to specified section

### Configuration

Edit `.notebooklmrc` to customize defaults:

```ini
# Vault settings
vault_root=/path/to/vault

# Auto-sync settings
auto_tag=true
tags=research,notebook

# Output format
output_format=json
```

## Usage in JARVIS

### Integration with Obsidian Macros

Create a QuickAdd macro to convert a note to a notebook:

```javascript
// QuickAdd script: Note to Notebook
const { notebooklm } = require("../Assistant Core/notebooklm");

async function noteToNotebook(title) {
  const client = new NotebookLMClient();
  
  if (!client.isAuthenticated()) {
    const success = await client.authenticate();
    if (!success) return false;
  }

  const notebook = await client.createNotebook({
    source: noteContent,
    title: title
  });

  if (notebook) {
    dv.paragraph(`[Notebook: ${notebook.title}](${notebook.id})`);
    return true;
  }
  return false;
}
```

### Integration with n8n

Add a workflow step to automatically create notebooks from captured notes:

1. **Trigger**: GitHub push (capture new notes)
2. **Filter**: Note contains `#notebook` tag
3. **Transform**: Extract title and content
4. **Execute**: Call `notebooklm create` via CLI
5. **Save**: Store notebook ID back in note
6. **Post**: Link to notebook in the note

### Integration with GitHub Actions

Create workflow to process vault documents:

```yaml
- name: Process notebooks
  run: |
    python3 -c "
    from notebooklm import NotebookLMClient
    
    client = NotebookLMClient()
    notebooks = client.list_notebooks()
    print(f'Found {len(notebooks)} notebooks')
    "
```

## Troubleshooting

### "notebooklm not found in PATH"
- **Solution**: Ensure `uv tool install` completed successfully
- Check: `which notebooklm` should show the path
- Reinstall: `uv tool install --reinstall "notebooklm-py[browser]"`

### "Authentication timeout"
- **Solution**: Check internet connection
- Retry: `notebooklm login --timeout 300`

### "API rate limited"
- **Solution**: Wait 1 hour
- NotebookLM free tier: ~10 notebooks/hour
- Check: `notebooklm auth check --test --json`

### "Invalid credentials"
- **Solution**: Re-authenticate
- Logout: `notebooklm auth logout`
- Login: `notebooklm login`

## Security Notes

### Credential Storage
- Credentials stored in `~/.notebooklm/credentials.json`
- File permissions: `600` (user-readable only)
- **DO NOT commit to git**

### Environment Variables
- Never store tokens in `.env` files tracked by git
- Use `~/.bashrc` or `~/.local/bin` for local scripts
- For CI/CD: use GitHub Secrets

### Device Sync
- Credentials are device-local
- Re-authenticate on each device
- No sync across Obsidian instances

## Development

### Run Example

```bash
python3 Assistant\ Core/notebooklm/example.py
```

### Test Imports

```python
from notebooklm import NotebookLMClient, Notebook, AuthManager
```

### Add Logging

```python
import logging
logging.basicConfig(level=logging.DEBUG)

client = NotebookLMClient()
# Detailed logs of CLI calls
```

## License

Part of the JARVIS project. Uses `notebooklm-py` (Apache 2.0).

## See Also

- `NOTEBOOKLM_SETUP.md` - Detailed setup guide
- `scripts/notebooklm-setup.sh` - Automated setup script
- NotebookLM: https://notebooklm.google.com
- notebooklm-py: https://github.com/notebooklm-py/notebooklm-py
