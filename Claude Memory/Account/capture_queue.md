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



## 2026-08-23 UPDATE — Phase 0 loop-closing
- [ ] FIX regressed self-knowledge.json (shows 1 tool "tools", should be 13) — re-run
      shipped `node self-knowledge.mjs`; if still 1, re-run install-phase0.sh
- [ ] Wire capabilitiesBlock by READING self-knowledge.json (not hardcoded)
- [ ] Patch `jarvis-app.mjs` systemPrompt() (the :8737 daily app), NOT jarvis.mjs
- Verified 13 tools: database, forget, ha_control, ha_list, ha_state, pc_control,
  remember, set_alarm, set_timer, update_memory, vault_list, vault_read, vault_search
- Tools dir: ~/jarvis-core/tools/ (vault-lib.mjs is a helper, not a tool)



## New — 2026-08-23 session close

- [x] **Phase 0 regression: `self-knowledge.json` showed 1 tool.** *(FIXED 2026-08-23 — re-ran the
  SHA-verified `install-phase0.sh`; regenerated from the live registry, 13 tools, drift OK. Root
  cause: the shipped generator had been overwritten by a static-parse variant.)*
- [x] **Phase 0 loop: wire `capabilitiesBlock` into the prompt.** *(DONE 2026-08-23 — patched
  `jarvis-app.mjs` (:8737), the daily app, NOT `jarvis.mjs`. Reads the JSON at render time;
  verified 13/13 rendered, fallback unused.)*
- [x] **Phase 1 hardline blocklist on device.** *(VERIFIED 2026-08-23 — was already installed;
  proven with confirm=yes: `rm -rf /` refused, `Get-Date` executed. Guard between `onToolUse`
  and `isSafeMode`.)*
- [x] **S1 — `jarvis-core` unbacked on the Fold.** *(CLOSED 2026-08-23 — pushed to `origin/main`,
  `bb97f5d..2834aad`. Previous push 2026-08-06; 17 days of work was device-only.)*
- [ ] **Rotate the exposed Carousel `JARVIS_API_TOKEN`** — leaked in an earlier chat; still live.
- [ ] **Phase 2 — persona-drift fix** (next roadmap phase).
- [ ] **Archive the 546M `~/jarvis` sprawl** → one canonical vault (`~/Obsidian-Vault-`, master).


- [x] **Phase 2 — persona-drift fix.** *(DONE 2026-08-23 — `lib/persona.mjs` is the single source of
  truth; all four entry points rewired, no inline prompts remain. Verified on device: 1 honesty
  block, 1 personality, 13 tools everywhere, stale Tier-5 denial gone, app 200, heartbeat intact.
  Commits `5bfe14e` + `bf68e33` on origin/main.)*
- [x] **`jarvis.mjs` was reading a stale `SELF_KNOWLEDGE.json`** (capital) reporting "1 tool", and
  used `require()` inside ESM. *(FIXED 2026-08-23 — stale file retired; the REPL would have thrown
  on first use.)*
- [x] **`jarvis-voice.mjs` denied Tier 5** a month after heartbeat shipped. *(FIXED 2026-08-23.)*
- [ ] **Installer hardening is now a standing rule** — every vault-delivered installer must
  cache-bust its fetches AND assert on file content, not hash alone. A stale CDN edge served a
  matching old installer+payload pair that verified clean and installed a broken patcher.
- [ ] **Do not ship source as hand-transcribed base64** — use plain `.mjs` in the vault with per-file
  SHA. `Assistant Core/packages/persona.tar.gz.b64` is corrupt and superseded.


- [x] **Phase 3 — durable memory.** *(DONE 2026-08-23 — atomic write + `.bak` + read-back
  verification + mass-loss guard in `lib/memory.mjs`. Old in-place write destroyed ALL facts when
  interrupted (proven). Verified on device: real round-trip 1 → add → remove → 1, health ok.
  Commit `958fa63`.)*
- [x] **Prove the memory path end-to-end** *(DONE 2026-08-23 — `jarvis_memory.md` exists with 1 fact;
  a deliberate add/remove round-trip on the real file was verified on disk. Supersedes the older
  "no fact has ever been stored / MEMORY 0" item above, which was stale.)*
- [ ] **Next North-Star pillar: crash-safe propose→approve→commit loop** (the execution gap —
  durable queue + drain-on-startup; £0 via vault rows + the existing heartbeat).
- [ ] **Rotate the exposed Carousel `JARVIS_API_TOKEN`** — still open, still live.
- [ ] **Archive the 546M `~/jarvis` sprawl** → one canonical vault.
- [ ] **Tasker capture leg** — capture idle since 2026-07-09; briefings from that corpus are stale.


- [x] **Phase 4 — crash-safe propose→approve→commit loop.** *(DONE 2026-08-23 — `lib/ledger.mjs`
  append-only JSONL, wired into `lib/agent.mjs` at 7 points. The `pending = new Map()` in
  jarvis-app.mjs was process memory: a crash between propose and approve lost the approval silently.
  Orphans now surfaced, never auto-replayed. Verified on device with a real declined `set_timer`:
  trail `proposed > declined`, 0 open. Commit `b658634`. CLI: `node jarvis-ledger.mjs`.)*
- [x] **North-Star roadmap complete** — Phases 0–4 all verified running on the Fold, not merely
  documented.

### Standing delivery rules (learned the hard way, apply to EVERY future installer)
1. **Ship source as plain `.mjs` in the vault**, never hand-transcribed base64 (a corrupted blob was
   caught by the SHA gate on 2026-08-23).
2. **Cache-bust every fetch AND assert on file content** — SHA proves integrity, not freshness. A
   stale edge once served a matching old installer + old payload that verified clean.
