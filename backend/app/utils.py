"""Utility functions: meeting code generator and invite link normalizer."""

import re
import random
from sqlalchemy.orm import Session
from app import models


def generate_meeting_code(db: Session) -> str:
    """Generate a unique 10-digit numeric code (first digit 1-9) for a meeting."""
    while True:
        # First digit 1-9 so the code never starts with 0
        first = random.randint(1, 9)
        rest = random.randint(0, 10**9 - 1)
        code = f"{first}{rest:09d}"
        exists = db.query(models.Meeting).filter_by(meeting_code=code).first()
        if not exists:
            return code


def normalize_code(raw: str) -> str:
    """
    Accept '123 456 7890', '123-456-7890', or a full invite URL like
    'https://host/j/1234567890' and return the 10 raw digits.
    """
    # Try to extract digits from a /j/<code> path first
    url_match = re.search(r"/j/(\d{10})", raw)
    if url_match:
        return url_match.group(1)
    # Otherwise strip every non-digit
    digits = re.sub(r"\D", "", raw)
    return digits
