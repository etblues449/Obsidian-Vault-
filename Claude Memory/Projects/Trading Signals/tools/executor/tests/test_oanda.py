import json
import threading
import unittest

from executor.broker.oanda import InstrumentSpec, OandaClient, OandaError
from executor.tests.fakes import FakeResponse, Opener, http_error

REST = "https://api-fxpractice.oanda.com"
STREAM = "https://stream-fxpractice.oanda.com"
ACC = "001-004-1234567-001"

FILL = {
    "orderCreateTransaction": {"id": "100", "type": "MARKET_ORDER"},
    "orderFillTransaction": {"id": "101", "price": "4334.15", "units": "-2",
                             "tradeOpened": {"tradeID": "101", "units": "-2"}},
    "lastTransactionID": "101",
}


def client(handler):
    op = Opener(handler)
    return OandaClient(REST, STREAM, "tok-secret", ACC, opener=op), op


class MarketOrderTests(unittest.TestCase):
    def test_request_shape_and_fill(self):
        c, op = client(lambda req: FakeResponse(FILL, 201))
        spec = InstrumentSpec("XAU_USD", "Gold", "METAL", -2, 3, 0, 1, 10000, 0.05)
        res = c.market_order("XAU_USD", spec.fmt_units(-2), spec.fmt_price(4340), spec.fmt_price(4326),
                             client_id="tg-1-2-3", tag="tradeguard", comment="signal 1:2")
        req = op.last
        self.assertEqual(req.get_method(), "POST")
        self.assertEqual(req.full_url, f"{REST}/v3/accounts/{ACC}/orders")
        self.assertEqual(req.get_header("Authorization"), "Bearer tok-secret")
        self.assertEqual(req.get_header("Content-type"), "application/json")
        body = op.last_json()["order"]
        self.assertEqual(body["type"], "MARKET")
        self.assertEqual(body["units"], "-2")
        self.assertEqual(body["timeInForce"], "FOK")
        self.assertEqual(body["stopLossOnFill"], {"price": "4340.000", "timeInForce": "GTC"})
        self.assertEqual(body["takeProfitOnFill"], {"price": "4326.000", "timeInForce": "GTC"})
        self.assertEqual(body["clientExtensions"]["id"], "tg-1-2-3")
        self.assertTrue(res.ok)
        self.assertEqual(res.trade_id, "101")
        self.assertAlmostEqual(res.fill_price, 4334.15)
        self.assertAlmostEqual(res.units, -2)

    def test_no_tp_omits_field(self):
        c, op = client(lambda req: FakeResponse(FILL, 201))
        c.market_order("XAU_USD", "1", "4038.000", None, client_id="x")
        self.assertNotIn("takeProfitOnFill", op.last_json()["order"])

    def test_cancelled_fok(self):
        c, _ = client(lambda req: FakeResponse({"orderCreateTransaction": {}, "orderCancelTransaction": {"reason": "MARKET_HALTED"}}, 201))
        res = c.market_order("XAU_USD", "1", "4038.000", None, client_id="x")
        self.assertFalse(res.ok)
        self.assertIn("MARKET_HALTED", res.reason)

    def test_http_400_reject(self):
        payload = {"orderRejectTransaction": {"rejectReason": "INSUFFICIENT_MARGIN"}, "errorMessage": "Insufficient margin"}
        c, _ = client(lambda req: (_ for _ in ()).throw(http_error(req.full_url, 400, payload)))
        res = c.market_order("XAU_USD", "1", "4038.000", None, client_id="x")
        self.assertFalse(res.ok)
        self.assertIn("INSUFFICIENT_MARGIN", res.reason)
        self.assertIn("Insufficient margin", res.reason)


