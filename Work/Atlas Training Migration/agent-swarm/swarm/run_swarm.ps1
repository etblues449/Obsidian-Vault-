# Requires: Python 3 + 'pip install playwright' + 'playwright install chromium'
# One-command swarm launcher for Windows PowerShell. Opens each worker in its
# own window so you watch records go in live, then reconciles.
#
#   .\run_swarm.ps1 -Pilot                 # dry-run, no writes
#   .\run_swarm.ps1 -Start 1 -End 296 -Workers 5     # the 296 overdue first
#   .\run_swarm.ps1 -Start 297 -End 1358 -Workers 5  # the rest
#
param(
  [switch]$Pilot,
  [int]$Start,
  [int]$End,
  [int]$Workers = 5
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if ($Pilot) {
  Write-Host "== PILOT (dry-run, no writes) ==" -ForegroundColor Magenta
  python run_worker.py --worker pilot --start 1 --end 10 --dry-run
  Write-Host "`nDry-run done. For a real 10-record pilot once selectors+login are set:"
  Write-Host "  python run_worker.py --worker pilot --start 1 --end 10"
  return
}

if (-not $Start -or -not $End) { throw "Usage: .\run_swarm.ps1 -Start 1 -End 296 -Workers 5" }

Write-Host "== Preflight ==" -ForegroundColor Magenta
python preflight.py
$ans = Read-Host "`nProceed with LIVE entry of rows $Start-$End across $Workers workers? (y/N)"
if ($ans -ne "y" -and $ans -ne "Y") { Write-Host "Aborted."; return }

$total = $End - $Start + 1
$per = [math]::Ceiling($total / $Workers)
$labels = @("A","B","C","D","E","F","G","H","I","J")

Write-Host "== Launching $Workers workers (~$per records each) ==" -ForegroundColor Magenta
$procs = @()
$s = $Start
for ($i = 0; $i -lt $Workers; $i++) {
  $e = [math]::Min($s + $per - 1, $End)
  if ($s -gt $End) { break }
  $label = $labels[$i]
  # Each worker in its own window so you can watch it live.
  $p = Start-Process -PassThru powershell -ArgumentList @(
    "-NoExit","-Command",
    "python run_worker.py --worker $label --start $s --end $e"
  )
  Write-Host ("  worker {0}: rows {1}-{2} (pid {3})" -f $label,$s,$e,$p.Id)
  $procs += $p
  $s = $e + 1
}

Write-Host "Waiting for workers to finish..."
$procs | ForEach-Object { Wait-Process -Id $_.Id }

Write-Host "== Reconcile ==" -ForegroundColor Magenta
python merge_results.py
