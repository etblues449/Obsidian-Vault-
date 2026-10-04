"""MetaAPI (metaapi.cloud) REST client — stdlib only (urllib).

Drop-in replacement for ``OandaClient``: same method names, same return
types (``AccountSummary``, ``InstrumentSpec``, ``Price``, ``Trade``,
``OrderResult``), same exception base (``OandaError``), so ``main.py``'s
risk path, reconcile and close tracking run unchanged.

Contract checked against metaapi.cloud/docs/client/restApi on 2026-10-04:
  * Client REST   https://mt-client-api-v1.<region>.agiliumtrade.ai
  * Provisioning  https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai
  * Header        auth-token: <token>
  * GET  /users/current/accounts/{id}/account-information
  * GET  /users/current/accounts/{id}/positions[/{positionId}]
  * GET  /users/current/accounts/{id}/symbols/{symbol}/specification
          → tickSize, minVolume, maxVolume, volumeStep, contractSize, digits
  * GET  /users/current/accounts/{id}/symbols/{symbol}/current-price
          → bid, ask, time, profitTickValue, lossTickValue
  * GET  /users/current/accounts/{id}/history-deals/position/{positionId}
          → [{entryType DEAL_ENTRY_IN|OUT, price, volume, profit, commission, swap, time, reason}]
  * POST /users/current/accounts/{id}/trade
          {actionType ORDER_TYPE_BUY|SELL, symbol, volume, stopLoss, takeProfit, clientId}
          → {numericCode, stringCode TRADE_RETCODE_DONE, message, orderId, positionId?}

Unit model. MetaTrader trades in LOTS; the executor's risk maths works in
contract units (for XAUUSD: ounces, where P&L per unit per $1 move = $1).
This adapter therefore reports sizes in contract units
(``lots × contractSize``) and converts back to lots at order time, ROUNDING
DOWN to the broker's volume step — it can never send a bigger order than the
risk engine sized.

Streams. MetaAPI's streaming is socket.io, not plain HTTP, so prices and
"transactions" are polled (default every 10 s). A position that disappears
between polls is looked up in history deals and emitted as an OANDA-shaped
``ORDER_FILL`` with ``tradesClosed`` — exactly what ``Executor._on_txn``
already consumes.
"""
from __future__ import annotations

import json
import logging
import math
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Callable, Dict, Iterable, List, Optional

from .oanda import AccountSummary, InstrumentSpec, OandaError, OrderResult, Price, Trade

log = logging.getLogger("executor.metaapi")

USER_AGENT = "TradeGuardExecutor/0.1 (+personal; stdlib urllib)"
PROVISIONING = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai"
DEFAULT_REGION = "new-york"
OK_CODES = {"TRADE_RETCODE_DONE", "TRADE_RETCODE_DONE_PARTIAL", "TRADE_RETCODE_PLACED"}

# MetaTrader deal reason → the OANDA-style reason strings main.py logs
CLOSE_REASONS = {
    "DEAL_REASON_SL": "STOP_LOSS_ORDER",
    "DEAL_REASON_TP": "TAKE_PROFIT_ORDER",
    "DEAL_REASON_SO": "MARKET_ORDER_MARGIN_CLOSEOUT",
}


class MetaApiError(OandaError):
    """Any HTTP-level or network failure talking to MetaAPI. Subclasses
    ``OandaError`` so every existing ``except OandaError`` in main.py applies."""


