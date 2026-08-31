#!/bin/sh
# apply-bedroom-automations.sh — create the bedroom automations ON the hub.
#
# Pure POSIX sh + curl. No node: Termux's nodejs is currently broken
# (CANNOT LINK EXECUTABLE "node" — OpenSSL symbol mismatch), and curl is proven
# working on the Fold.
#
# WHY THIS SCRIPT REFUSES THINGS
# ------------------------------
# On 2026-08-31 a live registry audit found FOUR automations enabled on this hub
# that could never fire, because they referenced entities that do not exist —
# `binary_sensor.bedroom_bedroom_presence` and `light.bedroom_light` among them.
# They sat at state:on for months looking healthy.
#
# So this script PREFLIGHTS every entity against /api/states and ABORTS rather
# than writing an automation against something absent or unavailable. Refusing to
# write is the feature. Do not add a --force.
#
# USAGE
#   export HA_TOKEN='<admin long-lived token>'       # shell only, never a file
#   export BEDROOM_LIGHT='light.your_actual_bedroom_light'
#   export BEDROOM_PRESENCE='binary_sensor.your_presence_sensor'   # optional
#   sh "Assistant Core/ha-diagnostics/apply-bedroom-automations.sh"
#
# Without BEDROOM_PRESENCE it sets up the button automation only, and says so.
# HA_URL overrides the hub (default http://192.168.0.200:8123).
#
# WHAT IT WRITES
#   bedroom_ai_cam_2_button  — AI CAM 2's User Button toggles the bedroom light,
#                              with a chime (the button has no tactile feedback).
#   bedroom_enter            — presence on  -> light on  70% / 4000K   [needs presence]
#   bedroom_empty            — presence off 2m -> light off, UNLESS the Assist
#                              satellite is listening/processing/responding.
#                              mmWave reads a still, talking person as an empty
#                              room; voice activity is occupancy.
#
# Writes via POST /api/config/automation/config/<id>, which creates or replaces a
# UI-managed automation, then reloads and reads back to prove it took.

set -eu

HA_URL="${HA_URL:-http://192.168.0.200:8123}"
HA_URL="${HA_URL%/}"

BUTTON='binary_sensor.ai_cam_2_user_button'
CHIME='button.ai_cam_2_play_chime'
SATELLITE='assist_satellite.landing_ai_cam_2_assist_satellite'

say()  { printf '%s\n' "$*"; }
die()  { printf 'ABORT: %s\n' "$*" >&2; exit 1; }

[ -n "${HA_TOKEN:-}" ] || die "HA_TOKEN is not set.  export HA_TOKEN='<admin token>'"
[ -n "${BEDROOM_LIGHT:-}" ] || die "BEDROOM_LIGHT is not set — and this is the whole point.
  The hub has NO bedroom light entity. Find the real one first:
    curl -s -H \"Authorization: Bearer \$HA_TOKEN\" $HA_URL/api/states \\
      | tr '{' '\\n' | grep -oE '\"entity_id\": ?\"(light|switch)\\.[^\"]*\"'
  Then:  export BEDROOM_LIGHT='light.whatever_it_really_is'"

api_get()  { curl -fsS -H "Authorization: Bearer $HA_TOKEN" "$HA_URL$1"; }
api_post() {
  curl -fsS -X POST -H "Authorization: Bearer $HA_TOKEN" \
       -H 'Content-Type: application/json' -d "$2" "$HA_URL$1"
}

# state_of <entity_id> -> prints the state, or nothing if the entity is absent.
state_of() {
  api_get "/api/states/$1" 2>/dev/null | sed -n 's/.*"state": *"\([^"]*\)".*/\1/p' | head -1
}

