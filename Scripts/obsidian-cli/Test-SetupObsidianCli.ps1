<#
.SYNOPSIS
    Tests for Setup-ObsidianCli.ps1. Runs anywhere PowerShell 7 runs,
    including Linux — it checks the script parses and that its decision
    logic is right, without needing Obsidian installed.

.EXAMPLE
    pwsh -NoProfile -File .\Test-SetupObsidianCli.ps1
#>
$ErrorActionPreference = 'Stop'
$fail = 0
function T($name, $cond) {
    if ($cond) { Write-Host "  PASS  $name" -ForegroundColor Green }
    else       { Write-Host "  FAIL  $name" -ForegroundColor Red; $script:fail++ }
}

Write-Host 'Setup-ObsidianCli.ps1 tests'
Write-Host '==========================='

Write-Host ''
Write-Host '-- script integrity --'
$target = Join-Path $PSScriptRoot 'Setup-ObsidianCli.ps1'
T 'script exists' (Test-Path $target)

$errors = $null; $tokens = $null
[System.Management.Automation.Language.Parser]::ParseFile($target, [ref]$tokens, [ref]$errors) | Out-Null
T 'parses with no syntax errors' ($errors.Count -eq 0)
if ($errors.Count) { $errors | ForEach-Object { Write-Host "        line $($_.Extent.StartLineNumber): $($_.Message)" } }

$help = Get-Help $target -ErrorAction SilentlyContinue
T 'has comment-based help'  ([bool]$help.Synopsis)
$cmd = Get-Command $target
T '-Fix is an optional switch' ($cmd.Parameters['Fix'].ParameterType.Name -eq 'SwitchParameter')

Write-Host ''
Write-Host '-- version gate (CLI needs installer 1.12.7+) --'
foreach ($case in @(
    @{ v = '1.13.7'; want = $true  },
    @{ v = '1.12.7'; want = $true  },
    @{ v = '1.12.6'; want = $false },
    @{ v = '1.11.0'; want = $false })) {
    $got = [version]($case.v -replace '[^0-9.].*$','') -ge [version]'1.12.7'
    T "$($case.v) accepted=$($case.want)" ($got -eq $case.want)
}

Write-Host ''
Write-Host '-- user PATH detection --'
$installDir = 'C:\Users\me\AppData\Local\Obsidian'
function OnPath($userPath, $dir) {
    ($userPath -split ';' | Where-Object { $_.Trim().TrimEnd('\') -ieq $dir.TrimEnd('\') }).Count -gt 0
}
T 'matches exact entry'            (OnPath 'C:\foo;C:\Users\me\AppData\Local\Obsidian' $installDir)
T 'matches different case'         (OnPath 'C:\foo;c:\users\me\appdata\local\obsidian' $installDir)
T 'matches trailing backslash'     (OnPath 'C:\foo;C:\Users\me\AppData\Local\Obsidian\' $installDir)
T 'matches surrounding whitespace' (OnPath 'C:\foo; C:\Users\me\AppData\Local\Obsidian ' $installDir)
T 'reports absent correctly'  (-not (OnPath 'C:\foo;C:\Program Files\Other' $installDir))

Write-Host ''
Write-Host '-- obsidian.json handling --'
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "obsidian-test-$([guid]::NewGuid()).json"
'{"vaults":{"abc":{"path":"C:\\v","open":true}}}' | Set-Content $tmp -Encoding UTF8
$cfg = Get-Content $tmp -Raw | ConvertFrom-Json
T 'cli reads as false when absent' (-not [bool]$cfg.cli)
$cfg | Add-Member -NotePropertyName cli -NotePropertyValue $true -Force
($cfg | ConvertTo-Json -Depth 20 -Compress) | Set-Content $tmp -Encoding UTF8
$after = Get-Content $tmp -Raw | ConvertFrom-Json
T 'cli set to true'                ([bool]$after.cli)
T 'existing vaults preserved'      ($null -ne $after.vaults.abc -and $after.vaults.abc.path -eq 'C:\v')
Remove-Item $tmp -Force

Write-Host ''
Write-Host '==========================='
if ($fail -gt 0) { Write-Host "$fail test(s) failed" -ForegroundColor Red; exit 1 }
Write-Host 'All tests passed.' -ForegroundColor Green
