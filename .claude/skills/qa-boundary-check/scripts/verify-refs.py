#!/usr/bin/env python3
"""
verify-refs.py — JARVIS boundary checker (repo side)

Extracts what the codebase and the vault CLAIM about the filesystem, then
resolves every claim against what is actually on disk. Reports both sides.

Usage:
    python3 verify-refs.py [vault-root]        # default: cwd
    python3 verify-refs.py /path/to/vault --json

Exit: 0 = no S1 findings, 1 = at least one S1.

It deliberately does NOT repair anything. Reporting and repairing are separate
jobs; a checker that fixes what it finds destroys the signal about which
process let the defect through.
"""
import json
import os
import re
import subprocess
import sys

root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else ".")
as_json = "--json" in sys.argv
findings = []


def add(sev, claim, source, reality, verdict):
    findings.append(dict(sev=sev, claim=claim, source=source, reality=reality, verdict=verdict))



def glob_md(d, recurse=False):
    """Collect .md files for frontmatter validation."""
    out = []
    if not os.path.isdir(d):
        return out
    if recurse:
        for dp, dn, fn in os.walk(d):
            out += [os.path.join(dp, f) for f in fn if f.endswith(".md")]
    else:
        out += [os.path.join(d, f) for f in os.listdir(d) if f.endswith(".md")]
    return out


def rel(p):
    return os.path.relpath(p, root)


def sha():
    try:
        return subprocess.run(["git", "-C", root, "rev-parse", "--short", "HEAD"],
                              capture_output=True, text=True, timeout=10).stdout.strip() or "unknown"
    except Exception:
        return "unknown"


# ---------------------------------------------------------------- 1. source-claimed paths
# Any quoted string in JS/MJS/PY that looks like a vault path is a claim that
# the path exists. Case matters — the runner will not find 'memory.md'.
SRC_EXT = (".mjs", ".js", ".cjs", ".py", ".sh")
PATH_RE = re.compile(r"""['"]((?:Claude Memory|JARVIS|Assistant Core)/[^'"]+\.(?:md|json|mjs|js|yaml|yml))['"]""")

# Two classes of string look like a path but cannot be resolved statically, and
# reporting them trains people to ignore the checker:
#
#  1. Paths containing a shell/template variable ($p, ${x}) — the literal never
#     exists; only the expansion does.
#  2. Paths inside a test file — the suites here build a throwaway FIXTURE vault
#     and assert on paths relative to it, not to the real vault.
VAR_RE = re.compile(r"[${}]")


def is_test_source(p):
    return "/test/" in p.replace(os.sep, "/") or os.path.basename(p).startswith("test-")


for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules", ".obsidian")]
    for fn in filenames:
        if not fn.endswith(SRC_EXT):
            continue
        fp = os.path.join(dirpath, fn)
        if is_test_source(fp):
            continue
        try:
            text = open(fp, encoding="utf-8", errors="replace").read()
        except Exception:
            continue
        for m in sorted(set(PATH_RE.findall(text))):
            if VAR_RE.search(m):
                continue
            target = os.path.join(root, m)
            if os.path.exists(target):
                add("OK", f"source reads {m}", rel(fp), "present", "PASS")
            else:
                # A source file reading a missing path is the silent class:
                # nothing errors, the output is just built on nothing.
                add("S1", f"source reads {m}", rel(fp), "ABSENT", "FAIL")

# ---------------------------------------------------------------- 2. wikilinks in indexes
WIKI_RE = re.compile(r"\[\[([^\]|#]+)")
index_files = []
for dirpath, dirnames, filenames in os.walk(os.path.join(root, "Claude Memory")):
    dirnames[:] = [d for d in dirnames if d != ".git"]
    for fn in filenames:
        if fn == "_index.md":
            index_files.append(os.path.join(dirpath, fn))

# build a basename index once so a link can resolve anywhere in the vault
basenames = {}
for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules", ".obsidian")]
    for fn in filenames:
        if fn.endswith(".md"):
            basenames.setdefault(fn[:-3], []).append(os.path.join(dirpath, fn))

def resolve_wikilink(note_dir, link):
    """Resolve a wikilink the way Obsidian does.

    Order matters, and getting it wrong produces errors in BOTH directions:
      * appending .md blindly false-FAILs links to real non-md files
        (e.g. [[hardware/board.esphome.yaml]])
      * falling back to a global basename match for a PATH-SCOPED link
        false-PASSes it against an unrelated file that happens to share a name
        (e.g. [[sessions/2026-06-19]] silently matching Inbox/Journal/2026-06-19.md)

    So: a link containing a slash must resolve as a path. Only a bare name may
    use the vault-wide basename fallback.
    """
    for base in (note_dir, root):
        for cand in (link, link + ".md"):
            if os.path.exists(os.path.join(base, cand)):
                return True
    if "/" not in link and link in basenames:
        return True
    return False


