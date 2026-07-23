# NotebookLM ↔ Obsidian Vault MCP Bridge

Complete guide to bidirectional integration using the Model Context Protocol (MCP).

## What is the MCP Bridge?

The MCP bridge creates a two-way communication channel:

```
Obsidian Vault Notes 
    ↓ (Claude reads)
    → Create NotebookLM Notebooks
           ↓
           → Generate Podcasts
                  ↓
    (Claude enhances) ←
    Annotate Vault Notes
```

Claude can now:
- **Read** vault notes tagged with `#notebook`
- **Create** NotebookLM notebooks from vault content
- **Generate** podcast summaries
- **Enrich** vault notes with insights from NotebookLM

## Installation

### 1. Install MCP Package

```bash
pip install mcp
```

Or using uv:
```bash
uv pip install mcp
```

### 2. Run Setup Script

```bash
cd "Assistant Core/notebooklm"
chmod +x setup-mcp.sh
./setup-mcp.sh
```

### 3. Verify Configuration

Check `.mcp.json`:
```json
{
  "mcpServers": {
    "notebooklm-bridge": {
      "command": "python3",
      "args": [
        "Assistant Core/notebooklm/mcp_bridge.py"
      ],
      "disabled": false
    }
  }
}
```

### 4. Restart Claude Code

Restart your Claude Code IDE to load the MCP servers.

## Using the Bridge

### Direction 1: Vault → NotebookLM

**Step 1: Tag a note**

Add `#notebook` tag to your Obsidian note (in frontmatter or inline):

```markdown
---
tags: [research, notebook]
---

# My Research Topic

This is important research content...
```

**Step 2: Ask Claude to create a notebook**

```
Claude, find my #notebook tagged notes and create NotebookLM notebooks from them.
```

Claude will:
1. Search vault for `#notebook` tags
2. Extract note content
3. Create NotebookLM notebook
4. Return notebook ID

**Step 3: Generate podcast**

```
Claude, generate a podcast summary for notebook [ID]
```

Claude returns:
- Audio URL
- Transcript
- Key points
- Speaker information

### Direction 2: NotebookLM → Vault

**Step 1: Get notebook insights**

```
Claude, add insights from notebook [ID] to my vault notes.
```

**Step 2: Claude annotates**

Claude will:
1. Get podcast/notebook summary
2. Find matching vault notes
3. Add insights section with:
   - Key takeaways
   - Questions raised
   - Follow-up topics
   - Timestamp of annotation

Example annotation:
```markdown
## NotebookLM Insights

- **[2026-07-23T14:32:00]** Main finding: Research shows correlation between X and Y
- **[2026-07-23T14:32:15]** Follow-up needed: Test with control group
- **[2026-07-23T14:32:30]** Related: Check previous work on similar topic
```

## Workflow Examples

### Example 1: Research Paper Processing

1. **Save paper** to vault with notes
2. **Tag** with `#notebook`
3. **Ask Claude**: "Create notebook from my research paper notes"
4. **Claude generates** podcast summary
5. **Ask Claude**: "Add key findings back to my note"
6. **Claude annotates** with insights

### Example 2: Meeting Notes to Podcast

1. **Write meeting notes** in Obsidian
2. **Add** `#notebook` tag
3. **Ask Claude**: "Create a podcast about this meeting"
4. **Claude generates** podcast (great for review)
5. **Ask Claude**: "Extract action items to my note"
6. **Claude annotates** with action items

### Example 3: Automated Daily Sync

Using GitHub Actions or n8n:

```yaml
- Schedule: Daily at 9 AM
- Find all new `#notebook` notes
- Create notebooks
- Generate podcasts
- Annotate vault with insights
```

## MCP Tool Reference

### vault_search_by_tag

Search vault for notes with a tag.

```json
{
  "tool": "vault_search_by_tag",
  "params": {
    "tag": "notebook"
  }
}
```

**Returns:**
```json
{
  "count": 2,
  "notes": [
    {
      "path": "Research/Paper 1.md",
      "title": "Machine Learning Advances",
      "content": "...",
      "tags": ["notebook"]
    }
  ]
}
```

### notebooklm_create

Create a notebook from content.

```json
{
  "tool": "notebooklm_create",
  "params": {
    "source": "# Research Topic\n\nContent here...",
    "title": "My Research Notebook",
    "description": "Optional description"
  }
}
```

**Returns:**
```json
{
  "success": true,
  "notebook": {
    "id": "nb_12345...",
    "title": "My Research Notebook",
    "created_at": "2026-07-23T14:00:00Z",
    "source_url": null,
    "notes_count": 0,
    "citations_count": 0
  }
}
```

### notebooklm_list

List all notebooks.

```json
{
  "tool": "notebooklm_list",
  "params": {}
}
```

**Returns:**
```json
{
  "count": 5,
  "notebooks": [
    {
      "id": "nb_...",
      "title": "Research Topic 1",
      "created_at": "2026-07-20T10:00:00Z",
      "updated_at": "2026-07-22T15:30:00Z"
    }
  ]
}
```

### notebooklm_podcast

Generate podcast from a notebook.

```json
{
  "tool": "notebooklm_podcast",
  "params": {
    "notebook_id": "nb_12345..."
  }
}
```

**Returns:**
```json
{
  "success": true,
  "podcast": {
    "id": "pod_...",
    "notebook_id": "nb_...",
    "title": "Podcast: My Research",
    "duration_seconds": 1234,
    "audio_url": "https://...",
    "transcript": "Full transcript here...",
    "speakers": ["Speaker 1", "Speaker 2"],
    "key_points": [
      "Point 1",
      "Point 2"
    ]
  }
}
```

### vault_annotate

Add insights to a vault note.

```json
{
  "tool": "vault_annotate",
  "params": {
    "file_path": "Research/Paper 1.md",
    "annotation": "Key insight: AI improves efficiency",
    "section": "NotebookLM Insights"
  }
}
```

**Returns:**
```json
{
  "success": true
}
```

## Troubleshooting

### Bridge not loading in Claude Code

1. Check `.mcp.json` syntax is valid JSON
2. Verify script path in .mcp.json is relative to vault root
3. Restart Claude Code IDE
4. Check console for errors

### "mcp module not found"

```bash
pip install mcp
```

### "NotebookLMClient not found"

Ensure you're in the correct directory:
```bash
cd "Assistant Core/notebooklm"
```

### Annotations not appearing in notes

1. Verify file path is relative to vault root
2. Check file permissions (need write access)
3. Ensure section header is exact (case-sensitive)

### No vault notes found

1. Ensure notes have `#notebook` tag in frontmatter or content
2. Check notes are in vault root directory
3. Verify markdown file extensions (`.md`)

## Advanced Configuration

### Custom Vault Path

In `mcp_bridge.py`, modify the ObsidianVault initialization:

```python
vault = ObsidianVault(vault_root="/custom/path/to/vault")
```

### Modify Search Logic

Edit `get_notes_by_tag()` to:
- Search different tag formats
- Include more metadata
- Filter by date or type

### Add Custom Sections

Edit annotation section naming in `annotate_note()`:

```python
# Current: "NotebookLM Insights"
# Custom: "Podcast Summary" or "Research Findings"
```

## See Also

- `README.md` - API reference
- `NOTEBOOKLM_SETUP.md` - Installation guide
- `example.py` - Code examples
- `client.py` - NotebookLMClient implementation
