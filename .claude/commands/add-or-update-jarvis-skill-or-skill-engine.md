---
name: add-or-update-jarvis-skill-or-skill-engine
description: Workflow command scaffold for add-or-update-jarvis-skill-or-skill-engine in Obsidian-Vault-.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-or-update-jarvis-skill-or-skill-engine

Use this workflow when working on **add-or-update-jarvis-skill-or-skill-engine** in `Obsidian-Vault-`.

## Goal

Adds or updates a JARVIS skill, skill engine, or related workflow automation. Typically involves workflow YAMLs, runner scripts, skill docs, and test updates.

## Common Files

- `.github/workflows/jarvis-1-morning-brief.yml`
- `.github/workflows/jarvis-2-capture-router.yml`
- `.github/workflows/jarvis-3-connection-finder.yml`
- `.github/workflows/jarvis-4-weekly-synthesis.yml`
- `.github/workflows/jarvis-6-pattern-detector.yml`
- `.github/workflows/_jarvis-run-skill.yml`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit or add .github/workflows/jarvis-*-*.yml (one per skill or engine)
- Edit or add Assistant Core/jarvis-skills/runner.mjs
- Update Assistant Core/jarvis-skills/README.md and/or MIGRATION.md
- Edit or add Assistant Core/jarvis-skills/test/local-test.mjs
- Update or create skill documentation in .claude/skills/*/SKILL.md

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.