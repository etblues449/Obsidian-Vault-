#!/usr/bin/env python3
"""
signal_logger.py — read-only Telegram channel logger for Trade Guard.

Listens to the signal channel(s) you are already a member of and appends every
message to signals.jsonl, parsing XAUUSD signals (side / entry / SL / TP) where
it can. The JSONL file imports straight into the Trade Guard console
(trade-guard.html → Import).

DELIBERATELY does NOT place trades anywhere. Paper verification only.

Setup (Termux on the Fold 7, ~5 min):
    pkg install python
    pip install telethon
    # Get api_id + api_hash from https://my.telegram.org (API development tools)
    python signal_logger.py --login          # one-time: creates jarvis_tg.session
    python signal_logger.py                  # run the listener

Notes:
  - Uses YOUR account (MTProto user session), so it can read channels a bot
    cannot. Keep it read-only and low-volume; automation that messages people
    or scrapes aggressively can get an account limited. Listening to your own
    joined channels is the benign end of the spectrum.
  - Store api credentials in environment variables or type them at the prompt;
    never commit them to the vault (CLAUDE.md rule).
"""

import argparse
import asyncio
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from telethon import TelegramClient, events
except ImportError:
    sys.exit("telethon is not installed. Run: pip install telethon")

SESSION = "jarvis_tg"
OUT_FILE = Path(__file__).with_name("signals.jsonl")

# Channels to listen to — usernames, invite titles, or numeric IDs.
# Fill in after --list shows you the exact names/IDs of your dialogs.
CHANNELS = ["GOLD VIP", "THE WAR ZONE"]

SIDE_RE = re.compile(r"\b(BUY|LONG|SELL|SHORT)\b", re.I)
SL_RE = re.compile(r"S\.?\s?L\.?\s*[:@=\s]\s*\$?(\d{3,5}(?:\.\d+)?)", re.I)
TP_RE = re.compile(r"T\.?\s?P\.?\s?\d?\s*[:@=\s]\s*\$?(\d{3,5}(?:\.\d+)?)", re.I)
ENTRY_RE = re.compile(r"(?:ENTRY|@|NOW\s*@?|PRICE)\s*[:=]?\s*\$?(\d{3,5}(?:\.\d+)?)", re.I)
NUM_RE = re.compile(r"\d{3,5}(?:\.\d+)?")


def parse_signal(text: str):
    """Best-effort parse of a gold signal. Returns dict or None."""
    if not text:
        return None
    m = SIDE_RE.search(text)
    side = None
    if m:
        side = 1 if m.group(1).upper() in ("BUY", "LONG") else -1

    sl = float(SL_RE.search(text).group(1)) if SL_RE.search(text) else None
    tp_match = TP_RE.search(text)
    tp = float(tp_match.group(1)) if tp_match else None

    entry = None
    m = ENTRY_RE.search(text)
    if m:
        entry = float(m.group(1))
    else:
        nums = [float(n) for n in NUM_RE.findall(text)
                if 500 <= float(n) <= 20000 and float(n) not in (sl, tp)]
        if nums:
            entry = nums[0]

    if side is None and entry is not None and sl is not None:
        side = -1 if sl > entry else 1

    if entry is None or sl is None or side is None:
        return None
    return {"side": side, "entry": entry, "sl": sl, "tp": tp}


def append_record(record: dict):
    with OUT_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def get_credentials():
    api_id = os.environ.get("TG_API_ID") or input("api_id (from my.telegram.org): ").strip()
    api_hash = os.environ.get("TG_API_HASH") or input("api_hash: ").strip()
    return int(api_id), api_hash


async def main(args):
    api_id, api_hash = get_credentials()
    client = TelegramClient(SESSION, api_id, api_hash)
    await client.start()  # prompts for phone + code on first run

    if args.list:
        print("Your dialogs (use these names/IDs in CHANNELS):")
        async for d in client.iter_dialogs():
            if d.is_channel:
                print(f"  {d.id:>15}  {d.name}")
        await client.disconnect()
        return

    if args.login:
        print("Session created. Run again without --login to start listening.")
        await client.disconnect()
        return

    # Resolve channel entities by name substring or ID.
    targets = []
    async for d in client.iter_dialogs():
        if not d.is_channel:
            continue
        for want in CHANNELS:
            if str(d.id) == str(want) or want.lower() in (d.name or "").lower():
                targets.append(d.entity)
                print(f"listening: {d.name} ({d.id})")
    if not targets:
        sys.exit("No matching channels found. Run with --list and update CHANNELS.")

    @client.on(events.NewMessage(chats=targets))
    async def handler(event):
        text = event.raw_text or ""
        record = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "channel": getattr(event.chat, "title", str(event.chat_id)),
            "msg_id": event.id,
            "text": text,
            "parsed": parse_signal(text),
        }
        append_record(record)
        tag = "SIGNAL" if record["parsed"] else "noise "
        print(f"[{record['ts']}] {tag} {text[:80]!r}")

    print(f"Logging to {OUT_FILE} — Ctrl+C to stop.")
    await client.run_until_disconnected()


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Read-only Telegram signal logger (paper verification only)")
    p.add_argument("--login", action="store_true", help="create the session file and exit")
    p.add_argument("--list", action="store_true", help="list your channels and exit")
    asyncio.run(main(p.parse_args()))
