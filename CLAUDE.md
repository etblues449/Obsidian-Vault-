# Claude Session Context — JARVIS / Obsidian Vault

**Last Updated:** 2026-06-15

This vault is the persistent memory and working directory for all Claude sessions across devices (PC, Fold 7 / Termux, Claudian-in-Obsidian). All code, notes, decisions and artifacts live here.

## Who / What
Jelly Bean (Elliot Horton) — UK supported-living professional (Select Lifestyles). Active projects:
- **Smart Home / JARVIS** — HA Green + ESP32 + on-device agentic layer on the Fold 7
- **Faceless Finance** — CA-credentialed faceless YouTube channel (Wed/Fri/Sun, Wed 4PM priority)
- **Doc to Learning** — single-file HTML doc→learning app on the Anthropic API
- **Work Financial Forecasting** — Select Lifestyles income forecast (.xlsm); Claude acts as financial director

## SESSION START (mandatory — do before any task)
Read these, then confirm they are read before proceeding:
1. `Claude Memory/MEMORY.md`
2. `Claude Memory/Profile/user_profile.md`
3. `Claude Memory/Projects/Smart Home/_index.md`
4. `Claude Memory/Projects/Faceless Finance/_index.md`
5. `Claude Memory/Projects/Doc to Learning/_index.md`
6. `Claude Memory/Projects/Other Workspaces/_index.md`
7. `Claude Memory/capture_queue.md`

## SESSION END (on "done" / "wrap up" / "end session")
1. Update the relevant `Claude Memory/Projects/[Project]/_index.md` — status, decisions, next actions.
2. Create `Claude Memory/Projects/[Project]/sessions/YYYY-MM-DD.md` — bullet summary.
3. Tick completed items in `Claude Memory/capture_queue.md`.
4. Present all changed files for review/commit.

## DELIVERY STANDARD
The marginal cost of completeness is near zero. Do the whole thing — with tests and docs. Ship the finished solution, not a plan. Rewrite full files for easy copy/paste. Never present a workaround when the real fix exists. One step at a time, each finished before the next.

## SENSITIVE DATA
This vault holds Elliot's legal and financial records (credit-card statements, solicitor correspondence, tenancy agreements, income forecasts). Never auto-surface or export notes tagged `sensitive` / `private` / `confidential` / `legal` / `financial`. Never write secrets or tokens into notes — store them in a password manager.

## Device Sync
Reliable remote is the GitHub repo via the Obsidian Git plugin (`https://github.com/etblues449/Obsidian-Vault-.git`). Note: `remotely-save` has been failing — prefer Obsidian Git.

## Research Workflow (Claude Code + NotebookLM + Obsidian)

A self-improving research pipeline turning Claude Code into a research assistant.

### The Pipeline

```
Research Query (e.g., "Claude Code MCP servers")
    ↓
YouTube Search Skill (find relevant videos)
    ↓
NotebookLM Skill (ingest sources + analyze)
    ↓
Generate Deliverables (podcast, infographic, study guide)
    ↓
Save to Vault (Research/<date>_<query>.md with backlinks)
    ↓
Claude learns patterns → Improves CLAUDE.md → Better next iteration
```

### Quick Start

```
/youtube-pipeline "Claude Code MCP servers" --analysis gaps --deliverable infographic
```

### Analysis Types
- `gaps` - What's missing from current content? (find content opportunities)
- `trends` - What patterns are emerging?
- `competitive` - Competitive landscape analysis
- `content-performance` - What drives views/engagement?
- `opportunities` - Actionable next steps
- `comprehensive` - All analyses combined

### Deliverable Types
- `podcast` - Audio summary with transcript
- `infographic` - Visual breakdown
- `mindmap` - Concept relationship map
- `flashcards` - Key points for learning
- `studyguide` - Comprehensive study guide

### What Gets Saved

Each research run creates a markdown file in `Research/YouTube/`:
- Full analysis and key findings
- All videos analyzed with links
- Podcast transcript (if generated)
- Opportunity list and gaps
- Metadata: date, query, video count, analysis type
- Backlinks to related research

Example: `Research/YouTube/2024-07-23_Claude-Code-MCP-servers.md`

### Self-Improvement Loop

The vault stores your research patterns:
1. **Topics** - What you research
2. **Style** - How you like analysis presented
3. **Preferences** - Which deliverables matter most

**Update CLAUDE.md with learned patterns:**
```
Can you update CLAUDE.md based on my latest research?
Focus on: analysis preferences, deliverable formats, research style.
```

This teaches Claude your research patterns for better future iterations.

### Key Principle

This workflow creates a **feedback loop**:
- More research → More vault data → Better CLAUDE.md → Better next analysis
- Over weeks/months, Claude learns exactly how you think about research
- The system improves itself through repeated use