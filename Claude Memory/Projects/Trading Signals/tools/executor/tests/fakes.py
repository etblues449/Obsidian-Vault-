"""Test doubles for urllib-based clients."""
from __future__ import annotations

import io
import json
import urllib.error
from typing import Callable, List, Optional


class FakeResponse:
    def __init__(self, body: object = None, status: int = 200, lines: Optional[List[bytes]] = None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode("utf-8")
        elif isinstance(body, str):
            body = body.encode("utf-8")
        self._body = body or b""
        self.status = status
        self._lines = lines or []

    def read(self) -> bytes:
        return self._body

    def __iter__(self):
        return iter(self._lines)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def http_error(url: str, code: int, payload: object) -> urllib.error.HTTPError:
    body = json.dumps(payload).encode("utf-8")
    return urllib.error.HTTPError(url, code, "error", None, io.BytesIO(body))


class Opener:
    """Callable that records every Request and answers via a handler(req) -> FakeResponse
    (or raises). ``calls`` lets tests assert on method/url/headers/body."""

    def __init__(self, handler: Callable):
        self.handler = handler
        self.calls = []

    def __call__(self, req, timeout):
        self.calls.append(req)
        return self.handler(req)

    @property
    def last(self):
        return self.calls[-1]

    def last_json(self) -> dict:
        data = self.last.data
        return json.loads(data.decode("utf-8")) if data else {}


# --- Telethon stand-ins (login path only) ---------------------------------

class FakeTgUser:
    def __init__(self, bot: bool = False, username: str = "elliot_h", first_name: str = "Elliot"):
        self.bot = bot
        self.username = username
        self.first_name = first_name

    def to_json(self) -> str:
        return json.dumps({"bot": self.bot, "username": self.username, "first_name": self.first_name})


class FakeTelegramClient:
    """The slice of ``telethon.TelegramClient`` the login path touches.

    The session "file" is real — ``<session>.session`` holds JSON saying who
    is signed in — so ``delete_session_files()`` has something to delete and a
    second client constructed on the same path sees the same login, exactly
    like Telethon's SQLite session. ``login_as`` is who the next *interactive*
    login signs in as; tests set it to a bot to reproduce the 2026-10-03 case.
    """

    login_as: FakeTgUser = FakeTgUser()
    phones: List[str] = []
    instances: List["FakeTelegramClient"] = []

    @classmethod
    def reset(cls, login_as: Optional[FakeTgUser] = None) -> None:
        cls.login_as = login_as or FakeTgUser()
        cls.phones = []
        cls.instances = []

    def __init__(self, session, api_id, api_hash):
        from pathlib import Path
        self.path = Path(str(session) + ".session")
        self.api_id, self.api_hash = api_id, api_hash
        self.me: Optional[FakeTgUser] = None
        if self.path.exists():
            self.me = FakeTgUser(**json.loads(self.path.read_text()))
        self.disconnected = False
        self.prompted = False
        type(self).instances.append(self)

    async def start(self, phone=None, **_):
        if self.me is None:  # not authorised → Telethon would prompt here
            self.prompted = True
            number = phone() if callable(phone) else phone
            type(self).phones.append(number)
            self.me = type(self).login_as
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(self.me.to_json())
        return self

    async def get_me(self):
        return self.me

    async def disconnect(self):
        self.disconnected = True
