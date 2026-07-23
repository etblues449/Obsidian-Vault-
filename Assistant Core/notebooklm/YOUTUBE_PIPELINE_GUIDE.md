# YouTube Research Pipeline - Complete Guide

Transform Claude Code into a research monster that learns and improves over time.

## Overview

The YouTube Pipeline combines three Claude Code technologies into one powerful workflow:

```
YouTube Videos (your data source)
    ↓
/youtube-pipeline skill (orchestration)
    ↓
YouTube-search (find videos) + NotebookLM (analyze) skills
    ↓
Generate deliverables (podcast, infographic, etc.)
    ↓
Save to Obsidian Vault (Research/<date>_<query>.md)
    ↓
Claude learns your research style → Updates CLAUDE.md → Next iteration is better
```

## Quick Start (2 minutes)

### 1. Search YouTube and Analyze

```bash
/youtube-pipeline "Claude Code MCP servers" --analysis gaps --deliverable infographic
```

This will:
- Search YouTube for your query
- Send videos to NotebookLM
- Analyze for content gaps (opportunities)
- Generate an infographic
- Save markdown file to vault

### 2. View Results

Results appear in: `Research/YouTube/<date>_<query>.md`

Contains:
- Analysis findings
- Opportunities identified
- Video list with links
- Generated infographic/podcast

## Analysis Types

Choose what you want to know:

### `gaps` - Find Missing Content
**Best for:** Content creators, thought leaders  
**Shows:** What's NOT covered, untapped opportunities  
**Example:** Gaps in "Claude Code tutorials" → Identify new video ideas

### `trends` - Spot Patterns
**Best for:** Researchers, trend forecasters  
**Shows:** Emerging patterns, repeated themes  
**Example:** Trends in "AI agent frameworks" → Predict next big thing

### `competitive` - Understand the Landscape
**Best for:** Product managers, strategists  
**Shows:** Competitors, market players, positioning  
**Example:** Competitive landscape for "low-code platforms" → Positioning opportunity

### `content-performance` - What Drives Views
**Best for:** Content creators, marketers  
**Shows:** Why some videos succeed, what engagement drivers are  
**Example:** What drives views in "productivity tutorials" → Copy success patterns

### `opportunities` - Actionable Next Steps
**Best for:** Business strategists  
**Shows:** What to build, what to create, what's missing  
**Example:** Opportunities in "AI for finance" → Product roadmap

### `comprehensive` - Everything
**Best for:** Deep research, major decisions  
**Shows:** All of the above combined  
**Example:** Comprehensive "market analysis" for new product launch

## Deliverable Types

Choose what output you want:

| Type | Use Case | Time |
|------|----------|------|
| `podcast` | Audio discussion, key points summary | 3-8 min |
| `infographic` | Visual breakdown, easy sharing | 4-6 min |
| `mindmap` | Concept relationships, learning | 2-4 min |
| `flashcards` | Key facts for memorization | 2-3 min |
| `studyguide` | Comprehensive study material | 5-10 min |
| `none` | Analysis only, no deliverable | <1 min |

## Examples

### Example 1: Content Creator Research

You're making YouTube videos about Claude Code. What should your next video be about?

```bash
/youtube-pipeline "Claude Code tutorials" --analysis gaps --deliverable infographic
```

**Result:** Identifies gaps → Shows unmet demand → Guides next video topic

### Example 2: Product Manager Research

Your startup does "AI automation". How does it fit in the market?

```bash
/youtube-pipeline "AI automation platforms" --analysis competitive --deliverable studyguide
```

**Result:** Competitive landscape → Positioning guidance → Feature differentiation

### Example 3: Learning & Development

You need to understand a topic fast. What's the current state?

```bash
/youtube-pipeline "machine learning ops" --analysis comprehensive --deliverable all
```

**Result:** Podcast + infographic + study guide → Deep understanding

### Example 4: Marketing Research

What content is resonating with your audience?

```bash
/youtube-pipeline "SaaS product management" --analysis content-performance --limit 10
```

**Result:** Content performance data → Messaging guidance

## How It Works Behind the Scenes

### Step 1: Search
```
youtube-search skill finds videos matching your query
Returns: title, channel, views, URL, duration
```

### Step 2: Create Notebook
```
YouTube URLs sent to NotebookLM
NotebookLM downloads/processes video transcripts
Creates a notebook with all sources
```

### Step 3: Analyze
```
Specified analysis runs on the notebook
Extracts: findings, patterns, gaps, opportunities
Returns: structured analysis
```

### Step 4: Generate Deliverable
```
If requested, NotebookLM generates deliverable
Creates podcast, infographic, or study guide
Saves in markdown format
```

### Step 5: Save to Vault
```
Results saved as markdown file in Research/YouTube/
Includes metadata: query, date, video count, analysis type
Automatic backlinks to related research
File indexed in Obsidian graph
```

## The Self-Improving Loop

This is where the magic happens:

