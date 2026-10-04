#!/usr/bin/env python3
"""
signal_logger.py — read-only Telegram channel logger for Trade Guard.

Listens to the signal channel(s) you are already a member of and appends every
message to signals.jsonl, parsing XAUUSD signals (side / entry / SL / TP) where
it can. The JSONL file imports straight into the Trade Guard console
(trade-guard.html → Import).

DELIBERATELY does NOT place trades anywhere. Paper verification only.

Setup (Termux, ~5 min):
    pkg install python
    python -m pip install telethon
    # Get api_id + api_hash from https://my.telegram.org (API development tools)
    python signal_logger.py --login          # one-time: creates jarvis_tg.session next to this file
    python signal_logger.py                  # run the listener

Notes:
  - Uses YOUR account (MTProto user session), so it can read channels a bot
    cannot. Keep it read-only and low-volume; automation that messages people
    or scrapes aggressively can get an account limited. Listening to your own
    joined channels is the benign end of the spectrum.
  - At the login prompt enter your PHONE NUMBER (+44…), never a bot token: a
    bot token signs the session in as the bot, which cannot read channels
    (BotMethodInvalidError on the first dialog read — the 2026-10-03 mistake).
    The prompt refuses bot tokens and --login throws a bot session away.
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

# Session file lives next to this script, whatever the working directory.
SESSION = str(Path(__file__).with_name("jarvis_tg"))
OUT_FILE = Path(__file__).with_name("signals.jsonl")

# Channels to listen to — usernames, invite titles, or numeric IDs (matched as a
# case-insensitive substring of the dialog title, so a trailing badge/emoji is fine).
# Fill in after --list shows you the exact names/IDs of your dialogs.
# "GOLD TARDING HUBB" is the channel's own spelling (added 2026-10-04, same paper
# treatment as GOLD VIP — see Due Diligence — GOLD TARDING HUBB.md).
CHANNELS = ["GOLD VIP", "THE WAR ZONE", "GOLD TARDING HUBB"]

SIDE_RE = re.compile(r"\b(BUY|LONG|SELL|SHORT)\b", re.I)
SL_RE = re.compile(r"S\.?\s?L\.?\s*[:@=\s]\s*\$?(\d{3,5}(?:\.\d+)?)", re.I)
TP_RE = re.compile(r"T\.?\s?P\.?\s?\d?\s*[:@=\s]\s*\$?(\d{3,5}(?:\.\d+)?)", re.I)
ENTRY_RE = re.compile(r"(?:ENTRY|@|NOW\s*@?|PRICE)\s*[:=]?\s*\$?(\d{3,5}(?:\.\d+)?)", re.I)
# "BUY 4177 / 4174" — an entry ZONE on the same line as the side keyword (GOLD TARDING
# HUBB style). The paper fill is the WORSE edge for the side: highest for a buy, lowest
# for a sell, so the verification never flatters the channel.
ZONE_RE = re.compile(r"\b(?:BUY|LONG|SELL|SHORT)\b[^\n\d]{0,20}?(\d{3,5}(?:\.\d+)?)\s*[/\-–]\s*(\d{3,5}(?:\.\d+)?)", re.I)
NUM_RE = re.compile(r"\d{3,5}(?:\.\d+)?")

BOT_TOKEN_RE = re.compile(r"^\d{5,}:[\w-]{20,}$")
PHONE_RE = re.compile(r"^\+\d{7,15}$")
PHONE_PROMPT = ("Your phone number, international format (e.g. +447700900123). "
                "NOT a bot token — bots cannot read channels: ")
BOT_TOKEN_REJECTION = ("That is a bot token. The logger must sign in as YOUR account "
                       "(bots cannot read channels). Type your phone number.")


def _telethon():
    try:
        from telethon import TelegramClient, events
    except ImportError:
        sys.exit("telethon is not installed. Run: python -m pip install telethon")
    return TelegramClient, events


def parse_signal(text: str):
    """Best-effort parse of a gold signal. Returns dict or None."""
    if not text:
        return None
    m = SIDE_RE.search(text)
    side = None
    if m:
        side = 1 if m.group(1).upper() in ("BUY", "LONG") else -1

    sl = float(SL_RE.search(text).group(1)) if SL_RE.search(text) else None
    # Every TP the channel posted, in order; `tp` stays the first one (the one the
    # resolver and the console score — the most conservative target).
    tps = [float(x) for x in TP_RE.findall(text)]
    tp = tps[0] if tps else None

    entry = None
    entry_zone = None
    z = ZONE_RE.search(text)
    if z and side is not None:
        a, b = float(z.group(1)), float(z.group(2))
        entry_zone = (min(a, b), max(a, b))
        entry = max(a, b) if side == 1 else min(a, b)
    if entry is None:
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
    return {"side": side, "entry": entry, "sl": sl, "tp": tp,
            "tps": tps, "entry_zone": list(entry_zone) if entry_zone else None}


def append_record(record: dict):
    with OUT_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def get_credentials():
    api_id = os.environ.get("TG_API_ID") or input("api_id (from my.telegram.org): ").strip()
    api_hash = os.environ.get("TG_API_HASH") or input("api_hash: ").strip()
    return int(api_id), api_hash


def classify_login_input(raw: str):
    """("phone", "+447…") for a usable number (spaces, dashes, brackets and a
    leading 00 normalised away); ("bot_token", None) for anything shaped like a
    Bot API token; ("invalid", reason) otherwise."""
    s = re.sub(r"[\s().\-]", "", raw or "")
    if ":" in s or BOT_TOKEN_RE.match(s):
        return "bot_token", None
    if s.startswith("00"):
        s = "+" + s[2:]
    if not s:
        return "invalid", "nothing entered"
    if not s.startswith("+"):
        return "invalid", "missing country code — start with +, e.g. +44…"
    if not PHONE_RE.match(s):
        return "invalid", "not a phone number — digits only after the +, 7 to 15 of them"
    return "phone", s


def ask_phone(prompt: str = PHONE_PROMPT) -> str:
    """Phone prompt for Telethon's start(phone=…): loops until it gets a phone
    number; a bot token is named as such and refused."""
    while True:
        kind, value = classify_login_input(input(prompt))
        if kind == "phone":
            return value
        print(BOT_TOKEN_REJECTION if kind == "bot_token" else f"Rejected: {value}")


def session_problem(me):
    """None when `me` (Telethon get_me()) is a user; else why this session
    cannot read channels."""
    if me is None:
        return "the saved session is not signed in"
    if getattr(me, "bot", False):
        handle = getattr(me, "username", None) or "?"
        return f"the saved session is a BOT login (@{handle}) — bots cannot read channels"
    return None


def session_files():
    return [Path(SESSION + ".session"), Path(SESSION + ".session-journal")]


def delete_session_files():
    removed = []
    for p in session_files():
        if p.exists():
            p.unlink()
            removed.append(p)
    return removed


async def start_user_session(api_id, api_hash, *, fix_bot_session: bool):
    """Connect (prompting for phone + code + 2FA only when the session file is
    not already signed in) and return (client, me) for a USER session.

    A bot session on disk is a dead end. With fix_bot_session (--login) it is
    deleted and the login repeated with the phone prompt; otherwise exit with
    the instruction to run --login."""
    TelegramClient, _ = _telethon()
    client = TelegramClient(SESSION, api_id, api_hash)
    await client.start(phone=ask_phone)
    me = await client.get_me()
    problem = session_problem(me)
    if problem is None:
        return client, me
    await client.disconnect()
    if not fix_bot_session:
        sys.exit(f"{problem}. Run --login again and enter your PHONE NUMBER.")
    removed = delete_session_files()
    print(f"{problem}. Discarded {', '.join(str(p.name) for p in removed) or 'nothing'} — "
          "now sign in with your phone number.")
    client = TelegramClient(SESSION, api_id, api_hash)
    await client.start(phone=ask_phone)
    me = await client.get_me()
    problem = session_problem(me)
    if problem is not None:
        await client.disconnect()
        sys.exit(f"{problem} — giving up. Delete {session_files()[0]} and run --login again.")
    return client, me


async def main(args):
    api_id, api_hash = get_credentials()
    client, me = await start_user_session(api_id, api_hash, fix_bot_session=args.login)

    if args.login:
        print(f"Signed in as {getattr(me, 'first_name', '?')} (@{getattr(me, 'username', None) or '-'}). "
              f"Session: {session_files()[0].name} — run again without --login to start listening.")
        await client.disconnect()
        return

    if args.list:
        print("Your dialogs (use these names/IDs in CHANNELS):")
        async for d in client.iter_dialogs():
            if d.is_channel:
                print(f"  {d.id:>15}  {d.name}")
        await client.disconnect()
        return

    _, events = _telethon()

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
