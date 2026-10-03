"""Inbound signals: a read-only Telethon *user* session listening to the
configured channels (bots cannot read channels they do not admin — the
reason the logger has always used a user session).

The session file lives in the state dir, never in the vault; ``*.session``
is git-ignored repo-wide since the 2026-09-05 incident.

2026-10-03: Telethon's default login prompt says "phone (or bot token)", and a
bot token typed there signs the session in *as the bot* — which then fails on
the very first channel read (``BotMethodInvalidError``). So the phone prompt is
ours, it refuses anything shaped like a bot token, and every entry point checks
that the saved session is a user before touching a dialog. ``--login`` discards
a bot session and signs in again.
"""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import timezone
from pathlib import Path
from typing import Awaitable, Callable, List, Optional, Tuple

log = logging.getLogger("executor.telegram")

_BOT_TOKEN_RE = re.compile(r"^\d{5,}:[\w-]{20,}$")
_PHONE_RE = re.compile(r"^\+\d{7,15}$")

PHONE_PROMPT = ("Your phone number, international format (e.g. +447700900123). "
                "NOT a bot token — bots cannot read channels: ")
BOT_TOKEN_REJECTION = ("That is a bot token. The executor must sign in as YOUR account "
                       "(bots cannot read channels). Type your phone number.")


def classify_login_input(raw: str) -> Tuple[str, Optional[str]]:
    """Sort what was typed at the phone prompt.

    Returns ``("phone", "+447…")`` for a usable number (spaces, dashes,
    brackets and a leading ``00`` normalised away), ``("bot_token", None)``
    for anything shaped like a Bot API token, or ``("invalid", reason)``.
    """
    s = re.sub(r"[\s().\-]", "", raw or "")
    if ":" in s or _BOT_TOKEN_RE.match(s):
        return "bot_token", None
    if s.startswith("00"):
        s = "+" + s[2:]
    if not s:
        return "invalid", "nothing entered"
    if not s.startswith("+"):
        return "invalid", "missing country code — start with +, e.g. +44…"
    if not _PHONE_RE.match(s):
        return "invalid", "not a phone number — digits only after the +, 7 to 15 of them"
    return "phone", s


def ask_phone(prompt: str = PHONE_PROMPT) -> str:
    """Interactive phone prompt for Telethon's ``start(phone=…)``. Loops until
    the input is a phone number; a bot token is named as such and refused."""
    while True:
        kind, value = classify_login_input(input(prompt))
        if kind == "phone":
            return value  # type: ignore[return-value]
        print(BOT_TOKEN_REJECTION if kind == "bot_token" else f"Rejected: {value}")


def session_problem(me) -> Optional[str]:
    """``None`` when ``me`` (Telethon's ``get_me()`` result) is a user; otherwise
    the reason this session cannot read channels."""
    if me is None:
        return "the saved session is not signed in"
    if getattr(me, "bot", False):
        handle = getattr(me, "username", None) or "?"
        return f"the saved session is a BOT login (@{handle}) — bots cannot read channels"
    return None


def session_files(session: Path) -> List[Path]:
    base = Path(session)
    return [base.with_name(base.name + ".session"), base.with_name(base.name + ".session-journal")]


def delete_session_files(session: Path) -> List[Path]:
    removed = []
    for p in session_files(session):
        if p.exists():
            p.unlink()
            removed.append(p)
    return removed


def _telethon():
    try:
        from telethon import TelegramClient, events  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise SystemExit("telethon is not installed. Run: python -m pip install -r requirements.txt") from exc
    return TelegramClient, events


def _client(settings):
    if not settings.tg_api_id or not settings.tg_api_hash:
        raise SystemExit("TG_API_ID and TG_API_HASH are required (my.telegram.org → API development tools)")
    TelegramClient, _ = _telethon()
    settings.tg_session.parent.mkdir(parents=True, exist_ok=True)
    return TelegramClient(str(settings.tg_session), settings.tg_api_id, settings.tg_api_hash)


