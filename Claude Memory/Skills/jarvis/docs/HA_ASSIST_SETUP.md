# HA Assist + LLM — Live House-Control Brain

Goal: talk to the house in real time ("Jarvis, dim the lounge", "Jarvis, play Spotify on the lounge TV") with **Home Assistant's built-in Assist + an LLM conversation agent**, NOT through n8n. This is **Decision 3** in `ARCHITECTURE.md` — the live control path. n8n's HA REST branch stays reserved for captured `ha_action` items only.

HA Green (HA OS) at `http://192.168.0.50:8123`. Researched/verified **2026-06-08** against current HA docs.

## How this path works (and why not n8n)

Since the 2025 releases HA Assist does real **LLM tool-calling against the Assist API** over your *exposed* entities. Two pieces:

1. **Hybrid fast-path.** Assist's built-in intent engine handles simple commands locally first ("turn on the kitchen light" resolves in <1s, no LLM, no token cost). Only what it *can't* match ("it's dark in here, sort it out") is escalated to the LLM. This is the default behaviour — keep it.
2. **LLM agent.** When a command escalates, the LLM picks the right exposed entity/service and calls it. We feed it an instruction prompt that hard-excludes the broken entities so it never selects a dead one.

Lower latency and far more reliable than routing "turn on the lights" through n8n → HA REST. Reserve n8n for *captured* device commands.

