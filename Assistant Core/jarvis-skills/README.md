# JARVIS — £0 "Active Vault" skill engine

This folder is the **free-forever replacement** for the paid n8n.cloud
workflows + paid Claude API that previously ran the seven-skill Active Vault
model. Same behaviour, same prompts, same output paths — now on an engine that
costs **£0/month, forever** (constraint **C1**).

| Layer | Was (paid) | Now (£0) |
|-------|-----------|----------|
| Scheduler / compute | n8n.cloud (trial credits, no perpetual free tier) | **GitHub Actions** (free for this repo) |
| LLM | Claude API `claude-opus-4-8` (per-token) | **Groq** `llama-3.3-70b-versatile` (free tier, no card) |
| Vault reads | GitHub API per file (shared-IP rate-limit lottery) | local `actions/checkout` (no API, no limits) |
| Vault writes | n8n GitHub-commit node | one serialized, rebase-retry `git push` to `master` |

> **To turn it on, do the one step in [`MIGRATION.md`](./MIGRATION.md): add a
> `GROQ_API_KEY` repository secret.** Everything else is already wired.

---

## What runs, and when

All times are **Europe/London** and DST-correct (see "How the clock works").

| # | Skill | Schedule (London) | Reads | Writes |
|---|-------|-------------------|-------|--------|
| 1 | Morning Brief | Daily 07:00 | 12 newest `JARVIS/Inbox` captures + `MEMORY.md` | `Claude Memory/briefings/YYYY-MM-DD.md` |
| 3 | Connection Finder | Sunday 14:00 | `MEMORY.md` + 5 project `_index.md` | `Claude Memory/connections/YYYY-MM-DD.md` |
| 4 | Weekly Synthesis | Friday 18:00 | 30 newest captures + decisions/beliefs/patterns + project indexes | `Claude Memory/synthesis/YYYY-Www.md` |
| 6 | Pattern Detector | Monday 08:00 | 30 newest captures + current `patterns.md` | `Claude Memory/patterns.md` (rolls: new on top, ~20k history kept) |

Skills **2 (Capture Processor), 5 (Belief Tracker), 7 (Decision Intelligence)**
are event-driven (they fire on a capture, not a clock) and are tied to the phone
capture path. Their £0 migration path is designed in
[`MIGRATION.md` → "Phase 2"](./MIGRATION.md); it is not part of this scheduled
engine because it needs a small Tasker change, not a cron.

---

## Files

```
Assistant Core/jarvis-skills/
├── runner.mjs            ← the whole engine: reads vault, calls Groq, writes output
├── test/local-test.mjs   ← offline test harness (no key, no network) — 26 assertions
├── README.md             ← this file
└── MIGRATION.md          ← turn-on steps, decommission n8n, rollback, cost proof

.github/workflows/
├── _jarvis-run-skill.yml       ← reusable engine (checkout → run → commit)
├── jarvis-1-morning-brief.yml   ← daily 07:00 London
├── jarvis-2-capture-router.yml    ← on: push to the inbox (event-driven)
├── jarvis-3-connection-finder.yml ← Sunday 14:00 London
├── jarvis-4-weekly-synthesis.yml  ← Friday 18:00 London
└── jarvis-6-pattern-detector.yml  ← Monday 08:00 London
```

Zero npm dependencies. Node 18+ (uses global `fetch` and full-ICU `Intl`).

---

## How the clock works (DST and delay without surprises)

GitHub Actions cron is **UTC only, has no daylight-saving awareness, and is
best-effort** — on free runners it routinely starts jobs 30 minutes to 3 hours
late. Each workflow therefore fires at **both** candidate UTC hours (e.g.
`0 6 * * *` and `0 7 * * *`) as two *attempts* at the same period.

`runner.mjs` does **not** check the clock. It asks one question — *"has this
period's output already been written?"* — via each skill's `done(ctx)`:

| Skill | Period key |
|---|---|
| Morning Brief | `briefings/<london date>.md` exists |
| Connection Finder | `connections/<london date>.md` exists |
| Weekly Synthesis | `synthesis/<ISO week>.md` exists |
| Pattern Detector | `patterns.md` contains `<!-- week:<ISO week> -->` |

