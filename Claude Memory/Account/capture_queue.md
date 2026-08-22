# Capture Queue

> Open items awaiting action. Ticked off at session end per the SESSION END protocol.
> Seeded 2026-07-27 during the harness build; the file did not previously exist at
> either documented path. `Account/` is canonical — the session-start hook and CLAUDE.md
> disagreed on the location.

## From the 2026-07-27 harness audit

- [x] **S1 — Confirm `GROQ_API_KEY` repo secret is set.** *(2026-08-01: evidenced — all 4 scheduled skills produced automated commits on master today; they cannot run without the key.)*
- [x] **S1 — Merge `.github/workflows/` to `master`.** *(2026-08-01: all 5 files present on master; drift-check green.)*
- [x] **S1 — Run each of the 4 skills once** to verify green. *(2026-08-01: skills 1/3/4/6 all committed to master: `e43e6f6`, `8a89e92`, `e22ea99`, `1c18bc1`.)* **⚠️ Evidence corrected 2026-08-02:** those four commits came from manual `workflow_dispatch` runs at 01:09–01:33, **not** scheduled runs. The skills work; the *schedule* was never proven by this. See the new S1 below.
- [x] **S1 — Reconcile the project set.** *(Done 2026-07-27 per CLAUDE.md "Reconciled" note — 8 mandatory files, `Account/` canonical.)*
- [ ] **S2 — Decide `webapp-reviewer` model.** Uses `model: sonnet`; harness standard is `opus`.
- [ ] **S3 — Resolve dangling wikilink** `[[sessions/2026-07-29]]` — referenced twice in the Smart Home index (upstream `6313897`); a reconstruction stub is included, replace it with the real session content.
- [ ] **S3 — Resolve 6 dangling wikilinks** in `Projects/Smart Home/_index.md`: `sessions/2026-06-08`, `2026-06-13`, `2026-06-16`, `2026-07-04`, `fixes/2026-06-14-ip-collision-fix`, `smart_home`.
- [ ] **Deactivate the 4 n8n.cloud workflows** once GitHub Actions is verified green.

## New — from the 2026-08-02 system understanding (`Claude Memory/2026-08-02-jarvis-state-of-the-system.md`)

- [x] **S1 — The scheduled skill engine has NEVER written output.** All 11 scheduled runs started late enough that `guardPasses` (exact London-hour match) failed → exit 0 → run green, `Commit and push` skipped, nothing written. Proven by job log `30693257169`. *(FIXED 2026-08-02: the exact-hour guard is replaced by per-skill period idempotency — `shouldRun`/`done(ctx)` in `runner.mjs`. DST-safe, delay-safe, self-healing. Regression test proven to fail on the old guard and pass on the new.)*
- [x] **S1 — The "skip is expected" log line masks the failure.** *(FIXED 2026-08-02: `_jarvis-run-skill.yml` now branches on the reason — `already-done` and `no-new-captures` are explained as expected, `error` emits `::error::`, anything unrecognised emits `::warning::` telling the reader to treat it as a silent failure. Plus a job summary on every run.)*
- [x] **S1 — Capture split: 4 captures were invisible to the engine.** *(FIXED 2026-08-02: swept into `JARVIS/Inbox/`; the router now sweeps legacy root `Inbox/` forward on every run, copy-if-missing. Source fixed too — `Scripts/jarvis.js` + `JARVIS/scripts/jarvis.js` fell back to root `"Inbox"` for any unknown capture kind, which is what created the split.)*
- [ ] **Capture is still idle** — newest capture is 2026-07-09, ~24 days ago. The router is built and the vault side is fixed, but nothing has *arrived* since. Check the phone leg before trusting any briefing generated from this corpus.
- [ ] **⚠️ Fix the Tasker variable at source (still open).** The router's junk filter quarantines `your note here` / empty captures to `JARVIS/Inbox/_rejected/` and reports them loudly — but **that is a second line of defence, not the fix**. Diagnose leg 1: log the Tasker variable to a Flash immediately before the HTTP Request action; variable scope at that moment is the usual cause, not the network.
- [ ] **Finish Phase 2 — retarget the phone at GitHub.** Tasker still posts to the paid n8n webhook. Point it at the GitHub Contents API (`MIGRATION.md` → Phase 2, step 1) and the paid dependency is gone (C1).
## New — from the 2026-08-02 second pass (jarvis-core + web app audited directly)

