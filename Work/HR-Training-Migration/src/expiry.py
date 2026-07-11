"""Expiry-date calculation and status flagging."""
from __future__ import annotations

from datetime import date

from dateutil.relativedelta import relativedelta

# Status values written to the master sheet
VALID = "Valid"
EXPIRING_SOON = "Expiring Soon"
OVERDUE = "Overdue"
UNKNOWN = "Unknown"


def compute_expiry(completion: date | None, interval_months: int) -> date | None:
    """Expiry = completion date + refresher interval."""
    if completion is None:
        return None
    return completion + relativedelta(months=interval_months)


def status_for(expiry: date | None, today: date, soon_days: int) -> str:
    """Classify a record relative to `today`."""
    if expiry is None:
        return UNKNOWN
    if expiry < today:
        return OVERDUE
    if (expiry - today).days <= soon_days:
        return EXPIRING_SOON
    return VALID


def days_until_expiry(expiry: date | None, today: date) -> int | None:
    if expiry is None:
        return None
    return (expiry - today).days
