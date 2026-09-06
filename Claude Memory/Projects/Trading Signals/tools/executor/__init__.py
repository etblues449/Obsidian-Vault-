"""Trade Guard executor — autonomous XAUUSD signal executor for OANDA v20.

Runs as one persistent Python process (systemd on a Raspberry Pi):

    Telegram channel ──Telethon──▶ parse ──▶ risk gate ──▶ OANDA market order
                                                 │            (SL/TP on fill,
                                                 ▼             broker-side)
                                        Supabase + local JSONL ◀── fills/closes
                                                 │                 (transaction
                                                 ▼                  stream)
                                          Telegram Bot alerts

Practice by default. Live requires either a passed funding gate or the exact
GATE_OVERRIDE phrase — and either path is written to the event log.
"""

__version__ = "0.1.0"
