# Vault Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove ghost vault copies, repo clones, and root-level junk; consolidate inboxes and orphaned notes into a clean, single-root structure.

**Architecture:** Eight self-contained tasks executed sequentially. Each task either rescues unique content first or operates on confirmed-empty/superseded material. The canonical `Claude Memory/` folder is the north star — nothing touching it is deleted without a diff check.

**Tech Stack:** Git Bash shell commands on Windows; paths use forward-slash notation under Git Bash.

---

## Pre-flight check

The vault root is:
```
C:/Users/ElliotHorton/Documents/ObsidianVault
```
All relative paths below are from that root. Run all commands from inside Git Bash with that as the working directory.

```bash
cd 'C:/Users/ElliotHorton/Documents/ObsidianVault'
```

---

## Task 1 — Rescue unique files from JB's Vault

**Files:**
- Rescue: `JB's Vault/Outlook Organizer/README.md` → `Outlook Organizer/README.md`
- Rescue: `JB's Vault/Claude Prompt.md` → `Claude Memory/Instructions/delivery_standard.md`
- Verify then ignore: `JB's Vault/Outlook Organizer/MAPPING.md`, `PROPOSAL.md`, `reference/org-structure.md` (same content as root `Outlook Organizer/` — confirmed by diff below)
- Ignore: everything else in `JB's Vault/Claude Memory/` (stale subset of root `Claude Memory/`)

- [ ] **Step 1.1 — Diff the MAPPING.md files to confirm they're identical**

```bash
diff "JB's Vault/Outlook Organizer/MAPPING.md" "Outlook Organizer/MAPPING.md" && echo "IDENTICAL"
diff "JB's Vault/Outlook Organizer/PROPOSAL.md" "Outlook Organizer/PROPOSAL.md" && echo "IDENTICAL"
diff "JB's Vault/Outlook Organizer/reference/org-structure.md" "Outlook Organizer/reference/org-structure.md" && echo "IDENTICAL"
```
Expected: `IDENTICAL` for all three. If any show differences, review and manually merge before proceeding.

- [ ] **Step 1.2 — Copy the unique README into root Outlook Organizer**

```bash
cp "JB's Vault/Outlook Organizer/README.md" "Outlook Organizer/README.md"
```
Expected: no error; `Outlook Organizer/README.md` now exists.

- [ ] **Step 1.3 — Copy the delivery-standard prompt into Claude Memory**

```bash
cp "JB's Vault/Claude Prompt.md" "Claude Memory/Instructions/delivery_standard.md"
cat "Claude Memory/Instructions/delivery_standard.md" | head -5
```
Expected: first line is "Remember when implementing: The marginal cost of completeness is near zero…"

