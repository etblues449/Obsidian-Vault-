# Obsidian CLI — setup

Everything needed to make the `obsidian:obsidian-cli` skill actually work, on the
Windows PC and inside an ephemeral Claude cloud session.

Set up and verified 2026-09-03. Obsidian 1.13.7.

## The one thing to understand

The Obsidian CLI is **a client, not a program that reads your vault**. It opens a
socket to a *running* Obsidian desktop app and asks it to do things. There is no
server-less mode, no "point it at a folder" mode. Which means:

- Obsidian desktop **1.12.7 or newer** must be installed, and
- it must be **running** when a command fires.

That is the whole reason this folder exists. On the PC it is two toggles. In a
headless container it means installing the real Electron app and giving it a
virtual screen to draw on.

`obsidian help` is always the authoritative command list. Full docs:
<https://help.obsidian.md/cli>

---

## Windows PC

### Fast route (GUI, ~30 seconds)

1. Obsidian → **Settings → General → Advanced**
2. Turn on **Command line interface**
3. Accept the **"Set up CLI to work in the terminal"** prompt
4. **Open a new terminal** — the PATH change does not reach terminals that were
   already open
5. Check:

   ```powershell
   obsidian version
   obsidian vaults
   ```

### Scripted route

```powershell
# report only — changes nothing
powershell -ExecutionPolicy Bypass -File .\Setup-ObsidianCli.ps1

# apply the fixes (close Obsidian first — it rewrites obsidian.json on exit)
powershell -ExecutionPolicy Bypass -File .\Setup-ObsidianCli.ps1 -Fix
```

It finds the install, checks the installer is 1.12.7+, checks the `Obsidian.com`
redirector exists, sets `"cli": true` in `%APPDATA%\obsidian\obsidian.json`
(backing the file up first), adds the install folder to the **user** PATH, then
starts Obsidian and proves the CLI answers. No admin rights needed.

Tests for it — they run on any machine with PowerShell 7, Obsidian not required:

```powershell
pwsh -NoProfile -File .\Test-SetupObsidianCli.ps1
```

### What the app itself does on each platform

Useful when something is off and you want to know what "register" actually means:

| Platform | CLI reached via | PATH registration | IPC |
|---|---|---|---|
| Windows | `Obsidian.com` redirector in the install folder | install dir appended to the **User** `Path` | named pipe `\\.\pipe\obsidian-cli-<username>` |
| macOS | `Obsidian.app/Contents/MacOS/obsidian-cli` | symlink `/usr/local/bin/obsidian` (admin prompt) | `$HOME/.obsidian-cli.sock` |
| Linux | `/opt/Obsidian/obsidian-cli` | copied to `~/.local/bin/obsidian` | `$XDG_RUNTIME_DIR/.obsidian-cli.sock`, else `$HOME/.obsidian-cli.sock` |

