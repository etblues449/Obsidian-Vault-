"""Persistence.

Two layers, always in this order:

  LocalStore   — JSON/JSONL files under the state dir on the Pi. Always on.
                 This is the worker's source of truth for the guards (daily
                 cap, drawdown breaker, funding gates) so a Supabase outage
                 can never weaken risk control.
  SupabaseStore — PostgREST over urllib with the service-role key. Mirrors
                 every write for the dashboard and syncs settings (kill
                 switch, manual gate checks) back. Failures are logged, never
                 raised into the trading path.

Tables (see supabase/schema.sql): signals, trades, events, settings.
"""
from __future__ import annotations

import json
import logging
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .risk import ClosedTrade, london_day

log = logging.getLogger("executor.store")


# ---------------------------------------------------------------- local

class LocalStore:
    """signals.jsonl / events.jsonl are append-only; trades.json and
    state.json are small dicts rewritten atomically."""

    def __init__(self, state_dir: Path):
        self.dir = Path(state_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self.signals = self.dir / "signals.jsonl"
        self.events = self.dir / "events.jsonl"
        self.trades_file = self.dir / "trades.json"
        self.state_file = self.dir / "state.json"

    # -- primitives
    def _append(self, path: Path, rec: dict) -> None:
        with self._lock, path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    def _read_json(self, path: Path, default):
        with self._lock:
            if not path.exists():
                return default
            try:
                return json.loads(path.read_text(encoding="utf-8") or "null") or default
            except json.JSONDecodeError:
                log.error("corrupt %s — starting fresh (old file kept as .corrupt)", path.name)
                path.rename(path.with_suffix(path.suffix + ".corrupt"))
                return default

    def _write_json(self, path: Path, data) -> None:
        with self._lock:
            tmp = path.with_suffix(path.suffix + ".tmp")
            tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
            tmp.replace(path)

    # -- signals / events
    def record_signal(self, rec: dict) -> None:
        self._append(self.signals, rec)

    def record_event(self, rec: dict) -> None:
        self._append(self.events, rec)

    # -- trades (dict keyed by broker trade id)
    def trades(self) -> Dict[str, dict]:
        return self._read_json(self.trades_file, {})

    def save_trade(self, trade: dict) -> None:
        with self._lock:
            all_ = self.trades()
            all_[str(trade["id"])] = trade
            self._write_json(self.trades_file, all_)

    def update_trade(self, trade_id: str, patch: dict) -> Optional[dict]:
        with self._lock:
            all_ = self.trades()
            t = all_.get(str(trade_id))
            if t is None:
                return None
            t.update(patch)
            self._write_json(self.trades_file, all_)
            return t

    # -- misc state (peak NAV, last txn id, cached settings)
    def state(self) -> dict:
        return self._read_json(self.state_file, {})

    def set_state(self, **kv) -> dict:
        with self._lock:
            s = self.state()
            s.update(kv)
            self._write_json(self.state_file, s)
            return s


# ---------------------------------------------------------------- supabase

class SupabaseStore:
    def __init__(self, url: str, key: str, timeout: float = 10.0, opener: Optional[Callable] = None):
        self.base = url.rstrip("/") + "/rest/v1"
        self.key = key
        self.timeout = timeout
        self._open = opener or (lambda req, t: urllib.request.urlopen(req, timeout=t))

    def _req(self, method: str, table: str, params: Optional[dict] = None,
             body: Any = None, prefer: Optional[str] = None) -> Any:
        url = f"{self.base}/{table}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with self._open(req, self.timeout) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            raise RuntimeError(f"supabase {method} {table} → {e.code}: {detail}") from None
        except (urllib.error.URLError, OSError) as e:
            raise RuntimeError(f"supabase {method} {table} → network: {e}") from None

    def insert(self, table: str, row: dict) -> Any:
        return self._req("POST", table, body=row, prefer="return=minimal")

    def upsert(self, table: str, row: dict, on_conflict: str = "id") -> Any:
        return self._req("POST", table, params={"on_conflict": on_conflict}, body=row,
                         prefer="resolution=merge-duplicates,return=minimal")

    def update(self, table: str, match: Dict[str, Any], patch: dict) -> Any:
        params = {k: f"eq.{v}" for k, v in match.items()}
        return self._req("PATCH", table, params=params, body=patch, prefer="return=minimal")

    def select(self, table: str, params: Optional[dict] = None) -> List[dict]:
        return self._req("GET", table, params=params) or []

    def get_settings(self) -> Optional[dict]:
        rows = self.select("settings", {"id": "eq.1", "limit": "1"})
        return rows[0] if rows else None


# ---------------------------------------------------------------- composite

class Store:
    """Local always; Supabase mirrored when configured."""

    def __init__(self, local: LocalStore, remote: Optional[SupabaseStore] = None, env: str = "practice"):
        self.local = local
        self.remote = remote
        self.env = env
        self._remote_failures = 0

    # -- remote helper: never raise into the trading path
    def _mirror(self, what: str, fn: Callable[[], Any]) -> None:
        if not self.remote:
            return
        try:
            fn()
            if self._remote_failures:
                log.info("supabase: recovered after %d failure(s)", self._remote_failures)
            self._remote_failures = 0
        except Exception as e:  # noqa: BLE001
            self._remote_failures += 1
            if self._remote_failures <= 3 or self._remote_failures % 50 == 0:
                log.warning("supabase mirror failed (%s): %s", what, e)

    # -- writes
    def record_signal(self, rec: dict) -> None:
        rec = dict(rec, env=self.env)
        self.local.record_signal(rec)
        self._mirror("signal", lambda: self.remote.upsert("signals", rec, on_conflict="id"))

    def record_event(self, kind: str, **payload) -> dict:
        rec = {"ts": time.time(), "kind": kind, "env": self.env, "payload": payload}
        self.local.record_event(rec)
        self._mirror("event", lambda: self.remote.insert("events", rec))
        return rec

    def save_trade(self, trade: dict) -> None:
        trade = dict(trade, env=self.env)
        self.local.save_trade(trade)
        self._mirror("trade", lambda: self.remote.upsert("trades", trade, on_conflict="id"))

    def update_trade(self, trade_id: str, patch: dict) -> Optional[dict]:
        t = self.local.update_trade(trade_id, patch)
        if t is not None:
            self._mirror("trade-update", lambda: self.remote.update("trades", {"id": trade_id}, patch))
        return t

    # -- reads used by the guards (LOCAL ONLY — by design)
    def trades(self) -> Dict[str, dict]:
        return self.local.trades()

    def open_trades(self) -> List[dict]:
        return [t for t in self.trades().values() if t.get("status") == "open" and t.get("env") == self.env]

    def closed_trades(self) -> List[ClosedTrade]:
        out = []
        for t in self.trades().values():
            if t.get("env") != self.env:
                continue
            out.append(ClosedTrade(
                pnl=float(t.get("realized_pl") or 0.0),
                opened_at=float(t.get("open_time") or 0.0),
                closed_at=float(t["close_time"]) if t.get("close_time") else None,
            ))
        return out

    def today(self, now: Optional[float] = None) -> tuple:
        """(orders placed today, realised P&L closed today) in the London day."""
        day = london_day(now)
        n = 0
        realized = 0.0
        for t in self.trades().values():
            if t.get("env") != self.env:
                continue
            if london_day(float(t.get("open_time") or 0)) == day:
                n += 1
            if t.get("close_time") and london_day(float(t["close_time"])) == day:
                realized += float(t.get("realized_pl") or 0.0)
        return n, realized

    def has_signal_trade(self, signal_id: str) -> bool:
        return any(t.get("signal_id") == signal_id for t in self.trades().values())

    # -- settings: remote wins (that is where the dashboard writes), cached locally
    def settings(self) -> dict:
        cached = self.local.state().get("settings") or {}
        if self.remote:
            try:
                row = self.remote.get_settings()
                if row is not None:
                    self.local.set_state(settings=row, settings_synced_at=time.time())
                    if self._remote_failures:
                        self._remote_failures = 0
                    return row
            except Exception as e:  # noqa: BLE001
                self._remote_failures += 1
                if self._remote_failures <= 3:
                    log.warning("supabase settings read failed: %s (using cached)", e)
        return cached

    def push_status(self, status: dict) -> None:
        """Heartbeat for the dashboard: worker alive, env, NAV, open trades…"""
        self.local.set_state(last_status=status)
        self._mirror("status", lambda: self.remote.upsert("settings", {"id": 1, "worker_status": status}, on_conflict="id"))
