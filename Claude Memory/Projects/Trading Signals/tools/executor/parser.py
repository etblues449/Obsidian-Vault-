"""Signal parsing — a faithful port of ``signal_logger.parse_signal`` plus the
validation the paper console did at log time.

Semantics preserved from the logger:
  * ``side`` is numeric: +1 buy/long, -1 sell/short. Inferred from stop
    placement when no keyword is present.
  * ``tp`` is optional; ``entry`` and ``sl`` are required or the parse is None.
  * Entry fallback picks the first plausible gold price in [500, 20000] that
    is not already claimed by SL or TP.
The TP regex is the Python form ``T.?P.?\\d?`` (the HTML twin used ``1?``);
this is the unified version.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

SIDE_RE = re.compile(r"\b(BUY|LONG|SELL|SHORT)\b", re.I)
SL_RE = re.compile(r"S\.?\s?L\.?\s*[:@=\s]\s*\$?(\d{3,5}(?:\.\d+)?)", re.I)
TP_RE = re.compile(r"T\.?\s?P\.?\s?\d?\s*[:@=\s]\s*\$?(\d{3,5}(?:\.\d+)?)", re.I)
ENTRY_RE = re.compile(r"(?:ENTRY|@|NOW\s*@?|PRICE)\s*[:=]?\s*\$?(\d{3,5}(?:\.\d+)?)", re.I)
NUM_RE = re.compile(r"\d{3,5}(?:\.\d+)?")

PRICE_LO, PRICE_HI = 500.0, 20000.0
# A stop further than this fraction of price from entry is not a scalp signal
# from this channel — it is a parse error or a different product. Refuse.
MAX_STOP_FRACTION = 0.05


@dataclass(frozen=True)
class Signal:
    side: int          # +1 long, -1 short
    entry: float
    sl: float
    tp: Optional[float]

    @property
    def side_label(self) -> str:
        return "BUY" if self.side == 1 else "SELL"

    @property
    def stop_distance(self) -> float:
        return abs(self.entry - self.sl)

    @property
    def target_distance(self) -> Optional[float]:
        return None if self.tp is None else abs(self.tp - self.entry)

    @property
    def rr(self) -> Optional[float]:
        if self.tp is None or self.stop_distance <= 0:
            return None
        return self.target_distance / self.stop_distance


def parse_signal(text: str) -> Optional[Signal]:
    """Best-effort parse of a gold signal. Returns Signal or None."""
    if not text:
        return None
    m = SIDE_RE.search(text)
    side: Optional[int] = None
    if m:
        side = 1 if m.group(1).upper() in ("BUY", "LONG") else -1

    sl_match = SL_RE.search(text)
    sl = float(sl_match.group(1)) if sl_match else None
    tp_match = TP_RE.search(text)
    tp = float(tp_match.group(1)) if tp_match else None

    entry: Optional[float] = None
    m = ENTRY_RE.search(text)
    if m:
        entry = float(m.group(1))
    else:
        nums = [float(n) for n in NUM_RE.findall(text)
                if PRICE_LO <= float(n) <= PRICE_HI and float(n) not in (sl, tp)]
        if nums:
            entry = nums[0]

    if side is None and entry is not None and sl is not None:
        side = -1 if sl > entry else 1

    if entry is None or sl is None or side is None:
        return None
    return Signal(side=side, entry=entry, sl=sl, tp=tp)


def validate(sig: Signal) -> Optional[str]:
    """Return a rejection reason, or None if the signal is safe to size.

    Mirrors the console's log-time guard (stop on the wrong side of entry)
    and adds the sanity checks an unattended executor needs.
    """
    if not (PRICE_LO <= sig.entry <= PRICE_HI):
        return f"entry {sig.entry} outside plausible gold range"
    if sig.side == 1 and sig.sl >= sig.entry:
        return "stop-loss is not below entry for a BUY"
    if sig.side == -1 and sig.sl <= sig.entry:
        return "stop-loss is not above entry for a SELL"
    if sig.stop_distance <= 0:
        return "zero stop distance"
    if sig.stop_distance > sig.entry * MAX_STOP_FRACTION:
        return f"stop distance {sig.stop_distance:.2f} exceeds {MAX_STOP_FRACTION:.0%} of price — not a scalp signal"
    if sig.tp is not None:
        if sig.side == 1 and sig.tp <= sig.entry:
            return "take-profit is not above entry for a BUY"
        if sig.side == -1 and sig.tp >= sig.entry:
            return "take-profit is not below entry for a SELL"
    return None