- [ ] **S1 — `jarvis-core` has one commit, dated 2026-07-22.** Nothing pushed in 11 days, so any on-device work since then exists only on the Fold, unbacked. The runbook's own rule — push to master, then pull on-device — has not been followed. Given this vault's history of losing files, this is the least-protected part of the system.
- [ ] **Prove the memory path end-to-end.** Tier 4 is wired but `Claude Memory/Account/jarvis_memory.md` **does not exist** — no fact has ever been stored (`MEMORY 0` in the web app). Run one deliberate `remember` on the Fold and confirm it reaches `master`. Built ≠ used.
- [ ] **Check the heartbeat on the device.** `.heartbeat-state.json` in the repo is from the 07-22 snapshot and proves nothing either way. Read the live copy on the Fold.
- [ ] **`AGENT.md` also understates the tool surface** — it documents 7 tools; **13** register (`database`, `ha_list`, `pc_control`, `remember`, `forget`, `update_memory` are undocumented). Fold into the AGENT.md reconciliation below.
- [ ] **Identify the client that deleted 8 files from master** (2026-08-02 03:47/03:50). Ruled out: the Termux clone, and all three git-backed vaults on the Fold. **Check the PC.** Eight `.obsidian` folders exist on the Fold, one a live git repo inside `.trash` — disable obsidian-git in every vault except the one intended writer.
- [ ] **Decide: fold the useful parts of the uploaded `claude.md` into the existing `CLAUDE.md`** (Layer A–E model, glossary, command reference, escalation list — the vault has no equivalent). Do **not** commit it as a separate file: `claude.md` vs `CLAUDE.md` collides on Windows and Android. Everything else in that file and in `JARVIS_HEALTH_CHECK_20260802.md` is contradicted by observation — see §10c of the state-of-the-system doc.

- [ ] **`AGENT.md` understates `jarvis-core` by four tiers.** Tiers 3–6 all have shipped code (`ears/deepgram/elevenlabs`, `memory`, `heartbeat`, `rails` + 23 green tier-6 tests) plus a web app and Supabase tool that appear nowhere in it — yet it is the file every fresh session reads first. Reconcile with `JARVIS/HANDOFF.md`, or demote it.
- [ ] **`jarvis-core` ships a red test on `main`** — `tier1-test.mjs` 6/7. The 401 mock (`test/tier1-test.mjs:172`) omits `headers`, which `lib/brain.mjs:226` reads unconditionally. Production unaffected (real `fetch` always sets it); one-line fixture fix.
- [ ] **Merge PR #73** (open, draft, `mergeable_state: clean`) — until it lands, `master` and every session-start read are a day behind the real house.
- [ ] **Triage 3 stale open PRs** — #70 (canonical `ai_cam.esphome.yaml`), #68 (minimise HA automations), #67 (NotebookLM client).
- [ ] **Confirm the n8n.cloud account state and formally retire it** (C1). Verified only that no n8n-format commit exists after 2026-07-08 — not the account itself.
- [ ] **Answer the open device question:** the Termux checks from the last session — pad or Fold 7? `ro.build.characteristics=device` only rules out a TV build. All Termux battery/wakelock notes in this vault are Fold-7 specific.
- [x] **Fix the 4-way session-start list drift** — `.claude/skills/vault-conventions/SKILL.md` still carried the superseded 7-file list (missing Work Financial Forecasting) and is preloaded into every agent. *(Fixed 2026-08-02.)*
- [ ] **S3 — Dangling wikilink `[[hardware/ai_cam]]`** in the Smart Home index; the file on disk is `hardware/ai_cam.yaml`. (The other 6 dangling links listed above are already resolved — that section is stale in your favour.)

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
- [x] **S1 — Inbox drift:** root `Inbox/` held 4 captures invisible to the engine. *(FIXED 2026-08-02 — swept into `JARVIS/Inbox/`; the router keeps sweeping legacy arrivals forward, and the `|| "Inbox"` fallback that caused it is fixed in both copies of `jarvis.js`.)*
- [ ] Back up hub-side config (automations, bedroom-2.yaml, frigate.yaml, scenes/scripts) into the vault — currently exists only on the hub.
- [ ] Flash + verify the EXIO3 boot-race fix on ai_cam (proposed, NOT yet flashed).
- [ ] Decide: delete stale `Claude Memory 1/` duplicate (byte-identical subset; referenced nowhere).
- [ ] Reconcile espspeaker yaml (`timeout: never`, `force_master: true`) with the I²S-mutex law — retest on hardware.
- [ ] Resolve `living_room_ai_cam_*` vs `ai_cam_*` naming once ha-doctor reports which is live; update the losing side.

