---
name: Mench GitLab repository
description: Imported Claude.ai conversation from 2026-04-18 (4 messages)
type: reference
uuid: 8b6d2b76-5a66-463a-9f7c-82bc49d8902a
created_at: 2026-04-18T19:19:07.482271Z
updated_at: 2026-04-18T20:52:53.163199Z
---

# Mench GitLab repository

## human — 2026-04-18 19:19:08

https://gitlab.com/artibus1/mench.git

## assistant — 2026-04-18 19:19:35


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

Here's a summary of the **mench** repository:

**What it is:** A personal dotfiles/configuration repository by "Linux Mench" (artibus1), containing setup files for multiple Linux distros and BSDs, paired with a YouTube channel showing them in action.

**Directory breakdown:**
- `arch/` — Arch Linux configs (most complete: install guides, wallpapers, encryption setup, dual-boot, etc.)
- `Debian/`, `Devuan/`, `MX/` — Debian-family configs
- `LinuxMint-Debian/`, `LinuxMint-Ubuntu/` — Linux Mint variants
- `NixOS/` — NixOS configuration including a `configuration.nix`
- `void/` — Void Linux configs
- `freebsd/`, `ghostbsd/`, `Openbsd/` — BSD configs

**What each distro folder typically contains:**
- `autoapp.sh` — installs all preferred packages
- `runconfigs.sh` / `runconfigsbasic.sh` — copies config files into place
- Window manager configs: **Awesome**, **i3**, **qtile**, **dwm**, **spectrwm**
- `vimrc`, `i3status`, `network.conf`, wallpapers

**How to use it** (per the README):
1. Install `git`, clone the repo
2. Optionally run `autoapp.sh` to install packages
3. Run `runconfigs.sh` to copy configs to your home directory
4. Log out/in to apply changes

Is there something specific you'd like to do with this repo — review a particular config, modify scripts, or something else?

## human — 2026-04-18 20:52:39

How to get my Samsung phone to recognise oat usb

## assistant — 2026-04-18 20:52:53


```
This block is not supported on your current device yet.
```

Here's a step-by-step troubleshooting guide:

**1. Check OTG support**
First confirm your Samsung model actually supports OTG. You can install the **USB OTG Checker** app — it scans your device and tells you straight away if OTG is supported.

**2. Enable OTG in Settings**
Many devices have an OTG setting that needs to be turned on. When you connect the device you may see an "Enable OTG" alert — tap it to turn it on.

**3. Check the adapter/cable**
If your USB drive doesn't have a USB-C connector, you'll need a Type-A to Type-C OTG adapter to plug it into your Galaxy phone. A faulty or poor-quality adapter can cause the phone to only charge and not recognize the USB connection.

**4. Check the drive format**
If no notification appears after connecting, it may be due to the USB drive using an incompatible file system. FAT32 or exFAT are the most compatible formats — you can reformat the drive on a PC if needed.

**5. Restart the phone**
Press and hold the power key and select Restart — this eliminates many common issues.

**6. Enable USB Debugging (if still not working)**
Go to Settings → About Phone → Software Info, tap **Build Number** seven times to activate Developer Options, then go to Developer Options and enable **USB Debugging**.

**7. Clean the port**
Check the port for dust or lint. Do NOT use a metal pin — try a vacuum cleaner first, or very gently use a wooden toothpick.

**8. Update your phone**
Updating to the latest Android version includes security patches and bug fixes that may help the device detect USB drives.

If none of the above work, the port may be physically damaged and a Samsung service centre visit would be the next step.
