import sys
import time
from collections import defaultdict
from typing import Any, Union

import attrs

import fixtures
import parse_logs


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
    drops: Union[Drops, LocationDrops, ItemDrops], row: dict[str, Any]
) -> None:
    if row["type"] == "explore":
        drops.explores += row["results"]["stamina"]
    elif row["type"] == "lemonade":
        drops.lemonades += 1
    elif row["type"] == "cider":
        drops.ciders += 1
        # This is kind of wrong for global and location stats since not all explores count
        # for all items but it's more correct than not.
        drops.explores += row["results"].get("explores", row["results"]["stamina"])
    elif row["type"] == "fish":
        drops.fishes += 1
    elif row["type"] == "net":
        drops.nets += 1


def compile_drops(
    explore: bool = False,
    lemonade: bool = False,
    cider: bool = False,
    fish: bool = False,
    net: bool = False,
) -> Drops:
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
    logs = [row for row in parse_logs.parse_logs() if row["type"] in types]
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
        for item, item_explores in explores.locations[location_name].items.items():
            if row["ts"] not in when_items_dropped[item]:
                # Item couldn't drop, this doesn't count.
                continue
            if row["type"] == "cider" and item in overflow_items:
                # Cider overflow always reports 0 drops so any item that overflows during
                # a cider has to be ignored.
                continue
            count_sources(item_explores, row)
        count_sources(explores.locations[location_name], row)
        count_sources(explores, row)

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


if __name__ == "__main__":
    item_filter = sys.argv[1] if len(sys.argv) > 1 else None
    combined_stam_per_drop = {}
    for zone, zone_totals in sorted(total_drops().items()):
        print(f"{zone} ({zone_totals['stamina']}):")
        for item, drops in sorted(zone_totals["drops"].items()):
            if item_filter and item != item_filter:
                continue
            stam_per_drop = zone_totals["stamina"] / drops
            if stam_per_drop < combined_stam_per_drop.get(item, 1000000000000):
                combined_stam_per_drop[item] = stam_per_drop
            print(f"\t{item}: {stam_per_drop} ({drops})")

    print("Combined:")
    for item, stam_per_drop in sorted(combined_stam_per_drop.items()):
        print(f'        "{item}": {stam_per_drop},')
