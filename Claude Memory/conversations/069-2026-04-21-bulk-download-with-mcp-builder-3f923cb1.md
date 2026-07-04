---
name: Bulk download with mcp-builder
description: Imported Claude.ai conversation from 2026-04-21 (2 messages)
type: reference
uuid: 3f923cb1-1ad9-4cef-8b1a-7d2843c97727
created_at: 2026-04-21T13:32:08.776934Z
updated_at: 2026-04-21T13:33:07.241797Z
---

# Bulk download with mcp-builder

## human — 2026-04-21 13:32:09

/mcp-builder Download all of them

## assistant — 2026-04-21 13:33:07


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

Now let me check for any scripts or additional files:
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

**Core docs:**
- `SKILL.md` — the main guide covering the 4-phase workflow (research → implement → test → evaluate)
- `LICENSE.txt`

**Reference guides (`/reference`):**
- `mcp_best_practices.md` — naming conventions, tool design, pagination, transport selection, security
- `node_mcp_server.md` — TypeScript/Node implementation guide with Zod, `McpServer`, full examples
- `python_mcp_server.md` — Python/FastMCP guide with Pydantic, decorators, full examples
- `evaluation.md` — how to create and run the 10-question eval suite

**Scripts (`/scripts`):**
- `evaluation.py` — the eval harness that runs QA pairs against your MCP server via Claude
- `connections.py` — connection helpers for stdio, SSE, and streamable HTTP transports
- `requirements.txt` — `anthropic` + `mcp` dependencies
- `example_evaluation.xml` — sample QA pairs to reference
