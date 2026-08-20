# Smart Home Master Plan — the road to "perfect" (v2)

**v2: 2026-08-04** · supersedes v1 (2026-08-01) · **Owner:** Elliot (Jelly Bean) · **Hub:** HA Green @ 192.168.0.200
**What changed in v2:** folds in the first full HA diagnosis (2026-08-02 ha-doctor), the
AI-Mode camera transcript root-cause + compile-verified Arduino fix (2026-08-04), the
`landing_ai_cam_2` discovery, the PyPI/add-on ESPHome channel gap fix, a room-by-room
end-state map, and re-baselined phase status. **Provenance:** every claim sourced from
the vault, the 2026-08-02 ha-doctor report, or verification performed 2026-08-04
(vendor BSP + vendor Arduino example read; Arduino compile; ESPHome full-config
validation). Anything else is marked UNVERIFIED.

---

## 1. The end goal, made concrete (unchanged — locked)

"A perfect smart home" for this house means:

1. **Presence-aware everywhere** — every occupied room knows someone is there
   (radar/CSI/camera), and lighting, climate and media respond without being asked.
2. **Voice everywhere, "Hey Jarvis" native** — a satellite in every main room; commands
   resolve by *area*; TTS replies come from the room you're in.
3. **Eyes where it matters** — Frigate with person detection on lounge, landing, CCTV
   and porch; recording + notifications that mean something.
4. **JARVIS as the brain, not just the mouth** — captures, briefings and automations
   flow through the vault + skill engine; the house acts, the vault remembers.
5. **£0/month forever (C1)** and **one write path** — no paid cloud in the loop, one
   serialized writer to `master`.
6. **Truthful state** — docs ≡ registry ≡ hardware. `ha-doctor` proves it on demand.

## 2. Laws of this build (hard-won — do not relitigate)

| Law | Source |
|---|---|
| Vendor BSP beats product images — 4h lost to a wrong audio pin map | 2026-07-23 handoff |
| **Camera power on CAM boards is expander-gated** — EXIO3 LOW = on (10K pull-down default-on); `0x106` is a power problem, not a pin problem | handoff + BSP verify + transcript root-cause |
| **In vendor Arduino examples, model defines lie**: Waveshare repurposes the `ESP_EYE` slot for its own pins — same define, different pins vs stock Espressif files | 2026-08-04 vendor-repo read |
| **PyPI ESPHome trails the HA add-on channel** — off-box builds may lack components the hub has (proven: `waveshare_io_ch32v003` absent ≤2026.6.5); pin official components by release tag | 2026-08-04 validation |
| **A board flashed with non-ESPHome firmware drops off HA silently** — check what firmware a "dead" node actually runs before blaming network/power | landing_ai_cam_2 hypothesis |
| ESPHome I²S is a **mutex**: no barge-in; speaker `timeout: never` permanently blocks the mic | 2026-07-28 |
| One I²S bus, two children (speaker + mic on same `i2s_audio_id`) | 2026-07-27 |
| AEC cancels only the board's **own** playback — an external TV can never be cancelled | Far-Field guide |
| BLE + mmWave on one ESP32 contend — split nodes | index decision |
| ES8311 on THIS board is I²S **SLAVE** (BSP: `.master_mode=false`); no `force_master` | BSP + corrected guide |
| Two automated vault writers corrupted the vault once — never again | CLAUDE.md |
| "Documented ≠ merged ≠ running" — verify each separately | MEMORY.md |
| Never record a 403 as a missing file | MEMORY.md (+ re-proven 2026-08-04) |

## 3. Current estate (re-baselined 2026-08-04)

### Nodes & devices

