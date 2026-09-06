"""The executor loop.

    message → record → parse → validate → kill switch → live gate (if live)
            → daily cap / drawdown breaker / open-trade cap / duplicate
            → live price + drift check → size (broker spec) → order (SL/TP on fill)
            → record trade → alert

Fills and closes come back on OANDA's transaction stream, so trade closure
is broker truth, not the bot's guess. Every refusal is an event with a reason.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import signal as _signal
import sys
import threading
import time
from pathlib import Path
from typing import Optional

from . import __version__, config, risk
from .broker.oanda import OandaClient, OandaError, OrderResult
from .notify import Notifier, build as build_notifier, esc
from .parser import parse_signal, validate
from .store import LocalStore, Store, SupabaseStore

log = logging.getLogger("executor")


def scorecard_line(st: risk.Stats) -> str:
    """One-line scorecard for alerts: n, win rate ± CI, PF, max DD."""
    wr = f"{st.win_rate:.0f}% ±{st.ci:.0f}" if st.win_rate is not None else "—"
    if st.profit_factor is None:
        pf = "—"
    elif st.profit_factor == float("inf"):
        pf = "∞"
    else:
        pf = f"{st.profit_factor:.2f}"
    dd = f"{st.max_dd:.1f}%" if st.max_dd is not None else "—"
    return f"n={st.n} win {wr} PF {pf} DD {dd} net {st.net_pnl:+.2f}"


class Executor:
    def __init__(self, settings: config.Settings, broker: OandaClient, store: Store, notifier: Notifier):
        self.s = settings
        self.broker = broker
        self.store = store
        self.notifier = notifier
        self.stop = threading.Event()
        self.spec = None            # InstrumentSpec
        self.account = None         # AccountSummary
        self._lock = threading.RLock()
        self._threads = []
        self.last_price = None

    # ---------------------------------------------------------------- startup
    def startup(self) -> None:
        s = self.s
        log.info("Trade Guard executor v%s — %s — %s", __version__, s.oanda_env.upper(), s.instrument)
        log.info("settings: %s", s.redacted())
        self.account = self.broker.summary()
        self.spec = self.broker.instrument(s.instrument)
        log.info("account %s %s balance=%.2f NAV=%.2f open=%d | %s min=%s prec=%d margin=%.3f",
                 self.account.id, self.account.currency, self.account.balance, self.account.nav,
                 self.account.open_trade_count, self.spec.name, self.spec.minimum_trade_size,
                 self.spec.trade_units_precision, self.spec.margin_rate)

        if s.is_live:
            ok, reason = self.live_allowed()
            self.store.record_event("live_start_check", allowed=ok, reason=reason, override=s.gate_override)
            if not ok:
                raise SystemExit(f"LIVE refused: {reason}")
            log.warning("LIVE TRADING ENABLED — %s", reason)
            self.notifier.send(f"⚠️ <b>LIVE executor started</b>\n{esc(reason)}")
        else:
            self.notifier.send(f"🧪 Practice executor started ({esc(s.instrument)}). Balance {self.account.balance:.2f} {esc(self.account.currency)}")

        state = self.store.local.state()
        peak = max(float(state.get("peak_nav") or 0.0), self.account.nav)
        self.store.local.set_state(peak_nav=peak)
        self.reconcile()
        self.store.record_event("startup", env=s.oanda_env, balance=self.account.balance, nav=self.account.nav,
                                dry_run=s.dry_run, version=__version__)

        self._spawn(self._txn_stream, "txn-stream")
        self._spawn(self._price_stream, "price-stream")
        self._spawn(self._heartbeat, "heartbeat")

    def _spawn(self, fn, name):
        t = threading.Thread(target=fn, name=name, daemon=True)
        t.start()
        self._threads.append(t)

    # ---------------------------------------------------------------- gates
    def current_stats(self) -> risk.Stats:
        start = float(self.store.local.state().get("start_balance") or 0.0)
        if start <= 0:
            start = self.account.balance if self.account else 0.0
            self.store.local.set_state(start_balance=start)
        return risk.stats(self.store.closed_trades(), start)

    def gates(self):
        st = self.current_stats()
        cfg = self.store.settings()
        params = risk.GateParams(self.s.min_sample, self.s.min_days, self.s.pf_min, self.s.max_dd_pct)
        return risk.funding_gates(st, params,
                                  live_check=bool(cfg.get("live_check", False)),
                                  broker_check=bool(cfg.get("broker_check", True)))

    def live_allowed(self):
        return risk.can_trade_live(self.gates(), self.s.gate_override)

    def kill_switch(self) -> Optional[str]:
        if self.s.kill_switch_file.exists():
            return f"kill-switch file present: {self.s.kill_switch_file}"
        if bool(self.store.settings().get("kill_switch", False)):
            return "kill switch set in dashboard settings"
        return None

    # ---------------------------------------------------------------- reconcile
    def reconcile(self) -> None:
        """Make the local trade book agree with the broker."""
        try:
            broker_open = {t.id: t for t in self.broker.open_trades()}
        except OandaError as e:
            log.warning("reconcile: cannot list open trades: %s", e)
            return
        local_open = {t["id"]: t for t in self.store.open_trades()}
        for tid, t in broker_open.items():
            if tid not in local_open and t.instrument == self.s.instrument:
                log.info("reconcile: adopting broker trade %s", tid)
                self.store.save_trade(self._trade_row(t, signal_id=None, note="adopted at reconcile"))
        for tid in list(local_open):
            if tid not in broker_open:
                t = self.broker.trade(tid)
                if t and t.state != "OPEN":
                    self._mark_closed(tid, t.close_time or time.time(), t.average_close_price, t.realized_pl, "reconcile")
                elif t is None:
                    self.store.update_trade(tid, {"status": "unknown", "note": "not found at broker"})

    def _trade_row(self, t, signal_id, note="") -> dict:
        return {
            "id": t.id, "signal_id": signal_id, "instrument": t.instrument,
            "side": t.side, "units": abs(t.units or t.initial_units), "entry": t.price,
            "sl": t.sl_price, "tp": t.tp_price, "open_time": t.open_time,
            "close_time": t.close_time, "close_price": t.average_close_price,
            "realized_pl": t.realized_pl if t.state != "OPEN" else 0.0,
            "status": "open" if t.state == "OPEN" else "closed", "note": note,
        }

    # ---------------------------------------------------------------- inbound
    def handle_message(self, msg: dict) -> None:
        """Synchronous; called from the Telethon handler via a thread."""
        with self._lock:
            self._handle(msg)

    def _handle(self, msg: dict) -> None:
        sid = f"{msg.get('channel_id')}:{msg.get('msg_id')}"
        text = msg.get("text") or ""
        rec = {"id": sid, "ts": msg.get("ts") or time.time(), "channel": msg.get("channel"),
               "msg_id": msg.get("msg_id"), "text": text, "parsed": None, "status": "received", "reason": None}

        sig = parse_signal(text)
        if sig is None:
            rec.update(status="skipped", reason="no signal in message")
            self.store.record_signal(rec)
            return
        rec["parsed"] = {"side": sig.side, "entry": sig.entry, "sl": sig.sl, "tp": sig.tp}
        why = validate(sig)
        if why:
            rec.update(status="rejected", reason=why)
            self.store.record_signal(rec)
            self.store.record_event("signal_rejected", signal=sid, reason=why)
            log.warning("signal %s rejected: %s", sid, why)
            return
        rec.update(status="parsed")
        self.store.record_signal(rec)
        log.info("signal %s: %s @ %s SL %s TP %s (dist %.2f, RR %s)", sid, sig.side_label, sig.entry, sig.sl, sig.tp,
                 sig.stop_distance, f"{sig.rr:.2f}" if sig.rr else "—")

        refusal = self._refusal(sid, sig)
        if refusal:
            self.store.record_event("order_refused", signal=sid, reason=refusal)
            log.warning("order refused for %s: %s", sid, refusal)
            self.notifier.send(f"⛔ <b>Refused</b> {esc(sig.side_label)} @ {sig.entry}\n{esc(refusal)}")
            return

        self._place(sid, sig)

    def _refusal(self, sid: str, sig) -> Optional[str]:
        s = self.s
        k = self.kill_switch()
        if k:
            return k
        if s.is_live:
            ok, reason = self.live_allowed()
            if not ok:
                return reason
        if self.store.has_signal_trade(sid):
            return "already traded this message"
        open_n = len(self.store.open_trades())
        if open_n >= s.max_open_trades:
            return f"{open_n} trade(s) already open (cap {s.max_open_trades})"
        try:
            self.account = self.broker.summary()
        except OandaError as e:
            return f"cannot read account: {e}"
        n_today, realized_today = self.store.today()
        g = risk.daily_guard(n_today, realized_today, self.account.balance,
                             risk.GuardParams(s.max_trades_per_day, s.daily_loss_pct, s.max_dd_pct))
        if g:
            return g
        peak = float(self.store.local.state().get("peak_nav") or self.account.nav)
        if self.account.nav > peak:
            self.store.local.set_state(peak_nav=self.account.nav)
            peak = self.account.nav
        d = risk.drawdown_guard(self.account.nav, peak, risk.GuardParams(s.max_trades_per_day, s.daily_loss_pct, s.max_dd_pct))
        if d:
            return d
        return None

    def _place(self, sid: str, sig) -> None:
        s = self.s
        try:
            payload = self.broker.pricing([s.instrument], home_conversions=True)
        except OandaError as e:
            self.store.record_event("order_refused", signal=sid, reason=f"pricing unavailable: {e}")
            return
        price = self.broker.price_of(payload, s.instrument)
        if price is None or not price.tradeable:
            self.store.record_event("order_refused", signal=sid, reason="instrument not tradeable right now")
            return
        self.last_price = price
        drift = abs(price.mid - sig.entry)
        if drift > sig.stop_distance * s.max_entry_drift:
            reason = (f"price {price.mid:.2f} has drifted {drift:.2f} from entry {sig.entry} "
                      f"(> {s.max_entry_drift:.0%} of the {sig.stop_distance:.2f} stop) — signal stale")
            self.store.record_event("order_refused", signal=sid, reason=reason)
            self.notifier.send(f"⛔ <b>Stale signal</b> {esc(sig.side_label)} @ {sig.entry}\n{esc(reason)}")
            return

        factor = self.broker.usd_to_account_factor(payload, self.account.currency)
        risk_account = self.account.balance * s.risk_pct / 100
        risk_usd = risk_account / factor if factor > 0 else risk_account
        units = risk.units_for(risk_usd, sig.entry, sig.sl, self.spec.trade_units_precision,
                               self.spec.minimum_trade_size, self.spec.maximum_order_units)
        if units is None:
            reason = (f"risk budget {risk_account:.2f} {self.account.currency} (= {risk_usd:.2f} USD) over a "
                      f"{sig.stop_distance:.2f} stop gives < broker minimum {self.spec.minimum_trade_size} units — refusing rather than oversizing")
            self.store.record_event("order_refused", signal=sid, reason=reason)
            self.notifier.send(f"⛔ <b>Too small</b> {esc(sig.side_label)} @ {sig.entry}\n{esc(reason)}")
            return

        signed_units = self.spec.fmt_units(units * sig.side)
        sl = self.spec.fmt_price(sig.sl)
        tp = self.spec.fmt_price(sig.tp) if sig.tp is not None else None
        client_id = f"tg-{sid.replace(':', '-')}-{int(time.time())}"
        summary = (f"{sig.side_label} {units:g} {s.instrument} @~{price.mid:.2f} SL {sl} TP {tp or '—'} "
                   f"risk {risk_account:.2f} {self.account.currency} ({s.risk_pct:g}%)")

        if s.dry_run:
            self.store.record_event("dry_run_order", signal=sid, units=units, side=sig.side, sl=sl, tp=tp,
                                    mid=price.mid, risk_account=risk_account)
            log.info("DRY RUN: %s", summary)
            self.notifier.send(f"🧪 <b>DRY RUN</b> {esc(summary)}")
            return

        res: OrderResult = self.broker.market_order(s.instrument, signed_units, sl, tp, client_id,
                                                    tag="tradeguard", comment=f"signal {sid}")
        if not res.ok:
            self.store.record_event("order_failed", signal=sid, reason=res.reason, units=units)
            log.error("order failed for %s: %s", sid, res.reason)
            self.notifier.send(f"❌ <b>Order failed</b> {esc(summary)}\n{esc(res.reason)}")
            return

        row = {
            "id": res.trade_id, "signal_id": sid, "instrument": s.instrument, "side": sig.side,
            "units": abs(res.units or units), "entry": res.fill_price, "sl": float(sl),
            "tp": float(tp) if tp else None, "open_time": time.time(), "close_time": None,
            "close_price": None, "realized_pl": 0.0, "status": "open", "note": f"txn {res.transaction_id}",
            "signal_entry": sig.entry, "risk_account": risk_account,
        }
        self.store.save_trade(row)
        self.store.record_event("order_filled", signal=sid, trade_id=res.trade_id, fill=res.fill_price, units=row["units"])
        log.info("FILLED %s trade %s @ %s", summary, res.trade_id, res.fill_price)
        self.notifier.send(f"✅ <b>{'LIVE' if s.is_live else 'Practice'} fill</b> {esc(summary)}\nfilled @ {res.fill_price} (trade {esc(res.trade_id)})")

    # ---------------------------------------------------------------- streams
    def _txn_stream(self) -> None:
        self.broker.stream_transactions(self._on_txn, self.stop)

    def _on_txn(self, txn: dict) -> None:
        t = txn.get("type")
        if t == "HEARTBEAT":
            return
        self.store.local.set_state(last_txn_id=txn.get("id"))
        if t != "ORDER_FILL":
            return
        closed = list(txn.get("tradesClosed") or [])
        if txn.get("tradeReduced"):
            closed.append(txn["tradeReduced"])
        if not closed:
            return
        with self._lock:
            for c in closed:
                tid = str(c.get("tradeID"))
                if tid not in self.store.trades():
                    continue
                reason = txn.get("reason", "")
                self._mark_closed(tid, float(txn.get("time") or time.time()), float(c.get("price") or 0.0),
                                  float(c.get("realizedPL") or 0.0), reason)

    def _mark_closed(self, tid: str, when: float, price: Optional[float], realized: float, reason: str) -> None:
        t = self.store.update_trade(tid, {"status": "closed", "close_time": when, "close_price": price,
                                          "realized_pl": realized, "close_reason": reason})
        if not t:
            return
        self.store.record_event("trade_closed", trade_id=tid, realized_pl=realized, reason=reason, price=price)
        try:
            self.account = self.broker.summary()
            peak = float(self.store.local.state().get("peak_nav") or 0.0)
            if self.account.nav > peak:
                self.store.local.set_state(peak_nav=self.account.nav)
        except OandaError:
            pass
        icon = "🟢" if realized > 0 else ("⚪" if realized == 0 else "🔴")
        st = self.current_stats()
        ccy = esc(self.account.currency) if self.account else ""
        self.notifier.send(
            f"{icon} <b>Closed</b> trade {esc(tid)} {esc(reason)} @ {price}\n"
            f"P&L {realized:+.2f} {ccy} · {scorecard_line(st)}"
        )

    def _price_stream(self) -> None:
        def on_line(d: dict) -> None:
            if d.get("type") == "PRICE" or d.get("instrument"):
                p = self.broker.price_of({"prices": [d]}, self.s.instrument)
                if p:
                    self.last_price = p
        self.broker.stream_prices([self.s.instrument], on_line, self.stop)

    def _heartbeat(self) -> None:
        while not self.stop.wait(60):
            try:
                self.account = self.broker.summary()
                st = self.current_stats()
                self.store.push_status({
                    "ts": time.time(), "env": self.s.oanda_env, "dry_run": self.s.dry_run,
                    "balance": self.account.balance, "nav": self.account.nav,
                    "open_trades": len(self.store.open_trades()), "kill": self.kill_switch(),
                    "price": self.last_price.mid if self.last_price else None,
                    "stats": {"n": st.n, "win_rate": st.win_rate, "pf": None if st.profit_factor in (None, float('inf')) else st.profit_factor,
                              "max_dd": st.max_dd, "net": st.net_pnl, "days": st.days},
                    "gates": [{"passed": g.passed, "label": g.label, "detail": g.detail} for g in self.gates()],
                    "version": __version__,
                })
            except Exception as e:  # noqa: BLE001
                log.warning("heartbeat: %s", e)

    # ---------------------------------------------------------------- shutdown
    def shutdown(self) -> None:
        self.stop.set()
        self.store.record_event("shutdown", env=self.s.oanda_env)


# -------------------------------------------------------------------- wiring

def build(settings: config.Settings) -> Executor:
    broker = OandaClient(settings.rest_host, settings.stream_host, settings.oanda_token, settings.oanda_account_id)
    local = LocalStore(settings.state_dir)
    remote = SupabaseStore(settings.supabase_url, settings.supabase_key) if settings.has_supabase else None
    store = Store(local, remote, env=settings.oanda_env)
    return Executor(settings, broker, store, build_notifier(settings))


def check(settings: config.Settings) -> int:
    """Connectivity + sizing preflight. Sends nothing."""
    print("settings:", settings.redacted())
    ex = build(settings)
    ok = True
    try:
        acct = ex.broker.summary()
        spec = ex.broker.instrument(settings.instrument)
        print(f"OANDA {settings.oanda_env}: account {acct.id} {acct.currency} balance {acct.balance:.2f} NAV {acct.nav:.2f} open {acct.open_trade_count}")
        print(f"{spec.name}: min {spec.minimum_trade_size} units, precision {spec.trade_units_precision}, display {spec.display_precision}dp, margin {spec.margin_rate:.3f}")
        payload = ex.broker.pricing([settings.instrument], home_conversions=True)
        p = ex.broker.price_of(payload, settings.instrument)
        factor = ex.broker.usd_to_account_factor(payload, acct.currency)
        if p:
            print(f"price: bid {p.bid} ask {p.ask} spread {p.spread:.2f} tradeable={p.tradeable}  USD→{acct.currency} factor {factor:.4f}")
        sig = parse_signal("SELL @ 4334 SL 4340 TP 4326")
        risk_account = acct.balance * settings.risk_pct / 100
        units = risk.units_for(risk_account / factor, sig.entry, sig.sl, spec.trade_units_precision, spec.minimum_trade_size, spec.maximum_order_units)
        print(f"sample sizing: SELL @4334 SL 4340 → risk {risk_account:.2f} {acct.currency} → units {units} (min {spec.minimum_trade_size})")
        if units is None:
            print("  ⚠ below broker minimum at this balance/risk — the executor will REFUSE such signals")
    except OandaError as e:
        print("OANDA check FAILED:", e)
        ok = False
    if ex.store.remote:
        try:
            print("supabase settings row:", ex.store.remote.get_settings())
        except Exception as e:  # noqa: BLE001
            print("supabase check FAILED:", e)
            ok = False
    else:
        print("supabase: not configured (local store only)")
    print("alerts:", "telegram bot" if settings.has_telegram_alerts else "none configured")
    print("gates:", [(g.passed, g.label) for g in ex.gates()])
    print("live allowed:", ex.live_allowed())
    return 0 if ok else 1


async def _run(settings: config.Settings) -> None:
    from . import telegram_source
    ex = build(settings)
    ex.startup()
    loop = asyncio.get_running_loop()
    stop = asyncio.Event()

    async def on_message(msg: dict) -> None:
        await loop.run_in_executor(None, ex.handle_message, msg)

    def _sig(*_):
        log.info("signal received — shutting down")
        loop.call_soon_threadsafe(stop.set)

    for s in (_signal.SIGINT, _signal.SIGTERM):
        try:
            loop.add_signal_handler(s, _sig)
        except (NotImplementedError, RuntimeError):  # pragma: no cover
            _signal.signal(s, _sig)
    try:
        await telegram_source.listen(settings, on_message, stop)
    finally:
        ex.shutdown()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="executor", description="Trade Guard executor (OANDA v20)")
    ap.add_argument("--login", action="store_true", help="interactive Telegram login (creates the session file)")
    ap.add_argument("--list", action="store_true", help="list channels visible to the Telegram session")
    ap.add_argument("--check", action="store_true", help="connectivity + sizing preflight; sends nothing")
    ap.add_argument("--dry-run", action="store_true", help="run everything but never send orders")
    ap.add_argument("--env-file", type=str, default=None, help="path to a KEY=VALUE env file")
    args = ap.parse_args(argv)

    if args.dry_run:
        os.environ["DRY_RUN"] = "1"
    try:
        settings = config.load(env_file=Path(args.env_file) if args.env_file else None,
                               require_broker=not (args.login or args.list))
    except config.ConfigError as e:
        print("config error:", e, file=sys.stderr)
        return 2

    logging.basicConfig(level=getattr(logging, settings.log_level, logging.INFO),
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    from . import telegram_source
    if args.login:
        asyncio.run(telegram_source.login(settings))
        return 0
    if args.list:
        asyncio.run(telegram_source.list_dialogs(settings))
        return 0
    if args.check:
        return check(settings)
    asyncio.run(_run(settings))
    return 0
