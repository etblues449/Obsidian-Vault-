---
title: Giving JARVIS UI control of the Fold 7 (Shizuku, no root, no PC)
date: 2026-07-23
type: research
tags: [jarvis, research, shizuku, accessibility, phone-control, security]
provenance: Deep-research workflow (67 adversarially-verified claims). Auto-synthesis step failed on a cyber-safety flag; report hand-synthesized from the verified journal. 3 misconceptions were REFUTED and are flagged inline.
---

# Giving JARVIS UI control of the Fold 7 — Shizuku, no root, no PC

**Question:** how to let jarvis-core (Termux/Node, stock unrooted Galaxy Z Fold 7, Shizuku already installed) drive any app's on-screen UI (read, tap, type, scroll) at £0, keeping Knox/HSBC/Wallet intact.

## TL;DR verdict
Doable at £0, stock, unrooted. Shizuku gives Termux **ADB-shell privilege (UID 2000)** — enough to read (`uiautomator dump`) and act (`input tap/text/swipe`). The ADB path is **fragile on WebView / Jetpack Compose / the Fold's dual screens**, so the robust design is a **hybrid**: a tiny **AccessibilityService** for reading + element-aware clicking, with Shizuku/`rish` as the fast MVP and for system commands. The hard part is **security**: an LLM that reads arbitrary screens and taps is a confused-deputy target.

## 1. Mechanism — Shizuku → Termux (no PC, no root)
- **Pair on-device:** Android 11+ Wireless Debugging → "Pair device with pairing code" → type the system's 6-digit code into **Shizuku's notification**. Official docs: "does not require a connection to a computer." [shizuku.rikka.app/guide/setup]
- **`rish` = shell into the Shizuku daemon** at **UID 2000 (shell/ADB, NOT root)**. Export `rish` + `rish_shizuku.dex` **from the Shizuku app** (Use Shizuku in terminal apps → Export), move to Termux `$PREFIX/bin`, set `RISH_APPLICATION_ID=com.termux`. Then `rish -c 'uiautomator dump'`, `rish -c 'input tap …'`. [RikkaApps/Shizuku-API; DeepWiki awesome-shizuku; oddity.oddineers.co.uk 2024; HowToGeek]
- ⚠️ **REFUTED:** random "pre-configured rish" GitHub repos (e.g. `jecis-repos/termux-shizuku-tools`) are AI-generated spam shipping a broken rish (missing `.dex`, `PKG` placeholder). Export from the official Shizuku app only.

## 2. Reading the screen
- **`rish -c 'uiautomator dump'`** → XML with `class, resource-id, text, content-desc, bounds, clickable, enabled`. **Write to a tempfile and `cat` it** — piping to stdout returns empty/truncated XML.
  - Limits: **WebView** child nodes missing (regression since WebView v84); **Compose** elements have **no resource-id** unless dev opted in (`testTagsAsResourceId`) → target by text/content-desc. [developer.android.com Compose testing]
