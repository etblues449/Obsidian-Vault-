#!/usr/bin/env node
// ha-supervisor-fix.mjs — JARVIS Home Assistant *Supervisor* diagnostic & repair
//
// Companion to ha-doctor.mjs. ha-doctor audits Home Assistant Core over the REST
// API; this one audits the layer ha-doctor explicitly could not reach — the
// Supervisor: the host log subsystem (systemd-journal-gatewayd) and add-on
// option schemas.
//
// Built 2026-08-30 from a supervisor log tail showing two distinct defects:
//   1. supervisor.exceptions.HostLogError: Could not get a list of boot IDs from
//      systemd-journal-gatewayd  — repeated, with a 20s aiohttp ClientTimeout
//      underneath it. Breaks the boot selector on Settings -> System -> Logs.
//   2. supervisor.apps.options: Option 'use_new_device_builder' / 'status_use_ping'
//      does not exist in the schema for ESPHome Device Builder (beta). Stale keys
//      left in the add-on's stored options after the add-on dropped them.
//
// Defect 2 is repaired here, over the API, permanently.
// Defect 1 is diagnosed here (which of the two possible causes it is), and the
// repair is host-shell work this script prints exactly — see README.
//
// Zero dependencies. Node >= 18 (global fetch). Read-only unless --fix.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

// ─── Config ──────────────────────────────────────────────────────────────────

const HA_URL = (process.env.HA_URL || 'http://192.168.0.200:8123').replace(/\/$/, '');
const HA_TOKEN = process.env.HA_TOKEN;                 // long-lived token, ADMIN user
const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN; // present inside an add-on container

// A tail read is cheap: journald walks backwards from the end of the journal.
// A boot-ID listing is not: when the native /boots endpoint is unavailable the
// Supervisor falls back to scanning the journal, and that is what times out.
// Timing the two separately is what tells the two root causes apart.
const TAIL_TIMEOUT_MS = 25_000;
const BOOTS_TIMEOUT_MS = 45_000;
const TAIL_SLOW_MS = 5_000;      // a healthy gatewayd answers a 25-line tail well inside this
const SUPERVISOR_BUDGET_MS = 20_000; // supervisor's own ClientTimeout(total=20) on gatewayd

export const B = { ok: '✅', warn: '⚠️', bad: '❌', info: 'ℹ️' };

// ─── Pure logic (unit-tested offline by test/supervisor-fix-test.mjs) ────────

/**
 * Option keys stored for an add-on that its current schema no longer declares.
 * These are exactly what supervisor.apps.options warns about on every load.
 *
 * A schema of `false` (or anything that is not a plain object) means the add-on
 * opts out of validation and accepts arbitrary options — nothing is stale then.
 */
export function staleOptionKeys(options, schema) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return [];
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return [];
  const declared = new Set(Object.keys(schema));
  return Object.keys(options).filter((k) => !declared.has(k));
}

/** Copy of `options` with the stale keys dropped. Values are never altered. */
export function cleanOptions(options, schema) {
  const removed = staleOptionKeys(options, schema);
  const cleaned = {};
  for (const [k, v] of Object.entries(options || {})) {
    if (!removed.includes(k)) cleaned[k] = v;
  }
  return { cleaned, removed };
}

/**
 * Decide *why* the boot-ID listing fails, from the two timed probes.
 *
 * tail  = { ok, ms }  cheap read, proves gatewayd is alive and answering
 * boots = { ok, ms }  the exact call in the traceback (GET /host/logs/boots)
 */
export function classifyLogSubsystem(tail, boots) {
  if (boots.ok && tail.ok) {
    const slow = boots.ms > SUPERVISOR_BUDGET_MS;
    return {
      code: slow ? 'boots-marginal' : 'healthy',
      icon: slow ? B.warn : B.ok,
      verdict: slow
        ? `Boot-ID listing succeeded but took ${(boots.ms / 1000).toFixed(1)}s — over Supervisor's own 20s budget. It is failing intermittently and will fail again as the journal grows.`
        : 'Host log subsystem healthy — gatewayd answers both a tail and a boot-ID listing.',
      remedy: slow ? 'journal' : null,
    };
  }
  if (!tail.ok) {
    return {
      code: 'gatewayd-down',
      icon: B.bad,
      verdict: 'systemd-journal-gatewayd is not answering even a cheap 25-line tail — the service itself is down or wedged, not merely slow.',
      remedy: 'gatewayd',
    };
  }
  return {
    code: 'journal-too-large',
    icon: B.bad,
    verdict: `gatewayd is alive (tail answered in ${(tail.ms / 1000).toFixed(1)}s) but the boot-ID listing does not complete. Supervisor is falling back from the native /boots endpoint to a legacy scan of the whole journal, and that scan cannot finish inside its 20s timeout.`,
    remedy: 'journal',
  };
}

