"""Broker adapters. One today: OANDA v20. The executor only ever talks to
``OandaClient``'s small surface, so a second FCA broker with a retail API
(Capital.com is the documented fallback) is a new module here, not a rewrite.
"""