- **AccessibilityService** `getRootInActiveWindow()` → live `AccessibilityNodeInfo` tree; **reads WebView/Compose that uiautomator misses** (Google's own recommended fix). [developer.android.com/.../accessibility/service]
- **FLAG_SECURE (banking):** blocks visual capture (`screencap` → black, recording, recents thumbnail) and in practice `uiautomator dump`, but **not the accessibility tree** — unless the app also blocks accessibility (many banks do; One UI kills 3rd-party a11y services). [blog.ostorlab.co; AutoInput FAQ]

## 3. Acting
- **ADB/rish:** `input tap x y` · `input text <ascii>` · `input swipe x1 y1 x2 y2 [ms]` · `input keyevent <code>` (Back=4, Enter=66). Gotchas: `input text` **can't do Unicode** (NPE — sanitize to ASCII); coordinates are **absolute** → brittle across the Fold's inner/outer screens.
- **AccessibilityService:** `node.performAction(ACTION_CLICK)` / `ACTION_SCROLL_FORWARD` is **element-aware** (survives layout shifts); `performGlobalAction()` = Back/Home/Recents/notifications.
- ⚠️ **REFUTED myth:** `dispatchGesture()` is **coordinate-based, NOT element-aware** — as brittle as `input tap`. Element-awareness is only `performAction()` on the node tree.

## 4. Reboot persistence (better than assumed)
Pairing persists across reboots (only the service stops). **Shizuku v13.6.0 (2025): "auto start without root on Android 13+ on a trusted WLAN."** Fold 7 (One UI 8 / Android 16) qualifies → grant `WRITE_SECURE_SETTINGS` once + trust home Wi-Fi → **auto-restart on boot, no PC, no root.** (REFUTED the "redo every reboot" belief.)

## 5. No-code complement
- **Tasker + AutoInput** (AutoInput is an AccessibilityService) — triggerable over jarvis-core's existing HTTP→Tasker bridge. Limit: FAQ admits some apps disable the accessibility click. [joaoapps.com/autoinput/faq]
- **`xjunz/AutoTask`** (open source) — reference impl supporting both Shizuku and AccessibilityService. Caveat: Android registers only one `UiAutomation` at a time → pick one channel.

## 6. ⚠️ Security — the part that matters most
- **Confused-deputy / indirect prompt injection is the defining risk.** Feeding on-screen text (screenshot, a11y tree, XML dump) into the same context as the user instruction lets attacker-controlled text (in-app ad, WebView, WhatsApp msg, notification) hijack the agent. Attacker needs **no root, no exploit** — just content on screen. [arXiv 2510.27140]
- In-app-ad injections succeeded **>80% of trials**; a demonstrated **OTP-harvest** (WhatsApp msg → agent reads Alipay OTP from Messages → sends to attacker, 9/10 on Mobile-Agent-E). [arXiv 2510.27140]
- **Every agent tested vulnerable** — AgentScan, 9 agents, avg **6.3/11** vectors, worst 8/11. [arXiv 2505.12981]
- Honesty correction (REFUTED framing): the "banking-password steal" PoC is **simulated with a pre-planted credential**, not a real bank breach — mechanism real, headline overstated.
- **For jarvis-core:** never treat scraped screen text as instructions; keep a **confirm-gate before destructive/financial actions** (extend the existing `agent.mjs` gate to `ui_control`); consider banking/payment out of scope or human-in-the-loop; contain blast radius.

## 7. Recommended `ui_control` architecture
| Concern | Use | Why |
|---|---|---|
| Read screen | AccessibilityService `getRootInActiveWindow()` (MVP: `rish uiautomator dump` → tempfile) | reads Compose/WebView + bounds; uiautomator = zero-build start |
| Act | `performAction(ACTION_CLICK)`; fallback `rish input tap` at node-bounds center | survives layout/Fold-screen shifts |
| Target | resource-id → text → content-desc, **never fixed coords**; re-dump + verify after each action | robustness |
| System cmds | `rish -c 'svc …' / 'am start …'` | ADB-level, no root |
| Persistence | Shizuku auto-start on trusted Wi-Fi | survives reboot |
| Safety | injection-aware prompt boundary + confirm-gate on money/destructive | research demands it |

## Steal-these-first (impact ÷ effort)
1. Shizuku + rish in Termux → `ui_control` v0 with `uiautomator dump` + `input`.
2. Shizuku trusted-Wi-Fi auto-start (kills the reboot footgun).
3. Target by text/resource-id + verify-after-action.
4. Injection guard + confirm-gate before any bank/payment.
5. Later: minimal AccessibilityService for Compose/WebView + element-aware taps.

## Sources (verified)
shizuku.rikka.app · RikkaApps/Shizuku-API · DeepWiki awesome-shizuku · HackTricks · mobile-hacker.com (2025) · oddity.oddineers.co.uk (2024) · HowToGeek · developer.android.com (accessibility, Compose testing) · joaoapps AutoInput FAQ · xjunz/AutoTask · blog.ostorlab.co · arXiv 2510.27140, 2505.12981, 2601.22569.

---
*Pending: features-survey deep-research (best ideas from DroidRun/AppAgent/Mobile-Agent/AutoDroid etc.) to be merged into this note when it completes.*



---

# Part 2 — Best-in-class features to steal (2024–2026 phone-agent survey)

*Second deep-research run (105 agents, 20 confirmed / 5 refuted claims). Merged 2026-07-23.*

## Headline recipe (what every leading agent converges on)
Perceive **accessibility-tree-first** → act by **semantic selectors** → wrap in a **verify-after-action loop** → **cache successful flows as replayable recipes** → **confirmation-gate** destructive actions. This fits jarvis-core almost exactly.

## The projects (and what to take from each)
- **DroidRun / Mobilerun** — unrooted control via a companion accessibility "Portal" app + ADB input injection ("no root required") = exactly Shizuku's privilege level. LLM-agnostic (OpenAI/Anthropic/Gemini/**Ollama**/DeepSeek/OpenRouter). **Caveat: its agent still runs on a HOST PC** (standalone APK "in development") — so **jarvis-core is already ahead** on the no-PC requirement; steal the Portal-style a11y injection technique, not the PC-tethered topology. [github.com/droidrun/mobilerun]
- **AutoDroid** — offline app exploration builds a **UI-transition graph + "App Memory"** injected into prompts. 90.9% action-accuracy but **71.3% end-to-end** on 158 tasks. [arXiv 2308.15272]
- **AppAgent v2** — two-phase **exploration→deployment**; documents each element (id/label/text/visual/function) into a **vector store, retrieved via RAG**. Vision is explicitly "a secondary operation... only when no XML-based icon can perform the task." [arXiv 2408.11824]
- **MobileGPT** — prunes a11y XML into HTML tags; **three-level hierarchical memory (task→sub-task→action)**; on a cache hit it **replays the recorded actions WITHOUT calling the LLM**, and rewrites actions into **parameterised semantic selectors** (`click(ui_index=5)` → `click(id:"contact", text:"[contact_name]")`). The closest thing to a true recipe cache. [arXiv 2312.03003]
- **Mobile-Agent-v2** — splits the loop into **planning / decision / reflection** agents (pure-vision perception). [NeurIPS 2024]
- **V-Droid** — rule-based extractor over the a11y XML to detect clickable/scrollable/editable elements — directly maps to a Shizuku+uiautomator pipeline. [arXiv 2503.15937]
- **OmniParser** (vision fallback SoTA) — YOLO detector + Florence captioner + OCR turns a screenshot into labelled elements for any LLM. **Too heavy for on-device Termux** → cloud multimodal or ML-Kit OCR via the Tasker bridge only. [github.com/microsoft/OmniParser]

## Perception: text-tree ≈ vision (verified)
DailyDroid controlled study: **text-only accessibility scored within ~5 points of full multimodal** (26.7% vs 32.0%; 29.3% vs 33.3%), and the authors **recommend prioritising the tree** (needs only accessibility permission, not screen recording). Vision does **NOT** rescue the dominant failure mode (~40–43% of tasks): elements the a11y API **never exposes** (Reddit/Instagram/Spotify/YouTube, numeric widgets). So: **`uiautomator dump` is the right default; vision is a gated fallback, not a crutch.** [arXiv 2604.17817]

## Reliability reality (the honest caveat)
Best-in-class end-to-end success is only **~27–71%** depending on benchmark. **Do not trust cross-agent leaderboards** — the popular "DroidRun 43% > Mobile-Agent 29% > AutoDroid 14% > AppAgent 7%" ranking was **REFUTED (0-3)**, as was a "30.6% AndroidWorld" figure (1-2). Design for **retry + confirmation gates + deterministic cached recipes**, not >70% autonomy on novel tasks.

## Steal-these-first (impact ÷ effort, all £0 + unrooted)
1. **A11y-tree perception** via `uiautomator dump` → simplified-HTML/labeled elements. *(highest impact, low effort)*
2. **Semantic selector targeting** (resource-id → text → content-desc → live bounds-center) instead of coordinates — also **solves the Fold's dual-screen coordinate problem** (bounds re-read live per screen). *(low effort)*
3. **Reflection / verify-after-action loop** in `runTurn` (re-dump, confirm state change, replan on mismatch). *(medium effort, big reliability gain)*
4. **Cached parameterised recipe memory** in the Vault (learn a flow once, replay without the LLM). *(medium/high effort, big payoff — the single highest-leverage architectural steal)*
5. **Confirmation gates + guardrails** before destructive/financial actions (extend the existing `agent.mjs` gate). *(low effort, essential)*
6. **Gated vision fallback** — cloud multimodal (Groq/Anthropic) or ML-Kit OCR via the Tasker bridge, ONLY when the tree is sparse. *(do last, keep optional)*
7. **Optional local Ollama provider** behind the existing seam for offline/£0 turns.

## Open questions the research couldn't close
- Does text-tree perception hold up with a **fast £0/Groq model** (every benchmark used GPT-4-class)?
- Real **on-device vision latency** in Termux on the Fold 7 — can ML-Kit OCR via Tasker substitute for OmniParser?
- How to detect/handle the **fold/unfold screen-geometry switch** mid-task (no source addressed dual-screen directly).
- How to **build the recipe/exploration memory on-device** without a PC and without burning API budget.

## Sources (Part 2)
github.com/droidrun/mobilerun · arXiv 2308.15272 (AutoDroid) · 2408.11824 (AppAgent v2) · 2312.03003 (MobileGPT) · 2604.17817 (DailyDroid) · 2504.19838 (TMLR survey) · 2503.15937 (V-Droid) · 2405.14573 (AndroidWorld) · github.com/microsoft/OmniParser · NeurIPS 2024 Mobile-Agent-v2 · github.com/PhoneLLM/Awesome-LLM-Powered-Phone-GUI-Agents.