3. **When a corrected file must ship immediately, change the filename.** Cache-busting alone did not
   defeat a sticky edge; `ledger-v2.mjs` did.
4. **Anchors in patchers must be regex and whitespace-insensitive**, and the installer must verify
   every anchor exists exactly once *before* modifying anything.

### Still open (unchanged today)
- [ ] **Rotate the exposed Carousel `JARVIS_API_TOKEN`** — leaked in an earlier chat, still live.
- [ ] **Archive the 546M `~/jarvis` sprawl** → one canonical vault.
- [ ] **Tasker capture leg** — capture idle since 2026-07-09; briefings from that corpus are stale.
- [ ] Consider surfacing `drainReport()` on the app's Status tab so unfinished actions are visible
      without the CLI.


- [~] **Carousel `JARVIS_API_TOKEN` rotation — ATTEMPTED, NOT COMPLETED. Jelly Bean's decision:
  leave it (2026-08-23). Do not re-raise.** Verified state at that moment: the gate is live and
  fail-closed (no token → 401 on both `jarvis-carousel.vercel.app` and the git-master URL), but the
  **exposed token still returns 200** — the env var change/redeploy did not take (the clipboard held
  790 chars, not the 64-char token). Nothing on the phone consumes this token, so there is no
  device-side exposure; the risk is confined to the public Vercel endpoint. If it is ever revisited:
  Vercel → jarvis-carousel → Settings → Environment Variables → edit `JARVIS_API_TOKEN` → **then
  Deployments → latest Production → Redeploy** (env changes do not apply to an already-built
  deployment — the likely reason it failed).


- [x] **ROOT CAUSE of the dead capture pipeline + stopped briefings: obsidian-git deleted
  `.github/workflows/` entirely.** *(FIXED 2026-08-23 — commit `4bdb3bf1` (2026-08-06) removed all 6
  workflow files; `7f9097d9` (07-04) and `9fd5e00e` (07-14) did the same earlier. Obsidian cannot see
  dotfolders, so obsidian-git's `git add -A` stages them as deletions. All six restored from
  `a38848c9`; verified on origin/master. **Pre-commit hook installed and PROVEN** — a staged deletion
  of a workflow was refused. Capture Router ran successfully 2026-08-23T02:49Z, first pipeline run in
  18 days.)*
- [x] **"8 files deleted from master 2026-08-02 by an unidentified client"** — *(EXPLAINED 2026-08-23:
  same obsidian-git `add -A` mechanism. Not a mystery client; no PC involvement. Closes that
  investigation.)*
- [ ] **Build a phone-side `capture` tool** — jarvis-core has 13 tools and none of them captures, so
  the only capture route is still Tasker → the paid n8n webhook (broken since 2026-07-09). A tool
  writing directly to `~/Obsidian-Vault-/JARVIS/Inbox/` (same single-write-path model as memory)
  makes capture voice-driven, £0, and retires n8n entirely. **This is the next build.**
- [ ] **Watch for a 4th deletion attempt** — if obsidian-git starts failing to commit, that is the
  hook doing its job, not a bug. Read the message before overriding with `--no-verify`.


- [x] **Build a phone-side `capture` tool.** *(DONE 2026-08-23 — `tools/capture.mjs`, tool #14.
  JARVIS writes notes straight to `JARVIS/Inbox/` with matching frontmatter; atomic write +
  read-back verification; refuses placeholder junk at source. Proven end to end: real
  `executeToolCall` → ledger trail `proposed > started > ran` → file on disk → obsidian-git push →
  **Capture Router success 2026-08-23T03:01:49Z**. Commits `c3ab509` / `f372df06`.)*
- [x] **Retire the paid n8n webhook from the capture path.** *(DONE 2026-08-23 — capture no longer
  touches n8n or Tasker. C1 (£0) has no live exception on this route.)*
- [~] **Fix the Tasker variable at source** — *moot for capture now that JARVIS writes notes itself.
  Only still relevant if a home-screen Tasker shortcut is wanted; otherwise close it.*
- [ ] **Confirm the n8n.cloud account state and formally cancel it** — nothing on the capture path
  needs it any more, so this is now purely account housekeeping.
- [ ] **Watch the first scheduled runs land** — morning brief `cron 0 6/0 7` should produce a
  briefing for the first time since 2026-08-04 now the workflows are restored. If none appears by
  tomorrow morning, check Actions rather than assuming.


- [x] **P0 — Back up hub-side config into the vault.** *(DONE 2026-08-23 — built
  `Assistant Core/ha-diagnostics/ha-export.mjs`, a re-runnable exporter using HA's config REST API.
  Exported 11/11 automations + 5/5 scenes (0 scripts exist) to
  `Claude Memory/Projects/Smart Home/ha-config/` as real YAML + `snapshot.json` + restore README.
  **Verified restorable** — PyYAML parses them back into 11 and 5 objects; emitter tested against the
  `": "`, `to: 'on'` and `-00:15:00` quoting traps that would silently corrupt a restore. Commit
  `c0ce5ebd`.)*
- [x] **Automation count corrected** — the live hub has **11** automations, not 8 (2026-08-02 record)
  and not "~19" (older notes). 5 scenes, 0 scripts, 709 entities.
- [ ] **Finish the hub backup — the YAML-managed files are still hub-only.** `bedroom-2.yaml`,
  `frigate.yaml`, `configuration.yaml` + packages, the flashed `ai_cam.yaml`, and
  `ui-lovelace-minimal.yaml` are not exposed by any API. Copy via Studio Code Server or Samba into
  the same `ha-config/` folder.
- [ ] **Enable a scheduled full HA backup off-hub** (Nabu Casa cloud backup, or Samba to the PC).
  The exporter covers config, not the whole instance.
