"""End-to-end tests of the Executor loop against a fake broker.
No network, no Telethon, no Supabase — local store only."""
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from executor import config
from executor.broker.oanda import AccountSummary, InstrumentSpec, OandaClient, OrderResult, Trade
from executor.main import Executor
from executor.notify import NullNotifier
from executor.store import LocalStore, Store

ACC = "001-004-1234567-001"
BASE = {"OANDA_TOKEN": "tok", "OANDA_ACCOUNT_ID": ACC, "TG_API_ID": "1234567", "TG_API_HASH": "h"}  # fixtures, not real
SELL = {"ts": 1784160000.0, "channel": "GOLD VIP", "channel_id": -100207, "msg_id": 1, "text": "SELL @ 4334 SL 4340 TP 4326"}


class FakeBroker(OandaClient):
    def __init__(self):
        super().__init__("https://api-fxpractice.oanda.com", "https://stream-fxpractice.oanda.com", "tok", ACC,
                         opener=lambda *a: (_ for _ in ()).throw(AssertionError("network used")))
        self.balance = 500.0
        self.nav = 500.0
        self.currency = "GBP"
        self.spec_ = InstrumentSpec("XAU_USD", "Gold", "METAL", -2, 3, 0, 1, 10000, 0.05)
        self.mid = 4334.25
        self.tradeable = True
        self.factor = 0.78          # USD → GBP
        self.orders = []
        self.fail_reason = None
        self.open = []
        self._next = 1000

    def summary(self):
        return AccountSummary(ACC, self.currency, self.balance, self.nav, 0.0, 0.0, self.balance, len(self.open), False)

    def instrument(self, name):
        return self.spec_

    def pricing(self, instruments, home_conversions=False):
        return {"prices": [{"instrument": "XAU_USD", "bids": [{"price": str(self.mid - 0.15)}],
                            "asks": [{"price": str(self.mid + 0.15)}],
                            "status": "tradeable" if self.tradeable else "halted", "time": "1"}],
                "homeConversions": [{"currency": "USD", "positionValue": str(self.factor)}]}

    def market_order(self, instrument, units, sl_price, tp_price, client_id, tag="", comment=""):
        self.orders.append({"instrument": instrument, "units": units, "sl": sl_price, "tp": tp_price, "client_id": client_id})
        if self.fail_reason:
            return OrderResult(ok=False, reason=self.fail_reason)
        self._next += 1
        return OrderResult(ok=True, trade_id=str(self._next), fill_price=self.mid, units=float(units), transaction_id="t")

    def open_trades(self):
        return list(self.open)

    def trade(self, trade_id):
        return None

    def stream_prices(self, *a, **k):
        pass

    def stream_transactions(self, *a, **k):
        pass


class ExecutorTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.state = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def make(self, **env):
        with mock.patch.dict(os.environ, dict(BASE, STATE_DIR=str(self.state), **env), clear=True):
            s = config.load()
        broker = FakeBroker()
        store = Store(LocalStore(self.state), None, env=s.oanda_env)
        ex = Executor(s, broker, store, NullNotifier())
        ex.account = broker.summary()
        ex.spec = broker.spec_
        return ex, broker, store

    def events(self, kind=None):
        out = []
        for line in self.state.joinpath("events.jsonl").read_text().splitlines() if (self.state / "events.jsonl").exists() else []:
            e = json.loads(line)
            if kind is None or e["kind"] == kind:
                out.append(e)
        return out

    # ------------------------------------------------------------ happy path
    def test_sell_signal_places_sized_order_with_broker_side_sl_tp(self):
        ex, broker, store = self.make()
        ex.handle_message(SELL)
        self.assertEqual(len(broker.orders), 1)
        o = broker.orders[0]
        # £500 × 1% = £5 → $6.41 over a $6 stop = 1.07 → floor → 1 unit, SELL → "-1"
        self.assertEqual(o["units"], "-1")
        self.assertEqual(o["sl"], "4340.000")
        self.assertEqual(o["tp"], "4326.000")
        self.assertTrue(o["client_id"].startswith("tg--100207-1-"))
        trades = store.trades()
        self.assertEqual(len(trades), 1)
        t = next(iter(trades.values()))
        self.assertEqual((t["status"], t["side"], t["units"], t["sl"], t["tp"], t["signal_id"]), ("open", -1, 1.0, 4340.0, 4326.0, "-100207:1"))
        self.assertEqual(t["env"], "practice")
        self.assertEqual(len(self.events("order_filled")), 1)

    def test_noise_is_recorded_and_ignored(self):
        ex, broker, store = self.make()
        ex.handle_message(dict(SELL, text="Good morning! 🚀"))
        self.assertEqual(broker.orders, [])
        sigs = [json.loads(l) for l in (self.state / "signals.jsonl").read_text().splitlines()]
        self.assertEqual(sigs[0]["status"], "skipped")

    def test_invalid_signal_is_rejected_not_traded(self):
        ex, broker, _ = self.make()
        ex.handle_message(dict(SELL, text="BUY @ 4334 SL 4340 TP 4326"))   # stop above entry on a BUY
        self.assertEqual(broker.orders, [])
        self.assertIn("stop-loss", self.events("signal_rejected")[0]["payload"]["reason"])

    # ------------------------------------------------------------ refusals
    def _refused(self, ex, msg=SELL):
        ex.handle_message(msg)
        ev = self.events("order_refused")
        self.assertTrue(ev, "expected an order_refused event")
        return ev[-1]["payload"]["reason"]

    def test_kill_switch_file(self):
        ex, broker, _ = self.make()
        ex.s.kill_switch_file.parent.mkdir(parents=True, exist_ok=True)
        ex.s.kill_switch_file.touch()
        self.assertIn("kill-switch file", self._refused(ex))
        self.assertEqual(broker.orders, [])

    def test_kill_switch_from_settings(self):
        ex, broker, store = self.make()
        store.local.set_state(settings={"kill_switch": True})
        self.assertIn("dashboard", self._refused(ex))

    def test_duplicate_message(self):
        ex, broker, _ = self.make()
        ex.handle_message(SELL)
        self.assertIn("already traded", self._refused(ex))
        self.assertEqual(len(broker.orders), 1)

    def test_max_open_trades(self):
        ex, broker, _ = self.make()
        ex.handle_message(SELL)
        self.assertIn("already open", self._refused(ex, dict(SELL, msg_id=2)))

    def test_daily_trade_cap(self):
        ex, broker, _ = self.make(MAX_TRADES_PER_DAY="1", MAX_OPEN_TRADES="5")
        ex.handle_message(SELL)
        self.assertIn("daily trade cap", self._refused(ex, dict(SELL, msg_id=2)))

    def test_daily_loss_cap(self):
        ex, broker, store = self.make()
        store.save_trade({"id": "9", "signal_id": "x", "open_time": SELL["ts"] - 3600, "close_time": SELL["ts"] - 60,
                          "realized_pl": -25.0, "status": "closed"})
        broker.balance = 475.0
        with mock.patch("executor.risk.datetime") as dt:
            # make "today" the London day of the seeded trade
            dt.now.return_value.timestamp.return_value = SELL["ts"]
            dt.fromtimestamp = __import__("datetime").datetime.fromtimestamp
            self.assertIn("daily loss cap", self._refused(ex))

    def test_drawdown_breaker(self):
        ex, broker, store = self.make()
        store.local.set_state(peak_nav=500.0)
        broker.nav = 399.0
        self.assertIn("breaker", self._refused(ex))

    def test_stale_signal_drift(self):
        ex, broker, _ = self.make()
        broker.mid = 4338.0            # 4 away from entry; stop is 6 → > 50 %
        self.assertIn("stale", self._refused(ex))

    def test_not_tradeable(self):
        ex, broker, _ = self.make()
        broker.tradeable = False
        self.assertIn("not tradeable", self._refused(ex))

    def test_below_broker_minimum_refuses_rather_than_oversizing(self):
        ex, broker, _ = self.make()
        broker.balance = 200.0          # £2 risk → $2.56 / 6 = 0.43 units → 0
        ex.account = broker.summary()
        self.assertIn("broker minimum", self._refused(ex))
        self.assertEqual(broker.orders, [])

    def test_dry_run_sends_nothing(self):
        ex, broker, _ = self.make(DRY_RUN="1")
        ex.handle_message(SELL)
        self.assertEqual(broker.orders, [])
        ev = self.events("dry_run_order")
        self.assertEqual(ev[0]["payload"]["units"], 1)

    def test_order_failure_is_logged_not_saved(self):
        ex, broker, store = self.make()
        broker.fail_reason = "rejected: INSUFFICIENT_MARGIN"
        ex.handle_message(SELL)
        self.assertEqual(store.trades(), {})
        self.assertIn("INSUFFICIENT_MARGIN", self.events("order_failed")[0]["payload"]["reason"])

    # ------------------------------------------------------------ closes from the stream
    def test_transaction_stream_closes_trade_with_broker_truth(self):
        ex, broker, store = self.make()
        ex.handle_message(SELL)
        tid = next(iter(store.trades()))
        ex._on_txn({"type": "HEARTBEAT"})
        ex._on_txn({"type": "ORDER_FILL", "id": "77", "time": "1784163600", "reason": "STOP_LOSS_ORDER",
                    "tradesClosed": [{"tradeID": tid, "price": "4340.000", "realizedPL": "-4.68"}]})
        t = store.trades()[tid]
        self.assertEqual((t["status"], t["close_price"], t["realized_pl"], t["close_reason"]), ("closed", 4340.0, -4.68, "STOP_LOSS_ORDER"))
        self.assertEqual(self.events("trade_closed")[0]["payload"]["realized_pl"], -4.68)
        self.assertEqual(store.local.state()["last_txn_id"], "77")
        st = ex.current_stats()
        self.assertEqual((st.n, st.wins), (1, 0))

    def test_unknown_trade_in_stream_is_ignored(self):
        ex, broker, store = self.make()
        ex._on_txn({"type": "ORDER_FILL", "id": "1", "tradesClosed": [{"tradeID": "nope", "price": "1", "realizedPL": "1"}]})
        self.assertEqual(self.events("trade_closed"), [])

    # ------------------------------------------------------------ live gate
    def test_live_refused_without_gate_or_override(self):
        ex, broker, _ = self.make(OANDA_ENV="live")
        ok, why = ex.live_allowed()
        self.assertFalse(ok)
        self.assertIn("funding gate not passed", why)
        with self.assertRaises(SystemExit):
            ex.startup()
        self.assertFalse(self.events("live_start_check")[0]["payload"]["allowed"])
        self.assertIn("funding gate", self._refused(ex))
        self.assertEqual(broker.orders, [])

    def test_live_allowed_with_override_and_logged(self):
        ex, broker, _ = self.make(OANDA_ENV="live", GATE_OVERRIDE=config.OVERRIDE_PHRASE)
        ok, why = ex.live_allowed()
        self.assertTrue(ok)
        self.assertTrue(why.startswith("GATE OVERRIDE"))
        ex.handle_message(SELL)
        self.assertEqual(len(broker.orders), 1)
        self.assertEqual(store_env := next(iter(ex.store.trades().values()))["env"], "live", store_env)


if __name__ == "__main__":
    unittest.main()
