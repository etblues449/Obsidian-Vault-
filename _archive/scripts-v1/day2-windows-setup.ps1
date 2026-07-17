<#
.SYNOPSIS
    Jarvis Day 2/3 — Windows PC setup helper for n8n + Obsidian Local REST API.

.DESCRIPTION
    Stands up the always-on n8n container on this Windows PC and prints the LAN
    details + the remaining MANUAL steps (Obsidian plugin token, n8n env vars,
    workflow import). It is deliberately conservative:

      - It only RUNS n8n (a reversible `docker run`). It does NOT edit the
        firewall, router, Obsidian config, or n8n credentials for you — those
        either need a GUI (Obsidian, n8n editor) or change system state, so the
        script PRINTS the exact commands/steps and lets you run them knowingly.
      - It is idempotent: if an `n8n` container already exists it reports status
        and offers to (re)start it rather than erroring or duplicating.

    Run from an ordinary PowerShell window (no admin needed just to start the
    container). The optional firewall step at the end DOES need an elevated
    shell — the script prints that command for you to paste into an admin
    PowerShell rather than self-elevating.

.NOTES
    Verified 2026-06-08. See docs/PC_SETUP.md for the full checklist + sources.
    Image: docker.n8n.io/n8nio/n8n  (official, per n8n Docker docs)
#>

[CmdletBinding()]
param(
    # n8n host port (container always listens on 5678 internally).
    [int]$Port = 5678,

    # Docker named volume that persists n8n's data (~/.n8n inside the container:
    # workflows, credentials, encryption key). Survives container re-creation.
    [string]$VolumeName = "n8n_data",

    # Container name. Re-used so the script stays idempotent.
    [string]$ContainerName = "n8n",

    # LAN subnet allowed through the firewall (LAN-only, never the whole world).
    [string]$LanCidr = "192.168.0.0/24",

    # IANA timezone for n8n's Schedule/Cron nodes (e.g. Europe/London, America/New_York).
    # Adjust to your zone; wrong TZ = digests fire at the wrong hour.
    [string]$TimeZone = "Europe/London",

    # If set, the script will (re)create the container even if one exists,
    # after confirming. Without it, an existing container is left in place.
    [switch]$Recreate
)

$ErrorActionPreference = "Stop"

function Write-Step  { param($m) Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Write-Ok    { param($m) Write-Host "  [ok]   $m" -ForegroundColor Green }
function Write-Warn2 { param($m) Write-Host "  [warn] $m" -ForegroundColor Yellow }
function Write-Info  { param($m) Write-Host "  $m" -ForegroundColor Gray }

# ---------------------------------------------------------------------------
# 1. Preconditions — Docker present and the engine actually running
# ---------------------------------------------------------------------------
Write-Step "1. Checking Docker"

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Warn2 "Docker CLI not found on PATH."
    Write-Info  "Install Docker Desktop for Windows, then re-run this script:"
    Write-Info  "    https://docs.docker.com/desktop/install/windows-install/"
    Write-Info  "After install: open Docker Desktop once so the engine starts, and tick"
    Write-Info  "    Settings -> General -> 'Start Docker Desktop when you sign in'."
    return
}
Write-Ok "docker CLI found: $($docker.Source)"

# `docker info` fails fast if the engine/daemon isn't up (Desktop not started).
try {
    docker info *> $null
    if ($LASTEXITCODE -ne 0) { throw "docker info returned $LASTEXITCODE" }
    Write-Ok "Docker engine is running."
}
catch {
    Write-Warn2 "Docker is installed but the engine isn't responding."
    Write-Info  "Start Docker Desktop (wait for the whale icon to go steady), then re-run."
    return
}

# ---------------------------------------------------------------------------
# 2. Persistent volume — created once, reused forever
# ---------------------------------------------------------------------------
Write-Step "2. Ensuring persistent volume '$VolumeName'"

$volExists = (docker volume ls --quiet --filter "name=^$VolumeName$")
if ($volExists) {
    Write-Ok "Volume '$VolumeName' already exists (keeping your workflows + creds)."
} else {
    docker volume create $VolumeName | Out-Null
    Write-Ok "Created volume '$VolumeName'."
}

# ---------------------------------------------------------------------------
# 3. The n8n container — idempotent (re)start
# ---------------------------------------------------------------------------
Write-Step "3. n8n container '$ContainerName'"

# Does a container with this name already exist (running or stopped)?
$existing = (docker ps -a --quiet --filter "name=^$ContainerName$")