- [ ] **Re-run `ha-export.mjs` after any automation change** — it is idempotent; commit the diff.


- [x] **`AGENT.md` understated the tool surface and the tiers.** *(FIXED 2026-08-23 — superseding
  header prepended: records 14 tools (it claimed 7), notes all six tiers plus phases 0–5 shipped,
  lists the seven new components, and points at `self-knowledge.json` + the vault HANDOFF as the
  authoritative sources. Original Tier 0 build plan kept below as history. Confirmed nothing reads
  it at runtime. Commit `d05c7a7`.)*

### Termux editing rule (learned 2026-08-23, three attempts)
For prepending or inserting text into a file on the phone, **use `cat` + a quoted heredoc to a temp
file, then `cat tmp orig > new && mv new orig`.** Do NOT use `node -e "..."` with nested backticks or
`${}` — the shell mangles it silently. Two attempts wrote nothing yet still produced a clean
`git commit`/push; the tell was `nothing to commit, working tree clean`.
**Always verify the file actually changed (`grep -c`, `wc -l` vs `.bak`) — a successful push proves
nothing about whether the edit happened.**


- [x] **`AGENT.md` understates the tool surface and the tiers.** *(FIXED 2026-08-23 — superseding
  header prepended: records the real **14** tools (it claimed 7), notes all six tiers shipped (it
  described 3-6 as future work), lists the seven things shipped today, and points at
  `self-knowledge.json` as the live source. Historical build plan kept below. Commit `d05c7a7`.
  Confirmed nothing reads it at runtime.)*
- [x] **`JARVIS/HANDOFF.md` stale (2026-07-23).** *(FIXED 2026-08-23 — superseding section appended.)*

### Delivery rule #6 (new, learned 2026-08-23)
**On the phone, write documentation with `cat` + a quoted heredoc, not `node -e`.** Two attempts to
prepend a header via Node were mangled by shell quoting before Node ran; both **silently committed
nothing** while still pushing a commit. Always verify a doc edit with `grep -c` and `wc -l` — *a
commit landing is not proof the file changed.*


- [x] **Archive the 546M `~/jarvis` sprawl.** *(DONE 2026-08-23 — 547M moved to
  `~/_archive_jarvis_20260823-044851/`. **Moved, not deleted** — one `mv` restores it. Verified
  after: jarvis-core + Obsidian-Vault- intact, app 200, memory intact. Also archived the 4
  home-screen shortcuts that pointed into it (`JARVIS-new`, `digest.sh`, `jarvis.sh`, `sync.sh` —
  all v1 scripts superseded by the :8737 app and the capture tool). Survivors: `JARVIS` symlink and
  `JARVIS.sh`.)*
- [x] **Tools badge under-reported (10 vs 14).** *(FIXED 2026-08-23 — the badge read the
  vault-filtered list. `/api/tools` now returns `{tools, total, hidden}`; badge reads `total`.
  Live: total 14, shown 11, hidden 3. Commit `49b0313`.)*
- [ ] **Delete `~/_archive_jarvis_*` once you're satisfied nothing broke** — 547M reclaimed. Leave
  it a week; `/data` is at 90% so it's worth doing eventually, but there's no rush.

## New — from the 2026-08-30 supervisor log triage (`Projects/Smart Home/diagnostics/2026-08-30-supervisor-log-triage.md`)

- [ ] **S2 — Run `ha-supervisor-fix.mjs` against the Green (dry run first).** `HA_TOKEN=<admin token> node "Assistant Core/ha-diagnostics/ha-supervisor-fix.mjs"`. This is the measurement that decides whether the boot-ID failure is *journal too large* or *gatewayd wedged* — the log message is identical for both and the fixes are opposite. Do not guess from the note; the tool answers it in one run.
- [ ] **S2 — Clear the ESPHome Device Builder (beta) stale options.** Re-run with `--fix`; removes `use_new_device_builder` and `status_use_ping` from `5c53de3b_esphome-beta`. Restart the add-on afterwards at leisure. Warnings stop at the next options load.
- [ ] **S2 — Repair the host journal** (only if the run says `journal-too-large`). Needs the HA OS **host** shell — SSH port 22222 with a key in `CONFIG/authorized_keys` on the boot partition, or the console; the SSH add-on is a container and cannot see it. `journalctl --rotate` **before** `--vacuum-size=100M` (vacuum only reclaims archived files), then the `10-jarvis-cap.conf` drop-in. Re-run the tool to confirm the boots probe drops under 20s.
- [ ] **Export the FULL supervisor log and re-triage.** The triage covers a 100-line tail spanning three minutes only — it cannot show how often the boot-ID failure fires or what else is failing outside that window.
- [ ] **Fold the Supervisor layer into the regular HA health cadence.** `ha-doctor` audits Core only and has never seen either of these defects; run both tools together before/after an HA upgrade.

## New — 2026-08-31 CREDENTIAL EXPOSURE (do this first)

