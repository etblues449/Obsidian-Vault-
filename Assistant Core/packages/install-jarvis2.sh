#!/data/data/com.termux/files/usr/bin/sh
# JARVIS v2 installer — run once in Termux:  sh ~/storage/downloads/install-jarvis2.sh
set -e
SHA_EXPECTED="f89a2deae4e2af76c9148a7465e1207164eeb240e984624f6b057eedb3601147"
echo "== JARVIS v2 install =="
[ -d "$HOME/storage" ] || { echo "Running termux-setup-storage first — allow the permission, then re-run this."; termux-setup-storage; exit 1; }
PKG=""
for d in "$HOME/storage/downloads" "$HOME/downloads" "$HOME"; do
  [ -d "$d" ] || continue
  c=$(ls -t "$d"/jarvis2-v2*.tar.gz 2>/dev/null | head -1) && [ -n "$c" ] && PKG="$c" && break
done
[ -n "$PKG" ] || { echo "✗ jarvis2-v2.tar.gz not found in Downloads. Download it from the chat first."; exit 1; }
echo "Found: $PKG"
SHA_ACTUAL=$(sha256sum "$PKG" | cut -d' ' -f1)
[ "$SHA_ACTUAL" = "$SHA_EXPECTED" ] || { echo "✗ SHA-256 mismatch — the download is corrupt. Expected $SHA_EXPECTED, got $SHA_ACTUAL. Re-download and re-run."; exit 1; }
echo "✓ SHA-256 verified"
[ -d "$HOME/jarvis-core" ] || { echo "✗ ~/jarvis-core not found — is this the right device?"; exit 1; }
if [ -d "$HOME/jarvis-core/jarvis2" ]; then
  BK="$HOME/jarvis-core/jarvis2.backup.$(date +%Y%m%d-%H%M%S)"
  mv "$HOME/jarvis-core/jarvis2" "$BK"; echo "✓ existing jarvis2/ backed up to $BK"
fi
TMP=$(mktemp -d); tar -xzf "$PKG" -C "$TMP"
mv "$TMP/jarvis2" "$HOME/jarvis-core/jarvis2"
mkdir -p "$HOME/.termux/boot" "$HOME/.shortcuts"
cp "$TMP/boot/jarvis-boot" "$HOME/.termux/boot/jarvis-boot"
cp "$TMP/shortcuts/JARVIS" "$HOME/.shortcuts/JARVIS"
chmod +x "$HOME/.termux/boot/jarvis-boot" "$HOME/.shortcuts/JARVIS" 
rm -rf "$TMP"
node --check "$HOME/jarvis-core/jarvis2/server.mjs" && echo "✓ launcher syntax OK on this device"
sh "$HOME/.termux/boot/jarvis-boot"
sleep 2
if pgrep -f "jarvis2/server.mjs" > /dev/null 2>&1; then echo "✓ JARVIS v2 launcher is RUNNING on http://localhost:1875"; else echo "✗ launcher did not start — check ~/jarvis-core/logs/jarvis2.log"; exit 1; fi
echo ""
echo "== One-time steps (do these now, once, ~3 minutes) =="
echo " 1. Install 'Termux:Boot' from F-Droid, open it ONCE (that registers it)."
echo " 2. Android Settings → Apps → Termux → Battery → Unrestricted. Same for Termux:Boot."
echo " 3. Chrome → http://localhost:1875 → menu ⋮ → 'Add to Home screen' → Install."
echo "    You now have a JARVIS app icon. Allow the microphone when it asks."
echo ""
echo "From now on: the phone boots → JARVIS is already running. Tap the icon → talk."
