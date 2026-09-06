"""Executor configuration.

Everything comes from environment variables, optionally seeded from
``~/.config/tradeguard/executor.env`` (KEY=VALUE lines; existing env wins).
Nothing here is ever written into the vault — the vault holds only the
*names* of these variables (CLAUDE.md rule).

Required to trade:
    OANDA_TOKEN            personal access token (Manage API Access)
    OANDA_ACCOUNT_ID       e.g. 001-004-1234567-001
    TG_API_ID / TG_API_HASH  my.telegram.org (read-only user session)

Optional:
    OANDA_ENV              practice (default) | live
    OANDA_INSTRUMENT       XAU_USD (default)
    TG_CHANNELS            comma list of channel titles or ids (default: GOLD VIP,THE WAR ZONE)
    TG_SESSION             path to the Telethon session file (default: <state dir>/executor_tg)
    SUPABASE_URL / SUPABASE_KEY   PostgREST base + service-role key (worker only)
    TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID   outbound alerts
    RISK_PCT=1  DAILY_LOSS_PCT=5  MAX_TRADES_PER_DAY=3  MAX_DD_PCT=20
    MAX_OPEN_TRADES=1      refuse a new signal while this many trades are open
    MAX_ENTRY_DRIFT=0.5    refuse if price has already moved this fraction of the stop distance
    MIN_SAMPLE=30  MIN_DAYS=28  PF_MIN=1.3
    GATE_OVERRIDE          the exact phrase in OVERRIDE_PHRASE, or unset
    KILL_SWITCH_FILE       default <state dir>/KILL — existence halts new orders
    STATE_DIR              default ~/.config/tradeguard
    DRY_RUN=0|1            size and log, never send orders
    LOG_LEVEL=INFO
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

OVERRIDE_PHRASE = "I ACCEPT THE RISK OF LIVE TRADING WITHOUT A PASSED GATE"

HOSTS = {
    "practice": ("https://api-fxpractice.oanda.com", "https://stream-fxpractice.oanda.com"),
    "live": ("https://api-fxtrade.oanda.com", "https://stream-fxtrade.oanda.com"),
}


class ConfigError(ValueError):
    """Raised when required configuration is missing or invalid."""


def default_state_dir() -> Path:
    base = os.environ.get("XDG_CONFIG_HOME")
    root = Path(base) if base else Path.home() / ".config"
    return root / "tradeguard"


def load_env_file(path: Path) -> int:
    """Seed os.environ from a KEY=VALUE file. Existing variables win.

    Returns the number of keys set. Lines starting with '#' and blank lines
    are ignored; a single pair of matching quotes around the value is stripped.
    """
    if not path.exists():
        return 0
    n = 0
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if key and key not in os.environ:
            os.environ[key] = value
            n += 1
    return n


def _bool(value: Optional[str], default: bool = False) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except ValueError as exc:
        raise ConfigError(f"{name} must be a number, got {raw!r}") from exc


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise ConfigError(f"{name} must be an integer, got {raw!r}") from exc


@dataclass(frozen=True)
class Settings:
    oanda_env: str
    oanda_token: str
    oanda_account_id: str
    instrument: str

    tg_api_id: Optional[int]
    tg_api_hash: Optional[str]
    tg_session: Path
    tg_channels: tuple

    supabase_url: Optional[str]
    supabase_key: Optional[str]

    telegram_bot_token: Optional[str]
    telegram_chat_id: Optional[str]

    risk_pct: float
    daily_loss_pct: float
    max_trades_per_day: int
    max_dd_pct: float
    max_open_trades: int
    max_entry_drift: float
    min_sample: int
    min_days: int
    pf_min: float

    gate_override: bool
    kill_switch_file: Path
    state_dir: Path
    dry_run: bool
    log_level: str

    @property
    def is_live(self) -> bool:
        return self.oanda_env == "live"

    @property
    def rest_host(self) -> str:
        return HOSTS[self.oanda_env][0]

    @property
    def stream_host(self) -> str:
        return HOSTS[self.oanda_env][1]

    @property
    def has_supabase(self) -> bool:
        return bool(self.supabase_url and self.supabase_key)

    @property
    def has_telegram_alerts(self) -> bool:
        return bool(self.telegram_bot_token and self.telegram_chat_id)

    def redacted(self) -> dict:
        """A printable view with every secret masked — safe for logs."""
        def mask(v: Optional[str]) -> str:
            if not v:
                return "(unset)"
            return v[:4] + "…" + v[-2:] if len(v) > 8 else "***"
        return {
            "oanda_env": self.oanda_env,
            "oanda_account_id": self.oanda_account_id,
            "oanda_token": mask(self.oanda_token),
            "instrument": self.instrument,
            "tg_api_id": self.tg_api_id,
            "tg_api_hash": mask(self.tg_api_hash),
            "tg_session": str(self.tg_session),
            "tg_channels": list(self.tg_channels),
            "supabase_url": self.supabase_url or "(unset)",
            "supabase_key": mask(self.supabase_key),
            "telegram_bot_token": mask(self.telegram_bot_token),
            "telegram_chat_id": self.telegram_chat_id or "(unset)",
            "risk_pct": self.risk_pct,
            "daily_loss_pct": self.daily_loss_pct,
            "max_trades_per_day": self.max_trades_per_day,
            "max_dd_pct": self.max_dd_pct,
            "max_open_trades": self.max_open_trades,
            "max_entry_drift": self.max_entry_drift,
            "min_sample": self.min_sample,
            "min_days": self.min_days,
            "pf_min": self.pf_min,
            "gate_override": self.gate_override,
            "kill_switch_file": str(self.kill_switch_file),
            "state_dir": str(self.state_dir),
            "dry_run": self.dry_run,
        }


def load(env_file: Optional[Path] = None, require_broker: bool = True) -> Settings:
    """Build Settings from the environment.

    ``env_file`` defaults to ``<state dir>/executor.env``. With
    ``require_broker=False`` the OANDA credentials may be absent (used by
    ``--login`` which only needs Telegram).
    """
    state_dir = Path(os.environ.get("STATE_DIR") or default_state_dir()).expanduser()
    load_env_file(env_file or state_dir / "executor.env")
    # STATE_DIR may itself have come from the env file
    state_dir = Path(os.environ.get("STATE_DIR") or state_dir).expanduser()

    env = (os.environ.get("OANDA_ENV") or "practice").strip().lower()
    if env not in HOSTS:
        raise ConfigError(f"OANDA_ENV must be 'practice' or 'live', got {env!r}")

    token = (os.environ.get("OANDA_TOKEN") or "").strip()
    account = (os.environ.get("OANDA_ACCOUNT_ID") or "").strip()
    if require_broker and (not token or not account):
        raise ConfigError(
            "OANDA_TOKEN and OANDA_ACCOUNT_ID are required "
            f"(set them in the environment or {state_dir / 'executor.env'})"
        )

    tg_id_raw = (os.environ.get("TG_API_ID") or "").strip()
    tg_api_id = int(tg_id_raw) if tg_id_raw else None
    if tg_api_id is not None and not (0 < tg_api_id < 2**31):
        raise ConfigError(
            f"TG_API_ID {tg_api_id} is not a valid Telegram api_id (must fit a 32-bit int; "
            "copy it from my.telegram.org → API development tools)"
        )
    tg_api_hash = (os.environ.get("TG_API_HASH") or "").strip() or None
    channels = tuple(
        c.strip() for c in (os.environ.get("TG_CHANNELS") or "GOLD VIP,THE WAR ZONE").split(",") if c.strip()
    )

    override_raw = os.environ.get("GATE_OVERRIDE")
    gate_override = (override_raw or "").strip() == OVERRIDE_PHRASE
    if override_raw and not gate_override:
        raise ConfigError(
            "GATE_OVERRIDE is set but does not match the exact override phrase; "
            "unset it, or set it to exactly: " + OVERRIDE_PHRASE
        )

    risk_pct = _float("RISK_PCT", 1.0)
    daily = _float("DAILY_LOSS_PCT", 5.0)
    max_dd = _float("MAX_DD_PCT", 20.0)
    for name, val, lo, hi in (("RISK_PCT", risk_pct, 0.01, 5.0), ("DAILY_LOSS_PCT", daily, 0.5, 50.0), ("MAX_DD_PCT", max_dd, 1.0, 90.0)):
        if not (lo <= val <= hi):
            raise ConfigError(f"{name}={val} is outside the sane range [{lo}, {hi}]")

    kill_file = Path(os.environ.get("KILL_SWITCH_FILE") or state_dir / "KILL").expanduser()
    tg_session = Path(os.environ.get("TG_SESSION") or state_dir / "executor_tg").expanduser()

    return Settings(
        oanda_env=env,
        oanda_token=token,
        oanda_account_id=account,
        instrument=(os.environ.get("OANDA_INSTRUMENT") or "XAU_USD").strip(),
        tg_api_id=tg_api_id,
        tg_api_hash=tg_api_hash,
        tg_session=tg_session,
        tg_channels=channels,
        supabase_url=(os.environ.get("SUPABASE_URL") or "").strip().rstrip("/") or None,
        supabase_key=(os.environ.get("SUPABASE_KEY") or "").strip() or None,
        telegram_bot_token=(os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip() or None,
        telegram_chat_id=(os.environ.get("TELEGRAM_CHAT_ID") or "").strip() or None,
        risk_pct=risk_pct,
        daily_loss_pct=daily,
        max_trades_per_day=_int("MAX_TRADES_PER_DAY", 3),
        max_dd_pct=max_dd,
        max_open_trades=_int("MAX_OPEN_TRADES", 1),
        max_entry_drift=_float("MAX_ENTRY_DRIFT", 0.5),
        min_sample=_int("MIN_SAMPLE", 30),
        min_days=_int("MIN_DAYS", 28),
        pf_min=_float("PF_MIN", 1.3),
        gate_override=gate_override,
        kill_switch_file=kill_file,
        state_dir=state_dir,
        dry_run=_bool(os.environ.get("DRY_RUN"), False),
        log_level=(os.environ.get("LOG_LEVEL") or "INFO").upper(),
    )
