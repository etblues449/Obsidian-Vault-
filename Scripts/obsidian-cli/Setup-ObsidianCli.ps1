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
    obsidian.json lives in your own profile. Works on Windows PowerShell 5.1
    and PowerShell 7+.
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

# Obsidian's own installer is per-user NSIS, which lands in
# %LOCALAPPDATA%\Programs\Obsidian — NOT %LOCALAPPDATA%\Obsidian. Machine-wide
# and Scoop installs land elsewhere again, so try the known layouts, then ask
# the running process, then the uninstall registry. Returns the .exe path.
function Find-ObsidianExe {
    # Join-Path throws on a null root, and it is evaluated before any filter
    # placed after it - so the null check has to happen on the base, not on the
    # joined result. ProgramFiles(x86) is absent on plenty of machines.
    $roots = @()
    if ($env:LOCALAPPDATA) {
        $roots += (Join-Path $env:LOCALAPPDATA 'Programs\Obsidian')   # per-user NSIS: the normal case
        $roots += (Join-Path $env:LOCALAPPDATA 'Obsidian')
    }
    if ($env:ProgramFiles)        { $roots += (Join-Path $env:ProgramFiles 'Obsidian') }
    if (${env:ProgramFiles(x86)}) { $roots += (Join-Path ${env:ProgramFiles(x86)} 'Obsidian') }
    if ($env:USERPROFILE)         { $roots += (Join-Path $env:USERPROFILE 'scoop\apps\obsidian\current') }
    $roots = $roots | Where-Object { Test-Path $_ }

    foreach ($r in $roots) {
        $exe = Join-Path $r 'Obsidian.exe'
        if (Test-Path $exe) { return $exe }
    }

    # Already running? Then it knows better than any guess.
    $proc = Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue |
            Where-Object { $_.Path } | Select-Object -First 1
    if ($proc) { return $proc.Path }

    # Last resort: the uninstall registry.
    $keys = @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    foreach ($k in $keys) {
        $hit = Get-ItemProperty $k -ErrorAction SilentlyContinue |
               Where-Object { $_.DisplayName -like 'Obsidian*' -and $_.InstallLocation } |
               Select-Object -First 1
        if ($hit) {
            $exe = Join-Path $hit.InstallLocation 'Obsidian.exe'
            if (Test-Path $exe) { return $exe }
        }
    }
    return $null
}

# Windows PowerShell 5.1's Set-Content -Encoding UTF8 writes a BOM, and a BOM
# in obsidian.json breaks the app's JSON parse on next start. Always write
# UTF-8 without one.
function Write-Utf8NoBom($path, $text) {
    [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

# ---------------------------------------------------------------- app -------
Write-Head 'Obsidian installation'

$exe = Find-ObsidianExe
if (-not $exe) {
    Write-Bad 'Obsidian.exe not found (checked the usual install roots, the running process and the uninstall registry).'
    Write-Note 'Install from https://obsidian.md/download, then re-run.'
    exit 1
}

$installDir = Split-Path $exe -Parent
$version    = (Get-Item $exe).VersionInfo.ProductVersion
Write-Ok "Obsidian $version at $installDir"

if ([version]($version -replace '[^0-9.].*$','') -lt [version]'1.12.7') {
    Write-Bad "Installer $version is older than 1.12.7 - the CLI needs 1.12.7+."
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
    Write-Bad "$cfgPath not found - launch Obsidian once, close it, then re-run."
} else {
    $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
    if ([bool]$cfg.cli) {
        Write-Ok 'cli = true (Settings > General > Advanced > Command line interface)'
    } elseif ($Fix) {
        if (Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue) {
            Write-Bad 'Obsidian is running - close it fully (check the tray) and re-run with -Fix.'
            Write-Note 'Obsidian rewrites obsidian.json on exit and would overwrite the change.'
        } else {
            Copy-Item $cfgPath "$cfgPath.bak" -Force
            $cfg | Add-Member -NotePropertyName cli -NotePropertyValue $true -Force
            Write-Utf8NoBom $cfgPath ($cfg | ConvertTo-Json -Depth 20 -Compress)
            Write-Ok "cli enabled (backup at $cfgPath.bak)"
        }
    } else {
        Write-Bad 'cli is off. Turn on Settings > General > Advanced > Command line interface, or re-run with -Fix (Obsidian closed).'
    }
}

# ------------------------------------------------------------------ PATH ----
Write-Head 'PATH registration'

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($null -eq $userPath) { $userPath = '' }
$onPath = ($userPath -split ';' | Where-Object { $_.Trim().TrimEnd('\') -ieq $installDir.TrimEnd('\') }).Count -gt 0

if ($onPath) {
    Write-Ok "$installDir is on the user PATH"
} elseif ($Fix) {
    $new = if ($userPath.Trim()) { $userPath.TrimEnd(';') + ';' + $installDir } else { $installDir }
    [Environment]::SetEnvironmentVariable('Path', $new, 'User')
    $env:Path = $env:Path + ';' + $installDir
    Write-Ok "added $installDir to the user PATH - open a NEW terminal for it to stick"
} else {
    Write-Bad "$installDir is not on the user PATH. Re-run with -Fix, or use the app's 'Set up CLI to work in the terminal' prompt."
}

# ------------------------------------------------------------ smoke test ----
Write-Head 'Live check'

if (-not (Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
    Write-Note 'Obsidian is not running - starting it (the CLI is a client; the app must be up).'
    Start-Process $exe | Out-Null
    Start-Sleep -Seconds 10
}

$cli = if (Test-Path $redirector) { $redirector } else { 'obsidian' }
try {
    $v = & $cli version 2>&1 | Out-String
    if ($v -match '\d+\.\d+\.\d+') {
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
