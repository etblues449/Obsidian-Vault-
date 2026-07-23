# NotebookLM Integration Skill

Create and manage NotebookLM notebooks, generate analysis, and export deliverables.

## What it does
- Creates NotebookLM notebooks from multiple sources (URLs, files, text)
- Generates podcast summaries with transcripts and key points
- Creates infographics, mind maps, flashcards, study guides
- Returns analysis and structured data

## Usage

```
/notebooklm-create --title "Title" --source <url|file|text>
/notebooklm-podcast <notebook_id> [--format json|markdown]
/notebooklm-generate <notebook_id> --deliverable <podcast|infographic|mindmap|flashcards|studyguide>
/notebooklm-analyze <notebook_id> [--focus security|performance|best-practices]
```

## Examples

- `/notebooklm-create --title "MCP Research" --source https://example.com/mcp-article`
- `/notebooklm-podcast nb_abc123 --format markdown`
- `/notebooklm-generate nb_abc123 --deliverable infographic`
- `/notebooklm-analyze nb_abc123 --focus security`

## Output Format

### Podcast Results
```json
{
  "id": "pod_xyz",
  "title": "Podcast: Topic",
  "duration_seconds": 1234,
  "audio_url": "https://...",
  "transcript": "Full transcript...",
  "speakers": ["Speaker 1", "Speaker 2"],
  "key_points": ["Point 1", "Point 2"]
}
```

### Analysis Results
```json
{
  "summary": "Executive summary",
  "key_findings": ["Finding 1", "Finding 2"],
  "recommendations": ["Action 1", "Action 2"],
  "gaps": ["Gap 1", "Gap 2"],
  "opportunities": ["Opportunity 1"]
}
```

## Installation

Requires: `notebooklm-py` with MCP support

```bash
pip install "notebooklm-py[mcp]"
notebooklm login
```

## Integration

Works with youtube-search skill. Typically used in `youtube-pipeline` super skill for end-to-end workflows.

## Note

Analysis and file generation happens on Google's infrastructure (free tokens from your perspective).
