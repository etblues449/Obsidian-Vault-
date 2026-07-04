# n8n Quick Deploy — Step by Step

**Goal:** Get all 5 workflows running in n8n.cloud in ~30 min  
**Access:** https://jellybean1875.app.n8n.cloud

---

## Pre-Deploy Checklist

- [ ] You're logged into n8n.cloud
- [ ] GitHub token is in password manager (for credentials setup)
- [ ] Anthropic API key is in password manager
- [ ] Localtunnel is running (`lt --port 27124` in PowerShell)
- [ ] n8n local instance running OR using cloud only

---

## Step 0: Set Up Credentials (One-Time)

### GitHub Credential

1. Go to **Credentials** (bottom left sidebar)
2. Click **+ New** → search **GitHub**
3. Choose **GitHub** (not GitHub Trigger)
4. Paste your `GITHUB_TOKEN` into the **Personal Access Token** field
5. Click **Save** → Test (should say "✓ Connected")

### Anthropic API Credential

1. Click **+ New** → search **Anthropic**
2. Paste your `ANTHROPIC_API_KEY` into the **API Key** field
3. Click **Save** → Test (should say "✓ Connected")

Both credentials now available in all workflows.

---

## Workflow 1: Morning Brief (7:00 AM)

**What it does:** Generates daily briefing with captures, context, focus areas. Runs every day at 7am.

### Create the Workflow

1. **New Workflow** → Name it `JARVIS - Morning Brief`
2. **Add a node** → Search **Cron** → Select **Cron**
   - **Rule:** `0 0 7 * * *` (7 AM daily)
   - Click **Add**
3. **Add a node** → Search **GitHub** → Select **GitHub (Trigger/Action)**
   - **Operation:** Read file
   - **Repository:** `Obsidian-Vault-`
   - **File Path:** `Claude Memory/MEMORY.md`
   - Link from Cron
4. **Add a node** → Search **Anthropic** → Select **Anthropic**
   - **Model:** Claude Opus 4.8
   - **Max Tokens:** 1000
   - **System Prompt:** `You are Elliot's morning assistant. Generate a 2-3 min briefing covering today's calendar, pending tasks, captures, patterns, and focus.`
   - **Prompt:** `Generate morning brief for: {{ $json }}` (uses context from previous node)
5. **Add a node** → Search **GitHub** → Select **GitHub**
   - **Operation:** Create file
   - **Repository:** `Obsidian-Vault-`
   - **File Path:** `Claude Memory/briefings/{{ $now.toFormat('yyyy-MM-dd') }}.md`
   - **File Content:**
     ```
     # Morning Brief — {{ $now.toFormat('yyyy-MM-dd') }}
     
     {{ $node["Anthropic"].json.message }}
     
     ---
     *Generated at 7:00 AM. Next briefing: tomorrow at 7:00 AM.*
     ```
6. **Connect nodes:** Cron → GitHub (Read) → Anthropic → GitHub (Create)
7. Click **Save**
8. Click **Test Workflow** to verify
9. Toggle **Active** (top-right) to enable

---

## Workflow 2: Connection Finder (Sunday 2:00 PM)

**What it does:** Scans vault for unexpected links between projects. Runs Sundays 2pm.

### Create the Workflow

1. **New Workflow** → Name: `JARVIS - Connection Finder`
2. **Cron** node
   - **Rule:** `0 0 14 * * 0` (Sunday 2 PM)
3. **GitHub** node (Read)
   - **Operation:** Read directory
   - **Repository:** `Obsidian-Vault-`
   - **Path:** `Claude Memory/Projects`
   - **Recursive:** ON
4. **Anthropic** node
   - **System Prompt:** `Find surprising connections between projects. Look for bridges (similar themes), missing links, and cross-project synergies.`
   - **Prompt:** `Analyze these vault files for connections: {{ $json }}`
5. **GitHub** node (Create)
   - **File Path:** `Claude Memory/connections/{{ $now.toFormat('yyyy-MM-dd') }}.md`
   - **File Content:**
     ```
     # Connections Found — {{ $now.toFormat('yyyy-MM-dd') }}
     
     {{ $node["Anthropic"].json.message }}
     
     ---
     *Generated Sunday at 2:00 PM. Next: next Sunday at 2:00 PM.*
     ```
6. Connect: Cron → GitHub (Read) → Anthropic → GitHub (Create)
7. Save, Test, Activate

---

## Workflow 3: Weekly Synthesis (Friday 6:00 PM)

**What it does:** Synthesizes week's momentum, decisions, patterns, blockers. Runs Fridays 6pm.

### Create the Workflow

1. **New Workflow** → Name: `JARVIS - Weekly Synthesis`
2. **Cron** node
   - **Rule:** `0 0 18 * * 5` (Friday 6 PM)
3. **GitHub** node (Read captures)
   - **Path:** `JARVIS/Inbox`
   - **Recursive:** ON
4. **GitHub** node (Read decisions)
   - **Path:** `Claude Memory/decisions.md`
5. **GitHub** node (Read beliefs)
   - **Path:** `Claude Memory/beliefs.md`