Whichever attempt GitHub actually gets to first does the work; the other exits
in ~2 seconds with `reason=already-done`. This is DST-safe (no hour arithmetic),
delay-safe (a brief written at 10:00 is still today's brief) and self-healing.

> **Do not reintroduce an exact-hour guard.** Until 2026-08-02 the guard was
> `london.hour !== guard.hour`, and because GitHub starts jobs late it failed on
> *every* scheduled run: the workflow reported success and wrote nothing. All 11
> scheduled runs in the repo's history skipped this way. Evidence: job
> `30693257169` — `London now: ... 10:11`, `want hour=7`.

## How the single write path is kept (C3)

Vault corruption historically came from **two writers hitting `master` at once**.
This engine keeps the automated side to a single, coordinated writer:

- All four workflows share **one concurrency group** (`jarvis-vault-write`,
  `cancel-in-progress: false`), so two skills can never push simultaneously.
- The commit step does `push` → on rejection `pull --rebase --autostash` →
  retry (5×, exponential backoff). A race with the phone's `obsidian-git`
  resolves by rebasing, never by clobbering.
- Each skill writes its **own** path (dated files, or the automation-owned
  `patterns.md`), so there is no content contention with hand-edited notes.

`obsidian-git` on the Fold 7 remains the human write path. Two *coordinated*
writers to `master` is the existing, accepted architecture; the fix for
corruption is coordination (concurrency + rebase-retry), which this provides.

---

## Run a skill locally

```bash
# Offline dry-run (no Groq key needed) — proves reads/format/paths:
node "Assistant Core/jarvis-skills/runner.mjs" --skill=morning-brief --dry-run --force

# Real run against your machine (needs a key in the environment):
GROQ_API_KEY=xxx node "Assistant Core/jarvis-skills/runner.mjs" --skill=weekly-synthesis --force

# Backfill a specific day/instant (e.g. re-make Friday's synthesis):
JARVIS_FAKE_NOW="2026-07-03T17:00:00Z" GROQ_API_KEY=xxx \
  node "Assistant Core/jarvis-skills/runner.mjs" --skill=weekly-synthesis
```

Flags: `--skill=<id>` (required), `--force` (regenerate even if this
period's output exists),
`--dry-run` (skip the Groq call, emit stub text). Env: `GROQ_API_KEY`,
`GROQ_MODEL` (default `llama-3.3-70b-versatile`), `VAULT_ROOT` (default = repo
root), `JARVIS_FAKE_NOW` (ISO string to override "now").

## Run the tests

```bash
node "Assistant Core/jarvis-skills/test/local-test.mjs"
```

Builds a throwaway fixture vault, runs all five skills across BST instants, and
asserts period-idempotency (including that a *delayed* cron still writes — the
2026-08-02 regression), ISO-week numbering, output paths, the rolling
`patterns.md` prepend, and every capture-router routing rule. 26 assertions,
fully offline, no Groq key needed.

---

## Add or change a skill

Everything is in `runner.mjs` → the `SKILLS` object. Each entry declares its
`done(ctx)` (the period-idempotency check — **must** be keyed on the same period
as the output path, or the skill will either duplicate or never run), how it
`build(ctx)`s the prompt + output path, and whether it `create`s a dated file or
`prepend`s to a rolling one. An event-driven skill instead sets `kind: 'router'`
and an async `run(ctx)` that does its own writes (see `capture-router`). Add a new key,
then add a caller workflow in `.github/workflows/` that `uses:`
`_jarvis-run-skill.yml` with your `skill:` id and cron. No other plumbing.

## Change the model

Set a repository **variable** `GROQ_MODEL` (Settings → Secrets and variables →
Actions → Variables). Options today: `llama-3.3-70b-versatile` (default, best
quality), `llama-3.1-8b-instant` (fastest, 14.4k requests/day), or
`openai/gpt-oss-120b`. No code change needed.
