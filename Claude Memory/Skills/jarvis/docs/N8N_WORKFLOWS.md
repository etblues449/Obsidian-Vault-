# n8n Workflows

Two workflows make Jarvis run: **Capture Router** (phone → routed file) and **Event Logger** (HA → event log).

> **Shortcut:** `resources/n8n-capture-router.json` is a ready-to-import version of the Capture Router. In n8n: Workflows → ⋯ → **Import from File**. Then set env vars (`ANTHROPIC_KEY`, `HA_URL`, `HA_TOKEN`, `OBSIDIAN_REST_URL`, `OBSIDIAN_REST_TOKEN`). The vault-write node uses the **Obsidian Local REST API** (see verified recommendation below) — not git. The sections below explain how it works and how to build the Event Logger by hand.

## Workflow 1: Jarvis Capture Router

**Trigger:** Webhook — `POST /webhook/jarvis-capture` — body `{"text": "...", "source": "...", "ts": "..."}`

**Flow:**

```
Webhook → Classify (Anthropic HTTP) → Switch on type → [Note | Task | Idea | HA Action | Journal | Inbox] → Confirm
```

### Classify node (HTTP Request → Anthropic)

```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: {{ $env.ANTHROPIC_KEY }}
  anthropic-version: 2023-06-01
  content-type: application/json
Body:
{
  "model": "claude-opus-4-7",
  "max_tokens": 1024,
  "system": "You are Jarvis classifier. Read the user's spoken/typed input and return ONE valid JSON object matching this schema: {type, project, destination_file, content, tags, ha_action?, due?, confidence}. Routing rules: <paste resources/classification.md>. Respond with JSON only, no prose.",
  "messages": [{"role":"user","content":"{{ $json.text }}"}]
}
```

Parse the response: `JSON.parse($json.content[0].text)`.

### Switch node

Route on `{{ $json.type }}`:
- `note` → Write Note branch
- `task` → Append Task branch
- `idea` → Write Idea branch
- `journal` → Append Journal branch
- `ha_action` → Call HA branch
- `inbox` (or confidence < 0.7) → Append Inbox branch

### Write to vault — VERIFIED recommendation (corrected 2026-06-08)

| Option | Pros | Cons |
|---|---|---|
| **Obsidian Local REST API plugin (on the PC)** — n8n `POST /vault/<path>` (append) or `PATCH` (target a heading/block) | Writes *through* desktop Obsidian → **Obsidian Sync** fans out to phone+laptop; no sync-engine conflict; surgical heading/block targeting | PC + desktop Obsidian must be running (vault open); plugin is desktop-only (`:27123`/`:27124`, bearer token) |
| **Filesystem node** (write to local synced folder) | Instant on PC, no plugin | Obsidian may not see externally-written file until re-scan; slightly more conflict-prone — **use only as fallback** |
| **GitHub node** — commit to the vault repo | Auditable history | ⚠️ git + Obsidian Sync on the same vault **conflict**; mobile git (isomorphic-git) is "highly unstable on mobile" per its maintainer, so the Fold 7 may never get the change — **AVOID as primary** |

**Recommended:** **Obsidian Local REST API plugin on the always-on PC**, then let Obsidian Sync deliver to all devices. Don't make the phone depend on a git pull. Add a **fallback branch**: if the REST call errors (PC/Obsidian off), write via the **Filesystem node** to the synced vault folder, or queue + retry.

Two maintained community nodes save you hand-rolling HTTP: `Wade11s/n8n-nodes-obsidian` (Note Get/Create/Update/Delete/**Append**, Periodic notes, run Obsidian Commands) and `j-shelfwood/n8n-nodes-obsidian-local-rest-api` (full OpenAPI incl. PATCH section-targeting). Both require the Local REST API plugin running.

> **git's actual role:** backup + audit history + Claude's desktop read/write — run it **only on PC/laptop** (native git), as a periodic commit/push *after* Sync settles. Gitignore `.obsidian/workspace*.json`, `.trash`, and conflict files. Never install Obsidian Git on the Fold 7.

### HA Action branch

HTTP Request:
```
POST {{ $env.HA_URL }}/api/services/{{ $json.ha_action.service.split('.')[0] }}/{{ $json.ha_action.service.split('.')[1] }}
Headers:
  Authorization: Bearer {{ $env.HA_TOKEN }}
  Content-Type: application/json
Body:
  {"entity_id":"{{ $json.ha_action.entity_id }}", ...{{ $json.ha_action.data }}}
```

### Confirm node (optional)

POST to a Pushover / ntfy / phone notification endpoint with the result. Or return a JSON response the Tasker task displays as a Flash.

## Workflow 2: Jarvis Event Logger

**Trigger:** Webhook — `POST /webhook/jarvis-event` — body `{"event": "...", "entity": "...", "from": "...", "to": "...", "ts": "..."}`

**Flow:**

```
Webhook → Format markdown row → Obsidian Local REST API: append to Claude Memory/Projects/Smart Home/event_log.md
```

### Format node (Code/Set)

```javascript
const row = `- ${$json.ts} | ${$json.event} | ${$json.entity} | ${$json.from} → ${$json.to}`;
return { row };
```

### Append node (Obsidian Local REST API)

```
POST {{ $env.OBSIDIAN_REST_URL }}/vault/Claude Memory/Projects/Smart Home/event_log.md
Headers:
  Authorization: Bearer {{ $env.OBSIDIAN_REST_TOKEN }}
  Content-Type: text/markdown
Body: {{ $json.row }}\n
```

(`POST /vault/<path>` appends. Obsidian Sync then delivers the updated `event_log.md` to all devices. Fallback: Filesystem node append if the PC/Obsidian is off.)

## Environment variables (n8n)

Set in n8n → Settings → Variables (or `.env` if self-hosting):

- `ANTHROPIC_KEY` — your Anthropic API key
- `HA_URL` — `http://192.168.0.50:8123`
- `HA_TOKEN` — long-lived token
- `OBSIDIAN_REST_URL` — `https://<PC-IP>:27124` (Local REST API plugin; or `http://<PC-IP>:27123`)
- `OBSIDIAN_REST_TOKEN` — bearer token from the Local REST API plugin settings
- `GH_TOKEN` — *(optional)* GitHub PAT, only if you run the PC/laptop backup commits from n8n

## Testing each workflow

1. **Capture Router** — In n8n editor, **Execute workflow** → manually paste `{"text": "note: testing jarvis end to end"}` → walk the data through each node.
2. **Event Logger** — Trigger an HA automation that calls `rest_command.jarvis_event` → check the workflow execution + that `event_log.md` updated.

## Future workflows (post-launch)

- **Daily 8AM digest** — Schedule trigger → list inbox/tasks/yesterday's events → Claude summary → push notification + write to `Journal/YYYY-MM-DD.md`
- **Weekly review** — Sunday 6PM → roll up the week per project → write `Reviews/YYYY-Www.md`
- **HA pattern miner** — Read `event_log.md`, suggest automations (Claude prompt: "you see these patterns, propose 3 automations")
