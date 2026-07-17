# JARVIS — Obsidian-Native Architecture (v3)

**Last updated:** 2026-06-16
**Supersedes:** the Termux/bash JARVIS (v1/v2) and the n8n.cloud + Tasker pipeline.

---

## 1. The core principle

**The vault is the system. Obsidian is the brain.**

Earlier builds inverted this. The Termux build made bash scripts the engine and
treated the vault as a folder to dump into. The n8n.cloud pipeline made a hosted
workflow the engine, with Obsidian as a passive store fed over a localtunnel that
had to stay open on a PC. Both put the intelligence *outside* the thing Elliot
actually lives in.

v3 puts it back where it belongs: classification, routing, memory, recall, and
the conversational layer all run **inside Obsidian**, via its plugin ecosystem +
the Claude API. Nothing external has to be running for capture to work. No PC.
No server. No tunnel.

---

## 2. The four layers

```
   ┌────────────────────────────────────────────────────────────┐
   │ CAPTURE        Advanced URI ─▶ QuickAdd prompt               │
   │                (one tap; phone-keyboard mic = local voice)   │
   └───────────────────────────┬────────────────────────────────┘
                               │ raw text
                               ▼
   ┌────────────────────────────────────────────────────────────┐
   │ BRAIN          jarvis.js (QuickAdd user script)              │
   │                └─ Claude API via Obsidian requestUrl         │
   │                   (claude-opus-4-8, structured output)       │
   │                   classify → {kind,title,body,project,tags}  │
   └───────────────┬───────────────────────────┬─────────────────┘
                   │ note/task/idea/journal/q   │ ha_action
                   ▼                            ▼
   ┌──────────────────────────┐   ┌──────────────────────────────┐
   │ ACTION (vault)           │   │ ACTION (home)                 │
   │ app.vault.create(...)    │   │ HA REST /api/services/...     │
   │ → Inbox/ or Journal/     │   │ → lights / climate / TV       │
   └────────────┬─────────────┘   └──────────────────────────────┘
                ▼
   ┌────────────────────────────────────────────────────────────┐
   │ MEMORY / RECALL                                              │
   │  • Dataview dashboard (tasks, captures, by-project)          │
   │  • Smart Connections — semantic chat over the whole vault    │
   │  • jarvis_ask.js — quick grounded Q&A                        │
   │  • jarvis_digest.js — daily briefing into Journal/           │
   └───────────────────────────┬────────────────────────────────┘
                               ▼
   ┌────────────────────────────────────────────────────────────┐
   │ SYNC           Obsidian Sync (primary) + Git (backup)        │
   └────────────────────────────────────────────────────────────┘
```

---

## 3. Why each choice

| Decision | Rationale |
|---|---|
| **Brain inside Obsidian** (QuickAdd user scripts + `requestUrl`) | No external server to babysit. Works offline-of-PC. Truly vault-centric. |
| **`claude-opus-4-8`** | Most capable model; classification + digest + Q&A all benefit. `model` knob in `jarvis.js` lets you drop the classifier to Haiku for cents/capture. |
| **Structured outputs** (`output_config.format` + JSON schema) | Routing can never break on malformed model output — the response is guaranteed valid JSON matching the schema. No prefill hacks (which 400 on modern models). |
| **`requestUrl`** (not `fetch`, not the SDK) | Obsidian's `requestUrl` bypasses CORS and works identically on desktop **and** Android. The npm SDK can't be bundled into a mobile plugin context. |
| **Secrets in `localStorage`** | Device-local, never synced, never committed. Honors the vault's "never write secrets into notes" rule. Set once per device via `jarvis_setup.js`. |
| **Self-contained scripts** | No fragile cross-file `require()` on mobile. Each script runs standalone on the Fold 7. |
| **Allow-listed HA entities** | Claude maps natural language to a known entity or falls back to a note. It never invents an `entity_id`. |
| **Obsidian Sync primary** | Already paid for, reliable cross-device. Git is the off-site/version backup. |
| **Smart Connections for chat** | Local embeddings + RAG over the whole vault — the deep conversational JARVIS — without us reinventing retrieval. |

---

## 4. Files