- [ ] **Step 1.4 — Verify the tenancy PDF is already in 10-Legal/**

```bash
ls 10-Legal/
```
Expected output includes: `tenancy_agreement - 184 Goosemoor lane.pdf`, `Mine_vs_Amy_May_26.pdf`, `N and C Tenancy.md`

---

## Task 2 — Delete stale vault copies

Confirmed safe: `Claude Memory 1/` is a strict subset of `Claude Memory/` (missing 20+ newer files). `Jelly Bean's Vault/` is 0 files. `JB's Vault/` unique content rescued in Task 1.

- [ ] **Step 2.1 — Delete Claude Memory 1/**

```bash
rm -rf 'Claude Memory 1'
ls | grep "Claude Memory"
```
Expected: only `Claude Memory` remains (no `Claude Memory 1`).

- [ ] **Step 2.2 — Delete JB's Vault/**

```bash
rm -rf "JB's Vault"
ls | grep -i "jb"
```
Expected: no output (folder gone).

- [ ] **Step 2.3 — Delete Jelly Bean's Vault/ (empty)**

```bash
rm -rf "Jelly Bean's Vault"
ls | grep -i "jelly"
```
Expected: no output.

---

## Task 3 — Delete empty artifact folders and repo clones

All confirmed empty or READMEs-only; real repos live on GitHub.

- [ ] **Step 3.1 — Delete Google Drive/ (empty)**

```bash
rm -rf 'Google Drive'
```

- [ ] **Step 3.2 — Delete stitch_... folder (empty)**

```bash
rm -rf 'stitch_faceless_finance_app_pipeline_dashboard'
```

- [ ] **Step 3.3 — Delete repo clones**

```bash
rm -rf 'esphome-devices' 'fincast-suite' 'Claude-Github' 'Claude-Skills-pluggins-connections-'
```

- [ ] **Step 3.4 — Verify deletions**

```bash
ls | grep -E "Google Drive|stitch|esphome|fincast-suite|Claude-Github|Claude-Skills"
```
Expected: no output (all gone).

---

## Task 4 — Clean root-level junk files

Confirmed disposable: empty notes, Obsidian defaults, plugin logs, duplicates already safe in `10-Legal/`.

- [ ] **Step 4.1 — Delete Obsidian default starter files**

```bash
rm 'Welcome.md' 'create a link.md'
```

- [ ] **Step 4.2 — Delete empty/fragment notes**

```bash
rm 'Untitled.md' '2026-05-01.md'
```
(Both confirmed empty.)

- [ ] **Step 4.3 — Delete cashflow wrapper note (embeds PDF already in 10-Legal/)**

```bash
rm 'This is what I need for my cashflow.md'
```

- [ ] **Step 4.4 — Delete BRAT plugin log**

```bash
rm 'BRAT-log.md'
```

- [ ] **Step 4.5 — Delete 'God mode' (just a raw URL, no note structure)**

```bash
rm 'God mode'
```

- [ ] **Step 4.6 — Move Income_forecast_2026.xlsx to Work/Income Forecast/**

```bash
mv 'Income_forecast_2026.xlsx' 'Work/Income Forecast/'
ls 'Work/Income Forecast/'
```
Expected: file appears in `Work/Income Forecast/`.

- [ ] **Step 4.7 — Move screenshot to _attachments/**

```bash
mkdir -p '_attachments'
mv 'Screenshot_20260525_030107_Obsidian.jpg' '_attachments/'
ls '_attachments/'
```

- [ ] **Step 4.8 — Rescue Untitl.md gist URL then delete**

The file contains a raw gist URL. Append it to the JARVIS inbox as a proper note, then delete the root file.

```bash
echo "# Gist link (rescued from Untitl.md 2026-06-15)

$(cat 'Untitl.md')" > 'JARVIS/Inbox/2026-06-15-gist-link.md'
rm 'Untitl.md'
cat 'JARVIS/Inbox/2026-06-15-gist-link.md'
```
Expected: note contains the gist URL.

- [ ] **Step 4.9 — Delete root copies of legal files (originals safe in 10-Legal/)**

```bash
rm 'Mine_vs_Amy_May_26.pdf' 'N and C Tenancy.md' 'tenancy_agreement - 184 Goosemoor lane.pdf'
```

---

## Task 5 — Consolidate inboxes

Two inboxes exist: `Inbox/` (general) and `JARVIS/Inbox/` (Fold 7 agent). Canonical = `JARVIS/Inbox/`.

- [ ] **Step 5.1 — Read root Inbox/quick-capture.md to check if it has content**

```bash
cat 'Inbox/quick-capture.md'
```
If it has real content: copy to `JARVIS/Inbox/` with a dated filename.
If empty or template only: skip to step 5.2.

- [ ] **Step 5.2 — Move quick-capture note if it has real content (conditional)**

Only run this if step 5.1 showed real user content:
```bash
cp 'Inbox/quick-capture.md' 'JARVIS/Inbox/2026-06-15-quick-capture.md'
```

- [ ] **Step 5.3 — Delete root Inbox/**

```bash
rm -rf 'Inbox'
ls | grep "Inbox"
```
Expected: no output (only `JARVIS/Inbox` remains, nested).

- [ ] **Step 5.4 — Move Mini Notes capture to JARVIS/Inbox/**

```bash
mv 'Mini Notes/2026-06-06 214315 JARVIS live test — Phase 0 complete.md' 'JARVIS/Inbox/'
rm -rf 'Mini Notes'
```

---

## Task 6 — Organise orphaned project notes

- [ ] **Step 6.1 — Move Faceless Finance podcast script out of Studying-/**

```bash
mv 'Studying-/PODCAST_EP02_Forecasting.md' 'Faceless Finance/'
rm -rf 'Studying-'
ls 'Faceless Finance/'
```
Expected: `PODCAST_EP02_Forecasting.md` now in `Faceless Finance/`.

- [ ] **Step 6.2 — Move Select Lifestyles into Work/**

```bash
mkdir -p 'Work/Select Lifestyles'
mv 'Select Lifestyles/'* 'Work/Select Lifestyles/' 2>/dev/null || true
rm -rf 'Select Lifestyles'
ls 'Work/Select Lifestyles/'
```

- [ ] **Step 6.3 — Move Select Cashflow into Work/Select Lifestyles/**

```bash
mv 'Select Cashflow/'* 'Work/Select Lifestyles/' 2>/dev/null || true
rm -rf 'Select Cashflow'
```

- [ ] **Step 6.4 — Move Tasks/open.md to JARVIS/**

```bash
mv 'Tasks/open.md' 'JARVIS/Tasks.md'
rm -rf 'Tasks'
ls 'JARVIS/'
```

---

## Task 7 — Organise scripts and docs

- [ ] **Step 7.1 — Move forecast_tool.py to Work/Income Forecast/**

```bash
mkdir -p 'Work/Income Forecast/scripts'
mv 'scripts/forecast_tool.py' 'Work/Income Forecast/scripts/'
rmdir 'scripts' 2>/dev/null && echo "scripts/ removed" || echo "scripts/ not empty — check"
ls 'Work/Income Forecast/scripts/'
```
Expected: `forecast_tool.py` in the right place, `scripts/` folder removed.

---

## Task 8 — Fix merge conflict in Smart Home _index.md

The file has a `<<<<<<< HEAD` / `>>>>>>>` conflict marker from the vault consolidation on 2026-06-15.

- [ ] **Step 8.1 — Read the file to see the conflict**

```bash
cat 'Claude Memory/Projects/Smart Home/_index.md'
```

- [ ] **Step 8.2 — Resolve: keep the HEAD version (apply .171 IP collision fix action)**

The conflict is in the Next Actions section. The HEAD version has the specific fix task. Remove the conflict markers and keep:

```
- [ ] **Apply .171 IP collision fix** — upstairs → .207 via ESPHome OTA. Full plan: [[fixes/2026-06-14-ip-collision-fix]]
```

Discard the incoming branch lines:
```
- [ ] DHCP reservation: RuView node MAC e0:72:a1:e7:03:60 → .227
- [ ] Delete ghost "Upstairs" (.207) config in ESPHome Builder (board now runs CSI firmware)
- [ ] Clarify IP conflict (upstairs vs bedroom both 192.168.0.171)
```

Edit `Claude Memory/Projects/Smart Home/_index.md` to remove the `<<<<<<< HEAD`, `=======`, and `>>>>>>> 40f80853...` markers and keep only the HEAD content in that section.

- [ ] **Step 8.3 — Verify no conflict markers remain**

```bash
grep -c "<<<\|===\|>>>" 'Claude Memory/Projects/Smart Home/_index.md' && echo "CONFLICT MARKERS FOUND" || echo "Clean"
```
Expected: `Clean`

---

## Final verification

- [ ] **Run final tree check**

```bash
find 'C:/Users/ElliotHorton/Documents/ObsidianVault' \
  -not -path '*/.obsidian/*' \
  -not -path '*/.git/*' \
  -maxdepth 1 | sort
```
Expected root-level entries:
```
_attachments/
10-Legal/
Claude Memory/
CLAUDE.md
docs/
esphome-devices/   ← GONE
Faceless Finance/
JARVIS/
README.md
Work/
.env.repos
.gitignore
.mcp.json
repos-manifest.json
20260602134715997.pdf       ← left for you to identify
20260602134715997 1.pdf     ← left for you to identify
```

- [ ] **Commit the cleanup**

```bash
git add -A
git status
git commit -m "chore: vault cleanup — remove ghost copies, consolidate inboxes, fix merge conflict"
```
