import collections
import datetime
import json
import re
from typing import Iterable

import attrs
import dateutil.parser
import typer


@attrs.define(frozen=True)
class KabobPrice:
    ts: datetime.datetime
    price: int

    @property
    def is_high_range(self) -> bool:
        return self.price > 10_500


def get_kabob_prices() -> Iterable[KabobPrice]:
    with open("steak_prices.json") as f:
        data = json.load(f)
    for msg in data["messages"]:
        if msg["author"]["name"] != "SteakBob":
            # Non-bot posts are too hard to parse.
            continue
        md = re.match(r"^Bob price: ([0-9,]+)$", msg["content"], re.I)
        if not md:
            # print(f"Can't parse {msg['content']=}")
            continue
        ts = dateutil.parser.isoparse(msg["timestamp"])
        # Round down the low bits.
        ts = ts.replace(minute=0, second=0, microsecond=0)
        yield KabobPrice(
            price=int(md.group(1).replace(",", "")),
            ts=ts,
        )


@attrs.define(frozen=True)
class KabobSlidingWindow:
    ts: datetime.datetime
    prices: tuple[KabobPrice]

    @property
    def high_range_ratio(self) -> float:
        """Ratio of high-range to normal-range prices in this sample."""
        return sum(1 if price.is_high_range else 0 for price in self.prices) / len(
            self.prices
        )


def kabob_sliding_window(window: int) -> Iterable[KabobSlidingWindow]:
    buffer = collections.deque()
    for price in get_kabob_prices():
        buffer.append(price)
        if len(buffer) > window:
            buffer.popleft()
        if len(buffer) < window:
            continue
        yield KabobSlidingWindow(ts=price.ts, prices=tuple(buffer))


def steak_prices_cmd(window: int = 48) -> None:
    for slide in kabob_sliding_window(window):
        # print(f"{slide.ts}: {slide.high_range_ratio * 100:.2f}")
        print(f"{slide.ts}\t{slide.high_range_ratio}")


if __name__ == "__main__":
    typer.run(steak_prices_cmd)
