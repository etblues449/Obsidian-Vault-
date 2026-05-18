---
name: Bulk download with mcp-builder
description: Imported Claude.ai conversation from 2026-04-21 (4 messages)
type: reference
uuid: 1b0c5ce3-58c6-441e-9fe8-a0851c3c2b8b
created_at: 2026-04-21T13:35:16.554611Z
updated_at: 2026-04-21T14:13:51.508846Z
---

# Bulk download with mcp-builder

## human — 2026-04-21 13:35:16

/mcp-builder Download all of them

## assistant — 2026-04-21 13:36:04


```
This block is not supported on your current device yet.
```

Now let me read all the reference files:
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

Now let me check for any other files in the skill directory:
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

Now I have all the files. Let me copy them all to the outputs directory:
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

All 10 files from the `mcp-builder` skill are downloaded. Here's what's included:

**Core docs:** `SKILL.md` (the main guide with the 4-phase workflow), `LICENSE.txt`

**Reference guides:** `mcp_best_practices.md`, `node_mcp_server.md` (TypeScript), `python_mcp_server.md`, `evaluation.md`

**Evaluation scripts:** `evaluation.py` (the harness), `connections.py` (stdio/SSE/HTTP transport handlers), `requirements.txt`, `example_evaluation.xml`

## human — 2026-04-21 14:13:43

How do I access it on here

## assistant — 2026-04-21 14:13:51

 The mcp-builder skill is a development reference/template — it's not something you "access" as a running tool in this chat. It's a collection of docs and scripts you'd use locally to **build your own MCP server**.

Here's how you'd actually use it:

1. **The docs** (SKILL.md, the reference guides) are guides you read while building — they walk you through project structure, tool patterns, TypeScript vs Python implementation, etc.

2. **The evaluation scripts** (`evaluation.py`, `connections.py`) you'd run locally against an MCP server you've built, to test how well an LLM can use it.

If what you're asking is how to **use an MCP server inside Claude.ai** — you'd connect one via Settings → Integrations (or Connectors), where you can add MCP server URLs. You're already connected to Google Drive, ClickUp, and Ruflo that way.

Is there something specific you're trying to do — build a new MCP server, or connect an existing one?