- [ ] **S1 — REVOKE EVERY HOME ASSISTANT LONG-LIVED TOKEN, NOW.** `etblues449/Obsidian-Vault-` is a **PUBLIC** repo and had **4 distinct HA long-lived access tokens** committed in `Claude Memory/conversations/` (issued 2026-03-23, 04-08, 04-15, 04-27; all valid to **2036**), alongside **2 real Nabu Casa remote URLs**. Endpoint + token = admin control of the house from anywhere on the internet, for anyone who read the repo. HA → Profile → Security → Long-lived access tokens → delete **all** of them. That single action invalidates every leaked token at once, including the 5th one pasted into a chat transcript on 2026-08-31.
- [x] **Redact them from the working tree.** *(Done 2026-08-31: 7 token occurrences across 4 notes + 8 Nabu Casa URLs across 7 notes replaced with `<<REDACTED-…>>` markers.)*
- [ ] **⚠️ The tokens are still in git history and in the public GitHub mirror.** Redaction fixes the tip, not the past. Treat all four as permanently compromised — **revocation is the only real fix**, and history rewriting is blocked here anyway (`permissions.deny` bars force-push; single-writer rule). Optionally also flip the repo to private, but do not treat that as a substitute for revoking.
- [ ] **Issue ONE replacement token and keep it out of files.** `export HA_TOKEN='…'` in the shell on the Fold only — never in a note, never in a committed `.env`, never pasted into chat. `ha-doctor.mjs` and `ha-supervisor-fix.mjs` both already read it from the environment by design.
- [ ] **Add a pre-commit secret scan** so this cannot recur — the vault rule ("never write a secret into a note") exists but nothing enforces it. A `grep -E 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.'` gate in `.claude/hooks/` would have caught all four.

## New — 2026-08-31 Bedroom lights + AI CAM 2

- [x] **Confirm AI CAM 2's real entity IDs.** *(RESOLVED 2026-08-31 from the live registry: the device carries TWO prefixes at once — `ai_cam_2_*` for buttons/switches/most sensors, `landing_ai_cam_2_*` for the assist stack and network sensors. Neither matches the config's `ai_cam_outside_` nor the display name. The `landing_` half is a fossil of its original room.)*
- [x] **~~AI CAM 2 is OFFLINE~~ — WRONG, corrected 2026-08-31.** The board is alive: uptime 3h17m, IP `192.168.0.201`, WiFi −60 dBm, ESPHome 2026.8.1 built 2026-08-29, MAC `28:84:85:49:86:70` — which **confirms the standing hypothesis** that board #2 is the `…:86:70` unit. The earlier call was inferred from a screenshot in which every row showed `—`; that column was not state. **No USB reflash needed.**
- [x] **Area drift RESOLVED 2026-08-31.** Both are right at different times: the board was provisioned on the **Landing** (hence the surviving `landing_ai_cam_2_*` slugs) and has since been moved to the **Bedroom**, which is what HA shows.
- [ ] **Applying the automation is a hub-side action.** `ha-config/automations.yaml` in this vault is an *export* ("UI-managed automations only"); editing it changes nothing. Paste via Settings → Automations → Edit in YAML.

## New — 2026-08-31 live registry audit (`Projects/Smart Home/diagnostics/2026-08-31-bedroom-entity-audit.md`)

- [ ] **S1 — FOUR automations are enabled and cannot work.** All four sit at `state: on`, looking healthy, targeting entities that do not exist or are unavailable. `bedroom_enter` and `bedroom_empty` fire on `binary_sensor.bedroom_bedroom_presence` (**absent from the registry**) at `light.bedroom_light` (**absent**) — they can never have fired. `ai_cam_person_detected_living_room_light` and `..._cleared_living_room_light_off` depend on `binary_sensor.ai_cam_person_occupancy` and `light.living_room_light`, both unavailable. This is the vault's own "silent failures outrank loud ones" lesson, live.
- [ ] **S1 — ANSWER NEEDED: what is the bedroom light?** There is **no bedroom light entity of any name** in the registry. Ten lights exist, six unavailable, and the four responsive ones are two kitchen lights and two ESP status LEDs. Vault docs also reference `light.bedroom`, `light.left_smart_bulb`, `light.right_smart_bulb`, `light.stairs_smart_bulb`, `light.lounge_lights`, `light.rgbic_tv_backlight`, `light.kitchen_2` — **none of those exist either.** Was it removed from HA, is it an offline Govee/SmartThings bulb, or was it never integrated? The bedroom automation is blocked on this one answer.
- [ ] **S2 — Bedroom presence radar is down.** `binary_sensor.bedroom_espectre_status` = `off` and all ~30 of its entities are `unavailable`; `bedroom_csi_node_3_motion_detected` too. Even once a light exists there is no presence source in that room.
- [ ] **S2 — AI CAM 2's camera is powered down.** `switch.landing_ai_cam_2_camera_power_down` = **on** (EXIO3 HIGH holds the OV3660 off). Board #1's equivalent is correctly `off`. One toggle.
- [ ] **S2 — Frigate is down entirely.** Every Frigate-shaped entity is unavailable — `camera.ai_cam`, `image.ai_cam_person`, the occupancy/motion binary sensors, all `sensor.ai_cam_*_count`, and all six `switch.ai_cam_*` controls. The ESPHome camera itself is fine (`camera.living_room_ai_cam_ai_cam` = `idle`), so this is the add-on or its integration, not hardware. **The index's claim that AI Cam is "live in Frigate with recording + person detection" is currently false** and needs correcting once the cause is known.
- [ ] **S3 — Wake word enabled but unselectable, on BOTH boards.** `switch.ai_cam_2_wake_word_enabled` = `on`, yet `select.landing_ai_cam_2_wake_word` / `_wake_word_2` and `select.living_room_ai_cam_wake_word` / `_2` are all `unavailable`. Confirms the recorded microWakeWord regression from the live registry rather than a build log.
- [ ] **Run a full `ha-doctor.mjs` census.** This audit covered only `cam|bedroom|light.`. Four broken automations turned up inside that narrow slice; a full pass is overdue and the credential path now works.
- [ ] **Termux node is broken** — `CANNOT LINK EXECUTABLE "node": cannot locate symbol "OSSL_PROVIDER_add_conf_parameter"`. nodejs 26.4.0 is linked against a newer OpenSSL than the one installed. `pkg install --reinstall openssl nodejs`, or change mirror if the repo serves mismatched builds. Same class as the Claude Code auto-updater breakage already in MEMORY.md.
- [ ] **The vault clone is missing from the Fold** — `cd ~/Obsidian-Vault-` fails, contradicting `VAULT_PATH=/data/data/com.termux/files/home/Obsidian-Vault-` recorded as fixed on 2026-08-06. Re-clone or find where it moved.
- [x] **Automation setup script built** *(2026-08-31: `Assistant Core/ha-diagnostics/apply-bedroom-automations.sh` — curl-only, writes the automations onto the hub via the config API, reloads, reads back. Preflights every entity and aborts rather than writing another dead automation; no `--force`. 17/17 offline. **Blocked on `BEDROOM_LIGHT` only.**)*


