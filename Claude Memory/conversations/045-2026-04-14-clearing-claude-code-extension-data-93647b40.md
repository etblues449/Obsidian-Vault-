---
name: Clearing Claude Code extension data
description: Imported Claude.ai conversation from 2026-04-14 (4 messages)
type: reference
uuid: 93647b40-fef3-46d2-987b-f719f27892e9
created_at: 2026-04-14T01:19:25.494732Z
updated_at: 2026-04-14T01:19:59.987062Z
---

# Clearing Claude Code extension data

## human — 2026-04-14 01:19:25

rm -rf ~/.vscode/globalStorage/anthropic.claude-code

## assistant — 2026-04-14 01:19:30

 That command deletes Claude Code's global storage directory, which would reset its stored settings and data.

Is there something specific you're trying to fix or reset? I want to make sure this will actually solve your problem before you run it. For example:

- **Authentication issues** — there may be a better targeted fix
- **Corrupted state** — this would work, but you'd need to re-authenticate
- **Starting fresh** — totally valid reason to wipe it

What's the context?

## human — 2026-04-14 01:19:57

start fresh.

## assistant — 2026-04-14 01:19:59

 To run that in your terminal:

```bash
rm -rf ~/.vscode/globalStorage/anthropic.claude-code
```

After running it, you'll need to re-authenticate Claude Code the next time you open VS Code. That's it — clean slate!
