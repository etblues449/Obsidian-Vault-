import unittest

from executor.parser import Signal, parse_signal, validate

# Verbatim from the GOLD TARDING HUBB channel, 2026-10-04 12:25 — an entry ZONE and
# four TPs. The follow-ups ("TP 1 HIT 40+ PIPS DONE", the account-management pitch)
# must parse as noise, never as new signals.
GTH_SIGNAL = "XAU/USD GOLD BUY  4177 / 4174\U0001f7eb\U0001f48e\n\nTP 4181\nTP 4184\nTP 4187\nTP 4195\n\nSL 4167"
GTH_FOLLOWUPS = [
    "XAU/USD  BUY \U0001f4ca\U0001f4ca\n\n\nTP 1 HIT 40+ PIPS DONE \U0001f4e2\U0001f4e2",
    "XAU/USD  BUY\n\nTP 2 HIT 70+ PIPS DONE",
    "TP 3 HIT 100+ PIPS DONE",
    "Hi guys\U0001f44b\nAre you in Big Loss? And big Running loss\nJoin For Account Management",
]


class ParseTests(unittest.TestCase):
    def test_gold_tarding_hubb_zone_and_multi_tp(self):
        s = parse_signal(GTH_SIGNAL)
        # A BUY zone 4174–4177 is filled at its WORSE edge (4177); tp is the first target.
        self.assertEqual((s.side, s.entry, s.sl, s.tp), (1, 4177.0, 4167.0, 4181.0))
        self.assertEqual(s.tps, (4181.0, 4184.0, 4187.0, 4195.0))
        self.assertEqual(s.entry_zone, (4174.0, 4177.0))
        self.assertIsNone(validate(s))
        self.assertAlmostEqual(s.rr, 4 / 10)  # +4 to TP1 against −10 to the stop

    def test_sell_zone_takes_the_lower_edge(self):
        s = parse_signal("XAU/USD SELL 4183/4180 SL 4190 TP 4170")
        self.assertEqual((s.side, s.entry, s.entry_zone), (-1, 4180.0, (4180.0, 4183.0)))

    def test_zone_never_crosses_lines_or_eats_sl_tp(self):
        s = parse_signal("BUY 4177\nSL 4167 / TP 4181")
        self.assertEqual((s.entry, s.entry_zone, s.sl, s.tp), (4177.0, None, 4167.0, 4181.0))

    def test_gold_tarding_hubb_followups_are_noise(self):
        for text in GTH_FOLLOWUPS:
            with self.subTest(text=text[:30]):
                self.assertIsNone(parse_signal(text))

    def test_single_tp_signals_keep_tps_consistent(self):
        s = parse_signal("SELL @ 4334 SL 4340 TP 4326")
        self.assertEqual(s.tps, (4326.0,))
        self.assertIsNone(s.entry_zone)
        self.assertEqual(parse_signal("BUY @ 4045 SL 4038").tps, ())

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
