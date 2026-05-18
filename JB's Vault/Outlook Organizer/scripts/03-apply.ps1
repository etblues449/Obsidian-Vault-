# Outlook Apply - Phase 1: build folder tree, categories, and route messages
#
# Usage:
#   Dry-run (default - changes NOTHING, writes a report):
#     powershell -ExecutionPolicy Bypass -File .\03-apply.ps1
#
#   Build folders+categories only (no message moves):
#     powershell -ExecutionPolicy Bypass -File .\03-apply.ps1 -BuildOnly -Execute
#
#   Real run (after you've reviewed the dry-run report):
#     powershell -ExecutionPolicy Bypass -File .\03-apply.ps1 -Execute
#
# Safety:
#   - Never deletes a message
#   - Preserves unread state on every move
#   - Idempotent: safe to re-run
#   - Logs every action to ..\output\apply-log-<timestamp>.txt

param(
    [switch]$Execute,
    [switch]$BuildOnly
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir    = Join-Path (Split-Path -Parent $scriptDir) 'output'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile   = Join-Path $outDir "apply-log-$timestamp.txt"
$reportFile = Join-Path $outDir "apply-report-$timestamp.txt"

$mode = if ($Execute) { 'EXECUTE' } else { 'DRY-RUN' }

# Hold a StreamWriter open for the whole run so external file watchers
# (Obsidian, Google Drive sync) can't lock the file between writes.
$logStream = $null
function Open-Log {
    $script:logStream = [System.IO.StreamWriter]::new($logFile, $true, [System.Text.Encoding]::UTF8)
    $script:logStream.AutoFlush = $true
}
function Close-Log {
    if ($script:logStream) { $script:logStream.Close(); $script:logStream = $null }
}
function Log {
    param([string]$msg)
    Write-Host $msg
    if ($script:logStream) {
        try { $script:logStream.WriteLine($msg) } catch {}
    }
}
function Save-WithRetry {
    param([string]$path, [string[]]$lines)
    for ($i = 0; $i -lt 5; $i++) {
        try {
            [System.IO.File]::WriteAllLines($path, $lines, [System.Text.Encoding]::UTF8)
            return
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    Write-Warning "Could not write $path after 5 attempts"
}

Open-Log
Log "=== Outlook Apply [$mode] $(Get-Date) ==="

# ----------------------------------------------------------------------
# CONFIG
# ----------------------------------------------------------------------

# YOUR mailbox (so we never count yourself as the "other party")
$myEmail = 'ehorton@selectlifestyles.co.uk'

# Top-level folder names (in priority order — Inbox stays at top)
$topFolders = @(
    'Departments',
    'External',
    'Notifications',
    'Marketing'
)

# Department subfolders
$deptFolders = @(
    'Departments\1. Executive',
    'Departments\2. Care & Compliance',
    'Departments\3. Operations',
    'Departments\4. Finance',
    'Departments\5. Estates',
    'Departments\6. HR',
    'Departments\_Unmapped'
)

$externalFolders = @(
    'External\Legal\Carbon Law Partners',
    'External\Legal\Mills-Reeve',
    'External\Legal\SecureMail',
    'External\Banking & Finance\Xero',
    'External\Banking & Finance\HSBC',
    'External\Banking & Finance\Revolut',
    'External\Utilities\Gas',
    'External\Utilities\Electric',
    'External\Utilities\Water',
    'External\Utilities\Broadband',
    'External\Utilities\Other',
    'External\Suppliers',
    'External\Other'
)

$notifFolders = @(
    'Notifications\M365 Security',
    'Notifications\Quarantine',
    'Notifications\Teams',
    'Notifications\GitHub',
    'Notifications\Tools',
    'Notifications\Shipping',
    'Notifications\LinkedIn'
)

$marketingFolders = @(
    'Marketing\Retail',
    'Marketing\Football',
    'Marketing\Newsletters',
    'Marketing\Investing',
    'Marketing\Other'
)

$allFolders = $deptFolders + $externalFolders + $notifFolders + $marketingFolders

# Staff -> Department (lowercased local part of email)
$deptMap = @{
    # Executive
    'nhorton' = '1. Executive'; 'chorton' = '1. Executive'; 'lgrice' = '1. Executive'
    'efranks' = '1. Executive'; 'sjassal' = '1. Executive'; 'ltrumpeter' = '1. Executive'
    'aford' = '1. Executive'
    # Care & Compliance
    'jroberts' = '2. Care & Compliance'; 'closonczki' = '2. Care & Compliance'
    'wphillips' = '2. Care & Compliance'; 'nkaur' = '2. Care & Compliance'
    'reception' = '2. Care & Compliance'
    # Operations
    'jsaunders' = '3. Operations'; 'dpoole' = '3. Operations'; 'dukwu' = '3. Operations'
    'sturner' = '3. Operations'; 'jcurrier' = '3. Operations'; 'srani' = '3. Operations'
    'ajassal' = '3. Operations'; 'kbromwich' = '3. Operations'; 'jcourts' = '3. Operations'
    # Finance
    'hjordanou' = '4. Finance'; 'lgoodwin' = '4. Finance'; 'jshuker' = '4. Finance'
    'arussell' = '4. Finance'; 'amcdermott' = '4. Finance'; 'arahman' = '4. Finance'
    'payroll' = '4. Finance'
    # Estates
    'wetheridge' = '5. Estates'; 'selecthouse' = '5. Estates'; 'mturley' = '5. Estates'
    # HR
    'dlekhi' = '6. HR'; 'lwilliams' = '6. HR'; 'cbelwood' = '6. HR'; 'umohammed' = '6. HR'
    'athompson' = '6. HR'; 'dshaw' = '6. HR'; 'cstephenson' = '6. HR'
}

# Routing rules (evaluated TOP DOWN, first match wins)
# Each rule: @{ Test = scriptblock returning bool; Target = folder path }
# scriptblock receives @{ FromSmtp; FromName; Subject } and returns bool.
$rules = @(
    # ===== NOTIFICATIONS / SYSTEM NOISE =====
    @{ Name='M365 Security'; Test={ param($m) $m.Subject -match '^Microsoft 365 Security' }; Target='Notifications\M365 Security' }
    @{ Name='Quarantine'; Test={ param($m) $m.Subject -match '^Quarantine report' -or $m.FromSmtp -like '*messaging.microsoft.com' }; Target='Notifications\Quarantine' }
    @{ Name='Teams'; Test={ param($m) $m.FromSmtp -like '*teams.mail.microsoft*' }; Target='Notifications\Teams' }
    @{ Name='GitHub'; Test={ param($m) $m.FromSmtp -like '*@github.com' -or $m.FromSmtp -like '*noreply@github.com' }; Target='Notifications\GitHub' }
    @{ Name='Tools'; Test={ param($m) $m.FromSmtp -like '*@email.heygen.com' -or $m.FromSmtp -like '*@render.com' -or $m.FromSmtp -like '*@calendly.com' }; Target='Notifications\Tools' }
    @{ Name='LinkedIn'; Test={ param($m) $m.FromSmtp -like '*@linkedin.com' }; Target='Notifications\LinkedIn' }
    @{ Name='Amazon'; Test={ param($m) $m.FromSmtp -like '*@amazon.co.uk' -or $m.FromSmtp -like '*amazon.com*' }; Target='Notifications\Shipping' }
    @{ Name='Uber'; Test={ param($m) $m.FromSmtp -like '*@uber.com' }; Target='Notifications\Shipping' }

    # ===== EXTERNAL COUNTERPARTIES =====
    @{ Name='Carbon Law'; Test={ param($m) $m.FromSmtp -like '*@carbonlawpartners.com' -or $m.FromSmtp -eq 'kgolestani@selectlifestyles.co.uk' }; Target='External\Legal\Carbon Law Partners' }
    @{ Name='Mills-Reeve'; Test={ param($m) $m.FromSmtp -like '*@mills-reeve.com' }; Target='External\Legal\Mills-Reeve' }
    @{ Name='SecureMail'; Test={ param($m) $m.FromSmtp -like '*@client.securemail.management' }; Target='External\Legal\SecureMail' }
    @{ Name='Xero'; Test={ param($m) $m.FromSmtp -like '*@post.xero.com' -or $m.FromSmtp -like '*@xero.com' }; Target='External\Banking & Finance\Xero' }
    @{ Name='HSBC'; Test={ param($m) $m.FromSmtp -like '*@email1.hsbc.co.uk' -or $m.FromSmtp -like '*hsbc.co.uk' }; Target='External\Banking & Finance\HSBC' }
    @{ Name='Revolut'; Test={ param($m) $m.FromSmtp -like '*revolut.com' }; Target='External\Banking & Finance\Revolut' }
    @{ Name='British Gas'; Test={ param($m) $m.FromSmtp -like '*britishgas*' -or $m.FromSmtp -like '*totalenergies*' -or $m.FromName -like '*British Gas*' -or $m.FromName -like '*TotalEnergies*' }; Target='External\Utilities\Gas' }
    @{ Name='Octopus'; Test={ param($m) $m.FromSmtp -like '*@octopus.energy' }; Target='External\Utilities\Electric' }
    @{ Name='EverflowEnergy'; Test={ param($m) $m.FromSmtp -like '*@everflowutilities.com' }; Target='External\Utilities\Other' }
    @{ Name='Telecom'; Test={ param($m) $m.FromSmtp -like '*@telecomcentral.co.uk' }; Target='External\Utilities\Broadband' }

    # ===== MARKETING (high-volume noise) =====
    @{ Name='Whop'; Test={ param($m) $m.FromSmtp -like '*@whop.com' -or $m.FromSmtp -like '*emails.whop.com' }; Target='Marketing\Other' }
    @{ Name='FundingOptions'; Test={ param($m) $m.FromSmtp -like '*@fundingoptions.com' }; Target='Marketing\Investing' }
    @{ Name='Patreon'; Test={ param($m) $m.FromSmtp -like '*@patreon.com' }; Target='Marketing\Other' }
    @{ Name='Totum'; Test={ param($m) $m.FromSmtp -like '*@mail.totum.com' }; Target='Marketing\Retail' }
    @{ Name='Bet365'; Test={ param($m) $m.FromSmtp -like '*bet365*' }; Target='Marketing\Other' }
    @{ Name='FragranceShop'; Test={ param($m) $m.FromSmtp -like '*thefragranceshop*' }; Target='Marketing\Retail' }
    @{ Name='TopCashback'; Test={ param($m) $m.FromSmtp -like '*topcashback*' }; Target='Marketing\Retail' }
    @{ Name='Montblanc'; Test={ param($m) $m.FromSmtp -like '*montblanc*' }; Target='Marketing\Retail' }
    @{ Name='TikTok'; Test={ param($m) $m.FromSmtp -like '*tiktok*' }; Target='Marketing\Retail' }
    @{ Name='Domino'; Test={ param($m) $m.FromSmtp -like '*dominos*' }; Target='Marketing\Retail' }
    @{ Name='Outplayed'; Test={ param($m) $m.FromSmtp -like '*outplayed*' }; Target='Marketing\Other' }
    @{ Name='ProSports'; Test={ param($m) $m.FromSmtp -like '*prosportsadvice*' }; Target='Marketing\Other' }
    @{ Name='Fundrise'; Test={ param($m) $m.FromSmtp -like '*fundrise*' }; Target='Marketing\Investing' }
    @{ Name='Ebay'; Test={ param($m) $m.FromSmtp -like '*ebay*' }; Target='Marketing\Retail' }
    @{ Name='TGI'; Test={ param($m) $m.FromSmtp -like '*tgifridays*' }; Target='Marketing\Retail' }
    @{ Name='SnowDome'; Test={ param($m) $m.FromSmtp -like '*snowdome*' }; Target='Marketing\Retail' }
    @{ Name='Domestic'; Test={ param($m) $m.FromSmtp -like '*domesticheroes*' }; Target='Marketing\Retail' }
    @{ Name='Ishga'; Test={ param($m) $m.FromSmtp -like '*ishga*' }; Target='Marketing\Retail' }
    @{ Name='BCFC'; Test={ param($m) $m.FromSmtp -like '*bcfc.com' }; Target='Marketing\Football' }
    @{ Name='TravelFX'; Test={ param($m) $m.FromSmtp -like '*travelfx*' }; Target='Marketing\Newsletters' }
    @{ Name='Beacon'; Test={ param($m) $m.FromSmtp -like '*beaconschoolsupport*' }; Target='Marketing\Newsletters' }
    @{ Name='ProgressiveProperty'; Test={ param($m) $m.FromSmtp -like '*progressiveproperty*' }; Target='Marketing\Investing' }
    @{ Name='GiveOpinions'; Test={ param($m) $m.FromSmtp -like '*giveopinions*' }; Target='Marketing\Other' }
    @{ Name='BuzzVapes'; Test={ param($m) $m.FromSmtp -like '*buzzvapes*' }; Target='Marketing\Retail' }
    @{ Name='CEF'; Test={ param($m) $m.FromSmtp -like '*@cef.co.uk' }; Target='External\Suppliers' }
    @{ Name='Toolstation'; Test={ param($m) $m.FromSmtp -like '*toolstation*' }; Target='External\Suppliers' }
    @{ Name='Xlence'; Test={ param($m) $m.FromSmtp -like '*xlence*' }; Target='External\Suppliers' }
)

# Schemes (categories applied to messages mentioning these in Subject)
$schemes = @(
    'Stafford Road','St Marks','Horsehills Drive','Oaks Crescent','Fellows Road',
    'Dudding Road','St John Square','Himley Road','Peacock Close','Vicarage Road',
    'Beeches Road','Stony Lane','Greswold Street','Moor Lane','Tiverton Drive',
    'The Bantocks','Hawbush Road','Harrison Street','Doveridge Place','Walsall Road',
    'Oberon Grove','Knipersley Road','Goodison Gardens','Penns Lane','Chester Road',
    'Marsons Court','Lincoln Road','Stratford Road','All Saints Way','Helenny Close',
    'John Street','Throne Road'
)

# ----------------------------------------------------------------------
# CONNECT TO OUTLOOK
# ----------------------------------------------------------------------

Log "Connecting to Outlook..."
$outlook = New-Object -ComObject Outlook.Application
$ns = $outlook.GetNamespace('MAPI')

$workStore = $null
foreach ($s in $ns.Stores) {
    if ($s.DisplayName -like '*EHorton*' -or $s.DisplayName -like '*selectlifestyles*') {
        $workStore = $s; break
    }
}
if (-not $workStore) { throw "Could not find work mailbox store" }
$root = $workStore.GetRootFolder()
Log "Using store: $($workStore.DisplayName)"

# ----------------------------------------------------------------------
# PHASE 1 - Build folder tree
# ----------------------------------------------------------------------

function Get-Or-Create-Folder {
    param($parent, [string]$name, [bool]$create)
    foreach ($f in $parent.Folders) {
        if ($f.Name -eq $name) { return $f }
    }
    if (-not $create) { return $null }
    Log "  CREATE folder: $($parent.FolderPath)\$name"
    return $parent.Folders.Add($name)
}

function Resolve-Folder {
    param([string]$path, [bool]$create)
    $parts = $path -split '\\'
    $cur = $root
    foreach ($p in $parts) {
        $cur = Get-Or-Create-Folder $cur $p $create
        if (-not $cur) { return $null }
    }
    return $cur
}

Log ""
Log "--- PHASE 1: Folder tree ---"
foreach ($path in $allFolders) {
    if ($Execute) { [void](Resolve-Folder $path $true) }
    else { Log "  WOULD CREATE: $path" }
}

# ----------------------------------------------------------------------
# PHASE 2 - Categories
# ----------------------------------------------------------------------

Log ""
Log "--- PHASE 2: Categories ---"

$existingCategoryNames = @()
foreach ($c in $ns.Categories) { $existingCategoryNames += $c.Name }

# Scheme categories - use Outlook color "Peach" (3) by default
foreach ($scheme in $schemes) {
    if ($existingCategoryNames -contains $scheme) {
        Log "  SKIP existing category: $scheme"
        continue
    }
    if ($Execute) {
        [void]$ns.Categories.Add($scheme, 3)  # 3 = Peach
        Log "  CREATE category: $scheme"
    } else {
        Log "  WOULD CREATE category: $scheme"
    }
}

if ($BuildOnly) {
    Log ""
    Log "BuildOnly mode - stopping here. Folders + categories built."
    Log "Next: re-run without -BuildOnly to also route messages."
    exit 0
}

# ----------------------------------------------------------------------
# PHASE 3 - Build conversation map from Sent Items
# ----------------------------------------------------------------------

Log ""
Log "--- PHASE 3: Building conversation map from Sent Items ---"

# convMap[ConversationID] = @{ partners = @(smtp, smtp, ...) }
$convMap = @{}

function Get-RecipientSmtp {
    param($recipient)
    try {
        $ae = $recipient.AddressEntry
        if ($ae) {
            try {
                if ($ae.AddressEntryUserType -eq 0) {
                    $ex = $ae.GetExchangeUser()
                    if ($ex) { return $ex.PrimarySmtpAddress.ToLower() }
                }
            } catch {}
        }
        if ($recipient.Address -and $recipient.Address -like '*@*') { return $recipient.Address.ToLower() }
    } catch {}
    return $null
}

$sent = Get-Or-Create-Folder $root 'Sent Items' $false
if ($sent) {
    $sentItems = $sent.Items
    $sentCount = $sentItems.Count
    Log "Scanning $sentCount sent items..."
    for ($i = 1; $i -le $sentCount; $i++) {
        try {
            $it = $sentItems.Item($i)
            if ($it.Class -ne 43) { continue }
            $convId = $it.ConversationID
            if (-not $convId) { continue }
            if (-not $convMap.ContainsKey($convId)) {
                $convMap[$convId] = @{ partners = @() }
            }
            foreach ($r in $it.Recipients) {
                $smtp = Get-RecipientSmtp $r
                if ($smtp -and $smtp -ne $myEmail -and ($convMap[$convId].partners -notcontains $smtp)) {
                    $convMap[$convId].partners += $smtp
                }
            }
        } catch {}
        if ($i % 100 -eq 0) { Log "  ...$i sent items processed" }
    }
}
Log "Conversation map built: $($convMap.Count) conversations you've replied in."

# ----------------------------------------------------------------------
# PHASE 4 - Route Inbox + Archive
# ----------------------------------------------------------------------

function Get-SenderSmtp {
    param($mailItem)
    try {
        if ($mailItem.SenderEmailType -eq 'EX') {
            try {
                $ex = $mailItem.Sender.GetExchangeUser()
                if ($ex) { return $ex.PrimarySmtpAddress.ToLower() }
            } catch {}
        }
        if ($mailItem.SenderEmailAddress -and $mailItem.SenderEmailAddress -like '*@*') {
            return $mailItem.SenderEmailAddress.ToLower()
        }
    } catch {}
    return $null
}

function Get-LocalPart {
    param([string]$smtp)
    if (-not $smtp) { return $null }
    if ($smtp -notlike '*@*') { return $null }
    return ($smtp -split '@')[0]
}

function Decide-Target {
    param([string]$fromSmtp, [string]$fromName, [string]$subject, [string]$convId)
    $msg = @{ FromSmtp = $fromSmtp; FromName = $fromName; Subject = $subject }

    # Yourself? leave (e.g. delegated forwards)
    if ($fromSmtp -eq $myEmail) { return $null }

    # Internal staff first
    if ($fromSmtp -like '*@selectlifestyles.co.uk' -or $fromSmtp -like '*@selectlifestyles.charity') {
        $local = Get-LocalPart $fromSmtp
        if ($deptMap.ContainsKey($local)) {
            return "Departments\$($deptMap[$local])"
        }
        # Special case: kgolestani -> External/Legal (Kian Golestani)
        if ($local -eq 'kgolestani') { return 'External\Legal\Carbon Law Partners' }
        return 'Departments\_Unmapped'
    }

    # External: rule match
    foreach ($rule in $rules) {
        if (& $rule.Test $msg) { return $rule.Target }
    }

    # External, unmatched: did I reply in this conversation?
    if ($convId -and $convMap.ContainsKey($convId)) {
        return 'External\Other'
    }

    # Otherwise leave in Inbox
    return $null
}

# Stats
$script:stats = @{}  # target -> count
$script:untouched = 0
$script:perFolder = @{}  # source folder name -> count

function Tally {
    param([string]$target, [string]$sourceFolder)
    if (-not $script:perFolder.ContainsKey($sourceFolder)) { $script:perFolder[$sourceFolder] = 0 }
    $script:perFolder[$sourceFolder]++
    if (-not $target) { $script:untouched++; return }
    if (-not $script:stats.ContainsKey($target)) { $script:stats[$target] = 0 }
    $script:stats[$target]++
}

# Map of category names lookup (lower-cased)
$schemeLookup = @{}
foreach ($s in $schemes) { $schemeLookup[$s.ToLower()] = $s }

function Get-SchemeCategories {
    param([string]$subject)
    $hits = @()
    if (-not $subject) { return $hits }
    $low = $subject.ToLower()
    foreach ($s in $schemes) {
        if ($low.Contains($s.ToLower())) { $hits += $s }
    }
    return $hits
}

function Move-OneItem {
    param($item, [string]$target, [string[]]$schemeCats)
    # categories first (additive)
    if ($schemeCats.Count -gt 0) {
        try {
            $existing = if ($item.Categories) { $item.Categories -split ';' | ForEach-Object { $_.Trim() } | Where-Object { $_ } } else { @() }
            $merged = ($existing + $schemeCats) | Select-Object -Unique
            $item.Categories = ($merged -join '; ')
            $item.Save()
        } catch {}
    }
    if ($target) {
        $folder = Resolve-Folder $target $false
        if ($folder) {
            $wasUnread = $item.UnRead
            [void]$item.Move($folder)
            # Move() preserves UnRead automatically; safety net:
        }
    }
}

Log ""
Log "--- PHASE 4: Routing Inbox + Archive ---"
foreach ($folderName in @('Inbox','Archive')) {
    $f = Get-Or-Create-Folder $root $folderName $false
    if (-not $f) { Log "  Skip - $folderName not found"; continue }
    $items = $f.Items
    $items.Sort('[ReceivedTime]', $true)
    $count = $items.Count
    Log "Processing $folderName ($count items)..."

    # Iterate from end to start because Move() shifts indices
    for ($i = $count; $i -ge 1; $i--) {
        try {
            $it = $items.Item($i)
            if ($it.Class -ne 43) { continue }
            $fromSmtp = Get-SenderSmtp $it
            $fromName = $it.SenderName
            $subject  = $it.Subject
            $convId   = $it.ConversationID
            $target   = Decide-Target $fromSmtp $fromName $subject $convId
            $cats     = Get-SchemeCategories $subject

            Tally $target $folderName

            if ($Execute -and ($target -or $cats.Count -gt 0)) {
                Move-OneItem $it $target $cats
            }
        } catch {
            Log "  ERROR on item: $($_.Exception.Message)"
        }
        if ($i % 500 -eq 0) { Log "  ...$($count - $i) of $count $folderName items examined" }
    }
}

# ----------------------------------------------------------------------
# REPORT
# ----------------------------------------------------------------------

Log ""
Log "=== ROUTING SUMMARY [$mode] ==="
$total = ($script:stats.Values | Measure-Object -Sum).Sum + $script:untouched
Log "  Stays in Inbox/Archive: $($script:untouched)"
Log "  Routed elsewhere:       $($total - $script:untouched)"
Log "  TOTAL examined:         $total"
Log ""
Log "Per source folder examined:"
$script:perFolder.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
    Log ("  {0,6}  {1}" -f $_.Value, $_.Key)
}
Log ""
Log "By target folder:"
$script:stats.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
    Log ("  {0,6}  {1}" -f $_.Value, $_.Key)
}

# Build report
$reportLines = @()
$reportLines += "Outlook Apply Report - $mode - $(Get-Date)"
$reportLines += "============================================="
$reportLines += ""
$reportLines += "Total examined: $total"
$reportLines += "Stays put:      $($script:untouched)"
$reportLines += "Routed:         $($total - $script:untouched)"
$reportLines += ""
$reportLines += "Per source folder examined:"
$script:perFolder.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
    $reportLines += ("  {0,6}  {1}" -f $_.Value, $_.Key)
}
$reportLines += ""
$reportLines += "Routing breakdown:"
$script:stats.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
    $reportLines += ("  {0,6}  {1}" -f $_.Value, $_.Key)
}
Save-WithRetry -path $reportFile -lines $reportLines

Log ""
Log "Full log: $logFile"
Log "Report:   $reportFile"

if (-not $Execute) {
    Log ""
    Log "*** This was a DRY-RUN. Nothing was changed. ***"
    Log "*** Review the report, then re-run with -Execute to apply for real. ***"
}

Close-Log
