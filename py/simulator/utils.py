import re
from typing import Union

NUMBER_SUFFIXES = ["", "k", "M", "B"]


def format_number(n: Union[int, float], precision: int = 2) -> str:
    it = iter(NUMBER_SUFFIXES)
    suffix = next(it)
    while n > 1500:
        n /= 1000
        suffix = next(it)
    return f"%.{precision}f{suffix}" % n


def parse_time(val: str, tick_length: int) -> int:
    md = re.search(r"([0-9.]+)d", val, re.IGNORECASE)
    days = float(md[1]) if md else 0
    md = re.search(r"([0-9.]+)h", val, re.IGNORECASE)
    hours = float(md[1]) if md else 0
    total_hours = (days * 24) + hours
    total_seconds = total_hours * 60 * 60
    return round(total_seconds / tick_length)