require_live() {
  _e="$1"; _what="$2"
  _s="$(state_of "$_e" || true)"
  if [ -z "$_s" ]; then
    die "$_what '$_e' DOES NOT EXIST in the registry.
  This is exactly the defect found on 2026-08-31 — four automations pointing at
  absent entities, enabled, silently dead. Not writing another one."
  fi
  if [ "$_s" = "unavailable" ]; then
    die "$_what '$_e' exists but is UNAVAILABLE.
  An automation written against it would not fire. Bring it online first."
  fi
  say "  OK  $_e  =  $_s"
}

say "== Preflight against $HA_URL =="
api_get /api/ >/dev/null 2>&1 || die "cannot reach $HA_URL — wrong network, or bad token."
require_live "$BEDROOM_LIGHT" "Bedroom light"
require_live "$BUTTON"        "AI CAM 2 user button"
require_live "$SATELLITE"     "Assist satellite"
# A button entity's state is a timestamp or 'unknown'; existence is what matters.
[ -n "$(state_of "$CHIME" || true)" ] || die "Chime button '$CHIME' does not exist."
say "  OK  $CHIME (button)"

DO_PRESENCE=0
if [ -n "${BEDROOM_PRESENCE:-}" ]; then
  require_live "$BEDROOM_PRESENCE" "Bedroom presence sensor"
  DO_PRESENCE=1
else
  say "  --  BEDROOM_PRESENCE not set: skipping bedroom_enter / bedroom_empty."
fi

say ""
say "== Writing automations =="

api_post /api/config/automation/config/bedroom_ai_cam_2_button "$(cat <<JSON
{"alias":"Bedroom - AI Cam 2 button toggles light",
 "description":"AI CAM 2 User Button toggles the bedroom light, with an audible chime because the button gives no tactile feedback in the dark.",
 "triggers":[{"trigger":"state","entity_id":"$BUTTON","to":"on"}],
 "actions":[{"action":"light.toggle","target":{"entity_id":"$BEDROOM_LIGHT"}},
            {"action":"button.press","target":{"entity_id":"$CHIME"}}],
 "mode":"single"}
JSON
)" >/dev/null
say "  wrote  bedroom_ai_cam_2_button"

if [ "$DO_PRESENCE" = "1" ]; then
  api_post /api/config/automation/config/bedroom_enter "$(cat <<JSON
{"alias":"Bedroom - Enter",
 "triggers":[{"trigger":"state","entity_id":"$BEDROOM_PRESENCE","to":"on"}],
 "actions":[{"action":"light.turn_on","target":{"entity_id":"$BEDROOM_LIGHT"},
             "data":{"brightness_pct":70,"color_temp_kelvin":4000}}],
 "mode":"single"}
JSON
)" >/dev/null
  say "  wrote  bedroom_enter"

  api_post /api/config/automation/config/bedroom_empty "$(cat <<JSON
{"alias":"Bedroom - Empty",
 "description":"Voice activity is occupancy: mmWave reads a still, talking person as an empty room, so do not kill the lights mid-sentence.",
 "triggers":[{"trigger":"state","entity_id":"$BEDROOM_PRESENCE","to":"off","for":{"minutes":2}}],
 "conditions":[{"condition":"not","conditions":[
     {"condition":"state","entity_id":"$SATELLITE",
      "state":["listening","processing","responding"]}]}],
 "actions":[{"action":"light.turn_off","target":{"entity_id":"$BEDROOM_LIGHT"}}],
 "mode":"single"}
JSON
)" >/dev/null
  say "  wrote  bedroom_empty"
fi

api_post /api/services/automation/reload '{}' >/dev/null
say "  reloaded"

say ""
say "== Verify (read back from the hub) =="
for id in bedroom_ai_cam_2_button bedroom_enter bedroom_empty; do
  [ "$DO_PRESENCE" = "1" ] || case "$id" in bedroom_enter|bedroom_empty) continue ;; esac
  s="$(state_of "automation.$id" || true)"
  if [ -n "$s" ]; then say "  automation.$id  =  $s"
  else say "  automation.$id  NOT FOUND — the write did not take"; fi
done

say ""
say "Done. The button automation is testable right now: press the button on AI CAM 2."
