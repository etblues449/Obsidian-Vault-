#!/usr/bin/env node
// ha-entities.mjs — dump entity_id / state / friendly name from the live hub.
//
// The smallest possible tool for the question that keeps coming up: "what is
// this thing ACTUALLY called in the registry?" The vault has been wrong about
// this twice (the first AI Cam registered as `living_room_ai_cam_*`, not the
// name in its YAML), so guessing an entity_id from a config file or a
// screenshot of friendly names is not good enough — this reads the registry.
//
// Zero dependencies. Node >= 18. Read-only: one GET, no writes, ever.
//
// Usage, from a device on the same LAN as the hub (Fold 7 / PC):
//   export HA_TOKEN='<long-lived access token>'      # shell only, never a file
//   node "Assistant Core/ha-diagnostics/ha-entities.mjs" cam bedroom light
//   node "Assistant Core/ha-diagnostics/ha-entities.mjs"            # everything
//   node "Assistant Core/ha-diagnostics/ha-entities.mjs" --json cam
//
// Arguments are case-insensitive substrings, OR'd together, matched against
// the entity_id and the friendly name. HA_URL overrides the default hub URL.
//
// The token is read from the environment and is never printed or written.

const HA_URL = (process.env.HA_URL || 'http://192.168.0.200:8123').replace(/\/$/, '');
const HA_TOKEN = process.env.HA_TOKEN;

if (!HA_TOKEN) {
  console.error("FATAL: set HA_TOKEN first —  export HA_TOKEN='<token>'");
  console.error('(HA -> your profile -> Security -> Long-lived access tokens)');
  process.exit(2);
}

const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const needles = args.filter((a) => !a.startsWith('--')).map((s) => s.toLowerCase());

const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), 20000);

try {
  const res = await fetch(`${HA_URL}/api/states`, {
    headers: { Authorization: `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' },
    signal: ctrl.signal,
  });
  if (!res.ok) {
    console.error(`FATAL: ${HA_URL} returned HTTP ${res.status}.`);
    if (res.status === 401) console.error('401 = the token is wrong, revoked, or expired.');
    process.exit(3);
  }
  const states = await res.json();

  const rows = states
    .map((s) => ({
      entity_id: s.entity_id,
      state: s.state,
      name: (s.attributes && s.attributes.friendly_name) || '',
    }))
    .filter((r) => {
      if (!needles.length) return true;
      const hay = `${r.entity_id} ${r.name}`.toLowerCase();
      return needles.some((n) => hay.includes(n));
    })
    .sort((a, b) => a.entity_id.localeCompare(b.entity_id));

  if (AS_JSON) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    const w = Math.min(60, Math.max(20, ...rows.map((r) => r.entity_id.length)));
    for (const r of rows) {
      // A dead entity is the point of the exercise as often as a live one —
      // flag unavailable/unknown rather than letting it read as a normal value.
      const flag = r.state === 'unavailable' || r.state === 'unknown' ? '  <-- DEAD' : '';
      console.log(`${r.entity_id.padEnd(w)}  ${r.state.padEnd(14)} ${r.name}${flag}`);
    }
    const dead = rows.filter((r) => r.state === 'unavailable' || r.state === 'unknown').length;
    console.log(`\n${rows.length} entities${needles.length ? ` matching ${needles.join(', ')}` : ''}` +
                `${dead ? ` — ${dead} unavailable/unknown` : ''}`);
  }
} catch (e) {
  console.error(`FATAL: could not reach ${HA_URL} — ${e?.message || e}`);
  console.error('Run this from a device on the same LAN as the hub.');
  process.exit(4);
} finally {
  clearTimeout(timer);
}
