import json
import tempfile
import unittest
from pathlib import Path

from executor.store import LocalStore, Store, SupabaseStore
from executor.tests.fakes import FakeResponse, Opener, http_error


class LocalStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.local = LocalStore(Path(self.tmp.name))

    def tearDown(self):
        self.tmp.cleanup()

    def test_signals_and_events_append(self):
        self.local.record_signal({"id": "a", "text": "x"})
        self.local.record_signal({"id": "b", "text": "y"})
        lines = self.local.signals.read_text().splitlines()
        self.assertEqual([json.loads(l)["id"] for l in lines], ["a", "b"])

    def test_trades_roundtrip_and_update(self):
        self.local.save_trade({"id": "101", "status": "open", "realized_pl": 0})
        self.assertEqual(self.local.trades()["101"]["status"], "open")
        t = self.local.update_trade("101", {"status": "closed", "realized_pl": 7.5})
        self.assertEqual(t["realized_pl"], 7.5)
        self.assertIsNone(self.local.update_trade("nope", {}))

    def test_state_and_corrupt_recovery(self):
        self.local.set_state(peak_nav=510.0)
        self.assertEqual(self.local.state()["peak_nav"], 510.0)
        self.local.state_file.write_text("{not json")
        self.assertEqual(self.local.state(), {})
        self.assertTrue(self.local.state_file.with_suffix(".json.corrupt").exists())


class CompositeStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.local = LocalStore(Path(self.tmp.name))

    def tearDown(self):
        self.tmp.cleanup()

    def test_today_and_closed_trades_scoped_to_env(self):
        s = Store(self.local, None, env="practice")
        # 2026-07-16 09:00 BST = 08:00 UTC
        t_open = 1784275200.0
        s.save_trade({"id": "1", "signal_id": "c:1", "open_time": t_open, "close_time": t_open + 3600, "realized_pl": -4.0, "status": "closed"})
        s.save_trade({"id": "2", "signal_id": "c:2", "open_time": t_open + 7200, "close_time": None, "realized_pl": 0, "status": "open"})
        self.local.save_trade({"id": "3", "env": "live", "open_time": t_open, "close_time": t_open + 10, "realized_pl": 99, "status": "closed"})
        n, realized = s.today(now=t_open + 8000)
        self.assertEqual(n, 2)
        self.assertEqual(realized, -4.0)
        self.assertEqual(len(s.closed_trades()), 2)   # env-scoped; open one has closed_at None
        self.assertEqual(len(s.open_trades()), 1)
        self.assertTrue(s.has_signal_trade("c:1"))
        self.assertFalse(s.has_signal_trade("c:9"))

    def test_remote_failure_never_raises(self):
        remote = SupabaseStore("https://x.supabase.co", "key", opener=Opener(lambda req: (_ for _ in ()).throw(http_error(req.full_url, 500, {"message": "boom"}))))
        s = Store(self.local, remote, env="practice")
        s.record_event("startup", a=1)          # must not raise
        s.save_trade({"id": "1", "status": "open"})
        self.assertEqual(s.settings(), {})       # falls back to cached (empty)
        self.assertIn("1", self.local.trades())  # local write still happened

    def test_settings_prefers_remote_and_caches(self):
        remote = SupabaseStore("https://x.supabase.co", "key",
                               opener=Opener(lambda req: FakeResponse([{"id": 1, "kill_switch": True, "live_check": False}])))
        s = Store(self.local, remote, env="practice")
        self.assertTrue(s.settings()["kill_switch"])
        self.assertTrue(self.local.state()["settings"]["kill_switch"])


class SupabaseRequestShapeTests(unittest.TestCase):
    def test_upsert_insert_update_select(self):
        op = Opener(lambda req: FakeResponse([{"id": 1}]))
        r = SupabaseStore("https://x.supabase.co/", "svc-key", opener=op)
        r.upsert("trades", {"id": "1", "status": "open"})
        req = op.last
        self.assertEqual(req.full_url, "https://x.supabase.co/rest/v1/trades?on_conflict=id")
        self.assertEqual(req.get_method(), "POST")
        self.assertEqual(req.get_header("Apikey"), "svc-key")
        self.assertEqual(req.get_header("Authorization"), "Bearer svc-key")
        self.assertIn("merge-duplicates", req.get_header("Prefer"))
        r.insert("events", {"kind": "x"})
        self.assertEqual(op.last.full_url, "https://x.supabase.co/rest/v1/events")
        r.update("trades", {"id": "1"}, {"status": "closed"})
        self.assertEqual(op.last.get_method(), "PATCH")
        self.assertEqual(op.last.full_url, "https://x.supabase.co/rest/v1/trades?id=eq.1")
        self.assertEqual(op.last_json(), {"status": "closed"})
        self.assertEqual(r.get_settings(), {"id": 1})
        self.assertIn("id=eq.1", op.last.full_url)


if __name__ == "__main__":
    unittest.main()
