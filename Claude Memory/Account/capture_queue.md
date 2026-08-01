# Capture Queue

> Open items awaiting action. Ticked off at session end per the SESSION END protocol.
> Seeded 2026-07-27 during the harness build; the file did not previously exist at
> either documented path. `Account/` is canonical — the session-start hook and CLAUDE.md
> disagreed on the location.

## From the 2026-07-27 harness audit

- [x] **S1 — Confirm `GROQ_API_KEY` repo secret is set.** *(2026-08-01: evidenced — all 4 scheduled skills produced automated commits on master today; they cannot run without the key.)*
- [x] **S1 — Merge `.github/workflows/` to `master`.** *(2026-08-01: all 5 files present on master; drift-check green.)*
- [x] **S1 — Run each of the 4 skills once** to verify green. *(2026-08-01: better — scheduled runs for skills 1/3/4/6 all committed to master today: `e43e6f6`, `8a89e92`, `e22ea99`, `1c18bc1`.)*
- [x] **S1 — Reconcile the project set.** *(Done 2026-07-27 per CLAUDE.md "Reconciled" note — 8 mandatory files, `Account/` canonical.)*
- [ ] **S2 — Decide `webapp-reviewer` model.** Uses `model: sonnet`; harness standard is `opus`.
- [ ] **S3 — Resolve dangling wikilink** `[[sessions/2026-07-29]]` — referenced twice in the Smart Home index (upstream `6313897`); a reconstruction stub is included, replace it with the real session content.
- [ ] **S3 — Resolve 6 dangling wikilinks** in `Projects/Smart Home/_index.md`: `sessions/2026-06-08`, `2026-06-13`, `2026-06-16`, `2026-07-04`, `fixes/2026-06-14-ip-collision-fix`, `smart_home`.
- [ ] **Deactivate the 4 n8n.cloud workflows** once GitHub Actions is verified green.

## New — AI Cam unused hardware (from upstream 6313897)

- [ ] microSD — CLK 16 / CMD 43 / D0 44, needs the `sd_mmc_card` external component
- [ ] LCD 320x240 QSPI — DATA0 1, PCLK 5, DC 3, CS 6; RST EXIO2, backlight EXIO1 PWM. **Panel controller not yet identified.**
- [ ] Touch — RST EXIO0, INT GPIO9
- [ ] Battery ADC via CH32V003 — needs component extension
- [ ] Apply the new ES7210 component to ESP32-S3-AUDIO-Board at `.216`

## Carried forward — Smart Home

- [ ] **Verify `cctv_cam` (.234) and `porch` (.240)** are powered — may be hardware-down, not config.
- [ ] Fix upstairs BLE/radar contention (split nodes).
- [ ] Apply `.171` IP collision fix — upstairs to `.207` via ESPHome OTA.
- [ ] DHCP reservation: RuView node MAC `e0:72:a1:e7:03:60` to `.227`.
- [ ] Delete ghost "Upstairs" (.207) config in ESPHome Builder.

## New — from the 2026-08-02 full HA diagnosis (report: `Smart Home/diagnostics/2026-08-02-ha-doctor.md`)

- [x] **Canonical TV entity: DECIDED 2026-08-02** — `media_player.jelly_beans_tv_3` (evidence: device_class tv, full source_list, features 221117; other candidate is the DLNA shell). Dashboard + ha-doctor + index updated.
- [ ] **ai_cam wake word — Option B**: follow [[../Projects/Smart Home/hardware/ai_cam-compile-runbook]] on the PC (~15 min, OTA, no USB; native es7210, no special deps). N100 (~£140) remains the structural fix.
- [x] **Area typo "Dinning Room" → "Dining Room": FIXED LIVE 2026-08-02** via the registry API. (The 10 area-less actionables still need Elliot's placement knowledge — mostly dead eshare dupes + haribo_room.)
- [x] **Merge PR #71**: MERGED 2026-08-02 (`bd91acb`).
- [ ] **Revive the 3 offline voice satellites**: espspeaker (Living Room), Voice PE (`home_assistant_voice_09eabd`), `landing_ai_cam_2` (the 2nd CAM board — already provisioned!).
- [ ] **Fix area typo "Dinning Room" → "Dining Room"** (likely cause of the dining-room `no_valid_targets` voice miss) and assign the 10 area-less actionables (haribo_room light/switch, soundbar_2, jessa_voice_assistant, home_group, 5× eshare dupes — the eshare dupes may just need deleting).
- [ ] **Registry cleanup**: 156 unavailable entities — delete dead duplicates (soundbar_2, jelly_bean_s_tv, bedroom_sambed, eshare×5) after the node revivals.
- [ ] **Commit `/home/claude/ui-lovelace-minimal.yaml` (new 3-view dashboard) from the HA box into the vault**, then deploy per the handoff.
- [ ] Reflash offline nodes: bedroom presence .171 · porch servo .206 · cctv XIAO .234 (inspect first).
- [ ] 4 pending updates (core b2→b3, OS 18.2.rc1→18.2, browser_mod, mushroom) — batch after satellites are back.
- [ ] Re-run ha-doctor from the LAN once (direct node probes + error_log, which Nabu Casa denied).

## New — from the 2026-08-01 expansion session (PR #71)

- [x] **Merge PR #71** — MERGED 2026-08-02 (`bd91acb`); ES7210 `ref: master` unbroken.
- [x] **Run ha-doctor** — first full run done 2026-08-02 via Nabu Casa (report committed). Still pending: one LAN run for direct node probes + error_log.
- [ ] **S1 — Inbox drift:** root `Inbox/` holds 5 captures (to 2026-07-09) invisible to the engine, which reads `JARVIS/Inbox/` only. Fix inside the Phase-2 capture router.
- [ ] Back up hub-side config (automations, bedroom-2.yaml, frigate.yaml, scenes/scripts) into the vault — currently exists only on the hub.
- [ ] Flash + verify the EXIO3 boot-race fix on ai_cam (proposed, NOT yet flashed).
- [ ] Decide: delete stale `Claude Memory 1/` duplicate (byte-identical subset; referenced nowhere).
- [ ] Reconcile espspeaker yaml (`timeout: never`, `force_master: true`) with the I²S-mutex law — retest on hardware.
- [ ] Resolve `living_room_ai_cam_*` vs `ai_cam_*` naming once ha-doctor reports which is live; update the losing side.

## Carried forward — capture

- [ ] **Fix empty Tasker captures** — "Ask JARVIS" has fired 3x with placeholder `"your note here"`. Needs BOTH the Tasker variable fix AND a server-side junk filter.
- [ ] **Build Phase-2 capture router** (GitHub `on: push`) to retire the paid n8n webhook — satisfies C1.

## Completed

- [x] 2026-07-27 — JARVIS harness built: 5 agents, 7 skills, orchestrator, 2 bundled checkers
- [x] 2026-07-29 — **AI Cam COMPLETE** — ES7210 mics + microWakeWord + buttons + LED; custom ESPHome ES7210 component written from scratch and verified (STT verbatim in 0.04s)
- [x] 2026-07-23 — AI Cam camera + speaker working (vendor-BSP pinout correction)