| Device | IP | State (evidence date) |
|---|---|---|
| **HA Green hub** — Core **2026.8.0b2 beta**, OS 18.2.rc1, 234 integrations, Frigate, RuView bridge | .200 | live, config valid (08-02) — 4 updates pending; **beta on prod = risk** |
| **ai_cam** — Waveshare CAM-OV3660 #1, MAC `28:84:85:49:83:C8` | .199 | **live** — camera/Frigate/TTS/mics/Assist working; **wake word regressed** (build minus mWW; Green compiler OOM). Fix = Option B compile |
| **landing_ai_cam_2** — CAM-OV3660 #2, provisioned in HA | — (suggest .198) | **offline — likely carrying the Arduino-transcript firmware.** Flash [[hardware/landing_ai_cam_2]] (first flash USB) |
| **espspeaker** ("Living Room ESP Speaker") | not recorded | offline; ~24 dead entities; config carries `timeout: never` + `force_master` → reconcile with I²S law before reflash |
| **HA Voice PE** (`home_assistant_voice_09eabd`) | — | offline; room undecided (labelled both Bedside and Lounge) |
| **ESP32-S3-AUDIO-Board** (`jarvis-lounge` config authored) | .216 | flash/verify never recorded; ES7210 component applies to it |
| **RuView CSI node 3** (presence/breathing/heart-rate) | .227 (MAC e0:72:a1:e7:03:60) | CSI entities unavailable on 08-02 → LAN probe; DHCP reservation still pending |
| Bedroom presence node | .171 | offline; feeds 3 stale automations; IP-collision fix (.171→.207 plan) unapplied — reconcile which node this really is |
| Porch servo/switch node | .206 | offline (new node, first recorded 08-02) |
| **cctv_cam** (XIAO) | .234 | offline — physical check needed |
| **porch cam** | .240 | offline — physical check; battery deployment planned |
| Lounge/Kitchen radar node (physically in the **kitchen**) | — | live per dashboard use; rename pending |
| Landing radar | — | referenced by dashboards; automations stale → verify |
| Samsung TV — **canonical `media_player.jelly_beans_tv_3`** (decided 08-02) | — | live; main far-field noise source |
| Spotify `media_player.spotify_elliot_horton` (native) | — | live |
| Six Govee/smart bulbs + music-mode/scene entities | — | ~40 entities unavailable → power/integration check |
| **Fold 7** — companion app (14 entities), Termux JARVIS terminal (CC v2.1.112 pinned) | — | operational; person tracking healthy |
| Windows PC | — | Obsidian, ESPHome off-box build machine (Option B), bridge |

### HA app snapshot (2026-08-02 ha-doctor)

520 entities / **156 unavailable (30%)** / 24 unknown · **8 automations** (3 stale-May,
1 never-fired; the old "~19 lounge automations" belief is contradicted by the registry) ·
1 scene · 0 scripts · 1 person + 2 trackers (healthy) · companion 14 entities ·
6 areas + **10 area-less actionables** · 4 pending updates · **1/4 voice satellites
online**. Full detail + repair queue: [[diagnostics/2026-08-04-full-home-diagnosis]].

### Software/agent layer

- **Skill engine (£0):** GitHub Actions + Groq — repaired 2026-08-02 (period-idempotency
  guard; 26/26 offline tests green). Capture Router built; **phone leg still on paid n8n
  + Tasker variable bug open** (last real capture 2026-07-09).
- **ES7210 ESPHome component:** written from scratch, on master, reusable (.216 board too).
- **Obsidian-native JARVIS v3 + voice web agent + Carousel:** live.
- **ha-doctor:** proven instrument; needs one LAN run for node probes + error_log.

## 4. Room-by-room: now → end state

