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

