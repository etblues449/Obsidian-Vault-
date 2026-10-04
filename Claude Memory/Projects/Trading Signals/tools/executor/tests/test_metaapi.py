"""MetaAPI adapter tests — a fake HTTP layer stands in for metaapi.cloud.
No network. Response shapes follow metaapi.cloud/docs/client/restApi (2026-10-04)."""
import io
import json
import os
import tempfile
import threading
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

from executor import config
from executor.broker.metaapi import MetaApiClient, MetaApiError, _ts
from executor.broker.oanda import OandaError
from executor.main import Executor, make_broker
from executor.notify import NullNotifier
from executor.store import LocalStore, Store

ACC = "865d3a4d-3803-486d-bdf3-a85679d9fad2"   # docs example id, not real
SPEC = {"symbol": "XAUUSD", "tickSize": 0.01, "minVolume": 0.01, "maxVolume": 50, "volumeStep": 0.01,
        "contractSize": 100, "digits": 2, "description": "Gold vs US Dollar"}


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


class FakeMetaApi:
    """Routes (method, path-suffix) → JSON. Records every request."""

    def __init__(self):
        self.calls = []
        self.region = "london"
        self.state = "DEPLOYED"
        self.info = {"currency": "USD", "balance": 149.13, "equity": 151.0, "margin": 3.0, "freeMargin": 148.0}
        self.positions = []
        self.deals = {}
        self.price = {"symbol": "XAUUSD", "bid": 4334.10, "ask": 4334.40, "time": "2026-10-05T13:30:00.000Z",
                      "profitTickValue": 1.0, "lossTickValue": 1.0}
        self.trade_reply = {"numericCode": 10009, "stringCode": "TRADE_RETCODE_DONE",
                            "message": "Request completed", "orderId": "47137555"}
        self.network_fail_on_trade = False

    def __call__(self, req, timeout):
        url, method = req.full_url, req.get_method()
        body = json.loads(req.data.decode()) if req.data else None
        self.calls.append((method, url, body, dict(req.header_items())))
        if "mt-provisioning-api" in url:
            return self._ok({"region": self.region, "state": self.state, "connectionStatus": "CONNECTED"})
        assert f"mt-client-api-v1.{self.region}.agiliumtrade.ai" in url, url
        path = url.split(f"/accounts/{ACC}", 1)[1].split("?")[0]
        if path == "/account-information":
            return self._ok(self.info)
        if path == "/positions":
            return self._ok(self.positions)
        if path.startswith("/positions/"):
            pid = path.rsplit("/", 1)[1]
            for p in self.positions:
                if p["id"] == pid:
                    return self._ok(p)
            self._err(url, 404, "NotFoundError", "position not found")
        if path == "/symbols/XAUUSD/specification":
            return self._ok(SPEC)
        if path.startswith("/symbols/") and path.endswith("/specification"):
            self._err(url, 404, "NotFoundError", "symbol not found")
        if path == "/symbols/XAUUSD/current-price":
            return self._ok(self.price)
        if path.startswith("/history-deals/position/"):
            return self._ok(self.deals.get(path.rsplit("/", 1)[1], []))
        if path == "/trade":
            if self.network_fail_on_trade:
                raise urllib.error.URLError("connection reset")
            reply = dict(self.trade_reply)
            if reply.get("stringCode") == "TRADE_RETCODE_DONE" and body["actionType"].startswith("ORDER_TYPE"):
                pid = reply["orderId"]
                self.positions.append({
                    "id": pid, "type": "POSITION_TYPE_BUY" if body["actionType"] == "ORDER_TYPE_BUY" else "POSITION_TYPE_SELL",
                    "symbol": body["symbol"], "openPrice": 4334.10, "volume": body["volume"],
                    "time": "2026-10-05T13:31:00.000Z", "stopLoss": body["stopLoss"],
                    "takeProfit": body.get("takeProfit"), "profit": 0.0, "swap": 0.0, "commission": 0.0,
                    "clientId": body["clientId"]})
            return self._ok(reply)
        raise AssertionError(f"unrouted {method} {path}")

    @staticmethod
    def _ok(obj):
        return _Resp(json.dumps(obj).encode())

    @staticmethod
    def _err(url, status, code, msg):
        raise urllib.error.HTTPError(url, status, msg, {}, io.BytesIO(json.dumps({"error": code, "message": msg}).encode()))


def client(fake=None, **kw):
    fake = fake or FakeMetaApi()
    return MetaApiClient("tok", ACC, opener=fake, poll_seconds=1, **kw), fake