## Carried forward — capture

- [~] **Fix empty Tasker captures** — needs BOTH the Tasker variable fix AND a server-side junk filter. *(2026-08-02: junk filter SHIPPED — quarantines to `JARVIS/Inbox/_rejected/`, reported loudly. The Tasker variable fix is STILL OPEN; see the item near the top.)*
- [~] **Build Phase-2 capture router** (GitHub `on: push`) to retire the paid n8n webhook. *(2026-08-02: router + workflow SHIPPED and tested. Remaining: retarget Tasker from the n8n webhook to the GitHub Contents API — until that lands the paid dependency is still live.)*

## Completed

- [x] 2026-07-27 — JARVIS harness built: 5 agents, 7 skills, orchestrator, 2 bundled checkers
- [x] 2026-07-29 — **AI Cam COMPLETE** — ES7210 mics + microWakeWord + buttons + LED; custom ESPHome ES7210 component written from scratch and verified (STT verbatim in 0.04s)
- [x] 2026-07-23 — AI Cam camera + speaker working (vendor-BSP pinout correction)


## New — from the 2026-08-04 session (camera transcript closed; estate expanded)

- [x] **AI-Mode camera transcript root-caused & closed** — `0x106` = CH32V003 EXIO3 power gating, never pins; corrected sketch (vendor-example base) **compile-verified** on esp32 core 3.3.11 and delivered as `WS_S3_CAM_OV3660_WebServer.zip`. Full analysis: `Smart Home/diagnostics/2026-08-04-full-home-diagnosis.md` Part 1.
- [x] **MASTER_PLAN v2 + full-home diagnosis committed** (2026-08-04) — estate re-baselined, room-by-room end state, ranked P0–P3 repair queue.
- [x] **Option B runbook gap fixed** — PyPI ESPHome (≤2026.6.5) lacks `waveshare_io_ch32v003`; pin it from the esphome repo @ tag 2026.7.1 (addendum in the runbook; already included in landing yaml).
- [ ] **Flash board #2 with `hardware/landing_ai_cam_2.yaml`** (validated exit 0) — add `landing_api_encryption_key` + `landing_ota_password` secrets; **first flash USB/web.esphome.io** (board likely carries the Arduino-experiment firmware — no ESPHome OTA); confirm 192.168.0.198 is free.
- [ ] **Confirm board identity by MAC** — `28:84:85:49:83:C8` = live ai_cam; check whether `…:86:70` answers as the Arduino-flashed board.
- [ ] **P0 unchanged and still open: back up hub-side config into `ha-config/`** — automations, bedroom-2, frigate, scenes/scripts, the FLASHED ai_cam.yaml, `ui-lovelace-minimal.yaml`. One SD failure erases the lot.


## New — from the 2026-08-22 JARVIS v2 session (interface + auto-start rebuild)

- [ ] **S1 — Run the JARVIS v2 on-device gate.** Install `jarvis2-package.tar.gz` (SHA-256 `8923a59ac88b45f0dc3480c44909440e1293dec9b05ddd1786b708ce2551dab4`) via `install.sh`, then the one-time steps: Termux:Boot from F-Droid opened once · battery Unrestricted for Termux + Termux:Boot · Chrome → `localhost:1875` → Install. Then the 5-minute smoke test (speak → streamed reply → "thanks" ends it) **and the cold-reboot check** (reboot, tap the icon, Termux never opened). Report: `JARVIS_V2_REPORT_2026-08-22.md` §6.
- [ ] **S1 — Push the Fold's `jarvis-core` (now incl. `jarvis2/`) to GitHub `main`.** Last push 2026-07-22 — a month of on-device work is unbacked; still the least-protected part of the system. SSH key `fold7-termux` already set up.
- [ ] **S2 — If the live `/api/chat` events surprise the tolerant parser**, the UI will print a diagnostics line with exactly what the core sent — capture that line; it's the one input needed to pin the protocol precisely.
- [ ] **S3 — After the gate passes:** consider Side-button double-press → JARVIS (Settings → Advanced features → Side button) as the physical "say a word" until the satellites carry room wake.


