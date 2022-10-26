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
from typing import Any, Iterable, Optional, Union

import attrs
import cattrs
import fixtures
import parse_logs
import typer

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
    "Jundland Desert": 4 / 15,
    "Haunted House": 2 / 5,
}

CACHE_PATH_BASE = f"{os.path.dirname(__file__)}/.dropscache/{'{}'}.json"

# Harvest drops to pay attention to. Mapped to their default seeds.
HARVEST_DROPS = {
    "Gold Peppers": "Pepper Seeds",
    "Gold Carrot": "Carrot Seeds",
    "Gold Peas": "Pea Seeds",
    "Gold Cucumber": "Cucumber Seeds",
    "Gold Eggplant": "Eggplant Seeds",
    "Runestone 01": "Carrot Seeds",
    "Runestone 06": "Cucumber Seeds",
    "Runestone 07": "Radish Seeds",
    "Runestone 10": "Leek Seeds",
    "Runestone 11": "Corn Seeds",
    "Runestone 16": "Hops Seeds",
    "Runestone 20": "Eggplant Seeds",
    "Piece of Heart": "Watermelon Seeds",
    "Winged Amulet": "Tomato Seeds",
    "Egg 03": "Carrot Seeds",
    "Popcorn": "Corn Seeds",
    "Gold Potato": "Potato Seeds",
}

# When the Iron Depot drop change went live.
IRON_DEPOT_CHANGE = (
    datetime.datetime(
        2022, 2, 21, 10, 00, 00, tzinfo=zoneinfo.ZoneInfo("America/Los_Angeles")
    ).timestamp()
    * 1000
)

BROKEN_OVERFLOW_TYPES = {"cider", "large_net", "palmer"}

# When the cider "changed drop rates" went live.
CIDER_CHANGE = 1654722709000
NEW_CIDER_BASE_DROP_RATE = 0.4  # Confirmed by FS in chat

# When I got trigon knot perk.
TRIGON_KNOT = 1655601900000

# Timestamp for the Runecube drop rate fix.
# RUNECUBE_FIX = 1656381013000
RUNECUBE_FIX = 1656534341000

# Drop log types which are immune from the runecube perk.
RUNECUBE_IMMUNE_TYPES = {"harvestall"}


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


class InfRange:
    """A fake range that is always true."""

    def __contains__(self, val: int) -> bool:
        return True


def when_dropped(item: fixtures.Item, location: fixtures.Location) -> range:
    first_dropped = item.first_dropped or item.first_seen or 0
    if location.name == "Black Rock Canyon":
        # Hack, Thursday, March 31, 2022 1:00:00 PM GMT-07:00
        # Salt Rock was added.
        first_dropped = 1648756800000
    if item.name == "Popcorn" and location.name == "Corn Seeds":
        # September 12th, time unknown so saying midnight for simplicity.
        first_dropped = 1662958800000
    last_dropped = item.last_dropped or round((time.time() + 10000000) * 1000)
    return range(first_dropped, last_dropped + 1)


@attrs.define
class ItemDrops:
    explores: int = 0
    lemonades: int = 0
    ciders: int = 0
    palmers: int = 0
    fishes: int = 0
    nets: int = 0
    large_nets: int = 0
    harvests: int = 0
    drops: int = 0


@attrs.define
class LocationDrops:
    explores: int = 0
    lemonades: int = 0
    ciders: int = 0
    palmers: int = 0
    fishes: int = 0
    nets: int = 0
    large_nets: int = 0
    harvests: int = 0
    drops: int = 0
    items: dict[str, ItemDrops] = attrs.Factory(lambda: defaultdict(ItemDrops))


@attrs.define
class Drops:
    explores: int = 0
    lemonades: int = 0
    ciders: int = 0
    palmers: int = 0
    fishes: int = 0
    nets: int = 0
    large_nets: int = 0
    harvests: int = 0
    drops: int = 0
    locations: dict[str, LocationDrops] = attrs.Factory(
        lambda: defaultdict(LocationDrops)
    )

    @property
    def items(self) -> Iterable[tuple[str, str, ItemDrops]]:
        for location, loc_drops in self.locations.items():
            for item, item_drops in loc_drops.items.items():
                yield location, item, item_drops


AnyDrops = Union[Drops, LocationDrops, ItemDrops]


