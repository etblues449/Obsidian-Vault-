# Phone Setup — Samsung Fold 7

Goal: one tap or one voice command from the homescreen → captured in the vault → routed automatically.

## Two layers

1. **PRIMARY — HTTP Shortcuts / Tasker → n8n webhook.** The Jarvis path: one tap or voice → silent POST → classified + routed in real time. No app opens, syncs instantly (n8n writes vault-side).
2. **FALLBACK — Obsidian QuickAdd capture.** Works offline (PC/n8n down, off LAN). Lands raw text in `Inbox/`, drained later by `scripts/process-inbox.sh`.

Build the fallback first (Day 1) so you can always capture; the primary path comes online Day 2-3.

### ⚠️ Verified constraint (researched 2026-06-08)
- **No native Obsidian Android widget can trigger a command, QuickAdd choice, or URI.** As of Obsidian Mobile 1.11.0 the only widgets are Open Note, New Note, Search, Daily Note, Open Obsidian — none can fire QuickAdd. (This is why the "command widget" we looked for doesn't exist — it's a real limitation, not a setup error.)
- **Obsidian Sync only runs while the app is foregrounded.** Any capture that writes into the vault without opening the app won't reach your other devices until you next open Obsidian. The HTTP-POST-to-n8n path sidesteps this entirely.

## Layer 1 (Fallback): Obsidian QuickAdd capture (Day 1)

### Install
1. Play Store → Obsidian Mobile → open your synced vault
2. Settings → Community plugins → Turn on → Browse → install **QuickAdd** and **Advanced URI**, Enable both

### Configure the QuickAdd Capture choice
1. QuickAdd settings → **Add Choice** → name `Jarvis Capture` → type **Capture**
2. Gear ⚙ on the choice:
   - **Capture To / File path:** `Inbox/quick-capture.md`
   - **Create file if it doesn't exist:** ON
   - **Write position:** Bottom of file
   - **Capture format:** ON →
     ```
     - {{DATE:YYYY-MM-DD HH:mm}} :: {{VALUE}}
     ```
3. Toggle the **⚡ lightning bolt** next to the choice (registers it as a command — required for the URI to find it)

### One-tap homescreen launch (since no widget can call QuickAdd)
1. Command palette → **Advanced URI: Copy URI for command** → pick `QuickAdd: Jarvis Capture`. You get:
   `obsidian://advanced-uri?vault=<Vault>&commandid=quickadd%3Achoice%3A<UUID>`
2. Install **Shortcut Maker** (by Rushikesh Kamewar, free) → New shortcut → Action `android.intent.action.VIEW` → **Data** = that URI → label "📥 Jarvis" + icon → **Add to homescreen**.
3. (Alternative, pops a text box and appends directly: **MacroDroid** with a "Write to file → Append" action.)

### Test
- Tap the "📥 Jarvis" icon → Obsidian opens to the QuickAdd prompt → type "first jarvis test" → submit
- Confirm the line appears at the bottom of `Inbox/quick-capture.md`

> Note: this opens Obsidian (unavoidable on Android) and syncs when the app foregrounds — fine for a fallback. The frictionless path is Layer 2.

## Layer 2 (Primary): one-tap / voice → n8n webhook (Day 2)

Two app choices — pick one:
- **HTTP Shortcuts** (Waboodoo, free/FOSS) — lightest option for pure one-tap webhook capture. Homescreen widgets, quick-settings tiles, can run JS pre/post (timestamps, UUIDs). Best if you mostly want a tap-to-send button.
- **Tasker** (paid, ~$3) — heavier but does voice capture + deep automation chaining. Best for the hands-free voice path below.

You can use both: HTTP Shortcuts for tap-to-type, Tasker for voice.

### Tasker install
- Play Store → **Tasker**
- Open → grant accessibility, notification, mic permissions

### Create the task
1. Tasks tab → **+** → Name: `Jarvis Voice`
2. Add Action → **Input → Get Voice** → leave defaults (timeout 30s)
3. Add Action → **Net → HTTP Request**
   - Method: `POST`
   - URL: `http://192.168.0.X:5678/webhook/jarvis-capture` (your PC's LAN IP, port from n8n)
   - Headers: `Content-Type: application/json`
   - Body: `{"text": "%VOICE", "source": "tasker-voice", "ts": "%TIMES"}`
4. Add Action → **Alert → Flash** → Text: `Jarvis: captured`

### Bind to a quick launcher
Pick the one you'll actually use:

- **Power-button double-press** — Settings → Advanced features → Side key → Double press → Open app → Tasker shortcut (`Jarvis Voice`)
- **Bixby button replacement** (if your One UI build allows it)
- **Quick tile** — Tasker → Settings → Quick Settings → add `Jarvis Voice`
- **Edge panel button** — One UI Edge panel → Apps panel → add Tasker shortcut
- **Homescreen icon** — drop a Tasker shortcut on the homescreen next to the Quick Capture widget

### Test
- Trigger the task → speak "video idea Spotify playlist analysis" → wait
- Check n8n executions tab → confirm webhook fired with your text

### Hands-free voice trigger (the true "Jarvis" feel)
Front the Tasker task with a voice phrase so you never touch the screen:
- Tasker → Profiles → **Event → Assistant Action** → so you can say **"OK Google, run *Jarvis capture* in Tasker"** → it runs the `Jarvis Voice` task → `Get Voice` → POST.
- **Verified caveats:** Assistant Action is **US-English only**; Google sometimes misroutes (use a distinctive task name like "Jarvis capture"); and the Assistant→Gemini migration (ongoing through 2026) may change this — **re-test after Gemini updates**. If it breaks, fall back to the power-button double-press binding above (unaffected by the migration).
- **Dead ends (verified):** Gemini and Bixby **cannot** write to Obsidian or hit a webhook directly — only Keep/Reminder. Bixby Quick Commands was removed in 2025. Use them only as triggers via Tasker.

### Voice transcription
- Built-in `Get Voice` (~90-93% on clear speech, free) is fine for short captures.
- For long/noisy dictation, escalate to Whisper: Tasker records audio → POST file to n8n → n8n calls OpenAI transcription (~$0.003-0.006/min). Let the n8n Claude node clean up obvious errors either way.

## Why both layers

Quick Capture saves you when:
- n8n is down (PC off, restarting)
- LAN is unreachable (you're out of the house)
- The classifier mis-routes and you want to dump raw text

The inbox drain (`scripts/process-inbox.sh` from Claude Code) catches up later — items always end up in the right place eventually.

## Common gotchas

- **Vault sync conflicts**: don't open the same file on PC and phone simultaneously. Obsidian Sync handles it, but be aware.
- **Tasker on battery optimisation**: Settings → Apps → Tasker → Battery → Unrestricted. Otherwise voice intents get killed.
- **n8n LAN URL**: if your PC IP changes, update Tasker. Pin a DHCP reservation in your router for the PC.
- **HTTPS not needed on LAN**: but if you ever expose n8n externally, put it behind Caddy/nginx with TLS first.
