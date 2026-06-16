# ⚠️ ARCHIVED — Termux/bash JARVIS (v1/v2)

**Status:** Retired from the daily loop on 2026-06-16. **Not deleted** — kept as
an emergency CLI only.

## Why

JARVIS moved to an **Obsidian-native** architecture. The intelligence now runs
*inside* Obsidian (QuickAdd user scripts calling the Claude API), with the vault
as the brain — no Termux focal point, no PC server, no tunnel.

➡️ **Current system:** `/JARVIS/` — start with `JARVIS/README.md` and
`JARVIS/ARCHITECTURE.md`.

## What's in this folder

The v1/v2 bash scripts (`jarvis.sh`, `ha-call.sh`, `sync.sh`, `digest.sh`,
`install.sh`, wake word, backup, Ollama, keystore) remain here for reference and
as a fallback terminal toolkit. They are **no longer the daily driver** and are
not maintained. Do not wire new shortcuts to them.

If you ever need a pure-CLI capture in a pinch, `jarvis.sh` still works — but the
Obsidian flow is the supported path.
