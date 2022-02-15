import functools
import io
import json
import os
import re
import time
from collections import defaultdict
from typing import Any, Optional, Union

import attrs
import cattrs
import typer

import fixtures
import parse_logs

BASE_DROP_RATES = {
    "Black Rock Canyon": 1 / 3,
    "Cane Pole Ridge": 2 / 7,
    "Ember Lagoon": 1 / 3,
    "Forest": 1 / 3,
    "Highland Hills": 1 / 4,
    "Misty Forest": 1 / 3,
    "Mount Banon": 1 / 3,
    "Small Cave": 2 / 5,
    "Small Spring": 1 / 3,
    "Whispering Creek": 4 / 15,
}

CACHE_PATH_BASE = f"{os.path.dirname(__file__)}/.drops.{'{}'}.json"


def cache_path_for(**kwargs) -> str:
    buf = io.StringIO()
    for key, value in sorted(kwargs.items()):
        if value is True:
            buf.write(key)
        elif value is False:
            pass  # Do nothing
        elif isinstance(value, int):
            buf.write(str(value))
    return CACHE_PATH_BASE.format(buf.getvalue())


def when_dropped(item: fixtures.Item) -> range:
    first_dropped = item.first_dropped or item.first_seen or 0
    last_dropped = item.last_dropped or round((time.time() + 10000000) * 1000)
    return range(first_dropped, last_dropped + 1)


@attrs.define
class ItemDrops:
    explores: int = 0
    lemonades: int = 0
    ciders: int = 0
    fishes: int = 0
    nets: int = 0
    drops: int = 0


@attrs.define
class LocationDrops:
    explores: int = 0
    lemonades: int = 0
    ciders: int = 0
    fishes: int = 0
    nets: int = 0
    drops: int = 0
    items: dict[str, ItemDrops] = attrs.Factory(lambda: defaultdict(ItemDrops))


@attrs.define
class Drops:
    explores: int = 0
    lemonades: int = 0
    ciders: int = 0
    fishes: int = 0
    nets: int = 0
    drops: int = 0
    locations: dict[str, LocationDrops] = attrs.Factory(
        lambda: defaultdict(LocationDrops)
    )


def count_sources(
    drops: Union[Drops, LocationDrops, ItemDrops],
    row: dict[str, Any],
    lemonade_fake_explores_location: Optional[str] = None,
    nets_fake_fishes: bool = False,
) -> None:
    if row["type"] == "explore":
        drops.explores += row["results"]["stamina"]
    elif row["type"] == "lemonade":
        drops.lemonades += 1
        if lemonade_fake_explores_location is not None:
            drops.explores += round(
                (1 / BASE_DROP_RATES[lemonade_fake_explores_location])
                * sum(it.get("quantity", 1) for it in row["results"]["items"])
            )
    elif row["type"] == "cider":
        drops.ciders += 1
        # This is kind of wrong for global and location stats since not all explores count
        # for all items but it's more correct than not.
        drops.explores += row["results"].get("explores", row["results"]["stamina"])
    elif row["type"] == "fish":
        drops.fishes += 1
    elif row["type"] == "net":
        drops.nets += 1
        if nets_fake_fishes:
            drops.fishes += sum(it.get("quantity", 1) for it in row["results"]["items"])


def compile_drops(
    explore: bool = False,
    lemonade: bool = False,
    cider: bool = False,
    fish: bool = False,
    net: bool = False,
    since: int = 0,
    lemonade_fake_explores: bool = False,
    nets_fake_fishes: bool = False,
) -> Drops:
    cache_path = cache_path_for(
        e=explore,
        l=lemonade,
        c=cider,
        f=fish,
        n=net,
        s=since,
        x=lemonade_fake_explores,
        y=nets_fake_fishes,
    )

    # Check if the cache file exists and is newer than all log files.
    if (
        os.path.exists(cache_path)
        and os.stat(cache_path).st_mtime >= parse_logs.log_mtime()
    ):
        with open(cache_path) as cachef:
            return cattrs.structure(json.load(cachef), Drops)

    when_items_dropped = {
        item.name: when_dropped(item) for item in fixtures.load_items()
    }
    # loc_items = {loc.name: loc.items for loc in fixtures.load_locations()}
    types: set[str] = set()
    if explore:
        types.add("explore")
    if lemonade:
        types.add("lemonade")
    if cider:
        types.add("cider")
    if fish:
        types.add("fish")
    if net:
        types.add("net")
    explores = Drops()
    logs = [row for row in parse_logs.parse_logs(since=since) if row["type"] in types]
    # First run through to count drops and work out which items are in each locations.
    for row in logs:
        location_name = row["results"].get("location")
        if not location_name:
            continue
        overflow_items: set[str] = {
            item["item"] for item in row["results"]["items"] if item["overflow"]
        }
        for item in row["results"]["items"]:
            if row["ts"] not in when_items_dropped[item["item"]]:
                # Ignore out-of-bounds drops. This allows accounting for stuff like drop
                # rates changing substantially by manually resetting firstDropped.
                continue
            if row["type"] == "cider" and item["item"] in overflow_items:
                # Cider overflow always reports 0 drops so any item that overflows during
                # a cider has to be ignored.
                continue
            explores.locations[location_name].items[item["item"]].drops += item.get(
                "quantity", 1
            )
            explores.locations[location_name].drops += item.get("quantity", 1)
            explores.drops += item.get("quantity", 1)
    # Second pass to get the explore counts.
    for row in logs:
        location_name = row["results"].get("location")
        if not location_name:
            continue
        overflow_items: set[str] = {
            item["item"] for item in row["results"]["items"] if item["overflow"]
        }
        count_sources_for_loc = functools.partial(
            count_sources,
            row=row,
            lemonade_fake_explores_location=location_name
            if lemonade_fake_explores
            else None,
            nets_fake_fishes=nets_fake_fishes,
        )
        for item, item_explores in explores.locations[location_name].items.items():
            if row["ts"] not in when_items_dropped[item]:
                # Item couldn't drop, this doesn't count.
                continue
            if row["type"] == "cider" and item in overflow_items:
                # Cider overflow always reports 0 drops so any item that overflows during
                # a cider has to be ignored.
                continue
            count_sources_for_loc(item_explores)
        count_sources_for_loc(explores.locations[location_name])
        count_sources_for_loc(explores)

    # Write the cache.
    with open(cache_path, "w") as cachef:
        json.dump(cattrs.unstructure(explores), cachef)

    return explores