/** Exact host-shell repair for each remedy class. Printed, never executed. */
export function remedySteps(remedy) {
  if (remedy === 'journal') {
    return [
      'Shrink the journal so the legacy boot-ID scan completes, then cap it so it cannot regrow:',
      '',
      '```bash',
      '# HA OS host shell — SSH on port 22222 (key in CONFIG/authorized_keys on the',
      '# boot partition), or the physical console. NOT the SSH add-on: that is a',
      '# container and cannot see the host journal.',
      'journalctl --disk-usage                 # measure first',
      'journalctl --rotate                     # vacuum only touches ARCHIVED files',
      'journalctl --vacuum-size=100M           # ...so rotate before vacuuming',
      'journalctl --disk-usage                 # confirm it actually shrank',
      '',
      '# Persistent cap so this does not come back:',
      'mkdir -p /etc/systemd/journald.conf.d',
      "cat > /etc/systemd/journald.conf.d/10-jarvis-cap.conf <<'EOF'",
      '[Journal]',
      'SystemMaxUse=100M',
      'SystemMaxFiles=8',
      'RuntimeMaxUse=32M',
      'EOF',
      'systemctl restart systemd-journald',
      '```',
      '',
      'Then re-run this script: the boots probe should drop well under 20s.',
      'Re-check the drop-in after an HA OS update — /etc is an overlay and OS',
      'updates have been known to reset it.',
    ];
  }
  if (remedy === 'gatewayd') {
    return [
      'Restart the journal gateway, then confirm the socket is being served:',
      '',
      '```bash',
      '# HA OS host shell — SSH on port 22222, or the physical console.',
      'systemctl status systemd-journal-gatewayd.socket',
      'systemctl restart systemd-journal-gatewayd.socket',
      'systemctl restart systemd-journal-gatewayd.service',
      'ls -l /run/systemd-journal-gatewayd.sock',
      '```',
      '',
      'If the socket unit will not start, the journal itself is likely corrupt:',
      '`journalctl --verify`, then `journalctl --rotate` and reboot the host.',
    ];
  }
  return [];
}

// ─── Transport ───────────────────────────────────────────────────────────────

/**
 * Two ways in, probed in order:
 *   1. SUPERVISOR_TOKEN against http://supervisor — only works from inside an
 *      add-on container that declares hassio_api.
 *   2. An ADMIN long-lived token against Home Assistant Core's Supervisor proxy
 *      at {HA_URL}/api/hassio — works from anywhere on the LAN.
 * Which one actually authenticated is reported rather than assumed.
 */
export function authCandidates(env = process.env) {
  const out = [];
  if (env.SUPERVISOR_TOKEN) {
    out.push({ name: 'SUPERVISOR_TOKEN (in-cluster)', base: 'http://supervisor', token: env.SUPERVISOR_TOKEN });
  }
  if (env.HA_TOKEN) {
    const url = (env.HA_URL || 'http://192.168.0.200:8123').replace(/\/$/, '');
    out.push({ name: `HA_TOKEN via Core proxy (${url}/api/hassio)`, base: `${url}/api/hassio`, token: env.HA_TOKEN });
  }
  return out;
}

let ACTIVE = null;

async function raw(base, token, path, opts = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    // opts spreads FIRST: spreading it last would let an opts.headers (e.g. the
    // text/plain tail probe) replace the merged object and drop Authorization.
    const res = await fetch(`${base}${path}`, {
      ...opts,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    const text = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) return { ok: false, status: res.status, text, ms };
    try { return { ok: true, status: res.status, data: JSON.parse(text), text, ms }; }
    catch { return { ok: true, status: res.status, data: null, text, ms }; }
  } catch (e) {
    return { ok: false, status: 0, text: String(e?.message || e), ms: Date.now() - started, aborted: e?.name === 'AbortError' };
  } finally { clearTimeout(t); }
}

