<#
.SYNOPSIS
    Set up and verify the Obsidian CLI on Windows.

.DESCRIPTION
    The Obsidian CLI ships inside the desktop app (1.12.7+). Two things have to
    be true before `obsidian` works in a terminal:

      1. "Command line interface" is on   -> the flag "cli": true in
                                             %APPDATA%\obsidian\obsidian.json
      2. The Obsidian install folder is on the *User* PATH, so the Obsidian.com
         redirector resolves when you type `obsidian`

    Settings > General > Advanced does both from the GUI. This script does the
    same thing non-interactively, then proves it with live commands.

.PARAMETER Fix
    Apply the changes. Without it the script only reports (safe to run first).
    Enabling the CLI flag edits obsidian.json, so Obsidian must be closed;
    the script tells you if it is running rather than killing it.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\Setup-ObsidianCli.ps1
    powershell -ExecutionPolicy Bypass -File .\Setup-ObsidianCli.ps1 -Fix

.NOTES
    Nothing here needs administrator rights: the PATH change is per-user, and
    obsidian.json lives in your own profile.
#>

[CmdletBinding()]
param(
    [switch]$Fix
)

$ErrorActionPreference = 'Stop'
$script:Problems = @()

function Write-Head($t) { Write-Host ''; Write-Host "==> $t" -ForegroundColor Cyan }
function Write-Ok($t)   { Write-Host "  [ OK ] $t" -ForegroundColor Green }
function Write-Bad($t)  { Write-Host "  [FAIL] $t" -ForegroundColor Red; $script:Problems += $t }
function Write-Note($t) { Write-Host "         $t" -ForegroundColor DarkGray }

# ---------------------------------------------------------------- app -------
Write-Head 'Obsidian installation'

# Join-Path throws on a null root, and ProgramFiles(x86) is absent on some
# machines, so build the list from roots that actually exist.
$roots = @($env:LOCALAPPDATA, $env:ProgramFiles, ${env:ProgramFiles(x86)}) |
         Where-Object { $_ }
$candidates = $roots |
    ForEach-Object { Join-Path $_ 'Obsidian\Obsidian.exe' } |
    Where-Object { Test-Path $_ }

if (-not $candidates) {
    Write-Bad 'Obsidian.exe not found in the usual locations.'
    Write-Note 'Install from https://obsidian.md/download, then re-run.'
    exit 1
}

$exe        = $candidates[0]
$installDir = Split-Path $exe -Parent
$version    = (Get-Item $exe).VersionInfo.ProductVersion
Write-Ok "Obsidian $version at $installDir"

if ([version]($version -replace '[^0-9.].*$','') -lt [version]'1.12.7') {
    Write-Bad "Installer $version is older than 1.12.7 — the CLI needs 1.12.7+."
    Write-Note 'Update via the installer from obsidian.md/download (an in-app update is not enough).'
}

$redirector = Join-Path $installDir 'Obsidian.com'
if (Test-Path $redirector) {
    Write-Ok 'Obsidian.com terminal redirector present'
} else {
    Write-Bad 'Obsidian.com redirector missing from the install folder.'
    Write-Note 'Re-run the 1.12.7+ installer; the redirector is what makes `obsidian` work in a terminal.'
}

# -------------------------------------------------------------- cli flag ----
Write-Head 'Command line interface setting'

$cfgPath = Join-Path $env:APPDATA 'obsidian\obsidian.json'
if (-not (Test-Path $cfgPath)) {
    Write-Bad "$cfgPath not found — launch Obsidian once, close it, then re-run."
} else {
    $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
    $cliOn = [bool]$cfg.cli
    if ($cliOn) {
        Write-Ok 'cli = true (Settings > General > Advanced > Command line interface)'
    } elseif ($Fix) {
        $running = Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue
        if ($running) {
            Write-Bad 'Obsidian is running — close it fully (check the tray) and re-run with -Fix.'
            Write-Note 'Obsidian rewrites obsidian.json on exit and would overwrite the change.'
        } else {
            Copy-Item $cfgPath "$cfgPath.bak" -Force
            $cfg | Add-Member -NotePropertyName cli -NotePropertyValue $true -Force
            ($cfg | ConvertTo-Json -Depth 20 -Compress) | Set-Content $cfgPath -Encoding UTF8
            Write-Ok "cli enabled (backup at $cfgPath.bak)"
        }
    } else {
        Write-Bad 'cli is off. Turn on Settings > General > Advanced > Command line interface, or re-run with -Fix (Obsidian closed).'
    }
}

# ------------------------------------------------------------------ PATH ----
Write-Head 'PATH registration'

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$onPath = ($userPath -split ';' | Where-Object { $_.Trim().TrimEnd('\') -ieq $installDir.TrimEnd('\') }).Count -gt 0

if ($onPath) {
    Write-Ok "$installDir is on the user PATH"
} elseif ($Fix) {
    [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ';' + $installDir), 'User')
    $env:Path = $env:Path + ';' + $installDir
    Write-Ok "added $installDir to the user PATH — open a NEW terminal for it to stick"
} else {
    Write-Bad "$installDir is not on the user PATH. Re-run with -Fix, or use the app's 'Set up CLI to work in the terminal' prompt."
}

# ------------------------------------------------------------ smoke test ----
Write-Head 'Live check'

if (-not (Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
    Write-Note 'Obsidian is not running — starting it (the CLI is a client; the app must be up).'
    Start-Process $exe | Out-Null
    Start-Sleep -Seconds 8
}

$cli = if (Test-Path $redirector) { $redirector } else { 'obsidian' }
try {
    $v = & $cli version 2>&1 | Out-String
    if ($v -match '^\s*\d+\.\d+\.\d+') {
        Write-Ok "obsidian version -> $($v.Trim())"
        $vaults = & $cli vaults 2>&1 | Out-String
        Write-Ok "vaults -> $($vaults.Trim() -replace "`r?`n", ', ')"
        $count = & $cli eval code="app.vault.getMarkdownFiles().length" 2>&1 | Out-String
        Write-Ok "indexed markdown files -> $($count.Trim())"
    } else {
        Write-Bad "CLI did not answer: $($v.Trim())"
    }
} catch {
    Write-Bad "CLI call failed: $($_.Exception.Message)"
}

# ---------------------------------------------------------------- result ----
Write-Host ''
if ($script:Problems.Count -eq 0) {
    Write-Host 'All checks passed. `obsidian help` lists every command.' -ForegroundColor Green
    exit 0
} else {
    Write-Host "$($script:Problems.Count) problem(s):" -ForegroundColor Yellow
    $script:Problems | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    if (-not $Fix) { Write-Host 'Re-run with -Fix to apply the automatic ones.' -ForegroundColor Yellow }
    exit 1
}
