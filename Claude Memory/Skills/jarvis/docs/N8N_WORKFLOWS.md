# n8n Workflows

Two workflows make Jarvis run: **Capture Router** (phone → routed file) and **Event Logger** (HA → event log).

> **Shortcut:** `resources/n8n-capture-router.json` is a ready-to-import version of the Capture Router. In n8n: Workflows → ⋯ → **Import from File**. Then set env vars (`ANTHROPIC_KEY`, `HA_URL`, `HA_TOKEN`), add GitHub credentials to the "Append to Vault" node, and read the note on that node about true-append vs overwrite. The sections below explain how it works and how to build the Event Logger by hand.

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

### Write to vault — three options

| Option | Pros | Cons |
|---|---|---|
| **GitHub node** — commit to `etblues449/Obsidian-Vault-` branch | Cross-device, auditable, free | 5-10s delay before phone sees it via Obsidian Git plugin pull |
| **Filesystem node** (write to local synced folder) | Instant on PC | Only works on the device n8n runs on |
| **Webhook to a small Flask/Express receiver on the PC** | Instant + flexible | Extra moving part |

**Recommended:** GitHub node — single source, no extra infra. The Obsidian Git plugin on the Fold 7 pulls every few minutes.

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
Webhook → Format markdown row → GitHub: append to Claude Memory/Projects/Smart Home/event_log.md
```

### Format node (Code/Set)

```javascript
const row = `- ${$json.ts} | ${$json.event} | ${$json.entity} | ${$json.from} → ${$json.to}`;
return { row };
```

### GitHub node

- Repo: `etblues449/Obsidian-Vault-`
- Branch: `claude/adoring-allen-LY2kF`
- File: `Claude Memory/Projects/Smart Home/event_log.md`
- Mode: **Append** (read file, append row, commit back)
- Commit message: `jarvis: log ${{$json.event}}`

## Environment variables (n8n)

Set in n8n → Settings → Variables (or `.env` if self-hosting):

- `ANTHROPIC_KEY` — your Anthropic API key
- `HA_URL` — `http://192.168.0.50:8123`
- `HA_TOKEN` — long-lived token
- `GH_TOKEN` — GitHub PAT with repo scope on `etblues449/Obsidian-Vault-`

## Testing each workflow

1. **Capture Router** — In n8n editor, **Execute workflow** → manually paste `{"text": "note: testing jarvis end to end"}` → walk the data through each node.
2. **Event Logger** — Trigger an HA automation that calls `rest_command.jarvis_event` → check the workflow execution + that `event_log.md` updated.

## Future workflows (post-launch)

- **Daily 8AM digest** — Schedule trigger → list inbox/tasks/yesterday's events → Claude summary → push notification + write to `Journal/YYYY-MM-DD.md`
- **Weekly review** — Sunday 6PM → roll up the week per project → write `Reviews/YYYY-Www.md`
- **HA pattern miner** — Read `event_log.md`, suggest automations (Claude prompt: "you see these patterns, propose 3 automations")
