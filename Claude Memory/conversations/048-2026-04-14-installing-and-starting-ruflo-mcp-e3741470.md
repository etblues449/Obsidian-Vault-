---
name: Installing and starting Ruflo MCP
description: Imported Claude.ai conversation from 2026-04-14 (8 messages)
type: reference
uuid: e3741470-94e6-40d6-a862-4d6b42b7ec1b
created_at: 2026-04-14T04:47:05.023879Z
updated_at: 2026-04-14T06:50:39.883282Z
---

# Installing and starting Ruflo MCP

**Summary:** **Conversation Overview**

The person asked about setting up Ruflo, an MCP (Model Context Protocol) server from the GitHub repository ruvnet/ruflo, across different Claude environments. The conversation began with the person sharing a Claude Code CLI command (`claude mcp add ruflo -- npx -y ruflo@latest mcp start`) and asking whether Ruflo could also be used in Claude.ai chat. Claude clarified the distinction between local MCP servers (compatible with Claude Code and Claude Desktop) and remote/hosted MCP servers (required for Claude.ai chat).

The person then asked specifically how to add Ruflo to the Claude Desktop app. Claude provided a complete setup guide including editing the `claude_desktop_config.json` file (with platform-specific paths for macOS and Windows), the correct JSON configuration block using `npx`, an optional `ruflo@latest init` step, and a macOS-specific workaround for a known bug where MCP servers start with `cwd: "/"` — resolved by adding a `CLAUDE_FLOW_CWD` environment variable pointing to the user's home directory.

The conversation demonstrated that the person is exploring MCP server integrations and learning how different Claude surfaces (chat, Claude Code, Claude Desktop) handle MCP connections differently. No corrections to Claude's approach were requested.

## human — 2026-04-14 05:52:53

claude mcp add ruflo -- npx -y ruflo@latest mcp start

## assistant — 2026-04-14 05:52:58

 I can help you understand what this command does, but I should clarify what context it's for.

This command is for **Claude Code** (the CLI tool), not Claude.ai (this chat interface). It adds an MCP (Model Context Protocol) server called "ruflo" to your Claude Code configuration.

**What it does:**
- `claude mcp add` — registers a new MCP server with Claude Code
- `ruflo` — the name you're giving this server
- `--` separates the name from the command that starts the server
- `npx -y ruflo@latest mcp start` — runs the latest version of the `ruflo` package as an MCP server

**To use it**, you'd run this in your terminal where Claude Code is installed:

```bash
claude mcp add ruflo -- npx -y ruflo@latest mcp start
```

This would add ruflo as an available MCP tool within Claude Code sessions.

Is there something specific you're trying to accomplish with ruflo, or do you need help setting up Claude Code itself?

## human — 2026-04-14 06:03:38

cani use this in chat aswell

## assistant — 2026-04-14 06:03:44

 Yes! I can see you're already connected to **ClickUp** via MCP in this chat (it shows in your available connectors).

However, **ruflo** isn't in your connected MCP servers list. To use an MCP server in Claude.ai chat, it needs to be added through the Claude.ai interface/settings — you can't add it via the `claude mcp add` CLI command, as that only works for Claude Code.

To add MCP servers to Claude.ai chat, you'd typically go to **Settings → Integrations** (or similar) in Claude.ai and add it there, if ruflo is supported as a Claude.ai connector.

Do you know what ruflo does? I can help you figure out if there's a way to use it here.

## human — 2026-04-14 06:09:29

# Start Ruflo MCP server in any environment
npx ruflo@latest mcp start

## assistant — 2026-04-14 06:09:36

 That command starts the Ruflo MCP server locally on your machine — it's still a **CLI/local tool**, not something that can be added directly through this chat.

To use it in **Claude.ai chat**, Ruflo would need to be hosted as a remote MCP server with a URL (like `https://mcp.ruflo.com/sse` or similar), rather than run locally via `npx`.

**Your options:**

1. **Check if Ruflo offers a hosted/remote MCP URL** — visit their docs or website to see if there's a cloud-hosted version you can connect via Claude.ai Settings → Integrations

2. **Use it in Claude Code instead** — local MCP servers work perfectly there with the command you shared earlier

3. **Use a tunnel** (advanced) — tools like `ngrok` can expose a local MCP server to the internet, making it accessible to Claude.ai, but this is complex to set up

Do you know what Ruflo actually does? That might help figure out the best approach.

## human — 2026-04-14 06:50:23

how to add https://github.com/ruvnet/ruflo?utm_source=chatgpt.com# to desktop app

## assistant — 2026-04-14 06:50:39

 Let me fetch the Ruflo docs to give you accurate instructions.
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

Good — Ruflo is primarily designed for **Claude Code** and **Claude Desktop**, not Claude.ai chat. Here's how to add it to the **Claude Desktop app**:

---

## Adding Ruflo to Claude Desktop

### Step 1 — Install Node.js (if not already)
You need Node.js 18+ (20+ recommended). Check with:
```bash
node --version
```

### Step 2 — Edit your Claude Desktop config file

Open the MCP config file for Claude Desktop:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add this to the `mcpServers` section:

```json
{
  "mcpServers": {
    "ruflo": {
      "command": "npx",
      "args": ["-y", "ruflo@latest", "mcp", "start"]
    }
  }
}
```

### Step 3 — Restart Claude Desktop

Fully quit and reopen the app. Ruflo's tools should now appear.

---

### Optional: Initialize a project first
After installation, you can register Ruflo and it exposes tools across categories like hooks, coordination, and memory. If you want to initialise a project before connecting:

```bash
npx ruflo@latest init
```

---

**Important note for macOS users:** There's a known bug where the MCP server starts with `cwd: "/"` on macOS, causing file operations to fail. The fix is to pass the working directory as an env variable. Use this config instead:

```json
{
  "mcpServers": {
    "ruflo": {
      "command": "npx",
      "args": ["-y", "ruflo@latest", "mcp", "start"],
      "env": {
        "CLAUDE_FLOW_CWD": "/Users/YOUR_USERNAME"
      }
    }
  }
}
```

Replace `/Users/YOUR_USERNAME` with your actual home directory path.
