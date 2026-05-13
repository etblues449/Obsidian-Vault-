---
name: Faceless Finance App — Redesign Spec
description: Design + feature spec for the Faceless Finance App, derived from the 10 reference screenshots (AI faceless-finance video pipeline)
type: project
project: Faceless Finance YouTube channel
captured: 2026-05-13
updated: 2026-05-13
status: draft
aliases: [FinCast App Spec]
---

# Faceless Finance App — Redesign Spec

> Renamed from "FinCast" → **Faceless Finance App** (2026-05-13). Visual pass: Material-3 / Google-Stitch-flavoured (pill buttons, soft elevation, tonal surfaces). The Google Stitch MCP was unreachable from the build environment (DNS), so the Stitch screen generation is still pending — see §7.

Source of truth: the **10 reference screenshots** supplied 2026-05-13. This doc captures what each screen contains and how the app is structured. The working prototype lives next to this file: [[Faceless Finance App.jsx]] (single-file React component — drop-in for a Claude.ai artifact or a `create-react-app`/Vite `App.jsx`).

> Context: faceless personal-finance/investing YouTube channel, CA-credentialed, UK audience (GBP, HMRC, ISAs, pensions), Wed/Fri/Sun cadence. The app is the **production cockpit**: idea → script → storyboard → multi-provider AI render → batch approval → auto-publish, with cost/ROI tracking and an AI-provider fallback engine.

## 1. Design system  *(dark, Material-3 / Stitch-flavoured)*

| Token | Value | Use |
|---|---|---|
| `bg` | `#06090F` | App background (behind phone frame) |
| `surface` | `#0B111C` | Screen background |
| `card` | `#141B29` | Cards / panels (with `elev1` shadow) |
| `cardAlt` | `#1A2333` | Nested panels, inputs |
| `cardHi` | `#232E42` | Hover / track fills |
| `border` | `#28344B` | Hairlines |
| `accent` (green) | `#27E8A4` | Primary actions, "approve", success, brand |
| `blue` | `#5B8DEF` | Secondary actions, info, links |
| `gold` | `#F5C544` | Scheduled / warning / "selected" highlight |
| `red` | `#F2606A` | Errors, "reject", destructive |
| `text` | `#EAEEF6` / `textDim` `#97A3BA` / `muted` `#5F6C86` | Text hierarchy |
| `elev1` / `elev2` | soft drop shadows | Card & button elevation (Material vibe) |

- Type: `Google Sans Text` → Roboto → Inter → system fallback. Page titles 19–24px/800; card eyebrow labels 11px/700 uppercase, 0.09em tracking.
- Radius: cards 18px, **buttons fully pill-shaped (999px)**, inputs/pills 999px.
- Layout: **mobile-first**. Prototype renders an iPhone-style frame (notch, home indicator) ~392×844 centred on screen, with a 5-item bottom tab bar.
- Charts/visuals are hand-rolled (divs + simple SVG) — no chart library, so it stays single-file.

## 2. Navigation

Bottom tab bar (5 tabs). Each tab can push sub-screens.

| Tab | Icon | Sub-screens |
|---|---|---|
| **Dashboard** | home | — (Publishing Queue, KPI cards, quick links) |
| **Studio** | clapperboard | Video Creator → Script Editor & Storyboard Tune; Live Events (orchestration log) |
| **Projects** | folder | Project list (Kanban-ish by stage) → Bulk Actions mode; Batch Approval Review Feed |
| **Analytics** | bar-chart | Channel ROI & Analytics ⇄ AI Provider Performance Analytics (segmented toggle) |
| **Providers** | robot | Smart Fallback Rule Builder → Fallback Sandbox |

Pipeline stages used throughout: **Idea → Script → Render → Approval → Scheduled → Published**. Priority: High / Medium / Low.

## 3. Screens (one section per screenshot)

### 3.1 Dashboard (home)
- 3 KPI tiles: Subscribers, Total Views, Videos Live (with delta line).
- Monthly goal progress bars (Subscribers / Views / Videos).
- **Publishing Queue** card: each item = platform icon (TikTok / Reels / YouTube), title, "Automated" or "Scheduled" tag, and a live countdown ("Live in: 00:14:25", "04:30:10", "1 Day, 12:00:00").
- Quick-link row → Studio, Bulk Actions, Fallback Sandbox.

### 3.2 Channel ROI & Analytics  *(screenshot 6)*
- Header: back + title + filter icon.
- **Estimated Tax Saved** hero card: big green `£4,250.00 ↗`, subtitle "Based on Self-Assessment contributions from video topics", HMRC/piggy-bank glyph.
- **Engagement Heatmap (Last 7 Days)**: two mini grids side by side (TikTok / Reels), rows = days, cols = 9h/12h/15h/18h/21h, cell colour low→high (green→amber→red). Legend bar Low … High.
- **Cost vs Performance (GBP)**: dual-line area chart — Cost (£, red) vs Views/Revenue (k, green) over dates, y-axis £0–£20.
- **Publishing Queue** (same component as Dashboard).
- Bottom tabs: Dashboard / Videos / Analytics / AI Studio / Profile.

