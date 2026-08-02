# Migrating the seven skills to £0 (GitHub Actions + Groq)

This is the turn-on guide for the free-forever skill engine in this folder. It
replaces the paid **n8n.cloud** scheduler and the paid **Claude API** with
**GitHub Actions** (free) + **Groq** (free tier). Follow it top to bottom;
Phase 1 takes about five minutes.

Everything referenced here is already built and committed. The only thing the
automation needs from you is **one API key as a repository secret**.

---

## Why (the £0 case)

The handoff flags two live £0 liabilities (§10.2, §12):

- **n8n.cloud has no perpetual free tier** — only trial credits. Once they run
  out, the seven skills stop. That violates constraint **C1 (£0 forever)**.
- **Claude API is per-token paid.** Cheap, but not £0.

GitHub Actions is free for public repositories and ships a generous free
minutes allowance for private ones; each skill run is well under a minute of
compute. Groq's free tier needs no card and, at four scheduled runs a week
against your tiny captures, sits far below every published limit (see
"Cost & headroom"). Net result: the Active Vault compounds for **£0/month**.

---

## Phase 1 — turn it on (~5 min)

### Step 1 · Get a free Groq API key

1. Go to <https://console.groq.com>, sign in (Google works), open **API Keys**.
2. **Create API Key**, copy it (starts `gsk_…`). No card, no charge.
3. Store the key in your password manager (per the vault's secret rules — never
   commit it to a note).

### Step 2 · Add it as a repository secret

1. On GitHub: **`etblues449/Obsidian-Vault-` → Settings → Secrets and variables
   → Actions → New repository secret**.
2. Name: **`GROQ_API_KEY`** · Value: the `gsk_…` key · **Add secret**.

*(Optional)* To pick a different model, add a **variable** (same screen,
**Variables** tab) named **`GROQ_MODEL`**, e.g. `llama-3.1-8b-instant`.
If unset, the default `llama-3.3-70b-versatile` is used.

### Step 3 · Enable Actions (if this repo has never run one)

**Settings → Actions → General → Allow all actions and reusable workflows**,
and under **Workflow permissions** choose **Read and write permissions** (lets
the workflow commit reports back to `master`). Save.

### Step 4 · Smoke-test each skill by hand

For each of the four workflows: **Actions tab → pick the workflow (e.g.
"JARVIS 1 · Morning Brief") → Run workflow → Run** (the *force* box is ticked by
default, so it runs immediately instead of waiting for the schedule).

Watch it go green, then confirm the output landed:

- Morning Brief → `Claude Memory/briefings/<today>.md`
- Connection Finder → `Claude Memory/connections/<today>.md`
- Weekly Synthesis → `Claude Memory/synthesis/<year>-W<week>.md`
- Pattern Detector → `Claude Memory/patterns.md` (new section on top)

Then on the Fold 7, let `obsidian-git` pull, and the reports appear in Obsidian.
That's the full £0 loop proven end to end.

### Step 5 · Let the schedules take over

Nothing more to do. The crons now fire automatically at the London times in the
table below. (GitHub may delay the *first ever* scheduled run of a new workflow
by a few minutes to ~an hour; manual runs are instant.)

| Skill | London time |
|-------|-------------|
| Morning Brief | Daily 07:00 |
| Pattern Detector | Monday 08:00 |
| Connection Finder | Sunday 14:00 |
| Weekly Synthesis | Friday 18:00 |

---

## Phase 1.5 — decommission n8n (do this only after Step 4 passes)

Once you've seen the four Actions produce reports, retire the paid duplicates so
you're not double-writing or paying:

1. In **n8n.cloud** (`jellybean1875.app.n8n.cloud`), **deactivate** (toggle off)
   these four workflows: *Morning Brief, Pattern Detector, Connection Finder,
   Weekly Synthesis*. Deactivating (not deleting) lets you roll back instantly.
2. Leave the **Note Router** (capture webhook) running for now — it is Skill 2
   and is handled separately in Phase 2 below.
3. After a week of clean Actions runs, delete the four n8n workflows and, if
   nothing else uses the account, cancel n8n.cloud entirely.

> Running both engines briefly is safe: they write the same dated paths, and the
> rebase-retry commit resolves any overlap. Just don't leave both on long-term,
> or you'll get two near-identical reports per day.

---

## Phase 2 — the event-driven skills (2, 5, 7) — design & £0 path

Skills 2 (Capture Processor / Note Router), 5 (Belief Tracker) and 7 (Decision
Intelligence) fire **on a capture**, not on a clock, so they can't be plain
crons. They currently live in the n8n **Note Router** (webhook). Two £0 ways to
move them off n8n — both remove the paid webhook:

**Option A (recommended) — GitHub-native, no server.**
Point the phone's capture at GitHub directly and process on push:
1. Tasker (or the Obsidian capture) writes the raw capture straight to
   `JARVIS/Inbox/<timestamp>-<slug>.md` via the GitHub Contents API using your
   PAT. (This is one HTTP Request action — the same POST shape Tasker already
   builds, retargeted from the n8n webhook to
   `https://api.github.com/repos/etblues449/Obsidian-Vault-/contents/...`.)
2. A new workflow `on: push` to `JARVIS/Inbox/**` runs a `capture-router`
   skill in `runner.mjs` (Groq classify → route/enrich → append `#belief`
   captures to `beliefs.md`, `#decision` to `decisions.md`). Because the
   phone's push uses a PAT (not the Actions `GITHUB_TOKEN`), it triggers the
   workflow; the workflow's own commit uses `GITHUB_TOKEN`, which does **not**
   re-trigger — so there is no loop.