- Sources: [Building the AI-powered local smart home (HA blog, Sep 2025)](https://www.home-assistant.io/blog/2025/09/11/ai-in-home-assistant/), [HA LLM / Assist API docs](https://developers.home-assistant.io/docs/core/llm/), [Best practices with Assist](https://www.home-assistant.io/voice_control/best_practices/)

---

## Recommended LLM agent: Anthropic (Claude)

**Use the official Anthropic integration**, model **Claude Haiku 4.5** to start (cheapest, plenty for home control), step up to **Sonnet 4.6** only if you want richer "conversational" replies. Reasons:

- Claude follows the HA tool-calling format reliably, handles multi-step commands, and is conservative about inventing entity names — exactly what we want given the broken-entity landmines.
- It's a paid API (no free tier; needs billing enabled). Home-control traffic is low-volume, and the **fast-path means most commands never hit the API at all**, so monthly cost is small. Set a low **Maximum tokens** is fine for control, but not *too* low or multi-step device actions get truncated.
- **Local alternative:** if you'd rather keep it offline, use the **Ollama** integration (native since 2025.6) with an 8GB+ VRAM model — recent local models nearly keep up for simple control. Tradeoff: needs a GPU box always on; tool-calling is less rock-solid than Claude. **OpenAI** is the other drop-in cloud option (roughly at parity); pick Anthropic for the instruction-following + entity-name discipline.

- Sources: [Anthropic integration](https://www.home-assistant.io/integrations/anthropic/), [OpenAI integration](https://www.home-assistant.io/integrations/openai_conversation/), [Ollama integration](https://www.home-assistant.io/integrations/ollama/)

> Version note: new Anthropic models can take **up to ~2 HA releases** to be fully supported in stable. Pick a model the current HA build lists. The Anthropic integration exists since **HA 2024.9**.

---

## Step 1 — Add the LLM conversation agent

1. **Settings → Devices & Services → Add Integration** (bottom-right) → search **Anthropic**.
2. Paste an **API key** from the Anthropic console (billing must be enabled — paid service; watch usage in the Anthropic portal).
3. After it's added, open the integration → its entry → **Configure**, and set:
   - **Control Home Assistant: Assist** — this is the switch that lets the model call services. When on, it can *only* control/read **exposed** entities (Step 3). If this is off, the agent can chat but can't actuate anything.
   - **Model:** `claude-haiku-4-5` (or current Haiku/Sonnet id the build offers).
   - **Maximum tokens:** leave at the default (don't crank it down — truncated tool calls = half-done actions).
   - **Instructions / Prompt:** paste the system prompt in Step 4.

- Sources: [Anthropic integration setup](https://www.home-assistant.io/integrations/anthropic/), [HA LLM / Assist API](https://developers.home-assistant.io/docs/core/llm/)

> If you ever pick OpenAI/Google/Ollama instead, it's the same shape: Add Integration → credentials → set **Control Home Assistant: Assist** → choose model → paste instructions.

---

## Step 2 — Build the Voice Assistant pipeline

**Settings → Voice assistants → Add assistant.**

1. **Name:** `Jarvis`.
2. **Language:** English (your locale).
3. **Conversation agent:** select the **Anthropic / Claude** agent from Step 1 (this is what makes the pipeline LLM-backed instead of intent-only).
4. **Speech-to-text (STT):**
   - **HA Cloud** (Nabu Casa) — easiest, best accuracy, no local hardware. Recommended if you have/expect a subscription.
   - or **Whisper** (local, via the Whisper add-on / Wyoming) for fully local; or **Speech-to-Phrase** for fast closed-ended home-control STT.
5. **Text-to-speech (TTS):** **HA Cloud** voice, or **Piper** (local, Wyoming). Both support **streaming TTS** now (audio starts as the LLM produces the first words — ~10x faster perceived response; landed across the 2025 releases).
6. Save.

> **Hybrid fast-path setting:** there's a **"Prefer handling commands locally"** toggle on the assistant. Leave it **ON** — Assist tries its built-in intents first and only escalates unmatched commands to Claude. That's what keeps simple commands instant and cheap.

> **Per-device LLM (2025+):** the Voice Assistants page lets you assign a **different agent per device/satellite**. Useful later (e.g. a cheap local agent on a hallway satellite, Claude on your phone). Not required for v1.

- Sources: [Set up a local voice assistant (pipeline steps)](https://www.home-assistant.io/voice_control/voice_remote_local_assistant/), [Assist overview](https://www.home-assistant.io/voice_control/), [AI in HA — streaming TTS + per-device LLM](https://www.home-assistant.io/blog/2025/09/11/ai-in-home-assistant/)

---

## Step 3 — Expose ONLY the right entities

**Settings → Voice assistants → Expose tab.** Everything is opt-in; nothing is controllable by voice until exposed. Use **Expose entities** to add, click an entity to pick which assistants (choose **Assist**).

**Why minimal:** every exposed entity + alias is extra work for the intent parser *and* extra context tokens (= cost + latency) for the LLM. Expose the bare minimum. (HA best-practice.)

### ✅ Recommended expose-list (canonical entities only)

**Lounge:**
- `media_player.tv_jelly_beans_tv_2` — alias **"lounge TV"**, **"living room TV"**  ⚠️ this is the canonical one, NOT `media_player.jelly_beans_tv`
- `light.living_room_light` — alias **"lounge light"**, **"living room light"**
- `light.right_smart_bulb` — alias **"right lounge bulb"**
- `light.left_smart_bulb` — alias **"left lounge bulb"**
- `light.rgbic_tv_backlight` — alias **"TV backlight"**
- `switch.rgbic_tv_backlight_dreamview` — alias **"DreamView"**, **"TV ambient sync"**
- `light.stairs_smart_bulb` — alias **"stairs light"**

**Bedroom** (node `bedroom-2.yaml`, NOT `bedroom.yaml`): expose your bedroom light/climate entities from that node, e.g.
- `light.bedroom_light` — alias **"bedroom light"** (dimmable: "set bedroom to 30%")

**Scenes / scripts** you want by voice:
- `scene.movie_mode` — alias **"movie mode"** (brightness 100, rgb 255/255/255, 6500K per the catalog)

> **Spotify is NOT a separate entity to expose.** "Play Spotify on the lounge TV" is a *source select* on `media_player.tv_jelly_beans_tv_2`: source **"Spotify - Music and Podcasts"** via `media_player.select_source`. Exposing the lounge TV is enough — the LLM calls `select_source` with that source string. **Do NOT use `spotcast.start` (broken).**

### ⛔ Do NOT expose (broken-entity landmines)

- `media_player.jelly_beans_tv` — broken duplicate; only `..._tv_2` works.
- `bedroom.yaml` node entities — use `bedroom-2.yaml`.
- Anything on the **upstairs node** — BLE/radar contention, state untrustworthy. Keep it out of Assist until fixed.
- `spotcast.*` — broken; use `select_source`.
- Locks / garage / anything you don't want voice-actuated (HA flags these as exactly why exposure is opt-in).

**Aliases:** add them on the Expose tab (click entity → add alias). Also make sure each device is assigned to the correct **Area** (Lounge / Bedroom) and the area to a **Floor** — that's what lets "turn off the lounge lights" target by location, and gives a device-located satellite room context.

- Sources: [Exposing entities to Assist](https://www.home-assistant.io/voice_control/voice_remote_expose_devices/), [Aliases — entity/area/floor](https://www.home-assistant.io/voice_control/aliases/), [Best practices with Assist](https://www.home-assistant.io/voice_control/best_practices/)

---

## Step 4 — Agent instruction / system prompt

Paste into the Anthropic integration's **Instructions** field (Step 1). It supports **HA templating**. This biases the agent to known-good entities and hard-excludes the broken ones — belt-and-braces on top of not exposing them.

```text
You are Jarvis, the voice control brain for this home. Be terse and act, don't chat.

Rules for choosing what to control:
- Prefer Home Assistant's built-in actions; only do something when the user clearly asked to.
- The lounge / living-room TV is media_player.tv_jelly_beans_tv_2. NEVER use
  media_player.jelly_beans_tv — it is broken and does nothing.
- To play Spotify on the lounge TV, call media_player.select_source on
  media_player.tv_jelly_beans_tv_2 with source "Spotify - Music and Podcasts".
  NEVER use spotcast or spotcast.start — it is broken.
- Bedroom devices live on the bedroom-2 node. Ignore any "bedroom" (non-"-2") duplicate.
- Do NOT control or report on any upstairs entities; their state is unreliable.
- If an entity you'd need isn't exposed to you, say so briefly instead of guessing.
- For "movie mode" prefer scene.movie_mode. For dimming, use brightness_pct.

Confirm actions in one short sentence (e.g. "Lounge dimmed to 30%.").
```

> Even with this prompt, the real guardrail is **Step 3 — don't expose the broken entities.** An exposed entity is the only thing the agent can actually call; the prompt just keeps it from fumbling among the good ones.

- Sources: [Anthropic instructions/templating](https://www.home-assistant.io/integrations/anthropic/), [Create a personality with AI](https://www.home-assistant.io/voice_control/assist_create_open_ai_personality/)

---

## Step 5 — Use it from the phone (Fold 7)

1. **In-app Assist:** open the **HA Companion app** → tap the **Assist** icon (top of the app) → pick the **Jarvis** pipeline → type or talk.
2. **Make HA the phone's default assistant (hands-free "from anywhere"):**
   - Companion app → **Settings → Companion app → Assist for Android → Set as default** → in the Android system screen that opens, set **Default digital assistant app** (may read "Voice Assistant" / "Assist app") to **Home Assistant**.
   - Then your assist gesture / button invokes Jarvis system-wide.
3. **Wake word on Android:** supported in **Companion app ≥ 2026.2.3** — enable in the app's Assist settings if you want "Jarvis"-style hands-free on the phone (battery cost; optional).

> Don't confuse this with the **capture** path. This Assist agent is for *live control* of the house. Capturing notes/tasks still goes through HTTP Shortcuts/Tasker → n8n (see `PHONE_SETUP.md`). They can coexist: one button captures, the assist gesture controls.

- Sources: [Assist on Android](https://www.home-assistant.io/voice_control/android/), [Companion app docs](https://companion.home-assistant.io/), [Companion app update (Jul 2025)](https://www.home-assistant.io/blog/2025/07/23/companion-app-for-android/)

---

## Example "Jarvis" utterances → what HA does

| You say | Path | HA action |
|---|---|---|
| "Jarvis, turn on the lounge light" | fast-path (intent) | `light.turn_on` → `light.living_room_light`, no LLM |
| "Jarvis, dim the bedroom to 30%" | fast-path (intent) | `light.turn_on` `light.bedroom_light` `brightness_pct: 30` |
| "Jarvis, movie mode" | fast-path (intent) | `scene.turn_on` → `scene.movie_mode` |
| "Jarvis, play Spotify on the lounge TV" | LLM (tool call) | `media_player.select_source` on `media_player.tv_jelly_beans_tv_2`, source `"Spotify - Music and Podcasts"` |
| "Jarvis, it's too bright in the lounge" | LLM (tool call) | reasons → dims/turns off exposed lounge lights |
| "Jarvis, turn on the TV backlight and sync it" | LLM (tool call) | `light.turn_on` `light.rgbic_tv_backlight` + `switch.turn_on` `switch.rgbic_tv_backlight_dreamview` |

---

## Version flags (verified 2026-06)

- **Anthropic integration:** since **HA 2024.9**. New Claude models may lag stable by **~2 HA releases** — choose a listed model id.
- **Streaming TTS** (Piper + HA Cloud, ~10x faster spoken response): landed across the **2025** releases. Confirm your HA build is current.
- **Proactive conversations** (the LLM can *start* a conversation, e.g. "garage's been open an hour — close it?"): since **Sep 2025**. Optional; set up via automation later, not needed for v1.
- **Per-device LLM** assignment in the Voice Assistants page: **2025+**.
- **Companion app wake word (Android):** **≥ 2026.2.3**.
- **Optional unified-n8n path:** the `webhook-conversation` integration (make an n8n workflow be HA's conversation agent) needs **HA ≥ 2026.4** and still executes via HA service calls. Only worth it if you specifically want ONE n8n brain for chat + control — the default recommendation here is to keep live control in HA Assist and leave n8n for captured `ha_action` items.

- Sources: [AI in HA blog (Sep 2025)](https://www.home-assistant.io/blog/2025/09/11/ai-in-home-assistant/), [2025.8 release](https://www.home-assistant.io/blog/2025/08/06/release-20258/), [webhook-conversation](https://github.com/EuleMitKeule/webhook-conversation)

---

## Quick checklist

- [ ] Anthropic integration added, API key + billing set, **Control Home Assistant: Assist** ON, model = Haiku 4.5, instructions pasted (Step 4).
- [ ] `Jarvis` pipeline built (Settings → Voice assistants), conversation agent = Claude, STT/TTS chosen, **Prefer handling commands locally: ON**.
- [ ] Exposed ONLY the canonical list (Step 3) with aliases; areas/floors assigned.
- [ ] Broken entities NOT exposed (`media_player.jelly_beans_tv`, `bedroom.yaml`, upstairs node, `spotcast.*`).
- [ ] Phone: Companion app Assist works; optionally set HA as default assistant.
- [ ] Smoke test the example utterances above.
