import datetime
import functools
import io
import json
import math
import os
import re
import sys
import time
import zoneinfo
from collections import defaultdict
from csv import DictWriter
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

# Harvest drops to pay attention to.
HARVEST_DROPS = {
    "Gold Peppers",
    "Gold Carrot",
    "Gold Peas",
    "Gold Cucumber",
    "Gold Eggplant",
    "Runestone 01",
    "Runestone 06",
    "Runestone 07",
    "Runestone 10",
    "Runestone 11",
    "Runestone 16",
    "Runestone 20",
    "Piece of Heart",
    "Winged Amulet",
}

# When the Iron Depot drop change went live.
IRON_DEPOT_CHANGE = (
    datetime.datetime(
        2022, 2, 21, 10, 00, 00, tzinfo=zoneinfo.ZoneInfo("America/Los_Angeles")
    ).timestamp()
    * 1000
)


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
    harvests: int = 0
    drops: int = 0


@attrs.define
class LocationDrops:
    explores: int = 0
    lemonades: int = 0
    ciders: int = 0
    fishes: int = 0
    nets: int = 0
    harvests: int = 0
    drops: int = 0
    items: dict[str, ItemDrops] = attrs.Factory(lambda: defaultdict(ItemDrops))


@attrs.define
class Drops:
    explores: int = 0
    lemonades: int = 0
    ciders: int = 0
    fishes: int = 0
    nets: int = 0
    harvests: int = 0
    drops: int = 0
    locations: dict[str, LocationDrops] = attrs.Factory(
        lambda: defaultdict(LocationDrops)
    )


AnyDrops = Union[Drops, LocationDrops, ItemDrops]


def location_for_row(row: dict) -> Optional[str]:
    """Return the location for a log row, if it exists."""
    if row["type"] == "harvestall":
        # For harvests, we pretend the seed is a location. I will probably regret this.
        # Check that this is a harvest of just one kind of seed, otherwise too hard to track.
        seeds = {crop["seed"] for crop in row["results"]["crops"]}
        if len(seeds) != 1 or None in seeds:
            return None
        else:
            return seeds.pop()
    else:
        # Normal explore or fish that has a location on it, probably.
        return row["results"].get("location")


