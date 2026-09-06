import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from executor import config

# Fixture values only — never real credentials (this repo is public).
BASE = {
    "OANDA_TOKEN": "abcdefghijkl",
    "OANDA_ACCOUNT_ID": "001-004-1234567-001",
    "TG_API_ID": "1234567",
    "TG_API_HASH": "0123456789abcdef0123456789abcdef",
}


def env(**extra):
    e = dict(BASE)
    e.update(extra)
    return mock.patch.dict(os.environ, e, clear=True)


class LoadTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.state = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_defaults_are_practice_and_conservative(self):
        with env(STATE_DIR=str(self.state)):
            s = config.load()
        self.assertEqual(s.oanda_env, "practice")
        self.assertFalse(s.is_live)
        self.assertEqual(s.rest_host, "https://api-fxpractice.oanda.com")
        self.assertEqual(s.stream_host, "https://stream-fxpractice.oanda.com")
        self.assertEqual((s.risk_pct, s.daily_loss_pct, s.max_trades_per_day, s.max_dd_pct), (1.0, 5.0, 3, 20.0))
        self.assertEqual((s.max_open_trades, s.max_entry_drift), (1, 0.5))
        self.assertEqual(s.tg_channels, ("GOLD VIP", "THE WAR ZONE"))
        self.assertFalse(s.gate_override)
        self.assertFalse(s.dry_run)
        self.assertEqual(s.kill_switch_file, self.state / "KILL")
        self.assertEqual(s.tg_session, self.state / "executor_tg")

    def test_missing_broker_creds(self):
        with mock.patch.dict(os.environ, {"STATE_DIR": str(self.state)}, clear=True):
            with self.assertRaises(config.ConfigError):
                config.load()
            s = config.load(require_broker=False)   # --login only needs Telegram
            self.assertEqual(s.oanda_token, "")

    def test_bad_env_name(self):
        with env(STATE_DIR=str(self.state), OANDA_ENV="demo"):
            with self.assertRaises(config.ConfigError):
                config.load()

    def test_live_hosts(self):
        with env(STATE_DIR=str(self.state), OANDA_ENV="live"):
            s = config.load()
        self.assertTrue(s.is_live)
        self.assertEqual(s.rest_host, "https://api-fxtrade.oanda.com")

    def test_override_phrase_must_match_exactly(self):
        with env(STATE_DIR=str(self.state), GATE_OVERRIDE="yes please"):
            with self.assertRaises(config.ConfigError):
                config.load()
        with env(STATE_DIR=str(self.state), GATE_OVERRIDE=config.OVERRIDE_PHRASE):
            self.assertTrue(config.load().gate_override)

    def test_api_id_must_fit_32_bits(self):
        # the failure mode from the first login attempt: an api_id too large for int32
        with env(STATE_DIR=str(self.state), TG_API_ID="12345678901"):
            with self.assertRaises(config.ConfigError) as ctx:
                config.load()
        self.assertIn("32-bit", str(ctx.exception))

    def test_risk_bounds(self):
        with env(STATE_DIR=str(self.state), RISK_PCT="25"):
            with self.assertRaises(config.ConfigError):
                config.load()

    def test_env_file_seeds_but_does_not_override(self):
        (self.state / "executor.env").write_text('OANDA_ENV="live"\nRISK_PCT=2\n# comment\nBOGUS\n')
        with mock.patch.dict(os.environ, dict(BASE, STATE_DIR=str(self.state), RISK_PCT="0.5"), clear=True):
            s = config.load()
        self.assertEqual(s.oanda_env, "live")   # from file
        self.assertEqual(s.risk_pct, 0.5)       # env wins over file

    def test_redacted_hides_secrets(self):
        with env(STATE_DIR=str(self.state), SUPABASE_URL="https://x.supabase.co", SUPABASE_KEY="service-role-secret-key"):
            r = config.load().redacted()
        self.assertNotIn("abcdefghijkl", str(r))
        self.assertNotIn("service-role-secret-key", str(r))
        self.assertNotIn("0123456789abcdef0123456789abcdef", str(r))
        self.assertEqual(r["oanda_env"], "practice")


if __name__ == "__main__":
    unittest.main()
