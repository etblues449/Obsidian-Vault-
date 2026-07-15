#!/usr/bin/env python3
"""
resolve_trades.py — auto-adjudicate logged XAUUSD paper trades against real
price history, so the Trade Guard console doesn't rely on hand-marking TP/SL.

Reads signals.jsonl (from signal_logger.py), fetches gold bars from free
keyless sources (Yahoo Finance 15-minute bars first, Stooq daily CSV as
fallback — the same loader-fallback pattern Vibe-Trading uses), walks the
bars forward from each signal's timestamp and decides:

  win        TP touched before SL
  loss       SL touched before TP
  ambiguous  one bar spans BOTH levels (too coarse to order) -> left open,
             decide manually in the console
  open       neither level touched yet

Writes signals.resolved.jsonl — import that file into trade-guard.html and
matching open trades close themselves at the adjudicated price.

Usage (Termux or any machine with Python 3.8+, stdlib only):
    python resolve_trades.py                     # signals.jsonl -> signals.resolved.jsonl
    python resolve_trades.py --in my.jsonl --out out.jsonl
    python resolve_trades.py --source stooq      # force the daily fallback

Deliberately still NO order execution anywhere. Paper verification only.
"""

import argparse
import csv
import io
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

YAHOO_URL = ("https://query1.finance.yahoo.com/v8/finance/chart/XAUUSD%3DX"
             "?interval=15m&range=60d")
STOOQ_URL = "https://stooq.com/q/d/l/?s=xauusd&i=d"
UA = {"User-Agent": "Mozilla/5.0 (TradeGuard resolver; personal use)"}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def bars_yahoo():
    """15-minute bars for the last ~60 days. [(epoch_s, high, low)]"""
    data = json.loads(fetch(YAHOO_URL))
    res = data["chart"]["result"][0]
    ts = res["timestamp"]
    q = res["indicators"]["quote"][0]
    out = []
    for t, hi, lo in zip(ts, q["high"], q["low"]):
        if hi is None or lo is None:
            continue
        out.append((int(t), float(hi), float(lo)))
    return out, "yahoo-15m"


def bars_stooq():
    """Daily bars, full history. [(epoch_s, high, low)]"""
    text = fetch(STOOQ_URL)
    if text.lstrip().startswith("<"):
        raise RuntimeError("Stooq returned HTML (bot challenge?) — try again or use --source yahoo")
    out = []
    for row in csv.DictReader(io.StringIO(text)):
        try:
            t = datetime.strptime(row["Date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            out.append((int(t.timestamp()), float(row["High"]), float(row["Low"])))
        except (KeyError, ValueError):
            continue
    return out, "stooq-daily"


def get_bars(source):
    chain = {"yahoo": [bars_yahoo], "stooq": [bars_stooq], "auto": [bars_yahoo, bars_stooq]}[source]
    errors = []
    for fn in chain:
        try:
            bars, label = fn()
            if bars:
                return bars, label
            errors.append(f"{fn.__name__}: empty")
        except Exception as e:  # noqa: BLE001 - report and fall through the chain
            errors.append(f"{fn.__name__}: {e}")
    sys.exit("No price source reachable:\n  " + "\n  ".join(errors))


def adjudicate(sig, start_epoch, bars):
    """Walk bars after start_epoch; first touch decides. Returns resolution dict."""
    side, sl, tp = sig["side"], sig["sl"], sig.get("tp")
    for t, hi, lo in bars:
        if t <= start_epoch:
            continue
        hit_sl = lo <= sl if side == 1 else hi >= sl
        hit_tp = tp is not None and (hi >= tp if side == 1 else lo <= tp)
        when = datetime.fromtimestamp(t, timezone.utc).isoformat(timespec="seconds")
        if hit_sl and hit_tp:
            return {"status": "ambiguous", "closedAt": when,
                    "note": "bar spans both TP and SL — decide manually"}
        if hit_tp:
            return {"status": "win", "close": tp, "closedAt": when}
        if hit_sl:
            return {"status": "loss", "close": sl, "closedAt": when}
    return {"status": "open"}


def main():
    ap = argparse.ArgumentParser(description="Adjudicate logged signals against real gold bars (paper only)")
    ap.add_argument("--in", dest="infile", default="signals.jsonl")
    ap.add_argument("--out", dest="outfile", default="signals.resolved.jsonl")
    ap.add_argument("--source", choices=["auto", "yahoo", "stooq"], default="auto")
    args = ap.parse_args()

    src = Path(args.infile)
    if not src.exists():
        sys.exit(f"{src} not found — run signal_logger.py first")

    bars, label = get_bars(args.source)
    print(f"price source: {label} ({len(bars)} bars)")
    if label == "stooq-daily":
        print("note: daily bars are coarse — expect more 'ambiguous' outcomes than 15m data")

    counts = {"win": 0, "loss": 0, "ambiguous": 0, "open": 0, "skipped": 0}
    out_lines = []
    for line in src.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        sig = rec.get("parsed")
        if not sig or sig.get("entry") is None or sig.get("sl") is None:
            counts["skipped"] += 1
            continue
        try:
            start = int(datetime.fromisoformat(rec["ts"].replace("Z", "+00:00")).timestamp())
        except (KeyError, ValueError):
            counts["skipped"] += 1
            continue
        res = rec.get("resolution")
        if not res or res.get("status") in (None, "open"):
            res = adjudicate(sig, start, bars)
            res["source"] = label
            rec["resolution"] = res
        counts[res["status"]] = counts.get(res["status"], 0) + 1
        out_lines.append(json.dumps(rec, ensure_ascii=False))

    Path(args.outfile).write_text("\n".join(out_lines) + ("\n" if out_lines else ""), encoding="utf-8")
    print(f"wrote {args.outfile}: " + ", ".join(f"{k} {v}" for k, v in counts.items() if v))
    print("import it in trade-guard.html — matching open trades close at the adjudicated price")


if __name__ == "__main__":
    main()
