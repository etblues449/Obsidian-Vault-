# Smart Home Master Plan — the road to "perfect"

**Created:** 2026-08-01 · **Owner:** Elliot (Jelly Bean) · **Hub:** HA Green @ 192.168.0.200
**Provenance:** every claim below is sourced from the vault (index, handoffs, hardware
guides, 2026-08-01 dashboard audit + vendor-BSP verification) or explicitly marked
UNVERIFIED. Nothing invented.

---

## 1. The end goal, made concrete

"A perfect smart home" for this house means:

1. **Presence-aware everywhere** — every occupied room knows someone is there
   (radar/CSI/camera), and lighting, climate and media respond without being asked.
2. **Voice everywhere, "Hey Jarvis" native** — a satellite in every main room; commands
   resolve by *area* with no entity-name gymnastics; TTS replies come from the room
   you're in.
3. **Eyes where it matters** — Frigate with person detection on lounge (ai_cam), CCTV
   and porch; recording + notifications that mean something.
4. **JARVIS as the brain, not just the mouth** — captures, briefings, and automations
   flow through the vault + skill engine; the house acts, the vault remembers.
5. **£0/month forever (C1)** and **one write path** — no paid cloud in the loop, one
   serialized writer to `master`.
6. **Truthful state** — what the docs claim ≡ what the registry shows ≡ what the
   hardware does. `ha-doctor` proves it on demand.

## 2. Laws of this build (hard-won, do not relitigate)

| Law | Source |
|---|---|
| Vendor BSP beats product images — 4h lost to a wrong audio pin map | 2026-07-23 handoff |
| ESPHome I²S is a **mutex**: no barge-in; speaker `timeout: never` permanently blocks the mic | 2026-07-28 |
| One I²S bus, two children (speaker + mic on same `i2s_audio_id`) | 2026-07-27 |
| AEC cancels only the board's **own** playback — an external TV can never be cancelled (no reference) | Far-Field guide |
| BLE + mmWave on one ESP32 contend — split nodes | index decision |
| Camera power on CAM boards is expander-gated (CH32V003 EXIO3 LOW; 10K pull-down default-on) | handoff + BSP verify 2026-08-01 |
| Two automated vault writers corrupted the vault once — never again | CLAUDE.md |
| "Documented ≠ merged ≠ running" — verify each separately | MEMORY.md |

## 3. Current estate (verified inventory)

### Nodes & devices

| Device | IP | State (source) |
|---|---|---|
| **HA Green hub** — HA 2026.7.3, ESPHome 2026.7.1, Frigate, RuView CSI Bridge add-on | .200 | live (skill engine commits prove reachability of repo side; hub state itself → run ha-doctor) |
| **ai_cam** — Waveshare ESP32-S3-CAM-OV3660: OV3660 MJPEG :8080/:8081, ES8311 TTS, ES7210 dual mics (custom component), microWakeWord "Hey Jarvis", buttons, LED | .199 | **COMPLETE 2026-07-29** |
| **2nd CAM-OV3660 board** | — | **unflashed** — port ai_cam config (new IP + API key) |
| **ESP32-S3-AUDIO-Board** (lounge voice satellite; ES8311 + ES7210 4-ch, dual mic, 7×RGB) | .216 | config authored (`jarvis-lounge`); **flash/verify NOT recorded** — AFE block marked `<<VERIFY>>` |
| **espspeaker** ("ESP Speaker", far-field tuned; TCA9555 expander, 3 keys, LED ring) | not recorded | config exists, heavily tuned; **whether it's the same physical unit as .216 is NOT recorded — do not conflate** |
| **HA Voice PE** (`assist_satellite.home_assistant_voice`) | — | exists per dashboard; labelled both "Bedside" and "Lounge" — location undecided |
| **RuView CSI node 3** (WiFi-CSI presence/breathing/heart-rate) | .227 (MAC e0:72:a1:e7:03:60) | live, phone-free; DHCP reservation still pending |
| **Upstairs node** | .171 → planned .207 | **blocked**: IP collision fix unapplied; BLE/radar contention unresolved |
| **cctv_cam** (Frigate) | .234 | configured; **verify power** — suspected hardware-down |
| **porch** (Frigate) | .240 | configured; **verify power**; battery deployment planned |
| Bedroom radar node (`binary_sensor.bedroom_presence`, `sensor.bedroom_wifi_signal`) | — | live per dashboard use; health card was removed — unmonitored |
| Lounge/Kitchen radar (`binary_sensor.lounge_presence`), landing radar (`binary_sensor.landing_presence`) | — | referenced by dashboards |
| **Fold 7** — Termux (Claude Code v2.1.112 pinned), Tasker, Obsidian, companion app | — | operational; jarvis-core agent lives in separate repo `etblues449/jarvis-core` |
| Windows PC | — | Obsidian + ESPHome Builder + bridge |
| Lounge TV — `media_player.tv_jelly_beans_tv_2` (canonical) | — | live; also the main far-field noise source |
| Spotify — `media_player.spotify_elliot_horton` (native integration) | — | used by canonical dashboard |

