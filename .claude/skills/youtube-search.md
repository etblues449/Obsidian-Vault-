# YouTube Search Skill

Search YouTube for videos and return structured results with metadata.

## What it does
- Searches YouTube by query using yt-dlp
- Returns video results with title, channel, views, duration, URL
- Filters and ranks by relevance and engagement
- Returns structured JSON for downstream processing

## Usage

```
/youtube-search <query> [--limit 10] [--sort views|date|relevance]
```

## Examples

- `/youtube-search Claude Code MCP`
- `/youtube-search machine learning tutorials --limit 5 --sort views`
- `/youtube-search data analysis Python --limit 20`

## Output Format

Returns JSON array:
```json
[
  {
    "title": "Video Title",
    "channel": "Channel Name",
    "url": "https://youtube.com/watch?v=...",
    "views": 15000,
    "duration": 600,
    "upload_date": "2024-01-15",
    "description": "Video description..."
  }
]
```

## Installation

Requires: `yt-dlp` (install via `pip install yt-dlp`)

## Integration

This skill is designed to feed data into NotebookLM for analysis. Use with the `youtube-pipeline` super skill.