async def _start_user_session(settings, *, fix_bot_session: bool):
    """Connect (prompting for phone + code + 2FA only when the session file is
    not already signed in) and return ``(client, me)`` for a *user* session.

    A bot session on disk is a dead end for this program. With
    ``fix_bot_session`` (``--login``) it is deleted and the login repeated
    with the phone prompt; otherwise the caller gets a ``SystemExit`` that
    says to run ``--login``.
    """
    client = _client(settings)
    await client.start(phone=ask_phone)
    me = await client.get_me()
    problem = session_problem(me)
    if problem is None:
        return client, me
    await client.disconnect()
    if not fix_bot_session:
        raise SystemExit(f"{problem}. Run --login again and enter your PHONE NUMBER.")
    removed = delete_session_files(settings.tg_session)
    log.warning("%s — discarded %s; signing in again", problem, ", ".join(str(p) for p in removed) or "nothing")
    print(f"{problem}. Discarded it — now sign in with your phone number.")
    client = _client(settings)
    await client.start(phone=ask_phone)
    me = await client.get_me()
    problem = session_problem(me)
    if problem is not None:
        await client.disconnect()
        raise SystemExit(f"{problem} — giving up. Delete {session_files(settings.tg_session)[0]} and run --login again.")
    return client, me


async def login(settings) -> None:
    """Interactive first login (phone + code + 2FA). Creates the session file;
    replaces it if what is on disk is a bot session."""
    client, me = await _start_user_session(settings, fix_bot_session=True)
    log.info("signed in as %s (%s)", getattr(me, "first_name", "?"), getattr(me, "username", "-"))
    print(f"Signed in as {getattr(me, 'first_name', '?')} (@{getattr(me, 'username', None) or '-'}). "
          f"Session: {session_files(settings.tg_session)[0]} — run again without --login to start.")
    await client.disconnect()


async def list_dialogs(settings) -> None:
    client, _ = await _start_user_session(settings, fix_bot_session=False)
    async for d in client.iter_dialogs():
        if d.is_channel or d.is_group:
            print(f"{d.id:>16}  {d.title}")
    await client.disconnect()


async def _resolve(client, wanted: List[str]) -> list:
    targets = []
    wanted_norm = [w.strip().lower() for w in wanted]
    async for d in client.iter_dialogs():
        title = (d.title or "").strip().lower()
        if str(d.id) in wanted or title in wanted_norm or any(w in title for w in wanted_norm if len(w) > 3):
            targets.append(d.entity)
            log.info("listening: %s (%s)", d.title, d.id)
    return targets


async def listen(settings, on_message: Callable[[dict], Awaitable[None]],
                 stop: Optional[asyncio.Event] = None) -> None:
    """Run until disconnected (or ``stop`` is set). Each new message in a
    target channel is passed to ``on_message`` as
    {"ts", "channel", "channel_id", "msg_id", "text"}."""
    _, events = _telethon()
    client, _ = await _start_user_session(settings, fix_bot_session=False)
    targets = await _resolve(client, list(settings.tg_channels))
    if not targets:
        raise SystemExit(f"none of the channels {list(settings.tg_channels)} were found — run --list to see names/ids")

    @client.on(events.NewMessage(chats=targets))
    async def handler(event):  # noqa: ANN001
        try:
            chat = await event.get_chat()
            title = getattr(chat, "title", None) or str(event.chat_id)
            ts = event.message.date.replace(tzinfo=timezone.utc).timestamp() if event.message.date else None
            await on_message({
                "ts": ts,
                "channel": title,
                "channel_id": event.chat_id,
                "msg_id": event.id,
                "text": event.raw_text or "",
            })
        except Exception:  # noqa: BLE001 — a bad message must not kill the listener
            log.exception("handler failed for message %s", getattr(event, "id", "?"))

    log.info("telegram listener up (%d channel(s))", len(targets))
    if stop is None:
        await client.run_until_disconnected()
    else:
        waiter = asyncio.ensure_future(stop.wait())
        runner = asyncio.ensure_future(client.run_until_disconnected())
        done, pending = await asyncio.wait({waiter, runner}, return_when=asyncio.FIRST_COMPLETED)
        for p in pending:
            p.cancel()
        await client.disconnect()
