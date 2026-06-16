# JARVIS (Obsidian-Native) — Setup

One-time setup, ~15 minutes. Do it on the Fold 7 first, then repeat **step 5
only** (secrets) on the PC.

---

## 1. Install community plugins

Settings → Community plugins → Browse, install + enable:

| Plugin | Role |
|---|---|
| **QuickAdd** | Runs the JARVIS scripts; the capture entry point |
| **Advanced URI** | Lets the home-screen shortcut trigger QuickAdd |
| **Dataview** | Powers the JARVIS Dashboard |
| **Smart Connections** *(optional)* | Deep semantic chat over the whole vault |
| **Templater** *(optional)* | Auto-run the digest on daily-note creation |

> You already have several of these. Just confirm they're enabled.

---

## 2. Tell QuickAdd where the scripts live

The four scripts are in `JARVIS/scripts/`.

QuickAdd needs a **user-scripts folder**. Either:
- Point QuickAdd at that folder directly: Settings → QuickAdd → *(top)* set the
  scripts folder to `JARVIS/scripts`, **or**
- If QuickAdd's scripts folder is elsewhere, copy the four `.js` files into it.

Files: `jarvis.js`, `jarvis_setup.js`, `jarvis_digest.js`, `jarvis_ask.js`.

---

## 3. Create QuickAdd Macros + Choices

For each script, add a **Macro** with a single **User Script** step, then a
**Macro choice** that runs it. In QuickAdd settings:

1. **Manage Macros** → add macro `JARVIS Capture` → add User Script step →
   select `jarvis.js`. Repeat for:
   - `JARVIS Setup` → `jarvis_setup.js`
   - `JARVIS Digest` → `jarvis_digest.js`
   - `JARVIS Ask` → `jarvis_ask.js`
2. Back on the main QuickAdd screen, **Add Choice** (type: *Macro*) for each,
   named the same, and bind it to its macro.
3. Toggle the ⚡ (command) icon on each choice so it gets a command-palette
   command (needed for hotkeys + Advanced URI).

---

## 4. Home-screen one-tap (Advanced URI)

This is the primitive your old shortcut already used. Create a shortcut /
home-screen icon that opens:

```
obsidian://advanced-uri?vault=Obsidian%20Vault&commandid=quickadd%3Achoice%3A<JARVIS_CAPTURE_CHOICE_ID>
```

Get the exact URI the easy way: QuickAdd → the JARVIS Capture choice → **⋯ →
copy Advanced URI**, then drop it into your launcher / Termux:Widget /
Shortcuts. Tapping it opens the capture prompt — type or **tap the keyboard mic
to dictate** (local voice, no cloud STT).

Make similar shortcuts for Ask and Digest if you want them one-tap too.

---

## 5. Secrets (run once per device)

Run the **JARVIS Setup** command (Cmd/Ctrl-P → "JARVIS Setup", or its choice).
Paste when prompted:

- **Anthropic API key** — `sk-ant-...`
- **Home Assistant URL** — `http://192.168.0.200:8123`
- **Home Assistant token** — long-lived token (HA → Profile → Security)

These are stored in this device's local storage only — never written to the
vault, never synced, never committed. Repeat on each device.

---

## 6. Configure HA entities (once)

Open `JARVIS/scripts/jarvis.js`, edit `CONFIG.haEntities` to list the real entities
JARVIS may control. Anything not listed is treated as a note, never guessed.

---

## 7. Smoke test

1. Run **JARVIS Capture** → type `remind me to buy milk` → expect a notice
   *"JARVIS ✓ Task: Buy milk"* and a new file in `JARVIS/Inbox/`.
2. Run it again → `turn on the lounge lights` → expect *"JARVIS ✓ light.turn_on
   → light.lounge_main"* and the light comes on.
3. Open **JARVIS Dashboard** → the capture appears under Recent Captures.
4. Run **JARVIS Digest** → a briefing lands in `Journal/YYYY-MM-DD.md`.

---

## 8. (Optional) Auto-digest like a cron

Obsidian has no native scheduler. The native-feeling equivalent: Templater →
**folder template** on `Journal/` that runs the digest when the daily note is
created. Or just tap the **JARVIS Digest** shortcut each morning.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "no API key" notice | Run **JARVIS Setup** on this device |
| HA error / nothing happens | Check HA URL + token in Setup; confirm entity is in `CONFIG.haEntities`; you're on the LAN |
| Capture saved but wrong kind | The model classified it — rephrase, or tune the system prompt in `jarvis.js` |
| Dashboard empty | Enable Dataview; captures need the frontmatter `jarvis.js` writes |
| Script not found in QuickAdd | Point QuickAdd's scripts folder at `JARVIS/scripts/` (step 2) |
| "Cannot destructure … require(…)" / "window.require is not a function" | Old script version. The scripts must use `params.obsidian` (not `require("obsidian")`) — there is no `require` on mobile. Pull latest from Git. |
