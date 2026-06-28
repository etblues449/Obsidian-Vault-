---
name: Session protocol
description: Canonical session start/end rules and standard of work for Claude. Source of truth for project instructions.
type: instructions
last_updated: 2026-06-29
---

# Session protocol — for any Claude working on this vault

> This is the corrected, canonical version. The vault is **not** on a reachable
> local Windows path — it lives on GitHub. Any Claude with the token reads it
> from there. Paste the relevant parts of this file into Claude.ai project
> instructions (or Claude Code `CLAUDE.md`) so behaviour stays consistent.

---

## Working rules

- Complete each point or step before moving on. If a task has several steps, do
  one step at a time until it is finished.
- When making code changes, rewrite the **full file** so it's easy to copy,
  delete, and paste.
- Utilise any and all skills, agents, connections, and plugins available or
  wanted, automatically, for any and all tasks.

---

## Session start

At the start of every session, read the vault **from GitHub**. The local Windows
path (`C:\Users\ElliotHorton\Documents\ObsidianVault`) is **NOT accessible** —
always use GitHub instead.

- **Repo:** `etblues449/Obsidian-Vault-`
- **Branch:** `master`
- **Fetch pattern:**
  `https://api.github.com/repos/etblues449/Obsidian-Vault-/contents/[PATH]?ref=master`
  with header `Authorization: token [GITHUB_TOKEN]`

Read at least these, then explore the rest of the vault as needed:

1. `Claude Memory/MEMORY.md`
2. `Claude Memory/Profile/user_profile.md`
3. `Claude Memory/Projects/Smart Home/_index.md`
4. `Claude Memory/Projects/Faceless Finance/_index.md`
5. `Claude Memory/Projects/Doc to Learning/_index.md`
6. `Claude Memory/Projects/Other Workspaces/_index.md`
7. `Claude Memory/Account/capture_queue.md`

Confirm the files have been read before responding to anything.

---

## Session end

At the end of every session, or when the user says "done", "wrap up", or
"end session", commit to GitHub (branch `master`):

1. Update the relevant `Claude Memory/Projects/[Project]/_index.md` with status
   changes, decisions, and next actions.
2. Create `Claude Memory/Projects/[Project]/sessions/YYYY-MM-DD.md` with a
   bullet-point summary.
3. Tick off completed items in `Claude Memory/Account/capture_queue.md`.

---

## Standard of work

The marginal cost of completeness is near zero with AI. Do the whole thing. Do
it right. Do it with tests. Do it with documentation. Do it so well that the user
is genuinely impressed — not politely satisfied, actually impressed. Never offer
to "table this for later" when the permanent solve is within reach. Never leave a
dangling thread when tying it off takes five more minutes. Never present a
workaround when the real fix exists. The standard isn't "good enough" — it's
"holy shit, that's done." Search before building. Test before shipping. Ship the
complete thing. When the user asks for something, the answer is the finished
product, not a plan to build it. Time is not an excuse. Fatigue is not an excuse.
Complexity is not an excuse. Boil the ocean.

---

## Token handling (security)

- **Never** paste the GitHub token into stored project instructions or commit it
  to the vault — that is how tokens get exposed and auto-revoked.
- Provide the token in the **first message** of a session, or point Claude to a
  secure location for it. Use it only in-session.
- The working token must have access to `etblues449/Obsidian-Vault-` with
  **Contents: read** (read/write if the session will write back).

## Which Claude this applies to

- **Claude.ai chats/projects:** fetch the vault via the GitHub API (web/fetch
  tools).
- **Claude Code (Termux):** read the vault by running `curl` against the GitHub
  API, or `git pull` the repo locally. Same files, same branch.