---

## New — 2026-09-01 full live diagnosis (report: [[../Projects/Smart Home/sessions/2026-09-01]])

> Run from the browser against the hub API, the Actions logs and the vault directly. Nothing here
> is taken from documentation.

### P0 — do these first
- [ ] **Swap the Groq model — one line.** `Assistant Core/jarvis-skills/runner.mjs:42`,
      `'llama-3.3-70b-versatile'` → `'openai/gpt-oss-120b'`. **Groq decommissioned the old model on
      2026-08-16** (free + developer tiers); all four scheduled skills share `runner.mjs` and have
      failed **25/25 runs** since the workflows were restored on 08-23. Evidence: Morning Brief #38,
      2026-09-01 13:29 BST — `Groq HTTP 404: model_not_found`, exit 1, "No write — reason: error".
      Also fix the doc comments at ~L8 and ~L19. Voice agent's `llama-3.1-8b-instant` retired the
      same day → `openai/gpt-oss-20b`.
- [ ] **Then prove it wrote something.** Run each of the 4 skills once and confirm a file lands
      (`briefings/` is stuck at `2026-08-05`, `connections/` at `2026-08-02`, `synthesis/` at
      `2026-W31`). Green ≠ written — this system has proved that three times.
- [ ] **Rebuild or delete 6 dead presence automations.** Every Govee bulb they target is gone from
      the account: `left_smart_bulb`, `right_smart_bulb`, `rgbic_tv_backlight`, `stairs_smart_bulb`,
      `bedroom_light`. Triggers `binary_sensor.bedroom_bedroom_presence` and
      `binary_sensor.landing_landing_presence` don't exist either. Start with the AI Cam pair —
      the trigger genuinely works, only the targets are dead.
- [ ] **Bedroom radar — physical fix.** ESPectre (.205) is healthy (−38 dBm, 43.5 °C) but every
      LD2410 value is `unknown`: dead UART to the module. Reseat TX/RX + power, verify the ESPHome
      pin map. Also check the ~21-minute uptime for a reboot loop. **Note the IP clash in the docs:
      .205 is the bedroom node, not Landing.**

### P1
- [ ] **Music Assistant is down** — add-on `error`, entry `setup_retry`,
      `Failed to connect to music assistant server http://d5369777-music-assistant:8094`.
      Owns 17 devices / ~27 unavailable entities. Fixing or removing it clears a sixth of the
      dead-entity count in one action.
- [ ] **Claude Desktop add-on** (`db21ed7f_claude_desktop`) in `error`.
- [ ] **`input_boolean.away_mode` was ON** at audit time — it guards most automations. Check before
      debugging any rebuilt automation.
- [ ] **Govee runs over the cloud.** `connection_mode = cloud_api`, lan/mqtt/bluetooth all `off`;
      `living_room_light` + `upstairs_led_bulb` unavailable. Govee2MQTT is referenced in project
      memory but **is not installed**. Decide: local path, or stop documenting it as local-first.
- [ ] **AI CAM 2 firmware was rebuilt 2026-08-29 and still doesn't connect** (31 dead entities).
      Confirm the board joins the network **before** the planned camera-module swap — the swap
      assumes the board is otherwise fine.
- [ ] **Two duplicate dashboards** ("Smart Home", "Jelly Bean's Dash"), both storage-mode, 29 refs
      each, 10 missing + 5 unavailable. Collapse to one. `ui-lovelace-minimal-v2.yaml` is **not in
      use** — edits to it do nothing.
- [ ] **Hub is on Core 2026.9.0b4 — the beta channel.** Not recorded as a decision anywhere.

### P2 — registry cleanup (all verified as 0-device or duplicate)
- [ ] Delete 7 ghost config entries: esphome "Bedroom (bedroom)", esphome "Porch Camera (porch-cam)",
      `cast`, samsungtv "Jelly Bean's tv (UE50NU7470)", samsungtv "Sambed", dlna_dmr "Bose LS Ultra
      Speaker", apple_tv "EShare-5726".
- [ ] Collapse duplicate integrations: TV integrated 3× (dlna_dmr + samsungtv_smart + samsungtv),
      soundbar 2× (dlna_dmr + bose), LS Ultra 2×, EShare 2×. Source of the `_2/_3/_4` suffixes and
      the 7 dead `eshare_5726*` players.
- [ ] Retire **RuView** in HA and in the docs — node unavailable, no bridge add-on installed.
- [ ] Delete the **"Landing Wifi"** ESPHome entry — loaded, **zero entities** (the June ghost).
- [ ] **GitHub integration** — 26 unavailable entities across 7 repos. Re-auth or drop.
- [ ] Remove the stopped **Get HACS** add-on (one-shot installer; HACS loads independently).
- [ ] Dismiss the stale supervisor `no_current_backup` flag — a backup completed 2026-09-01 05:21.

### Claude workspace
- [ ] **Strip the unrelated CLAUDE.md block from the Smart Home project instructions** — it lists
      App / Faceless-Finance / Fincast / Select-lifestyles-Website- / Studying- and an
      Expo/FastAPI/MongoDB stack, none of it this project, prepended to every message.
