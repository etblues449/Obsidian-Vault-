---
name: Adding Claude to Warp
description: Imported Claude.ai conversation from 2026-04-21 (6 messages)
type: reference
uuid: 78179a61-4dcf-4010-ad12-7b155078a59e
created_at: 2026-04-21T11:44:05.426614Z
updated_at: 2026-04-21T11:45:31.514113Z
---

# Adding Claude to Warp

## human — 2026-04-21 11:44:05

how to add claude to warp

## assistant — 2026-04-21 11:44:23


```
This block is not supported on your current device yet.
```

There are actually two different ways to "add Claude to Warp" depending on what you want. Here's a quick breakdown, then steps for each:

**Option A — Use Claude as Warp's AI provider** (for command suggestions, error explanations, etc.)

**Option B — Run Claude Code inside Warp** (the full agentic coding assistant)

---

## Option A: Set Claude as Warp's AI Provider

1. Open Warp settings with **Cmd + ,** (macOS) or click the gear icon top-right.
2. Navigate to the **AI** section.
3. Find the **AI Provider** dropdown and select **Anthropic (Claude)**.
4. Paste your Anthropic API key into the field and save. You can get a key at console.anthropic.com.
5. Test it by pressing **#** in the Warp input bar and typing a natural language request — Claude will suggest the appropriate command.

---

## Option B: Run Claude Code inside Warp

Claude Code is Anthropic's AI coding agent that reads your codebase, writes and edits code, runs commands, and handles complex refactors using natural language prompts.

1. Make sure you have a **Claude account with CLI access** (requires a paid plan or API credits).
2. Follow Anthropic's official installation guide to install Claude Code — the native installer is recommended as it requires no dependencies and auto-updates in the background.
3. Launch Claude Code inside a Warp terminal window. Warp will auto-detect the agent session and surface integrated controls, including rich input, code review, vertical tab metadata, and more.
4. **Install the Warp plugin** for notifications: when you run Claude Code in Warp without the plugin installed, a notification chip appears offering one-click installation. You can also install manually via:
   ```
   /plugin marketplace add warpdotdev/claude-code-warp
   /plugin install warp@claude-code-warp
   ```
5. Restart Claude Code or run `/reload-plugins` after installing — once restarted, you'll see a confirmation message and notifications will appear automatically.

---

Which of these are you looking to do?

## human — 2026-04-21 11:45:07

2

## assistant — 2026-04-21 11:45:12

 Here's how to set up **Claude Code inside Warp**, one step at a time.

---

### Step 1: Check prerequisites

Make sure you have:
- **Warp** installed (warp.dev)
- **macOS 13+**, **Windows 10+**, or **Ubuntu 20.04+**
- A **Claude account with CLI access** — Claude Code requires a paid plan or API credits
- **Git** installed — Claude Code works best inside a Git repository. On Windows, Git for Windows is required

Are all of these in order? Let me know and I'll walk you through Step 2.

## human — 2026-04-21 11:45:24

y

## assistant — 2026-04-21 11:45:31

 ### Step 2: Install Claude Code

Follow Anthropic's official installation guide to install Claude Code — the native installer is recommended as it requires no dependencies and auto-updates in the background.
```
This block is not supported on your current device yet.
```

Run this in your Warp terminal to install Claude Code using the **native installer** (recommended — no Node.js needed):

**macOS / Linux:**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://claude.ai/install.sh | iex
```

The native installer downloads the binary, puts it in `~/.local/bin`, and sets up auto-updates. No Node.js needed, no dependencies.

Once it finishes, verify it worked by running:
```bash
claude --version
```

Let me know what you see and I'll walk you through Step 3 (authentication).