| Room | Presence | Voice | Eyes | Now (verified) | End state |
|---|---|---|---|---|---|
| **Lounge/Living Room** | radar (kitchen-sited node) + ai_cam person | ai_cam (wake word pending Option B); espspeaker + Voice PE candidates | ai_cam in Frigate ✅ | richest room: 142 entities; automations live | wake word + area-resolved voice; TV-noise strategy per Far-Field guide (satellite nearer seat than TV; XMOS array only if 2-mic ceiling proves real) |
| **Kitchen** | shares lounge node (rename it) | — | — | 76 entities | own presence identity; voice via lounge satellite or espspeaker relocated |
| **Bedroom** | node .171 **down** | Voice PE if "Bedside" wins | — | 3 automations stale since May | revive node → automations resume; bedside voice + wake-word-safe TTS |
| **Kids room (Haribo)** | — | — | — | light + switch exist but **area-less** | create area, assign, bedtime scene returns |
| **Landing** | landing radar (verify) | **landing_ai_cam_2** — flash delivered YAML | landing cam → Frigate | satellite provisioned but offline | 2nd "Hey Jarvis" point + person detection upstairs approach |
| **Dining Room** | — | area name fixed ("Dinning"→"Dining" 08-02) | — | 12 entities | voice resolves; presence via future node |
| **Upstairs** | **blocked**: BLE/radar contention + IP collision | — | — | oldest open item | split BLE + mmWave across two nodes (.207 radar + new BLE node) |
| **Porch** | — | — | porch cam .240 + servo node .206, both down | area has 0 entities | battery cam deployed (IP67, J4 polarity check first), person-notify to Fold |

## 5. The roadmap (phases re-baselined)

### Phase 0 — Truth first ✅→◐ (mostly DONE)
- [x] PR #71 merged (ES7210 `ref:master` unbroken) — 2026-08-02
- [x] First full ha-doctor run + report committed — 2026-08-02
- [x] Canonical TV decided (`jelly_beans_tv_3`); "Dinning Room" typo fixed live
- [x] Camera transcript root-caused; Arduino path compile-verified; runbook PyPI gap fixed — 2026-08-04
- [ ] **P0: Back up hub-side config into the vault** (`automations.yaml`, `bedroom-2.yaml`,
      `frigate.yaml`, scenes/scripts, the FLASHED ai_cam.yaml, `ui-lovelace-minimal.yaml`)
      → `ha-config/`. One SD failure currently erases the lot. 15 minutes. Do this first.
- [ ] Declare the canonical dashboard (new 3-view vs v2-corrected), deploy, verify 8 HACS deps
- [ ] One LAN ha-doctor run (node probes + error_log)

### Phase 1 — Network & node hygiene (one evening)
- [ ] Revive/reflash the dead fleet in this order: **landing_ai_cam_2** (delivered YAML,
      USB first flash) → espspeaker (fix `timeout:`/`force_master` first) → Voice PE →
      bedroom .171 → cctv .234 / porch .240 / porch-servo .206 (physical power check first)
- [ ] Apply .171→.207 move; delete ghost "Upstairs" builder config; DHCP reservations
      (RuView .227 + every static node)
- [ ] Re-run ha-doctor; then **registry cleanup** of what's still dead (eshare ×5,
      soundbar_2, jelly_bean_s_tv, sambed…)

### Phase 2 — Voice everywhere (the JARVIS feel)
- [ ] **Option B off-box compile for ai_cam → "Hey Jarvis" back** (~15 min; runbook +
      the new external-component pin). Verify with wake-word selects available + 10-reboot
      camera race check
- [ ] Landing satellite live (same Option B recipe — config delivered)
- [ ] Flash + verify .216 audio board (`jarvis-lounge`); reconcile `<<VERIFY>>` AFE block
- [ ] Decide Voice PE's room; fix dashboard labels
- [ ] Areas/aliases: assign the 10 orphans, create kids-room area, expose aliases →
      `no_valid_targets` gone
- [ ] Placement per Far-Field guide; XMOS array is a *gate*, not a purchase, until the
      2-mic ceiling is proven at loud-TV-3m

### Phase 3 — Eyes to full strength
- [ ] 4 cameras in Frigate (ai_cam ✅, landing, cctv, porch) with person detection
- [ ] Person-detection notifications → companion app
- [ ] **First AI-Cam automations** (the registry has zero today): porch/landing person
      notify, lounge occupancy assist, snapshot-to-SD on event
- [ ] Porch battery deployment (~£80–110; meter-check J4 polarity first; ~9–12h per 3000mAh)
- [ ] ai_cam extras now unblocked: microSD (in target config ✅), battery ADC (expander
      reg 0x06), LCD backlight (PWM reg 0x05) — small `waveshare_io_ch32v003` extensions