class ReadTests(unittest.TestCase):
    def test_summary_and_instrument(self):
        def handler(req):
            if req.full_url.endswith("/summary"):
                return FakeResponse({"account": {"id": ACC, "currency": "GBP", "balance": "500.00", "NAV": "498.5",
                                                 "unrealizedPL": "-1.5", "marginUsed": "20", "marginAvailable": "478.5",
                                                 "openTradeCount": 1, "hedgingEnabled": False}})
            if "/instruments" in req.full_url:
                self.assertIn("instruments=XAU_USD", req.full_url)
                return FakeResponse({"instruments": [{"name": "XAU_USD", "displayName": "Gold", "type": "METAL",
                                                      "pipLocation": -2, "displayPrecision": 3, "tradeUnitsPrecision": 0,
                                                      "minimumTradeSize": "1", "maximumOrderUnits": "10000", "marginRate": "0.05"}]})
            raise AssertionError(req.full_url)
        c, _ = client(handler)
        a = c.summary()
        self.assertEqual((a.currency, a.balance, a.nav, a.open_trade_count), ("GBP", 500.0, 498.5, 1))
        spec = c.instrument("XAU_USD")
        self.assertEqual((spec.minimum_trade_size, spec.trade_units_precision, spec.display_precision), (1.0, 0, 3))
        self.assertEqual(spec.fmt_price(4334.1), "4334.100")
        self.assertEqual(spec.fmt_units(-3.0), "-3")

    def test_pricing_and_home_conversion(self):
        payload = {"prices": [{"instrument": "XAU_USD", "bids": [{"price": "4334.10"}], "asks": [{"price": "4334.40"}],
                               "status": "tradeable", "time": "1720000000.0"}],
                   "homeConversions": [{"currency": "USD", "positionValue": "0.7800"}, {"currency": "GBP", "positionValue": "1"}]}
        c, op = client(lambda req: FakeResponse(payload))
        d = c.pricing(["XAU_USD"], home_conversions=True)
        self.assertIn("includeHomeConversions=true", op.last.full_url)
        p = c.price_of(d, "XAU_USD")
        self.assertAlmostEqual(p.mid, 4334.25)
        self.assertAlmostEqual(p.spread, 0.30)
        self.assertTrue(p.tradeable)
        self.assertAlmostEqual(c.usd_to_account_factor(d, "GBP"), 0.78)
        self.assertEqual(c.usd_to_account_factor(d, "USD"), 1.0)
        self.assertEqual(c.usd_to_account_factor({"prices": []}, "GBP"), 1.0)

    def test_trade_404_is_none_and_network_error_raises(self):
        c, _ = client(lambda req: (_ for _ in ()).throw(http_error(req.full_url, 404, {"errorMessage": "nope"})))
        self.assertIsNone(c.trade("999"))
        import urllib.error
        c2, _ = client(lambda req: (_ for _ in ()).throw(urllib.error.URLError("dns")))
        with self.assertRaises(OandaError) as ctx:
            c2.summary()
        self.assertEqual(ctx.exception.code, "NETWORK")

    def test_close_trade_body(self):
        c, op = client(lambda req: FakeResponse({"orderFillTransaction": {}}))
        c.close_trade("101")
        self.assertEqual(op.last.get_method(), "PUT")
        self.assertTrue(op.last.full_url.endswith("/trades/101/close"))
        self.assertEqual(op.last_json(), {"units": "ALL"})


class StreamTests(unittest.TestCase):
    def test_stream_parses_lines_and_stops(self):
        lines = [b'{"type":"HEARTBEAT","time":"1"}\n', b'\n',
                 b'{"type":"PRICE","instrument":"XAU_USD","bids":[{"price":"1"}],"asks":[{"price":"2"}],"status":"tradeable","time":"2"}\n',
                 b'not json\n']
        c, op = client(lambda req: FakeResponse(lines=lines))
        seen = []
        stop = threading.Event()

        def on_line(d):
            seen.append(d.get("type"))
            if len(seen) == 2:
                stop.set()  # stop after the price line

        c._stream(f"/v3/accounts/{ACC}/pricing/stream", {"instruments": "XAU_USD"}, on_line, stop)
        self.assertEqual(seen, ["HEARTBEAT", "PRICE"])
        self.assertTrue(op.last.full_url.startswith(STREAM))
        self.assertIn("instruments=XAU_USD", op.last.full_url)


if __name__ == "__main__":
    unittest.main()
