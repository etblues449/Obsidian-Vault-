# Claude Session Context — JARVIS / Obsidian Vault

**Last Updated:** 2026-06-29  
**Build:** Phase 0-1 Complete (Capture Pipeline Live) + Unified Skills Framework  
**Architecture:** Phone-first (Fold 7/Termux) + n8n webhook router + GitHub sync + Obsidian Sync

---

## Who / What

**Elliot Horton** ("Jelly Bean") — UK supported-living professional (Select Lifestyles). AI tooling + automation focus.

### Active Projects
- **Smart Home / JARVIS** — HA Green + ESP32 + on-device agentic capture layer on Fold 7
- **Faceless Finance** — CA-credentialed faceless YouTube channel (Wed/Fri/Sun, Wed 4PM priority)
- **Doc to Learning** — Single-file HTML doc→learning app on Anthropic API
- **Work Financial Forecasting** — Select Lifestyles income forecast (.xlsm); Elliot directs as financial CFO

---

## SESSION START (Mandatory)

Read these before beginning work:
1. `Claude Memory/MEMORY.md` — Project index + active status
2. `Claude Memory/Profile/user_profile.md` — Your background + context
3. `Claude Memory/Projects/Smart Home/_index.md` — Current status + blockers
4. `Claude Memory/Projects/Faceless Finance/_index.md` — Upload schedule + CFO notes
5. `Claude Memory/capture_queue.md` — Capture backlog + routing decisions

### Infrastructure Check (Every Session)

Verify these are running on your PC:
```powershell
# Window 1: n8n
n8n start

# Window 2: Localtunnel (exposes Obsidian API)
lt --port 27124
```

Test webhook is live:
```powershell
curl https://jellybean1875.app.n8n.cloud/webhook/jarvis-capture
```

---

## SESSION END (Mandatory)

1. **Update project status** — `Claude Memory/Projects/[Active]/_index.md` (status, decisions, next)
2. **Log session** — Create `Claude Memory/Projects/[Active]/sessions/YYYY-MM-DD.md` (bullet summary)
3. **Tick captures** — Mark completed items in `Claude Memory/capture_queue.md`
4. **Commit to Git** — All changes via master branch (single-writer guarantee)

---

## The Seven Skills (Active Vault Model)

JARVIS runs 7 automated workflows that keep your vault intelligent and compounding:

| Skill | Trigger | Input | Output | Next Review |
|-------|---------|-------|--------|-------------|
| **1. Morning Brief** | 7am daily | Vault snapshots | `Claude Memory/briefings/YYYY-MM-DD.md` | Tomorrow 7am |
| **2. Capture Processor** | Every capture via n8n | Raw captures | Classified → Projects | Continuous |
| **3. Connection Finder** | Weekly (Sunday) | All notes + captures | Link graph + surprises | Every Sunday |
| **4. Weekly Synthesis** | Friday 6pm | Week's captures + projects | `Claude Memory/synthesis/YYYY-Www.md` | Every Friday |
| **5. Belief Tracker** | Manual (when beliefs shift) | Capture notes tagged `#belief` | Tracked in `Claude Memory/beliefs.md` | As needed |
| **6. Pattern Detector** | Weekly (Monday) | Captures + actions | Patterns → `Claude Memory/patterns.md` | Every Monday |
| **7. Decision Intelligence** | Manual (decisions logged) | Capture notes tagged `#decision` | Tracked in `Claude Memory/decisions.md` | As needed |

**Skills live in:** `Claude Memory/Skills/[skill_name]/`

---

## DELIVERY STANDARD

The marginal cost of completeness is near zero. **Do the whole thing:**
- With tests and documentation
- Ship the finished solution, not a plan
- Rewrite full files for easy copy/paste
- Never present a workaround when the real fix exists
- One step at a time, each finished before the next

---

## SENSITIVE DATA

This vault holds Elliot's legal + financial records (credit cards, solicitor correspondence, tenancy, income forecasts).

**Rules:**
- Never auto-surface or export notes tagged: `sensitive` / `private` / `confidential` / `legal` / `financial`
- Never write secrets/tokens into notes → use password manager
- Sensitive captures are **never** committed to GitHub

---

## Device Sync & Backup

**Primary sync:** GitHub via Obsidian Git plugin  
**Secondary sync:** Obsidian Sync (official service, paid)

**Single-writer guarantee:**
- Only n8n creates captures (via webhook)
- Only Claude creates session summaries
- You create all other notes
- **No multiple writers** (prevents Remotely Save conflicts)

**Branch policy:**
- All development on `master`
- No desktop CI/CD changes
- No Hermes automation layer (desktop-bound, incompatible with phone-first)
- No Claude Desktop + Filesystem MCP (creates second writer)

---

## How JARVIS Compounding Works

**Week 1:** Captures accumulate  
**Week 2:** Pattern Detector finds connections  
**Week 3:** Connection Finder shows you missed links  
**Week 4:** Weekly Synthesis reveals themes  
**Week 12:** Your vault is a decision-making engine (history + patterns + beliefs logged)

The vault becomes **your extended memory** and **Claude's context** for increasingly intelligent assistance.

---

## Permissions & Credentials

**Stored in password manager (never in vault):**
- `GITHUB_TOKEN` — vault push access
- `ANTHROPIC_API_KEY` — Claude Haiku for classification
- `GROQ_API_KEY` — fast LLM for skills
- Obsidian Local REST API token

**Stored in n8n.cloud:**
- GitHub OAuth2 credential
- Anthropic API key credential

---

## Quick Commands

```powershell
# Test a capture manually (PC)
$body = @{
    text = "Test capture"
    source = "manual-test"
    ts = (Get-Date -Format "o")
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://jellybean1875.app.n8n.cloud/webhook/jarvis-capture" `
  -Method POST -Body $body -ContentType "application/json"

# Push vault to GitHub
git add .
git commit -m "Session summary: [date] — [what changed]"
git push origin master

# Check n8n workflow status
curl http://localhost:5678/api/workflows -H "Authorization: Bearer $APIKEY"
```