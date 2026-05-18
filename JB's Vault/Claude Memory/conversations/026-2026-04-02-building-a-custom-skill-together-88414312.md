---
name: Building a custom skill together
description: Imported Claude.ai conversation from 2026-04-02 (12 messages)
type: reference
uuid: 88414312-7661-4715-9b50-89761027af68
created_at: 2026-04-02T06:11:10.858872Z
updated_at: 2026-04-26T21:34:06.180853Z
---

# Building a custom skill together

## human — 2026-04-02 06:11:11
_attachments:_ SKILL.md
_files:_ SKILL.md

Let's create a skill together using your skill-creator skill. First ask me what the skill should do.

## assistant — 2026-04-02 06:11:12

 What do you want the skill to do?

## human — 2026-04-02 06:11:31

All of them

## assistant — 2026-04-02 06:11:33

 Could you clarify what you mean by "all of them"? Are you referring to:

- All the apps listed in the skill (Gmail, Slack, GitHub, etc.)
- Something else entirely

The connect-apps skill already covers 1000+ apps via Composio. Are you looking to **improve or extend** that existing skill, or build something new?

## human — 2026-04-02 06:14:06

Where is that

## assistant — 2026-04-02 06:14:08

 The connect-apps skill is already installed at:

```
/mnt/skills/user/connect-apps/SKILL.md
```

Want me to read it and we can work on improving it together?

## human — 2026-04-02 06:16:13

Install 

https://github.com/obra/superpowers

## assistant — 2026-04-02 06:16:28

 Let me check the skill-creator skill first, then look at that repo.
```
This block is not supported on your current device yet.
```

Now let me fetch that GitHub repo.
```
This block is not supported on your current device yet.
```

This is a **skills framework for Claude Code** — it's not something I can install directly here in claude.ai. A couple of important points:

**What it is:** Superpowers is a plugin for **Claude Code** (the CLI tool), not for claude.ai. It adds skills like TDD, brainstorming, git worktrees, subagent-driven development, etc.

**How to actually install it:** In Claude Code (terminal), run:
```
/plugin install superpowers@claude-plugins-official
```

**Why it won't work here:** Claude.ai has its own separate skills system (the `.skill` files we've been working with). Superpowers is built for the Claude Code CLI environment, which you've previously explored via the HA Terminal add-on.

---

So — what would you like to do?

1. **Install Superpowers in Claude Code** (via your HA terminal or work PC when possible)
2. **Create a claude.ai skill** inspired by Superpowers (e.g. a TDD or planning skill that works here)
3. Something else entirely

## human — 2026-04-02 06:17:54

How do I use ha

## assistant — 2026-04-02 06:17:56

 You mean Home Assistant, or something else?

## human — 2026-04-02 06:18:05

Y

## assistant — 2026-04-02 06:18:09

 You've got a few ways to access it:

1. **Browser** — go to `http://192.168.0.50` on your local network
2. **Nabu Casa** — your remote URL is `https://uuxgyehjmsoit9uo770ko6cltmrrzmtb.ui.nabu.casa` (works anywhere)
3. **HA app** — iOS/Android app, connects via local or Nabu Casa automatically

What are you trying to do in HA?
