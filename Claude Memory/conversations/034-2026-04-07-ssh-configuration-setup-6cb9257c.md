---
name: SSH configuration setup
description: Imported Claude.ai conversation from 2026-04-07 (4 messages)
type: reference
uuid: 6cb9257c-c22f-46a1-9260-38d7f323ac11
created_at: 2026-04-07T22:49:53.356540Z
updated_at: 2026-04-26T21:34:06.180853Z
---

# SSH configuration setup

## human — 2026-04-07 22:49:54

ssh:
  username: hassio
  password: ""
  authorized_keys: []
  Advanced SSH & Web Terminal

sftp: false
  compatibility_mode: false
  allow_agent_forwarding: false
  allow_remote_port_forwarding: false
  allow_tcp_forwarding: false
zsh: true
share_sessions: false
packages: []
init_commands: []

## assistant — 2026-04-07 22:49:56

 That's your SSH & Web Terminal add-on config. What do you want to do with it?

## human — 2026-04-07 22:50:49
_files:_ 107875.jpg

_(empty)_

## assistant — 2026-04-07 22:50:53

 The add-on won't start because there's no SSH password set. In your config, `password: ""` is blank.

Fix: go to **Configuration** tab and set a password:

```yaml
ssh:
  username: hassio
  password: "yourpasswordhere"
```

Save, then restart the add-on. That's all it needs.
