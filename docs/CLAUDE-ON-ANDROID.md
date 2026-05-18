# Claude Code on Android — vault setup

This is the on-device setup guide for running Claude Code inside Termux on
your phone with this Obsidian vault wired in. It wraps the upstream
[ferrumclaudepilgrim/claude-code-android](https://github.com/ferrumclaudepilgrim/claude-code-android)
installer with vault-specific configuration.

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
5. Add `$OBSIDIAN_VAULT`, `cdv`, and `claude-vault` to `~/.bashrc`.
6. Configure `git user.name` / `user.email` inside the vault if not set.

After it finishes, open a new shell and run:

```bash
claude-vault
```

This `cd`s into the vault and launches Claude Code with `CLAUDE.md` already
in place.

## What gets persisted

- `~/.bashrc`: `OBSIDIAN_VAULT`, `cdv`, `claude-vault` aliases.
- Vault `CLAUDE.md`: project conventions (wikilinks, folder layout, secrets
  rule, mobile workflow).
- Vault `.git/config`: per-repo `user.name` / `user.email` you supply
  during install.

Nothing in `.obsidian/` is touched — your existing per-device Obsidian
settings stay untouched.

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
