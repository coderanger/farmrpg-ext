import json
import re
from pathlib import Path
from typing import Iterable, Optional

import attr
import attrs
from frozendict import frozendict

# From https://stackoverflow.com/questions/1175208/elegant-python-function-to-convert-camelcase-to-snake-case
CAMEL_ONE_RE = re.compile(r"(.)([A-Z][a-z]+)")
CAMEL_TWO_RE = re.compile(r"([a-z0-9])([A-Z])")


def camel_to_snake(name):
    name = CAMEL_ONE_RE.sub(r"\1_\2", name)
    return CAMEL_TWO_RE.sub(r"\1_\2", name).lower()


def load_fixture(name: str) -> list[dict]:
    # Load the data.
    fixture_path = Path(__file__) / ".." / ".." / "data" / f"{name}.json"
    return json.load(
        fixture_path.resolve().open(),
        object_hook=lambda d: {camel_to_snake(k): v for k, v in d.items()},
    )


@attr.s(auto_attribs=True, frozen=True)
class Item:
    name: str
    id: str
    image: str
    recipe: frozendict[str, int] = attr.ib(default=frozendict(), converter=frozendict)
    sell_price: Optional[int] = None
    buy_price: Optional[int] = None
    craft_price: Optional[int] = None
    givable: bool = False
    rarity: Optional[str] = None
    xp: int = 0
    flea_market: bool = False
    mastery: bool = False
    event: bool = False
    growth_time: Optional[int] = None
    first_seen: Optional[int] = None
    first_dropped: Optional[int] = None
    last_dropped: Optional[int] = None
    type: Optional[str] = None
    possible_drops: Optional[list[str]] = None


def load_items() -> Iterable[Item]:
    for item in load_fixture("items"):
        yield Item(**item)


@attrs.define(frozen=True)
class Location:
    id: str
    type: str
    name: str
    items: tuple[str]


def load_locations(type: Optional[str] = None) -> Iterable[Location]:
    for location in load_fixture("locations"):
        if type is not None and type != location["type"]:
            continue
        yield Location(**location)


if __name__ == "__main__":
    items = [
        {item_case_mappings.get(k, k): v for k, v in item.items()}
        for item in load_fixture("items")
    ]
    item_data_path = Path(__file__) / ".." / "simulator" / "data" / "items.json"
    json.dump(items, item_data_path.resolve().open("w"), indent=2, sort_keys=True)

    locations = load_fixture("locations")

    import droprates
    import fishrates
    import lemonade

    rates = droprates.rates_per_stam()
    lemonade_rates = lemonade.drop_rates()
    net_rates = fishrates.net_rates()
    for loc in locations:
        if loc["type"] == "explore":
            items = {it: rates.get(loc["name"], {}).get(it, 0) for it in loc["items"]}
            loc["explore_rates"] = items
            loc["lemonade_rates"] = lemonade_rates.get(loc["name"], {})
        elif loc["type"] == "fishing":
            loc["net_rates"] = net_rates.get(loc["name"], {})

    location_data_base = Path(__file__) / ".." / "simulator" / "data" / "locations.json"
    json.dump(
        locations, location_data_base.resolve().open("w"), indent=2, sort_keys=True
    )
