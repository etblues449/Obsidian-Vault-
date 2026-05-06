# Outlook correspondent resolver - READ ONLY
# Walks Sent Items + samples Inbox/Archive senders, resolves each to a real
# SMTP address + display name. Output: ..\output\correspondents.json
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\02-resolve-correspondents.ps1
#
# Sends nothing. Modifies nothing. ~1-3 minutes.

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir    = Join-Path (Split-Path -Parent $scriptDir) 'output'
$outFile   = Join-Path $outDir 'correspondents.json'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Write-Host "Connecting to Outlook..." -ForegroundColor Cyan
$outlook = New-Object -ComObject Outlook.Application
$ns      = $outlook.GetNamespace('MAPI')

$people = @{}  # key = lowercased SMTP (or fallback), value = hashtable

function Resolve-AddressEntry {
    param($addressEntry, [string]$fallbackAddress, [string]$fallbackName)
    $smtp = $null
    $name = $fallbackName
    $type = 'unknown'

    if ($addressEntry) {
        try { $name = $addressEntry.Name } catch {}
        try {
            $entryType = $addressEntry.AddressEntryUserType
            # 0 = Exchange user, 1 = Exchange DL, 10 = SMTP, 11 = LDAP
            if ($entryType -eq 0) {
                $exUser = $addressEntry.GetExchangeUser()
                if ($exUser) {
                    $smtp = $exUser.PrimarySmtpAddress
                    if ($exUser.Name) { $name = $exUser.Name }
                    $type = 'internal'
                }
            } elseif ($entryType -eq 10) {
                $smtp = $addressEntry.Address
                $type = 'external'
            } else {
                try { $smtp = $addressEntry.GetContact().Email1Address } catch {}
                if (-not $smtp) { $smtp = $addressEntry.Address }
                $type = 'other'
            }
        } catch {}
    }

    if (-not $smtp) { $smtp = $fallbackAddress }
    if (-not $smtp) { return $null }
    return @{ smtp = $smtp.ToLower(); name = $name; type = $type }
}

function Bump-Person {
    param($info, [string]$direction)
    if (-not $info -or -not $info.smtp) { return }
    $key = $info.smtp
    if (-not $people.ContainsKey($key)) {
        $people[$key] = @{
            smtp        = $info.smtp
            name        = $info.name
            type        = $info.type
            sentTo      = 0
            receivedFrom = 0
        }
    }
    if ($direction -eq 'to')   { $people[$key].sentTo++ }
    if ($direction -eq 'from') { $people[$key].receivedFrom++ }
    if (-not $people[$key].name -and $info.name) { $people[$key].name = $info.name }
}

# Find work mailbox stores (skip "Info" - it's the shared mailbox, not personal)
$targetStore = $null
foreach ($store in $ns.Stores) {
    if ($store.DisplayName -like '*EHorton*' -or $store.DisplayName -like '*selectlifestyles*') {
        $targetStore = $store
        break
    }
}
if (-not $targetStore) {
    Write-Warning "Could not find work mailbox store; using default."
    $targetStore = $ns.DefaultStore
}
Write-Host "Using store: $($targetStore.DisplayName)" -ForegroundColor Yellow

$root = $targetStore.GetRootFolder()

function Find-Folder {
    param($parent, [string]$name)
    foreach ($f in $parent.Folders) {
        if ($f.Name -eq $name) { return $f }
    }
    return $null
}

# ---- Sent Items: every recipient ----
$sent = Find-Folder $root 'Sent Items'
if ($sent) {
    Write-Host "Scanning Sent Items ($($sent.Items.Count))..." -ForegroundColor Cyan
    $items = $sent.Items
    $items.Sort('[SentOn]', $true)
    $count = $items.Count
    for ($i = 1; $i -le $count; $i++) {
        try {
            $it = $items.Item($i)
            if ($it.Class -eq 43) {  # MailItem
                foreach ($r in $it.Recipients) {
                    $info = Resolve-AddressEntry -addressEntry $r.AddressEntry `
                        -fallbackAddress $r.Address -fallbackName $r.Name
                    Bump-Person $info 'to'
                }
            }
            if ($it) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($it) | Out-Null }
        } catch {}
        if ($i % 100 -eq 0) { Write-Host "  ...$i sent items processed" }
    }
}

# ---- Inbox + Archive: senders only ----
foreach ($folderName in @('Inbox', 'Archive')) {
    $f = Find-Folder $root $folderName
    if (-not $f) { continue }
    Write-Host "Scanning $folderName senders ($($f.Items.Count))..." -ForegroundColor Cyan
    $items = $f.Items
    $items.Sort('[ReceivedTime]', $true)
    $count = $items.Count
    for ($i = 1; $i -le $count; $i++) {
        try {
            $it = $items.Item($i)
            if ($it.Class -eq 43) {
                $info = Resolve-AddressEntry -addressEntry $it.Sender `
                    -fallbackAddress $it.SenderEmailAddress -fallbackName $it.SenderName
                Bump-Person $info 'from'
            }
            if ($it) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($it) | Out-Null }
        } catch {}
        if ($i % 500 -eq 0) { Write-Host "  ...$i $folderName items processed" }
    }
}

# Sort & save
$sortedPeople = $people.Values | Sort-Object { -($_.sentTo + $_.receivedFrom) }
$report = [ordered]@{
    generatedAt = (Get-Date).ToString('s')
    totalUniquePeople = $sortedPeople.Count
    people = $sortedPeople
}
$json = $report | ConvertTo-Json -Depth 6
Set-Content -Path $outFile -Value $json -Encoding UTF8

Write-Host ""
Write-Host "Done. $($sortedPeople.Count) unique correspondents." -ForegroundColor Green
Write-Host "Output: $outFile"
Write-Host ""
Write-Host "Push it up with:"
Write-Host "  git add 'Outlook Organizer/output/correspondents.json'"
Write-Host "  git commit -m 'Add correspondents map'"
Write-Host "  git push"
