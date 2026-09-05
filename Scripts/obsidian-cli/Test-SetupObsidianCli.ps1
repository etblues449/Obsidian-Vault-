<#
.SYNOPSIS
    Tests for Setup-ObsidianCli.ps1. Runs anywhere PowerShell 5.1+ runs,
    including Linux under PowerShell 7 — it checks the script parses and that
    its decision logic is right, without needing Obsidian installed.

.EXAMPLE
    pwsh -NoProfile -File .\Test-SetupObsidianCli.ps1
    powershell -ExecutionPolicy Bypass -File .\Test-SetupObsidianCli.ps1
#>
$ErrorActionPreference = 'Stop'
$fail = 0
function T($name, $cond) {
    if ($cond) { Write-Host "  PASS  $name" -ForegroundColor Green }
    else       { Write-Host "  FAIL  $name" -ForegroundColor Red; $script:fail++ }
}

Write-Host 'Setup-ObsidianCli.ps1 tests'
Write-Host '==========================='

$target = Join-Path $PSScriptRoot 'Setup-ObsidianCli.ps1'

Write-Host ''
Write-Host '-- script integrity --'
T 'script exists' (Test-Path $target)

$errors = $null; $tokens = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($target, [ref]$tokens, [ref]$errors)
T 'parses with no syntax errors' ($errors.Count -eq 0)
if ($errors.Count) { $errors | ForEach-Object { Write-Host "        line $($_.Extent.StartLineNumber): $($_.Message)" } }

$help = Get-Help $target -ErrorAction SilentlyContinue
T 'has comment-based help'  ([bool]$help.Synopsis)
$cmd = Get-Command $target
T '-Fix is an optional switch' ($cmd.Parameters['Fix'].ParameterType.Name -eq 'SwitchParameter')

# Pull the helper functions out of the AST so they can be exercised directly,
# without running the script body (which would touch the real machine).
$funcs = $ast.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)
foreach ($f in $funcs) { Invoke-Expression $f.Extent.Text }
T 'Find-ObsidianExe defined'  ([bool](Get-Command Find-ObsidianExe -ErrorAction SilentlyContinue))
T 'Write-Utf8NoBom defined'   ([bool](Get-Command Write-Utf8NoBom  -ErrorAction SilentlyContinue))
T 'Read-Utf8 defined'         ([bool](Get-Command Read-Utf8        -ErrorAction SilentlyContinue))

Write-Host ''
Write-Host '-- install discovery --'
# The per-user NSIS installer puts Obsidian in %LOCALAPPDATA%\Programs\Obsidian.
# Missing that root is what made an earlier version report "not found" on a
# perfectly normal install, so pin the search order.
$src = Get-Content $target -Raw
T 'searches LOCALAPPDATA\Programs\Obsidian' ($src.Contains("'Programs\Obsidian'"))
T 'Programs root is tried before bare LOCALAPPDATA\Obsidian' (
    $src.IndexOf("'Programs\Obsidian'") -lt $src.IndexOf("LOCALAPPDATA 'Obsidian'")
)
T 'falls back to the running process' ($src -match "Get-Process -Name 'Obsidian'")
T 'falls back to the uninstall registry' ($src -match 'CurrentVersion\\Uninstall')

# Join-Path throws on a null root and runs before any filter placed after it,
# so a machine without ProgramFiles(x86) used to blow up here with
# "Cannot bind argument to parameter 'Path' because it is null". On Linux every
# one of these variables is null, which makes this the strictest possible case.
$threw = $false
$found = $null
try { $found = Find-ObsidianExe } catch { $threw = $true; Write-Host "        $($_.Exception.Message)" }
T 'Find-ObsidianExe survives null/absent install roots' (-not $threw)
T 'Find-ObsidianExe returns null or a real path' ($null -eq $found -or (Test-Path $found))

Write-Host ''
Write-Host '-- obsidian.json must be written without a BOM --'
# Windows PowerShell 5.1 Set-Content -Encoding UTF8 emits a BOM, which breaks
# Obsidian's JSON parse on next start.
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "obsidian-test-$([guid]::NewGuid()).json"
Write-Utf8NoBom $tmp '{"vaults":{"abc":{"path":"C:\\v","open":true}},"cli":true}'
$bytes = [System.IO.File]::ReadAllBytes($tmp)
T 'no UTF-8 BOM at the start' (-not ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF))
$rt = Get-Content $tmp -Raw | ConvertFrom-Json
T 'round-trips through ConvertFrom-Json' ([bool]$rt.cli -and $rt.vaults.abc.path -eq 'C:\v')
Remove-Item $tmp -Force

