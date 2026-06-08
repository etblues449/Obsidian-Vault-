# Phone Setup — Samsung Fold 7

Goal: one tap or one voice command from the homescreen → captured in the vault → routed automatically.

## Two layers

1. **Obsidian Quick Capture** — the safety net. Always works offline. Tap widget, type, saved.
2. **Tasker + n8n webhook** — the Jarvis voice path. Speak, classified, routed in real time.

Both should be installed. Quick Capture is fallback if n8n/PC is down.

## Layer 1: Obsidian Quick Capture (Day 1)

### Install
1. Play Store → Obsidian Mobile
2. Open app → Open existing vault → point to your synced vault folder
3. Settings → Community plugins → Turn on → Browse → search **"Quick Capture"** by liamcain (or similar)
4. Install + Enable

### Configure
- Open Quick Capture settings
- Set **Capture file**: `Inbox/quick-capture.md`
- Set **Append template**:
  ```
  
  - {{date:YYYY-MM-DD HH:mm}} :: {{text}}
  ```
- Set **Open after capture**: OFF (you want it to vanish back to homescreen)

### Widget
- Long-press Fold 7 homescreen → Widgets → Obsidian
- Drag **Quick Capture** to the homescreen (any size — 1×1 is enough for a button)
- Place it where your thumb naturally lands (right side of the cover screen for fast capture)
- Optional: also add to the unfolded inner screen at the same position

### Test
- Tap widget → small input appears → type "first jarvis test" → submit
- Open vault, confirm `Inbox/quick-capture.md` has the line

## Layer 2: Tasker + Voice (Day 2)

### Install
- Play Store → **Tasker** (paid, ~$3)
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