def _f(v, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _ts(v) -> float:
    """MetaAPI time → epoch seconds. Accepts ISO strings ('2020-04-17T04:30:03.223Z'),
    epoch seconds or epoch milliseconds. Naive ISO strings are treated as UTC."""
    if v is None or v == "":
        return 0.0
    if isinstance(v, (int, float)):
        return float(v) / 1000.0 if v > 1e12 else float(v)
    try:
        dt = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def _decimals(x: float) -> int:
    """Number of decimal places needed to represent a step like 0.01 → 2, 1.0 → 0."""
    if x <= 0:
        return 0
    d = 0
    while d < 10 and abs(round(x, d) - x) > 1e-12:
        d += 1
    return d


class MetaApiClient:
    def __init__(self, token: str, account_id: str, region: Optional[str] = None,
                 poll_seconds: float = 10.0, timeout: float = 20.0,
                 opener: Optional[Callable] = None):
        self.token = token
        self.account_id = account_id
        self.poll_seconds = max(1.0, float(poll_seconds))
        self.timeout = timeout
        self._open = opener or (lambda req, t: urllib.request.urlopen(req, timeout=t))
        self._region = region or None
        self._specs: Dict[str, dict] = {}
        self._currency: Optional[str] = None

    # ------------------------------------------------------------ plumbing
    def _headers(self) -> Dict[str, str]:
        return {"auth-token": self.token, "Accept": "application/json",
                "Content-Type": "application/json", "User-Agent": USER_AGENT}

    def _raw(self, method: str, url: str, body: Optional[dict] = None):
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers=self._headers())
        try:
            with self._open(req, self.timeout) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            try:
                payload = json.loads(e.read().decode("utf-8", "replace") or "{}")
            except Exception:
                payload = {}
            code = payload.get("error") or "HTTP_ERROR"
            msg = payload.get("message") or str(e.reason)
            raise MetaApiError(e.code, str(code), str(msg), payload if isinstance(payload, dict) else {}) from None
        except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError, OSError) as e:
            raise MetaApiError(0, "NETWORK", str(e)) from None

    @property
    def region(self) -> str:
        """Resolve the account's MetaAPI region once, via the provisioning API.
        Falls back to new-york (MetaAPI's default) if provisioning is not
        readable with this token."""
        if self._region:
            return self._region
        try:
            acc = self._raw("GET", f"{PROVISIONING}/users/current/accounts/{self.account_id}")
            state = acc.get("state")
            if state and state != "DEPLOYED":
                raise MetaApiError(409, "NOT_DEPLOYED",
                                   f"MetaAPI account is {state}; deploy it at app.metaapi.cloud/accounts first")
            if acc.get("connectionStatus") and acc.get("connectionStatus") != "CONNECTED":
                log.warning("MetaAPI account connectionStatus=%s (broker terminal not connected yet)",
                            acc.get("connectionStatus"))
            self._region = acc.get("region") or DEFAULT_REGION
        except MetaApiError as e:
            if e.code == "NOT_DEPLOYED":
                raise
            log.warning("MetaAPI provisioning lookup failed (%s); assuming region %s", e, DEFAULT_REGION)
            self._region = DEFAULT_REGION
        return self._region

    def _url(self, path: str, params: Optional[dict] = None) -> str:
        url = f"https://mt-client-api-v1.{self.region}.agiliumtrade.ai/users/current/accounts/{self.account_id}{path}"
        if params:
            url += "?" + urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
        return url

    def _request(self, method: str, path: str, params: Optional[dict] = None, body: Optional[dict] = None):
        return self._raw(method, self._url(path, params), body)

    # ------------------------------------------------------------ account
    def summary(self) -> AccountSummary:
        info = self._request("GET", "/account-information")
        positions = self._request("GET", "/positions") or []
        self._currency = info.get("currency") or self._currency
        balance = _f(info.get("balance"))
        equity = _f(info.get("equity"), balance)
        return AccountSummary(
            id=self.account_id,
            currency=info.get("currency", ""),
            balance=balance,
            nav=equity,
            unrealized_pl=round(equity - balance, 2),
            margin_used=_f(info.get("margin")),
            margin_available=_f(info.get("freeMargin")),
            open_trade_count=len(positions),
            hedging_enabled=True,   # MT4 accounts are hedging accounts
        )

    def _spec(self, symbol: str) -> dict:
        if symbol not in self._specs:
            d = self._request("GET", f"/symbols/{urllib.parse.quote(symbol)}/specification")
            if not d or _f(d.get("contractSize")) <= 0:
                raise MetaApiError(404, "NO_INSTRUMENT", f"{symbol}: no usable specification (contractSize missing)")
            self._specs[symbol] = d
        return self._specs[symbol]

    def instrument(self, name: str) -> InstrumentSpec:
        try:
            d = self._spec(name)
        except MetaApiError as e:
            if e.status == 404:
                raise MetaApiError(404, "NO_INSTRUMENT", f"{name} is not tradeable on this account") from None
            raise
        cs = _f(d.get("contractSize"))
        step = _f(d.get("volumeStep"), 0.01)
        tick = _f(d.get("tickSize"), 0.01)
        digits = int(d["digits"]) if d.get("digits") is not None else _decimals(tick)
        return InstrumentSpec(
            name=name,
            display_name=d.get("description") or name,
            type="CFD",
            pip_location=int(round(math.log10(tick))) if tick > 0 else -2,
            display_precision=digits,
            trade_units_precision=_decimals(step * cs),
            minimum_trade_size=round(_f(d.get("minVolume"), step) * cs, 10),
            maximum_order_units=round(_f(d.get("maxVolume"), 100.0) * cs, 10),
            margin_rate=0.0,   # not exposed per-symbol on MT4; margin is checked by the broker
        )

    # ------------------------------------------------------------ pricing
    def pricing(self, instruments: Iterable[str], home_conversions: bool = False) -> dict:
        prices, meta = [], {}
        for sym in instruments:
            p = self._request("GET", f"/symbols/{urllib.parse.quote(sym)}/current-price", {"keepSubscription": "true"})
            prices.append(self._price_json(sym, p))
            meta[sym] = {"lossTickValue": _f(p.get("lossTickValue")), "profitTickValue": _f(p.get("profitTickValue"))}
        return {"prices": prices, "metaapi": meta}

    @staticmethod
    def _price_json(symbol: str, p: dict) -> dict:
        """OANDA-shaped price line so ``Price.from_json`` and main._price_stream work unchanged."""
        bid, ask = _f(p.get("bid")), _f(p.get("ask"))
        return {"type": "PRICE", "instrument": symbol,
                "bids": [{"price": str(bid)}], "asks": [{"price": str(ask)}],
                "time": str(_ts(p.get("time")) or time.time()),
                "tradeable": bid > 0 and ask > 0}

    @staticmethod
    def price_of(payload: dict, instrument: str) -> Optional[Price]:
        for p in payload.get("prices") or []:
            if p.get("instrument") == instrument:
                return Price.from_json(p)
        return None

    def usd_to_account_factor(self, payload: dict, account_currency: str, quote_currency: str = "USD") -> float:
        """Account-currency value of 1 USD of P&L. 1.0 for a USD account.
        Otherwise derived from MetaAPI's lossTickValue (account ccy per lot per
        tick) ÷ (tickSize × contractSize) (USD per lot per tick)."""
        if account_currency.upper() == quote_currency.upper():
            return 1.0
        for sym, m in (payload.get("metaapi") or {}).items():
            spec = self._specs.get(sym)
            if not spec:
                continue
            usd_per_tick = _f(spec.get("tickSize")) * _f(spec.get("contractSize"))
            if m.get("lossTickValue", 0) > 0 and usd_per_tick > 0:
                return m["lossTickValue"] / usd_per_tick
        return 1.0

    # ------------------------------------------------------------ orders
    def units_to_lots(self, symbol: str, units: float) -> float:
        spec = self._spec(symbol)
        cs = _f(spec.get("contractSize"))
        step = _f(spec.get("volumeStep"), 0.01)
        lots = math.floor(abs(units) / cs / step + 1e-9) * step
        return round(lots, _decimals(step))

    def market_order(self, instrument: str, units: str, sl_price: str,
                     tp_price: Optional[str], client_id: str, tag: str = "tradeguard",
                     comment: str = "") -> OrderResult:
        try:
            u = float(units)
            spec = self._spec(instrument)
        except (ValueError, MetaApiError) as e:
            return OrderResult(ok=False, reason=f"cannot size order: {e}")
        if u == 0:
            return OrderResult(ok=False, reason="zero units")
        lots = self.units_to_lots(instrument, u)
        min_lots = _f(spec.get("minVolume"), _f(spec.get("volumeStep"), 0.01))
        if lots < min_lots:
            return OrderResult(ok=False, reason=f"{abs(u):g} units = {lots} lots, below broker minimum {min_lots} lots")
        body = {
            "actionType": "ORDER_TYPE_BUY" if u > 0 else "ORDER_TYPE_SELL",
            "symbol": instrument,
            "volume": lots,
            "stopLoss": float(sl_price),
            # MetaTrader caps comment+clientId length; keep the id short and unique
            "clientId": ("TG" + client_id.replace("-", "")[-18:])[:20],
        }
        if tp_price:
            body["takeProfit"] = float(tp_price)
        try:
            d = self._request("POST", "/trade", body=body)
        except MetaApiError as e:
            if e.status == 0:
                # Network failure AFTER sending: the order may exist. Reconcile adopts it.
                return OrderResult(ok=False, reason=f"UNCERTAIN — network error after submit ({e.message}); "
                                                    f"check the terminal, reconcile will adopt any fill")
            return OrderResult(ok=False, reason=f"{e.code}: {e.message}", raw=e.body)

        code = d.get("stringCode", "")
        if code not in OK_CODES:
            return OrderResult(ok=False, reason=f"rejected: {code} {d.get('message', '')}".strip(), raw=d)

        pos_id = str(d.get("positionId") or d.get("orderId") or "")
        fill, vol = None, None
        for _ in range(3):   # position can take a moment to appear in terminal state
            try:
                p = self._request("GET", f"/positions/{pos_id}")
                fill, vol = _f(p.get("openPrice")) or None, _f(p.get("volume")) or None
                break
            except MetaApiError:
                time.sleep(0.5)
        cs = _f(spec.get("contractSize"))
        return OrderResult(ok=True, trade_id=pos_id, fill_price=fill,
                           units=(vol or lots) * cs * (1 if u > 0 else -1),
                           transaction_id=str(d.get("orderId") or pos_id), raw=d)

    # ------------------------------------------------------------ trades
    def _trade_from_position(self, p: dict) -> Trade:
        sym = p.get("symbol", "")
        cs = _f(self._spec(sym).get("contractSize"), 1.0) if sym else 1.0
        side = 1 if p.get("type") == "POSITION_TYPE_BUY" else -1
        units = _f(p.get("volume")) * cs * side
        return Trade(
            id=str(p.get("id", "")), instrument=sym, units=units, initial_units=units,
            price=_f(p.get("openPrice")), open_time=_ts(p.get("time")), state="OPEN",
            unrealized_pl=_f(p.get("profit")) + _f(p.get("swap")) + _f(p.get("commission")),
            realized_pl=0.0, close_time=None, average_close_price=None,
            sl_price=_f(p["stopLoss"]) if p.get("stopLoss") else None,
            tp_price=_f(p["takeProfit"]) if p.get("takeProfit") else None,
            client_id=p.get("clientId"),
        )

    def open_trades(self) -> List[Trade]:
        return [self._trade_from_position(p) for p in (self._request("GET", "/positions") or [])]

    def trade(self, trade_id: str) -> Optional[Trade]:
        try:
            return self._trade_from_position(self._request("GET", f"/positions/{trade_id}"))
        except MetaApiError as e:
            if e.status != 404:
                raise
        deals = self._request("GET", f"/history-deals/position/{trade_id}") or []
        if not deals:
            return None
        ins = [d for d in deals if d.get("entryType") == "DEAL_ENTRY_IN"]
        outs = sorted((d for d in deals if d.get("entryType") in ("DEAL_ENTRY_OUT", "DEAL_ENTRY_OUT_BY")),
                      key=lambda d: _ts(d.get("time")))
        first = ins[0] if ins else deals[0]
        sym = first.get("symbol", "")
        cs = _f(self._spec(sym).get("contractSize"), 1.0) if sym else 1.0
        side = 1 if first.get("type") == "DEAL_TYPE_BUY" else -1
        realized = round(sum(_f(d.get("profit")) + _f(d.get("commission")) + _f(d.get("swap")) for d in deals), 2)
        closed = bool(outs)
        return Trade(
            id=str(trade_id), instrument=sym,
            units=0.0 if closed else _f(first.get("volume")) * cs * side,
            initial_units=_f(first.get("volume")) * cs * side,
            price=_f(first.get("price")), open_time=_ts(first.get("time")),
            state="CLOSED" if closed else "OPEN",
            unrealized_pl=0.0, realized_pl=realized if closed else 0.0,
            close_time=_ts(outs[-1].get("time")) if closed else None,
            average_close_price=_f(outs[-1].get("price")) if closed else None,
            sl_price=_f(first["stopLoss"]) if first.get("stopLoss") else None,
            tp_price=_f(first["takeProfit"]) if first.get("takeProfit") else None,
            client_id=first.get("clientId"),
        )

    def close_reason(self, trade_id: str) -> str:
        try:
            deals = self._request("GET", f"/history-deals/position/{trade_id}") or []
        except MetaApiError:
            return "MARKET_ORDER_TRADE_CLOSE"
        outs = [d for d in deals if d.get("entryType") in ("DEAL_ENTRY_OUT", "DEAL_ENTRY_OUT_BY")]
        return CLOSE_REASONS.get((outs[-1].get("reason") if outs else ""), "MARKET_ORDER_TRADE_CLOSE")

    def close_trade(self, trade_id: str, units: str = "ALL") -> dict:
        return self._request("POST", "/trade", body={"actionType": "POSITION_CLOSE_ID", "positionId": str(trade_id)})

    def transactions_since(self, txn_id: str) -> List[dict]:
        return []   # no OANDA-style transaction ids on MetaTrader; closes come via stream_transactions

    # ------------------------------------------------------------ "streams" (polling)
    def stream_transactions(self, on_line: Callable[[dict], None], stop: threading.Event) -> None:
        """Poll open positions; when one disappears, emit an OANDA-shaped ORDER_FILL
        close built from history deals. Reconnect-safe: errors back off, never raise."""
        known: Optional[set] = None
        backoff = self.poll_seconds
        while not stop.is_set():
            try:
                current = {str(p.get("id")) for p in (self._request("GET", "/positions") or [])}
                if known is not None:
                    for pid in sorted(known - current):
                        t = self.trade(pid)
                        if t and t.state == "CLOSED":
                            on_line({
                                "type": "ORDER_FILL", "id": f"mt-close-{pid}",
                                "time": str(t.close_time or time.time()),
                                "reason": self.close_reason(pid),
                                "tradesClosed": [{"tradeID": pid, "price": str(t.average_close_price or 0.0),
                                                  "realizedPL": str(t.realized_pl)}],
                            })
                known = current
                on_line({"type": "HEARTBEAT", "time": str(time.time())})
                backoff = self.poll_seconds
            except Exception as e:  # noqa: BLE001 — a poller must never die
                log.warning("txn-poll: %s", e)
                backoff = min(backoff * 2, 120.0)
            stop.wait(backoff)

    def stream_prices(self, instruments: Iterable[str], on_line: Callable[[dict], None], stop: threading.Event) -> None:
        names = list(instruments)
        backoff = self.poll_seconds
        while not stop.is_set():
            try:
                for line in self.pricing(names)["prices"]:
                    on_line(line)
                backoff = self.poll_seconds
            except Exception as e:  # noqa: BLE001
                log.warning("price-poll: %s", e)
                backoff = min(backoff * 2, 120.0)
            stop.wait(backoff)