class MetaApiClientTests(unittest.TestCase):
    def test_error_is_an_oanda_error(self):
        self.assertTrue(issubclass(MetaApiError, OandaError))

    def test_region_autodetected_and_token_header_sent(self):
        c, fake = client()
        c.summary()
        self.assertEqual(c.region, "london")
        self.assertIn("mt-provisioning-api", fake.calls[0][1])
        headers = {k.lower(): v for k, v in fake.calls[1][3].items()}
        self.assertEqual(headers["auth-token"], "tok")

    def test_region_override_skips_provisioning(self):
        fake = FakeMetaApi()
        fake.region = "singapore"
        c = MetaApiClient("tok", ACC, region="singapore", opener=fake)
        c.summary()
        self.assertFalse(any("provisioning" in u for _, u, _, _ in fake.calls))

    def test_undeployed_account_is_a_hard_error(self):
        fake = FakeMetaApi()
        fake.state = "UNDEPLOYED"
        c, _ = client(fake)
        with self.assertRaises(MetaApiError) as cm:
            c.summary()
        self.assertIn("deploy it", cm.exception.message)

    def test_summary_maps_fields(self):
        c, fake = client()
        fake.positions = [{"id": "1", "type": "POSITION_TYPE_BUY", "symbol": "XAUUSD", "openPrice": 1, "volume": 0.01}]
        a = c.summary()
        self.assertEqual((a.currency, a.balance, a.nav, a.margin_used, a.margin_available, a.open_trade_count),
                         ("USD", 149.13, 151.0, 3.0, 148.0, 1))
        self.assertAlmostEqual(a.unrealized_pl, 1.87)
        self.assertTrue(a.hedging_enabled)

    def test_instrument_reports_contract_units(self):
        c, _ = client()
        s = c.instrument("XAUUSD")
        self.assertEqual(s.minimum_trade_size, 1.0)        # 0.01 lot × 100 oz
        self.assertEqual(s.maximum_order_units, 5000.0)    # 50 lots × 100
        self.assertEqual(s.trade_units_precision, 0)       # step 0.01 × 100 = 1 oz
        self.assertEqual(s.display_precision, 2)
        self.assertEqual(s.pip_location, -2)
        self.assertEqual(s.fmt_units(-3), "-3")

    def test_unknown_symbol(self):
        c, _ = client()
        with self.assertRaises(MetaApiError) as cm:
            c.instrument("GOLD")
        self.assertEqual(cm.exception.code, "NO_INSTRUMENT")

    def test_pricing_price_of_and_factor(self):
        c, fake = client()
        c.instrument("XAUUSD")
        payload = c.pricing(["XAUUSD"])
        p = c.price_of(payload, "XAUUSD")
        self.assertEqual((p.bid, p.ask), (4334.10, 4334.40))
        self.assertTrue(p.tradeable)
        self.assertAlmostEqual(p.spread, 0.30, places=6)
        self.assertEqual(c.usd_to_account_factor(payload, "USD"), 1.0)
        fake.price = dict(fake.price, lossTickValue=0.78)   # GBP account: £0.78 per lot per 0.01 tick
        payload = c.pricing(["XAUUSD"])
        self.assertAlmostEqual(c.usd_to_account_factor(payload, "GBP"), 0.78)

    def test_units_to_lots_rounds_down(self):
        c, _ = client()
        self.assertEqual(c.units_to_lots("XAUUSD", 3.0), 0.03)
        self.assertEqual(c.units_to_lots("XAUUSD", -3.99), 0.03)
        self.assertEqual(c.units_to_lots("XAUUSD", 150), 1.5)

    def test_market_order_sell(self):
        c, fake = client()
        r = c.market_order("XAUUSD", "-3", "4340.00", "4326.00", "tg--100207-1-1784160000")
        self.assertTrue(r.ok, r.reason)
        body = [b for m, u, b, _ in fake.calls if u.endswith("/trade")][0]
        self.assertEqual(body["actionType"], "ORDER_TYPE_SELL")
        self.assertEqual(body["volume"], 0.03)
        self.assertEqual((body["stopLoss"], body["takeProfit"]), (4340.0, 4326.0))
        self.assertLessEqual(len(body["clientId"]), 20)
        self.assertEqual(r.trade_id, "47137555")
        self.assertEqual(r.fill_price, 4334.10)
        self.assertEqual(r.units, -3.0)

    def test_market_order_without_tp(self):
        c, fake = client()
        self.assertTrue(c.market_order("XAUUSD", "2", "4320", None, "x").ok)
        body = [b for m, u, b, _ in fake.calls if u.endswith("/trade")][0]
        self.assertNotIn("takeProfit", body)
        self.assertEqual(body["actionType"], "ORDER_TYPE_BUY")

    def test_below_minimum_sends_nothing(self):
        c, fake = client()
        r = c.market_order("XAUUSD", "0.5", "4320", None, "x")
        self.assertFalse(r.ok)
        self.assertIn("below broker minimum", r.reason)
        self.assertFalse(any(u.endswith("/trade") for _, u, _, _ in fake.calls))

    def test_broker_reject(self):
        c, fake = client()
        fake.trade_reply = {"numericCode": 10019, "stringCode": "TRADE_RETCODE_NO_MONEY", "message": "Not enough money"}
        r = c.market_order("XAUUSD", "3", "4320", None, "x")
        self.assertFalse(r.ok)
        self.assertIn("TRADE_RETCODE_NO_MONEY", r.reason)

    def test_network_failure_after_submit_is_flagged_uncertain(self):
        c, fake = client()
        c.instrument("XAUUSD")
        fake.network_fail_on_trade = True
        r = c.market_order("XAUUSD", "3", "4320", None, "x")
        self.assertFalse(r.ok)
        self.assertIn("UNCERTAIN", r.reason)

    def test_open_trades_and_trade_open(self):
        c, _ = client()
        c.market_order("XAUUSD", "-3", "4340", "4326", "x")
        ts = c.open_trades()
        self.assertEqual(len(ts), 1)
        self.assertEqual((ts[0].units, ts[0].state, ts[0].sl_price), (-3.0, "OPEN", 4340.0))
        self.assertEqual(c.trade("47137555").state, "OPEN")

    def test_trade_closed_from_deals(self):
        c, fake = client()
        fake.deals["99"] = [
            {"id": "1", "type": "DEAL_TYPE_SELL", "entryType": "DEAL_ENTRY_IN", "symbol": "XAUUSD", "volume": 0.03,
             "price": 4334.1, "profit": 0, "commission": -0.10, "swap": 0, "time": "2026-10-05T13:31:00Z",
             "stopLoss": 4340},
            {"id": "2", "type": "DEAL_TYPE_BUY", "entryType": "DEAL_ENTRY_OUT", "symbol": "XAUUSD", "volume": 0.03,
             "price": 4340.0, "profit": -17.70, "commission": -0.10, "swap": 0, "time": "2026-10-05T14:02:00Z",
             "reason": "DEAL_REASON_SL"},
        ]
        t = c.trade("99")
        self.assertEqual(t.state, "CLOSED")
        self.assertEqual(t.realized_pl, -17.90)
        self.assertEqual(t.average_close_price, 4340.0)
        self.assertEqual(t.initial_units, -3.0)
        self.assertEqual(c.close_reason("99"), "STOP_LOSS_ORDER")

    def test_trade_unknown_is_none(self):
        c, _ = client()
        self.assertIsNone(c.trade("404404"))

    def test_txn_poll_emits_close(self):
        c, fake = client()
        c.market_order("XAUUSD", "-3", "4340", "4326", "x")
        stop, events = threading.Event(), []

        def on_line(d):
            events.append(d)
            if d["type"] == "HEARTBEAT" and len([e for e in events if e["type"] == "HEARTBEAT"]) == 1:
                fake.positions.clear()   # position closes by TP between polls
                fake.deals["47137555"] = [
                    {"type": "DEAL_TYPE_SELL", "entryType": "DEAL_ENTRY_IN", "symbol": "XAUUSD", "volume": 0.03,
                     "price": 4334.1, "profit": 0, "time": "2026-10-05T13:31:00Z"},
                    {"type": "DEAL_TYPE_BUY", "entryType": "DEAL_ENTRY_OUT", "symbol": "XAUUSD", "volume": 0.03,
                     "price": 4326.0, "profit": 24.30, "time": "2026-10-05T14:10:00Z", "reason": "DEAL_REASON_TP"}]
            if d["type"] == "ORDER_FILL":
                stop.set()

        c.poll_seconds = 0.01
        th = threading.Thread(target=c.stream_transactions, args=(on_line, stop), daemon=True)
        th.start()
        th.join(5)
        stop.set()
        fill = [e for e in events if e["type"] == "ORDER_FILL"]
        self.assertEqual(len(fill), 1)
        self.assertEqual(fill[0]["reason"], "TAKE_PROFIT_ORDER")
        tc = fill[0]["tradesClosed"][0]
        self.assertEqual((tc["tradeID"], float(tc["price"]), float(tc["realizedPL"])), ("47137555", 4326.0, 24.3))

    def test_ts_parsing(self):
        self.assertAlmostEqual(_ts("2020-04-17T04:30:03.223Z"), 1587097803.223, places=3)
        self.assertAlmostEqual(_ts("2020-04-17T04:30:03"), 1587097803.0)
        self.assertEqual(_ts(1587097803223), 1587097803.223)
        self.assertEqual(_ts(None), 0.0)


