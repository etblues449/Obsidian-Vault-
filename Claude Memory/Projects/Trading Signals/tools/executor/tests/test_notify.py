import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from executor import config, notify
from executor.notify import MultiNotifier, NullNotifier, TelegramNotifier, WebPushNotifier, split_title, strip_html
from executor.tests.fakes import FakeResponse, Opener, http_error


class TextTests(unittest.TestCase):
    def test_strip_and_split(self):
        self.assertEqual(strip_html("✅ <b>Practice fill</b> SELL 1 &amp; more"), "✅ Practice fill SELL 1 & more")
        title, body = split_title("⛔ <b>Refused</b> SELL @ 4334\nkill-switch file present")
        self.assertEqual(title, "⛔ Refused SELL @ 4334")
        self.assertEqual(body, "kill-switch file present")
        self.assertEqual(split_title(""), ("Trade Guard", ""))


class WebPushTests(unittest.TestCase):
    def test_request_shape(self):
        op = Opener(lambda req: FakeResponse({"ok": True, "sent": 1, "failed": 0, "pruned": 0}))
        n = WebPushNotifier("https://jarvis.example.app/", "tok-123", opener=op)
        self.assertTrue(n.send("🟢 <b>Closed</b> trade 1001\nP&L +7.00 GBP"))
        req = op.last
        self.assertEqual(req.full_url, "https://jarvis.example.app/api/push/send")
        self.assertEqual(req.get_method(), "POST")
        self.assertEqual(req.get_header("Authorization"), "Bearer tok-123")
        body = op.last_json()
        self.assertEqual(body["title"], "🟢 Closed trade 1001")
        self.assertEqual(body["body"], "P&L +7.00 GBP")
        self.assertEqual(body["url"], "/trade")

    def test_failures_never_raise(self):
        n = WebPushNotifier("https://x", "t", opener=Opener(lambda req: (_ for _ in ()).throw(http_error(req.full_url, 503, {"ok": False}))))
        self.assertFalse(n.send("x"))
        n2 = WebPushNotifier("https://x", "t", opener=Opener(lambda req: FakeResponse({"ok": False, "error": "VAPID not set"}, 503)))
        self.assertFalse(n2.send("x"))


class TelegramTests(unittest.TestCase):
    def test_request_shape(self):
        op = Opener(lambda req: FakeResponse({"ok": True}))
        n = TelegramNotifier("123:abc", "42", opener=op)
        self.assertTrue(n.send("<b>hi</b>"))
        self.assertEqual(op.last.full_url, "https://api.telegram.org/bot123:abc/sendMessage")
        self.assertEqual(op.last_json()["chat_id"], "42")
        self.assertEqual(op.last_json()["parse_mode"], "HTML")


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.base = {"OANDA_TOKEN": "t", "OANDA_ACCOUNT_ID": "a", "STATE_DIR": self.tmp.name}

    def tearDown(self):
        self.tmp.cleanup()

    def _settings(self, **extra):
        with mock.patch.dict(os.environ, dict(self.base, **extra), clear=True):
            return config.load()

    def test_none_configured(self):
        self.assertIsInstance(notify.build(self._settings()), NullNotifier)

    def test_telegram_only(self):
        n = notify.build(self._settings(TELEGRAM_BOT_TOKEN="1:a", TELEGRAM_CHAT_ID="9"))
        self.assertIsInstance(n, TelegramNotifier)

    def test_both(self):
        s = self._settings(TELEGRAM_BOT_TOKEN="1:a", TELEGRAM_CHAT_ID="9", DASHBOARD_URL="https://d/",
                           DASHBOARD_TOKEN="dash-secret-token-xyz")
        self.assertTrue(s.has_webpush)
        self.assertEqual(s.dashboard_url, "https://d")
        n = notify.build(s)
        self.assertIsInstance(n, MultiNotifier)
        self.assertEqual(len(n.notifiers), 2)
        self.assertNotIn("dash-secret-token-xyz", str(s.redacted()))
        self.assertEqual(s.redacted()["dashboard_token"], "dash…yz")

    def test_multi_calls_all_and_reports_any(self):
        calls = []

        class Rec(notify.Notifier):
            def __init__(self, ok):
                self.ok = ok

            def send(self, text):
                calls.append(text)
                return self.ok

        m = MultiNotifier(Rec(False), Rec(True))
        self.assertTrue(m.send("x"))
        self.assertEqual(calls, ["x", "x"])


if __name__ == "__main__":
    unittest.main()
