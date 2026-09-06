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
