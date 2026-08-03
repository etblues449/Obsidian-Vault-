---
name: smart-home-project-diagnostics-and-dashboard-update
description: Workflow command scaffold for smart-home-project-diagnostics-and-dashboard-update in Obsidian-Vault-.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /smart-home-project-diagnostics-and-dashboard-update

Use this workflow when working on **smart-home-project-diagnostics-and-dashboard-update** in `Obsidian-Vault-`.

## Goal

Iterative updates to the Smart Home project: running diagnostics, updating dashboards, hardware guides, and master plans based on live evidence.

## Common Files

- `Assistant Core/ha-diagnostics/ha-doctor.mjs`
- `Assistant Core/ha-diagnostics/README.md`
- `Claude Memory/Projects/Smart Home/diagnostics/*.md`
- `Claude Memory/Projects/Smart Home/dashboard/*.yaml`
- `Claude Memory/Projects/Smart Home/dashboard/README.md`
- `Claude Memory/Projects/Smart Home/dashboard/jellybean-dashboard-v2-corrected.yaml`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Run or update diagnostic scripts (Assistant Core/ha-diagnostics/ha-doctor.mjs)
- Update or create diagnostic output files (Claude Memory/Projects/Smart Home/diagnostics/*.md)
- Edit or update dashboard YAMLs (jellybean-dashboard*.yaml, theme.yaml)
- Update master plan and index (_index.md, MASTER_PLAN.md)
- Update or add hardware guides (hardware/*.md, hardware/*.yaml)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.