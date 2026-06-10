---
type: jarvis-system
status: setup-in-progress
updated: 2026-06-10
---

# JARVIS — Quick-Note Router

Zero-friction capture: tap a widget on the Fold 7 → type a note → it's classified by
Claude and filed into the right place in this vault automatically, then synced back to
the phone.

This folder is the **landing zone** for auto-captured notes. Each capture becomes one
markdown file under `JARVIS/<Category>/`, e.g. `JARVIS/Smart Home/2026-06-10-1432-fix-sensor.md`.

## How it works

```
Phone widget ──POST──► n8n webhook ──► Claude classifies ──► commit .md to this repo
   (HTTP)                                                          │
                                                                   ▼
                                          GitHub Sync plugin pulls it into Obsidian
```

- **n8n workflow:** `JARVIS · Note Router` (ID `0UqDYWb9cqlZ5DV6`)
  https://jellybean1875.app.n8n.cloud/workflow/0UqDYWb9cqlZ5DV6
- **Webhook (production):** `https://jellybean1875.app.n8n.cloud/webhook/jarvis-capture`
- **Webhook (test):** `https://jellybean1875.app.n8n.cloud/webhook-test/jarvis-capture`
- **Classifier:** Claude (Anthropic) via the existing `Anthropic account` credential, temperature 0
- **Categories:** Smart Home · Faceless Finance · Studying · Debt · Inbox (fallback)

### POST body the webhook expects

```json
{ "note": "fix the upstairs radar sensor it keeps dropping", "source": "phone" }
```

### Response it returns

```json
{ "ok": true, "category": "Smart Home", "title": "Fix upstairs radar sensor",
  "path": "JARVIS/Smart Home/2026-06-10-1432-fix-upstairs-radar-sensor.md",
  "commit": "https://github.com/etblues449/Obsidian-Vault-/commit/..." }
```

## To finish setup (3 steps)

1. **Connect the GitHub credential in n8n.** Open the workflow → node **Commit Note to Vault**
   → Credentials → create `GitHub Vault` → paste a **fine-grained GitHub PAT** scoped to
   only the `Obsidian-Vault-` repo with **Contents: Read and write**. (Make a fresh token —
   never reuse the one that was pasted in chat.)
2. **Verify the Claude credential.** Node **Claude Classifier** should already point at your
   `Anthropic account` credential. If it shows empty, pick it from the dropdown.
3. **Set up phone capture.** Install **HTTP Shortcuts** (Android), add a home-screen shortcut:
   - Method: `POST`
   - URL: `https://jellybean1875.app.n8n.cloud/webhook/jarvis-capture`
   - Body (JSON): `{"note":"{{text}}","source":"phone"}` with a text-input variable
   Then **activate** the workflow (toggle top-right) and fire a test note.

## Test it from n8n first

Open the workflow, click **Execute workflow / Listen for test event**, and POST a sample to
the test webhook — or just run it and check `JARVIS/Inbox/` for the committed file.

## Notes / open items

- **Vault split:** cloud n8n can only auto-write to a *GitHub* vault, so captures land in
  this repo (`Obsidian-Vault-`). Your Obsidian-Sync "primary" vault is not on GitHub, so the
  router can't write there directly. If you want captures in primary instead, mirror primary
  to a private GitHub repo and change `owner`/`repository` on the Commit node.
- **Security TODO (important):** the `Faceless Finance App` workflow has live API keys
  hardcoded in plaintext (Anthropic, ElevenLabs, Hedra). Rotate all three and move them into
  n8n **Credentials**. This router already uses the credential pattern — copy it.
- **Cost:** classification uses Claude Sonnet 4.6. To cut cost on frequent captures, switch
  the Claude Classifier model to Claude Haiku 4.5 — it's plenty for routing.
