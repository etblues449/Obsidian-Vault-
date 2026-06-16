# 2026-06-16 SESSION — JARVIS v3: Obsidian-Native Pivot

**Outcome:** Re-architected JARVIS around Obsidian as the brain (not Termux). Full build committed; ready to install on Fold 7.

---

## The decision

Elliot reviewed the prior Phase-0/1 capture pipeline (Tasker → n8n.cloud →
GitHub → Obsidian Sync) and the Termux/bash build, and set the real goal:
**"I want Obsidian to be the heart, soul and brain — not Termux as the focal
point."** Four directional choices (all the recommended option):

1. **Brain:** native Obsidian — Templater/QuickAdd user scripts call the Claude
   API in-app; Smart Connections for vault-wide chat. No external server.
2. **Termux:** retired from the daily loop (archived, not deleted).
3. **Scope:** Smart Home + capture core first, architected to extend.
4. **Sync:** Obsidian Sync primary + Git backup.

## What was built (`Claude Memory/Skills/jarvis/obsidian/`)

- **scripts/jarvis.js** — capture brain. Claude (`claude-opus-4-8`) classifies
  text via **structured outputs** (JSON schema) → routes to a vault note or a
  Home Assistant REST call. Allow-listed HA entities; never guesses an entity.
- **scripts/jarvis_setup.js** — one-time per-device secret setup into
  `localStorage` (API key, HA URL, HA token) — never written to the vault.
- **scripts/jarvis_digest.js** — last-24h Inbox → Claude summary → `Journal/`.
- **scripts/jarvis_ask.js** — quick grounded Q&A → `JARVIS/Chat.md`.
- **dashboards/JARVIS Dashboard.md** — Dataview home base.
- **ARCHITECTURE.md / SETUP.md / README.md** — design, install, daily use.

All scripts use Obsidian's `requestUrl` (CORS-free, works on Android), are
self-contained (no fragile cross-module require on mobile), and read a single
`CONFIG` block at the top of `jarvis.js`.

## Key technical decisions

- `claude-opus-4-8` default brain; `model` knob exposed to drop the classifier
  to Haiku for cents/capture if desired.
- Structured outputs (`output_config.format`) → routing can't break on bad JSON.
- Secrets in device-local storage, set once per device — honors vault secrets rule.
- Capture entry point = Advanced URI → QuickAdd (the primitive Elliot already
  used); phone-keyboard mic = local voice, no cloud STT.

## Retired

- Termux/bash v1/v2 → `_ARCHIVED.md` added; kept as emergency CLI only.
- n8n.cloud + Tasker + localtunnel pipeline → superseded (no tunnel/PC dep).

## Next actions

- [ ] Install on Fold 7 per `obsidian/SETUP.md` (plugins → scripts folder →
      QuickAdd macros/choices → Advanced URI shortcut → JARVIS Setup secrets →
      HA entities → smoke test).
- [ ] Repeat secret setup on PC.
- [ ] (Optional) Auto-digest via Templater folder template on `Journal/`.
- [ ] Extend routing to Faceless Finance / Doc to Learning when ready.

## References

- Code + docs: `Claude Memory/Skills/jarvis/obsidian/`
- Archived: `Claude Memory/Skills/jarvis/phone/_ARCHIVED.md`
- Prior session: [[sessions/2026-06-16-PHONE_DEPLOYMENT]]
