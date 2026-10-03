"""Login hardening for the Telethon source (2026-10-03: a bot token typed at
the phone prompt signed the session in as the bot, which cannot read channels).

No Telethon needed: ``_client`` is swapped for ``FakeTelegramClient``, whose
session file is real so the delete-and-retry path is exercised for real.
"""
import asyncio
import io
import tempfile
import types
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

from executor import telegram_source as ts
from executor.tests.fakes import FakeTelegramClient, FakeTgUser

# Dummy shapes only — never a real token.
DUMMY_BOT_TOKEN = "123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

LOGIN_INPUT_CASES = [
    ("+447700900123", ("phone", "+447700900123")),
    ("  +44 7700 900-123 ", ("phone", "+447700900123")),
    ("(+44) 7700 900123", ("phone", "+447700900123")),
    ("+44.7700.900123", ("phone", "+447700900123")),
    ("0044 7700 900123", ("phone", "+447700900123")),
    (DUMMY_BOT_TOKEN, ("bot_token", None)),
    ("  " + DUMMY_BOT_TOKEN + "\n", ("bot_token", None)),
    ("anything:with:a:colon", ("bot_token", None)),
    ("07700900123", ("invalid", "missing country code — start with +, e.g. +44…")),
    ("447700900123", ("invalid", "missing country code — start with +, e.g. +44…")),
    ("+44", ("invalid", "not a phone number — digits only after the +, 7 to 15 of them")),
    ("+44abc7700", ("invalid", "not a phone number — digits only after the +, 7 to 15 of them")),
    ("+12345678901234567", ("invalid", "not a phone number — digits only after the +, 7 to 15 of them")),
    ("", ("invalid", "nothing entered")),
    (None, ("invalid", "nothing entered")),
]


def run(coro):
    return asyncio.run(coro)


class ClassifyTests(unittest.TestCase):
    def test_table(self):
        for raw, expected in LOGIN_INPUT_CASES:
            with self.subTest(raw=raw):
                self.assertEqual(ts.classify_login_input(raw), expected)


class AskPhoneTests(unittest.TestCase):
    def test_refuses_bot_token_then_accepts_phone(self):
        out = io.StringIO()
        with mock.patch("builtins.input", side_effect=[DUMMY_BOT_TOKEN, "07700 900123", "+44 7700 900123"]) as inp, \
                redirect_stdout(out):
            self.assertEqual(ts.ask_phone(), "+447700900123")
        self.assertEqual(inp.call_count, 3)
        printed = out.getvalue()
        self.assertIn("bot token", printed)
        self.assertIn("bots cannot read channels", printed)
        self.assertIn("missing country code", printed)
        self.assertNotIn(DUMMY_BOT_TOKEN, printed)  # never echo what was typed

    def test_prompt_names_the_trap(self):
        with mock.patch("builtins.input", return_value="+447700900123") as inp:
            ts.ask_phone()
        prompt = inp.call_args.args[0]
        self.assertIn("phone number", prompt)
        self.assertIn("NOT a bot token", prompt)


class SessionProblemTests(unittest.TestCase):
    def test_user_is_fine(self):
        self.assertIsNone(ts.session_problem(FakeTgUser()))

    def test_bot_named(self):
        msg = ts.session_problem(FakeTgUser(bot=True, username="goldvip_alerts_bot"))
        self.assertIn("BOT login", msg)
        self.assertIn("@goldvip_alerts_bot", msg)
        self.assertIn("cannot read channels", msg)

    def test_not_signed_in(self):
        self.assertIn("not signed in", ts.session_problem(None))

    def test_session_files(self):
        files = ts.session_files(Path("/state/executor_tg"))
        self.assertEqual([p.name for p in files], ["executor_tg.session", "executor_tg.session-journal"])


class LoginFlowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.session = Path(self.tmp.name) / "state" / "executor_tg"
        self.settings = types.SimpleNamespace(tg_session=self.session, tg_api_id=1, tg_api_hash="h")
        FakeTelegramClient.reset()
        self._client = mock.patch.object(
            ts, "_client", lambda s: FakeTelegramClient(s.tg_session, s.tg_api_id, s.tg_api_hash))
        self._client.start()

    def tearDown(self):
        self._client.stop()
        self.tmp.cleanup()

    def _file(self) -> Path:
        return ts.session_files(self.session)[0]

    def test_fresh_login_prompts_for_phone_and_writes_user_session(self):
        out = io.StringIO()
        with mock.patch("builtins.input", return_value="+44 7700 900123"), redirect_stdout(out):
            run(ts.login(self.settings))
        self.assertEqual(FakeTelegramClient.phones, ["+447700900123"])
        self.assertTrue(self._file().exists())
        self.assertIn('"bot": false', self._file().read_text())
        self.assertIn("Signed in as Elliot (@elliot_h)", out.getvalue())
        self.assertTrue(all(c.disconnected for c in FakeTelegramClient.instances))

    def test_existing_user_session_needs_no_prompt(self):
        self._file().parent.mkdir(parents=True)
        self._file().write_text(FakeTgUser().to_json())
        with mock.patch("builtins.input", side_effect=AssertionError("must not prompt")), redirect_stdout(io.StringIO()):
            run(ts.login(self.settings))
        self.assertEqual(FakeTelegramClient.phones, [])

    def test_bot_session_on_disk_is_discarded_and_login_repeated(self):
        # The 2026-10-03 state: jarvis_tg.session holds a *bot* login.
        self._file().parent.mkdir(parents=True)
        self._file().write_text(FakeTgUser(bot=True, username="some_bot").to_json())
        out = io.StringIO()
        with mock.patch("builtins.input", return_value="+447700900123"), redirect_stdout(out):
            run(ts.login(self.settings))
        self.assertEqual(FakeTelegramClient.phones, ["+447700900123"])
        self.assertIn('"bot": false', self._file().read_text())
        self.assertEqual(len(FakeTelegramClient.instances), 2)
        self.assertTrue(FakeTelegramClient.instances[0].disconnected)
        self.assertFalse(FakeTelegramClient.instances[0].prompted)  # the bot session was "authorised"
        self.assertTrue(FakeTelegramClient.instances[1].prompted)
        printed = out.getvalue()
        self.assertIn("BOT login (@some_bot)", printed)
        self.assertIn("Discarded", printed)
        self.assertIn("Signed in as Elliot", printed)

    def test_gives_up_if_relogin_is_still_a_bot(self):
        self._file().parent.mkdir(parents=True)
        self._file().write_text(FakeTgUser(bot=True).to_json())
        FakeTelegramClient.reset(login_as=FakeTgUser(bot=True, username="still_bot"))
        with mock.patch("builtins.input", return_value="+447700900123"), redirect_stdout(io.StringIO()):
            with self.assertRaises(SystemExit) as cm:
                run(ts.login(self.settings))
        self.assertIn("giving up", str(cm.exception))
        self.assertIn("executor_tg.session", str(cm.exception))

    def test_listen_and_list_refuse_a_bot_session_without_deleting_it(self):
        self._file().parent.mkdir(parents=True)
        self._file().write_text(FakeTgUser(bot=True, username="some_bot").to_json())
        with mock.patch("builtins.input", side_effect=AssertionError("must not prompt")):
            with self.assertRaises(SystemExit) as cm:
                run(ts._start_user_session(self.settings, fix_bot_session=False))
        self.assertIn("BOT login (@some_bot)", str(cm.exception))
        self.assertIn("--login", str(cm.exception))
        self.assertTrue(self._file().exists())  # only --login is allowed to delete
        self.assertTrue(FakeTelegramClient.instances[0].disconnected)

    def test_delete_session_files_reports_what_it_removed(self):
        self.assertEqual(ts.delete_session_files(self.session), [])
        self._file().parent.mkdir(parents=True)
        self._file().write_text("x")
        ts.session_files(self.session)[1].write_text("j")
        removed = ts.delete_session_files(self.session)
        self.assertEqual([p.name for p in removed], ["executor_tg.session", "executor_tg.session-journal"])
        self.assertFalse(self._file().exists())


if __name__ == "__main__":
    unittest.main()
