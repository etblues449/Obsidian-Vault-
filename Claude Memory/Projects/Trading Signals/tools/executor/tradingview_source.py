"""Inbound signals from TradingView webhooks.

TradingView can send alerts via HTTP POST to a webhook endpoint.
This module runs an async HTTP server that accepts those alerts.

SECURITY: TradingView does not sign or authenticate its webhook requests in
any way. Anything that can reach this host:port can send a POST that looks
identical to a real alert. The only thing standing between "the internet"
and "treated as a genuine signal" is the shared secret checked below —
there is no other protection. Do not run this with TRADINGVIEW_WEBHOOK_HOST
set to anything other than 127.0.0.1 unless you understand exactly what is
exposing this port to the network, and the secret is set.
"""

from __future__ import annotations

import asyncio
import hmac
import itertools
import logging
import time
from typing import Awaitable, Callable, Optional

log = logging.getLogger("executor.tradingview")

_seq = itertools.count(1)


async def start_webhook_server(
    host: str,
    port: int,
    on_message: Callable[[dict], Awaitable[None]],
    secret: Optional[str] = None,
    stop: Optional[asyncio.Event] = None,
) -> None:
    """Start an HTTP webhook server listening for TradingView alerts."""
    try:
        from aiohttp import web
    except ImportError as exc:  # pragma: no cover
        raise SystemExit("aiohttp is not installed. Run: python -m pip install -r requirements.txt") from exc

    if not secret:
        log.warning(
            "TradingView webhook starting WITHOUT a secret configured — "
            "it will accept ANY request from anyone who can reach %s:%d. "
            "Set TRADINGVIEW_WEBHOOK_SECRET before exposing this beyond localhost.",
            host, port,
        )

    async def webhook_handler(request: web.Request):
        try:
            data = await request.json()
        except Exception:
            log.warning("webhook request with unparseable body from %s", request.remote)
            return web.json_response({"error": "invalid json"}, status=400)

        if secret:
            supplied = str(data.get("secret") or "")
            if not hmac.compare_digest(supplied, secret):
                log.warning("webhook request with missing/invalid secret from %s", request.remote)
                return web.json_response({"error": "unauthorized"}, status=401)
        else:
            log.warning("accepting unauthenticated webhook request from %s", request.remote)

        try:
            log.debug("received webhook: %s", data)
            alert_id = data.get("alert_id")
            msg_id = alert_id if alert_id else f"tv-{next(_seq)}-{int(data.get('time') or time.time())}"
            msg = {
                "ts": data.get("time") or time.time(),
                "channel": "TradingView",
                "channel_id": "tradingview",
                "msg_id": msg_id,
                "text": _format_message(data),
            }
            await on_message(msg)
            return web.json_response({"status": "ok"})
        except Exception:
            log.exception("webhook handler failed")
            return web.json_response({"error": "handler failed"}, status=400)

    app = web.Application()
    app.router.add_post("/webhook", webhook_handler)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    log.info("TradingView webhook server listening on %s:%d", host, port)

    if stop is None:
        await asyncio.sleep(float("inf"))
    else:
        await stop.wait()
        await runner.cleanup()


def _format_message(data: dict) -> str:
    """Convert TradingView JSON to signal text format for the parser."""
    side = (data.get("side") or "BUY").upper()
    entry = data.get("entry")
    sl = data.get("sl")
    tp = data.get("tp")

    parts = [side]
    if entry:
        parts.append(f"@ {entry}")
    if sl:
        parts.append(f"SL {sl}")
    if tp:
        parts.append(f"TP {tp}")

    return " ".join(parts)