Write-Host ''
Write-Host '-- non-ASCII vault paths must survive the round-trip --'
# Windows PowerShell 5.1 reads and writes with the ANSI codepage by default, so
# a vault path like "Jelly Bean's Vault \u2014 primary" came back mangled and
# Obsidian could no longer find the vault. This is that exact case.
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "obsidian-test-$([guid]::NewGuid()).json"
$vaultPath = "C:\Users\me\Documents\Jelly Bean's Vault $([char]0x2014) primary"
$seed = [pscustomobject]@{ vaults = [pscustomobject]@{ abc = [pscustomobject]@{ path = $vaultPath; open = $true } } }
Write-Utf8NoBom $tmp ($seed | ConvertTo-Json -Depth 20 -Compress)

$read = Read-Utf8 $tmp | ConvertFrom-Json
T 'em dash survives the read' ($read.vaults.abc.path -ceq $vaultPath)
$read | Add-Member -NotePropertyName cli -NotePropertyValue $true -Force
Write-Utf8NoBom $tmp ($read | ConvertTo-Json -Depth 20 -Compress)
$again = Read-Utf8 $tmp | ConvertFrom-Json
T 'em dash survives read -> edit -> write' ($again.vaults.abc.path -ceq $vaultPath)
T 'cli flag applied alongside it' ([bool]$again.cli)
# The naive PS 5.1 idiom is what broke it - assert the script does not use it.
T 'script does not read obsidian.json with bare Get-Content' (
    -not ($src -match 'Get-Content \$cfgPath')
)
Remove-Item $tmp -Force

Write-Host ''
Write-Host '-- cli flag handling --'
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "obsidian-test-$([guid]::NewGuid()).json"
Write-Utf8NoBom $tmp '{"vaults":{"abc":{"path":"C:\\v","open":true}}}'
$cfg = Get-Content $tmp -Raw | ConvertFrom-Json
T 'cli reads as false when absent' (-not [bool]$cfg.cli)
$cfg | Add-Member -NotePropertyName cli -NotePropertyValue $true -Force
Write-Utf8NoBom $tmp ($cfg | ConvertTo-Json -Depth 20 -Compress)
$after = Get-Content $tmp -Raw | ConvertFrom-Json
T 'cli set to true'           ([bool]$after.cli)
T 'existing vaults preserved' ($null -ne $after.vaults.abc -and $after.vaults.abc.path -eq 'C:\v')
Remove-Item $tmp -Force

Write-Host ''
Write-Host '-- version gate (CLI needs installer 1.12.7+) --'
foreach ($case in @(
    @{ v = '1.13.7.0'; want = $true  },
    @{ v = '1.13.7';   want = $true  },
    @{ v = '1.12.7';   want = $true  },
    @{ v = '1.12.6';   want = $false },
    @{ v = '1.11.0';   want = $false })) {
    $got = [version]($case.v -replace '[^0-9.].*$','') -ge [version]'1.12.7'
    T "$($case.v) accepted=$($case.want)" ($got -eq $case.want)
}

Write-Host ''
Write-Host '-- user PATH detection --'
$installDir = 'C:\Users\me\AppData\Local\Programs\Obsidian'
function OnPath($userPath, $dir) {
    ($userPath -split ';' | Where-Object { $_.Trim().TrimEnd('\') -ieq $dir.TrimEnd('\') }).Count -gt 0
}
T 'matches exact entry'            (OnPath "C:\foo;$installDir" $installDir)
T 'matches different case'         (OnPath ('C:\foo;' + $installDir.ToLower()) $installDir)
T 'matches trailing backslash'     (OnPath "C:\foo;$installDir\" $installDir)
T 'matches surrounding whitespace' (OnPath "C:\foo; $installDir " $installDir)
T 'reports absent correctly'  (-not (OnPath 'C:\foo;C:\Program Files\Other' $installDir))
T 'empty user PATH is not a match' (-not (OnPath '' $installDir))

Write-Host ''
Write-Host '==========================='
if ($fail -gt 0) { Write-Host "$fail test(s) failed" -ForegroundColor Red; exit 1 }
Write-Host 'All tests passed.' -ForegroundColor Green