The **Command line interface** toggle is stored as `"cli": true` at the top level
of `obsidian.json` (`%APPDATA%\obsidian\` on Windows, `~/.config/obsidian/` on
Linux). Nothing more magic than that — which is what lets both scripts here set
it without touching the GUI.

---

## Claude cloud session (headless Linux)

The container is reclaimed after inactivity, so this has to be re-run per session.
One command:

```bash
bash Scripts/obsidian-cli/bootstrap-obsidian-cli.sh
obsidian version          # -> 1.13.7 (installer 1.13.7)
```

What it does, idempotently:

1. Installs Obsidian 1.13.7 (`.deb` + Electron dependencies) and Xvfb if absent
2. Clones this vault to `/root/vaults/Obsidian-Vault-` (or fast-forwards it)
3. Writes `~/.config/obsidian/obsidian.json` with the vault registered and
   `"cli": true`
4. Installs `obsidian-headless-start` and a CLI wrapper on PATH
5. Starts Obsidian on a virtual display and waits until the socket answers
6. Prints version, vault name and indexed file count

Full suite (20 checks, creates and removes its own scratch note):

```bash
bash Scripts/obsidian-cli/verify-obsidian-cli.sh
```

### Three things that will bite you here

**`obsidian` on PATH must be the CLI, not the app.** The `.deb` puts the 220 MB
Electron binary at `/usr/bin/obsidian`. The CLI is a separate 18 KB binary at
`/opt/Obsidian/obsidian-cli`. The wrapper goes in `~/.local/bin`, which precedes
`/usr/bin`, so it shadows the app — the same layout the app's own Linux
registration produces.

**`XDG_RUNTIME_DIR` has to agree on both sides.** The socket path is
`$XDG_RUNTIME_DIR/.obsidian-cli.sock`, falling back to `$HOME/.obsidian-cli.sock`.
Containers hand out an inconsistent `XDG_RUNTIME_DIR` between shells, so the app
creates the socket in one place and the CLI looks in another — the symptom is
`The CLI is unable to find Obsidian` while the app is plainly running. Both the
launcher and the wrapper unset the variable, pinning the socket to
`$HOME/.obsidian-cli.sock`.

**Electron segfaults if it beats the X server to the finish line.** The launcher
waits for `/tmp/.X11-unix/X99` to exist rather than sleeping a fixed interval,
and retries the app up to three times.

### Safety: the container must not become a second git writer

`obsidian-git` is enabled in this vault with `autoSaveInterval: 10`,
`autoPushInterval: 10`, `autoPullOnBoot: true` and `disablePush: false`. A
headless instance that loaded it would be an unattended client committing and
pushing to `master` every ten minutes — the same shape as the still-open
"identify the client that deleted 8 files from master" item in the capture queue.

Obsidian opens a vault it has not seen before in **Restricted Mode**, so
community plugins stay off and `obsidian-git` never starts. Verified here:
`app.plugins.plugins` was empty and the clone stayed 0 commits ahead of origin.
The bootstrap does not rely on that holding — it asserts it, and calls
`app.plugins.disablePlugin()` on anything risky that did load. That is the
runtime-only call; the `...AndSave` variant would rewrite
`.obsidian/community-plugins.json` and end up in a commit.

If you ever click "Trust author and enable plugins" in a container, re-run the
bootstrap afterwards.

### Side effect worth knowing

Opening the vault makes the Daily Notes core plugin create today's note
(`JARVIS/DD-MM-YYYY.md`). The bootstrap deletes it again if it is empty and
untracked, so it never lands in a commit. `.obsidian/workspace.json` is local UI
state and is gitignored.

---

## Android / Termux

Not possible, and not worth chasing. The CLI ships inside the desktop Electron
app; the Android build has no CLI and Termux cannot run the desktop app. On the
Fold, the equivalents already in this vault are:

- the **Advanced URI** plugin (`obsidian://adv-uri?...`) for scripted actions
- the **claude-code-bridge** plugin
- plain `git` on the vault, then let the desktop or mobile app reconcile

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `The CLI is unable to find Obsidian` | app not running, or socket path mismatch | start Obsidian; on Linux confirm `$HOME/.obsidian-cli.sock` exists and that `XDG_RUNTIME_DIR` is unset in both shells |
| `Command line interface is not enabled` | `"cli"` missing from `obsidian.json` | Settings → General → Advanced, or `-Fix` / the bootstrap |
| `obsidian` opens the GUI instead of running a command | PATH is hitting the Electron binary | make sure `~/.local/bin` (Linux) or the install dir with `Obsidian.com` (Windows) comes first |
| Command not found after enabling the toggle | PATH change not picked up | open a **new** terminal |
| Segfault on launch in a container | X server not ready | use `obsidian-headless-start`, which waits for the display socket |
| Everything works, vault looks empty | wrong vault targeted | `obsidian vaults`, then prefix commands with `vault="Obsidian-Vault-"` |

Logs in a cloud session: `/var/log/obsidian/app.log`, `/var/log/obsidian/xvfb.log`.

---

## Quick reference

```bash
obsidian read path="Claude Memory/MEMORY.md"
obsidian create name="New Note" content="# Hello" template="Template" silent
obsidian append file="My Note" content="New line"
obsidian search query="JARVIS" limit=10
obsidian tags sort=count counts
obsidian backlinks file="MEMORY" counts
obsidian orphans total
obsidian daily:read
obsidian daily:append content="- [ ] New task"
obsidian tasks daily todo
obsidian property:set name="status" value="done" file="My Note"
obsidian commands filter=workspace
obsidian command id="editor:toggle-fold"
obsidian eval code="app.vault.getMarkdownFiles().length"
obsidian dev:screenshot path=shot.png
obsidian dev:errors
```

Targeting: `file=` resolves like a wikilink (no path, no extension), `path=` is
exact from the vault root, `vault=` must come first when present. `\n` and `\t`
work inside `content=`. `--copy` puts the output on the clipboard. `silent` stops
files opening. `total` turns a list command into a count.



---

## Windows — verified on the PC, 2026-09-03

Status: **working.** `Setup-ObsidianCli.ps1` reports all checks passed;
`Test-SetupObsidianCli.ps1` is 33/33 on Windows PowerShell 5.1.

| | |
|---|---|
| Install | `%LOCALAPPDATA%\Programs\Obsidian` — the per-user NSIS location |
| CLI entry point | `Obsidian.com` in that folder |
| PATH | install dir appended to the **User** `Path` |
| CLI toggle | `"cli": true` in `%APPDATA%\obsidian\obsidian.json` |
| PowerShell | 5.1 only on this machine (no `pwsh` 7) |

### Two traps this machine walked straight into

**The install is in `Programs\Obsidian`, not `Obsidian`.** An earlier version of
the setup script looked in `%LOCALAPPDATA%\Obsidian` and reported "Obsidian not
found" on a completely normal install. It now checks the real roots first, then
the running process, then the uninstall registry. Related: `Join-Path` throws on
a null root and is evaluated *before* any filter placed after it, so the null
guard for `ProgramFiles(x86)` has to sit on the base, not the joined result.

**PowerShell 5.1 reads and writes with the ANSI codepage by default — and that
corrupts vault paths.** This vault is `Jelly Bean's Vault — primary`, with an
em dash. A naive `Get-Content -Raw` → edit → `Set-Content` round-trip mangles
it, Obsidian can no longer find the vault, and it opens the vault picker
instead; `obsidian version` then answers `Vault not found.` rather than anything
that points at encoding. The script now forces real UTF-8 on **both** sides
(`[System.IO.File]::ReadAllText` / `WriteAllText` with `UTF8Encoding($false)` —
no BOM, since a BOM breaks Obsidian's JSON parse), and there is a regression
test that round-trips a path containing an em dash.

This generalises: any script on this machine that edits a JSON or config file
containing non-ASCII must force UTF-8 explicitly. Do not rely on the PS 5.1
default.

**`-Fix` takes a backup first** (`obsidian.json.bak`), which is what made the
above recoverable — restore it, re-apply with correct encoding, and check the
vault paths match the backup before trusting the result.

