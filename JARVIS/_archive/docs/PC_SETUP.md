# PC Setup — Day 2/3 Windows Checklist

Stand up the **always-on Windows brain** for Jarvis: n8n (workflow engine) + Obsidian Local REST API (vault write path). The Capture Router workflow runs here; phone POSTs in over LAN; routed notes appear in the vault and Obsidian Sync fans them out everywhere.

> **Run order:** §1 → §2 → §3 (script) → §4 → §5 → §6 → §7 (test) → §8 (firewall, optional now) → §9 (auto-start). Verified **2026-06-08** against current docs.

---

## 1. Prereqs

- Windows 10/11 PC on your LAN, ideally always-on (this becomes a single point of failure — see §10).
- Desktop Obsidian with **your primary vault** open and syncing via Obsidian Sync. The vault folder name on disk should be the same one you've been using on the phone (the path on this PC will be e.g. `C:\Users\<you>\Documents\Obsidian Vault\`).
- An Anthropic API key (you'll paste it as `ANTHROPIC_KEY`).
- A Home Assistant **long-lived access token** (HA → your profile → Security → Long-lived access tokens → Create).
- Router admin access (for the DHCP reservation in §9). Not strictly required for the smoke test — captures work fine without it tonight; do it within a week.

---

## 2. Install Docker Desktop

Why Docker over `npx n8n` or n8n Desktop: containerised n8n is the path the official n8n docs recommend for an always-on personal box. `--restart unless-stopped` survives reboots/crashes; the named volume keeps your workflows + credentials + encryption key across upgrades. n8n Desktop is a Beta and lags features; `npx n8n` doesn't survive a logoff cleanly.

1. Download **Docker Desktop for Windows** → https://docs.docker.com/desktop/install/windows-install/
2. Run installer, accept WSL2 backend (default), reboot.
3. Open Docker Desktop once → wait for the whale icon to go steady → **Settings → General → tick "Start Docker Desktop when you sign in to your computer"**.

Sanity check (PowerShell):
```powershell
docker --version
docker info
```
Both should succeed without errors. If `docker info` fails, the engine isn't running — open Docker Desktop again.

---

## 3. Run the setup script

Open PowerShell, change to the vault, and run:

```powershell
cd "C:\Users\<you>\Documents\<your vault>"
.\Claude Memory\Skills\jarvis\scripts\day2-windows-setup.ps1
```

The script (`scripts/day2-windows-setup.ps1`) is idempotent and deliberately conservative:

- ✅ Checks Docker is installed + the engine is running.
- ✅ Creates (once) the named volume `n8n_data` for persistent workflows/credentials.
- ✅ Pulls `docker.n8n.io/n8nio/n8n` and runs `n8n` detached with `--restart unless-stopped` on port `5678`.
- ✅ Prints this PC's LAN IPv4 (skipping Docker/WSL/Hyper-V virtual switches).
- ✅ Prints the next manual steps (this doc, in PowerShell).
- ❌ Does **not** touch the firewall, Obsidian config, or n8n credentials — those need a GUI or admin shell, so the script prints the exact commands for you to run knowingly.

Re-running is safe: if the container exists and is running, it leaves it alone; if stopped, it starts it. Pass `-Recreate` to rebuild (your workflows + creds are preserved in the volume).

Optional flags: `-Port 5678`, `-VolumeName n8n_data`, `-ContainerName n8n`, `-LanCidr 192.168.0.0/24`, `-TimeZone Europe/London` (change to yours — wrong TZ = Schedule nodes fire at the wrong hour), `-Recreate`.

When the script finishes, n8n is reachable at **http://localhost:5678** and at **http://<PC-LAN-IP>:5678** (once firewall is opened in §8).

---

## 4. Set up the n8n owner account

1. Browser → http://localhost:5678
2. First load: create the owner account (email + password). This account encrypts your credentials — write the password down.
3. You'll land in the n8n editor.

---

## 5. Obsidian Local REST API plugin (this PC)

This is the **write path** — n8n POSTs to this plugin running inside desktop Obsidian, which writes to your vault, which Obsidian Sync fans out to every device. (Verified recommendation in `N8N_WORKFLOWS.md`: this is preferred over the GitHub node and the Filesystem node.)

1. Desktop Obsidian → **Settings → Community plugins → Browse** → search **"Local REST API"** by **coddingtonbear** → Install → Enable.
2. **Settings → Local REST API**:
   - **Copy the API key** (long random string) — this is `OBSIDIAN_REST_TOKEN`.
   - **HTTPS port** stays `27124` (self-signed cert). HTTP `27123` is OFF by default.
   - **Change "Binding host" / bind address from `127.0.0.1` to `0.0.0.0`** so n8n-in-Docker (and other LAN machines if you want) can reach it.
3. **Keep desktop Obsidian running** with the vault open. If Obsidian is closed, vault writes fail. Auto-start config in §9.

Smoke test from this PC (the `-k` accepts the self-signed cert):
```powershell
curl.exe -k -H "Authorization: Bearer <OBSIDIAN_REST_TOKEN>" https://127.0.0.1:27124/vault/
```
Expect a JSON listing of vault contents. If it 401s, your token is wrong; if it refuses connection, plugin isn't enabled or you didn't change the bind address.

---

## 6. n8n environment variables

In the n8n editor → **Settings → Variables** (or set as container env vars on next `-Recreate`), add:

| Variable | Value | Notes |
|---|---|---|
| `ANTHROPIC_KEY` | `sk-ant-...` | Your Anthropic API key. |
| `HA_URL` | `http://192.168.0.50:8123` | Your HA Green. |
| `HA_TOKEN` | `<HA long-lived token>` | From HA → your profile → Security. |
| `OBSIDIAN_REST_URL` | `https://host.docker.internal:27124` | **Critical**: `host.docker.internal` from inside the n8n container = THIS PC. Do **not** use `localhost` (that's the container itself). |
| `OBSIDIAN_REST_TOKEN` | `<from §5 step 2>` | Bearer token. |

Save. The workflow's HTTP nodes already reference these as `{{ $env.<NAME> }}`.

---

## 7. Import + activate the Capture Router workflow

1. n8n editor → **Workflows** → **⋯** menu → **Import from File**.
2. Pick `Claude Memory/Skills/jarvis/resources/n8n-capture-router.json` (the validated version — node params were verified against current schemas via the n8n MCP).
3. The workflow loads with seven nodes: Webhook → Classify (Claude) → Parse → Switch → [Call HA | Append to Vault] → Confirm. Node versions are pinned (webhook 2.1, httpRequest 4.4, code 2, switch 3.4, respondToWebhook 1.5).
4. **Toggle Active** (top-right). This registers the public webhook URL.
5. Click the **Webhook** node → copy the **Production URL** — it will look like `http://<your-PC>:5678/webhook/jarvis-capture`. This is what the phone POSTs to.

### End-to-end smoke test

From PowerShell on this PC:
```powershell
$body = '{"text":"note: jarvis end to end test","source":"setup","ts":"2026-06-08T12:00:00Z"}'
curl.exe -X POST "http://localhost:5678/webhook/jarvis-capture" `
  -H "Content-Type: application/json" `
  -d $body
```
Expect: `{"ok":true,"routed_to":"...","type":"..."}` and a new line appended to a vault file (`Inbox/quick-capture.md` if the classifier wasn't sure, or a project file if it was). Open Obsidian — the line should be there within a second.

From your phone (still on the same Wi-Fi), in any HTTP client (or test via the icon path later):
```
POST http://<PC-LAN-IP>:5678/webhook/jarvis-capture
Content-Type: application/json
{"text":"note: phone reached n8n","source":"phone","ts":"..."}
```

If both work, the pipeline is live.

---

## 8. Firewall — LAN only (open it for phone access)

Until you open the firewall, **only this PC** can POST to n8n. To let the phone in, paste these in an **elevated** PowerShell (Run as administrator):

```powershell
New-NetFirewallRule -DisplayName "Jarvis n8n (5678) LAN" `
  -Direction Inbound -Protocol TCP -LocalPort 5678 `
  -RemoteAddress 192.168.0.0/24 -Action Allow -Profile Private
```

Optional — only if you want to hit the Obsidian REST API from OTHER LAN machines (n8n-in-Docker reaches it via loopback through `host.docker.internal` and does **not** need this rule):
```powershell
New-NetFirewallRule -DisplayName "Jarvis Obsidian REST (27124) LAN" `
  -Direction Inbound -Protocol TCP -LocalPort 27124 `
  -RemoteAddress 192.168.0.0/24 -Action Allow -Profile Private
```

Notes:
- `-Profile Private` assumes your home network is classified Private. Check: `Get-NetConnectionProfile`. If it says Public, switch it to Private in Settings → Network, or add `-Profile Public` (less safe).
- Remove later: `Remove-NetFirewallRule -DisplayName "Jarvis n8n (5678) LAN"`.

---

## 9. DHCP reservation + auto-start

**DHCP reservation** (so the PC's LAN IP never moves):
- Find the PC's MAC: `ipconfig /all` → look under your Wi-Fi/Ethernet adapter → "Physical Address".
- Router admin page → **DHCP** → **Address reservation / Static lease** → pin the current IP to that MAC. Different routers, same concept (TP-Link calls it "Address Reservation", ASUS "Manually Assigned IP", BT/Sky/Virgin "Reserved IP").
- Reboot the PC; confirm it still gets the same IP.

**Auto-start checklist** (single point of failure mitigation — §10):
- Docker Desktop: Settings → General → **"Start Docker Desktop when you sign in"** (set in §2).
- n8n container: already has `--restart unless-stopped`, returns whenever Docker engine starts. No action.
- Obsidian: must be running for vault writes. Either (a) `Win+R → shell:startup` → paste an Obsidian shortcut, **or** (b) install the **Obsidian Tray** community plugin and enable "Launch on system startup".
- Auto-login (optional): Docker Desktop on Windows only starts *after* a user logs in. For a personal always-on PC, enabling auto-login is the pragmatic path; if not, your captures pile up on the phone until you log in.

---

## 10. Single point of failure — and the mitigation

If **this PC** is off, OR **Docker Desktop** isn't running, OR **n8n** is stopped, OR **desktop Obsidian** is closed — the vault write fails. Captures from the phone error.

Two mitigations work together:

1. **Phone offline fallback** (already live): the homescreen icon writes to `Inbox/quick-capture.md` via QuickAdd locally, syncs through Obsidian Sync. Use when n8n is unreachable. No classification, you triage later with `bash "Claude Memory/Skills/jarvis/scripts/process-inbox.sh"`.
2. **Filesystem-node fallback inside the workflow** (todo — wire after first successful test): on the **error output** of the "Append to Vault (Local REST API)" node, add a **Read/Write Files from Disk** node that writes the same line to the synced vault folder on this PC's disk. When desktop Obsidian comes back, it picks up the externally-written file on next scan. Add only after the happy path works — premature fallback masks real bugs.

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `curl` to webhook → connection refused | n8n container down or wrong port | `docker ps` — is `n8n` running? `docker logs n8n --tail 100`. Re-run the setup script. |
| Webhook returns 500, n8n execution shows the Classify node failed | Bad `ANTHROPIC_KEY` or model id outdated | Check env var. Edit the Classify node body → swap the model id for the current Anthropic model. |
| `Append to Vault` node fails with `ECONNREFUSED` | n8n can't reach Obsidian on this PC | The URL must use `host.docker.internal`, not `localhost`. Re-check `OBSIDIAN_REST_URL`. |
| `Append to Vault` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | Self-signed cert rejected | The node already has `allowUnauthorizedCerts: true`. If you re-created the node by hand, re-enable that option, **or** switch the URL to `http://host.docker.internal:27123` and enable HTTP in the plugin. |
| `Append to Vault` returns 404 | The destination path doesn't exist yet | Local REST API needs the folder to exist. Create the parent folder in Obsidian; the plugin will create the file. (`Inbox/quick-capture.md` already exists.) |
| `Append to Vault` returns 401 | Wrong/missing `OBSIDIAN_REST_TOKEN` | Recopy from Obsidian → Settings → Local REST API. |
| Phone POST works locally but not from cell data | Expected — n8n is LAN-only by design | Tunnel later via Tailscale or Cloudflare Tunnel if you want remote captures. Out of scope for Day 2/3. |
| Phone POST times out on Wi-Fi | Firewall not opened (§8) or PC IP changed | Open firewall; confirm `<PC-LAN-IP>` is current with `ipconfig`; pin via DHCP reservation. |
| Classifier returns inbox/0 for everything | Anthropic API returned an error or unexpected shape | Open the execution → inspect the Classify node output → fix the API call. The Parse node is permissive: anything it can't parse becomes `inbox` so you don't lose data. |

---

## 12. What's next (Day 4 — live house control)

The capture pipeline above is for *captured* commands ("remind me to defrost the freezer", "turn off the lounge light at 11pm tomorrow"). The **live**, talk-to-the-house path is separate — HA Assist + an LLM agent. See **`HA_ASSIST_SETUP.md`** in the same docs folder.

---

## Sources (verified 2026-06-08)

- n8n on Docker (official): https://docs.n8n.io/hosting/installation/docker/
- Anthropic Messages API: https://docs.claude.com/en/api/messages
- Obsidian Local REST API plugin: https://github.com/coddingtonbear/obsidian-local-rest-api
- `host.docker.internal` on Docker Desktop Windows: https://docs.docker.com/desktop/networking/#i-want-to-connect-from-a-container-to-a-service-on-the-host
- Windows firewall PowerShell (`New-NetFirewallRule`): https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule
