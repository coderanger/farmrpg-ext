import itertools
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
    import droprates

    normal_drops = droprates.compile_drops(
        explore=True,
        lemonade=True,
        net=True,
        harvest=True,
        lemonade_fake_explores=True,
        nets_fake_fishes=True,
    )

    iron_depot_drops = droprates.compile_drops(
        explore=True,
        lemonade=True,
        lemonade_fake_explores=True,
        iron_depot=True,
    )

    manual_fish_drops = droprates.compile_drops(fish=True)

    location_keys = set(
        itertools.chain(
            normal_drops.locations.keys(),
            iron_depot_drops.locations.keys(),
            manual_fish_drops.locations.keys(),
        )
    )

    def location_drops_to_rates(
        loc_drops: Optional[droprates.LocationDrops],
    ) -> dict[str, float]:
        if loc_drops is None:
            return {}
        return {
            item: droprates.mode_for_drops(item_drops)[1] / item_drops.drops
            for item, item_drops in loc_drops.items.items()
        }

    drop_rates = []
    for location in location_keys:
        drop_rates.append(
            {
                "location": location,
                "drop_rates": location_drops_to_rates(
                    normal_drops.locations.get(location)
                ),
                "iron_depot_rates": location_drops_to_rates(
                    iron_depot_drops.locations.get(location)
                ),
                "manual_fish_rates": location_drops_to_rates(
                    manual_fish_drops.locations.get(location)
                ),
            }
        )

    drop_rates_path = Path(__file__) / ".." / ".." / "data" / "drop_rates.json"
    json.dump(drop_rates, drop_rates_path.resolve().open("w"), indent=2, sort_keys=True)