### Rooms

- **Lounge:** complete, ~19 automations (count is the only record — the YAML lives
  only on the hub; see Phase 0.4).
- **Bedroom:** operational (`bedroom-2.yaml` canonical — also hub-side only).
- **Upstairs:** blocked on IP collision + BLE/radar split.
- **Kids room:** bedtime countdown automation existed; card removed deliberately.

### Software/agent layer

- **Skill engine (£0):** GitHub Actions + Groq, 4 scheduled skills — **VERIFIED
  RUNNING** (automated commits for skills 1/3/4/6 landed on master 2026-08-01).
- **Capture:** Tasker → n8n webhook (paid) → `JARVIS/Inbox/` — **still on n8n**, with a
  known empty-capture bug and a **live drift bug**: newer captures land in root
  `Inbox/` which the engine does not read (5 invisible captures, to 2026-07-09).
- **Voice web agent:** jarvis-voice-lovat.vercel.app (£0) — LIVE per session note.
- **ES7210 ESPHome component:** written from scratch, works on hardware — **currently
  on this branch only; `ref: master` consumption is broken until this PR merges.**
- **Obsidian-native JARVIS v3** (capture/ask/digest in-app) — complete 2026-06-19.

## 4. Home Assistant software diagnosis (what we know without the LAN)

From the vault side (full detail: [[diagnostics/2026-08-01-dashboard-audit]]):

- **Dashboard:** canonical file had 4 stale TV refs (**fixed on this branch**); AI Cam
  entity naming disputed between dashboards (`living_room_ai_cam_*`) and index
  (`ai_cam_*`) — ha-doctor §12 resolves it; cctv_cam and the 6 RuView MQTT entities
  missing from every dashboard version; bedroom node health unmonitored; 8 HACS deps.
- **Assist:** `no_valid_targets` for unmapped rooms — root cause is **area assignment**
  (lights not assigned to Areas / no aliases). ha-doctor §9 counts exactly which
  actionable entities lack an Area.
- **Automations/scenes/scripts/people/companion app:** live only on the hub — zero
  vault records. **The diagnosis instrument is built:** run
  `Assistant Core/ha-diagnostics/ha-doctor.mjs` from the Fold 7 or PC (admin token) and
  commit the report to `diagnostics/`. It audits all 13 areas incl. broken automations,
  scene dead-members, presence trackers, pending updates, node probes and error log.

## 5. The roadmap

Each phase is shippable on its own; order chosen so truth precedes construction.

### Phase 0 — Truth first (this week, ~1 hour of hands-on)
1. **Merge PR #71** — unbreaks `ref: master` for the ES7210 component; lands ha-doctor,
   this plan, and the dashboard fix on master.
2. **Run ha-doctor** on the LAN (`--out` into `diagnostics/`), commit the report. It
   settles: entity naming, RuView-on-dashboard claim, automation/scene health, areas,
   companion app, cctv/porch reachability, updates.
3. **Fix Areas/aliases from the report** — assign lounge lights to Living Room etc.
   This alone fixes the voice `no_valid_targets` failures.
4. **Back up hub-side config into the vault**: export `automations.yaml`,
   `bedroom-2.yaml`, `frigate.yaml`, scenes and scripts into
   `Claude Memory/Projects/Smart Home/ha-config/` (read-only copies). The ~19 lounge
   automations currently exist nowhere but the hub — one SD failure erases them.
5. Deploy the corrected dashboard; verify the 8 HACS deps.

### Phase 1 — Network & node hygiene (one evening)
- Apply the **.171 → .207** move (ESPHome OTA), delete the ghost "Upstairs" builder
  config, add DHCP reservations (RuView → .227; ideally every static node).
- **Power-check cctv_cam (.234) and porch (.240)** — ha-doctor's probe section says
  which respond; physical check for the rest.
- Flash the **EXIO3 settle-delay fix** on ai_cam (proposed in the hardware guide;
  10-reboot verification protocol included).

