"""Outbound alerts. Telegram Bot API today (a *bot* token — separate from the
read-only user session that ingests signals). Web Push is delivered by the
dashboard side from the events table. Never raises into the trading path.
"""
from __future__ import annotations

import html
import json
import logging
import urllib.error
import urllib.request
from typing import Callable, Optional

log = logging.getLogger("executor.notify")


class Notifier:
    def send(self, text: str) -> bool:  # pragma: no cover - interface
        return False


class NullNotifier(Notifier):
    def send(self, text: str) -> bool:
        log.info("alert (no channel configured): %s", text.replace("\n", " | "))
        return False


class TelegramNotifier(Notifier):
    def __init__(self, bot_token: str, chat_id: str, timeout: float = 10.0, opener: Optional[Callable] = None):
        self.url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        self.chat_id = chat_id
        self.timeout = timeout
        self._open = opener or (lambda req, t: urllib.request.urlopen(req, timeout=t))

    def send(self, text: str) -> bool:
        body = json.dumps({
            "chat_id": self.chat_id,
            "text": text[:4000],
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }).encode("utf-8")
        req = urllib.request.Request(self.url, data=body, method="POST",
                                     headers={"Content-Type": "application/json"})
        try:
            with self._open(req, self.timeout) as resp:
                ok = resp.status == 200
                if not ok:
                    log.warning("telegram alert: HTTP %s", resp.status)
                return ok
        except (urllib.error.URLError, OSError) as e:
            log.warning("telegram alert failed: %s", e)
            return False


def esc(s: object) -> str:
    """HTML-escape for Telegram's parse_mode=HTML."""
    return html.escape(str(s), quote=False)


def build(settings) -> Notifier:
    if settings.has_telegram_alerts:
        return TelegramNotifier(settings.telegram_bot_token, settings.telegram_chat_id)
    return NullNotifier()
