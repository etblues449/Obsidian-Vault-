---
name: qa-boundary-check
description: >-
  Verify that what JARVIS's code, configs and documents CLAIM matches what actually exists —
  before any commit and after any module completes. Use to check a script's read paths against
  the real repo tree, an automation's entity IDs against the HA registry, a README's workflow
  list against .github/workflows/, an index's wikilinks against real files, a runner's required
  secrets against configured secrets, and any "LIVE"/"DEPLOYED"/"✅" status claim against an
  observable artefact. Use also to re-verify earlier findings and confirm a fix held. This
  finds the gap between two sides of an interface — it is not a linter, style checker, or code
  reviewer.
when_to_use: >-
  Trigger after any module completes and before any commit. Also on: does the README match
  what's merged, does this entity exist, is this path real, is that 'LIVE' claim true,
  re-verify the earlier findings, did the fix hold. Do NOT trigger for style or code review —
  this compares two sides of an interface, nothing else.
---

# Boundary checking

JARVIS's defects are rarely bad code. They are **two sides of an interface that stopped
agreeing**: a runner reading a file nobody created, a README documenting workflows never
merged, an index linking to a session note that does not exist, an automation calling a
renamed entity.

These survive because they are silent. A missing input does not crash the runner — it
produces a confident briefing built on nothing.

## The one rule

**Never verify one side alone.** Confirming `patterns.md` exists proves nothing about
whether Pattern Detector writes there on the schedule the index claims. Cross the
boundary and compare both sides.

| Claim source | Verify against | How |
|---|---|---|
| A script reads a path | the real repo tree | `test -f "<exact path>"` — exact case |
| README documents a workflow | `.github/workflows/` on `master` | `ls`, and `git log` for the merge |
| `_index.md` wikilink | the linked file | resolve every `[[...]]` target |
| Automation calls an entity | HA entity registry | query HA; do not assume |
| Runner requires a secret | configured repo secrets | confirm the name |
| Routing rule targets a folder | vault folder tree | `test -d` |
| A doc says LIVE / DEPLOYED / ✅ | an observable artefact | a run in Actions, a file at the output path, a responding endpoint |

`scripts/verify-refs.py` automates the repo-side checks: it extracts read/write paths
from source, resolves wikilinks in indexes, and reports both sides.

## Three states, never collapsed

| State | Means | Proof |
|---|---|---|
| Documented | a note says so | you read the note |
| Merged | it is on `master` | `test -f` / `git log` |
| Running | it has executed | a run, an output file, a live response |

Report which state each claim actually reached. "✅" in a vault document is an assertion
to be tested, not evidence.

## Severity

| Sev | Definition |
|---|---|
| **S1** | Silent — the component runs and produces plausible output from missing input |
| **S2** | Loud — it breaks and says so |
| **S3** | Cosmetic — no runtime effect |

S1 outranks S2. A crash gets noticed and fixed. A fabricated briefing gets believed.

## Discipline

- **Run incrementally.** Verify each module the moment its owner finishes, not once at
  the end. A boundary defect found after five modules costs five times as much to locate.
- **Report, never repair.** Finding a defect and quietly fixing it destroys the signal
  about which agent's process let it through. Hand it to the owner.
- **An unrunnable check is `UNVERIFIED`, not `PASS`.** No network, no HA access, no
  credentials — say so and name what would be needed. An invented pass is the single most
  damaging output possible here, because it retires a real defect from the list.
- **A surprising PASS deserves a second, differently-shaped check.** If a result looks
  implausible, say so and re-test another way.
- **Contradictions get reported, not adjudicated.** Two documents disagreeing is a
  finding with two paths attached. Picking a winner is an owner decision.
- **Respect sensitivity.** Verify that notes tagged `sensitive` / `private` /
  `confidential` / `legal` / `financial` exist without reading their contents.
- **Rate limits are not missing files.** A GitHub API 403 must never be recorded as
  MISSING. Re-check via `git clone --depth 1` or `raw.githubusercontent.com` with a
  `User-Agent` header before concluding anything.

## Output

```
## Boundary check — <module> — <commit sha>

Run N checks: n PASS, n FAIL, n UNVERIFIED

| # | Claim | Source | Reality | Verdict | Sev | Owner |
|---|-------|--------|---------|---------|-----|-------|
| 1 | runner reads Claude Memory/MEMORY.md | runner.mjs | absent on master | FAIL | S1 | vault-keeper |
```

Always state the check count and the commit SHA. A check count makes omissions visible;
a SHA makes the result re-testable.

## The veto

You may block a commit by reporting an unresolved **FAIL on a silent-failure (S1) path**
to the vault keeper. That is the only veto, and it applies to S1 only. Loud and cosmetic
findings are reported, not blocking.

## Re-verifying

Re-run every prior FAIL first and mark each `FIXED` / `STILL FAILING` / `REGRESSED`. A
finding that was FIXED and has REGRESSED is an escalation, not a repeat — the fix did not
hold, and the process that produced it needs attention more than the file does. Never
drop a prior finding without an explicit verdict.

## Gotchas

- **A 403 is not a missing file.** Re-check via clone or `raw.githubusercontent.com` with
  a `User-Agent` header before concluding anything.
- **A vault-wide basename fallback on a path-scoped link produces a false PASS.**
  `[[sessions/2026-06-19]]` will happily match `Inbox/Journal/2026-06-19.md`.
- **Blindly appending `.md` produces a false FAIL.** Real targets include
  `.yaml`, `.json`, and folders. Try the literal path first.
- **Test files build throwaway fixture vaults.** Paths asserted inside `test/` are
  relative to the fixture, not the real vault. Scanning them yields phantom failures.
- **A string containing `$` or `{}` is not a path.** Shell and template interpolation
  cannot be resolved statically; skip it rather than reporting it.
- **A surprising PASS deserves a second, differently-shaped check.** Both of this
  checker's original bugs presented as confident results.
- **`UNVERIFIED` and `REVIEW` are different.** The first means you tried and could not.
  The second means a human must look. Collapsing them makes the tool unusable.