6. **Anthropic** node
   - **System Prompt:** `You are a weekly synthesis writer. Summarize momentum, decisions, beliefs, patterns, and suggest next week priorities.`
   - **Prompt:** `Create weekly synthesis from captures, decisions, and beliefs: {{ $json }}`
7. **GitHub** node (Create)
   - **File Path:** `Claude Memory/synthesis/{{ $now.toFormat('yyyy-') }}W{{ Math.ceil(($now - new Date($now.getFullYear(), 0, 1)) / 86400000 / 7) }}.md`
   - **File Content:**
     ```
     # Weekly Synthesis
     
     {{ $node["Anthropic"].json.message }}
     
     ---
     *Generated Friday 6 PM. Next: next Friday 6 PM.*
     ```
8. Connect: Cron → [all GitHub reads] → Anthropic → GitHub (Create)
9. Save, Test, Activate

---

## Workflow 4: Pattern Detector (Monday 8:00 AM)

**What it does:** Detects timing, behavioral, decision patterns from weekly captures. Runs Mondays 8am.

### Create the Workflow

1. **New Workflow** → Name: `JARVIS - Pattern Detector`
2. **Cron** node
   - **Rule:** `0 0 8 * * 1` (Monday 8 AM)
3. **GitHub** node (Read)
   - **Path:** `JARVIS/Inbox`
   - **Recursive:** ON
4. **Anthropic** node
   - **System Prompt:** `Analyze capture patterns: timing peaks/troughs, action timing by project, decision timing, behavioral triggers, daily resource flow.`
   - **Prompt:** `Detect patterns in these captures: {{ $json }}`
5. **GitHub** node (Create)
   - **File Path:** `Claude Memory/patterns.md`
   - **File Content:**
     ```
     # Patterns Detected
     
     *Updated: {{ $now.toFormat('yyyy-MM-dd HH:mm') }}*
     
     {{ $node["Anthropic"].json.message }}
     
     ---
     *Next scan: next Monday 8 AM.*
     ```
6. Connect: Cron → GitHub (Read) → Anthropic → GitHub (Create)
7. Save, Test, Activate

---

## Workflow 5: Update Capture Processor (Already Running)

**Status:** The existing `JARVIS - Note Router` workflow already handles captures.

**Optional Enhancement:** Add routing for `#belief` and `#decision` tags

1. Open **JARVIS - Note Router** workflow
2. After the "GitHub commit" node, add an **IF** node
3. **Condition:** Message contains `#belief` OR `#decision`
4. **If TRUE:**
   - Parse tag
   - If `#belief` → append to `Claude Memory/beliefs.md`
   - If `#decision` → append to `Claude Memory/decisions.md`
5. Save

For now, the base capture processing is sufficient (captures go to JARVIS/Inbox, then Connection Finder/Weekly Synthesis pick them up).

---

## Cron Time Reference

| Workflow | Cron Rule | English |
|----------|-----------|---------|
| Morning Brief | `0 0 7 * * *` | Every day at 7:00 AM |
| Connection Finder | `0 0 14 * * 0` | Every Sunday at 2:00 PM |
| Weekly Synthesis | `0 0 18 * * 5` | Every Friday at 6:00 PM |
| Pattern Detector | `0 0 8 * * 1` | Every Monday at 8:00 AM |

Test cron at: https://crontab.guru

---

## Deploy Checklist

- [ ] **Credentials set up** (GitHub + Anthropic)
- [ ] **Workflow 1: Morning Brief** created, tested, activated
- [ ] **Workflow 2: Connection Finder** created, tested, activated
- [ ] **Workflow 3: Weekly Synthesis** created, tested, activated
- [ ] **Workflow 4: Pattern Detector** created, tested, activated
- [ ] **All workflows showing "Active"** (blue toggle)
- [ ] **Test one workflow** manually (click "Execute Workflow")
- [ ] **Check vault** for generated files (should appear after first run)

---

## First Runs

- **Morning Brief:** Tomorrow at 7:00 AM (or today if after 7 AM)
- **Pattern Detector:** Next Monday 8:00 AM
- **Connection Finder:** Next Sunday 2:00 PM
- **Weekly Synthesis:** Next Friday 6:00 PM

Check **Execution History** in n8n to see results of each run.

---

## Monitoring

**Daily:** Check for new files in vault:
- `Claude Memory/briefings/YYYY-MM-DD.md` (should appear tomorrow)
- `Claude Memory/patterns.md` (updates every Monday)
- `Claude Memory/connections/` (new file every Sunday)
- `Claude Memory/synthesis/` (new file every Friday)

**If workflow fails:**
1. Click workflow → **Execution History**
2. Click the failed run → see error message
3. Common issues:
   - GitHub token invalid → regenerate token, update credential
   - Anthropic API error → check quota
   - File path typo → verify path matches your repo structure

---

## All Done?

Commit the deployment guide to vault, then sit back. The vault will start filling with automated insights:

✅ Daily: Morning briefings  
✅ Weekly Monday: Pattern analysis  
✅ Weekly Friday: Synthesis  
✅ Weekly Sunday: Connections  

Your intelligent vault is now live.