BASE = {"BROKER": "metaapi", "METAAPI_TOKEN": "metaapi-token-xyz", "METAAPI_ACCOUNT_ID": ACC}


class MetaApiConfigTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.tmp.cleanup()

    def load(self, **env):
        with mock.patch.dict(os.environ, dict(STATE_DIR=self.tmp.name, **env), clear=True):
            return config.load()

    def test_defaults(self):
        s = self.load(**BASE)
        self.assertEqual((s.broker, s.instrument, s.metaapi_env, s.env), ("metaapi", "XAUUSD", "live", "live"))
        self.assertTrue(s.is_live)
        self.assertIsInstance(make_broker(s), MetaApiClient)

    def test_demo_is_practice(self):
        s = self.load(METAAPI_ENV="demo", METAAPI_SYMBOL="XAUUSD.r", **BASE)
        self.assertFalse(s.is_live)
        self.assertEqual((s.env, s.instrument), ("practice", "XAUUSD.r"))

    def test_requires_credentials(self):
        with self.assertRaises(config.ConfigError):
            self.load(BROKER="metaapi")

    def test_bad_values(self):
        for bad in ({"BROKER": "ib"}, dict(BASE, METAAPI_ENV="paper"), dict(BASE, METAAPI_POLL_SECONDS="1")):
            with self.assertRaises(config.ConfigError, msg=bad):
                self.load(**bad)

    def test_oanda_default_unchanged(self):
        s = self.load(OANDA_TOKEN="t", OANDA_ACCOUNT_ID="001-004-1-001")
        self.assertEqual((s.broker, s.instrument, s.env), ("oanda", "XAU_USD", "practice"))

    def test_redacted_masks_token(self):
        r = self.load(**BASE).redacted()
        self.assertNotIn("metaapi-token-xyz", json.dumps(r))
        self.assertEqual(r["broker"], "metaapi")


