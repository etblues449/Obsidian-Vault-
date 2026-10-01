import math
import unittest

from executor import risk
from executor.risk import ClosedTrade, Gate, GateParams, GuardParams


class SizingTests(unittest.TestCase):
    def test_floors_and_refuses_below_minimum(self):
        # $5 risk over a $6 stop = 0.83 oz → floor to whole units = 0 → refuse
        self.assertIsNone(risk.units_for(5.0, 4334, 4340, units_precision=0, min_units=1))
        # $10 risk over $6 = 1.66 → 1 unit
        self.assertEqual(risk.units_for(10.0, 4334, 4340, 0, 1), 1)
        # fractional precision keeps 0.8
        self.assertAlmostEqual(risk.units_for(5.0, 4334, 4340, 1, 0.1), 0.8)

    def test_never_rounds_up(self):
        self.assertEqual(risk.units_for(11.99, 4334, 4340, 0, 1), 1)

    def test_max_units_cap(self):
        self.assertEqual(risk.units_for(1_000_000, 4334, 4340, 0, 1, max_units=500), 500)

    def test_degenerate_inputs(self):
        self.assertIsNone(risk.units_for(10, 4334, 4334, 0, 1))
        self.assertIsNone(risk.units_for(0, 4334, 4340, 0, 1))

    def test_pnl(self):
        self.assertEqual(risk.pnl(4334, 4326, -1, 2), 16.0)
        self.assertEqual(risk.pnl(4334, 4340, -1, 2), -12.0)
        self.assertEqual(risk.pnl(4045, 4052, 1, 1), 7.0)


def _t(pnl, opened, closed):
    return ClosedTrade(pnl=pnl, opened_at=opened, closed_at=closed)


class StatsTests(unittest.TestCase):
    def test_known_numbers(self):
        day = 86400
        trades = [_t(10, 0, 1 * day), _t(-5, 1 * day, 2 * day), _t(0, 2 * day, 3 * day), _t(20, 3 * day, 30 * day)]
        st = risk.stats(trades, 100)
        self.assertEqual(st.n, 4)
        self.assertEqual(st.wins, 2)               # break-even is not a win
        self.assertAlmostEqual(st.win_rate, 50.0)
        self.assertAlmostEqual(st.ci, 49.0, places=0)   # 1.96*sqrt(.25/4)*100
        self.assertAlmostEqual(st.expectancy, 6.25)
        self.assertAlmostEqual(st.profit_factor, 6.0)   # 30 / 5
        self.assertEqual(st.equity, [100, 110, 105, 105, 125])
        self.assertAlmostEqual(st.max_dd, 5 / 110 * 100)
        self.assertAlmostEqual(st.net_pnl, 25)
        self.assertAlmostEqual(st.days, 30)

    def test_open_trades_count_for_days_but_not_stats(self):
        st = risk.stats([_t(5, 0, 86400), ClosedTrade(0, 10 * 86400, None)], 100)
        self.assertEqual(st.n, 1)
        self.assertAlmostEqual(st.days, 1)

    def test_profit_factor_edge_cases(self):
        self.assertEqual(risk.stats([_t(5, 0, 1)], 100).profit_factor, math.inf)
        self.assertIsNone(risk.stats([], 100).profit_factor)
        self.assertIsNone(risk.stats([], 100).win_rate)
        self.assertIsNone(risk.stats([], 100).max_dd)


class GateTests(unittest.TestCase):
    def _passing_stats(self):
        day = 86400
        trades = [_t(10 if i % 3 else -6, i * day, (i + 1) * day) for i in range(30)]
        return risk.stats(trades, 500)

    def test_all_six_pass(self):
        st = self._passing_stats()
        gates = risk.funding_gates(st, GateParams(), live_check=True, broker_check=True)
        self.assertEqual(len(gates), 6)
        self.assertTrue(risk.gates_passed(gates), [g for g in gates if not g.passed])
        ok, why = risk.can_trade_live(gates, override=False)
        self.assertTrue(ok)
        self.assertIn("passed", why)

    def test_manual_check_blocks(self):
        st = self._passing_stats()
        gates = risk.funding_gates(st, GateParams(), live_check=False, broker_check=True)
        ok, why = risk.can_trade_live(gates, override=False)
        self.assertFalse(ok)
        self.assertIn("BEFORE the move", why)

    def test_override_allows_but_says_so(self):
        gates = risk.funding_gates(risk.stats([], 500), GateParams(), False, True)
        ok, why = risk.can_trade_live(gates, override=True)
        self.assertTrue(ok)
        self.assertTrue(why.startswith("GATE OVERRIDE"))
        self.assertIn("30 closed trades", why)

    def test_no_override_no_trades_refused(self):
        gates = risk.funding_gates(risk.stats([], 500), GateParams(), False, True)
        ok, why = risk.can_trade_live(gates, override=False)
        self.assertFalse(ok)


class GuardTests(unittest.TestCase):
    def test_daily_trade_cap(self):
        self.assertIsNotNone(risk.daily_guard(3, 0.0, 500, GuardParams(max_trades_per_day=3)))
        self.assertIsNone(risk.daily_guard(2, 0.0, 500, GuardParams(max_trades_per_day=3)))

    def test_daily_loss_cap(self):
        # day started at 500; lost 25 = 5% → cap hit exactly
        self.assertIn("daily loss cap", risk.daily_guard(1, -25.0, 475, GuardParams(daily_loss_pct=5)))
        self.assertIsNone(risk.daily_guard(1, -24.0, 476, GuardParams(daily_loss_pct=5)))
        # gains never trip it
        self.assertIsNone(risk.daily_guard(1, +40.0, 540, GuardParams(daily_loss_pct=5)))

    def test_drawdown_breaker(self):
        self.assertIn("breaker", risk.drawdown_guard(400, 500, GuardParams(max_dd_pct=20)))
        self.assertIsNone(risk.drawdown_guard(401, 500, GuardParams(max_dd_pct=20)))
        self.assertIsNone(risk.drawdown_guard(400, 0, GuardParams(max_dd_pct=20)))

    def test_london_day(self):
        # 2026-07-15 23:30 UTC is 2026-07-16 00:30 BST → the London day has rolled over
        self.assertEqual(risk.london_day(1784158200.0), "2026-07-16")
        # 2026-01-15 23:30 UTC is still 2026-01-15 GMT
        self.assertEqual(risk.london_day(1768519800.0), "2026-01-15")


if __name__ == "__main__":
    unittest.main()
