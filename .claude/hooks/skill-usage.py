#!/usr/bin/env python3
"""
skill-usage.py — PreToolUse hook that records which JARVIS skills actually fire.

Why this exists
---------------
The harness shipped with a term-overlap PROXY for trigger validation, which scored
8/10 and could not distinguish a real mis-trigger from an artefact of the
disambiguation text. A proxy cannot answer the question that matters: over a month
of real use, which skills fire, which never fire, and which fire when they
shouldn't.

This logs the truth instead. A skill that never appears in the log after weeks of
relevant work has a description problem; a skill that fires on unrelated work has
a scoping problem. Both are invisible without measurement.

Behaviour
---------
Reads the hook payload on stdin, appends one JSON line per Skill/Agent invocation
to .claude/logs/skill-usage.jsonl, and always exits 0. A logging hook must never
be able to block work — every failure path here is swallowed deliberately.

Report:  python3 .claude/hooks/skill-usage.py --report
"""
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone

ROOT = os.environ.get("CLAUDE_PROJECT_DIR", ".")
LOG = os.path.join(ROOT, ".claude", "logs", "skill-usage.jsonl")

JARVIS_SKILLS = {
    "vault-conventions", "vault-integrity-audit", "capture-pipeline",
    "skill-engine-ops", "voice-satellite-ops", "qa-boundary-check",
    "jarvis-orchestrator",
}
JARVIS_AGENTS = {
    "jarvis-vault-keeper", "jarvis-capture-engineer", "jarvis-skill-engine",
    "jarvis-voice-ha", "jarvis-integration-qa",
}


def report():
    if not os.path.exists(LOG):
        print("No usage recorded yet. The hook writes on the first Skill/Agent call.")
        return 0
    rows = []
    for line in open(LOG, encoding="utf-8", errors="replace"):
        try:
            rows.append(json.loads(line))
        except Exception:
            continue
    if not rows:
        print("Log present but empty.")
        return 0

    skills = Counter(r["name"] for r in rows if r.get("kind") == "skill")
    agents = Counter(r["name"] for r in rows if r.get("kind") == "agent")
    first, last = rows[0].get("ts", "?"), rows[-1].get("ts", "?")

    print(f"Skill / agent usage — {len(rows)} invocations")
    print(f"  {first}  ->  {last}\n")

    print("  SKILLS")
    for n in sorted(JARVIS_SKILLS):
        c = skills.get(n, 0)
        flag = "  <-- never fired" if c == 0 else ""
        print(f"    {c:>5}  {n}{flag}")
    other = {k: v for k, v in skills.items() if k not in JARVIS_SKILLS}
    for n, c in sorted(other.items(), key=lambda x: -x[1]):
        print(f"    {c:>5}  {n}  (non-JARVIS)")

    print("\n  AGENTS")
    for n in sorted(JARVIS_AGENTS):
        c = agents.get(n, 0)
        flag = "  <-- never fired" if c == 0 else ""
        print(f"    {c:>5}  {n}{flag}")

    never = [n for n in JARVIS_SKILLS if skills.get(n, 0) == 0]
    if never:
        print(f"\n  {len(never)} skill(s) never fired. After a few weeks of relevant")
        print("  work that is a description/trigger problem, not a usage problem —")
        print("  rewrite the description and when_to_use, then re-measure.")
    return 0


def main():
    if "--report" in sys.argv:
        return report()

    # Never let a logging hook interfere with real work.
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            return 0
        payload = json.loads(raw)

        tool = payload.get("tool_name") or payload.get("toolName") or ""
        inp = payload.get("tool_input") or payload.get("toolInput") or {}
        if not isinstance(inp, dict):
            return 0

        if tool == "Skill":
            kind, name = "skill", inp.get("skill") or inp.get("name") or "?"
        elif tool in ("Agent", "Task"):
            kind, name = "agent", inp.get("subagent_type") or inp.get("subagentType") or "?"
        else:
            return 0

        os.makedirs(os.path.dirname(LOG), exist_ok=True)
        with open(LOG, "a", encoding="utf-8") as fh:
            fh.write(json.dumps({
                "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "kind": kind,
                "name": name,
                "session": payload.get("session_id", ""),
            }) + "\n")
    except Exception:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
