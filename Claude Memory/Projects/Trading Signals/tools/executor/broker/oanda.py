"""OANDA v20 REST + streaming client — stdlib only (urllib).

Contract verified against developer.oanda.com on 2026-09-06:
  * REST  practice https://api-fxpractice.oanda.com   live https://api-fxtrade.oanda.com
  * Stream practice https://stream-fxpractice.oanda.com live https://stream-fxtrade.oanda.com
  * Authorization: Bearer <personal access token>; Content-Type: application/json
  * 120 req/s per IP, 20 active streams, 2 new connections/s
  * POST /v3/accounts/{id}/orders  {"order": {type: MARKET, instrument, units (±),
        timeInForce: FOK, positionFill: DEFAULT, stopLossOnFill: {price, timeInForce: GTC},
        takeProfitOnFill: {price}, clientExtensions: {id, tag, comment}}}
    → 201 with orderFillTransaction.tradeOpened.tradeID / .price / .units,
      or orderCancelTransaction (e.g. FOK not filled), or 400 orderRejectTransaction
  * GET  /v3/accounts/{id}/pricing?instruments=XAU_USD[&includeHomeConversions=true]
  * GET  {stream}/v3/accounts/{id}/pricing/stream?instruments=…   LDJSON, HEARTBEAT every 5 s
  * GET  {stream}/v3/accounts/{id}/transactions/stream             LDJSON, HEARTBEAT every 5 s
  * GET  /v3/accounts/{id}/summary, /instruments, /openTrades, /trades/{id}
  * PUT  /v3/accounts/{id}/trades/{id}/close  {"units": "ALL"}

Times are requested as UNIX epoch strings (Accept-Datetime-Format: UNIX).
"""
from __future__ import annotations

import json
import logging
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Callable, Dict, Iterable, List, Optional

log = logging.getLogger("executor.oanda")

USER_AGENT = "TradeGuardExecutor/0.1 (+personal; stdlib urllib)"


class OandaError(Exception):
    """Any HTTP-level or network failure talking to OANDA."""

    def __init__(self, status: int, code: str, message: str, body: Optional[dict] = None):
        super().__init__(f"OANDA {status} {code}: {message}")
        self.status = status
        self.code = code
        self.message = message
        self.body = body or {}