# Build the run args once so the "create" path is unambiguous.
#  -d                      detached (background) — this is an always-on box
#  --restart unless-stopped  survives reboots/crashes; only stays down if YOU stop it
#  -p Port:5678            publish to the host (and thus the LAN, once firewalled)
#  -v VolumeName:/home/node/.n8n   persistent data
#  N8N_SECURE_COOKIE=false LAN access over plain http:// (no TLS) won't be blocked
#  GENERIC_TIMEZONE / TZ   correct local time for Schedule/Cron nodes
#  N8N_HOST=0.0.0.0        listen on all interfaces inside the container
$runArgs = @(
    "run","-d",
    "--name",$ContainerName,
    "--restart","unless-stopped",
    "-p","$($Port):5678",
    "-v","$($VolumeName):/home/node/.n8n",
    "-e","N8N_SECURE_COOKIE=false",
    "-e","GENERIC_TIMEZONE=$TimeZone",
    "-e","TZ=$TimeZone",
    "-e","N8N_HOST=0.0.0.0",
    "docker.n8n.io/n8nio/n8n"
)

function Start-Fresh {
    Write-Info "Pulling latest image (docker.n8n.io/n8nio/n8n)..."
    docker pull docker.n8n.io/n8nio/n8n | Out-Null
    docker @runArgs | Out-Null
    Write-Ok "Started container '$ContainerName' (detached, restart=unless-stopped)."
}

if (-not $existing) {
    Start-Fresh
}
else {
    $isRunning = (docker ps --quiet --filter "name=^$ContainerName$")
    if ($Recreate) {
        Write-Warn2 "Container '$ContainerName' exists; -Recreate was passed."
        $ans = Read-Host "Remove and recreate it? Your workflows/creds in volume '$VolumeName' are preserved (y/N)"
        if ($ans -match '^(y|yes)$') {
            docker rm -f $ContainerName | Out-Null
            Write-Ok "Removed old container."
            Start-Fresh
        } else {
            Write-Info "Left existing container untouched."
        }
    }
    elseif ($isRunning) {
        Write-Ok "Container '$ContainerName' is already running. Nothing to do."
        Write-Info "To upgrade n8n later: re-run with -Recreate (volume keeps your data)."
    }
    else {
        Write-Warn2 "Container '$ContainerName' exists but is stopped."
        docker start $ContainerName | Out-Null
        Write-Ok "Started existing container '$ContainerName'."
    }
}

# Quick health note (n8n takes a few seconds to come up the first time).
Write-Info "n8n will be reachable on this PC at: http://localhost:$Port"

# ---------------------------------------------------------------------------
# 4. LAN IP discovery — what the phone/HA will POST to
# ---------------------------------------------------------------------------
Write-Step "4. This PC's LAN IP (for the phone webhook + OBSIDIAN_REST_URL)"

# Prefer a real private LAN IPv4 on an 'Up' adapter; skip loopback, APIPA,
# and Docker/WSL/Hyper-V virtual switches (those would mislead the phone).
$lanIps = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
        $_.IPAddress -notlike "127.*"      -and
        $_.IPAddress -notlike "169.254.*"  -and
        $_.InterfaceAlias -notmatch "Loopback|vEthernet|WSL|Docker|Hyper-V|Default Switch"
    } |
    Sort-Object -Property @{ Expression = { $_.IPAddress -like "192.168.*" }; Descending = $true }

if ($lanIps) {
    foreach ($ip in $lanIps) {
        Write-Ok ("{0}  (adapter: {1})" -f $ip.IPAddress, $ip.InterfaceAlias)
    }
    $primary = $lanIps[0].IPAddress
    Write-Info ""
    Write-Info "Most likely LAN IP: $primary"
    Write-Info "Phone (Tasker/HTTP Shortcuts) should POST to:"
    Write-Info "    http://$primary`:$Port/webhook/jarvis-capture"
    Write-Warn2 "Pin this IP with a DHCP reservation in your router (see step 6) so it never moves."
} else {
    Write-Warn2 "Could not auto-detect a LAN IPv4. Run 'ipconfig' and use the IPv4 of your Wi-Fi/Ethernet adapter."
}

# Placeholder used in the printed curl below. Avoids the PS7-only '??' operator
# so this script also runs under Windows PowerShell 5.1 (the Windows default).
if ($primary) { $testIp = $primary } else { $testIp = "<PC-IP>" }

# ---------------------------------------------------------------------------
# 5. MANUAL steps the script intentionally does NOT automate
# ---------------------------------------------------------------------------
Write-Step "5. Next MANUAL steps (GUI / state changes — do these yourself)"

