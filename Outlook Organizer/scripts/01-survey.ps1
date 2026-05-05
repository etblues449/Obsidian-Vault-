# Outlook mailbox survey - READ ONLY
# Run from PowerShell with Outlook desktop OPEN.
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\01-survey.ps1
#
# Output: ..\output\survey.json
# Sends nothing anywhere. Does not modify a single message.

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir    = Join-Path (Split-Path -Parent $scriptDir) 'output'
$outFile   = Join-Path $outDir 'survey.json'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Write-Host "Connecting to Outlook..." -ForegroundColor Cyan
$outlook = New-Object -ComObject Outlook.Application
$ns      = $outlook.GetNamespace('MAPI')

# Sample up to N items per folder for sender/subject stats (full count is exact)
$SAMPLE_PER_FOLDER = 500

function Walk-Folder {
    param($folder, [int]$depth = 0)

    $info = [ordered]@{
        name      = $folder.Name
        path      = $folder.FolderPath
        depth     = $depth
        itemCount = 0
        unread    = 0
        oldest    = $null
        newest    = $null
        topSenders   = @{}
        subjectWords = @{}
        children  = @()
    }

    try { $info.itemCount = $folder.Items.Count } catch { $info.itemCount = -1 }
    try { $info.unread    = $folder.UnReadItemCount } catch {}

    if ($info.itemCount -gt 0 -and $folder.DefaultItemType -eq 0) {  # 0 = MailItem
        try {
            $items = $folder.Items
            $items.Sort('[ReceivedTime]', $true)  # newest first
            $take  = [Math]::Min($SAMPLE_PER_FOLDER, $info.itemCount)
            for ($i = 1; $i -le $take; $i++) {
                $it = $items.Item($i)
                if ($it -and $it.Class -eq 43) {  # 43 = olMail
                    if ($i -eq 1)     { $info.newest = $it.ReceivedTime.ToString('s') }
                    if ($i -eq $take) { $info.oldest = $it.ReceivedTime.ToString('s') }

                    $sender = $null
                    try { $sender = $it.SenderEmailAddress } catch {}
                    if (-not $sender) { try { $sender = $it.SenderName } catch {} }
                    if ($sender) {
                        $sender = $sender.ToLower()
                        if ($info.topSenders.ContainsKey($sender)) { $info.topSenders[$sender]++ }
                        else { $info.topSenders[$sender] = 1 }
                    }

                    $subj = $null
                    try { $subj = $it.Subject } catch {}
                    if ($subj) {
                        $clean = ($subj -replace '(?i)^(re:|fw:|fwd:)\s*','').Trim()
                        $first = ($clean -split '\s+' | Select-Object -First 3) -join ' '
                        if ($first) {
                            $key = $first.ToLower()
                            if ($info.subjectWords.ContainsKey($key)) { $info.subjectWords[$key]++ }
                            else { $info.subjectWords[$key] = 1 }
                        }
                    }
                }
                [System.Runtime.InteropServices.Marshal]::ReleaseComObject($it) | Out-Null
            }
        } catch {
            Write-Warning "Could not sample folder '$($folder.FolderPath)': $($_.Exception.Message)"
        }
    }

    # Trim to top 20 of each
    $info.topSenders = $info.topSenders.GetEnumerator() |
        Sort-Object Value -Descending | Select-Object -First 20 |
        ForEach-Object { @{ sender = $_.Key; count = $_.Value } }
    $info.subjectWords = $info.subjectWords.GetEnumerator() |
        Sort-Object Value -Descending | Select-Object -First 20 |
        ForEach-Object { @{ phrase = $_.Key; count = $_.Value } }

    foreach ($child in $folder.Folders) {
        $info.children += (Walk-Folder $child ($depth + 1))
    }
    return $info
}

$report = [ordered]@{
    generatedAt = (Get-Date).ToString('s')
    outlookVersion = $outlook.Version
    stores = @()
}

foreach ($store in $ns.Stores) {
    Write-Host "Scanning store: $($store.DisplayName)" -ForegroundColor Yellow
    $rootFolder = $store.GetRootFolder()
    $storeInfo  = [ordered]@{
        displayName = $store.DisplayName
        storeID     = $store.StoreID.Substring(0, [Math]::Min(40, $store.StoreID.Length)) + '...'
        exchange    = $store.ExchangeStoreType
        root        = (Walk-Folder $rootFolder)
    }
    $report.stores += $storeInfo
}

# Gather existing rules (names only - useful for planning)
try {
    $rulesObj  = $ns.DefaultStore.GetRules()
    $ruleNames = @()
    foreach ($r in $rulesObj) { $ruleNames += @{ name = $r.Name; enabled = $r.Enabled } }
    $report.existingRules = $ruleNames
} catch {
    $report.existingRules = @()
    Write-Warning "Could not read rules: $($_.Exception.Message)"
}

# Categories master list
try {
    $cats = @()
    foreach ($c in $ns.Categories) { $cats += @{ name = $c.Name; color = $c.Color } }
    $report.categories = $cats
} catch {
    $report.categories = @()
}

$json = $report | ConvertTo-Json -Depth 12
Set-Content -Path $outFile -Value $json -Encoding UTF8

Write-Host ""
Write-Host "Done. Survey written to:" -ForegroundColor Green
Write-Host "  $outFile"
Write-Host ""
Write-Host "Send that file back to Claude (or paste its contents) to continue."
