#!/usr/bin/env bash
# =============================================================================
# bootstrap-obsidian-cli.sh
#
# Bring the Obsidian CLI up in a headless Linux environment (Claude cloud
# session, CI runner, container) so the `obsidian:obsidian-cli` skill works.
#
# The CLI is only a client: it talks to a RUNNING Obsidian desktop app over a
# unix socket. There is no server-less mode. So this script installs the real
# Electron app and runs it against a virtual X display.
#
# Idempotent — safe to re-run. Typical use at the start of a fresh session:
#
#     bash Scripts/obsidian-cli/bootstrap-obsidian-cli.sh
#     obsidian version
#
# Overridable environment:
#   OBSIDIAN_VERSION   default 1.13.7
#   VAULT_DIR          default /root/vaults/Obsidian-Vault-
#   VAULT_REPO         default https://github.com/etblues449/Obsidian-Vault-.git
#   VAULT_BRANCH       default master
#   OBSIDIAN_DISPLAY   default 99
#   SKIP_CLONE=1       use VAULT_DIR as-is, do not clone or pull
# =============================================================================
set -uo pipefail

OBSIDIAN_VERSION="${OBSIDIAN_VERSION:-1.13.7}"
VAULT_DIR="${VAULT_DIR:-/root/vaults/Obsidian-Vault-}"
VAULT_REPO="${VAULT_REPO:-https://github.com/etblues449/Obsidian-Vault-.git}"
VAULT_BRANCH="${VAULT_BRANCH:-master}"
OBSIDIAN_DISPLAY="${OBSIDIAN_DISPLAY:-99}"
SKIP_CLONE="${SKIP_CLONE:-0}"

APP_DIR=/opt/Obsidian
APP_BIN="$APP_DIR/obsidian"
CLI_BIN="$APP_DIR/obsidian-cli"
DEB_CACHE=/opt/obsidian-dl
CONFIG_DIR="$HOME/.config/obsidian"
LOG_DIR=/var/log/obsidian

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
info() { printf '    %s\n' "$1"; }
die()  { printf '\n\033[31mERROR: %s\033[0m\n' "$1" >&2; exit 1; }
obsidian_cli_eval() { "$HOME/.local/bin/obsidian" eval code="$1" 2>&1; }


[ "$(id -u)" -eq 0 ] || die "run as root (Electron needs --no-sandbox and this writes to /opt)"

# -----------------------------------------------------------------------------
step "1/6  Obsidian $OBSIDIAN_VERSION"
# -----------------------------------------------------------------------------
if [ -x "$CLI_BIN" ]; then
  info "already installed at $APP_DIR"
else
  mkdir -p "$DEB_CACHE"
  DEB="$DEB_CACHE/obsidian_${OBSIDIAN_VERSION}_amd64.deb"
  URL="https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/obsidian_${OBSIDIAN_VERSION}_amd64.deb"
  if [ ! -s "$DEB" ]; then
    info "downloading $URL"
    curl -sSL --fail --max-time 600 -o "$DEB" "$URL" || die "download failed"
  fi
  info "installing $(du -h "$DEB" | cut -f1) package + Electron dependencies"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq >/dev/null 2>&1
  apt-get install -y -qq "$DEB" >/dev/null 2>&1 || die "apt install failed"
  [ -x "$CLI_BIN" ] || die "obsidian-cli missing from package"
  info "installed"
fi

# Xvfb is how a GUI app runs with no monitor attached.
if ! command -v Xvfb >/dev/null 2>&1; then
  info "installing Xvfb"
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq xvfb >/dev/null 2>&1 || die "could not install Xvfb"
fi

# -----------------------------------------------------------------------------
step "2/6  Vault at $VAULT_DIR"
# -----------------------------------------------------------------------------
if [ "$SKIP_CLONE" = "1" ]; then
  info "SKIP_CLONE=1 — using existing directory"
  [ -d "$VAULT_DIR" ] || die "$VAULT_DIR does not exist"
elif [ -d "$VAULT_DIR/.git" ]; then
  info "already cloned; fetching $VAULT_BRANCH"
  git -C "$VAULT_DIR" fetch --quiet origin "$VAULT_BRANCH" 2>/dev/null
  if [ -z "$(git -C "$VAULT_DIR" status --porcelain)" ]; then
    git -C "$VAULT_DIR" merge --quiet --ff-only "origin/$VAULT_BRANCH" 2>/dev/null \
      && info "fast-forwarded to origin/$VAULT_BRANCH" \
      || info "no fast-forward available — left at local HEAD"
  else
    info "local changes present — not merging"
  fi