```
Claude Memory/Skills/jarvis/obsidian/
├── scripts/
│   ├── jarvis.js          ← capture brain: classify → route (note or HA)
│   ├── jarvis_setup.js     ← one-time secret setup (per device)
│   ├── jarvis_digest.js    ← daily briefing → Journal/
│   └── jarvis_ask.js       ← quick grounded Q&A → JARVIS/Chat.md
├── dashboards/
│   └── JARVIS Dashboard.md ← Dataview home base
├── ARCHITECTURE.md         ← this file
├── SETUP.md                ← step-by-step install
└── README.md               ← overview + daily use
```

---

## 5. Data flow contract

`jarvis.js` classification returns this shape (enforced by JSON schema):

```json
{
  "kind": "task|idea|journal|question|note|ha_action",
  "title": "short headline",
  "body": "tidied text",
  "project": "Smart Home|Faceless Finance|Doc to Learning|Work Forecasting|General",
  "tags": ["lowercase", "tags"],
  "ha": { "service": "light.turn_on", "entity_id": "light.lounge_main" }
}
```

`ha` is present only for `ha_action`. Notes are written with frontmatter
(`type`, `project`, `tags`, `created`, `source: jarvis`) so Dataview can query
them and the dashboard stays live.

---

## 6. Extending to other projects

The brain is already project-aware (`CONFIG.projects`). To deepen any project:

- **Routing:** add per-project folders to `CONFIG.folders` keyed by project, or
  post-process by `result.project` in `writeNote`.
- **New actions:** add a new `kind` to the schema + a branch in the router
  (e.g. `youtube_idea` → append to a Faceless Finance content backlog note).
- **Scheduled work:** wire `jarvis_digest.js`-style scripts to daily-note
  creation (Templater folder template) — Obsidian's native "cron".

Nothing here requires touching capture, sync, or the model plumbing. That's the
point of putting the brain in the vault.

---

## 7. What was retired

- **Termux/bash JARVIS** (`../phone/*.sh`) — archived, not deleted. See
  `../phone/_ARCHIVED.md`. Kept only as an emergency CLI.
- **n8n.cloud + Tasker + localtunnel pipeline** — replaced. No hosted workflow,
  no tunnel, no PC dependency in the daily loop.

---

## v4 addition (2026-06-29) — the conversational front-end: "Job"

v3 above is the capture/routing brain that lives inside Obsidian. **v4 adds a voice front-end that lets you *talk to the vault and hear it answer*** — without a PC, a phone number, or any monthly cost.

```
   ┌────────────────────────────────────────────────────────────┐
   │ VOICE FRONT-END  "Job" — tap-to-talk web app                │
   │   Browser Web Speech API:                                   │
   │     • webkitSpeechRecognition  (your voice → text)          │
   │     • speechSynthesis          (reply → spoken audio)       │
   │   Hosted as static index.html on Vercel Hobby (free)        │
   └───────────────────────────┬────────────────────────────────┘
                               │ POST {text}
                               ▼
   ┌────────────────────────────────────────────────────────────┐
   │ READER/ANSWERER  api/voice-agent.js (Vercel serverless)     │
   │   • reads vault from GitHub (@octokit/rest, branch master): │
   │       JARVIS/Inbox + Claude Memory/MEMORY.md + today's note │
   │   • sends context + question to Groq llama-3.1-8b-instant   │
   │   • returns {reply, vault:"connected"|"unreachable"}        │
   │   • fails gracefully — still answers if vault unreachable   │
   └────────────────────────────────────────────────────────────┘
```

**Why this design.** The original intent was a Twilio phone call (the TikTok inspiration). Twilio proved unavoidably paid for UK/US numbers, so the front-end became a **browser tap-to-talk page** using the Web Speech API — free forever, no number, works in Chrome/Samsung Internet on the Fold 7. The LLM is **Groq** (free tier) rather than Claude (no free-forever tier), keeping the whole thing at £0/month.

**Relationship to v3.** v4 is read-and-converse; v3 is capture-and-route. They share the same substrate (the vault on `master`). v4 currently *reads* the vault; the natural Phase 2 is to give Job the same `ha_action` path v3 already defines, so spoken commands can control Home Assistant.

**Live:** `https://jarvis-voice-lovat.vercel.app` · Vercel project `jelly-bean-s-projects/jarvis-voice` · source `~/job-voice-agent` (Termux) · see `sessions/2026-06-29.md` for the full build log and gotchas.
