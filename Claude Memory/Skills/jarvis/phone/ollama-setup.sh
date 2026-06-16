#!/data/data/com.termux/files/usr/bin/env bash
# ollama-setup.sh — Install Ollama on Termux (Android) as the v2 offline fallback
#                    LLM for jarvis.sh when api.anthropic.com is unreachable.
#
# Termux has no native Ollama binary; this uses proot-distro to run a Debian
# container, then Ollama inside it. Total footprint: ~3 GB (Debian + Ollama +
# llama3.2:1b model).
#
# Usage:
#   ollama-setup.sh           — dry-run: print the plan, don't change anything
#   ollama-setup.sh --yes     — actually install
#   ollama-setup.sh --model M — pull a different model (default: llama3.2:1b)
#
# After install, start the daemon with:
#   proot-distro login debian -- ollama serve &
# and query with:
#   curl http://localhost:11434/api/generate -d '{"model":"llama3.2:1b","prompt":"hi"}'

set -euo pipefail

MODEL="llama3.2:1b"
DO_INSTALL=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --yes) DO_INSTALL=1; shift ;;
        --model) MODEL="$2"; shift 2 ;;
        -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
        *) echo "Unknown arg: $1" >&2; exit 2 ;;
    esac
done

cat <<EOF
=============================================
Ollama on Termux — install plan
=============================================
Steps:
  1. pkg install proot-distro          (~30 MB)
  2. proot-distro install debian       (~500 MB)
  3. apt install curl + ollama install (~250 MB)
  4. ollama pull $MODEL                (~1.3 GB for 1b, ~2 GB for 3b)

Total disk: ~2–3 GB depending on model.
Persistent: stays installed across reboots.

EOF

if [[ "$DO_INSTALL" -eq 0 ]]; then
    echo "Dry run. Re-run with --yes to actually install."
    exit 0
fi

echo "[1/4] Installing proot-distro..."
if ! command -v proot-distro &>/dev/null; then
    pkg install -y proot-distro
else
    echo "✓ already installed"
fi

echo "[2/4] Installing Debian container..."
if ! proot-distro list -q 2>/dev/null | grep -qx debian; then
    proot-distro install debian
else
    echo "✓ already installed"
fi

echo "[3/4] Installing Ollama inside Debian..."
proot-distro login debian -- bash -c '
    set -euo pipefail
    if ! command -v ollama &>/dev/null; then
        apt-get update -qq
        apt-get install -y -qq curl
        curl -fsSL https://ollama.com/install.sh | sh
    else
        echo "✓ Ollama already installed"
    fi
'

echo "[4/4] Pulling model $MODEL..."
proot-distro login debian -- bash -c "
    set -euo pipefail
    # Start daemon if not already responding on 11434
    if ! curl -sf http://127.0.0.1:11434/ >/dev/null 2>&1; then
        nohup ollama serve >/tmp/ollama.log 2>&1 &
        # Poll up to 30s for daemon readiness
        for i in \$(seq 1 30); do
            if curl -sf http://127.0.0.1:11434/ >/dev/null 2>&1; then
                break
            fi
            sleep 1
        done
        if ! curl -sf http://127.0.0.1:11434/ >/dev/null 2>&1; then
            echo 'ERROR: ollama serve never became ready. See /tmp/ollama.log inside debian.' >&2
            exit 1
        fi
    fi
    ollama pull $MODEL
"

cat <<EOF

✅ Ollama setup complete.

Daily use:
  # Start the daemon (run once per Termux session)
  proot-distro login debian -- bash -c 'nohup ollama serve >/tmp/ollama.log 2>&1 &'

  # Query (from inside or outside the container — port 11434 is shared)
  curl http://localhost:11434/api/generate -d '{"model":"$MODEL","prompt":"hi","stream":false}'

Next step: wire offline fallback into jarvis.sh — if network-check.sh fails,
route the classifier prompt to Ollama instead of \`claude\`.
EOF