def _f(v, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class InstrumentSpec:
    name: str
    display_name: str
    type: str
    pip_location: int
    display_precision: int
    trade_units_precision: int
    minimum_trade_size: float
    maximum_order_units: float
    margin_rate: float

    def fmt_price(self, price: float) -> str:
        return f"{price:.{max(0, self.display_precision)}f}"

    def fmt_units(self, units: float) -> str:
        p = max(0, self.trade_units_precision)
        if p == 0:
            return str(int(round(units)))
        return f"{units:.{p}f}"

    @staticmethod
    def from_json(d: dict) -> "InstrumentSpec":
        return InstrumentSpec(
            name=d.get("name", ""),
            display_name=d.get("displayName", d.get("name", "")),
            type=d.get("type", ""),
            pip_location=int(d.get("pipLocation", -2)),
            display_precision=int(d.get("displayPrecision", 2)),
            trade_units_precision=int(d.get("tradeUnitsPrecision", 0)),
            minimum_trade_size=_f(d.get("minimumTradeSize"), 1.0),
            maximum_order_units=_f(d.get("maximumOrderUnits"), 1e9),
            margin_rate=_f(d.get("marginRate"), 0.05),
        )


@dataclass(frozen=True)
class Price:
    instrument: str
    bid: float
    ask: float
    time: float          # epoch seconds
    tradeable: bool

    @property
    def mid(self) -> float:
        return (self.bid + self.ask) / 2

    @property
    def spread(self) -> float:
        return self.ask - self.bid

    @staticmethod
    def from_json(d: dict) -> "Price":
        bids = d.get("bids") or []
        asks = d.get("asks") or []
        return Price(
            instrument=d.get("instrument", ""),
            bid=_f(bids[0]["price"]) if bids else _f(d.get("closeoutBid")),
            ask=_f(asks[0]["price"]) if asks else _f(d.get("closeoutAsk")),
            time=_f(d.get("time")),
            tradeable=(d.get("status") == "tradeable") or bool(d.get("tradeable")),
        )


@dataclass(frozen=True)
class AccountSummary:
    id: str
    currency: str
    balance: float
    nav: float
    unrealized_pl: float
    margin_used: float
    margin_available: float
    open_trade_count: int
    hedging_enabled: bool

    @staticmethod
    def from_json(d: dict) -> "AccountSummary":
        return AccountSummary(
            id=d.get("id", ""),
            currency=d.get("currency", ""),
            balance=_f(d.get("balance")),
            nav=_f(d.get("NAV")),
            unrealized_pl=_f(d.get("unrealizedPL")),
            margin_used=_f(d.get("marginUsed")),
            margin_available=_f(d.get("marginAvailable")),
            open_trade_count=int(d.get("openTradeCount", 0)),
            hedging_enabled=bool(d.get("hedgingEnabled", False)),
        )


@dataclass(frozen=True)
class Trade:
    id: str
    instrument: str
    units: float            # signed: + long, − short (currentUnits)
    initial_units: float
    price: float            # entry
    open_time: float
    state: str              # OPEN | CLOSED | …
    unrealized_pl: float
    realized_pl: float
    close_time: Optional[float]
    average_close_price: Optional[float]
    sl_price: Optional[float]
    tp_price: Optional[float]
    client_id: Optional[str]

    @property
    def side(self) -> int:
        return 1 if self.initial_units > 0 else -1

    @staticmethod
    def from_json(d: dict) -> "Trade":
        sl = d.get("stopLossOrder") or {}
        tp = d.get("takeProfitOrder") or {}
        ce = d.get("clientExtensions") or {}
        return Trade(
            id=str(d.get("id", "")),
            instrument=d.get("instrument", ""),
            units=_f(d.get("currentUnits")),
            initial_units=_f(d.get("initialUnits")),
            price=_f(d.get("price")),
            open_time=_f(d.get("openTime")),
            state=d.get("state", ""),
            unrealized_pl=_f(d.get("unrealizedPL")),
            realized_pl=_f(d.get("realizedPL")),
            close_time=_f(d["closeTime"]) if d.get("closeTime") else None,
            average_close_price=_f(d["averageClosePrice"]) if d.get("averageClosePrice") else None,
            sl_price=_f(sl["price"]) if sl.get("price") else None,
            tp_price=_f(tp["price"]) if tp.get("price") else None,
            client_id=ce.get("id"),
        )


@dataclass
class OrderResult:
    ok: bool
    trade_id: Optional[str] = None
    fill_price: Optional[float] = None
    units: Optional[float] = None
    transaction_id: Optional[str] = None
    reason: Optional[str] = None
    raw: dict = field(default_factory=dict)


class OandaClient:
    def __init__(self, rest_host: str, stream_host: str, token: str, account_id: str,
                 timeout: float = 15.0, opener: Optional[Callable] = None):
        self.rest = rest_host.rstrip("/")
        self.stream_base = stream_host.rstrip("/")
        self.token = token
        self.account_id = account_id
        self.timeout = timeout
        # injectable for tests: (urllib.request.Request, timeout) -> response
        self._open = opener or (lambda req, t: urllib.request.urlopen(req, timeout=t))

    # ------------------------------------------------------------ plumbing
    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Accept-Datetime-Format": "UNIX",
            "User-Agent": USER_AGENT,
        }

    def _url(self, path: str, params: Optional[dict] = None, stream: bool = False) -> str:
        base = self.stream_base if stream else self.rest
        url = base + path
        if params:
            url += "?" + urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
        return url

    def _request(self, method: str, path: str, params: Optional[dict] = None,
                 body: Optional[dict] = None) -> dict:
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(self._url(path, params), data=data, method=method, headers=self._headers())
        try:
            with self._open(req, self.timeout) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            try:
                payload = json.loads(e.read().decode("utf-8", "replace") or "{}")
            except Exception:
                payload = {}
            code = payload.get("errorCode") or (payload.get("orderRejectTransaction") or {}).get("rejectReason") or "HTTP_ERROR"
            msg = payload.get("errorMessage") or payload.get("rejectReason") or str(e.reason)
            raise OandaError(e.code, str(code), str(msg), payload) from None
        except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError, OSError) as e:
            raise OandaError(0, "NETWORK", str(e)) from None

    # ------------------------------------------------------------ account
    def summary(self) -> AccountSummary:
        d = self._request("GET", f"/v3/accounts/{self.account_id}/summary")
        return AccountSummary.from_json(d.get("account", {}))

    def instrument(self, name: str) -> InstrumentSpec:
        d = self._request("GET", f"/v3/accounts/{self.account_id}/instruments", {"instruments": name})
        items = d.get("instruments") or []
        if not items:
            raise OandaError(404, "NO_INSTRUMENT", f"{name} is not tradeable on this account")
        return InstrumentSpec.from_json(items[0])

    # ------------------------------------------------------------ pricing
    def pricing(self, instruments: Iterable[str], home_conversions: bool = False) -> dict:
        """Raw pricing payload; use ``price_of`` / ``usd_to_account_factor`` on it."""
        names = ",".join(instruments)
        return self._request("GET", f"/v3/accounts/{self.account_id}/pricing",
                             {"instruments": names, "includeHomeConversions": "true" if home_conversions else None})

    @staticmethod
    def price_of(payload: dict, instrument: str) -> Optional[Price]:
        for p in payload.get("prices") or []:
            if p.get("instrument") == instrument:
                return Price.from_json(p)
        return None

    @staticmethod
    def usd_to_account_factor(payload: dict, account_currency: str, quote_currency: str = "USD") -> float:
        """Multiply a quote-currency (USD) amount by this to get account currency.
        1.0 when the account is already in the quote currency or no factor is present."""
        if account_currency.upper() == quote_currency.upper():
            return 1.0
        for hc in payload.get("homeConversions") or []:
            if (hc.get("currency") or "").upper() == quote_currency.upper():
                f = _f(hc.get("positionValue") or hc.get("accountGain"), 0.0)
                if f > 0:
                    return f
        return 1.0

    # ------------------------------------------------------------ orders
    def market_order(self, instrument: str, units: str, sl_price: str,
                     tp_price: Optional[str], client_id: str, tag: str = "tradeguard",
                     comment: str = "") -> OrderResult:
        order: Dict[str, object] = {
            "type": "MARKET",
            "instrument": instrument,
            "units": units,
            "timeInForce": "FOK",
            "positionFill": "DEFAULT",
            "stopLossOnFill": {"price": sl_price, "timeInForce": "GTC"},
            "clientExtensions": {"id": client_id[:128], "tag": tag[:128], "comment": comment[:128]},
        }
        if tp_price:
            order["takeProfitOnFill"] = {"price": tp_price, "timeInForce": "GTC"}
        try:
            d = self._request("POST", f"/v3/accounts/{self.account_id}/orders", body={"order": order})
        except OandaError as e:
            return OrderResult(ok=False, reason=f"{e.code}: {e.message}", raw=e.body)

        fill = d.get("orderFillTransaction")
        if fill and fill.get("tradeOpened"):
            opened = fill["tradeOpened"]
            return OrderResult(ok=True, trade_id=str(opened.get("tradeID")), fill_price=_f(fill.get("price")),
                               units=_f(opened.get("units")), transaction_id=str(fill.get("id")), raw=d)
        cancel = d.get("orderCancelTransaction")
        if cancel:
            return OrderResult(ok=False, reason=f"cancelled: {cancel.get('reason')}", raw=d)
        reject = d.get("orderRejectTransaction")
        if reject:
            return OrderResult(ok=False, reason=f"rejected: {reject.get('rejectReason')}", raw=d)
        return OrderResult(ok=False, reason="no fill in response", raw=d)

    # ------------------------------------------------------------ trades
    def open_trades(self) -> List[Trade]:
        d = self._request("GET", f"/v3/accounts/{self.account_id}/openTrades")
        return [Trade.from_json(t) for t in d.get("trades") or []]

    def trade(self, trade_id: str) -> Optional[Trade]:
        try:
            d = self._request("GET", f"/v3/accounts/{self.account_id}/trades/{trade_id}")
        except OandaError as e:
            if e.status == 404:
                return None
            raise
        t = d.get("trade")
        return Trade.from_json(t) if t else None

    def close_trade(self, trade_id: str, units: str = "ALL") -> dict:
        return self._request("PUT", f"/v3/accounts/{self.account_id}/trades/{trade_id}/close", body={"units": units})

    def transactions_since(self, txn_id: str) -> List[dict]:
        d = self._request("GET", f"/v3/accounts/{self.account_id}/transactions/sinceid", {"id": txn_id})
        return d.get("transactions") or []

    # ------------------------------------------------------------ streams
    def _stream(self, path: str, params: Optional[dict], on_line: Callable[[dict], None],
                stop: threading.Event, read_timeout: float = 30.0) -> None:
        """One streaming connection; returns when the server closes it or ``stop`` is set.
        Raises OandaError on connect/read failure so the caller can back off."""
        req = urllib.request.Request(self._url(path, params, stream=True), headers=self._headers())
        try:
            with self._open(req, read_timeout) as resp:
                for raw in resp:
                    if stop.is_set():
                        return
                    line = raw.decode("utf-8", "replace").strip() if isinstance(raw, bytes) else str(raw).strip()
                    if not line:
                        continue
                    try:
                        on_line(json.loads(line))
                    except json.JSONDecodeError:
                        log.warning("stream: unparseable line %r", line[:120])
        except urllib.error.HTTPError as e:
            raise OandaError(e.code, "STREAM_HTTP", str(e.reason)) from None
        except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError, OSError) as e:
            raise OandaError(0, "STREAM_NETWORK", str(e)) from None

    def run_stream(self, path: str, params: Optional[dict], on_line: Callable[[dict], None],
                   stop: threading.Event, name: str = "stream") -> None:
        """Reconnecting stream loop with exponential backoff (1 → 60 s)."""
        backoff = 1.0
        while not stop.is_set():
            started = time.time()
            try:
                log.info("%s: connecting", name)
                self._stream(path, params, on_line, stop)
                log.info("%s: server closed the connection", name)
            except OandaError as e:
                log.warning("%s: %s", name, e)
            if stop.is_set():
                return
            # a connection that lived a while resets the backoff
            backoff = 1.0 if time.time() - started > 60 else min(backoff * 2, 60.0)
            stop.wait(backoff)

    def stream_prices(self, instruments: Iterable[str], on_line: Callable[[dict], None], stop: threading.Event) -> None:
        self.run_stream(f"/v3/accounts/{self.account_id}/pricing/stream",
                        {"instruments": ",".join(instruments), "snapshot": "true"}, on_line, stop, "price-stream")

    def stream_transactions(self, on_line: Callable[[dict], None], stop: threading.Event) -> None:
        self.run_stream(f"/v3/accounts/{self.account_id}/transactions/stream", None, on_line, stop, "txn-stream")