### 3.3 AI Provider Performance Analytics  *(screenshot 5)*
- Segmented period control: Last 24h / **7 Days** / 30 Days.
- **Success Rate**: horizontal stacked bars per provider — Runway Gen-4 92/8, Veo 3 85/15, Fal.ai 78/22, HeyGen 95/5 (green = success, red = fail, % labels inside).
- **Cost vs Quality** scatter: x = Quality Score 1–10, y = Cost per Minute £0–6; bubbles for Runway Gen-4 (£4.50), Veo 3 (£3.80), Fal.ai (£2.20), HeyGen (£5.10) with provider glyph + label; legend.
- **Comparison table**: Provider · Avg Render Time · Cost per Sec · Prompt Adherence % · API Reliability (✓ green / ⚠ amber pill), with up/down trend arrows on each cell.
  - Runway Gen-4: 3m45s · £0.075 · 88% · 99.8%
  - Veo 3: 4m10s · £0.063 · 82% · 98.5%
  - Fal.ai: 5m20s · £0.036 · 75% · 95.0%
  - HeyGen: 2m30s · £0.085 · 94% · 99.9%

### 3.4 Video Creator  *(screenshot 7)*
- Title: `Video Creator: "Pension Basics for Q4"`.
- **Circular render progress**: 75% Rendered, "Est. Time: 4m 15s".
- Stat row: "Scene 6 of 12 — Processing", "Total Duration: 3:45", "Render Cost: $4.25".
- **Scene-by-Scene Timeline**: horizontal scroll of scene thumbnails (9:16), each with label + duration; states = done / processing (spinner) / **error** (red ring + "Quick Retry"). Scenes shown: 1 Intro 0:15, 2 The Problem 0:30, 3 Case Study 0:20 (error), 4 Expert Tip 0:25, 5 Solution 0:40, 6 Data Analysis (processing).
- **Instant Preview** player: scrubber + waveform, "Previewing Scene 5–6", play button.
- Buttons: open **Script Editor & Storyboard Tune**, open **Live Events**.

### 3.5 Live Events (orchestration log)  *(screenshots 8 & 9)*
- Floating panel: "Live Events" + Clear (🗑) + Pause toggle. Ladybug "debug" FAB bottom-right.
- Monospace event stream, newest at bottom-ish; each line: `[HH:MM:SS.mmm]` + level tag + message + `Copy JSON` chip; ERROR lines also get a `Retry` button.
- Levels: **ORCHESTRATE** (blue), **SUCCESS** (green), **ERROR** (red).
- Seeded sequence: init AI script gen → script generated (1200 words) → ERROR voiceover synthesis (API timeout) → retrying → success → assembling clips → ERROR clip `chart_animation_v3.mp4` not found.
- Tapping `Copy JSON` copies a structured event object; `Retry` re-emits an ORCHESTRATE "Retrying …" line.

### 3.6 Script Editor & Storyboard Tune  *(screenshot 10)*
- Header: back + title + pin icon. Sub-bar: "Live Word Count: 450 | Est. Duration: 03:15" (updates as you edit).
- **Script Editor**: editable script body with inline prosody tags rendered as coloured chips: `[Emphasis: Strong]` (purple), `[Speed: Fast]`/`[Speed: Slow]` (blue), `[Pitch: High]`/`[Pitch: Low]` (green). Selecting text + a tuning control inserts the tag.
- **ElevenLabs Prosody Tuning** popover: sliders — Speed 0.8×–1.5×, Emphasis 0–100, Pitch −2…+2.
- **Storyboard Tune & Prompt Engineer** sheet:
  - **Character Sync** toggle (ON) — "Locks British presenter attributes across all prompts".
  - Per-scene prompt cards (Scene 1: Intro, Scene 2: ISA Rules Explained, …): editable prompt textarea ending `[Sync: Locked]`, buttons **Tweak Prompt** / **Render Scene**.
