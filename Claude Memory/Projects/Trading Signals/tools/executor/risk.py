"""Risk engine — the Trade Guard maths ported to Python, plus the two things
the paper console displayed but never enforced: the daily loss cap and a
max-drawdown circuit breaker.

Units convention: OANDA prices XAU_USD per troy ounce and one *unit* is one
ounce, so P&L per unit per $1 of price movement is $1. (The console's
``DOLLARS_PER_LOT_PER_DOLLAR = 100`` is the same fact expressed per 100-oz
lot: ``lots = units / 100``.) Precision and minimum size are NOT assumed —
they come from the broker's instrument spec at startup.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, List, Optional, Sequence

try:  # Europe/London day boundaries for the daily cap
    from zoneinfo import ZoneInfo
    LONDON = ZoneInfo("Europe/London")
except Exception:  # pragma: no cover - very old Python
    LONDON = timezone.utc


# ---------------------------------------------------------------- sizing

def units_for(risk_amount: float, entry: float, sl: float,
              units_precision: int, min_units: float,
              max_units: Optional[float] = None) -> Optional[float]:
    """Units (ounces) such that a stop-loss hit loses ``risk_amount`` in the
    instrument's quote currency (USD for XAU_USD).

    Rounds DOWN to ``units_precision`` decimals. Returns None — refuse the
    trade — when the result is below the broker minimum. Never rounds up:
    the minimum size is a broker fact, the risk budget is the user's.
    """
    dist = abs(entry - sl)
    if not (dist > 0) or not (risk_amount > 0):
        return None
    raw = risk_amount / dist
    factor = 10 ** max(0, int(units_precision))
    units = math.floor(raw * factor) / factor
    if max_units is not None and units > max_units:
        units = math.floor(max_units * factor) / factor
    if units < min_units or units <= 0:
        return None
    return units


def pnl(entry: float, close: float, side: int, units: float) -> float:
    """Realised P&L in quote currency for a closed trade."""
    return round((close - entry) * side * units, 2)


# ---------------------------------------------------------------- stats

@dataclass
class ClosedTrade:
    pnl: float                 # in ACCOUNT currency (as reported by the broker)
    opened_at: float           # epoch seconds
    closed_at: Optional[float] # epoch seconds; None while open


@dataclass
class Stats:
    n: int
    wins: int
    win_rate: Optional[float]      # percent
    ci: float                      # ± percentage points at 95 %
    expectancy: Optional[float]
    profit_factor: Optional[float] # may be math.inf
    max_dd: Optional[float]        # percent, peak-to-trough on the equity curve
    net_pnl: float
    equity: List[float]
    days: float


def stats(trades: Sequence[ClosedTrade], start_balance: float) -> Stats:
    """Port of the console's ``stats()``.

    * closed = trades with a ``closed_at``; sorted by close time
    * wins = pnl > 0; break-even (pnl == 0) counts in n, not in wins
    * profit factor may be inf (no losses) or None (nothing to divide)
    * max drawdown is % peak-to-trough on an equity curve seeded at
      ``start_balance``
    * days spans the first *opened* trade (open or closed) to the last close
    * ci is the normal-approximation 95 % half-width in percentage points
    """
    closed = sorted((t for t in trades if t.closed_at is not None), key=lambda t: t.closed_at)
    n = len(closed)
    wins = sum(1 for t in closed if t.pnl > 0)
    gross_w = sum(t.pnl for t in closed if t.pnl > 0)
    gross_l = sum(-t.pnl for t in closed if t.pnl < 0)
    total = sum(t.pnl for t in closed)

    equity = [start_balance]
    peak = start_balance
    max_dd = 0.0
    for t in closed:
        v = equity[-1] + t.pnl
        equity.append(v)
        if v > peak:
            peak = v
        dd = (peak - v) / peak * 100 if peak > 0 else 0.0
        if dd > max_dd:
            max_dd = dd

    first = min((t.opened_at for t in trades), default=None)
    last = max((t.closed_at for t in closed), default=None)
    days = max(0.0, (last - first) / 86400) if (first is not None and last is not None) else 0.0

    p = wins / n if n else 0.0
    ci = 1.96 * math.sqrt(p * (1 - p) / n) * 100 if n else 0.0
    if gross_l > 0:
        pf: Optional[float] = gross_w / gross_l
    else:
        pf = math.inf if gross_w > 0 else None

    return Stats(
        n=n, wins=wins,
        win_rate=(p * 100) if n else None,
        ci=ci,
        expectancy=(total / n) if n else None,
        profit_factor=pf,
        max_dd=max_dd if n else None,
        net_pnl=round(total, 2),
        equity=equity,
        days=days,
    )


# ---------------------------------------------------------------- gates

@dataclass(frozen=True)
class GateParams:
    min_sample: int = 30
    min_days: int = 28
    pf_min: float = 1.3
    max_dd_pct: float = 20.0


@dataclass(frozen=True)
class Gate:
    passed: bool
    label: str
    detail: str


def funding_gates(st: Stats, params: GateParams, live_check: bool, broker_check: bool) -> List[Gate]:
    """The six funding gates. Four computed, two manual honesty checks."""
    pf = st.profit_factor
    pf_txt = "—" if pf is None else ("∞" if pf == math.inf else f"{pf:.2f}")
    dd_txt = "—" if st.max_dd is None else f"{st.max_dd:.1f}%"
    return [
        Gate(st.n >= params.min_sample, f"At least {params.min_sample} closed trades", f"{st.n} so far"),
        Gate(st.days >= params.min_days, f"At least {params.min_days} days of forward testing", f"{st.days:.0f} days so far"),
        Gate(pf is not None and st.n > 0 and pf >= params.pf_min, f"Profit factor ≥ {params.pf_min} at your sizing", f"currently {pf_txt}"),
        Gate(st.max_dd is not None and st.max_dd <= params.max_dd_pct, f"Max drawdown ≤ {params.max_dd_pct:.0f}%", f"currently {dd_txt}"),
        Gate(bool(live_check), "Signals arrive BEFORE the move, with entry/SL/TP — never after-the-fact", "manual check"),
        Gate(bool(broker_check), "Execution broker is FCA-authorised (FSCS-protected)", "manual check"),
    ]


def gates_passed(gates: Iterable[Gate]) -> bool:
    return all(g.passed for g in gates)


def can_trade_live(gates: Sequence[Gate], override: bool) -> tuple:
    """(allowed, reason). Live trading needs all six gates OR the explicit
    override phrase. Either way the caller logs the outcome as an event."""
    if gates_passed(gates):
        return True, "all six funding gates passed"
    failed = [g.label for g in gates if not g.passed]
    if override:
        return True, "GATE OVERRIDE in effect — " + "; ".join(failed)
    return False, "funding gate not passed — " + "; ".join(failed)


# ---------------------------------------------------------------- guards

def london_day(ts: Optional[float] = None) -> str:
    """ISO date of the Europe/London trading day containing ``ts``."""
    dt = datetime.fromtimestamp(ts if ts is not None else datetime.now(timezone.utc).timestamp(), LONDON)
    return dt.date().isoformat()


@dataclass(frozen=True)
class GuardParams:
    max_trades_per_day: int = 3
    daily_loss_pct: float = 5.0
    max_dd_pct: float = 20.0


def daily_guard(trades_today: int, realized_today: float, balance_now: float,
                params: GuardParams) -> Optional[str]:
    """Return a reason to refuse a NEW order today, or None if allowed.

    ``realized_today`` is the sum of realised P&L closed today (account
    currency, negative for losses). The day-start balance is reconstructed as
    ``balance_now - realized_today``.
    """
    if trades_today >= params.max_trades_per_day:
        return f"daily trade cap reached ({trades_today}/{params.max_trades_per_day})"
    day_start = balance_now - realized_today
    if day_start > 0:
        cap = day_start * params.daily_loss_pct / 100
        if -realized_today >= cap:
            return (f"daily loss cap hit: {realized_today:+.2f} against a cap of "
                    f"-{cap:.2f} ({params.daily_loss_pct:.1f}% of {day_start:.2f})")
    return None


def drawdown_guard(nav_now: float, peak_nav: float, params: GuardParams) -> Optional[str]:
    """Circuit breaker: refuse when NAV is down ≥ max_dd_pct from its peak.
    Stays tripped until a human resets the stored peak."""
    if peak_nav <= 0:
        return None
    dd = (peak_nav - nav_now) / peak_nav * 100
    if dd >= params.max_dd_pct:
        return f"max-drawdown breaker tripped: NAV {nav_now:.2f} is {dd:.1f}% below peak {peak_nav:.2f}"
    return None