> **⚠️ Evidence corrected 2026-08-22 (same session):** the S1 push item above says "Last push 2026-07-22 — a month of on-device work is unbacked". CLAUDE.md's change history records a `jarvis-core` push on **2026-08-06**, so the true gap at session time is **16 days**. The action stands (push the Fold's jarvis-core incl. `jarvis2/`); the urgency figure is corrected here.



## New — 2026-08-22 (jarvis2 re-delivery session)

- [ ] **Install JARVIS v2 from the RE-DELIVERED package** — SHA-256 `13471b120b80dd33368c670cf808ce8b01a36f3e7f865319dd4f820dd5dc44b9` (`jarvis2-v2.tar.gz` + `install-jarvis2.sh`). The earlier same-day build's artifact (SHA `8923a59a…`) is unretrievable from its chat — do not hunt for it; the spec is identical and re-verified 43/43.
- [ ] **Run the §6 smoke test** in `JARVIS_V2_REPORT_2026-08-22.md`, including the cold-reboot check, and report any failing step with a screenshot of Status → diagnostics.



> **⚠️ SHA superseded 2026-08-22 (second session):** the S1 item "Run the JARVIS v2
> on-device gate" above references package SHA `8923a59a…` — that package never
> reached the phone. The live package is the **re-issue, SHA-256
> `3d70a9cf774e8aea3b54b8a262eecbcdd1c9fdb54fdcbc701b410516af28f096`**, verified
> 41/41 (up from 32/32). Install command:
> `sh install.sh jarvis2-package.tar.gz 3d70a9cf774e8aea3b54b8a262eecbcdd1c9fdb54fdcbc701b410516af28f096`
> — then the same one-time steps and 5-minute gate. See the addendum in
> `Projects/Smart Home/sessions/2026-08-22.md`.


