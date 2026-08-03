---
name: sync-recovery
description: Find and restore files a stale Obsidian-git sync silently deleted from master.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Skill
argument-hint: "[optional path or date to focus on]"
---

# /jarvis:sync-recovery

Recover files deleted by an Obsidian sync from a stale working copy: $ARGUMENTS

This has happened at least twice. On 2026-07-14, commit `9fd5e00` — subject
`Sync from Obsidian (Jarvis ): 2026-07-14 22:53 UTC — 0+ 0~ 5-` — removed five
`.github/workflows/*.yml` files that no one had touched in Obsidian. A device holding an old
checkout committed its own absence as a deletion. Obsidian-only clients delete what they cannot
see: workflow YAML, manifests, setup scripts, dotfiles.

Load `jarvis-vault-access` first. **Never force-push** while resolving this.

## Sequence

1. **Find the deleting commits.** The trailing `N-` count in a sync subject is the tell.

   ```bash
   git log --format='%h %ad %s' --date=short --diff-filter=D --name-only -20 --grep='Sync from Obsidian'
   ```

2. **List exactly what went.** For each suspect commit:

   ```bash
   git show --stat --diff-filter=D --name-only <sha>
   ```

3. **Restore from the last commit that had them** — `git checkout <sha>^ -- '<path>'` per file.
   Restore the file as it was *before* the deletion, not from an unrelated branch.
4. **Reconcile.** If a file was legitimately modified after the deletion, keep the modification
   and discard only the deletion. Never resolve by discarding later work.
5. **Check the blast radius.** A deleted workflow means the schedule stopped silently — check
   whether the expected output exists for the period the file was missing, and say plainly if
   there is a gap.
6. **Record the recurrence** in the `CLAUDE.md` change history and in
   `Claude Memory/Account/capture_queue.md`, with the commit SHA and date.

## Prevention, not just repair

The root cause is more than one git-backed working copy. Multiple `.obsidian` folders have
existed on the Fold 7, one a live repo inside `.trash`. Disable obsidian-git in every vault
except the single intended writer, and confirm you have done it rather than recommending it.

## Verify before reporting

```bash
git status --short
bash .claude/skills/vault-integrity-audit/scripts/drift-check.sh .
python3 .claude/skills/qa-boundary-check/scripts/verify-refs.py .
```
