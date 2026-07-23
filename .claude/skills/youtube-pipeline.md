# YouTube Pipeline Super Skill

End-to-end research workflow: Search YouTube → Send to NotebookLM → Generate deliverables → Save to vault.

## What it does

This super skill orchestrates a complete research pipeline:

1. **Search** - Find YouTube videos by query (top results ranked by relevance/views)
2. **Ingest** - Send video URLs/transcripts to NotebookLM
3. **Analyze** - NotebookLM generates analysis, insights, gaps, opportunities
4. **Generate** - Create deliverables (podcast, infographic, study guide, etc.)
5. **Save** - Store all results as markdown in Obsidian vault with backlinks

This turns Claude Code into a research monster for any information source.

## Usage

```
/youtube-pipeline <query> --analysis <type> [--deliverable <type>] [--limit 5]
```

### Analysis Types
- `competitive` - Competitive landscape analysis
- `content-performance` - What drives views/engagement?
- `gaps` - What's missing from current content?
- `trends` - Emerging patterns and themes
- `opportunities` - Actionable opportunities
- `comprehensive` - All of the above

### Deliverable Types
- `podcast` - Audio summary with transcript
- `infographic` - Visual breakdown
- `mindmap` - Concept relationship map
- `flashcards` - Key points as flashcards
- `studyguide` - Comprehensive study guide
- `all` - Generate all deliverables

## Examples

```
/youtube-pipeline "Claude Code MCP servers" --analysis trends --deliverable infographic

/youtube-pipeline "machine learning in 2024" --analysis comprehensive --deliverable all --limit 10

/youtube-pipeline "Python async patterns" --analysis gaps --deliverable studyguide
```

## Workflow Steps

1. **YouTube Search** executes with your query
   - Returns top 5-10 videos (configurable)
   - Extracts transcripts/metadata

2. **Create NotebookLM Notebook**
   - Adds all video sources
   - Waits for processing

3. **Run Analysis**
   - Focuses on selected analysis type
   - Extracts key findings, gaps, opportunities

4. **Generate Deliverables**
   - Creates requested outputs
   - Downloads/converts to markdown

5. **Save to Vault**
   - Creates dated markdown file
   - Adds tags (#research, #youtube-analysis, topic tags)
   - Creates backlinks to related notes
   - Stores metadata (query, date, video count, analysis type)

## Output Structure

Saved to: `Research/YouTube/<YYYY-MM-DD>_<query>.md`

```markdown
---
tags: [research, youtube-analysis, MCP, ClaudeCode]
date: 2024-07-23
query: "Claude Code MCP servers"
videos_analyzed: 7
analysis_type: competitive
deliverables: [infographic, podcast]
---

# YouTube Research: Claude Code MCP servers
Generated: 2024-07-23

## Analysis Summary

### Key Findings
- Finding 1
- Finding 2

### Competitive Landscape
- Insight 1
- Insight 2

### Gaps Identified
- Gap 1
- Gap 2

### Opportunities
- Action 1
- Action 2

## Videos Analyzed
- [Video 1](url)
- [Video 2](url)

## Podcast Summary
[Transcript and key points]

## Infographic
[Image/visual breakdown]

## Related Notes
- [[Similar Research]]
- [[Topic Context]]
```

## Self-Improving Loop

The vault stores:
1. **Raw research** - What you learned
2. **Patterns** - How you analyze
3. **Preferences** - Your style preferences

Update `claude.md` periodically:

```
/help update claude-md for youtube-research best-practices
```

This teaches Claude your research preferences for better future analysis.

## Tips

- Start broad, then drill into specific angles
- Run same query with different analysis types for comprehensive view
- Use "gaps" analysis to find content opportunities
- Use "competitive" to understand what's working
- Link related research notes for better vault connections

## Integration

- **Requires**: youtube-search + notebooklm-integration skills
- **Stores in**: Obsidian vault Research folder
- **Improves via**: claude.md learning over time
