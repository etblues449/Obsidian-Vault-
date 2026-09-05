# Other Workspaces — Project Index

> Seeded 2026-07-27 during the harness build. This file did not exist, but
> `Assistant Core/jarvis-skills/runner.mjs` reads it for Connection Finder (Skill 3) and
> Weekly Synthesis (Skill 4).

## Goal

Catch-all index for smaller efforts that do not warrant a dedicated project folder.
Its job in the skill engine is to give Connection Finder a surface on which to spot
links between minor threads and the major projects.

## Status

Active smaller threads:

- **JARVIS-Carousel** — 7-slide Next.js presentation, deployed on Vercel, production
  branch `master`. Reviewed by the `webapp-reviewer` agent against baseline `d8e5532`.
- **Developer tooling** — VS Code extension built on the Anthropic API with streaming
  (code explanation, review, generation, chat sidebar).
- **MCP ecosystem** — configured servers include `hass-mcp`, `mcpvault`, `mcp-builder`.
- <!-- TO FILL — anything else currently live -->

## Key Decisions

- Threads graduate out of here into their own `Projects/<name>/` folder once they have
  their own next-actions list. Keeping a growing thread here starves it of tracking.
- `git` MCP: use `uvx mcp-server-git`, not the npm package — the npm version will not
  connect.

## Next Actions

- [ ] <!-- TO FILL -->

Sessions: *(none yet — add as `sessions/YYYY-MM-DD.md`)*



## 2026-08-22 — Carousel API secured (July audit #1 closed)

`/api/chat` + `/api/capture` on `jarvis-carousel.vercel.app` were unauthenticated —
`/api/chat` spent Opus 4.8 per anonymous caller; `/api/capture` injected into the
n8n→vault pipeline. **Fixed and verified live:**
- Fail-closed bearer gate `app/api/_auth.ts` (503 if `JARVIS_API_TOKEN` unset, 401 if
  wrong/absent, constant-time compare, header/`?token=` both accepted). Both routes gated.
- Client `app/lib/apiToken.ts`: captures `#token=` from URL once, persists to
  localStorage, scrubs the URL, sends bearer on every `/api` call. Both pages wired.
- `JARVIS_API_TOKEN` set in Vercel (Production+Preview). Redeployed `d764605`.
- **Live probe 2026-08-22:** no-token→401, wrong→401, correct→200+pong, capture→401. ✓
- Root cause of the earlier "still open" reading: Vercel deploys branch **main**; all
  work lands on **master**. Merged master→main (`d7646051`). **Standing risk: main/master
  drift** — recommend switching Vercel production branch to master and retiring main.
- Also fixed: orphaned `.claude/skills/android-development` gitlink (no `.gitmodules`)
  that warned on every Vercel clone — de-submoduled (`be21d6a0`).
- **TODO: rotate `JARVIS_API_TOKEN`** — the test value was exposed in-session.



## 2026-09-03 — Obsidian CLI live in cloud sessions

The `obsidian:obsidian-cli` skill is a **client** to a running Obsidian desktop
app — it never reads the vault directly. So making the skill work means running
the app wherever the CLI is used.

- **Cloud session: working, 20/20 checks green.** Obsidian 1.13.7 installed in
  the container, running on `Xvfb :99`, vault cloned to
  `/root/vaults/Obsidian-Vault-` (355 files indexed). `dev:screenshot` produces a
  real PNG, so the GUI layer is genuinely alive headless.
- **Container is ephemeral** — re-run `Scripts/obsidian-cli/bootstrap-obsidian-cli.sh`
  at the start of any session that needs the CLI. Idempotent, cold-start tested.
- **Windows PC: scripted, not executed.** No device bridge from this session.
  `Scripts/obsidian-cli/Setup-ObsidianCli.ps1` reports by default and fixes with
  `-Fix`; its logic is unit-tested (16 tests) but it has not run against a real
  install. The GUI route is Settings → General → Advanced → Command line
  interface, then a **new** terminal.
- **Android/Termux: not possible.** No CLI in the Android build, and Termux
  cannot run the desktop app. Advanced URI / claude-code-bridge / `git` remain
  the route on the Fold. Closed — do not re-investigate.
- **Safety, checked not assumed:** the headless instance loads **no** community
  plugins (Restricted Mode), so `obsidian-git` — `autoPushInterval: 10`,
  `autoPullOnBoot: true` — never started, and the clone stayed 0 commits ahead of
  origin. The bootstrap now asserts this every run and disables risky plugins at
  runtime.

Key mechanics discovered from `obsidian.asar`, recorded so they need not be
re-derived: the CLI toggle is `"cli": true` in `obsidian.json`; the IPC socket is
`$XDG_RUNTIME_DIR/.obsidian-cli.sock` falling back to `$HOME` (the usual cause of
"unable to find Obsidian" in a container); Windows registers by appending the
install dir to the **User** PATH and reaching the CLI through the `Obsidian.com`
redirector.

Docs: `Scripts/obsidian-cli/README.md` · Session: [[sessions/2026-09-03]]



### 2026-09-03, later the same session — Windows PC done and verified

Supersedes the "Windows PC: scripted, not executed" line above. The session
became linked to the PC, so it was completed there rather than handed over.

`Setup-ObsidianCli.ps1` reports **all checks passed** on the PC: Obsidian 1.13.7
at `%LOCALAPPDATA%\Programs\Obsidian`, `cli` enabled, install dir on the user
PATH, `obsidian` resolving to the `Obsidian.com` redirector, and
`obsidian eval` reporting **3001** markdown files in `Jelly Bean's Vault —
primary`. `Test-SetupObsidianCli.ps1` is **33/33 on Windows PowerShell 5.1**.

Running it exposed three defects that parse-checking and unit tests had not:
the wrong install root (`Programs\Obsidian`, not `Obsidian`); a `Join-Path`
null-root crash where `ProgramFiles(x86)` is absent; and — the one that actually
broke something — **PS 5.1 reading `obsidian.json` as ANSI**, which mangled the
em dash in the vault path and left Obsidian unable to find the vault. Repaired
from the backup the script takes before editing, and all three are fixed on
master with regression tests.

Two things this surfaced for the wider estate:

- **PS 5.1 is the only PowerShell on the PC.** It defaults to the ANSI codepage
  for reading *and* writing. Any script here that edits a config file containing
  non-ASCII must force UTF-8 on both sides.
- **The vault open on the PC is not a git repo.** `C:\Users\etblu\Documents\Jelly
  Bean's Vault — primary` is not a working copy of `etblues449/Obsidian-Vault-`,
  which the session protocol treats as the vault. Worth reconciling before any
  automation writes to both. Raised in the capture queue.

