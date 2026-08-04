#!/usr/bin/env node
// assist-preflight.mjs — verify everything the Task 3 Assist automations depend on,
// against the LIVE hub, before and after installing the package. Read-only.
//
// The offline validator (test/validate-assist-package.py) proves the package is
// internally consistent. This proves the other side of the interface: that the entities
// it calls actually exist on the hub, that the satellite really advertises ANNOUNCE and
// START_CONVERSATION, and — the one item the 2026-08-04 handoff left explicitly
// unresolved — what the legacy mobile_app notify service is actually called.
//
// Zero dependencies. Node >= 18 (global fetch). £0 forever (C1).
//
// Usage:
//   HA_TOKEN=<long-lived-access-token> node "Assistant Core/ha-diagnostics/assist-preflight.mjs"
//   HA_TOKEN=... node ".../assist-preflight.mjs" --post     # after installing the package
//   HA_TOKEN=... HA_URL=https://<id>.ui.nabu.casa node ".../assist-preflight.mjs"
//
// The token comes from HA -> profile -> Security -> Long-lived access tokens.
// It is read from the environment and is NEVER printed or written anywhere.

const HA_URL = (process.env.HA_URL || 'http://192.168.0.200:8123').replace(/\/$/, '');
const HA_TOKEN = process.env.HA_TOKEN;
const POST = process.argv.includes('--post');
const AS_JSON = process.argv.includes('--json');

if (!HA_TOKEN) {
  console.error('FATAL: set HA_TOKEN (HA -> profile -> Security -> Long-lived access tokens).');
  process.exit(2);
}

// Entities the package CALLS but does not create. Every one was read from the live
// instance on 2026-08-04 or corroborated by the 2026-08-02 ha-doctor report — this
// re-checks them rather than trusting the record.
const REQUIRED_EXTERNAL = [
  ['assist_satellite.living_room_ai_cam_assist_satellite', 'Assist satellite (announce + ask_question)'],
  ['person.elliot_horton', 'Presence — NOT person.elliot'],
  ['light.living_room_light', 'Living room light'],
  ['camera.living_room_ai_cam_ai_cam', 'AI Cam camera'],
  ['media_player.living_room_ai_cam_ai_cam_speaker', 'AI Cam speaker'],
];

// Notify entities from the handoff. Treated as a group: the package targets the two phone
// entities, and ha-doctor counted only 2 notify entities on 2026-08-02 against the 3
// listed in the handoff, so each is reported individually rather than assumed.
const NOTIFY_ENTITIES = [
  'notify.jelly_bean_s_phone',
  'notify.jb_s_phone',
  'notify.big_pad',
];

// Created BY the package. Absent before install (informational), required after (--post).
const PACKAGE_ENTITIES = [
  ['binary_sensor.ai_cam_person', 'Frigate person count -> occupancy, edge-triggerable'],
  ['binary_sensor.ai_cam_motion', 'Frigate motion'],
  ['camera.ai_cam_person_snapshot', 'Person snapshot for notification images'],
  ['switch.ai_cam_detection', 'Privacy switch -> frigate/ai_cam/detect/set'],
  ['input_boolean.ai_cam_light_auto', 'Tracks an automatic light-on'],
  ['input_boolean.ai_cam_auto_privacy', 'Enables privacy-follows-presence (ships OFF)'],
  ['input_boolean.ai_cam_simple_alert_only', 'Selects simple announce over the challenge'],
  ['script.jarvis_person_notify', 'Shared notification path'],
];

const PACKAGE_AUTOMATION_IDS = [
  'jarvis_ai_cam_person_light_on',
  'jarvis_ai_cam_person_light_off',
  'jarvis_ai_cam_person_announce_away',
  'jarvis_ai_cam_privacy_follows_presence',
  'jarvis_ai_cam_challenge_person',
];

const REQUIRED_SERVICES = [
  ['assist_satellite', 'announce'],
  ['assist_satellite', 'ask_question'],
  ['notify', 'send_message'],
  ['mqtt', 'publish'],
  ['light', 'turn_on'],
  ['input_boolean', 'turn_on'],
];