def count_sources(
    drops: AnyDrops,
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
    elif row["type"] == "harvestall":
        # We already checked that only mono-seed logs are considered.
        drops.harvests += len(row["results"]["crops"])


def compile_drops(
    explore: bool = False,
    lemonade: bool = False,
    cider: bool = False,
    fish: bool = False,
    net: bool = False,
    harvest: bool = False,
    since: int = 0,
    iron_depot: bool = False,
    lemonade_fake_explores: bool = False,
    nets_fake_fishes: bool = False,
    harvest_true_drops: bool = False,
    cache: bool = True,
) -> Drops:
    cache_path = cache_path_for(
        e=explore,
        l=lemonade,
        c=cider,
        f=fish,
        n=net,
        h=harvest,
        s=since,
        i=iron_depot,
        x=lemonade_fake_explores,
        y=nets_fake_fishes,
        t=harvest_true_drops,
    )

    # Check if the cache file exists and is newer than all log files.
    if (
        cache
        and os.path.exists(cache_path)
        and os.stat(cache_path).st_mtime >= parse_logs.log_mtime()
    ):
        with open(cache_path) as cachef:
            return cattrs.structure(json.load(cachef), Drops)

    when_items_dropped = {
        item.name: when_dropped(item) for item in fixtures.load_items()
    }
    affected_by_iron_depot = {
        loc.name: ("Iron" in loc.items or "Nails" in loc.items)
        for loc in fixtures.load_locations()
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
    if harvest:
        types.add("harvestall")
    explores = Drops()
    logs = [row for row in parse_logs.parse_logs(since=since) if row["type"] in types]
    # First run through to count drops and work out which items are in each locations.
    for row in logs:
        location_name = location_for_row(row)
        if not location_name:
            continue
        # Check if this timestamp is allowed with the current iron depot mode and location.
        if (
            affected_by_iron_depot.get(location_name)
            and (row["ts"] < IRON_DEPOT_CHANGE) is iron_depot
        ):
            continue
        overflow_items: set[str] = {
            item["item"] for item in row["results"]["items"] if item.get("overflow")
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
            quantity = item.get("quantity", 1)
            if row["type"] == "harvestall":
                if item["item"] not in HARVEST_DROPS:
                    # We only care about some harvest drops.
                    continue
                if not harvest_true_drops:
                    # By default ignore multiple simultaneous drops. Trying to account for
                    # double prizes, but this means we underestimate. Using ceil(/2) because
                    # 1 drop is 1 drop, 2 is _probably_ double prizes, but 3 has to be 2 drops.
                    # 4 and above, who knows so just keep it simple.
                    quantity = math.ceil(quantity / 2)
            explores.locations[location_name].items[item["item"]].drops += quantity
            explores.locations[location_name].drops += quantity
            explores.drops += quantity
    # Second pass to get the explore counts.
    for row in logs:
        location_name = location_for_row(row)
        if not location_name:
            continue
        # Check if this timestamp is allowed with the current iron depot mode and location.
        if (
            affected_by_iron_depot.get(location_name)
            and (row["ts"] < IRON_DEPOT_CHANGE) is iron_depot
        ):
            continue
        overflow_items: set[str] = {
            item["item"] for item in row["results"]["items"] if item.get("overflow")
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


def mode_for_drops(item: AnyDrops) -> tuple[str, int]:
    if item.fishes:
        return "fishes", item.fishes
    elif item.harvests:
        return "harvests", item.harvests
    else:
        return "explores", item.explores


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


class NormalOutput:
    def location(self, location: str, mode: str, hits: int) -> None:
        print(f"{location}: ({hits} {mode})")

    def item(
        self,
        location: str,
        item: str,
        mode: str,
        hits: int,
        drops: int,
        hits_per_drop: float,
    ) -> None:
        print(f"\t{item}: {hits_per_drop:.2f} {mode}/drop ({drops} drops)")


class CSVOutput:
    def __init__(self):
        self.out = DictWriter(
            sys.stdout, ["location", "item", "drops", "hits", "hits_per_drop", "mode"]
        )
        self.out.writeheader()

    def location(self, location: str, mode: str, hits: int) -> None:
        pass

    def item(
        self,
        location: str,
        item: str,
        mode: str,
        hits: int,
        drops: int,
        hits_per_drop: float,
    ) -> None:
        self.out.writerow(
            {
                "location": location,
                "item": item,
                "mode": mode,
                "hits": hits,
                "drops": drops,
                "hits_per_drop": hits_per_drop,
            }
        )


def droprates_cmd(
    filter: Optional[str] = typer.Argument(None),
    lemonade: bool = True,
    cider: bool = False,
    harvest: bool = True,
    since: int = 0,
    output: list[str] = [],
    wanderer: int = 33,
    lemonade_perk: bool = True,
    net_perk: bool = True,
    cache: bool = True,
    csv: bool = False,
    fishing: bool = False,
    iron_depot: bool = False,
) -> None:
    # If any output types are a comma-separated string, expand them.
    # ["foo,bar", "baz"] -> ["foo", "bar", "baz"]
    output = [o2 for o in output for o2 in o.split(",")]
    drops = compile_drops(
        explore=True,
        lemonade=lemonade,
        cider=cider,
        fish=fishing,
        net=not fishing,
        harvest=harvest,
        lemonade_fake_explores=True,
        nets_fake_fishes=True,
        since=since,
        cache=cache,
        iron_depot=iron_depot,
    )
    filter_is_location = filter is not None and filter in drops.locations
    filter_is_item = filter is not None and any(
        filter in loc.items for loc in drops.locations.values()
    )
    out = CSVOutput() if csv else NormalOutput()
    for location, loc_drops in sorted(drops.locations.items()):
        if filter_is_location and location != filter:
            continue
        filtered_items = [
            (item, item_drops)
            for item, item_drops in loc_drops.items.items()
            if filter is None
            or filter_is_location
            or (
                item == filter
                if filter_is_item
                else re.search(filter, item, re.IGNORECASE)
            )
        ]
        if not filtered_items:
            continue
        loc_mode, loc_hits = mode_for_drops(loc_drops)
        out.location(location=location, mode=loc_mode, hits=loc_hits)
        for item, item_drops in sorted(filtered_items):
            mode, hits = mode_for_drops(item_drops)
            hits_per_drop = hits / item_drops.drops
            if mode == "explores" and "stam" in output:
                hits_per_drop *= 1 - (wanderer / 100)
                mode = "stam"
            elif mode == "explores" and "lemonade" in output:
                raise NotImplementedError
            elif mode == "fishes" and "nets" in output:
                hits_per_drop /= 15 if net_perk else 10
                mode = "nets"
            out.item(
                location=location,
                item=item,
                mode=mode,
                hits=hits,
                drops=item_drops.drops,
                hits_per_drop=hits_per_drop,
            )


if __name__ == "__main__":
    typer.run(droprates_cmd)
