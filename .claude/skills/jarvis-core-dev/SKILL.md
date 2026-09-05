---
name: jarvis-core-dev
description: >-
  Develop and modify the JARVIS phone application itself — the Node codebase at ~/jarvis-core
  (private repo etblues449/jarvis-core, branch main): lib/agent.mjs, lib/brain.mjs, lib/persona.mjs,
  lib/memory.mjs, lib/ledger.mjs, lib/hardline.mjs, lib/rails.mjs, lib/env.mjs, the 14 tools in
  tools/, jarvis-app.mjs on :8737, jarvis-voice.mjs, heartbeat.mjs and test/. Use when adding or
  fixing a tool, changing the model provider or default model, touching the confirmation gate or
  the safety floors, editing a system prompt, working on memory or the action ledger, adding tests,
  or setting JARVIS up on a new device. Also use for follow-ups — "fix that tool", "add a test for
  it", "re-run the checks", "why did that change break the app". This is the PHONE APP. It is NOT
  the scheduled GitHub Actions engine (Assistant Core/jarvis-skills/runner.mjs) — that belongs to
  skill-engine-ops.
when_to_use: >-
  Trigger on: add or change a tool in tools/, edit anything in lib/, change provider or model,
  touch the confirmation gate or hardline blocklist, edit a system prompt, work on memory or the
  ledger, add or run tests in test/, new-device setup or restore, or a follow-up on any of these.
  Do NOT trigger for the scheduled skills engine (skill-engine-ops), the capture transport
  (capture-pipeline), ESPHome or Home Assistant (voice-satellite-ops), or vault structure
  (vault-conventions).
---

# jarvis-core dev

The phone application. Zero npm dependencies, Node 18+, one shared turn loop behind four
surfaces. Read `vault-conventions` before anything touches the vault.

**Repo:** `etblues449/jarvis-core` (private), branch **`main`**. On device: `~/jarvis-core`.
Note the branch — the vault is `master`, this is `main`. Mixing them up is how a push goes
to the wrong place.

## The one rule that outranks the rest

**Restart the app after any code change:**

```
pkill -f jarvis-app.mjs; nohup node jarvis-app.mjs > logs/app.log 2>&1 &
```

A stale process quietly serving old code is the longest-standing footgun in this project.
It costs hours because everything *looks* right — the file is correct, the test passes, and
the running app disagrees with both.

## Layout

```
lib/agent.mjs      runTurn() + executeToolCall() — THE single choke point for every tool call
lib/brain.mjs      provider seam; exported PROVIDERS table (url, keyName, defaultModel)
lib/persona.mjs    the ONE system prompt shared by all four surfaces
lib/memory.mjs     durable facts: atomic write, .bak, read-back verification
lib/ledger.mjs     append-only JSONL: proposed → approved → started → ran
lib/hardline.mjs   catastrophic blocklist — refuses even when confirmation says yes
lib/rails.mjs      scanForInjection (19 patterns), isSafeMode, audit log, token tally
lib/env.mjs        THE .env loader
lib/tools.mjs      registry; drop a file in tools/ and it registers

jarvis-app.mjs     the daily app, :8737          jarvis-voice.mjs   voice terminal
heartbeat.mjs      scheduled checks              jarvis-doctor.mjs  pre-flight check
tools/*.mjs        14 registered tools + vault-lib.mjs (a HELPER, not a tool)
```

`tools/vault-lib.mjs` exports `safePath`/`SKIP_DIRS` and has no `name` or `run`, so it never
registers. 15 files, 14 tools. This has been miscounted repeatedly — `node self-knowledge.mjs`
reads the live registry and settles it.

## Env: one loader, and it already exists

`lib/env.mjs` is canonical. It splits on the **first** `=` so values containing `=` survive,
strips one pair of quotes, skips comments, and lets **real environment variables win** over
`.env` so you can override per-run.

Two known deviations, both wrong, both worth recognising rather than copying:
`lib/supabase-ai-agent-creator.mjs` hand-parses with `line.split('=')` (mangles any value with
an `=` in it), and a `lib/config.mjs` written in a scratch session did the same *and* clobbered
real env vars. If you find yourself writing a third loader, use `loadEnv()` instead.

**`.env` is gitignored and does not come down with a clone.** On a new device it must be
recreated by hand — that single fact is most of what makes a restore fail. `.env.example` is
generated from the code that reads the variables; `.gitignore` needs its `!.env.example`
negation or the template can never be committed.

## The tool contract

Export `default` with `name`, `description`, `parameters`, optional `requiresConfirmation` +
`confirmText(args)`, and `async run(args)` returning a **string**. Throwing is fine — the model
reasons over the error. Registration is automatic; the core loop is never edited for a new tool.

Return a spoken sentence rather than throwing for *expected* failures (offline, bad input). A
thrown error reaches the user as a crash; a returned sentence reaches them as JARVIS explaining
itself.

## Safety floors — check order is the design

In `executeToolCall`: tool exists → parse args → validate → `gated` → `onToolUse` →
**`hardline`** → `isSafeMode` → confirm → run + `scanForInjection` + audit.

`hardline` sits **before** `isSafeMode` deliberately, so a catastrophic command is refused
whether safe mode is on or off and with no route around it via the confirm gate. Moving it
after would silently reopen that path. `~/jarvis-core/.jarvis-safe` is the panic button —
its presence refuses every gated action.