Write-Host @"
  A) Obsidian Local REST API plugin (desktop Obsidian on THIS PC)
     1. Obsidian -> Settings -> Community plugins -> Browse -> install
        'Local REST API' (coddingtonbear) -> Enable.
     2. Settings -> Local REST API:
          - Copy the API key (long random string)  -> this is OBSIDIAN_REST_TOKEN.
          - Default HTTPS port 27124 (self-signed cert). HTTP 27123 is OFF by default.
          - CHANGE 'Binding host' / bind address from 127.0.0.1 to 0.0.0.0
            so n8n-in-Docker and other LAN machines can reach it.
     3. Keep desktop Obsidian RUNNING with the vault open (it does the writes).

  B) n8n environment variables (n8n editor in your browser)
     Open http://localhost:$Port -> set up owner account -> then:
       Settings -> Variables  (or env on the container) and add:
         ANTHROPIC_KEY        = sk-ant-...
         HA_URL               = http://192.168.0.50:8123
         HA_TOKEN             = <Home Assistant long-lived token>
         OBSIDIAN_REST_URL    = https://host.docker.internal:27124
                                ^^ from INSIDE the Docker container, 'host.docker.internal'
                                   is THIS PC. Do NOT use localhost (that's the container).
         OBSIDIAN_REST_TOKEN  = <the API key from step A2>

  C) Import the Capture Router workflow
     n8n -> Workflows -> (...) menu -> Import from File ->
        'Claude Memory/Skills/jarvis/resources/n8n-capture-router.json'
     Then Activate it (toggle top-right). The vault-write node already has
     'allowUnauthorizedCerts = true' for the self-signed 27124 cert.

  D) Test the full chain (PowerShell, from THIS PC or your phone's IP):
       curl.exe -X POST "http://$testIp`:$Port/webhook/jarvis-capture" ``
         -H "Content-Type: application/json" ``
         -d '{\"text\":\"note: jarvis end to end test\",\"source\":\"setup-script\",\"ts\":\"2026-06-08T12:00:00Z\"}'
     Expect: {"ok":true,...}  and a new line appended to the routed note,
     which Obsidian Sync then fans out to your phone + laptop.
"@ -ForegroundColor Gray

# ---------------------------------------------------------------------------
# 6. Firewall (LAN-only) — printed, NOT executed (needs admin + changes state)
# ---------------------------------------------------------------------------
Write-Step "6. Open the firewall to your LAN only (run in an ADMIN PowerShell)"

Write-Host @"
  These allow inbound TCP to n8n (and the Obsidian REST API) ONLY from $LanCidr.
  Paste into an elevated PowerShell (Run as administrator):

    New-NetFirewallRule -DisplayName "Jarvis n8n ($Port) LAN" ``
      -Direction Inbound -Protocol TCP -LocalPort $Port ``
      -RemoteAddress $LanCidr -Action Allow -Profile Private

    New-NetFirewallRule -DisplayName "Jarvis Obsidian REST (27124) LAN" ``
      -Direction Inbound -Protocol TCP -LocalPort 27124 ``
      -RemoteAddress $LanCidr -Action Allow -Profile Private

  Notes:
    - -Profile Private assumes your home network is classified 'Private'.
      Check with Get-NetConnectionProfile; if it says 'Public', either switch it
      to Private or add -Profile Public (less safe).
    - 27124 is only needed if you also reach the Obsidian API from OTHER LAN
      machines. n8n itself talks to it via host.docker.internal and usually does
      NOT need the firewall rule (loopback). Add it only if a remote test fails.
    - To remove later: Remove-NetFirewallRule -DisplayName "Jarvis n8n ($Port) LAN"
"@ -ForegroundColor Gray

# ---------------------------------------------------------------------------
# 7. Keep it always-on across logins
# ---------------------------------------------------------------------------
Write-Step "7. Auto-start on login (single point of failure mitigation)"

Write-Host @"
  Docker Desktop:  Settings -> General -> tick
      'Start Docker Desktop when you sign in to your computer'.
    (Docker Desktop on Windows only starts AFTER a user logs in — it cannot run
     pre-login without extra Task Scheduler work. For a personal box, enabling
     auto-login + this checkbox is the pragmatic path.)
  n8n container:   already has --restart unless-stopped, so it returns whenever
      the Docker engine starts. No extra step.
  Obsidian:        must be running for vault writes. Add a shortcut to:
      Win+R -> shell:startup   (paste an Obsidian shortcut there), OR install the
      'Obsidian Tray' community plugin and enable 'Launch on system startup'.

  REMINDER: if this PC or desktop Obsidian is OFF, the Local REST API write FAILS.
  Mitigations: (1) the workflow's Filesystem-node fallback (see docs/PC_SETUP.md),
  (2) the phone's offline QuickAdd capture path, drained later.
"@ -ForegroundColor Gray

Write-Step "Done"
Write-Ok "n8n is up. Finish steps A-D above, open the firewall (step 6), and set auto-start (step 7)."
Write-Info "Full checklist + sources: Claude Memory/Skills/jarvis/docs/PC_SETUP.md"
