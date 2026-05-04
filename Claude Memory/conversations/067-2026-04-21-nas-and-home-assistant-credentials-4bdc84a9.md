---
name: NAS and Home Assistant credentials
description: Imported Claude.ai conversation from 2026-04-21 (2 messages)
type: reference
uuid: 4bdc84a9-e4e4-444b-b046-bbb2c70c26c0
created_at: 2026-04-21T09:04:03.302712Z
updated_at: 2026-04-21T09:04:14.790203Z
---

# NAS and Home Assistant credentials

## human — 2026-04-21 09:04:04
_files:_ 111928.jpg

claude/setup-nas-home-assistant-gWjd9

What was the credentials for this

## assistant — 2026-04-21 09:04:14


```
This block is not supported on your current device yet.
```

From that conversation, the NAS share credentials that were being used for the HA network storage were:

- **Server:** `192.168.0.182` (your Windows PC, ElliotHorton)
- **Protocol:** Samba/Windows (CIFS)
- **Username:** `ElliotHorton`
- **Password:** your Windows login password
- **Share:** `frigate`

The screenshot you've shared is the HA "Add network storage" dialog — so fill it in with those details. If the Windows login password has changed since then, that would be the one to check.

If it's the NAS at `192.168.0.215` you're trying to connect (rather than the PC share), you'd use the NAS admin credentials and its share name instead — do you want to set that up?
