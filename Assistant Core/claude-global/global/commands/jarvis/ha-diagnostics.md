---
name: ha-diagnostics
description: Run the Home Assistant diagnosis and propagate what it finds into dashboards, indexes and the queue.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Skill
argument-hint: "[optional focus, e.g. 'voice satellites' or 'entity registry']"
---

# /jarvis:ha-diagnostics

Diagnose the Home Assistant estate and propagate the findings: $ARGUMENTS

Load `jarvis-vault-access` first. The hub is the HA Green at `192.168.0.200`; from outside the
LAN, `ha-doctor` runs in remote mode via Nabu Casa and **skips** the direct node probes rather
than reporting them as down. Do not let a skipped probe become a "node offline" claim.

## Sequence

1. **Run the doctor** — `Assistant Core/ha-diagnostics/ha-doctor.mjs`, read-only and
   zero-dependency. Template, error-log and `check_config` sections need an **admin** long-lived
   token; without one, say which sections did not run rather than reporting them clean.
2. **Write the report** to `Claude Memory/Projects/Smart Home/diagnostics/YYYY-MM-DD-ha-doctor.md`.
3. **Diff against the last report** in that folder. The valuable output is what *changed* —
   newly unavailable entities, satellites that dropped off, a rename that broke a reference.
4. **Propagate every canonical decision.** A settled entity ID or area name has to reach the
   dashboard YAML, `Claude Memory/Projects/Smart Home/_index.md` and `ha-doctor.mjs` itself.
   Leaving one behind is what produced the stale `media_player.jelly_beans_tv_2` references.
5. **File the follow-ups** in `Claude Memory/Account/capture_queue.md`, and record decisions in
   the Smart Home index under Key Decisions with the date and the evidence they rest on.

## Guardrails

- The live registry wins over any vault record. When they disagree, fix the vault and say so.
- An unavailable entity is not a dead device — check whether the node is powered before
  proposing a reflash.
- Never write a long-lived token into a note. Reference it by name.