class MetaApiExecutorTests(unittest.TestCase):
    """The real Executor loop over the real MetaApiClient and the fake HTTP layer."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.state = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def make(self, **env):
        with mock.patch.dict(os.environ, dict(BASE, STATE_DIR=str(self.state), RISK_PCT="2", **env), clear=True):
            s = config.load()
        c, fake = client()
        ex = Executor(s, c, Store(LocalStore(self.state), None, env=s.env), NullNotifier())
        ex.account = c.summary()
        ex.spec = c.instrument(s.instrument)
        return ex, fake

    def events(self, kind):
        p = self.state / "events.jsonl"
        rows = [json.loads(l) for l in p.read_text().splitlines()] if p.exists() else []
        return [r for r in rows if r.get("kind") == kind]

    MSG = {"ts": 1784160000.0, "channel": "GOLD VIP", "channel_id": -100207, "msg_id": 1,
           "text": "SELL @ 4334 SL 4340 TP 4326"}

    def test_gate6_always_fails_on_metaapi(self):
        ex, _ = self.make()
        gate6 = [g for g in ex.gates() if "FCA" in g.label][0]
        self.assertFalse(gate6.passed)
        self.assertFalse(ex.live_allowed()[0])

    def test_live_without_override_refuses_signal(self):
        ex, fake = self.make()
        ex.handle_message(self.MSG)
        self.assertFalse(any(u.endswith("/trade") for _, u, _, _ in fake.calls))
        self.assertTrue(self.events("order_refused"))

    def test_dry_run_on_live_sizes_but_sends_nothing(self):
        ex, fake = self.make(DRY_RUN="1")
        fake.info["balance"] = fake.info["equity"] = 5000.0
        ex.account = ex.broker.summary()
        ex.handle_message(self.MSG)
        self.assertFalse(any(u.endswith("/trade") for _, u, _, _ in fake.calls))
        ev = self.events("dry_run_order")
        self.assertEqual(len(ev), 1)
        self.assertEqual(ev[0]["payload"]["units"], 16.0)   # 2% of 5000 / 6.00 stop

    def test_small_account_refuses_rather_than_oversizing(self):
        # 2% of 149.13 = 2.98 USD over a 6.00 stop = 0.497 oz < 1 oz (0.01 lot) minimum
        ex, fake = self.make(DRY_RUN="1")
        ex.handle_message(self.MSG)
        self.assertFalse(any(u.endswith("/trade") for _, u, _, _ in fake.calls))
        refused = self.events("order_refused")
        self.assertTrue(refused and "broker minimum" in refused[0]["payload"]["reason"])

    def test_override_live_fills_and_records_lots(self):
        ex, fake = self.make(GATE_OVERRIDE=config.OVERRIDE_PHRASE)
        fake.info["balance"] = fake.info["equity"] = 5000.0
        ex.account = ex.broker.summary()
        ex.handle_message(self.MSG)
        body = [b for m, u, b, _ in fake.calls if u.endswith("/trade")][0]
        # 2% of 5000 = 100 USD / 6.00 stop = 16 oz → 0.16 lots
        self.assertEqual(body["volume"], 0.16)
        trade = next(iter(ex.store.trades().values()))
        self.assertEqual((trade["units"], trade["status"], trade["env"]), (16.0, "open", "live"))


if __name__ == "__main__":
    unittest.main()