### 2026-08-22 later — supersedes the two earlier jarvis2 SHA entries above
- [ ] **Install JARVIS v2.0.1** — same one-paste command; installer now expects SHA `f89a2dea…3601147` (loopback bind fix). Then run the §6 smoke test.
- [ ] **Verify Vercel voice-app auth** (July audit #1) — curl check in `JARVIS_PATTERN_AUDIT_2026-08-22.md`; if 200, fix auth or pause the project.
- [ ] **Retire the `database` stub** per the supabase playbook (decide PostgREST-vs-driver first).
- [ ] **Security pass v2.1**: audit-log redaction · pc_control hardline blocklist · per-tool caps · pre-commit secret hook · incident runbook · rails score on v2 Status sheet · confirm MAX_ITERATIONS bound.
- [ ] **Execution gap**: vault action-queue + heartbeat drain on boot/tick (cloud-to-local pattern, £0).
- [ ] Small adopts: capabilities-from-registry prompt line · recency voice cue + tonal checkpoint · t_since_user diagnostic · numeric-honesty rule · session-template headers · persona live-reload.



---

## New — 2026-08-23 session (North-Star P0/P1; v2 rejected)

> **⚠️ CANCELS four earlier items, not "completes" them.** Jelly Bean saw JARVIS v2 and
> rejected it (*"I hate it"*). The six-tab `jarvis-app.mjs` on **:8737** is the locked
> daily driver. Therefore every v2 install / smoke-test / SHA item above is **CANCELLED**:
>
> - ~~S1 — Run the JARVIS v2 on-device gate (SHA `8923a59a…`)~~ — **cancelled**
> - ~~Install JARVIS v2 from the RE-DELIVERED package (SHA `13471b12…`)~~ — **cancelled**
> - ~~SHA superseded → re-issue `3d70a9cf…`~~ — **cancelled**
> - ~~Install JARVIS v2.0.1 (SHA `f89a2dea…`) + §6 smoke test~~ — **cancelled**
>
> The v2 packages stay in `Assistant Core/packages/` for history only. Do not install them.

### Phase 0 — self-knowledge

- [x] **Ship `self-knowledge.mjs` to jarvis-core** — done and **verified on device**:
      found **13 callable tools** (not 14 — `vault-lib.mjs` is a helper, never registers),
      drift check OK. SHA `c49c93b5…`.
- [ ] **Close the Phase 0 loop — wire `capabilitiesBlock` into the prompts.** Generated but
      unused: `lib/brain.mjs` and the four `systemPrompt()` builders (`jarvis-app.mjs`,
      `jarvis-voice.mjs`, `jarvis.mjs`, `heartbeat.mjs`) don't read it. Built ≠ used.

### Phase 1 — security hardening (IN PROGRESS)

- [~] **Hardline blocklist — BUILT + TESTED 25/25 in the sandbox, NOT on the phone.**
      `lib/hardline.mjs`, standalone/pure/zero-dep, 19 patterns, recursive arg scan.
      **Nothing to claim on-device yet.** Sandbox SHA `ae0738511c…` **must be recomputed at
      package time.** Two bugs found by the tests and fixed — PowerShell flags need
      order-free lookaheads, and **never put `\b` before a hyphenated flag** (it broke the
      `-Recurse` match).
- [ ] **S1 — Ship it + wire it.** Package via `Assistant Core/packages/` base64 →
      raw-GitHub fetch → `tr -d '\r'` decode → SHA gate → installer that backs up
      `agent.mjs` to `agent.mjs.bak`, drops the lib, applies **one import + one guard block**
      (after `onToolUse`, **before** `isSafeMode` — so catastrophic actions are refused even
      when safe mode is off), runs `node --check lib/agent.mjs`.
- [ ] **S1 — On-device proof.** A catastrophic *confirmed* `pc_control` command is refused
      **and** a normal command still runs. Paste the output; no claim without it.
- [ ] **S2 — Widen `scanForInjection`** in `lib/rails.mjs` with data-exfil patterns
      (send/forward/email all…, `curl|bash`, "export your…"). Same mechanism, more regexes.
- [ ] **S2 — Document `.jarvis-safe` as the panic button** (no new code) and confirm
      `isSafeMode` covers every tool path.
- [x] **Do NOT rebuild the injection gate or kill switch** — recon confirmed both already
      exist in `lib/rails.mjs` and are good. Resolved by verification, not by building.

### Vercel Carousel (secondary app)

- [x] **Secure `/api/chat` + `/api/capture`** — fail-closed bearer gate shipped and
      **verified live**: no token → 401, wrong → 401, correct → 200 + pong, capture → 401.
      Root cause of the earlier "still open": **Vercel deploys `main`, the work was on
      `master`** — merged.
- [ ] **S1 — Rotate `JARVIS_API_TOKEN`** — the value was exposed in a chat transcript.
      (Deliberately not recorded in the vault.)
- [ ] **S2 — Switch the Vercel production branch to `master`** to kill the standing
      main/master drift risk.
- [x] **Fix the orphaned `.claude/skills/android-development` submodule** — gitlink with no
      `.gitmodules` was breaking the Vercel clone. De-submoduled.

### Working practice — carry into every future session

- [ ] **⚠️ File-attachment uploads are broken for Jelly Bean.** Every `.txt`/file
      attachment arrives **empty**. **Ask for pasted text or a screenshot** — screenshots
      have been 100% reliable. Do not ask for file uploads.

### Carried forward, still open

- [ ] **Push the Fold's `jarvis-core` to GitHub `main`** — last recorded push 2026-08-06.
      Still the least-protected part of the system.
- [ ] **Tidy `Projects/Smart Home/_index.md`** — its top Status + Next Actions still lead
      with the cancelled v2 gate; a top-down reader is misled until a full rewrite lands.
- [ ] **Retire the `database` stub** per the supabase playbook (decide PostgREST vs driver).
- [ ] **Execution gap (P3)** — vault action-queue + heartbeat drain on boot/tick, durable
      and idempotent ("assume you will be killed"). £0.



## 2026-08-23 — from JARVIS security session
DONE:
- [x] Vercel Carousel API secured + verified live (401/200 probes)
- [x] App decision locked: six-tab :8737 daily driver; v2 shelved
- [x] Phase 0 self-knowledge generator shipped + verified (13 tools)
- [x] Phase 1 hardline blocklist built + tested 25/25 (sandbox)
OUTSTANDING:
- [ ] Ship + install + verify Phase 1 hardline blocklist on device (NEXT)
- [ ] Widen scanForInjection with data-exfil patterns
- [ ] Document `.jarvis-safe` as panic button
- [ ] (opt) Close Phase 0 loop: wire capabilitiesBlock into prompt
- [ ] Rotate Vercel JARVIS_API_TOKEN (exposed in chat)
- [ ] Switch Vercel production branch to master (kill main/master drift)
- [ ] Archive 546M ~/jarvis sprawl -> one canonical vault

