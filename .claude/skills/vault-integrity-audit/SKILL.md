---
name: vault-integrity-audit
description: >-
  Detects and repairs drift in the JARVIS vault — files that documents claim exist but don't,
  dangling wikilinks, indexes marked LIVE/DEPLOYED for things never merged, runner inputs that
  are missing, and duplicate or stale project records. Use when asked to audit, check, verify,
  health-check, or clean up the vault; when a session-start file turns up missing; when
  something "should be working but isn't"; and when re-running or extending an earlier audit.
  Run this BEFORE trusting any status claim in Claude Memory/. Not for content quality or
  writing style — only for whether the vault's claims match reality.
when_to_use: >-
  Trigger on: audit the vault, health check, what's broken, verify the vault, a session-start
  file turned up missing, 'this should be working', re-run the audit, what regressed since last
  time. Do NOT trigger for writing quality or note content — only for whether the vault's
  claims match the filesystem.
---

# Vault integrity audit

Most JARVIS failures are not bad code. They are a document asserting a state the
filesystem does not share: a runner reading a file nobody created, a README documenting
workflows never merged, an index linking to a session note that does not exist.

These are dangerous specifically because they are **silent**. Nothing errors. Morning
Brief with a missing `MEMORY.md` does not crash — it produces a confident briefing built
on nothing.

Read `vault-conventions` first for canonical paths and the write path.

## The three states

Every status claim in the vault is in one of three states, and the vault routinely
conflates them:

| State | Means | How to prove it |
|---|---|---|
| **Documented** | A note says it exists | you read the note |
| **Merged** | The artefact is on `master` | `test -f`, `ls`, `git log` |
| **Running** | It has actually executed | a run in the Actions tab, a file at the output path, a responding endpoint |

A skill that is Documented but not Merged is doing nothing. Report which of the three
each claim has reached — never collapse them into "✅".

## Procedure

**1. Get a real copy.** `git clone --depth 1 -b master` into a scratch directory. Do not
audit through the GitHub API — you will hit 403 partway and mistake a rate-limit for a
missing file, which is the worst possible false positive here.

**2. Run the bundled check.** `scripts/drift-check.sh <vault-root>` covers the recurring
classes automatically: session-start files, runner inputs, workflow presence, project
indexes, dangling wikilinks, and date-format violations.

**3. Test every status word.** Grep the indexes for `LIVE`, `DEPLOYED`, `complete`,
`verified`, `✅`. Each is an assertion. Resolve it to Documented / Merged / Running.

**4. Check both sides of each interface.** A path is not verified by confirming the file
exists — it is verified by confirming the *reader* and the *file* agree. `runner.mjs`
reading `Claude Memory/MEMORY.md` requires that exact path, that exact case.

**5. Classify severity before reporting.**

| Severity | Definition |
|---|---|
| **S1** | Silent failure — a component runs and produces plausible output from missing input |
| **S2** | Loud failure — something is broken and says so |
| **S3** | Cosmetic — dangling link, stale wording, no runtime effect |

S1 outranks S2. A crash gets noticed; a fabricated briefing does not.

## Repair rules

- **Never invent content to close a gap.** If `MEMORY.md` is missing, create it with
  real, sourced content or leave it missing and record the gap. A plausible-looking
  invented memory file is worse than an absent one, because the absence is detectable
  and the invention is not.
- **Fix the source, not the symptom.** A junk filter that hides empty captures leaves
  the capture bug alive.
- **Repair through the single write path.** Route every fix through the vault keeper's
  git path.
- **A dangling link is intent.** It records that someone meant a file to exist. Create
  the target or correct the path — do not delete the link.

## Output

```
## Vault integrity audit — <date>, <commit sha>

Checks run: N   S1: n   S2: n   S3: n

| # | Claim | Source | Reality | State | Sev | Owner |
|---|-------|--------|---------|-------|-----|-------|
| 1 | runner reads Claude Memory/MEMORY.md | runner.mjs | absent on master | Documented | S1 | vault-keeper |

## Repairs applied
| Path | Action | Reason |

## Left open (with reasons)
```

Always state the commit SHA you audited. An audit without a SHA cannot be re-checked
later, and drift audits are only useful as a time series.

## Re-running

If a previous audit exists, re-test each prior finding first and mark it
`FIXED` / `STILL FAILING` / `REGRESSED`. A finding that was FIXED and has REGRESSED is an
escalation, not a repeat — the fix did not hold, and the process that produced it needs
attention more than the file does. Never silently drop a prior finding.

## Gotchas

- **Never audit through the GitHub API.** You will hit 403 partway and mistake a
  rate-limit for missing files. Clone first, audit the clone.
- **"✅" is an assertion, not evidence.** So are LIVE, DEPLOYED, OPERATIONAL, complete,
  and verified. Each one is a claim you have not yet tested.
- **A checker that emits false positives gets ignored within a month.** When output looks
  wrong, fix the checker — do not explain the output away. Two of this harness's own
  checks were wrong in opposite directions on first run.
- **Regex is not a YAML parser.** Frontmatter that fails to parse makes an agent or skill
  *invisible* — the file sits there looking correct and never loads. Validate with a real
  parser.
- **Never make the metric green by weakening the check.** If a category can never pass
  (a status claim no script can observe), reclassify it honestly as needing review rather
  than deleting it or pretending it passed.