3. Port the n8n **Junk Filter** (drop "your note here"/"test"/empty) as the
   first check in the router — this also fixes the open empty-capture bug.

**Option B — reuse the free Vercel voice agent.**
Add an `/api/capture` route to the already-deployed `jarvis-voice-lovat` app
(Vercel Hobby, free) that does the same classify-and-commit via octokit, and
point Tasker at it. Keeps a webhook shape but on free hosting.

### ✅ BUILT 2026-08-02 — Option A shipped

The `capture-router` skill and `.github/workflows/jarvis-2-capture-router.yml`
are merged and tested (13 offline tests in `test/local-test.mjs`). What shipped
differs from the design above in three deliberate ways:

1. **No Groq call at all.** The design said "Groq classify". The routing rules
   turned out to be fully deterministic (tag match + emptiness), so the router
   is a written rule table in `runner.mjs`, not a prompt. That is cheaper, has
   no quota, no nondeterminism, and satisfies the pipeline rule that a routing
   rule you cannot state is unmaintainable.
2. **Junk captures are quarantined, not dropped.** They move to
   `JARVIS/Inbox/_rejected/` and are reported loudly in the job summary. The
   filter is a second line of defence — **the Tasker variable bug is still open
   and still needs fixing at source.**
3. **The router also sweeps legacy root `Inbox/`.** Some capture paths still
   write there and cannot be corrected from CI. The sweep is copy-if-missing —
   never deletes, never overwrites — so the split is self-healing rather than
   requiring every writer to be fixed simultaneously.

Idempotence is keyed on a SHA-1 prefix of the capture content, recorded in
`Claude Memory/Account/capture-router-log.md`, and belief/decision entries carry
a `<!-- capture:<id> -->` marker so a duplicate cannot be appended even if the
log is lost. `on: push` fires on every commit, so this matters.

**Still on n8n / still to do:** the phone leg. Tasker still posts to the paid
n8n webhook. Retarget it at the GitHub Contents API (step 1 above) to finish
Phase 2 and satisfy C1.

#### Verify it on the Fold 7 (one line)

```bash
cd ~/jarvis/vault && printf -- '---\ntype: note\n---\n\n# Router check\n\n#belief Capture routing works end to end.\n' > "JARVIS/Inbox/$(date +%Y%m%d-%H%M%S)-router-check.md" && node "Assistant Core/jarvis-skills/runner.mjs" --skill=capture-router && tail -6 "Claude Memory/beliefs.md"
```

Expect `beliefs 1` in the summary line and your sentence at the bottom of
`beliefs.md`. Run it a second time — it must print `nothing new to route` and
`beliefs.md` must not grow. That second run is the important half: `on: push`
fires on every commit, so a non-idempotent router would duplicate every entry.

To prove the junk filter instead, write `your note here` as the body: the file
moves to `JARVIS/Inbox/_rejected/` and the run prints a `⚠ REJECTED` line.

---

## Cost & headroom (why this stays free)

Groq free tier (per the current Groq docs, July 2026) for the default
`llama-3.3-70b-versatile`: **30 requests/min, 1,000 requests/day, ~12k
tokens/min, 100k tokens/day**. This engine makes **one** request per skill run —
about **6 requests per week total**. Your captures are tiny (tens to a few
hundred bytes each), so a full prompt is a few thousand tokens, an order of
magnitude under the per-minute ceiling. There is no realistic path to hitting a
limit at this cadence. If you ever did (e.g. huge backfills), switch
`GROQ_MODEL` to `llama-3.1-8b-instant` (14,400 requests/day) via the repo
variable — no code change.

GitHub Actions: each run is a checkout + a Node script + a commit — seconds of
compute, far inside the free allowance.

---

## Rollback

- **Pause the £0 engine:** Actions tab → each workflow → **⋯ → Disable
  workflow**. Re-enable anytime.
- **Full rollback to n8n:** re-activate the four n8n workflows (Phase 1.5 kept
  them as deactivated, not deleted). Nothing in the vault schema changed, so the
  n8n workflows still work unmodified.
- **Remove entirely:** delete `.github/workflows/jarvis-*.yml`,
  `.github/workflows/_jarvis-run-skill.yml`, and `Assistant Core/jarvis-skills/`.

---

## Troubleshooting

| Symptom | Cause / fix |
|--------|-------------|
| Action fails at "Run skill" with `GROQ_API_KEY is not set` | Secret missing or misnamed — must be exactly `GROQ_API_KEY` (Step 2). |
| Groq step errors `HTTP 401` | Bad/rotated key — regenerate in the Groq console, update the secret. |
| Groq step errors `HTTP 429` | Rate limit (unlikely at this cadence) — the runner retries 3×; if persistent, set `GROQ_MODEL=llama-3.1-8b-instant`. |
| Commit step fails `push … after 5 attempts` | Sustained write contention on `master` — re-run; the concurrency group normally prevents this. |
| Scheduled run didn't fire at the exact minute | GitHub cron can lag under load, and skips the odd run; manual **Run workflow** always works. The London-time guard still ensures no *wrong-hour* run commits. |
| Report has a wrong-looking date/week | The runner uses `Europe/London`; check the repo isn't overriding `JARVIS_FAKE_NOW` anywhere (it should only be set in tests). |
