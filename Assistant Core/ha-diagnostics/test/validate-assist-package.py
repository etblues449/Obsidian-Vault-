#!/usr/bin/env python3
"""validate-assist-package.py — offline structural validation of the Task 3 HA package.

Runs with no Home Assistant, no network and no hub token, so it can gate a commit.
It parses ha-config/packages/jarvis_assist_person.yaml and asserts the invariants that
would otherwise only fail at 3am on a live automation:

  * the YAML parses at all, and every automation/script/entity block has the shape HA
    expects (ids, triggers, actions);
  * every entity_id referenced by an automation is either declared in this package or
    listed in the verified-external manifest below — the qa-boundary-check discipline,
    applied to automations instead of documents;
  * the four gotchas recorded in the 2026-08-04 handoff cannot regress:
      1. answer ids are never bare yes/no/on/off (YAML would parse them as booleans and
         the branch comparison would never match),
      2. every automation that speaks has a cooldown, so an MQTT count update storm
         cannot machine-gun the satellite,
      3. the challenge automation reads reply.id defensively (a no-match response has no
         `id` key at all),
      4. the announce and challenge automations are mutually exclusive — one satellite,
         one speaker.

Usage:
    python3 "Assistant Core/ha-diagnostics/test/validate-assist-package.py" .

Exit 0 = all green. Exit 1 = at least one failure. Exit 2 = could not run.
"""

import sys
import re
from pathlib import Path

try:
    import yaml
except ImportError:
    print("FATAL: PyYAML not installed (pip install pyyaml)", file=sys.stderr)
    sys.exit(2)

PACKAGE = "ha-config/packages/jarvis_assist_person.yaml"

# Entities this package does NOT create, and therefore must not invent. Each was read from
# the live instance on 2026-08-04 (handoff) or corroborated by the 2026-08-02 ha-doctor
# report. `assist-preflight.mjs` re-checks all of them against the running hub.
VERIFIED_EXTERNAL = {
    "assist_satellite.living_room_ai_cam_assist_satellite",
    "media_player.living_room_ai_cam_ai_cam_speaker",
    "camera.living_room_ai_cam_ai_cam",
    "person.elliot_horton",
    "light.living_room_light",
    "notify.jelly_bean_s_phone",
    "notify.jb_s_phone",
    "notify.big_pad",
}

# Entity ids that must NOT appear — known-wrong forms that earlier vault documents used.
FORBIDDEN = {
    "person.elliot": "person.elliot_horton is the real entity (handoff 2026-08-04)",
    "camera.ai_cam": "live registry uses the living_room_ prefixed form (ha-doctor 2026-08-02)",
    "media_player.ai_cam_speaker": "live registry uses the living_room_ prefixed form",
    "media_player.tv_jelly_beans_tv_2": "deleted from the registry; canonical is jelly_beans_tv_3",
    "tts.piper": "the instance has one TTS entity, tts.home_assistant_cloud",
}

BOOLEANISH = {"yes", "no", "on", "off", "true", "false", "y", "n"}
# Trailing lookahead matters: without it `camera.ai_cam` matches inside
# `camera.ai_cam_person_snapshot`, and `person.elliot` inside `person.elliot_horton` —
# which would make the forbidden-id check fire on entities that are perfectly correct.
ENTITY_RE = re.compile(r"(?<![a-z0-9_.])([a-z_]+)\.([a-z0-9_]+)(?![a-z0-9_])")
SPEAKING_ACTIONS = {"assist_satellite.announce", "assist_satellite.ask_question"}

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))


def slug(name):
    return re.sub(r"[^a-z0-9]+", "_", str(name).lower()).strip("_")


