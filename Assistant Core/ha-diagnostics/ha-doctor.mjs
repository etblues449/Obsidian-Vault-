#!/usr/bin/env node
// ha-doctor.mjs — JARVIS Home Assistant full diagnostic (read-only)
//
// Runs against the HA Green hub over the LAN and produces a Markdown health
// report covering: core config, config validity, entity census, automations,
// scenes, scripts, people/presence, companion app, areas/registry coverage,
// pending updates, JARVIS node reachability, canonical-entity checks, and the
// error log.
//
// Zero dependencies. Node >= 18 (global fetch). £0 forever (C1).
//
// Usage (Termux on the Fold 7, or the PC — same LAN as the hub):
//   HA_TOKEN=<long-lived-access-token> node ha-doctor.mjs
//   HA_TOKEN=... node ha-doctor.mjs --out "Claude Memory/Projects/Smart Home/diagnostics/$(date +%F)-ha-doctor.md"
//   HA_TOKEN=... HA_URL=http://192.168.0.200:8123 node ha-doctor.mjs --json
//
// The token comes from HA → your profile → Security → Long-lived access tokens.
// It is read from the environment and is NEVER written to the report or vault.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const HA_URL = (process.env.HA_URL || 'http://192.168.0.200:8123').replace(/\/$/, '');
const HA_TOKEN = process.env.HA_TOKEN;
const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const AS_JSON = args.includes('--json');
// Remote run (e.g. via the Nabu Casa URL): the hub API works but the 192.168.0.x
// node probes are unreachable — skip them instead of falsely reporting "down".
const REMOTE = args.includes('--remote') || /nabu\.casa/i.test(HA_URL);
const STALE_AUTOMATION_DAYS = 30;
const STALE_TRACKER_HOURS = 48;

// JARVIS ground truth — keep in sync with Claude Memory/Projects/Smart Home/smart_home.md
const NODES = [
  { name: 'HA Green hub', probe: `${HA_URL}/` },
  { name: 'ai_cam (ESPHome web)', probe: 'http://192.168.0.199/' },
  { name: 'ai_cam MJPEG stream', probe: 'http://192.168.0.199:8080/' },
  { name: 'ai_cam snapshot', probe: 'http://192.168.0.199:8081/' },
  { name: 'ESP32-S3-AUDIO-Board', probe: 'http://192.168.0.216/' },
  { name: 'RuView CSI node', probe: 'http://192.168.0.227/' },
  { name: 'cctv_cam', probe: 'http://192.168.0.234/' },
  { name: 'porch', probe: 'http://192.168.0.240/' },
];
const CANONICAL = {
  // Decided 2026-08-02 from live evidence: device_class tv, full source_list, SmartThings-class
  // features. media_player.jelly_beans_tv_tv_jelly_beans_tv is the DLNA shell — not canonical.
  tv: 'media_player.jelly_beans_tv_3',
  aiCamCamera: 'camera.ai_cam',
  aiCamSpeaker: 'media_player.ai_cam_speaker',
  aiCamPwdn: 'switch.ai_cam_camera_power_down', // must be OFF: EXIO3 LOW = camera powered
  aiCamAmp: 'switch.ai_cam_amp_enable',          // must be ON: NS4150B enabled
};
const RUVIEW_KINDS = ['presence', 'breathing', 'heart', 'motion', 'person', 'anomal'];

if (!HA_TOKEN) {
  console.error('FATAL: set HA_TOKEN (HA → profile → Security → Long-lived access tokens).');
  process.exit(2);
}

const HDRS = { Authorization: `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' };

async function api(path, opts = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${HA_URL}${path}`, { headers: HDRS, signal: ctrl.signal, ...opts });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, text };
    try { return { ok: true, data: JSON.parse(text), text }; }
    catch { return { ok: true, data: null, text }; }
  } catch (e) {
    return { ok: false, status: 0, text: String(e.message || e) };
  } finally { clearTimeout(t); }
}

// Render a Jinja template on the hub. Templates below emit JSON by construction.
// NOTE: /api/template is @require_admin in HA core — a non-admin token gets 401.
async function template(tpl) {
  const r = await api('/api/template', { method: 'POST', body: JSON.stringify({ template: tpl }) });
  if (!r.ok) return { ok: false, admin: r.status === 401 || r.status === 403, error: `${r.status}: ${r.text.slice(0, 200)}` };
  try { return { ok: true, data: JSON.parse(r.text) }; }
  catch { return { ok: true, data: r.text }; }
}