/** Supervisor wraps everything as {result:'ok', data:{...}} — unwrap it. */
async function sup(path, opts, timeoutMs) {
  const r = await raw(ACTIVE.base, ACTIVE.token, path, opts, timeoutMs);
  if (r.ok && r.data && typeof r.data === 'object' && 'data' in r.data) r.payload = r.data.data;
  return r;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const APPLY = args.includes('--fix');
  const AS_JSON = args.includes('--json');
  const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
  const ONLY_SLUG = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;

  const summary = [];
  const actions = [];
  const report = {
    meta: {
      generated: new Date().toISOString(),
      tool: 'Assistant Core/ha-diagnostics/ha-supervisor-fix.mjs',
      mode: APPLY ? 'FIX (writes add-on options)' : 'dry-run (read-only)',
    },
    sections: {},
  };

  // ── 0. Authenticate ────────────────────────────────────────────────────────
  const candidates = authCandidates();
  if (!candidates.length) {
    console.error(
      'FATAL: no credentials.\n' +
      '  On the hub (SSH & Web Terminal add-on): SUPERVISOR_TOKEN is already in the environment.\n' +
      '  From the LAN: export HA_TOKEN=<ADMIN long-lived token>   (HA -> profile -> Security)\n' +
      '  Optionally HA_URL=http://192.168.0.200:8123'
    );
    process.exit(2);
  }
  const tried = [];
  for (const c of candidates) {
    const probe = await raw(c.base, c.token, '/supervisor/info', {}, 10000);
    tried.push({ path: c.name, status: probe.status, ok: probe.ok });
    if (probe.ok) { ACTIVE = c; break; }
  }
  if (!ACTIVE) {
    console.error('FATAL: could not reach the Supervisor API on any path.');
    for (const t of tried) console.error(`  - ${t.path}: HTTP ${t.status || 'no response'}`);
    console.error(
      '\nIf the Core-proxy path returned 401/403, the token belongs to a non-admin user:\n' +
      'the /api/hassio proxy is admin-only. Either use an admin token, or run this\n' +
      'script from the SSH & Web Terminal add-on where SUPERVISOR_TOKEN is provided.'
    );
    process.exit(3);
  }
  report.sections.auth = { active: ACTIVE.name, tried };
  summary.push([B.info, `Supervisor reached via ${ACTIVE.name}`]);

  // ── 1. Host / OS context ───────────────────────────────────────────────────
  const hostInfo = await sup('/host/info', {}, 15000);
  const host = hostInfo.payload || {};
  report.sections.host = hostInfo.ok
    ? {
        operating_system: host.operating_system, kernel: host.kernel,
        disk_total_gb: host.disk_total, disk_used_gb: host.disk_used, disk_free_gb: host.disk_free,
      }
    : { error: `${hostInfo.status}: ${String(hostInfo.text).slice(0, 200)}` };
  if (hostInfo.ok) {
    summary.push([B.info, `Host: ${host.operating_system || 'unknown'} · disk ${host.disk_used ?? '?'}/${host.disk_total ?? '?'} GB used, ${host.disk_free ?? '?'} GB free`]);
    if (typeof host.disk_free === 'number' && host.disk_free < 2) {
      actions.push(`Host disk is down to ${host.disk_free} GB free — an oversized journal is one of the usual causes. Fix the journal (below) and re-measure.`);
    }
  }

  // ── 2. The failing subsystem: host logs / systemd-journal-gatewayd ─────────
  // Probe cheap first, then the exact call from the traceback.
  const tailRes = await sup('/host/logs?lines=25', { headers: { Accept: 'text/plain' } }, TAIL_TIMEOUT_MS);
  const tail = { ok: tailRes.ok, ms: tailRes.ms, status: tailRes.status, error: tailRes.ok ? null : String(tailRes.text).slice(0, 300) };

  const bootsRes = await sup('/host/logs/boots', {}, BOOTS_TIMEOUT_MS);
  const boots = { ok: bootsRes.ok, ms: bootsRes.ms, status: bootsRes.status, error: bootsRes.ok ? null : String(bootsRes.text).slice(0, 300) };
  if (bootsRes.ok && bootsRes.payload && bootsRes.payload.boots) {
    boots.count = Object.keys(bootsRes.payload.boots).length;
  }

  const verdict = classifyLogSubsystem(tail, boots);
  report.sections.host_logs = {
    tail_probe: tail, boots_probe: boots,
    verdict: verdict.verdict, code: verdict.code,
    supervisor_budget_ms: SUPERVISOR_BUDGET_MS,
    slow_tail_threshold_ms: TAIL_SLOW_MS,
  };
  summary.push([verdict.icon, `Host logs: ${verdict.code} — tail ${tail.ok ? `${(tail.ms / 1000).toFixed(1)}s` : 'FAILED'}, boots ${boots.ok ? `${(boots.ms / 1000).toFixed(1)}s${boots.count != null ? ` (${boots.count} boots)` : ''}` : 'FAILED'}`]);
  if (verdict.remedy) {
    actions.push(`Host log subsystem — ${verdict.verdict} Repair steps in the "Host log repair" section below (needs the HA OS host shell; this script cannot do it over the API).`);
  }
  report.sections.host_logs.remedy_steps = remedySteps(verdict.remedy);

  // ── 3. Add-on options that no longer exist in their schema ─────────────────
  const listed = await sup('/addons', {}, 20000);
  const addons = (listed.payload && listed.payload.addons) || [];
  const findings = [];
  for (const a of addons) {
    if (ONLY_SLUG && a.slug !== ONLY_SLUG) continue;
    const info = await sup(`/addons/${a.slug}/info`, {}, 20000);
    if (!info.ok) { findings.push({ slug: a.slug, name: a.name, error: `${info.status}: ${String(info.text).slice(0, 160)}` }); continue; }
    const d = info.payload || {};
    const { cleaned, removed } = cleanOptions(d.options, d.schema);
    if (!removed.length) continue;
    const f = {
      slug: a.slug,
      name: d.name || a.name,
      stale_keys: removed,
      // Kept verbatim so the change is reversible by hand if it ever matters.
      options_before: d.options,
      options_after: cleaned,
      applied: false,
    };
    if (APPLY) {
      const post = await sup(`/addons/${a.slug}/options`, { method: 'POST', body: JSON.stringify({ options: cleaned }) }, 25000);
      f.applied = post.ok;
      if (!post.ok) f.apply_error = `${post.status}: ${String(post.text).slice(0, 200)}`;
    }
    findings.push(f);
  }
  report.sections.addon_stale_options = { scanned: addons.length, findings };

  const withStale = findings.filter((f) => f.stale_keys && f.stale_keys.length);
  if (!addons.length) {
    summary.push([B.warn, 'Add-on list came back empty — could not audit add-on options']);
  } else if (!withStale.length) {
    summary.push([B.ok, `Add-on options: ${addons.length} add-on(s) scanned, no stale keys`]);
  } else {
    const applied = withStale.filter((f) => f.applied).length;
    summary.push([
      APPLY && applied === withStale.length ? B.ok : B.warn,
      `Add-on options: ${withStale.length} add-on(s) carry keys their schema no longer declares` +
        (APPLY ? ` — ${applied}/${withStale.length} repaired` : ' (dry-run: re-run with --fix to strip them)'),
    ]);
    for (const f of withStale) {
      actions.push(
        `${f.name} (${f.slug}): stale option key(s) ${f.stale_keys.map((k) => `'${k}'`).join(', ')} — ` +
        (f.applied
          ? 'REMOVED. Restart the add-on when convenient; the warnings stop at the next options load.'
          : f.apply_error
            ? `remove FAILED (${f.apply_error})`
            : 'run with --fix to remove them.')
      );
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (AS_JSON) { console.log(JSON.stringify(report, null, 2)); return; }

  const md = [];
  md.push(`# HA Supervisor Fix — ${new Date().toISOString().slice(0, 10)}`);
  md.push('');
  md.push(`> Supervisor-layer diagnostic & repair · generated ${report.meta.generated}`);
  md.push(`> Mode: **${report.meta.mode}** · reached via ${ACTIVE.name}`);
  md.push('> Tool: `Assistant Core/ha-diagnostics/ha-supervisor-fix.mjs` · re-run any time');
  md.push('');
  md.push('## Summary');
  md.push('');
  for (const [icon, line] of summary) md.push(`- ${icon} ${line}`);
  md.push('');
  md.push('## Action items (ranked)');
  md.push('');
  if (!actions.length) md.push('None — clean bill of health.');
  for (const a of actions) md.push(`- [ ] ${a}`);
  if (verdict.remedy) {
    md.push('');
    md.push('## Host log repair');
    md.push('');
    for (const line of remedySteps(verdict.remedy)) md.push(line);
  }
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

// Importable for tests; only runs when invoked directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
}
