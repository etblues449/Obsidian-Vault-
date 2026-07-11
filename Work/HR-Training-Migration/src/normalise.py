"""Normalise the three messy fields: staff name, course title, completion date.

Pure-stdlib fuzzy matching (difflib) so the pipeline runs anywhere. If rapidfuzz
is installed it is used automatically for better course matching.
"""
from __future__ import annotations

import re
from datetime import date, datetime

from dateutil import parser as dateparser

from catalogue import Catalogue, Course

try:  # optional, better fuzzy matching
    from rapidfuzz import fuzz, process

    _HAVE_RAPIDFUZZ = True
except ImportError:  # pragma: no cover - fallback path
    import difflib

    _HAVE_RAPIDFUZZ = False


# --------------------------------------------------------------------------- names
_NAME_NOISE = re.compile(r"[\t\r\n]+")


def normalise_name(raw: str | None) -> str:
    """Title-case, de-noise, and flip "SURNAME, First" -> "First Surname"."""
    if raw is None:
        return ""
    name = _NAME_NOISE.sub(" ", str(raw)).strip()
    name = re.sub(r"\s+", " ", name)
    if not name:
        return ""
    # "Smith, John" / "SMITH, JOHN A" -> "John A Smith"
    if "," in name:
        surname, _, rest = name.partition(",")
        name = f"{rest.strip()} {surname.strip()}".strip()
    # Title-case but preserve common particles and initials sensibly
    parts = []
    for token in name.split(" "):
        if not token:
            continue
        if token.isupper() and len(token) <= 3 and token.isalpha():
            parts.append(token)  # keep short all-caps as initials (e.g. "JA")
        else:
            parts.append(_cap_token(token))
    return " ".join(parts)


def _cap_token(token: str) -> str:
    """Capitalise a name token, respecting apostrophes, hyphens and Mc/Mac.

    e.g. o'brien -> O'Brien, anne-marie -> Anne-Marie, mcdonald -> McDonald.
    """
    def cap_part(part: str) -> str:
        if not part:
            return part
        low = part.lower()
        if low.startswith("mc") and len(part) > 2:
            return "Mc" + part[2:].capitalize()
        if low.startswith("mac") and len(part) > 3:
            return "Mac" + part[3:].capitalize()
        return part.capitalize()

    for sep in ("'", "’", "-"):
        if sep in token:
            return sep.join(cap_part(p) for p in token.split(sep))
    return cap_part(token)


# ------------------------------------------------------------------------- courses
def normalise_course(raw: str | None, cat: Catalogue) -> tuple[str | None, int, str]:
    """Return (canonical_name_or_None, confidence_0_100, raw_cleaned).

    Tries an exact alias match first, then fuzzy. Below cat.fuzzy_threshold the
    canonical is None so the row is routed to manual review.
    """
    if raw is None:
        return None, 0, ""
    cleaned = re.sub(r"\s+", " ", str(raw)).strip()
    if not cleaned:
        return None, 0, ""

    exact = cat.exact_match(cleaned)
    if exact:
        return exact.canonical, 100, cleaned

    # Build candidate alias list mapping back to courses
    aliases = list(cat.alias_to_course.keys())
    target = cleaned.lower()

    if _HAVE_RAPIDFUZZ:
        match = process.extractOne(target, aliases, scorer=fuzz.token_sort_ratio)
        if match:
            alias, score, _ = match
            course = cat.alias_to_course[alias]
            if score >= cat.fuzzy_threshold:
                return course.canonical, int(score), cleaned
            return None, int(score), cleaned
        return None, 0, cleaned
    else:  # difflib fallback
        best_alias, best_score = None, 0.0
        for alias in aliases:
            ratio = difflib.SequenceMatcher(None, target, alias).ratio() * 100
            if ratio > best_score:
                best_alias, best_score = alias, ratio
        if best_alias and best_score >= cat.fuzzy_threshold:
            return cat.alias_to_course[best_alias].canonical, int(best_score), cleaned
        return None, int(best_score), cleaned


def course_for(canonical: str, cat: Catalogue) -> Course | None:
    return cat.exact_match(canonical)


# --------------------------------------------------------------------------- dates
_EXCEL_EPOCH = datetime(1899, 12, 30)  # Excel's day 0 (accounts for 1900 leap bug)


def parse_completion_date(raw) -> tuple[date | None, str]:
    """Parse a messy date into a date object. Returns (date_or_None, note).

    Handles UK day-first formats, 2-digit years, month names, and raw Excel
    serial numbers that arrive as ints/floats from .xlsx cells.
    """
    if raw is None or (isinstance(raw, float) and raw != raw):  # NaN
        return None, "empty"
    # Already a datetime/date (common when pandas parsed the column)
    if isinstance(raw, datetime):
        return raw.date(), ""
    if isinstance(raw, date):
        return raw, ""
    # Excel serial number
    if isinstance(raw, (int, float)):
        try:
            return (_EXCEL_EPOCH + _delta_days(float(raw))).date(), "excel-serial"
        except (OverflowError, ValueError):
            return None, "bad-serial"

    text = str(raw).strip()
    if not text:
        return None, "empty"
    # Pure number stored as text -> Excel serial
    if re.fullmatch(r"\d{4,6}", text):
        try:
            return (_EXCEL_EPOCH + _delta_days(float(text))).date(), "excel-serial"
        except (OverflowError, ValueError):
            pass
    try:
        dt = dateparser.parse(text, dayfirst=True, fuzzy=True)
        return dt.date(), ""
    except (ValueError, OverflowError, TypeError):
        return None, "unparseable"


def _delta_days(n: float):
    from datetime import timedelta

    return timedelta(days=n)
