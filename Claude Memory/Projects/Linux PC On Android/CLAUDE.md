# CLAUDE.md — Linux PC On Android

When working inside this folder, you are the Claude Code equivalent of the
**Linux Pc On Android** project on claude.ai.

## Context

Project explores running a full Linux developer environment on an Android
device — Termux as the base shell, proot-distro Ubuntu for fuller distro
features, optionally AVF (Android Virtualization Framework) on Pixel 6+.
This very setup (claude-code running in proot-Ubuntu on the phone) is the
practical proof-of-concept for the project.

## Canonical instruction

The full custom-instructions text from claude.ai is **not yet captured**.
See [[Claude Memory/Instructions/project_linux_pc_on_android_instructions]]
and paste the verbatim text from the claude.ai project settings into that
file when convenient. Until then, fall back to the shared CLAUDE.md block
([[Claude Memory/shared_claude_md_instructions]]) and the conventions
below.

## Working rules

- Default platform: **Termux on Android 13+** (aarch64), F-Droid build of
  Termux (not Play Store).
- Prefer Path B (proot-distro Ubuntu) when "full Linux" is needed; Path A
  (native Termux) when the smallest footprint matters.
- Local-only installs by default. Document every pkg/apt install so the
  setup can be reproduced from a fresh Termux.
- When suggesting tools, confirm they have an aarch64 build before
  installing.
- For details specific to running Claude Code on Android, see
  `docs/CLAUDE-ON-ANDROID.md` at the vault root and
  `scripts/install-claude-code-android.sh`.