else
  mkdir -p "$(dirname "$VAULT_DIR")"
  info "cloning $VAULT_REPO"
  git clone --quiet --branch "$VAULT_BRANCH" "$VAULT_REPO" "$VAULT_DIR" || die "clone failed"
fi
info "$(find "$VAULT_DIR" -name '*.md' -not -path '*/.git/*' | wc -l) markdown files"

# -----------------------------------------------------------------------------
step "3/6  App config (register vault, enable CLI)"
# -----------------------------------------------------------------------------
# The "Command line interface" toggle in Settings > General > Advanced is just
# `"cli": true` in this file. Setting it here is exactly what the toggle does.
mkdir -p "$CONFIG_DIR" "$LOG_DIR"
VAULT_DIR="$VAULT_DIR" CONFIG_DIR="$CONFIG_DIR" python3 - <<'PY'
import json, os, hashlib, time, pathlib
vault = os.environ['VAULT_DIR']
p = pathlib.Path(os.environ['CONFIG_DIR']) / 'obsidian.json'
cfg = {}
if p.exists():
    try:
        cfg = json.loads(p.read_text())
    except Exception:
        cfg = {}
vaults = cfg.get('vaults') or {}
vid = hashlib.sha1(vault.encode()).hexdigest()[:16]
for v in vaults.values():
    v['open'] = False
vaults[vid] = {'path': vault, 'ts': int(time.time() * 1000), 'open': True}
cfg['vaults'] = vaults
cfg['cli'] = True             # Settings > General > Advanced > Command line interface
cfg['updateDisabled'] = True  # never auto-update inside an ephemeral container
p.write_text(json.dumps(cfg))
print(f"    vault id {vid}, cli enabled")
PY

# -----------------------------------------------------------------------------
step "4/6  Launcher and CLI wrapper"
# -----------------------------------------------------------------------------
# Socket path inside the app is:
#     $XDG_RUNTIME_DIR/.obsidian-cli.sock  (or $HOME/.obsidian-cli.sock if unset)
# Containers hand out an inconsistent XDG_RUNTIME_DIR between shells, which
# leaves the CLI looking for a socket the app never created. Both sides unset
# it, so the path is always $HOME/.obsidian-cli.sock.
cat > /usr/local/bin/obsidian-headless-start <<EOS
#!/usr/bin/env bash
set -uo pipefail
export HOME="\${OBSIDIAN_HOME:-$HOME}"
unset XDG_RUNTIME_DIR
DNUM="\${OBSIDIAN_DISPLAY:-$OBSIDIAN_DISPLAY}"
export DISPLAY=":\$DNUM"
mkdir -p $LOG_DIR

# --- virtual display -------------------------------------------------------
# setsid detaches it from this script, so it outlives the shell that started it.
if ! pgrep -x Xvfb >/dev/null 2>&1; then
  setsid Xvfb "\$DISPLAY" -screen 0 1600x1200x24 -nolisten tcp \\
    >$LOG_DIR/xvfb.log 2>&1 < /dev/null &
  disown 2>/dev/null || true
fi
# Electron segfaults if it connects before the X server finishes initialising,
# so wait for the socket rather than guessing with sleep.
for i in \$(seq 1 30); do
  [ -S "/tmp/.X11-unix/X\$DNUM" ] && break
  sleep 0.5
done
[ -S "/tmp/.X11-unix/X\$DNUM" ] || { echo "Xvfb never came up; see $LOG_DIR/xvfb.log" >&2; exit 1; }
sleep 1

# --- app -------------------------------------------------------------------
if pgrep -x obsidian >/dev/null 2>&1; then
  echo "Obsidian already running (pid \$(pgrep -x obsidian | head -1))"
  exit 0
fi

for attempt in 1 2 3; do
  setsid $APP_BIN \\
    --no-sandbox --disable-gpu --disable-dev-shm-usage --disable-software-rasterizer \\
    >>$LOG_DIR/app.log 2>&1 < /dev/null &
  disown 2>/dev/null || true
  for i in \$(seq 1 60); do
    sleep 1
    if [ -S "\$HOME/.obsidian-cli.sock" ] && $CLI_BIN version >/dev/null 2>&1; then
      echo "Obsidian ready after \${i}s (attempt \$attempt)"
      exit 0
    fi
    pgrep -x obsidian >/dev/null 2>&1 || break   # died early: retry
  done
  echo "attempt \$attempt failed, retrying" >&2
  pkill -x obsidian 2>/dev/null; sleep 2
done
echo "Obsidian did not become ready; see $LOG_DIR/app.log" >&2
exit 1
EOS
chmod +x /usr/local/bin/obsidian-headless-start