- [ ] **Correct project memory** — 8 wrong claims (HA version, Voice PE live, TV entity ID, Studio
      Code Server, node IP map, storage, Frigate, lounge automations). **Keep the *Key learnings*
      section verbatim** — it is the best artefact in the estate.
- [ ] **Retire 19 dated YAML snapshots** from project knowledge ("… 28" ×9, "… 14" ×5, "Automation
      11 April 26", "Lounge Yaml 06 April 26"). Point the project at `ha-config/` instead (exported
      2026-08-23, 11/11 automations + 5/5 scenes, verified restorable).
- [ ] **Fold ~14 stray smart-home/JARVIS chats into the project** (ESP32-S3-CAM smart home setup ·
      2026 hardware order page · Log review · Reading the vault before responding · Path to the vault ·
      Vault setup and workflow instructions · JARVIS core phases shipped… · Jarvis project handoff… ·
      chat 1 / chat 2 app interface and automation redesign · 2× duplicate "Jarvis-style app interface" ·
      2× duplicate "Creating an Obsidian plugin" · Customizing obsidian plugin).
- [ ] **Close the 5 Tasks still flagged "Needs attention."**
- [ ] **Vercel scope mismatch** — the connected account lists **0 projects** under "Jelly Bean's
      projects" (hobby) while `jarvis-carousel.vercel.app` serves and `jarvis-voice-lovat.vercel.app`
      404s. Resolve before trusting any Vercel automation. (The Carousel `JARVIS_API_TOKEN` rotation
      you decided on 2026-08-23 to leave is still outstanding by your own record — not re-raised as
      an action, noted for completeness.)

### Corrections this audit makes to items already in this file
- [x] **"Watch the first scheduled runs land"** *(2026-08-23)* — **ANSWERED, and the answer is no.**
      They ran and every one failed on `model_not_found`. Closed by evidence, not by success.
- [x] **"Capture is still idle / Tasker capture leg"** — the capture *path* is fine; Capture Router
      is 3/3 green and the phone-side tool works. Nothing has been captured since 2026-08-23 because
      nothing has been sent, not because anything is broken.
- [ ] **`_index.md` "Lounge: complete (~19 automations)"** — still wrong in the body of that file;
      a superseding block was appended 2026-09-01 rather than rewriting it. A full rewrite is still
      owed (this repeats the standing "Tidy `Projects/Smart Home/_index.md`" item).


## New — 2026-09-03 Obsidian CLI setup

- [x] **Set up the `obsidian:obsidian-cli` skill.** *(2026-09-03: Obsidian 1.13.7 installed in the cloud container on Xvfb, vault cloned and indexed (355 files), CLI registered at `~/.local/bin/obsidian`, **20/20 verification checks green** including `dev:screenshot`. Re-establish per session with `Scripts/obsidian-cli/bootstrap-obsidian-cli.sh` — idempotent, cold-start tested.)*
- [x] **Confirm the headless instance is not a second git writer.** *(2026-09-03: `app.plugins.plugins` empty — Obsidian opens an untrusted vault in Restricted Mode, so `obsidian-git` (autoPushInterval 10, autoPullOnBoot true) never started; clone stayed 0 commits ahead of origin. The bootstrap now asserts this each run rather than relying on it. Feeds the open "identify the client that deleted 8 files from master" item — the cloud container is **ruled out** as a candidate writer, and was not one before today.)*
- [x] **Gitignore per-machine Obsidian UI state.** *(2026-09-03: `.obsidian/workspace.json` + `workspace-mobile.json` added — never tracked, no history, so nothing is lost.)*
- [x] **Android/Termux Obsidian CLI — closed as not possible.** *(2026-09-03: the CLI ships inside the desktop Electron app; the Android build has no CLI and Termux cannot run the desktop app. Advanced URI, claude-code-bridge and plain `git` remain the route on the Fold. Recorded so it is not re-investigated.)*
- [ ] **Run `Scripts/obsidian-cli/Setup-ObsidianCli.ps1` on the Windows PC.** Obsidian was installed there today. The script reports by default and changes nothing; `-Fix` sets `"cli": true` and the user PATH. Parse-checked and logic unit-tested under PowerShell 7.5.3, but **never executed against a real install** — this is the one untested deliverable. Close Obsidian before `-Fix`.
- [ ] **Add `etblues449/Obsidian-Vault-` to the session's authorised repository set** if direct `git push` from a Claude cloud session is wanted. Today the git proxy refused to inject a credential (403) and everything was committed through the Vault connector instead — which works, but produces one commit per file rather than one session commit.


### Corrections this session makes to items added earlier today