### Phase 2 — Voice everywhere (the JARVIS feel)
- **Port ai_cam config to the 2nd CAM-OV3660** (new IP + API key; everything else
  identical — the ES7210 component consumption starts working once PR #71 merges).
- **Flash + verify the ESP32-S3-AUDIO-Board** (.216): base config first, then reconcile
  the `<<VERIFY>>` AFE block against the installed ESPHome's schema.
- **Reconcile espspeaker's config with the I²S-mutex law**: it still carries
  `timeout: never` (blocks its mic per the 2026-07-28 finding) and `force_master: true`
  — retest both on that hardware; do not assume barge-in.
- **Decide Voice PE's room** (bedside vs lounge) and fix the dashboard labels.
- Placement per the Far-Field guide: satellite closer to the seat than the TV,
  off-axis; 2–3 satellites for the lounge. If loud-TV-at-3m still fails → the honest
  fix is a 4-mic XMOS array (ReSpeaker XVF3800 / HA Voice PE) as lounge primary,
  Waveshare boards redeployed to quieter rooms.
- Expose rooms/aliases in Settings → Voice assistants → Expose (manual — no API).

### Phase 3 — Eyes: Frigate to full strength
- All 3 cameras live in Frigate (ai_cam already is; cctv + porch from Phase 1).
- **Porch battery deployment** (~£80–110): IP67 enclosure, bracket, power-bank swap
  model, **meter-check J4 polarity first — no reverse protection**; ~9–12h per 3000mAh.
- Person-detection notifications → companion app on the Fold 7.
- Optional ai_cam extensions now unblocked by the BSP verification: microSD
  (`sd_mmc_card`, CLK 16/CMD 43/D0 44), battery sensor (expander ADC reg `0x06`),
  LCD backlight (PWM reg `0x05`) — each a small `waveshare_io_ch32v003` extension.

### Phase 4 — Presence depth (upstairs + whole-home)
- **Split upstairs BLE and mmWave onto two nodes** (the law). Radar node keeps .207;
  new BLE node gets its own IP.
- Re-add a bedroom-radar health card; add RuView's 6 MQTT entities to the dashboard
  (or record where the UI-managed dashboard shows them).
- Presence-driven scenes per room (lounge pattern → bedroom, upstairs, landing).
- RuView CSI: document tuning/calibration (currently unrecovered stub content).

### Phase 5 — JARVIS closes the loop (£0 completion)
- **Phase-2 capture router** (GitHub `on: push`): retires the paid n8n webhook
  (last paid component → C1 fully satisfied), fixes the empty-Tasker-capture bug via a
  junk filter, and **must also fix the Inbox drift** — either point the router at
  `JARVIS/Inbox/` exclusively or migrate the engine to read root `Inbox/`; today 5
  captures are invisible to the engine.
- Deactivate the 4 n8n scheduled workflows (engine already verified green — but only
  after confirming capture has moved, single-writer law).
- Voice PE / satellites → Assist pipeline → the same intents jarvis-core exposes;
  Music Assistant target on ai_cam + espspeaker (optional).
- Later, from the research shelf: Shizuku/AccessibilityService phone-UI control;
  MultiNet offline commands for network-down resilience.

## 6. Hardware to buy / build (consolidated)

| Item | For | Status |
|---|---|---|
| **N100 mini PC (~£140)** | HA host upgrade — the Green is **margin-zero**: wake-word (TFLite) compiles OOM its compiler; N100 also carries Frigate + future nodes | budgeted per 2026-08-01 handoff; the structural fix behind the mWW regression |
| 18650 cells (+holder/JST pigtail — or LiPo pouch w/ JST, lower friction) | porch battery | on the order list since index |
| 5V servo rail | (purpose not recorded in vault) | on the order list |
| IP67 enclosure + bracket (~£80–110 all-in) | porch cam | planned |
| 4-mic XMOS array (ReSpeaker XVF3800 or HA Voice PE) | lounge primary, only if 2-mic ceiling proves real | decision gate in Phase 2 |
| 2nd CAM-OV3660 | already owned | flash in Phase 2 |
| microSD card | ai_cam recording buffer | Phase 3 optional |

## 7. Success criteria ("perfect" = all checked)

- [ ] ha-doctor: 0 ❌ sections, canonical checks 100%, report committed monthly
- [ ] Every actionable entity has an Area; voice commands resolve room-relative
- [ ] "Hey Jarvis" answered from lounge, bedroom, upstairs (satellite per room)
- [ ] 3/3 Frigate cameras recording with person detection + phone notifications
- [ ] Upstairs presence live (BLE + radar on split nodes)
- [ ] Capture: phone → vault with zero paid services and zero silent drops
- [ ] Hub config mirrored read-only in the vault (survives SD death)
- [ ] £0/month standing cost; one vault writer; both vault checkers green

## 8. Verification cadence

- **ha-doctor** monthly + before/after any HA upgrade or node addition → report diff
  is the drift signal.
- `drift-check.sh` + `verify-refs.py` at session end (already harness policy).
- Any new Waveshare board: clone vendor repo, read BSP header FIRST (the law).

---
*Related: [[_index]] · [[smart_home]] · [[diagnostics/2026-08-01-dashboard-audit]] ·
[[hardware/Waveshare ESP32-S3-CAM-OV3660 — Arduino IDE Setup (CORRECTED)]] ·
[[hardware/ESP32-S3-AUDIO-Board — Far-Field Voice Guide]] ·
`Assistant Core/ha-diagnostics/` (the instrument)*
