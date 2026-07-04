---
name: Linking project folders to code
description: Imported Claude.ai conversation from 2026-04-26 (4 messages)
type: reference
uuid: 94ca5582-eced-4952-9ada-7dfed96e81b2
created_at: 2026-04-26T21:15:00.467775Z
updated_at: 2026-04-26T21:35:30.082482Z
---

# Linking project folders to code

## human — 2026-04-26 21:15:01

can i link my project folders to code

## assistant — 2026-04-26 21:15:22


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

Yes! Claude Code is actually designed around this idea — you navigate into your project folder in the terminal and run `claude` there. Here's how it works:

**The core mechanic** is simple: once Claude Code is installed, you type `claude` in your terminal from inside your project folder, and it launches with access to that directory — it can read and write files as needed.

**To make it remember your project context across sessions**, you create a `CLAUDE.md` file. Claude Code doesn't carry anything over from your last conversation by default — it has no idea your project uses TypeScript strict mode, where your tests live, or anything about your architecture. The `CLAUDE.md` file solves this: Claude reads it at the start of every session and keeps it loaded throughout.

**Where to put `CLAUDE.md` files** — you can place them in several locations: your home folder (`~/.claude/CLAUDE.md`) applies to all Claude sessions; your project root (`./CLAUDE.md`) can be checked into git to share with your team; and child directories work too — Claude pulls them in on demand when working with files there.

**The fastest way to get started** is with the `/init` command. Running `/init` makes Claude scan your codebase, read your `package.json`, inspect the folder structure, check for test frameworks, and generate a starter `CLAUDE.md`. Treat the output as a first draft though — prune it down and add the stuff that actually matters: your conventions, gotchas, and "don't touch this folder" warnings.

So the workflow is essentially:
1. Install Claude Code (`npm install -g @anthropic-ai/claude-code`)
2. `cd` into your project folder
3. Run `claude`
4. Run `/init` to generate a `CLAUDE.md` for that project
5. Edit the `CLAUDE.md` to add anything specific to your setup

Each project folder gets its own context this way. Want me to help you set up a `CLAUDE.md` for a specific project?

## human — 2026-04-26 21:35:12

npm install -g @anthropic-ai/claude-code

## assistant — 2026-04-26 21:35:30


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

That command is correct and will work! A few important things to know before/during install:

**Prerequisites**
- The npm package requires Node.js 18 or later.
- Do NOT use `sudo npm install -g` — this can lead to permission issues and security risks.

**What OS are you on?** The official docs actually now recommend the native installer over npm for fresh installs:

- **Mac/Linux/WSL:** `curl -fsSL https://claude.ai/install.sh | bash`
- **Windows PowerShell:** `irm https://claude.ai/install.ps1 | iex`

But the npm command you have works fine too. The npm package installs the same native binary as the standalone installer.

**After it finishes**, run:
```
claude doctor
```
to verify the install is healthy.

**Then you'll need to authenticate** — the default option is connecting through the Anthropic Console via OAuth. Alternatively, if you have a Claude Pro or Max plan, you can log in with your Claude.ai account for a unified subscription.

Go ahead and run it — let me know what output you get and we'll take the next step from there.
