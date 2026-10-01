"""Inbound signals: a read-only Telethon *user* session listening to the
configured channels (bots cannot read channels they do not admin — the
reason the logger has always used a user session).

The session file lives in the state dir, never in the vault; ``*.session``
is git-ignored repo-wide since the 2026-09-05 incident.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import timezone
from typing import Awaitable, Callable, List, Optional

log = logging.getLogger("executor.telegram")


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


async def login(settings) -> None:
    """Interactive first login (phone + code). Creates the session file."""
    client = _client(settings)
    await client.start()  # prompts
    me = await client.get_me()
    log.info("signed in as %s (%s)", getattr(me, "first_name", "?"), getattr(me, "username", "-"))
    print(f"Session created at {settings.tg_session}.session — run again without --login to start.")
    await client.disconnect()


async def list_dialogs(settings) -> None:
    client = _client(settings)
    await client.start()
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
    TelegramClient, events = _telethon()
    client = _client(settings)
    await client.start()
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
