---
name: Adding ComposioHQ skills with NPX
description: Imported Claude.ai conversation from 2026-04-14 (2 messages)
type: reference
uuid: 2891f96e-5392-4b0b-b0d2-74b4c6e019f1
created_at: 2026-04-14T22:02:19.631871Z
updated_at: 2026-04-14T22:06:28.541351Z
---

# Adding ComposioHQ skills with NPX

## human — 2026-04-14 22:02:19

add npx skills add composiohq/skills

## assistant — 2026-04-14 22:06:28


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

It looks like the Filesystem MCP server isn't responding right now, so I can't browse your local file structure to find the skills directory directly.

To add the `composiohq/skills` package, could you let me know:

1. **Where is your skills directory located?** (e.g. `~/skills`, `~/projects/skills`, etc.)
2. **Does a `package.json` already exist there**, or would this be a fresh setup?

Once I know the path, I can run the correct `npx skills add composiohq/skills` command in that directory. Alternatively, if you can share the path or open a terminal there, you can run:

```bash
npx skills add composiohq/skills
```

Also, you may want to check that your local MCP servers are running — the Filesystem tool timed out, which may affect other local operations too.
