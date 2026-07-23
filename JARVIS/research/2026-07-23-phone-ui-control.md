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