def walk(node):
    """Yield every scalar string in a nested structure."""
    if isinstance(node, dict):
        for v in node.values():
            yield from walk(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk(v)
    elif isinstance(node, str):
        yield node


def actions_of(auto):
    return auto.get("actions", auto.get("action", []))


def collect_action_names(seq):
    """Every `action:`/`service:` name inside an arbitrarily nested action sequence.

    Also picks up service names held in a `variables:` entry whose key ends in `_service`
    (the script templates its notify target that way), so the boundary check below does not
    mistake a service for a missing entity — both are written `domain.name`.
    """
    found = []
    if isinstance(seq, dict):
        for k, v in seq.items():
            if k in ("action", "service") and isinstance(v, str):
                found.append(v)
            elif k == "variables" and isinstance(v, dict):
                found += [x for key, x in v.items()
                          if key.endswith("_service") and isinstance(x, str)]
            else:
                found += collect_action_names(v)
    elif isinstance(seq, list):
        for item in seq:
            found += collect_action_names(item)
    return found


def main(root):
    path = Path(root) / PACKAGE
    if not path.is_file():
        print(f"FATAL: {PACKAGE} not found under {root}", file=sys.stderr)
        return 2

    raw = path.read_text(encoding="utf-8")
    try:
        pkg = yaml.safe_load(raw)
    except yaml.YAMLError as e:
        print(f"FATAL: {PACKAGE} is not valid YAML:\n{e}", file=sys.stderr)
        return 1
    check("package parses as YAML", isinstance(pkg, dict))

    # ── declared entities ────────────────────────────────────────────────────
    declared = set()
    mqtt = pkg.get("mqtt", {})
    for domain, items in mqtt.items():
        for item in items or []:
            declared.add(f"{domain}.{slug(item.get('name', ''))}")
    for helper in (pkg.get("input_boolean") or {}):
        declared.add(f"input_boolean.{helper}")
    for scr in (pkg.get("script") or {}):
        declared.add(f"script.{scr}")

    automations = pkg.get("automation") or []
    for auto in automations:
        declared.add(f"automation.{slug(auto.get('alias', ''))}")

    check(
        "MQTT entities declared (person, motion, snapshot, detection switch)",
        {
            "binary_sensor.ai_cam_person",
            "binary_sensor.ai_cam_motion",
            "camera.ai_cam_person_snapshot",
            "switch.ai_cam_detection",
        } <= declared,
        sorted(d for d in declared if not d.startswith(("automation.", "input_boolean.", "script."))),
    )

    # ── every automation is well-formed and uniquely identified ──────────────
    ids = [a.get("id") for a in automations]
    check("5 automations present", len(automations) == 5, f"found {len(automations)}")
    check("every automation has an id", all(ids), f"ids={ids}")
    check("automation ids are unique", len(set(ids)) == len(ids))
    for auto in automations:
        aid = auto.get("id", "<no id>")
        check(f"[{aid}] has triggers", bool(auto.get("triggers") or auto.get("trigger")))
        check(f"[{aid}] has actions", bool(actions_of(auto)))
        check(f"[{aid}] declares a mode", "mode" in auto)

    # ── boundary check: no entity referenced that nothing provides ───────────
    # Service names look identical to entity ids (`light.turn_on` vs `light.living_room_light`),
    # so they are collected separately and subtracted before the comparison.
    services = set(collect_action_names({"a": automations, "s": pkg.get("script")}))
    referenced = set()
    for text in walk({"a": automations, "s": pkg.get("script"), "m": mqtt}):
        for domain, obj in ENTITY_RE.findall(text):
            eid = f"{domain}.{obj}"
            if domain in (
                "binary_sensor", "camera", "switch", "light", "person", "notify",
                "assist_satellite", "media_player", "input_boolean", "script",
                "automation", "tts", "sensor",
            ):
                referenced.add(eid)
    unknown = sorted(referenced - services - declared - VERIFIED_EXTERNAL)
    check("no automation references an unprovided entity", not unknown, f"unknown: {unknown}")

    hits = sorted(e for e in FORBIDDEN if e in referenced or e in services)
    check("no known-wrong entity ids", not hits,
          "; ".join(f"{h} -> {FORBIDDEN[h]}" for h in hits))

    # ── gotcha 1: answer ids must never be booleans ─────────────────────────
    bad_ids, answer_count = [], 0
    for auto in automations:
        for step in collect_answers(actions_of(auto)):
            answer_count += 1
            raw_id = step.get("id")
            if isinstance(raw_id, bool) or str(raw_id).lower() in BOOLEANISH:
                bad_ids.append(raw_id)
            if not step.get("sentences"):
                bad_ids.append(f"{raw_id} (no sentences)")
    check("ask_question defines answers", answer_count >= 3, f"{answer_count} answers")
    check("no answer id parses as a boolean", not bad_ids, str(bad_ids))

    # ── gotcha 2: anything that speaks must have a cooldown ─────────────────
    for auto in automations:
        names = collect_action_names(actions_of(auto))
        if not (SPEAKING_ACTIONS & set(names)):
            continue
        aid = auto.get("id")
        has_delay = any("delay" in s for s in actions_of(auto) if isinstance(s, dict))
        check(f"[{aid}] speaks and has a cooldown delay", has_delay)
        check(f"[{aid}] mode is single (so the cooldown actually gates)",
              auto.get("mode") == "single", f"mode={auto.get('mode')}")
        check(f"[{aid}] max_exceeded is silent (cooldown drops are expected, not warnings)",
              auto.get("max_exceeded") == "silent")

    # ── gotcha 3: reply.id read defensively ─────────────────────────────────
    challenge = next((a for a in automations if a.get("id") == "jarvis_ai_cam_challenge_person"), None)
    check("challenge automation exists", challenge is not None)
    if challenge:
        body = yaml.safe_dump(challenge)
        naked = re.findall(r"reply\.id\s*(?:==|in)\s*", body)
        guarded = re.findall(r"reply\.id\s*\|\s*default\(", body)
        check("every reply.id read is guarded by | default()",
              len(guarded) >= 4 and not naked,
              f"guarded={len(guarded)} unguarded={len(naked)}")
        check("challenge has a default (no-answer / no-match) branch",
              any("default" in s.get("choose", {}) if isinstance(s.get("choose"), dict) else
                  ("default" in s) for s in actions_of(challenge) if isinstance(s, dict)))

    # ── gotcha 4: announce and challenge are mutually exclusive ─────────────
    announce = next((a for a in automations if a.get("id") == "jarvis_ai_cam_person_announce_away"), None)
    if announce and challenge:
        def guard_state(auto):
            for c in auto.get("conditions", auto.get("condition", [])):
                if isinstance(c, dict) and c.get("entity_id") == "input_boolean.ai_cam_simple_alert_only":
                    return c.get("state")
            return None
        check("announce and challenge cannot both fire on one detection",
              {guard_state(announce), guard_state(challenge)} == {"on", "off"},
              f"announce guard={guard_state(announce)} challenge guard={guard_state(challenge)}")

    # ── the deliberate omission stays omitted ───────────────────────────────
    check("start_conversation is not called (blocked by the built-in conversation agent)",
          "assist_satellite.start_conversation" not in
          " ".join(n for a in automations for n in collect_action_names(actions_of(a))))

    # ── report ──────────────────────────────────────────────────────────────
    failed = [r for r in results if not r[1]]
    for name, ok, detail in results:
        mark = "PASS" if ok else "FAIL"
        line = f"  [{mark}] {name}"
        if detail and not ok:
            line += f"\n         {detail}"
        print(line)
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed.")
    return 1 if failed else 0


def collect_answers(seq):
    """Yield each entry of every ask_question `answers:` list, however deeply nested."""
    if isinstance(seq, dict):
        if seq.get("action") == "assist_satellite.ask_question" or seq.get("service") == "assist_satellite.ask_question":
            for ans in (seq.get("data") or {}).get("answers") or []:
                yield ans
        for v in seq.values():
            yield from collect_answers(v)
    elif isinstance(seq, list):
        for item in seq:
            yield from collect_answers(item)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "."))