# `obsidian` on PATH must be the CLI, not the 220 MB Electron binary that the
# .deb puts at /usr/bin/obsidian. ~/.local/bin precedes /usr/bin, which is the
# same layout the app's own Linux registration produces.
cat > /usr/local/bin/obsidian-cli-wrapper <<EOS
#!/usr/bin/env bash
set -uo pipefail
export HOME="\${OBSIDIAN_HOME:-$HOME}"
unset XDG_RUNTIME_DIR
if ! pgrep -x obsidian >/dev/null 2>&1; then
  /usr/local/bin/obsidian-headless-start >/dev/null 2>&1 || {
    echo "Could not start Obsidian; see $LOG_DIR/app.log" >&2
    exit 1
  }
fi
exec $CLI_BIN "\$@"
EOS
chmod +x /usr/local/bin/obsidian-cli-wrapper
mkdir -p "$HOME/.local/bin"
ln -sf /usr/local/bin/obsidian-cli-wrapper "$HOME/.local/bin/obsidian"
info "obsidian -> $HOME/.local/bin/obsidian (CLI wrapper, auto-starts the app)"

case ":$PATH:" in
  *":$HOME/.local/bin:"*) : ;;
  *) info "NOTE: add $HOME/.local/bin to PATH:  export PATH=\"\$HOME/.local/bin:\$PATH\"" ;;
esac

# -----------------------------------------------------------------------------
step "5/6  Start Obsidian"
# -----------------------------------------------------------------------------
/usr/local/bin/obsidian-headless-start || die "app did not start"

# Opening the vault makes the Daily Notes core plugin materialise today's note.
# An empty, untracked one is bootstrap noise, not content — drop it so it never
# gets swept into a commit.
if [ -d "$VAULT_DIR/.git" ] && command -v python3 >/dev/null 2>&1; then
  DAILY_REL="$(VAULT_DIR="$VAULT_DIR" python3 - <<'PY'
import json, os, pathlib, datetime
v = pathlib.Path(os.environ['VAULT_DIR'])
cfg = v / '.obsidian' / 'daily-notes.json'
if cfg.exists():
    try:
        d = json.loads(cfg.read_text())
    except Exception:
        d = {}
    fmt = (d.get('format') or 'YYYY-MM-DD')
    folder = (d.get('folder') or '').strip('/')
    py = fmt.replace('YYYY', '%Y').replace('MM', '%m').replace('DD', '%d')
    name = datetime.date.today().strftime(py) + '.md'
    print(str(pathlib.Path(folder) / name) if folder else name)
PY
)"
  if [ -n "$DAILY_REL" ] && [ -f "$VAULT_DIR/$DAILY_REL" ] && [ ! -s "$VAULT_DIR/$DAILY_REL" ] \
     && [ -n "$(git -C "$VAULT_DIR" ls-files --others --exclude-standard -- "$DAILY_REL")" ]; then
    rm -f "$VAULT_DIR/$DAILY_REL"
    info "removed empty auto-created daily note $DAILY_REL"
  fi
fi

# --- safety: never let the headless instance become a git writer -------------
# obsidian-git is enabled in this vault with autoSaveInterval/autoPushInterval 10
# and autoPullOnBoot. A container that loaded it would be a second, unattended
# writer pushing to master every ten minutes. Obsidian opens an untrusted vault
# in Restricted Mode so community plugins stay off, but do not rely on that
# holding — assert it. disablePlugin() is the runtime-only call; the *AndSave
# variant would rewrite .obsidian/community-plugins.json and land in a commit.
WRITERS="$(obsidian_cli_eval "(() => {
  const risky = ['obsidian-git'];
  const live = risky.filter(id => app.plugins.plugins[id]);
  live.forEach(id => app.plugins.disablePlugin(id));
  return live.length ? 'DISABLED ' + live.join(', ') : 'none loaded';
})()")"
info "auto-writer plugins: ${WRITERS#=> }"

# -----------------------------------------------------------------------------
step "6/6  Check"
# -----------------------------------------------------------------------------
export PATH="$HOME/.local/bin:$PATH"
V="$(obsidian version 2>&1)"
case "$V" in
  [0-9]*) info "obsidian version -> $V"
          info "vault           -> $(obsidian vaults 2>&1 | head -1)"
          info "indexed files   -> $(obsidian eval code='app.vault.getMarkdownFiles().length' 2>&1)"
          printf '\n\033[32mReady.\033[0m  Run the full suite with:\n  bash %s\n\n' \
                 "$VAULT_DIR/Scripts/obsidian-cli/verify-obsidian-cli.sh" ;;
  *)      die "CLI did not answer: $V" ;;
esac