def total_drops() -> dict[str, dict[str, int]]:
    totals = {}
    for row in parse_logs.parse_logs("explore"):
        location_name = row["results"].get("location")
        if not location_name:
            continue
        loc_data = totals.setdefault(location_name, {"stamina": 0, "drops": {}})
        loc_data["stamina"] += row["results"]["stamina"]
        for item in row["results"]["items"]:
            loc_data["drops"][item["item"]] = loc_data["drops"].get(item["item"], 0) + 1
            loc_data["drops"]["ALL"] = loc_data["drops"].get("ALL", 0) + 1
    return totals


def rates_per_stam() -> dict[str, dict[str, float]]:
    rates = {}
    for loc, loc_data in total_drops().items():
        loc_rates = {}
        for item, drops in loc_data["drops"].items():
            if item == "ALL":
                continue
            loc_rates[item] = drops / loc_data["stamina"]
        rates[loc] = loc_rates
    return rates


def drop_rates() -> dict[str, dict[str, float]]:
    rates = {}
    for loc, loc_data in total_drops().items():
        zone_total = sum(
            drops for item, drops in loc_data["drops"].items() if item != "ALL"
        )
        loc_rates = {}
        for item, drops in loc_data["drops"].items():
            if item == "ALL":
                continue
            loc_rates[item] = drops / zone_total
        rates[loc] = loc_rates
    return rates


def droprates_cmd(
    filter: Optional[str] = typer.Argument(None),
    lemonade: bool = False,
    cider: bool = False,
    since: int = 0,
    output: list[str] = [],
    wanderer: int = 33,
    lemonade_perk: bool = True,
    net_perk: bool = True,
) -> None:
    # If any output types are a comma-separated string, expand them.
    output = [o2 for o in output for o2 in o.split(",")]
    drops = compile_drops(
        explore=True,
        lemonade=lemonade,
        cider=cider,
        fish=True,
        net=True,
        lemonade_fake_explores=True,
        nets_fake_fishes=True,
        since=since,
    )
    filter_is_location = filter is not None and filter in drops.locations
    filter_is_item = filter is not None and any(
        filter in loc.items for loc in drops.locations.values()
    )
    for location, loc_drops in sorted(drops.locations.items()):
        if filter_is_location and location != filter:
            continue
        filtered_items = [
            (item, item_drops)
            for item, item_drops in loc_drops.items.items()
            if filter is None
            or (
                item == filter
                if filter_is_item
                else re.search(filter, item, re.IGNORECASE)
            )
        ]
        if not filtered_items:
            continue
        print(f"{location}:")
        for item, item_drops in sorted(filtered_items):
            hits_per_drop = (
                item_drops.explores or item_drops.fishes
            ) / item_drops.drops
            mode = "explores" if item_drops.explores else "fishes"
            if mode == "explores" and "stam" in output:
                hits_per_drop *= 1 - (wanderer / 100)
                mode = "stam"
            elif mode == "explores" and "lemonade" in output:
                raise NotImplementedError
            elif mode == "fishes" and "nets" in output:
                hits_per_drop /= 15 if net_perk else 10
                mode = "nets"
            print(
                f"\t{item}: {hits_per_drop:.2f} {mode}/drop ({item_drops.drops} drops)"
            )


if __name__ == "__main__":
    typer.run(droprates_cmd)
