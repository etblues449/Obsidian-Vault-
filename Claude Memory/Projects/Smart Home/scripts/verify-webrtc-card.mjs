// Replicates AlexxIT/WebRTC v3.6.1 card behaviour against the card YAML.
// Sources: www/webrtc-camera.js  setConfig() L10-69, renderTemplate() L654-673.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const path = process.argv[2];
const config = JSON.parse(
  execFileSync('python3', ['-c',
    'import sys,yaml,json; print(json.dumps(yaml.safe_load(open(sys.argv[1]))))', path],
    { encoding: 'utf8' })
);

let fail = 0;
const ok  = (m) => console.log(`  PASS  ${m}`);
const bad = (m) => { console.log(`  FAIL  ${m}`); fail++; };

console.log('\n1. setConfig() guard  (L11)');
(!config.url && !config.entity && !config.streams)
  ? bad('throws "Missing `url` or `entity` or `streams`"')
  : ok(`accepted via url: ${config.url}`);

console.log('\n2. poster_remote auto-derivation  (L68)');
const posterRemote = config.poster &&
  (config.poster.indexOf('://') > 0 || config.poster.charAt(0) === '/');
if (posterRemote) {
  bad(`poster_remote=true -> <video poster="${config.poster}"> -> unauthenticated GET -> HA CameraView 403`);
} else {
  ok(`poster_remote=false -> routed through signed /api/webrtc/ws&poster=`);
  config.poster.startsWith('camera.')
    ? ok('ws_poster() takes the startswith("camera.") branch -> async_get_image')
    : bad(`ws_poster() would treat "${config.poster}" as a go2rtc stream name`);
}

console.log('\n3. intersection default  (L15-16)');
const vis = config.intersection === 0 ? 0 : (config.intersection || 0.75);
ok(`visibilityThreshold = ${vis}`);

console.log('\n4. server -> websocket URL  (__init__.py ws_connect)');
const s = config.server;
if (!s) { ok('no server: falls back to hass.data["webrtc"] (needs a config entry)'); }
else {
  const ws = new URL('api/ws', 'ws' + s.slice(4)).href;
  ws === 'ws://192.168.0.200:1984/api/ws'
    ? ok(`urljoin -> ${ws}`)
    : bad(`urljoin -> ${ws}`);
}

console.log('\n5. shortcuts template pipeline  (renderTemplate L654-673)');
// Exactly what the card does, incl. the silent try/catch.
const template = JSON.stringify(config.shortcuts);
const scenarios = {
  'LED on':                { 'light.living_room_ai_cam_status_led': { state: 'on'  } },
  'LED off':               { 'light.living_room_ai_cam_status_led': { state: 'off' } },
  'entity MISSING':        {},
  'entity unavailable':    { 'light.living_room_ai_cam_status_led': { state: 'unavailable' } },
};

for (const [label, states] of Object.entries(scenarios)) {
  let out;
  try {
    out = JSON.parse(eval('`' + template + '`'));   // eslint-disable-line no-eval
  } catch (e) {
    bad(`${label}: threw ${e.constructor.name} -> catch -> console.debug -> ALL shortcuts vanish`);
    continue;
  }
  const icons = out.map(x => x.icon);
  icons.length === config.shortcuts.length
    ? ok(`${label}: ${icons.length} shortcuts render -> [${icons.join(', ')}]`)
    : bad(`${label}: only ${icons.length} rendered`);
}

console.log('\n6. shortcut action dispatch  (L614-630)');
for (const sc of config.shortcuts) {
  if (sc.more_info !== undefined) ok(`"${sc.name}" -> hass-more-info(${sc.more_info})`);
  else if (sc.service !== undefined) {
    const [domain, name] = sc.service.split('.');
    (domain && name) ? ok(`"${sc.name}" -> callService(${domain}, ${name})`)
                     : bad(`"${sc.name}" -> unsplittable service "${sc.service}"`);
  } else bad(`"${sc.name}" has neither service nor more_info -> click does nothing`);
}

console.log(fail ? `\nRESULT: ${fail} FAILED\n` : '\nRESULT: all checks passed\n');
process.exit(fail ? 1 : 0);