async function probe(url, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // GET, not HEAD: ESPHome's web server and MJPEG endpoints handle GET reliably.
    // Once headers arrive the node is up; abort so we never consume an MJPEG stream.
    const res = await fetch(url, { signal: ctrl.signal });
    const status = res.status;
    ctrl.abort();
    return { up: true, status };
  } catch {
    // Timeout-abort, refused, or unreachable — all mean down.
    return { up: false, status: 0 };
  } finally { clearTimeout(t); }
}

const ago = (iso) => iso ? (Date.now() - Date.parse(iso)) / 3600000 : Infinity; // hours
const days = (h) => (h / 24).toFixed(1);
const B = { ok: '✅', warn: '⚠️', bad: '❌', info: 'ℹ️' };

async function main() {
  const report = { meta: { generated: new Date().toISOString(), hub: HA_URL }, sections: {} };
  const summary = [];
  const actions = [];

  // ── 1. Core ────────────────────────────────────────────────────────────────
  const alive = await api('/api/');
  if (!alive.ok) {
    console.error(`FATAL: hub unreachable at ${HA_URL} (${alive.status} ${alive.text.slice(0, 120)})`);
    console.error('Are you on the same LAN? Is the token valid?');
    process.exit(1);
  }
  const cfg = (await api('/api/config')).data || {};
  report.sections.core = {
    version: cfg.version, location: cfg.location_name, tz: cfg.time_zone,
    state: cfg.state, safe_mode: cfg.safe_mode ?? false,
    components: (cfg.components || []).length,
    internal_url: cfg.internal_url, external_url: cfg.external_url,
  };
  summary.push([cfg.state === 'RUNNING' && !cfg.safe_mode ? B.ok : B.bad,
    `Core ${cfg.version} · ${cfg.state}${cfg.safe_mode ? ' · SAFE MODE' : ''} · ${report.sections.core.components} integrations`]);
  if (cfg.time_zone !== 'Europe/London')
    actions.push(`Timezone is \`${cfg.time_zone}\`, expected \`Europe/London\` — scheduled automations will fire at the wrong hour.`);

  // ── 2. Config validity ─────────────────────────────────────────────────────
  const check = await api('/api/config/core/check_config', { method: 'POST' }, 60000);
  const checkRes = check.ok ? check.data : null;
  report.sections.config_check = checkRes || { error: check.text?.slice(0, 300) };
  if (checkRes?.result === 'valid') summary.push([B.ok, 'Configuration valid (`check_config`)']);
  else if (checkRes) {
    summary.push([B.bad, `Configuration INVALID: ${String(checkRes.errors).slice(0, 200)}`]);
    actions.push(`Fix config errors before next restart: ${String(checkRes.errors).slice(0, 300)}`);
  } else summary.push([B.warn, `check_config not available (${check.status}) — needs an admin token`]);

  // ── 3. Entity census ───────────────────────────────────────────────────────
  const statesRes = await api('/api/states');
  const states = statesRes.ok ? statesRes.data : [];
  const byDomain = {};
  for (const s of states) {
    const d = s.entity_id.split('.')[0];
    (byDomain[d] ||= []).push(s);
  }
  const unavailable = states.filter(s => s.state === 'unavailable');
  const unknown = states.filter(s => s.state === 'unknown');
  report.sections.census = {
    total: states.length,
    domains: Object.fromEntries(Object.entries(byDomain).map(([d, v]) => [d, v.length]).sort((a, b) => b[1] - a[1])),
    unavailable: unavailable.map(s => s.entity_id),
    unknown_count: unknown.length,
  };
  summary.push([unavailable.length > states.length * 0.1 ? B.warn : B.ok,
    `${states.length} entities · ${unavailable.length} unavailable · ${unknown.length} unknown`]);
  if (unavailable.length) {
    const grouped = {};
    for (const s of unavailable) (grouped[s.entity_id.split('.')[0]] ||= []).push(s.entity_id);
    const worst = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length).slice(0, 3)
      .map(([d, ids]) => `${d} (${ids.length})`).join(', ');
    actions.push(`${unavailable.length} unavailable entities — worst domains: ${worst}. Dead nodes or removed devices left in the registry.`);
  }

  // ── 4. Automations ─────────────────────────────────────────────────────────
  const autos = byDomain.automation || [];
  const autosOff = autos.filter(a => a.state === 'off');
  const autosUnavail = autos.filter(a => a.state === 'unavailable');
  const never = autos.filter(a => !a.attributes.last_triggered);
  const stale = autos.filter(a => a.attributes.last_triggered && ago(a.attributes.last_triggered) > STALE_AUTOMATION_DAYS * 24);
  report.sections.automations = {
    total: autos.length, off: autosOff.map(a => a.entity_id), unavailable: autosUnavail.map(a => a.entity_id),
    never_triggered: never.map(a => a.entity_id),
    stale: stale.map(a => ({ id: a.entity_id, last: a.attributes.last_triggered })),
  };
  summary.push([autosUnavail.length ? B.bad : B.ok,
    `${autos.length} automations · ${autosOff.length} off · ${never.length} never triggered · ${stale.length} stale >${STALE_AUTOMATION_DAYS}d`]);
  if (autosUnavail.length) actions.push(`${autosUnavail.length} automations UNAVAILABLE (broken references): ${autosUnavail.map(a => a.entity_id).join(', ')}`);
  if (never.length) actions.push(`${never.length} automations have never fired — either new, dead triggers, or waiting on entities that no longer exist: ${never.slice(0, 8).map(a => a.entity_id).join(', ')}${never.length > 8 ? ' …' : ''}`);

  // ── 5. Scenes (validate members against live entities) ─────────────────────
  const scenes = byDomain.scene || [];
  const known = new Set(states.map(s => s.entity_id));
  const unavailSet = new Set(unavailable.map(s => s.entity_id));
  const sceneIssues = [];
  for (const sc of scenes) {
    const members = sc.attributes.entity_id || [];
    const missing = members.filter(e => !known.has(e));
    const dead = members.filter(e => unavailSet.has(e));
    if (missing.length || dead.length)
      sceneIssues.push({ scene: sc.entity_id, missing, unavailable: dead });
  }
  report.sections.scenes = { total: scenes.length, issues: sceneIssues };
  summary.push([sceneIssues.length ? B.warn : B.ok, `${scenes.length} scenes · ${sceneIssues.length} with missing/dead members`]);
  for (const i of sceneIssues)
    actions.push(`Scene \`${i.scene}\`: ${i.missing.length ? `references nonexistent ${i.missing.join(', ')}` : ''}${i.unavailable.length ? ` unavailable ${i.unavailable.join(', ')}` : ''}`.trim());

  // ── 6. Scripts ─────────────────────────────────────────────────────────────
  const scripts = byDomain.script || [];
  report.sections.scripts = { total: scripts.length, never_run: scripts.filter(s => !s.attributes.last_triggered).map(s => s.entity_id) };
  summary.push([B.info, `${scripts.length} scripts · ${report.sections.scripts.never_run.length} never run`]);

  // ── 7. People & presence ───────────────────────────────────────────────────
  const people = byDomain.person || [];
  const trackers = byDomain.device_tracker || [];
  const staleTrackers = trackers.filter(t => ago(t.last_updated) > STALE_TRACKER_HOURS);
  report.sections.people = {
    persons: people.map(p => ({ id: p.entity_id, state: p.state, sources: p.attributes.source || p.attributes.device_trackers || [] })),
    trackers: trackers.length, stale_trackers: staleTrackers.map(t => t.entity_id),
  };
  summary.push([people.length ? B.ok : B.warn, `${people.length} people · ${trackers.length} device_trackers · ${staleTrackers.length} stale >${STALE_TRACKER_HOURS}h`]);
  if (!people.length) actions.push('No person entities — presence-aware automations have nothing to key on. Add your person + attach the Fold 7 tracker.');
  for (const p of people) if (!(p.attributes.source || (p.attributes.device_trackers || []).length))
    actions.push(`Person \`${p.entity_id}\` has no device_tracker attached — presence state is manual-only.`);

  // ── 8. Companion app (mobile_app) ──────────────────────────────────────────
  const mob = await template(`{{ integration_entities('mobile_app') | list | to_json }}`);
  if (!mob.ok && mob.admin) {
    report.sections.companion = { error: 'template API requires an admin token' };
    summary.push([B.warn, 'Companion app check skipped — /api/template needs an ADMIN long-lived token']);
  } else {
    const mobEntities = (mob.ok && Array.isArray(mob.data)) ? mob.data : [];
    const mobStates = states.filter(s => mobEntities.includes(s.entity_id));
    const batteries = mobStates.filter(s => /battery_level$/.test(s.entity_id));
    report.sections.companion = {
      entities: mobEntities.length,
      batteries: batteries.map(b => ({ id: b.entity_id, level: b.state })),
      unavailable: mobStates.filter(s => s.state === 'unavailable').map(s => s.entity_id),
    };
    summary.push([mobEntities.length ? B.ok : B.warn, `Companion app: ${mobEntities.length} entities · ${batteries.length} battery sensors`]);
    if (!mobEntities.length) actions.push('No mobile_app entities — the Companion app is not connected (or its integration entry is dead). Reinstall/re-login on the Fold 7.');
  }

  // ── 9. Areas & registry coverage (Assist depends on this) ──────────────────
  const areasT = await template(
    `[{% for a in areas() %}{"id": {{ a | to_json }}, "name": {{ area_name(a) | to_json }}, "entities": {{ area_entities(a) | list | to_json }}, "devices": {{ area_devices(a) | list | count }}}{{ "," if not loop.last }}{% endfor %}]`);
  if (!areasT.ok && areasT.admin) {
    report.sections.areas = { error: 'template API requires an admin token' };
    summary.push([B.warn, 'Area-coverage check skipped — /api/template needs an ADMIN long-lived token']);
  } else {
    const areas = (areasT.ok && Array.isArray(areasT.data)) ? areasT.data : [];
    const inArea = new Set(areas.flatMap(a => a.entities));
    const actionable = states.filter(s => ['light', 'switch', 'media_player', 'cover', 'climate', 'fan', 'camera', 'lock'].includes(s.entity_id.split('.')[0]));
    const noArea = actionable.filter(s => !inArea.has(s.entity_id));
    report.sections.areas = {
      areas: areas.map(a => ({ name: a.name, entities: a.entities.length, devices: a.devices })),
      actionable_without_area: noArea.map(s => s.entity_id),
    };
    summary.push([noArea.length ? B.warn : B.ok, `${areas.length} areas · ${noArea.length} actionable entities with NO area`]);
    if (noArea.length)
      actions.push(`${noArea.length} lights/switches/players/cameras have no Area. Voice ("turn on the lights") resolves by area — this is the \`no_valid_targets\` bug from the AI Cam session. Assign areas: ${noArea.slice(0, 10).map(s => s.entity_id).join(', ')}${noArea.length > 10 ? ' …' : ''}`);
  }

  // ── 10. Pending updates ────────────────────────────────────────────────────
  const updates = (byDomain.update || []).filter(u => u.state === 'on');
  report.sections.updates = updates.map(u => ({
    id: u.entity_id, installed: u.attributes.installed_version, latest: u.attributes.latest_version,
  }));
  summary.push([updates.length > 5 ? B.warn : B.info, `${updates.length} pending updates`]);

  // ── 11. JARVIS node reachability ───────────────────────────────────────────
  const probes = [];
  for (const n of NODES) {
    const isLan = /192\.168\./.test(n.probe);
    if (REMOTE && isLan) { probes.push({ name: n.name, url: n.probe, skipped: true }); continue; }
    probes.push({ name: n.name, url: n.probe, ...(await probe(n.probe)) });
  }
  report.sections.nodes = probes;
  const probed = probes.filter(p => !p.skipped);
  const downNodes = probed.filter(p => !p.up);
  const skippedN = probes.length - probed.length;
  summary.push([downNodes.length ? B.bad : B.ok,
    `Nodes: ${probed.length - downNodes.length}/${probed.length} reachable${skippedN ? ` · ${skippedN} LAN probes skipped (remote run — re-run on the LAN for node reachability)` : ''}`]);
  for (const d of downNodes) actions.push(`Node DOWN: ${d.name} (${d.url}) — check power first (cctv .234 / porch .240 are suspected hardware-down, not config).`);
  if (skippedN) actions.push('Re-run ha-doctor from the LAN once for the direct node probes (.199/.216/.227/.234/.240) — entity availability above covers them only indirectly.');

  // ── 12. JARVIS canonical-entity checks ─────────────────────────────────────
  // The index documents short ai_cam_* IDs; the dashboard YAMLs use
  // living_room_ai_cam_* (HA device-name prefixing). This check answers which
  // naming is live so the vault docs and dashboard can be reconciled.
  const canon = [];
  const get = (id) => states.find(s => s.entity_id === id);
  const getEither = (short, ...prefixed) => {
    const s = get(short); if (s) return { st: s, form: 'short' };
    for (const id of prefixed) { const p = get(id); if (p) return { st: p, form: 'prefixed' }; }
    return { st: null, form: 'missing' };
  };
  const tv = get(CANONICAL.tv);
  canon.push({ check: `${CANONICAL.tv} exists`, ok: !!tv, detail: tv ? tv.state : 'MISSING — canonical TV entity' });
  const staleTv = get('media_player.jelly_beans_tv');
  if (staleTv) canon.push({ check: 'stale media_player.jelly_beans_tv absent', ok: false, detail: `exists (${staleTv.state}) — dashboard v2-corrected referenced it; canonical is ${CANONICAL.tv}` });
  const cam = getEither(CANONICAL.aiCamCamera, 'camera.living_room_ai_cam', 'camera.living_room_ai_cam_ai_cam');
  canon.push({ check: 'AI Cam camera entity available', ok: cam.st && cam.st.state !== 'unavailable', detail: cam.st ? `${cam.st.entity_id} (${cam.form} form): ${cam.st.state}` : 'MISSING in both forms' });
  const spk = getEither(CANONICAL.aiCamSpeaker, 'media_player.living_room_ai_cam_ai_cam_speaker');
  canon.push({ check: 'AI Cam speaker entity available', ok: spk.st && spk.st.state !== 'unavailable', detail: spk.st ? `${spk.st.entity_id} (${spk.form} form): ${spk.st.state}` : 'MISSING in both forms' });
  const pwdn = getEither(CANONICAL.aiCamPwdn, 'switch.living_room_ai_cam_camera_power_down');
  canon.push({ check: 'AI Cam "Camera Power Down" switch is OFF (EXIO3 LOW = camera powered)', ok: pwdn.st?.state === 'off', detail: pwdn.st ? `${pwdn.st.entity_id}: ${pwdn.st.state}` : 'MISSING in both forms' });
  const amp = getEither(CANONICAL.aiCamAmp, 'switch.living_room_ai_cam_amp_enable');
  canon.push({ check: 'AI Cam "Amp Enable" switch is ON (NS4150B)', ok: amp.st?.state === 'on', detail: amp.st ? `${amp.st.entity_id}: ${amp.st.state}` : 'MISSING in both forms' });
  const naming = [cam, spk, pwdn, amp].map(x => x.form).filter(f => f !== 'missing');
  if (naming.length)
    canon.push({ check: 'AI Cam entity naming (index says short, dashboard says living_room_ prefixed)', ok: true, detail: `live registry uses the ${naming[0].toUpperCase()} form — update ${naming[0] === 'short' ? 'the dashboard YAMLs' : "the Smart Home index's entity reference"} to match` });
  const ruview = states.filter(s => RUVIEW_KINDS.some(k => s.entity_id.includes(k)) && s.entity_id.match(/^(binary_)?sensor\./));
  canon.push({ check: 'RuView CSI entities present & fresh', ok: ruview.length >= 3 && ruview.some(r => r.state !== 'unavailable'), detail: `${ruview.length} matched` });
  report.sections.canonical = canon;
  const canonBad = canon.filter(c => !c.ok);
  summary.push([canonBad.length ? B.bad : B.ok, `Canonical checks: ${canon.length - canonBad.length}/${canon.length} pass`]);
  for (const c of canonBad) actions.push(`Canonical check FAILED: ${c.check} → ${c.detail}`);

  // ── 13. Error log tail (admin-only endpoint) ───────────────────────────────
  const elog = await api('/api/error_log');
  if (!elog.ok) {
    report.sections.error_log = { error: `unavailable (${elog.status}) — /api/error_log needs an ADMIN token` };
    summary.push([B.warn, 'Error log skipped — needs an ADMIN long-lived token']);
  } else {
    const lines = elog.text.trim().split('\n');
    const errs = lines.filter(l => / ERROR /.test(l));
    const warns = lines.filter(l => / WARNING /.test(l));
    report.sections.error_log = { errors: errs.length, warnings: warns.length, last_errors: errs.slice(-10) };
    summary.push([errs.length > 20 ? B.warn : B.info, `Error log: ${errs.length} errors · ${warns.length} warnings`]);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (AS_JSON) { console.log(JSON.stringify(report, null, 2)); return; }

  const md = [];
  md.push(`# HA Doctor — ${new Date().toISOString().slice(0, 10)}`);
  md.push('');
  md.push(`> Read-only diagnostic of ${HA_URL} · generated ${report.meta.generated}`);
  md.push(`> Tool: \`Assistant Core/ha-diagnostics/ha-doctor.mjs\` · re-run any time`);
  md.push('');
  md.push('## Summary');
  md.push('');
  for (const [icon, line] of summary) md.push(`- ${icon} ${line}`);
  md.push('');
  md.push('## Action items (ranked)');
  md.push('');
  if (!actions.length) md.push('None — clean bill of health.');
  for (const a of actions) md.push(`- [ ] ${a}`);
  md.push('');
  md.push('## Detail');
  md.push('');
  md.push('```json');
  md.push(JSON.stringify(report.sections, null, 2));
  md.push('```');
  const out = md.join('\n') + '\n';

  if (OUT) {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, out);
    console.log(`Report written: ${OUT}`);
    console.log('\n--- SUMMARY ---');
    for (const [icon, line] of summary) console.log(`${icon} ${line}`);
    console.log(`\n${actions.length} action item(s).`);
  } else {
    console.log(out);
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
