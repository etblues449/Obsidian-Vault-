# Claude Code on Android — vault setup

This is the on-device setup guide for running Claude Code inside Termux on
your phone with this Obsidian vault wired in. It wraps the upstream
[ferrumclaudepilgrim/claude-code-android](https://github.com/ferrumclaudepilgrim/claude-code-android)
installer with vault-specific configuration.

## Two tools, one phone

| Tool | What it gives you | When to use |
|------|-------------------|-------------|
| **claude.ai PWA** (this section) | The full web chat UI — Projects, Artifacts, Design, voice, image input | Daily driver. Conversations, drafting, asking questions. |
| **Claude Code in Termux** (rest of this doc) | A TUI agent that reads/writes files, runs shell commands, edits the vault | When you want it to *do* something hands-on in the vault. |

They share your Claude Max account; conversations don't sync between them.

### Install claude.ai as a phone app (30 seconds)

This is the most "web-like" experience on the phone — it _is_ the web,
installable to your home screen as a PWA.

1. Open `https://claude.ai` in **Chrome** on Android.
2. Tap the **⋮** menu (top-right).
3. Tap **Add to Home screen** (some Chrome versions show **Install app**).
4. Confirm. An icon appears on your home screen; tapping it launches
   claude.ai fullscreen with no browser chrome.

The PWA carries your account session, starred projects (Faceless Finance,
Studying, Debt, Smart Home), recent chats, model picker, voice input.
This is your "goto app".

### Keep CLI and web in sync

Your projects from claude.ai are mirrored in this vault as folders under
`Claude Memory/Projects/`. Each folder has a `CLAUDE.md` that links back
to its custom-instructions file in `Claude Memory/Instructions/`:

| claude.ai project | Vault folder | Launcher |
|---|---|---|
| Faceless Finance | `Faceless Finance/` | `claude-faceless` |
| Smart Home | `Smart Home/` | `claude-smarthome` |
| Studying | `Studying/` | `claude-studying` |
| Debt | `Debt/` | `claude-debt` |
| skills | `Skills/` | `claude-skills` |
| Linux Pc On Android | `Linux PC On Android/` | `claude-linuxpc` |
| Select Website | `Select Website/` | `claude-website` |
| Doc to Learning (Notebook lm) | `Doc to Learning/` | `claude-d2l` |

When you change the instructions on claude.ai, mirror the change into the
corresponding `Instructions/project_*_instructions.md` note and the CLI
picks it up next session.

### What does NOT sync between the PWA and the CLI

Be aware of these product boundaries:

- **Chat history.** Your past conversations on claude.ai live on
  Anthropic's servers. The CLI has no API to read them. If you need a
  past chat, open the PWA.
- **Project knowledge files.** PDFs, statements, and uploads attached to
  claude.ai Projects are server-side. Mirror anything important into the
  matching `Claude Memory/Projects/<name>/` folder.
- **claude.ai/code Sessions.** That's a *separate* Anthropic product
  (cloud-hosted Claude Code that operates on GitHub repos). The local
  CLI is a different thing — same brand, different surface.
- **Account-level Memory** (the bullet-point summary on claude.ai). We
  point the CLI at `Claude Memory/MEMORY.md` to give it the equivalent;
  refresh that file by hand when claude.ai memory changes.

---

## Prerequisites

- aarch64 Android device, Android 13+ (older versions work; see upstream
  FAQ for OAuth caveats on Android 8/9).
- **Termux from F-Droid** (the Play Store build is from 2020 and will not
  work).
- Active Claude subscription (Pro / Max / Team / Enterprise / Console).

## Install paths

| Path | Use when |
|------|----------|
| **B — proot-Ubuntu (default)** | You want a full Linux env (apt, ssh, etc.). ~2 GB disk. |
| **A — native Termux** | You want the smallest footprint. ~50 MB disk. |

Both paths pin Claude Code to **2.1.112**. Empirically, 2.1.113+ probes
the host kernel even from inside proot-Ubuntu, sees `android arm64`, and
fails to download a native binary (no such build is published). 2.1.112
was the last release that shipped pure JS and runs anywhere Node runs.
Track [anthropics/claude-code#50270](https://github.com/anthropics/claude-code/issues/50270)
for when this changes.

## One-line install on the phone

In Termux:

```bash
curl -fsSL https://raw.githubusercontent.com/etblues449/Obsidian-Vault-/claude/github-claude-code-integration-g8mhE/scripts/install-claude-code-android.sh -o setup.sh
bash setup.sh                # default: Path B
# or:
bash setup.sh path-a         # native Termux pinned install
```

The script will:

1. Verify Termux + aarch64.
2. Request shared-storage access (`termux-setup-storage`) so the vault can
   live under `~/storage/shared/Documents/`.
3. Install Claude Code via the path you chose.
4. Prompt for the vault location (default
   `~/storage/shared/Documents/Obsidian-Vault-`). Offer to clone it for you
   if missing.
5. Add `$OBSIDIAN_VAULT` plus the launcher functions below to `~/.bashrc`.
6. Configure `git user.name` / `user.email` inside the vault if not set.
7. Deploy `~/.claude/CLAUDE.md` (global memory / shared instructions
   pointer) and `~/.claude/mcp.json` (Stitch MCP — uses `$STITCH_API_KEY`,
   never the literal key) inside the runtime.

After it finishes, open a new Termux shell. The launchers mirror the
starred projects in your claude.ai sidebar:

| Command | What it does |
|---|---|
| `claude-vault` | cd to vault root, launch claude (general vault work) |
| `claude-faceless` | Faceless Finance project |
| `claude-smarthome` | Smart Home project |
| `claude-studying` | Studying project |
| `claude-debt` | Debt (marital debt paralegal) project |
| `claude-skills` | skills project ("install each link i give you") |
| `claude-linuxpc` | Linux PC On Android project |
| `claude-website` | Select Website project |
| `claude-d2l` | Doc to Learning (Notebook lm) project |
| `claude-resume` | resume an earlier session from this vault |
| `cdv` | just cd to the vault, no claude |

Inside Path B, each function enters proot-Ubuntu with the vault
bind-mounted automatically.

## What gets persisted

On the device:

- `~/.bashrc` (Termux): `OBSIDIAN_VAULT` + launcher functions.
- `~/.claude/CLAUDE.md` (inside Ubuntu for Path B, Termux home for Path A):
  the global memory file — pointers to `Claude Memory/MEMORY.md`, the
  shared instructions, and the project CLAUDE.md routing table.
- `~/.claude/mcp.json` (same location): MCP server config. Stitch entry
  uses `${STITCH_API_KEY}`, so you set the key in the shell rc once and
  it's read at session start. Never commit the literal key.

In the vault (already committed via PR #12):

- Root `CLAUDE.md`: vault conventions.
- `Claude Memory/Projects/<project>/CLAUDE.md` for each of the 4 starred
  projects.

Nothing in `.obsidian/` is touched — your existing per-device Obsidian
settings stay untouched.

## Setting the Stitch key on the phone

Before the MCP server works, set the env var in the runtime's shell rc:

```bash
# Path B (inside proot-Ubuntu):
proot-distro login ubuntu
echo 'export STITCH_API_KEY=PASTE-KEY-HERE' >> /root/.bashrc

# Path A (native Termux):
echo 'export STITCH_API_KEY=PASTE-KEY-HERE' >> ~/.bashrc
```

If the key is ever rotated, update only this one place — `mcp.json`
stays the same.

## Updating Claude Code

Both paths are deliberately pinned to 2.1.112 and chmod-locked against the
in-process auto-updater. Don't run `npm install -g @anthropic-ai/claude-code`
without a version pin — upgrading to 2.1.113+ breaks claude on android-arm64
(see issue #50270 above). When upstream restores the platform binary, bump
`CC_PIN` in `scripts/install-claude-code-android.sh` and re-run.

## Working in proot-Ubuntu (Path B)

The vault lives in Termux's shared storage (`~/storage/shared/...`), which
is **not** visible inside proot-Ubuntu by default. The installer wires up
a `claude-vault` alias that handles this automatically:

```bash
# Inside Termux (not inside Ubuntu):
claude-vault
```

That expands to:

```bash
proot-distro login ubuntu \
  --bind "$HOME/storage:/root/storage" \
  -- bash -lc "cd \"$OBSIDIAN_VAULT\" && claude"
```

If you want a regular Ubuntu shell with the vault visible:

```bash
proot-distro login ubuntu --bind "$HOME/storage:/root/storage"
```

## Troubleshooting

- `aarch64 required` — your device is 32-bit. Claude Code will not work.
- `pkg update` hangs — `termux-change-repo`, pick a different mirror,
  re-run.
- Claude prints an OAuth URL but no browser opens — copy/paste it into
  Chrome manually. Documented in upstream FAQ.
- Path B disk usage scares you — Path A is ~50 MB but pinned to 2.1.112.
- `Error: claude native binary not installed.` (Path B) — the postinstall
  hook didn't run. Recover inside the Ubuntu rootfs:
  ```bash
  proot-distro login ubuntu
  INSTALL_CJS=$(find / -path "*@anthropic-ai/claude-code/install.cjs" 2>/dev/null | head -1)
  node "$INSTALL_CJS"
  claude --version
  ```
  If that still fails, reinstall via npm: `apt install -y nodejs npm && npm install -g @anthropic-ai/claude-code`. The current installer uses this npm path by default to avoid the issue.
