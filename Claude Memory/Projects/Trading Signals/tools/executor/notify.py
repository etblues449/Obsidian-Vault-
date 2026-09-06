"""Outbound alerts. Never raises into the trading path.

  TelegramNotifier  Bot API (a *bot* token — separate from the read-only user
                    session that ingests signals)
  WebPushNotifier   POSTs to the dashboard's /api/push/send, which fans out to
                    every phone that enabled push on /trade
  MultiNotifier     all of the above

Alert text is written once in Telegram-HTML; the push copy is the same text
with tags stripped, first line as the title.
"""
from __future__ import annotations

import html
import json
import logging
import re
import urllib.error
import urllib.request
from typing import Callable, Optional

log = logging.getLogger("executor.notify")

_TAG_RE = re.compile(r"<[^>]+>")


def strip_html(s: str) -> str:
    return html.unescape(_TAG_RE.sub("", s or ""))


def split_title(text: str):
    """(title, body) for push: first line is the title, the rest the body."""
    plain = strip_html(text).strip()
    if not plain:
        return "Trade Guard", ""
    first, _, rest = plain.partition("\n")
    return first.strip()[:120], rest.strip()[:1000]


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


class WebPushNotifier(Notifier):
    """Hands the alert to the dashboard, which owns the VAPID keys and the
    device list. Same bearer token the dashboard itself uses."""

    def __init__(self, dashboard_url: str, token: str, timeout: float = 10.0, opener: Optional[Callable] = None):
        self.url = dashboard_url.rstrip("/") + "/api/push/send"
        self.token = token
        self.timeout = timeout
        self._open = opener or (lambda req, t: urllib.request.urlopen(req, timeout=t))

    def send(self, text: str) -> bool:
        title, body = split_title(text)
        payload = json.dumps({"title": title, "body": body, "tag": "tradeguard", "url": "/trade"}).encode("utf-8")
        req = urllib.request.Request(self.url, data=payload, method="POST", headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.token}",
        })
        try:
            with self._open(req, self.timeout) as resp:
                raw = resp.read().decode("utf-8", "replace")
                try:
                    d = json.loads(raw or "{}")
                except json.JSONDecodeError:
                    d = {}
                ok = resp.status == 200 and bool(d.get("ok"))
                if not ok:
                    log.warning("web push: HTTP %s %s", resp.status, raw[:200])
                elif d.get("failed") or d.get("pruned"):
                    log.info("web push: sent %s failed %s pruned %s", d.get("sent"), d.get("failed"), d.get("pruned"))
                return ok
        except (urllib.error.URLError, OSError) as e:
            log.warning("web push failed: %s", e)
            return False


class MultiNotifier(Notifier):
    def __init__(self, *notifiers: Notifier):
        self.notifiers = [n for n in notifiers if n is not None]

    def send(self, text: str) -> bool:
        results = [n.send(text) for n in self.notifiers]
        return any(results)


def esc(s: object) -> str:
    """HTML-escape for Telegram's parse_mode=HTML."""
    return html.escape(str(s), quote=False)


def build(settings) -> Notifier:
    parts = []
    if settings.has_telegram_alerts:
        parts.append(TelegramNotifier(settings.telegram_bot_token, settings.telegram_chat_id))
    if getattr(settings, "has_webpush", False):
        parts.append(WebPushNotifier(settings.dashboard_url, settings.dashboard_token))
    if not parts:
        return NullNotifier()
    return parts[0] if len(parts) == 1 else MultiNotifier(*parts)
