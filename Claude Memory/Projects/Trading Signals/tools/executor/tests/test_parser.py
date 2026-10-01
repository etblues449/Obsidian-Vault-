import unittest

from executor.parser import Signal, parse_signal, validate


class ParseTests(unittest.TestCase):
    def test_canonical_sell(self):
        s = parse_signal("SELL @ 4334 SL 4340 TP 4326")
        self.assertEqual((s.side, s.entry, s.sl, s.tp), (-1, 4334.0, 4340.0, 4326.0))
        self.assertEqual(s.side_label, "SELL")
        self.assertAlmostEqual(s.stop_distance, 6.0)
        self.assertAlmostEqual(s.rr, 8 / 6)

    def test_buy_with_numbered_tps_takes_first(self):
        s = parse_signal("BUY GOLD NOW @ 4045.5\nSL 4038\nTP1 4052\nTP2 4060")
        self.assertEqual((s.side, s.entry, s.sl, s.tp), (1, 4045.5, 4038.0, 4052.0))

    def test_entry_fallback_when_no_at(self):
        s = parse_signal("XAUUSD SELL 4334 SL:4340 TP:4326")
        self.assertEqual((s.side, s.entry, s.sl, s.tp), (-1, 4334.0, 4340.0, 4326.0))

    def test_entry_keyword_and_decimal(self):
        s = parse_signal("Gold sell entry 4334.00 sl 4340 tp 4326")
        self.assertEqual((s.side, s.entry, s.sl, s.tp), (-1, 4334.0, 4340.0, 4326.0))

    def test_side_inferred_from_stop_placement(self):
        s = parse_signal("4334 SL 4340 TP 4326")
        self.assertEqual(s.side, -1)
        s = parse_signal("4334 SL 4328 TP 4342")
        self.assertEqual(s.side, 1)

    def test_no_tp_is_allowed(self):
        s = parse_signal("BUY @ 4045 SL 4038")
        self.assertEqual(s.tp, None)
        self.assertIsNone(s.rr)

    def test_noise_is_none(self):
        self.assertIsNone(parse_signal(""))
        self.assertIsNone(parse_signal("Good morning traders! Big moves coming 🚀"))
        self.assertIsNone(parse_signal("short at 4334 stop 4340 target 4326"))  # no SL keyword

    def test_missing_sl_is_none(self):
        self.assertIsNone(parse_signal("BUY @ 4045 TP 4052"))


class ValidateTests(unittest.TestCase):
    def test_good_signal_passes(self):
        self.assertIsNone(validate(Signal(-1, 4334, 4340, 4326)))
        self.assertIsNone(validate(Signal(1, 4045, 4038, None)))

    def test_stop_wrong_side(self):
        self.assertIn("stop-loss", validate(Signal(1, 4045, 4050, 4060)))
        self.assertIn("stop-loss", validate(Signal(-1, 4334, 4330, 4320)))

    def test_tp_wrong_side(self):
        self.assertIn("take-profit", validate(Signal(1, 4045, 4038, 4040)))
        self.assertIn("take-profit", validate(Signal(-1, 4334, 4340, 4340)))

    def test_absurd_stop_distance(self):
        self.assertIn("exceeds", validate(Signal(1, 4045, 3000, None)))

    def test_entry_out_of_range(self):
        self.assertIn("outside", validate(Signal(1, 42, 40, None)))


if __name__ == "__main__":
    unittest.main()