for idx in index_files:
    base = os.path.dirname(idx)
    try:
        text = open(idx, encoding="utf-8", errors="replace").read()
    except Exception:
        continue
    for link in sorted(set(WIKI_RE.findall(text))):
        link = link.strip()
        if not link:
            continue
        if resolve_wikilink(base, link):
            add("OK", f"wikilink [[{link}]]", rel(idx), "resolves", "PASS")
        else:
            # S3: a dangling link records intent but has no runtime effect.
            add("S3", f"wikilink [[{link}]]", rel(idx), "DANGLING", "FAIL")

# ---------------------------------------------------------------- 3. documented vs merged workflows
wf_dir = os.path.join(root, ".github", "workflows")
readme = os.path.join(root, "Assistant Core", "jarvis-skills", "README.md")
if os.path.exists(readme):
    doc_wfs = sorted(set(re.findall(r"([A-Za-z0-9_\-]+\.ya?ml)", open(readme, encoding="utf-8", errors="replace").read())))
    for wf in doc_wfs:
        if os.path.exists(os.path.join(wf_dir, wf)):
            add("OK", f"workflow {wf}", "jarvis-skills/README.md", "merged", "PASS")
        else:
            # Documented but not merged = the schedule does not exist.
            add("S1", f"workflow {wf}", "jarvis-skills/README.md", "NOT ON master", "FAIL")

# ---------------------------------------------------------------- 3b. frontmatter is valid YAML
# An agent or skill whose frontmatter does not parse is invisible: the file sits
# there looking correct and is simply never loaded. This is the silent class.
# It bites specifically on unquoted scalars containing ": " — e.g.
#   when_to_use: Trigger on: capture didn't arrive
# which YAML reads as a nested mapping. Use a >- block scalar for prose.
try:
    import yaml as _yaml
except ImportError:
    _yaml = None

fm_files = sorted(glob_md(os.path.join(root, ".claude", "agents"))) + \
           sorted(glob_md(os.path.join(root, ".claude", "skills"), recurse=True))
for fp in fm_files:
    try:
        head = open(fp, encoding="utf-8", errors="replace").read()
    except Exception:
        continue
    m = re.match(r"^---\n(.*?)\n---\n", head, re.S)
    if not m:
        add("S1", "frontmatter present", rel(fp), "NO --- BLOCK", "FAIL")
        continue
    if _yaml is None:
        add("REVIEW", "frontmatter YAML", rel(fp), "pyyaml not installed", "REVIEW")
        continue
    try:
        y = _yaml.safe_load(m.group(1))
        if not isinstance(y, dict) or not y.get("name"):
            add("S1", "frontmatter has a name", rel(fp), "malformed", "FAIL")
        else:
            n = len(str(y.get("description", ""))) + len(str(y.get("when_to_use", "")))
            if n > 1536:
                add("S2", f"description+when_to_use = {n}", rel(fp), "over the 1536 cap", "FAIL")
            else:
                add("OK", "frontmatter parses", rel(fp), "valid YAML", "PASS")
    except Exception as e:
        add("S1", "frontmatter parses", rel(fp), f"INVALID YAML: {str(e)[:60]}", "FAIL")

# ---------------------------------------------------------------- 4. status claims to test manually
for idx in index_files:
    text = open(idx, encoding="utf-8", errors="replace").read()
    for kw in ("LIVE", "DEPLOYED", "OPERATIONAL"):
        n = len(re.findall(rf"\b{kw}\b", text))
        if n:
            add("REVIEW", f"{n}x '{kw}' status claim", rel(idx), "needs a human eye", "REVIEW")

# ---------------------------------------------------------------- report
s1 = sum(1 for f in findings if f["sev"] == "S1" and f["verdict"] == "FAIL")
s2 = sum(1 for f in findings if f["sev"] == "S2" and f["verdict"] == "FAIL")
s3 = sum(1 for f in findings if f["sev"] == "S3" and f["verdict"] == "FAIL")
nrev = sum(1 for f in findings if f["verdict"] == "REVIEW")
nunv = sum(1 for f in findings if f["verdict"] == "UNVERIFIED")
npass = sum(1 for f in findings if f["verdict"] == "PASS")

if as_json:
    print(json.dumps(dict(sha=sha(), root=root, findings=findings,
                          summary=dict(checks=len(findings), passed=npass, s1=s1, s2=s2, s3=s3,
                                       review=nrev, unverified=nunv)), indent=2))
else:
    print("=" * 78)
    print(f" JARVIS boundary check — {rel(root) or '.'} @ {sha()}")
    print("=" * 78)
    for sev in ("S1", "S2", "S3", "REVIEW"):
        rows = [f for f in findings if f["sev"] == sev and f["verdict"] != "PASS"]
        if not rows:
            continue
        print(f"\n--- {sev} ---")
        for f in rows:
            print(f"  {f['verdict']:<10} {f['claim'][:52]:<52} {f['reality']}")
            print(f"  {'':<10} source: {f['source']}")
    print("\n" + "=" * 78)
    print(f" {len(findings)} checks — {npass} PASS, {s1} S1, {s2} S2, {s3} S3 "
          f"| {nunv} UNVERIFIED, {nrev} REVIEW")
    print(" S1 = silent (runs, plausible output from missing input) — blocks commit")
    print(" REVIEW = a status claim for a human to confirm; not a defect, not a failure")
    print("=" * 78)

sys.exit(1 if s1 else 0)
