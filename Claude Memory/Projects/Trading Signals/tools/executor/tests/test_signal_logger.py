"""The standalone logger (``tools/signal_logger.py``) carries the same login
guard as the executor; it is importable without Telethon since 2026-10-03
(lazy import) so the guard can be tested here."""
import asyncio
import io
import os
import tempfile
import types
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

import signal_logger as sl
from executor.parser import parse_signal as executor_parse
from executor.tests.fakes import FakeTelegramClient, FakeTgUser
from executor.tests.test_parser import GTH_FOLLOWUPS, GTH_SIGNAL
from executor.tests.test_telegram_source import DUMMY_BOT_TOKEN, LOGIN_INPUT_CASES


def run(coro):
    return asyncio.run(coro)


class ParserParityTests(unittest.TestCase):
    """The logger's dict parser and the executor's dataclass parser are twins —
    a channel format one understands, the other must too."""

    CASES = [
        GTH_SIGNAL,
        "SELL @ 4334 SL 4340 TP 4326",
        "BUY GOLD NOW @ 4045.5\nSL 4038\nTP1 4052\nTP2 4060",
        "XAU/USD SELL 4183/4180 SL 4190 TP 4170",
    ]

    def test_gold_tarding_hubb_channel_is_listened_to(self):
        self.assertIn("GOLD TARDING HUBB", sl.CHANNELS)

    def test_same_result_as_executor_parser(self):
        for text in self.CASES:
            with self.subTest(text=text[:30]):
                d, s = sl.parse_signal(text), executor_parse(text)
                self.assertEqual((d["side"], d["entry"], d["sl"], d["tp"]), (s.side, s.entry, s.sl, s.tp))
                self.assertEqual(tuple(d["tps"]), s.tps)
                self.assertEqual(d["entry_zone"], list(s.entry_zone) if s.entry_zone else None)

    def test_followups_are_noise_in_both(self):
        for text in GTH_FOLLOWUPS:
            with self.subTest(text=text[:30]):
                self.assertIsNone(sl.parse_signal(text))
                self.assertIsNone(executor_parse(text))


class ClassifyTests(unittest.TestCase):
    def test_same_table_as_executor(self):
        for raw, expected in LOGIN_INPUT_CASES:
            with self.subTest(raw=raw):
                self.assertEqual(sl.classify_login_input(raw), expected)

    def test_ask_phone_refuses_bot_token(self):
        out = io.StringIO()
        with mock.patch("builtins.input", side_effect=[DUMMY_BOT_TOKEN, "+447700900123"]), redirect_stdout(out):
            self.assertEqual(sl.ask_phone(), "+447700900123")
        self.assertIn("bot token", out.getvalue())
        self.assertNotIn(DUMMY_BOT_TOKEN, out.getvalue())


class SessionPathTests(unittest.TestCase):
    def test_session_lives_next_to_the_script_not_cwd(self):
        self.assertEqual(Path(sl.SESSION).parent, Path(sl.__file__).parent)
        self.assertEqual(Path(sl.SESSION).name, "jarvis_tg")
        self.assertEqual([p.name for p in sl.session_files()], ["jarvis_tg.session", "jarvis_tg.session-journal"])


class LoginFlowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.session = str(Path(self.tmp.name) / "jarvis_tg")
        FakeTelegramClient.reset()
        self.patches = [
            mock.patch.object(sl, "SESSION", self.session),
            mock.patch.object(sl, "_telethon", lambda: (FakeTelegramClient, None)),
            mock.patch.dict(os.environ, {"TG_API_ID": "123456", "TG_API_HASH": "dummyhash"}),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def _file(self) -> Path:
        return Path(self.session + ".session")

    def test_login_fresh(self):
        out = io.StringIO()
        with mock.patch("builtins.input", return_value="+447700900123"), redirect_stdout(out):
            run(sl.main(types.SimpleNamespace(login=True, list=False)))
        self.assertEqual(FakeTelegramClient.phones, ["+447700900123"])
        self.assertIn('"bot": false', self._file().read_text())
        self.assertIn("Signed in as Elliot (@elliot_h)", out.getvalue())
        self.assertIn("jarvis_tg.session", out.getvalue())

    def test_login_replaces_a_bot_session(self):
        self._file().write_text(FakeTgUser(bot=True, username="some_bot").to_json())
        out = io.StringIO()
        with mock.patch("builtins.input", return_value="+447700900123"), redirect_stdout(out):
            run(sl.main(types.SimpleNamespace(login=True, list=False)))
        self.assertIn('"bot": false', self._file().read_text())
        self.assertIn("BOT login (@some_bot)", out.getvalue())
        self.assertIn("Discarded jarvis_tg.session", out.getvalue())
        self.assertEqual(FakeTelegramClient.phones, ["+447700900123"])

    def test_run_refuses_a_bot_session_and_points_at_login(self):
        self._file().write_text(FakeTgUser(bot=True, username="some_bot").to_json())
        with mock.patch("builtins.input", side_effect=AssertionError("must not prompt")):
            with self.assertRaises(SystemExit) as cm:
                run(sl.main(types.SimpleNamespace(login=False, list=False)))
        self.assertIn("BOT login (@some_bot)", str(cm.exception))
        self.assertIn("--login", str(cm.exception))
        self.assertTrue(self._file().exists())

    def test_credentials_from_env(self):
        self.assertEqual(sl.get_credentials(), (123456, "dummyhash"))


if __name__ == "__main__":
    unittest.main()
