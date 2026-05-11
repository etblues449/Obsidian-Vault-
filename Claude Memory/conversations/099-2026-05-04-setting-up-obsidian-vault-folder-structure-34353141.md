---
title: "Setting up Obsidian vault folder structure"
date: 2026-05-04
uuid: 34353141-76eb-4785-9d7e-e0757a62defc
messages: 2
project: ""
source: claude.ai export 2026-05-08
---

# Setting up Obsidian vault folder structure

> 2 messages · 2026-05-04

### Human — 2026-05-04T23:32

✅ Phone is fully in sync. `Already up to date` after pulling 23 files from Windows.
Your phone vault is correct and current. Everything is working.
To implement the folder structure — go to Claude Desktop now and start a new chat with exactly this prompt:
"Read Claude Memory/Projects/Smart Home/_index.md first, then create this folder structure in my Obsidian vault:

* 00 - Inbox
* 01 - Projects/Smart Home, Faceless Finance, Debt, Studying, Elliot - Legal — each with _index.md, code/, artifacts/ subfolders
* 02 - Claude Memory (rename existing Claude Memory folder)
* 03 - Code with python, javascript, esphome, bash subfolders
* 04 - Artifacts with documents, spreadsheets, templates subfolders
* 05 - Conversations
* 06 - Reference with credentials.md, tools.md, people.md
* 07 - Daily
For each _index.md use this template:
Goal
Status
Key decisions
Next actions
Don't move or delete any existing files — just create the new structure around them."
Claude Desktop will execute that directly in your vault via the MCP tools. Once it's done, run `vaultpull` in Termux and your phone will have the new structure too.

### Assistant — 2026-05-04T23:37

I'll start by reading your Smart Home project index to understand the context, then we can proceed with the folder structure implementation.Now let me read the Smart Home project index:I need to check where your Obsidian vault is located. Let me search for it:Let me check which directories I can access:I see. Your vault is located at `C:\claude\Debt`. Let me check the structure there:I see Claude Desktop isn't responding right now. Let me clarify the next steps with you:

Based on your instructions, here's what we need to do:

**Step 1: Launch Claude Desktop** and start a new chat with this exact prompt:

```
Read Claude Memory/Projects/Smart Home/_index.md first, then create this folder structure in my Obsidian vault:

* 00 - Inbox
* 01 - Projects/Smart Home, Faceless Finance, Debt, Studying, Elliot - Legal — each with _index.md, code/, artifacts/ subfolders
* 02 - Claude Memory (rename existing Claude Memory folder)
* 03 - Code with python, javascript, esphome, bash subfolders
* 04 - Artifacts with documents, spreadsheets, templates subfolders
* 05 - Conversations
* 06 - Reference with credentials.md, tools.md, people.md
* 07 - Daily
For each _index.md use this template:
Goal
Status
Key decisions
Next actions
Don't move or delete any existing files — just create the new structure around them.
```

Claude Desktop has direct MCP access to your Obsidian vault via the filesystem MCP server and will execute the folder creation and file organization in one go.

**Confirm when:**
1. You've launched Claude Desktop
2. You've pasted that prompt into a new chat

Then I can guide Step 2 (running `vaultpull` in Termux to sync your phone).

Ready?

