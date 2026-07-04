---
name: Docker AI overview documentation
description: Imported Claude.ai conversation from 2026-03-24 (4 messages)
type: reference
uuid: aee7fec3-f1c9-419b-8bc2-872ad2b3e131
created_at: 2026-03-24T04:44:14.670839Z
updated_at: 2026-04-26T21:34:06.180853Z
---

# Docker AI overview documentation

## human — 2026-03-24 04:44:17

Read https://docs.docker.com/ai-overview.md so I can ask questions about it.

## assistant — 2026-03-24 04:44:28


```
This block is not supported on your current device yet.
```

I've read the page. Here's a quick summary of what it covers:

Docker provides five AI tools for different parts of the development workflow:

- **Gordon** (`docker ai`) — a built-in AI assistant for Docker-specific tasks like debugging containers, writing Dockerfiles, and managing images.
- **Model Runner** (`docker model`) — runs LLMs locally with an OpenAI-compatible API.
- **MCP Catalog and Toolkit** (`docker mcp`) — connects AI tools to external services via the Model Context Protocol.
- **Docker Agent** (`docker agent`) — an open-source framework for building and orchestrating custom multi-agent teams defined in YAML.
- **Docker Sandboxes** (`docker sandbox`) — provides isolated microVM environments for running coding agents (including Claude Code, Codex, Copilot, Gemini, and Docker Agent).

Go ahead and ask anything about it!

## human — 2026-03-24 04:45:31

how to install on windows if i am restricted via admin credentials

## assistant — 2026-03-24 04:45:49

 The page I read doesn't cover installation instructions or Windows-specific setup — it's just a high-level overview of Docker's AI tools. Let me fetch the relevant docs to give you a proper answer.
```
This block is not supported on your current device yet.
```

Here's the honest picture for your situation:

## Docker Desktop on Windows — Admin Restriction Reality

### The hard truth
Docker Desktop on Windows **requires administrator privileges to install** — you'll get a UAC prompt during setup to install a privileged helper service. However, after installation, it *can* be run without admin rights.

So you have a few paths depending on your situation:

---

### Option 1: Get your IT admin to install it for you (recommended in corporate environments)
If you're on a corporate or work PC, your admin will need to do the installation for you. After that, they'll need to add your non-admin user account to the **docker-users** group in Computer Management.

If your administrator account is different from your user account, they should navigate to **Local Users and Groups → Groups → docker-users**, right-click to add your user, then you sign out and back in for the changes to take effect.

For IT admins deploying to machines where users lack admin rights, Docker Desktop should be installed using the `--always-run-service` installer flag, which ensures privileged operations can still be executed without prompting for UAC elevation.

---

### Option 2: Use Podman as a Docker-compatible alternative (no admin needed)
If getting admin access isn't possible, **Podman** is a Docker-compatible tool that can build and run containers on any system without admin rights. It supports the same CLI commands and image formats as Docker, making it a solid drop-in replacement for most use cases.

---

### Option 3: Use Docker via WSL 2 (if WSL is already enabled)
If your IT team has already enabled WSL 2 on your machine via Group Policy, you may be able to run Docker Engine inside WSL without needing Docker Desktop at all — though this is more technical to set up.

---

**Bottom line:** The installation itself cannot be done without admin rights — that's a hard requirement. Your best bet is to ask your IT/admin team to install it and add you to the `docker-users` group, or explore Podman as an alternative.