```
Run research
    ↓
Vault grows with your research patterns
    ↓
CLAUDE.md updated with your preferences
    ↓
Claude understands your style better
    ↓
Next analysis is automatically better
    ↓
Repeat → Continuous improvement
```

### How to Improve CLAUDE.md

After you've done several research runs:

```
Can you update CLAUDE.md based on my research patterns?
Focus on:
- How I like analysis formatted
- Topics I research most
- Deliverable preferences
- Analysis style I prefer
```

Claude will learn:
- You prefer "gaps" analysis over "trends"
- You like infographics for marketing research
- You tag videos as "reference" or "deep-dive"
- You follow up with deeper analysis

Next time, Claude will:
- Suggest relevant analysis types automatically
- Format output to your preference
- Ask better follow-up questions
- Complete the workflow faster

## Vault Structure

```
Research/
├── YouTube/
│   ├── 2024-07-23_Claude-Code-MCP-servers.md
│   ├── 2024-07-22_Python-async-patterns.md
│   ├── 2024-07-21_Machine-learning-trends.md
│   └── example-MCP-servers-research.md (example output)
├── PDF-Analysis/
├── Article-Summary/
└── Topic-Deep-Dives/
```

Each file contains:
- Metadata (date, query, video count, analysis type)
- Analysis findings
- Opportunities and gaps
- Video list with links
- Generated deliverables
- Related backlinks

## Tips & Tricks

### Tip 1: Start Broad, Then Drill Deep

```bash
# First: Understand the landscape
/youtube-pipeline "AI tools" --analysis comprehensive --limit 10

# Then: Deep dive into gaps
/youtube-pipeline "AI tools content gaps" --analysis gaps --limit 5
```

### Tip 2: Compare Different Angles

```bash
# What's working (content performance)
/youtube-pipeline "productivity apps" --analysis content-performance

# Who's competing (competitive landscape)
/youtube-pipeline "productivity apps" --analysis competitive

# What's missing (opportunities)
/youtube-pipeline "productivity apps" --analysis opportunities
```

### Tip 3: Use Specific Queries

❌ Too broad: `machine learning`  
✅ Better: `machine learning for supply chain`  
✅ Best: `machine learning inventory forecasting`

### Tip 4: Save Follow-Up Questions

When results are interesting:
```
Follow up: Deep dive into [specific finding]
```

Claude will know to extend research with more videos.

### Tip 5: Link Related Research

If researching similar topics:
```
Related research from: [[Previous research note]]
```

Obsidian will create backlinks in the graph.

## Troubleshooting

### "Search returned no results"
**Solution:** Try more specific query or different keywords
```bash
# ✗ Too broad
/youtube-pipeline "code"

# ✓ Better
/youtube-pipeline "Claude Code tutorial"
```

### "NotebookLM generation is slow"
**Normal:** Infographics take 5-10 min, podcasts 3-8 min  
**Solution:** While you wait, start another research query

### "Vault file not created"
**Check:** Research folder exists: `Research/YouTube/`  
**Check:** Obsidian vault root is set correctly  
**Solution:** Create folder manually if needed

### "Claude forgot my preferences"
**Update CLAUDE.md:**
```
Update CLAUDE.md with my recent research preferences
```

## Advanced Usage

### Batch Research

Research multiple topics at once:

```bash
/youtube-pipeline "topic 1" --analysis gaps
# ... while processing ...
/youtube-pipeline "topic 2" --analysis trends
# ... while processing ...
/youtube-pipeline "topic 3" --analysis competitive
```

### Scheduled Research

Using a Routine/Trigger:

```bash
Set up: Every Monday morning
Run: /youtube-pipeline "weekly tech trends" --analysis trends
```

Creates a weekly research digest automatically.

### Team Collaboration

Share research files via GitHub:
- Each team member can see others' research
- Build shared knowledge base
- Learn from teammates' queries and analysis styles

## The Big Picture

This workflow demonstrates a key principle: **tools that understand your patterns improve your work**.

By:
1. **Doing research** (gathering data)
2. **Saving to vault** (storing patterns)
3. **Updating CLAUDE.md** (teaching Claude)
4. **Repeating** (reinforcing patterns)

You create a **self-improving research assistant** that learns your style over time.

After weeks of use: Claude knows your research preferences better than you do.  
After months of use: Research becomes significantly faster and more insightful.  
After a year: Your vault is a knowledge base + Claude is perfectly trained for your work style.

That's the power of the self-improving loop.

## See Also

- `MCP_INTEGRATION.md` - Technical MCP bridge documentation
- `CLAUDE.md` - System context and research workflow settings
- `example-MCP-servers-research.md` - Example of vault research output
- `youtube-pipeline-orchestrator.py` - Programmatic access to pipeline

---

**Ready to become a research monster?**

Start with:
```bash
/youtube-pipeline "your research topic" --analysis gaps --deliverable infographic
```

Then update `CLAUDE.md` after a few runs for truly self-improving research.