Two regex bugs that must not be reintroduced, both found by tests: PowerShell flags need
**order-free lookaheads** (`Remove-Item -Force -Recurse` is as lethal as the other order), and
**never put `\b` before a hyphenated flag** — the boundary between a space and `-` is not a word
boundary in JS, so `\b-Recurse` never matches and the rule silently dies.

## Honesty is enforced in code, not hoped for

The recurring defect class here is *a confident number that is wrong*. Two real examples:
`tools/database.mjs` counted `rows.length` under `limit=1000`, so a 1001-row table would have
reported "1000"; and `lib/memory.mjs` used to report success on a write it never verified.

So: when a count can be truncated, get it from the source (PostgREST `Prefer: count=exact` via
`Content-Range`). When the true value is unavailable, **say so** rather than emitting the best
guess. Write a test asserting that the offline path emits **no number at all** — that turns the
honesty rule into something mechanical instead of something trusted.

## A checker must derive, never restate

`jarvis-doctor.mjs` initially hardcoded brain.mjs's default model. The moment the default was
fixed, the doctor reported the old value and failed a correct install — stale within ten minutes
of being written.

If a verification tool contains a constant that also exists in the thing it verifies, the two
will drift, and the checker will report the stale value **with full confidence**. That is worse
than no check. The doctor now imports the live `PROVIDERS` table and shows provenance —
`(from .env)` or `(brain.mjs default)`.

Model retirement is not discoverable via any API, so `DEAD_MODELS` in `jarvis-doctor.mjs` is
maintained by hand. Groq retired `llama-3.3-70b-versatile` and `llama-3.1-8b-instant` on
2026-08-16; the first was `brain.mjs`'s default and failed every scheduled run 25/25.

## Tests

`test/` is deliberately offline: **no API key, no network, no phone.** A suite that fails on a
train is worse than none, because people stop believing it. Stub `fetch` for run-path tests;
keep live acceptance in a separate file (`test/database-live.mjs`) so connectivity can never
fail the suite.

```
node test/tier1-test.mjs   node test/tier2-test.mjs   node test/tier6-test.mjs
node test/database-test.mjs        30 assertions, offline
node jarvis-doctor.mjs             pre-flight: will it actually run here?
node self-knowledge.mjs --check    drift gate: docs vs live registry
```

Write the regression test **before** claiming a bug is fixed. `'run'` appeared twice in one
routing condition and `'running'` matched it, so "how many agents are running" returned
execution history — invisible until a test pinned it.

## Every change ships with

```
1. The changed file(s), rewritten in full
2. node --check <file>            syntax gate before commit
3. The relevant offline suite, green, with its assertion count
4. The app restarted, and 200 confirmed on :8737
5. A statement of which state the change reached: documented / merged / running
```

## Termux

- **`pkg install nodejs` can report "already the newest version" while node is unrunnable** —
  `cannot locate symbol OSSL_PROVIDER_add_conf_parameter` means a stale OpenSSL linkage, not a
  missing package. `pkg reinstall openssl nodejs`, answer `N` at the `openssl.cnf` prompt.
- **No pager ships with Termux.** `git log` dies printing nothing. `git config --global core.pager cat`.
- **A fresh clone has no git identity**, and if you chain a command after `git commit` the
  "Author identity unknown" error scrolls away and it reads as a silent no-op. Run `git commit`
  alone and read its output.
- **Write files with `cat` + a quoted heredoc, never `node -e`** — nested quoting is mangled
  before Node runs, and it commits nothing while still pushing a commit. Avoid triple-backtick
  fences inside a heredoc; they can swallow the terminator and truncate the file. Verify with
  `wc -l` and `tail -1`, never by the absence of an error.

## Gotchas

- **Read the repo before writing code for it.** A project doc once described a working tool as
  a stub and cost half a session rebuilding it. A document claiming something is broken wastes
  exactly as much time as one claiming it works.
- **`git ls-remote` before assuming a remote is empty.** A scratch repo on the wrong branch with
  unrelated history invites `--force` on rejection, which would destroy the real history.
- **Push is what makes the device disposable.** The 2026-08-23 push to `origin/main` is the only
  reason the safety floors, persona, memory, ledger and capture survived the loss of the Fold 7.
- **Never auto-replay an approved-but-unrun action.** The ledger surfaces orphans for
  re-approval; firing an action approved hours ago is precisely the unrequested action this
  project forbids. `drainReport()` is read-only by design.
- **Proof obtained on a device that no longer exists is evidence the code works, not evidence
  it works here.** Re-verify on a new device rather than trusting a completion marker.

## Test scenarios

**Normal — "add a tool that reads X".** Check `tools/` for an existing one first. Write it to
the contract, returning sentences for expected failures. Add offline tests including the empty
and unreachable paths. `node --check`, run the suite, restart the app, confirm the tool count
rose by one via `self-knowledge.mjs`, commit, push to `main`.

**Error — a change to `lib/brain.mjs` breaks every surface.** All four entry points share it, so
a syntax error takes the whole app down at once. `node --check lib/brain.mjs` before commit;
keep the `.bak` the installer wrote; if the app fails to start, restore the backup first and
diagnose second — a phone with no working JARVIS is not a debugging environment.
