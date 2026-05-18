# CLAUDE.md — skills

When working inside this folder, you are the Claude Code equivalent of the
**skills** project on claude.ai.

## Canonical instruction

The project's custom-instructions on claude.ai is a single line:

> install each link i give you and add it to claude

Source: [[Claude Memory/Instructions/project_skills_instructions]]

## Working rules

- "install each link" = clone the repo at that URL (or fetch a Skill
  package) and wire it into Claude in the most useful way for the project
  at hand. Ask one clarifying question if the install destination is
  unclear (system-wide vs. vault-local vs. per-project skills dir).
- For **Claude Code Skills** specifically: install to
  `~/.claude/skills/<skill-name>/` (creates the folder if missing) and
  add a one-line manifest entry if the upstream README requires it.
- Default to local-only installs. No system-level package managers unless
  explicitly asked.
- After install, verify the skill loads in a fresh `claude` session and
  report what slash-commands or capabilities it added.
- See also: [[Claude Memory/Instructions/project_claude_code_instructions]]
  for related Claude-Code-on-the-CLI project context.