### Phase 4 — Presence depth
- [ ] Upstairs BLE/mmWave split across two nodes (the law)
- [ ] Bedroom-radar health card back on the dashboard; RuView's 6 MQTT entities on a
      dashboard (or record where the UI-managed one shows them)
- [ ] Presence-driven scenes per room (lounge pattern → bedroom, landing, kids room)

### Phase 5 — JARVIS closes the loop (£0 completion)
- [ ] Phase-2 capture router phone leg: fix the Tasker variable at source, retarget the
      phone at the GitHub Contents API → **last paid component (n8n) dies; C1 satisfied**
- [ ] Formally retire/deactivate the 4 n8n workflows + confirm account state
- [ ] Satellites → same intents jarvis-core exposes; Music Assistant targets (optional)
- [ ] Research shelf: Shizuku phone-UI control; MultiNet offline commands

## 6. Hardware to buy / build (consolidated)

| Item | For | Status |
|---|---|---|
| **N100 mini PC (~£140)** | structural fix: Green is margin-zero (wake-word TFLite OOMs its compiler); also carries Frigate growth | budgeted — buy when Option B friction annoys |
| 18650 cells or LiPo w/ JST | porch battery | on order list |
| IP67 enclosure + bracket (~£80–110 all-in) | porch cam | planned |
| microSD card | ai_cam + landing cam snapshot buffer (config support ✅ delivered) | cheap, get two |
| 4-mic XMOS array (ReSpeaker XVF3800 / HA Voice PE) | lounge primary | **gated** on proving the 2-mic ceiling |
| 5V servo rail | porch servo node .206 | purpose now recorded (porch) |
| 2nd CAM-OV3660 | landing satellite | **owned + provisioned** — just flash it |

## 7. Success criteria ("perfect" = all checked) — v2 baseline

- [ ] ha-doctor: 0 ❌ sections, canonical checks 100% *(08-02: 6/7 — TV check now updated)*, report committed monthly
- [ ] Unavailable entities < 5% *(now: 30%)*
- [ ] Every actionable entity has an Area *(now: 10 orphans)*; voice resolves room-relative
- [ ] "Hey Jarvis" answered in lounge, landing, bedroom *(now: 0 rooms — push-button only)*
- [ ] 4/4 Frigate cameras recording with person detection + phone notifications *(now: 1/4)*
- [ ] ≥1 automation driven by each sense layer (camera, radar, CSI, voice) *(now: 0 camera-driven)*
- [ ] Upstairs presence live on split nodes
- [ ] Capture: phone → vault, £0, zero silent drops *(engine fixed; phone leg pending)*
- [ ] Hub config mirrored read-only in the vault *(NOT YET — P0)*
- [ ] £0/month standing cost; one vault writer; both checkers green

## 8. Verification cadence & instruments

- **ha-doctor** monthly + before/after any upgrade or node change; diff = drift signal
- `drift-check.sh` + `verify-refs.py` at session end (harness policy)
- Any new Waveshare board: clone vendor repo, read **BSP header first** (the law)
- Off-box ESPHome builds: expect PyPI-vs-add-on skew; pin official components by tag
- **Verified artifacts shelf (2026-08-04):** `WS_S3_CAM_OV3660_WebServer/` Arduino sketch
  (compiles, 32% of 3MB app; delivered as zip, based on the vendor's own example) ·
  [[hardware/landing_ai_cam_2]] (full `esphome config` exit 0)

---
*Related: [[_index]] · [[diagnostics/2026-08-04-full-home-diagnosis]] ·
[[diagnostics/2026-08-02-ha-doctor]] · [[hardware/Waveshare ESP32-S3-CAM-OV3660 — Arduino IDE Setup (CORRECTED)]] ·
[[hardware/ai_cam-compile-runbook]] · [[hardware/ai_cam]] · `Assistant Core/ha-diagnostics/`*
