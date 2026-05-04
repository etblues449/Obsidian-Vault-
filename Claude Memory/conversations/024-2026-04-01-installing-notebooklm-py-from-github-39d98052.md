---
name: Installing notebooklm-py from GitHub
description: Imported Claude.ai conversation from 2026-04-01 (22 messages)
type: reference
uuid: 39d98052-5433-4b61-976c-09fef6c2ef00
created_at: 2026-04-01T03:21:26.269842Z
updated_at: 2026-04-01T03:34:43.990136Z
---

# Installing notebooklm-py from GitHub

## human — 2026-04-01 03:21:27

Install https://github.com/teng- gith lin/notebooklm-py

## assistant — 2026-04-01 03:21:39


```
This block is not supported on your current device yet.
```

Just to clarify — "install" in what sense? Are you looking to:
```
This block is not supported on your current device yet.
```

Also — the URL you pasted looks like it may have a typo (`teng- gith lin`). Did you mean `tenggithlin` as one word, or a different username?

## human — 2026-04-01 03:21:54

Q: What do you want to do with this repo?
A: Clone it into my Home Assistant / local environment

## assistant — 2026-04-01 03:21:56

 What's the correct GitHub URL? The one you pasted had spaces in the username (`teng- gith lin`) — can you double-check and paste the full link again?

## human — 2026-04-01 03:23:06

https://github.com/teng-lin/notebooklm-py

## assistant — 2026-04-01 03:23:19


```
This block is not supported on your current device yet.
```

Before cloning, worth knowing: this is an unofficial Python library for Google NotebookLM — it uses undocumented Google APIs and requires browser-based Google login (`notebooklm login`) to authenticate. It won't work headlessly without a browser session.

**In your HA Terminal add-on**, run these commands one at a time:

**1. Clone the repo:**
```
git clone https://github.com/teng-lin/notebooklm-py /config/notebooklm-py
```

**2. Install it (with browser login support):**
```
pip install "notebooklm-py[browser]" --break-system-packages
```

**3. Install Chromium for Playwright:**
```
playwright install chromium
```

⚠️ Step 3 may fail on HA — there's a known Linux issue with Playwright. If you get `TypeError: onExit is not a function`, let me know and we'll work around it.

Once installed, you'd run `notebooklm login` which opens a browser for Google auth — that part will need to be done from a machine with a display, not headlessly in HA. Do you want to proceed, or is this more of an exploratory install?

## human — 2026-04-01 03:27:00

What's browser login support):

## assistant — 2026-04-01 03:27:03

 It installs `playwright` — a browser automation library — alongside the package. When you run `notebooklm login`, it launches a real Chromium browser window so you can sign into your Google account. It then saves your session cookies locally so future commands work without logging in again.

Without it, there's no way to authenticate with Google.

## human — 2026-04-01 03:27:48

What do I add in the brackets

## assistant — 2026-04-01 03:27:52

 `notebooklm-py[browser]` — the `[browser]` part is pip's "extras" syntax. It tells pip to install the package plus an additional set of optional dependencies, in this case `playwright` and anything else needed for browser login.

So the full command is just:
```
pip install "notebooklm-py[browser]" --break-system-packages
```

You type it exactly as shown — brackets and all.

## human — 2026-04-01 03:28:45
_files:_ 106776.jpg

_(empty)_

## assistant — 2026-04-01 03:28:48

 `pip` isn't available in the HA Terminal. Try `pip3` instead:

```
pip3 install "notebooklm-py[browser]" --break-system-packages
```

If that also fails, try:

```
python3 -m pip install "notebooklm-py[browser]" --break-system-packages
```

## human — 2026-04-01 03:29:58
_files:_ 106778.jpg

_(empty)_

## assistant — 2026-04-01 03:30:02

 Python isn't installed in the HA Terminal add-on's shell environment. You need to install it from within the HA Terminal add-on shell first:

```
apk add python3 py3-pip
```

Then retry the pip install after that completes.

## human — 2026-04-01 03:31:46
_files:_ 106782.jpg

_(empty)_

## assistant — 2026-04-01 03:31:51

 Playwright version conflict. Try installing without the browser extra first:

```
pip3 install notebooklm-py
```

The browser login feature likely won't work headlessly in HA anyway — you'd need to authenticate from a PC with a browser. The core package should still install fine.

## human — 2026-04-01 03:32:32
_files:_ 106784.jpg

_(empty)_

## assistant — 2026-04-01 03:32:35

 Use a virtual environment. Run these one at a time:

```
python3 -m venv /config/notebooklm-venv
```
```
source /config/notebooklm-venv/bin/activate
```
```
pip install notebooklm-py
```

## human — 2026-04-01 03:33:51
_files:_ 106786.jpg

_(empty)_

## assistant — 2026-04-01 03:33:56

 Installed successfully. You can see `notebooklm-py-0.3.4` in the list and the venv prompt `(notebooklm-venv)` is active.

Now try:
```
notebooklm --help
```

That'll confirm the CLI is working.

## human — 2026-04-01 03:34:38
_files:_ 106788.jpg

_(empty)_

## assistant — 2026-04-01 03:34:43

 CLI is fully working. Next step is authentication — but as mentioned, `notebooklm login` opens a browser window which won't work in HA Terminal.

You'll need to run the login from your PC instead. Do you have Python installed on your PC, or would you prefer to handle auth a different way?