const FEATURE = { ANNOUNCE: 1, START_CONVERSATION: 2 };
const HDRS = { Authorization: `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' };
const B = { ok: '✅', warn: '⚠️', bad: '❌', info: 'ℹ️' };

const checks = [];
const notes = [];
const record = (ok, name, detail, required = true) =>
  checks.push({ ok, name, detail, required });

async function api(path, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${HA_URL}${path}`, { headers: HDRS, signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, text };
    try { return { ok: true, data: JSON.parse(text) }; }
    catch { return { ok: true, data: null, text }; }
  } catch (e) {
    return { ok: false, status: 0, text: String(e.message || e) };
  } finally { clearTimeout(t); }
}

async function main() {
  const alive = await api('/api/');
  if (!alive.ok) {
    console.error(`FATAL: hub unreachable at ${HA_URL} (${alive.status} ${String(alive.text).slice(0, 140)})`);
    console.error('Same LAN as the hub? Token still valid? Try HA_URL=<your Nabu Casa URL>.');
    process.exit(1);
  }

  const cfg = (await api('/api/config')).data || {};
  const statesRes = await api('/api/states');
  if (!statesRes.ok) {
    console.error(`FATAL: /api/states returned ${statesRes.status}. The token may lack permission.`);
    process.exit(1);
  }
  const states = statesRes.data || [];
  const byId = new Map(states.map((s) => [s.entity_id, s]));
  const svcRes = await api('/api/services');
  const services = svcRes.ok ? (svcRes.data || []) : [];
  const svcMap = new Map(services.map((s) => [s.domain, Object.keys(s.services || {})]));

  // ── 1. External entities ──────────────────────────────────────────────────
  for (const [eid, why] of REQUIRED_EXTERNAL) {
    const st = byId.get(eid);
    const usable = st && st.state !== 'unavailable' && st.state !== 'unknown';
    record(!!usable, `entity ${eid}`,
      st ? `${why} — state: ${st.state}` : `${why} — MISSING from the registry`);
  }

  // ── 2. Satellite capability ───────────────────────────────────────────────
  const sat = byId.get('assist_satellite.living_room_ai_cam_assist_satellite');
  if (sat) {
    const f = Number(sat.attributes?.supported_features ?? 0);
    const has = (bit) => (f & bit) === bit;
    record(has(FEATURE.ANNOUNCE), 'satellite supports ANNOUNCE',
      `supported_features=${f} (ANNOUNCE=1, START_CONVERSATION=2)`);
    record(has(FEATURE.START_CONVERSATION), 'satellite supports START_CONVERSATION',
      `supported_features=${f} — advertised by the satellite; core still refuses the call ` +
      `while the pipeline uses the built-in conversation agent`, false);
  }

  // ── 3. Services ───────────────────────────────────────────────────────────
  for (const [domain, name] of REQUIRED_SERVICES) {
    const present = (svcMap.get(domain) || []).includes(name);
    record(present, `service ${domain}.${name}`, present ? 'available' : 'NOT registered');
  }

  // ── 4. The unresolved handoff item: the legacy notify service name ────────
  const notifySvcs = (svcMap.get('notify') || []).filter((n) => n.startsWith('mobile_app_'));
  const guessed = 'notify.mobile_app_jelly_bean_s_phone';
  if (notifySvcs.length) {
    const full = notifySvcs.map((n) => `notify.${n}`);
    const matched = full.includes(guessed);
    record(matched, 'legacy mobile_app notify service name',
      matched
        ? `${guessed} EXISTS — jarvis_person_notify needs no change`
        : `${guessed} does NOT exist. Found: ${full.join(', ')}. ` +
          `Set legacy_mobile_service in script.jarvis_person_notify to the right one.`);
    notes.push(`Legacy notify services on this hub: ${full.join(', ')}`);
  } else {
    record(false, 'legacy mobile_app notify service name',
      'No notify.mobile_app_* services found. Image attachments are unavailable; the ' +
      'text notification via notify.send_message still works.');
  }

  // ── 5. Notify entities ────────────────────────────────────────────────────
  const notifyFound = NOTIFY_ENTITIES.filter((e) => byId.has(e));
  record(notifyFound.length > 0, 'notify entities for notify.send_message',
    `present: ${notifyFound.join(', ') || 'NONE'}` +
    (notifyFound.length < NOTIFY_ENTITIES.length
      ? ` | absent: ${NOTIFY_ENTITIES.filter((e) => !byId.has(e)).join(', ')}`
      : ''));

  // ── 6. Frigate: confirm the integration really is absent ─────────────────
  const frigateSvc = svcMap.has('frigate');
  const frigateEnts = states.filter((s) => /^(sensor|switch|binary_sensor|camera)\.frigate/.test(s.entity_id));
  record(!frigateSvc, 'Frigate HA integration absent (MQTT is the only route)',
    frigateSvc
      ? 'A frigate service domain now EXISTS — the integration was installed since the ' +
        'handoff. The MQTT entities in this package would duplicate it; reconcile before use.'
      : `no frigate service domain; ${frigateEnts.length} frigate-prefixed entities`);

  // ── 7. Conversation agents (context for start_conversation) ──────────────
  const convo = states.filter((s) => s.entity_id.startsWith('conversation.'));
  const nonDefault = convo.filter((s) => s.entity_id !== 'conversation.home_assistant');
  record(true, 'conversation agents on the instance',
    convo.length
      ? convo.map((s) => `${s.entity_id} (${s.attributes?.friendly_name || '?'})`).join(', ')
      : 'none found', false);
  if (nonDefault.length) {
    notes.push(
      `start_conversation is blocked only while the pipeline's conversation engine is the ` +
      `built-in agent. Non-default agents available: ` +
      `${nonDefault.map((s) => s.attributes?.friendly_name || s.entity_id).join(', ')}. ` +
      `Switching the pipeline routes ALL voice commands through that agent — check for a ` +
      `"prefer handling commands locally" option first. ask_question does not need this.`);
  }

  // ── 8. Package entities + automations ────────────────────────────────────
  for (const [eid, why] of PACKAGE_ENTITIES) {
    const st = byId.get(eid);
    record(!!st, `package entity ${eid}`,
      st ? `${why} — state: ${st.state}` : `${why} — not present (expected before install)`,
      POST);
  }
  const autos = states.filter((s) => s.entity_id.startsWith('automation.'));
  for (const id of PACKAGE_AUTOMATION_IDS) {
    const a = autos.find((s) => s.attributes?.id === id);
    record(!!a, `automation ${id}`,
      a ? `${a.entity_id} — ${a.state}, last_triggered: ${a.attributes?.last_triggered || 'never'}`
        : 'not loaded (expected before install)',
      POST);
  }

  // ── Report ────────────────────────────────────────────────────────────────
  if (AS_JSON) {
    console.log(JSON.stringify({ hub: HA_URL, core: cfg.version, mode: POST ? 'post-install' : 'pre-install', checks, notes }, null, 2));
  } else {
    console.log(`\nAssist preflight — ${HA_URL} (core ${cfg.version || '?'}) — ${POST ? 'post-install' : 'pre-install'}\n`);
    for (const c of checks) {
      const mark = c.ok ? B.ok : (c.required ? B.bad : B.warn);
      console.log(`${mark} ${c.name}\n     ${c.detail}`);
    }
    if (notes.length) {
      console.log(`\n${B.info} Notes`);
      for (const n of notes) console.log(`   - ${n}`);
    }
  }

  // Counted honestly: an advisory check that did not pass is reported as advisory, not
  // folded into the pass total. "30/30 passed" while 13 lines showed a warning is exactly
  // the kind of green-looking summary this vault has been burned by before.
  const failed = checks.filter((c) => c.required && !c.ok);
  const advisory = checks.filter((c) => !c.required && !c.ok);
  const required = checks.filter((c) => c.required);
  console.log(
    `\n${required.length - failed.length}/${required.length} required checks passed` +
    (advisory.length ? `, ${advisory.length} advisory not met` : '') +
    (failed.length ? ` — ${failed.length} REQUIRED failure(s)` : '') + '.');
  if (!POST && advisory.length) {
    console.log('Advisory items above are the package\'s own entities: expected before install. ' +
      'Re-run with --post after installing, where they become required.');
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2); });