def location_for_row(row: dict) -> Optional[str]:
    """Return the location for a log row, if it exists."""
    if row["type"] == "harvestall":
        # For harvests, we pretend the seed is a location. I will probably regret this.
        # Check that this is a harvest of just one kind of seed, otherwise too hard to track.
        seeds: set[Optional[str]] = {crop["seed"] for crop in row["results"]["crops"]}
        if len(seeds) != 1 or None in seeds:
            # Sometimes the data recording for seeds breaks, so just assume default seeds.
            seeds = {
                HARVEST_DROPS[it["item"]]
                for it in row["results"]["items"]
                if it["item"] in HARVEST_DROPS
            }
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
    cider_location: Optional[str] = None,
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
        cider_explores = row["results"]["explores"]
        if row["ts"] >= CIDER_CHANGE:
            # Work out how many normal explores this would have been.
            total_drops = cider_explores * NEW_CIDER_BASE_DROP_RATE
            base_drop_rate = (
                BASE_DROP_RATES[cider_location] if cider_location else (1 / 3)
            )
            cider_explores = total_drops / base_drop_rate
        # This is kind of wrong for global and location stats since not all explores count
        # for all items but it's more correct than not.
        drops.explores += cider_explores
    elif row["type"] == "palmer":
        drops.palmers += 1
        if lemonade_fake_explores_location is not None:
            drops.explores += round(
                (1 / BASE_DROP_RATES[lemonade_fake_explores_location]) * 500
            )
    elif row["type"] == "fish":
        drops.fishes += 1
    elif row["type"] == "net":
        drops.nets += 1
        if nets_fake_fishes:
            drops.fishes += sum(it.get("quantity", 1) for it in row["results"]["items"])
    elif row["type"] == "large_net":
        drops.large_nets += 1
        if nets_fake_fishes:
            drops.fishes += 500 if row["ts"] >= TRIGON_KNOT else 400
    elif row["type"] == "harvestall":
        # We already checked that only mono-seed logs are considered.
        drops.harvests += len(row["results"]["crops"])


def compile_drops(
    explore: bool = False,
    lemonade: bool = False,
    cider: bool = False,
    palmer: bool = False,
    fish: bool = False,
    net: bool = False,
    large_net: bool = False,
    harvest: bool = False,
    since: int = 0,
    iron_depot: bool = False,
    runecube: bool = False,
    lemonade_fake_explores: bool = False,
    nets_fake_fishes: bool = False,
    harvest_true_drops: bool = False,
    cache: bool = True,
) -> Drops:
    cache_path = cache_path_for(
        e=explore,
        l=lemonade,
        c=cider,
        p=palmer,
        f=fish,
        n=net,
        m=large_net,
        h=harvest,
        s=since,
        i=iron_depot,
        r=runecube,
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

    items = list(fixtures.load_items())
    items_by_name = {it.name: it for it in items}
    when_items_dropped: dict[tuple[str, str], Union[range, InfRange]] = defaultdict(
        InfRange
    )
    for loc in fixtures.load_locations():
        for item in items:
            when_items_dropped[(item.name, loc.name)] = when_dropped(item, loc)
    for item_name, loc_name in HARVEST_DROPS.items():
        when_items_dropped[(item_name, loc_name)] = when_dropped(
            items_by_name[item_name],
            fixtures.Location(
                name=loc_name,
                id="",
                type="harvest",
                image="",
                items=tuple(),
            ),
        )
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
    if palmer:
        types.add("palmer")
    if fish:
        types.add("fish")
    if net:
        types.add("net")
    if large_net:
        types.add("large_net")
    if harvest:
        types.add("harvestall")
    explores = Drops()
    logs = [
        row
        for row in parse_logs.parse_logs(since=since)
        if row["type"] in types
        and (
            row["results"].get("runecube", False) == runecube
            or row["type"] in RUNECUBE_IMMUNE_TYPES
        )
    ]
    if runecube:
        logs = [
            row
            for row in logs
            if row["ts"] >= RUNECUBE_FIX or row["type"] in RUNECUBE_IMMUNE_TYPES
        ]
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
            if row["ts"] not in when_items_dropped[(item["item"], location_name)]:
                # Ignore out-of-bounds drops. This allows accounting for stuff like drop
                # rates changing substantially by manually resetting firstDropped.
                continue
            if row["type"] in BROKEN_OVERFLOW_TYPES and item["item"] in overflow_items:
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
            cider_location=location_name,
        )
        for item, item_explores in explores.locations[location_name].items.items():
            if row["ts"] not in when_items_dropped[(item, location_name)]:
                # Item couldn't drop, this doesn't count.
                continue
            if row["type"] in BROKEN_OVERFLOW_TYPES and item in overflow_items:
                # Cider overflow always reports 0 drops so any item that overflows during
                # a cider has to be ignored.
                continue
            count_sources_for_loc(item_explores)
        count_sources_for_loc(explores.locations[location_name])
        count_sources_for_loc(explores)

    # Write the cache.
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
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


def mode_for_drops(item: AnyDrops) -> tuple[str, int]:
    if item.fishes:
        return "fishes", item.fishes
    elif item.harvests:
        return "harvests", item.harvests
    else:
        return "explores", item.explores


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
    cider: bool = True,
    harvest: bool = True,
    since: int = 0,
    output: list[str] = [],
    wanderer: int = 33,
    lemonade_perk: bool = True,
    net_perk: bool = True,
    cache: bool = True,
    csv: bool = False,
    fishing: bool = False,
    iron_depot: bool = True,
    runecube: bool = False,
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
        runecube=runecube,
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
