---
name: Home Assistant visibility
description: Imported Claude.ai conversation from 2026-04-08 (4 messages)
type: reference
uuid: 48be155a-f007-4283-9b03-9d704f7df9f1
created_at: 2026-04-08T03:28:19.722614Z
updated_at: 2026-04-08T03:29:55.801756Z
---

# Home Assistant visibility

**Summary:** **Conversation Overview**

The person is attempting to connect Claude to their Home Assistant instance via a Nabu Casa remote access integration. The conversation consisted of two brief connection attempts. Claude tried to reach Home Assistant using the `ha_get_overview` tool on both occasions but received a `getaddrinfo failed` DNS resolution error each time, indicating the Nabu Casa hostname could not be resolved.

Claude provided troubleshooting guidance, suggesting the person verify that Nabu Casa remote access is enabled in Home Assistant's Cloud settings, confirm the HA instance is online, and check the Nabu Casa service status page. The issue remained unresolved at the end of the conversation.

**Tool Knowledge**

The Home Assistant integration uses `ha_get_overview` as the initial connectivity check. When this tool returns a `getaddrinfo failed` error, it indicates a DNS-level failure to resolve the Nabu Casa hostname — meaning the remote access tunnel is either disabled or the Nabu Casa service itself is unavailable — rather than an authentication or configuration issue with the tool itself. This error occurs before any HA data can be retrieved. Retrying immediately without addressing the underlying connectivity issue produces the same error.

## human — 2026-04-08 03:28:20

can you see home assistant

## assistant — 2026-04-08 03:28:44


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

Not right now — getting a connection error. It looks like the Nabu Casa URL isn't resolving at the moment. A few things to check:

- Is Home Assistant running and online?
- Is your Nabu Casa remote access enabled? (Settings → Home Assistant Cloud)
- Any recent restarts or network changes?

If it was working before and just stopped, a quick HA restart or toggling remote access off/on in the Cloud settings usually fixes it.

## human — 2026-04-08 03:29:41

go

## assistant — 2026-04-08 03:29:55


```
This block is not supported on your current device yet.
```

Still the same connection error — `getaddrinfo failed` means it can't resolve the Nabu Casa hostname at all. This is usually one of:

1. **Nabu Casa remote access is off** — check Settings → Home Assistant Cloud → Remote Access is enabled
2. **HA is offline** — is the machine/VM it runs on up?
3. **Nabu Casa service issue** — check [status.nabucasa.com](https://status.nabucasa.com)

Once it's reachable, just say "go" again.
