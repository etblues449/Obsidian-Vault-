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
