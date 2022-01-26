from typing import Iterable

import attrs

import parse_logs


@attrs.define
class Spin:
    type: str
    item: str
    quantity: int


def get_events() -> Iterable[Spin]:
    for row in parse_logs.parse_logs("spin"):
        if row["results"].get("item"):
            yield Spin(**row["results"])
        else:
            raise Exception(f"bad spin row: {row}")


if __name__ == "__main__":
    for spin in get_events():
        print(f"{spin.item}: {spin.quantity} ({spin.type})")
