# Slash-command framework: plan → execute → delegate → review

A small, portable set of Claude Code slash commands that turn a goal into a
researched plan, execute it with verification gates, optionally run it in the
background, and review the result — all with sub-agents.

| Command        | What it does                                                                 |
| -------------- | ---------------------------------------------------------------------------- |
| `/ultraplan`   | Deploys parallel sub-agents to research, then writes a step-by-step plan.     |
| `/goal`        | Executes a plan in a **verify-gated loop** until the success criteria are met. |
| `/agents`      | Dispatches the work to **background** sub-agents and hands control back.       |
| `/ultrareview` | Deploys parallel sub-agents to **review** the produced code.                   |

## How this actually works (read this first)

Claude Code custom slash commands are **Markdown files**, one per command, in a
repo's `.claude/commands/` directory (or `~/.claude/commands/` for a whole
machine). When you type `/ultraplan ...`, Claude Code reads
`.claude/commands/ultraplan.md` and runs its body as the prompt, substituting
`$ARGUMENTS` with whatever you typed after the command.

There is **no JavaScript/TypeScript runtime** that "executes" a slash command,
and no config format the engine parses for commands. So in this framework:

- **`.claude/commands/*.md`** — the real commands Claude Code runs.
- **`.claude-commands.json`** — a manifest (source of truth listing the 4
  commands). It drives the installer; the Claude Code engine does not read it.
- **`scripts/install-claude-commands.js`** — a dependency-free Node
  **installer** that copies the command files into another repo. This is what
  "makes the commands available across repos." It is an installer, not a
  command interpreter.

### Where the commands are available
Because they live in the repo's committed `.claude/commands/`, they work in
every Claude Code surface pointed at this repo: the **CLI**, **web**
(claude.ai/code / code.claude.com), **mobile**, and **desktop** apps. Note: the
consumer **claude.ai chat app** is a different product and does not read repo
slash commands — only Claude Code does.

`/ultrareview` may also exist as a **built-in** cloud command in Claude Code's
web environment (a billed, user-triggered multi-agent review). Where the
built-in is present it can take precedence over the custom `ultrareview.md`;
that's expected, and the custom file remains the portable fallback.

## The workflow

```
/ultraplan <goal>   →  writes .claude/plans/<slug>.md  (researched, checkboxed)
        │
        ▼
/goal [slug]        →  works the plan step by step, verifying each step,
                       checking boxes, looping until success criteria pass
        │  (or, to free your session:)
        ▼
/agents [slug]      →  runs the remaining work as background sub-agents
        │
        ▼
/ultrareview        →  parallel review of the diff before you merge
```

- **`/ultraplan`** is plan-only — it never implements. It persists the plan and
  its success criteria to `.claude/plans/`.
- **`/goal`** is verify-gated: implement a step, run its check (build / tests /
  observed behavior), mark it done, repeat. It **stops** on success, on a
  repeated failure (~3 tries), or when a step needs a risky action or a human
  decision — it won't disable checks to force a pass.
- **`/agents`** dispatches the work with `run_in_background` and returns your
  session immediately; you're notified as agents finish.
- **`/ultrareview`** reviews only (correctness, security, tests, style) and ends
  with a verdict; it doesn't fix issues unless you ask.

## Install into another repo (per-repo)

From this framework repo, run the installer and point it at the target repo:

```bash
# List the commands in the manifest
node scripts/install-claude-commands.js --list

# Preview what would be installed into another repo
node scripts/install-claude-commands.js /path/to/other-repo --dry-run

# Install (creates the target's .claude/commands/ and .claude/plans/)
node scripts/install-claude-commands.js /path/to/other-repo

# Update existing command files in a repo that already has them
node scripts/install-claude-commands.js /path/to/other-repo --force
```

Then **commit `.claude/commands/`** in the target repo so the commands travel
with it (and work in web/mobile cloud sessions, which start from a fresh clone).

To roll the framework out across many repos, run the installer once per repo
(e.g. in a loop over your repo paths) and commit the result in each.

## Files

```
.claude-commands.json              # manifest (drives the installer)
scripts/install-claude-commands.js # installer / sync script
.claude/commands/ultraplan.md      # /ultraplan
.claude/commands/goal.md           # /goal
.claude/commands/agents.md         # /agents
.claude/commands/ultrareview.md    # /ultrareview
.claude/plans/                     # where /ultraplan writes plans
```
