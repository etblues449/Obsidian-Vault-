# Doc to Learning — Project Index

> Seeded 2026-07-27 during the harness build. This file did not exist, but
> `Assistant Core/jarvis-skills/runner.mjs` reads it for Connection Finder (Skill 3) and
> Weekly Synthesis (Skill 4). Only sourced facts below.

## Goal

A single-file HTML application that converts a document into a learning experience,
built on the Anthropic API.

## Status

- Single-file HTML architecture (no build step, no server).
- Uses the Anthropic API directly from the client.
- <!-- TO FILL — deployment location, current feature state, whether it is in use -->

## Key Decisions

- **Single-file HTML.** No build pipeline; the artefact is the deliverable.
- <!-- TO FILL — model choice, key handling (must not be committed), storage approach -->

## Open risks

- Client-side API key handling. Keys must never be committed to this repo — device-local
  storage only, consistent with the JARVIS v3 secrets approach.

## Next Actions

- [ ] <!-- TO FILL -->

Sessions: *(none yet — add as `sessions/YYYY-MM-DD.md`)*