- [x] **"Run `Scripts/obsidian-cli/Setup-ObsidianCli.ps1` on the Windows PC" — DONE, not handed over.** *(2026-09-03: the session became linked to the PC mid-conversation. Obsidian 1.13.7 found at `%LOCALAPPDATA%\Programs\Obsidian`, `cli` enabled, install dir added to the user PATH, and `obsidian version` / `vaults` / `eval` / `tags` / `search` / `help` all verified live — `obsidian eval` reports **3001** markdown files in `Jelly Bean's Vault — primary`. `Setup-ObsidianCli.ps1` now reports **all checks passed**; `Test-SetupObsidianCli.ps1` is **33/33 on Windows PowerShell 5.1**.)*
- [x] **"The one untested deliverable" — retired, and it was hiding three real bugs.** *(2026-09-03: running it found (1) the wrong install root — Obsidian's per-user NSIS installer uses `%LOCALAPPDATA%\Programs\Obsidian`, not `%LOCALAPPDATA%\Obsidian`; (2) a `Join-Path` null-root crash where `ProgramFiles(x86)` is absent, because Join-Path evaluates before any filter after it; (3) **PowerShell 5.1 reading `obsidian.json` as ANSI, which corrupted the em dash in `Jelly Bean's Vault — primary` and left Obsidian unable to find the vault**. All three fixed on master with regression tests, including an em-dash round-trip. Bug 3 was repaired from the backup the script takes before editing — vault path verified byte-identical to the backup, vault reopened by name.)*
- [ ] **Standing note for this estate: PowerShell 5.1 is the only PowerShell on the PC** (no `pwsh` 7), and it defaults to the ANSI codepage for both reading and writing. Any future script that edits a JSON/config file containing non-ASCII must force UTF-8 explicitly on **both** sides. `Jelly Bean's Vault — primary` contains an em dash, so this estate hits it by default.
- [ ] **The PC's open vault is `C:\Users\etblu\Documents\Jelly Bean's Vault — primary` and it is NOT a git repo** — so it is not a working copy of `etblues449/Obsidian-Vault-`. Worth reconciling: the session protocol assumes the GitHub repo is the vault, but the vault actually open on the PC syncs by other means. Decide which is canonical before any automation writes to both.



---

## New — 2026-09-04 session (database tool hardened; Fold 7 lost)

> Session record: [[../Projects/Smart Home/sessions/2026-09-04]]

### ⚠️ P0 — hardware

- [ ] **The Fold 7 is lost and offline.** Replacement ordered, not in hand. Every "verified on
      device" proof in this vault was proven on a device that no longer exists; **re-verify P0–P5
      on the replacement before trusting any completion marker.** Setup: clone
      `etblues449/jarvis-core` (`main`), then **restore `.env` by hand — it is gitignored and holds
      every secret, and does NOT come down with the clone.** This is the step most likely to be
      missed.
- [x] **The 2026-08-23 `origin/main` push is what saved P0–P5.** Recorded not as an action but as
      the reason the device loss was survivable — hardline, persona, memory, ledger and capture
      would all have gone with the phone had the 17-day gap still been open. **Push is what makes
      the device disposable.**

### Resolved

- [x] **"Retire the `database` stub per the supabase playbook (decide PostgREST-vs-driver first)."**
      *(Listed twice above — 2026-08-22 and 2026-08-23. **The stub was already retired before this
      session**; the decision was PostgREST + built-in `fetch`, zero dependencies. Confirmed by
      reading `tools/database.mjs` on `origin/main`. This session **hardened** it — commit
      `e51cacf`: exact counts via `Prefer: count=exact` (it had been counting `rows.length` under
      `limit=1000`, so a 1001-row table would have reported a fabricated "1000"), a write-keyword
      guard where there was none, an 8s timeout, and a routing fix — `'run'` was tested twice and
      `'running'` matched it, so "how many agents are running" returned execution history. Plus
      `test/database-test.mjs`, **30 assertions, fully offline** (fetch stubbed, matching the tier
      suites' no-key/no-network rule) and `test/database-live.mjs` for live acceptance. Proven: a
      4th Supabase row was inserted and the tool reported 4 with no code change.)*

### New — the actual stub, previously in no document

- [ ] **`lib/supabase-ai-agent-creator.mjs` is a stub.** Its handler returns
      *"Query handler will be connected in Step 6."* and never opens a connection. It also
      hand-parses `.env` with `line.split('=')`, bypassing `lib/env.mjs` and mangling any value
      containing `=`. **Not `tools/database.mjs`** — the two are easily confused and the confusion
      has already cost a session. Decide: finish it, or delete it as dead code.

### Doc corrections made this session

- [x] **Project `HANDOFF.md` (2026-07-21) calls `database` "a STUB … the #1 unfinished item".**
      *(FALSE, and false when written. **Roughly half of 2026-09-04 was spent rebuilding a working
      tool** because that snapshot was read as current. The vault's `JARVIS/HANDOFF.md` (2026-08-23)
      was correct throughout. Superseding blocks appended to both canonical vault files.)*
- [x] **Project `JARVIS_AGENT_SPEC.md` claims tier4 (27 assertions) + tier5 (34) suites.**
      *(Neither file exists on `origin/main` — `ls test/` shows only tier1, tier2, tier6. The "107
      offline assertions across all tiers" figure is **unsupported**.)*
- [x] **`_index.md` Phase 0 block says "13 callable tools, not 14".** *(Stale as of commit
      `49b0313`; `tools/capture.mjs` shipped in P5 making it **14**. `vault-lib.mjs` is still a
      helper, so the block's reasoning holds — only the number moved.)*
- [ ] **Standing: project files cannot be edited from a session and do not sync back.** Treat
      `HANDOFF.md` and `JARVIS_AGENT_SPEC.md` in the claude.ai project as **historical snapshots,
      never sources of truth.** The vault copies are canonical. Replace or delete the project ones
      when convenient.

### Termux rules earned on the S22 (apply to the replacement Fold)

- [ ] **`pkg install nodejs` can report "already the newest version" while node is unrunnable.**
      Symptom: `CANNOT LINK EXECUTABLE "node": cannot locate symbol
      OSSL_PROVIDER_add_conf_parameter`. The binary is fine; its OpenSSL linkage is stale.
      **Fix: `pkg reinstall openssl nodejs`, answer `N` at the `openssl.cnf` prompt.**
- [ ] **Termux ships no pager** — `git log` dies with `unable to execute pager 'pager'` and prints
      nothing at all. `git config --global core.pager cat`.
- [ ] **A fresh clone has no git identity, and the failure looks like a silent no-op.**
      `git commit` errors with *"Author identity unknown"*, but if anything is chained after it the
      error scrolls away. **Two commits were believed made that were not.** Run `git commit` alone
      and read its output. *(Identity now set globally — the replacement Fold inherits it.)*

### Near-miss worth not repeating

- [ ] **A scratch `~/jarvis-core` was built on the S22 on branch `master` with no shared history
      with the real repo.** Had it been pushed, the rejection would have invited `--force`, which
      would have **destroyed P0–P5 on the remote in the same week the device was lost.** Nothing
      was pushed; the real repo was cloned to `~/jarvis-real` and the work redone against true
      history. **Always `git ls-remote` before assuming a remote is empty.**



### 2026-09-04 later — new-device bootstrap shipped (`3ee6839`)

The Fold-7 restore is now a checked procedure rather than a remembered one.
Three files on `origin/main`:

**`jarvis-doctor.mjs`** — pre-flight check answering one question honestly: *will
JARVIS actually run on this machine?* It derives requirements from the code that
reads them (`lib/brain.mjs` provider `keyName`, `vault-lib.mjs`'s bare
`VAULT_PATH`), so it cannot drift from what the app genuinely needs. Blocks on 4
things, warns on the optional ones, and **loads the real tool registry** — which
independently confirmed **14 tools**, the figure `_index.md` had as 13.

**`.env.example`** — generated from `grep`ping every `process.env.*` in the
codebase, not from memory. Pre-fills the two values that are safe to pre-fill,
leaving only the API key and vault path for a human.

**`SETUP.md`** — the four commands, the required four variables, the Termux
failures, and an explicit instruction to re-verify P0–P5 rather than trust proofs
obtained on a device that no longer exists.

#### Two real defects found while building it

- [x] **`.gitignore:3` was `.env.*`, which swallowed `.env.example`.** The
      template could never have been committed — so on arrival day the clone
      would have had no template, and the doctor's own advice
      (*"cp .env.example .env"*) would have pointed at a missing file. **Fixed**
      with a `!.env.example` negation, verified in both directions: template
      visible, `.env` still ignored by line 2.
- [ ] **`lib/brain.mjs:91` still defaults Groq to `llama-3.3-70b-versatile`** —
      the model decommissioned 2026-08-16 that caused the 25/25 skill failures.
      A fresh clone with `JARVIS_MODEL` unset fails **every turn** with
      `model_not_found`, and it looks like a botched install. The doctor blocks on
      it and `.env.example` pre-fills `openai/gpt-oss-120b`, so the trap is
      *defused* — but **the bad default is still in the code.** One-line fix,
      not made this session: change the `defaultModel` on line 91.

#### Verified both directions, not just one

Fresh clone with no `.env` → 4 blocking, exit 1. Valid throwaway `.env` → all
clear, exit 0. Then three targeted traps, each producing exactly one FAIL:
the retired model named explicitly; `JARVIS_PROVIDER=anthropic` with only a Groq
key present (proving it checks *the selected provider's* key, the failure that
would otherwise look like a working install); and a `VAULT_PATH` pointing at
nothing. Finally the guide's own path was walked — `cp .env.example .env` then
the doctor — leaving exactly the two things only Jelly Bean can supply.

Throwaway `.env` used throughout and deleted; no real secrets involved.

#### Delivery rule earned (add to the standing list)

**Do not put triple-backtick fences inside a `cat` heredoc.** `SETUP.md` was
written once and came out **truncated at ~1/8th** — bash reported
`here-document delimited by end-of-file`, and the `git add` chained after it
never ran either. Use indented code blocks instead, and **verify with `wc -l` and
`tail -1`**, never by the absence of an error. This is delivery rule #6
(`node -e` mangling) recurring in a new disguise.



### 2026-09-04 later still — dead Groq default fixed at source (`470dce8`)

- [x] **`lib/brain.mjs:91` defaulted Groq to `llama-3.3-70b-versatile`.** *(FIXED — now
      `openai/gpt-oss-120b`, with a comment recording why. Also corrected the stale header
      comment at line 15 and the Brain row in `AGENT.md:72`, which still listed the retired
      model "(assumed — see note)". A fresh clone now works with `JARVIS_MODEL` unset.
      `node --check` clean.)*

#### The doctor was wrong within ten minutes of being written

Fixing the default exposed a defect in `jarvis-doctor.mjs` itself: it **hardcoded**
`'llama-3.3-70b-versatile'` as brain.mjs's default in both its logic and its message. So the
moment the code was fixed, the doctor kept reporting the old value and failing a now-correct
install.

**This is the project's signature failure — "documented ≠ running" — reappearing inside the
tool built to prevent it.** A checker that restates what the code defines goes stale exactly
as fast as a document does. Caught only because the fix was verified rather than assumed.

**Fixed properly:** `PROVIDERS` is now exported from `lib/brain.mjs` (additive; nothing else
changed) and the doctor imports the live table. It derives the key name *and* the default
model from the running code, and reports the effective model **with its provenance** —
`(from .env)` or `(brain.mjs default)`. It can no longer disagree with the code it checks.

Verified three ways after the change: no `JARVIS_MODEL` → passes, naming
`openai/gpt-oss-120b (brain.mjs default)`; a retired model in `.env` → still fails, so an old
`.env` pasted onto a new device is caught; `JARVIS_PROVIDER=anthropic` with only a Groq key →
still fails on the derived key name.

`SETUP.md`'s "trap that will bite you" section was rewritten as history rather than left
warning about a fixed bug, and now says what to do the **next** time a provider retires a
model: add it to `DEAD_MODELS`, change `defaultModel`. No API reports retirement, so that
list is maintained by hand — a known limit, written down rather than left to be rediscovered.

#### Standing rule earned

**A checker must derive from the code, never restate it.** If a verification tool contains a
constant that also exists in the thing it verifies, the two will drift — and the checker will
report the stale value with full confidence, which is worse than not checking at all.

