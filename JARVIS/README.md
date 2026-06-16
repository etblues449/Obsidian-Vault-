# JARVIS — Obsidian-Native

Your vault is the brain. Capture anything in one tap; Claude classifies it and
routes it — to a note, or to your smart home — all from inside Obsidian. No
Termux, no PC server, no tunnel.

- **What it is & why:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **How to install:** [SETUP.md](SETUP.md)

---

## Daily use

| You want to… | Do this |
|---|---|
| **Capture a thought/task/idea** | Tap the JARVIS shortcut → type or **dictate** → done. Filed + tagged automatically. |
| **Control the house** | Tap JARVIS → "turn off the bedroom light" → it fires. |
| **Ask about your vault** | Run **JARVIS Ask** (quick), or open **Smart Connections** chat (deep). |
| **See everything** | Open **JARVIS Dashboard** (tasks, captures, by project). |
| **Morning briefing** | Tap **JARVIS Digest** → summary lands in today's Journal note. |

Capture flow:

```
"call mom tomorrow"
   ↓  Claude (claude-opus-4-8, structured output)
kind=task, title="Call mom", project=General, tags=[reminder]
   ↓
Inbox/task_20260616-0320-call-mom.md   +   ✓ notice
   ↓
Obsidian Sync → every device
```

---

## The pieces

| File | Role |
|---|---|
| `scripts/jarvis.js` | Capture brain — classify & route (note or Home Assistant) |
| `scripts/jarvis_setup.js` | One-time secret setup (per device, device-local) |
| `scripts/jarvis_digest.js` | Daily briefing → `Journal/` |
| `scripts/jarvis_ask.js` | Quick grounded Q&A → `JARVIS/Chat.md` |
| `dashboards/JARVIS Dashboard.md` | Live Dataview home base |

## Configure

Almost everything lives in the `CONFIG` block at the top of `scripts/jarvis.js`:
the model, where each kind of capture is filed, your project list, and the
Home Assistant entities JARVIS may control. Edit it freely.

## Secrets

API key + HA token live in **device-local storage**, set once per device via
**JARVIS Setup**. They never touch the vault, never sync, never get committed.

## Privacy / safety

- Voice is the phone keyboard's own dictation — no cloud STT.
- HA control is LAN-only and allow-listed to the entities you name.
- Sensitive notes are never auto-exported; JARVIS only writes new captures.

---

*v3 — Obsidian-native. The Termux build (`../phone/`) is archived; see its
`_ARCHIVED.md`.*