- Bottom tabs (sheet's own): Home / Script/Board / Render Queue / Profile.

### 3.7 Batch Approval Review Feed  *(screenshot 1)*
- Header: back + "Batch Approval Review Feed" + progress "3/10 Reviewed" with a thin progress bar.
- **Swipe card stack**: full-bleed video card — thumbnail, source badge ("UK Personal Finance"), title overlay ("Understanding Capital Gains Tax for UK Creators").
  - Swipe/tap **right → APPROVE** (green ✓), **left → REJECT** (red ✗). Card animates out, next card advances, counter increments.
- Comment input ("Comment…" + mic) + **Send Feedback**.
- Bottom sheet: "Batch Summary: 3 of 10 videos approved. Session Progress." + **REVIEW LATER**.

### 3.8 Bulk Actions  *(screenshot 2)*
- Header: filter icon + "Bulk Actions" + Done.
- Filter chips: Stage: All ▾, Priority: High ▾.
- Items grouped by stage with "(n Selected)" counts: **Idea** (Pension Reform 2024…, Top 5 ISA Providers), **Script** (Understanding Capital Gains Tax, Crypto for Beginners Guide), **Render** (How to Budget with Inflation — Multi-Provider AWS/GCP, Debt Consolidation Strategies — Azure/AWS). Each row: checkbox, title, "AI Draft (Idea) | High Priority" meta, stage glyph (💡/📜/▶). Selected rows get a gold ring.
- Sticky bottom action bar: **n Items Selected** · Batch Generate Scripts (🤖) · Batch Render (Multi-Provider) (☁) · Bulk Move to Approval (➡) · Delete Selected (🗑).

### 3.9 Fallback Sandbox  *(screenshot 3)*
- Header: back + "Fallback Sandbox".
- **Simulate Scenario** dropdown: Runway Out of Credits / Veo 3 High Latency / API Timeout.
- **Flow diagram** (vertical): Request → **Primary Provider** (red "Error: Out of Credits") → "Fallback Triggered" → **Fallback 1** (Secondary Provider: Veo 3 — Status: Active) → **Final Output** (Status: Rendering). Animated connectors.
- **Results** card: Hypothetical Cost £12.50 · Time to Render 2m 35s · Quality Impact Medium (720p). Results change per scenario.
- **Simulate Again** button (re-runs, can randomise which fallback catches).

### 3.10 Smart Fallback Rule Builder  *(screenshot 4)*
- Header: Back + "Smart Fallback Rule Builder" + Save.
- **Priority Ladder & Fallbacks**: draggable rows (⠿ handle) — 1. Runway Gen-3 (Top Priority, "Active (Primary)"), 2. Veo 3 (Secondary, "Ready (Backup)"), 3. HeyGen (Tertiary, "Ready (Backup)"). Each row: provider glyph, two toggles — "Auto-fallback on error", "Auto-fallback on high latency". Primary shows "Estimated latency: <5s".
- **Cost Cap per Video Project**: slider £0–£500, current £250.00.
- **Smart Routing Logic → Conditional Rules**: list of IF→THEN rule cards (IF scene movement > 5 (High Motion) THEN use Runway Gen-3; IF scene type is Talking Head THEN use HeyGen) + **+ Add Rule**. Save persists to local state and toasts.

## 4. State / data model (prototype)

All in-memory React state, seeded with the data above. Key shapes:

```
Project   { id, title, platform, stage, priority, providers[], emoji }
QueueItem { id, title, platform, type: 'Automated'|'Scheduled', secondsLeft }
Provider  { id, name, glyph, color, successRate, costPerMin, quality,
            renderTime, costPerSec, adherence, reliability, fallbackOnError, fallbackOnLatency }
Scene     { id, label, durationSec, status: 'done'|'processing'|'error', prompt, syncLocked }
LogEvent  { ts, level: 'ORCHESTRATE'|'SUCCESS'|'ERROR', message, payload }
Rule      { id, ifText, thenProviderId }
Review    { id, title, source, thumbEmoji, decision: null|'approve'|'reject', comment }
```

## 5. Out of scope (prototype)
- Real API calls (the original FinCast build hit `api.anthropic.com` directly from the browser — removed; "Generate" buttons now simulate). Wire a backend later.
- Real video render / ElevenLabs / Runway / Veo / HeyGen integrations.
- Auth, persistence, multi-user.

## 6. TODO / ideas not yet in screenshots
- Calendar view for the Wed/Fri/Sun cadence (was in the original FinCast build).
- Pre-publish checklist (was in the original FinCast build) — fold into the Batch Approval flow.
- Shorts-repurposing view (long-form → 3–5 Shorts).
- Per-video P&L (render cost vs ad/affiliate revenue) feeding the ROI screen.

## 7. Google Stitch (pending)
The Stitch MCP server (`stitch.googleapis.com`) was **unreachable from the build environment** (DNS resolution failure), so the planned Stitch screen generation didn't run. When connectivity is available:
1. `create_project` → "Faceless Finance App".
2. `create_design_system` (or `create_design_system_from_design_md`) from the §1 tokens so all screens share styling.
3. `generate_screen_from_text` for each §3 screen (start with Dashboard, Video Creator, Smart Fallback Rule Builder), `deviceType: MOBILE`.
4. Drop the resulting Stitch project URL here and reconcile any visual deltas back into `Faceless Finance App.jsx`.

Until then, the `.jsx` prototype carries a manual Material-3 / Stitch-flavoured pass (pill buttons, `elev1`/`elev2` shadows, tonal surfaces, Google-Sans-first font stack).

## 8. Changelog
- **2026-05-13** — Renamed FinCast → Faceless Finance App; folder `Work/FinCast/` → `Work/Faceless Finance App/`; files `FinCast.jsx`/`FinCast App Spec.md` → `Faceless Finance App.jsx`/`Faceless Finance App Spec.md`; in-app branding, design tokens and button shape updated; added §7 Stitch plan.
- **2026-05-13** — Initial rebuild from the 10 reference screenshots (10 screens, 5-tab mobile shell).
