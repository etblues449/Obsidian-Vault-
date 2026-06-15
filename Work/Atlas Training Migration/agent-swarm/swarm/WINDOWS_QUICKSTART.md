# Windows Quickstart

Copy-paste, in order. Use **PowerShell** (Start menu → type "PowerShell" → Enter).

## A. One-time setup

```powershell
# 1. Get the files: download the repo ZIP from
#    https://github.com/etblues449/Obsidian-Vault-  (green "Code" -> Download ZIP)
#    unzip it, then go into the swarm folder:
cd "$HOME\Downloads\Obsidian-Vault--main\Work\Atlas Training Migration\agent-swarm\swarm"

# 2. Install the browser automation (once):
pip install playwright
playwright install chromium
```

(If `python`/`pip` aren't recognised, install Python from python.org and tick
"Add Python to PATH" during install.)

## B. Step 2 — capture the form fields (needs only a browser, ~5 min)

1. Log into Atlas, open **Add result** for any one staff member.
2. Press **F12** → **Console** tab.
3. Open `capture_selectors.js`, copy all, paste into Console, Enter.
4. Send the printed table to Claude → it fills `config.py` for you.
   (Or fill it yourself using `SELECTOR_WORKSHEET.md`.)

## C. Step 3 — log in once

```powershell
python login_bootstrap.py
```
A browser opens → log in with password + MFA → press Enter. Session saved.

## D. Step 4 — check ready

```powershell
python preflight.py     # must say READY
```

## E. Step 5 — pilot, then run it all (watch live)

```powershell
# 10-record test first:
python run_worker.py --worker pilot --start 1 --end 10
#   -> check those 10 in Atlas look right, then:

.\run_swarm.ps1 -Start 1 -End 296 -Workers 5      # the 296 overdue first
.\run_swarm.ps1 -Start 297 -End 1358 -Workers 5   # the rest
python merge_results.py                            # final count = 1,358
```

Each worker opens its own window so you can watch records go in. A screenshot is
saved per record in `screenshots\`.

### If PowerShell blocks the script
Run once, then retry:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### Anything stalls
Copy the window's text to Claude — it diagnoses and tells you the next move.
The only steps Claude can't do are B and C (your Atlas login).
