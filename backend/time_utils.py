from datetime import datetime, timezone, timedelta
from typing import Optional

# Indian Standard Time (IST) offset is UTC+05:30
IST = timezone(timedelta(hours=5, minutes=30), name="IST")

def now_ist() -> datetime:
    """Returns the current timezone-aware datetime in IST."""
    return datetime.now(IST)

def now_utc() -> datetime:
    """Returns current naive UTC datetime for database column consistency."""
    return datetime.utcnow()

def to_ist(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Converts any datetime (naive UTC from database or timezone-aware) to IST.
    If the datetime is naive, it assumes it represents UTC.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST)

def format_ist(dt: Optional[datetime], fmt: str = "%Y-%m-%d %H:%M") -> str:
    """
    Formats a datetime object to an IST string.
    Returns 'Recent' if dt is None.
    """
    if dt is None:
        return "Recent"
    ist_dt = to_ist(dt)
    return ist_dt.strftime(fmt)

def format_ist_iso(dt: Optional[datetime]) -> str:
    """
    Returns an ISO 8601 string in IST with offset (+05:30).
    """
    if dt is None:
        dt = datetime.utcnow()
    ist_dt = to_ist(dt)
    return ist_dt.isoformat()
