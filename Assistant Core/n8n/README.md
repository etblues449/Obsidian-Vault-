# n8n Workflow Files — Import & Activate

Four ready-to-import workflows. Each one is the same shape as your working **JARVIS · Note Router**, but starts from a schedule instead of a webhook and writes a report back to the vault via GitHub.

| File | Workflow | Runs | Writes |
|------|----------|------|--------|
| `1-morning-brief.workflow.json` | JARVIS - Morning Brief | Daily 7:00 AM | `Claude Memory/briefings/YYYY-MM-DD.md` |
| `6-pattern-detector.workflow.json` | JARVIS - Pattern Detector | Monday 8:00 AM | `Claude Memory/patterns.md` (prepends) |
| `3-connection-finder.workflow.json` | JARVIS - Connection Finder | Sunday 2:00 PM | `Claude Memory/connections/YYYY-MM-DD.md` |
| `4-weekly-synthesis.workflow.json` | JARVIS - Weekly Synthesis | Friday 6:00 PM | `Claude Memory/synthesis/YYYY-Www.md` |

All schedules run in **Europe/London** (set inside each workflow — no UTC surprises).

---

## Import (per workflow, ~2 min each)

1. In n8n: **Workflows → Create Workflow** (or the **+** button)
2. Top-right **⋯ menu → Import from File…** (on mobile: ⋯ → Import from URL and paste the raw GitHub URL of the file)
3. Pick the `.workflow.json` file — the whole node chain appears wired up
4. **Set credentials on 2 node types** (n8n shows a red warning on each):
   - Every **GitHub node** → select your existing GitHub credential (same one the Note Router's "Commit Note to Vault" uses)
   - The **Claude (HTTP Request) node** → under *Credential for Anthropic API*, select your existing Anthropic credential (same one behind the Note Router's Claude Classifier)
5. **Test:** click **Execute Workflow** — watch it run left to right, check the output file lands in GitHub
6. **Publish/Activate** (toggle top-right)

Repeat for all four. Total: ~10 minutes.

---

## Raw file URLs (for Import from URL on the Fold 7)

```
https://raw.githubusercontent.com/etblues449/Obsidian-Vault-/master/Assistant%20Core/n8n/1-morning-brief.workflow.json
https://raw.githubusercontent.com/etblues449/Obsidian-Vault-/master/Assistant%20Core/n8n/3-connection-finder.workflow.json
https://raw.githubusercontent.com/etblues449/Obsidian-Vault-/master/Assistant%20Core/n8n/4-weekly-synthesis.workflow.json
https://raw.githubusercontent.com/etblues449/Obsidian-Vault-/master/Assistant%20Core/n8n/6-pattern-detector.workflow.json
```

(Repo must be public for raw URLs to work without auth — if it's private, use **Import from File** instead: download the file from GitHub first.)

---

## How each workflow works

**Morning Brief** — lists `JARVIS/Inbox`, pulls the 12 most recent captures + `MEMORY.md`, asks Claude Opus for a 2–3 minute brief, commits it to `briefings/`.

**Pattern Detector** — pulls the 30 most recent captures + the current `patterns.md` (for week-over-week comparison), asks Claude for timing/behaviour/decision patterns, **prepends** the new report to `patterns.md` keeping ~20k chars of history.

**Connection Finder** — reads `MEMORY.md` + all five project `_index.md` files, asks Claude for surprising links, bridges, and missing connections (with citations), writes a dated report to `connections/`.

**Weekly Synthesis** — pulls the week's captures **plus** `decisions.md`, `beliefs.md`, `patterns.md`, and all project indexes, asks Claude for the full week-in-review, writes to `synthesis/YYYY-Www.md`.

All prompts instruct Claude to only use evidence from the vault (no invented content) and to weight the last 7 days using the dates in capture filenames.

---

## First runs (after activation)

- **Weekly Synthesis** — Friday 6:00 PM **today** (2026-07-04) if activated before then
- **Connection Finder** — Sunday 2026-07-06, 2:00 PM
- **Pattern Detector** — Monday 2026-07-07, 8:00 AM
- **Morning Brief** — tomorrow, 7:00 AM

Don't wait for the schedule — hit **Execute Workflow** once on each after import to verify end-to-end, then let the crons take over.

---

## Note Router Add-ons (`note-router-addons.json`)

Nine paste-ready nodes that upgrade the existing **JARVIS · Note Router**:

- **Junk Filter** — drops empty/placeholder captures ("your note here", "test") before they reach Claude or the vault
- **Belief Gate → Get/Append/Update Beliefs** — captures containing `#belief` get appended to `Claude Memory/beliefs.md` (Skill 5 auto-capture)
- **Decision Gate → Get/Append/Update Decisions** — captures containing `#decision` get appended to `Claude Memory/decisions.md` (Skill 7 auto-capture)

### Install (~3 min, on the Note Router canvas)

1. Open the raw JSON file, **select all → copy**
2. Open **JARVIS · Note Router** in n8n → click empty canvas → **paste** (Ctrl/Cmd+V). The 9 nodes appear with their internal wiring intact
3. Make **three connections by hand**:
   - Delete the existing **Normalize Note → Classify Note** connection
   - Wire **Normalize Note → Junk Filter → Classify Note**
   - Wire **Commit Note to Vault → Belief Gate** and **Commit Note to Vault → Decision Gate**
4. Select your GitHub credential on the 4 new GitHub nodes (red triangles)
5. **Test:** Execute with a capture containing `#belief` — check `beliefs.md` gains an entry. Execute with text "your note here" — check the run stops at Junk Filter and nothing commits
6. **Publish**

The gates are Code nodes that emit nothing unless the tag is present, so untagged captures flow through the normal path untouched.

---

## Troubleshooting

- **GitHub node fails with 404** → check the credential has repo access, and the path exists on `master`
- **Claude node fails with 401** → the Anthropic credential wasn't selected on the HTTP Request node
- **Claude node times out** → timeout is set to 180s; if it still trips, lower `max_tokens` in the Compose Request code node
- **Pattern Detector "edit" fails** → `Claude Memory/patterns.md` must exist on master (it's seeded — don't delete it)
- **Wrong run time** → workflow Settings → Timezone should read `Europe/London` (imported automatically)
