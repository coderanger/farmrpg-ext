import collections
import itertools
import json
import os
import re
from datetime import date, datetime
from pathlib import Path
from typing import Iterable, Optional, Union
from zoneinfo import ZoneInfo

import attrs
import httpx
import yaml

import roman

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


@attrs.define(frozen=True)
class RecipeIngredient:
    id: str
    name: str
    quantity: int


@attrs.define(frozen=True)
class Item:
    name: str
    id: str
    image: str
    recipe: Optional[tuple[RecipeIngredient, ...]] = None
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
    manual_fishing_only: Optional[bool] = None


def load_items() -> Iterable[Item]:
    for item in load_fixture("items"):
        if "recipe" in item:
            item["recipe"] = tuple(RecipeIngredient(**it) for it in item["recipe"])
        yield Item(**item)


@attrs.define(frozen=True)
class Location:
    id: str
    type: str
    name: str
    image: str
    items: tuple[str]


def load_locations(type: Optional[str] = None) -> Iterable[Location]:
    for location in load_fixture("locations"):
        if type is not None and type != location["type"]:
            continue
        yield Location(**location)


@attrs.define(frozen=True)
class QuestItem:
    id: str
    quantity: int
    item: Optional[Item] = None


@attrs.define(frozen=True)
class Quest:
    id: str
    name: str
    from_: str
    from_image: str
    text: str
    first_seen: int
    available_from: Optional[str] = None
    available_to: Optional[str] = None
    silver_request: Optional[int] = None
    item_requests: Optional[tuple[QuestItem, ...]] = None
    silver_reward: Optional[int] = None
    gold_reward: Optional[int] = None
    item_rewards: Optional[tuple[QuestItem, ...]] = None
    requires_farming: Optional[int] = None
    requires_fishing: Optional[int] = None
    requires_crafting: Optional[int] = None
    requires_exploring: Optional[int] = None


def load_quests(resolve_items=False) -> Iterable[Quest]:
    items = {it.id: it for it in load_items()} if resolve_items else {}
    for quest in load_fixture("quests"):
        # from is a Python keyword so I can't use it.
        quest["from_"] = quest.pop("from")
        # Convert the sub-lists.
        if "item_requests" in quest:
            quest["item_requests"] = tuple(
                QuestItem(item=items.get(it["id"]), **it)
                for it in quest["item_requests"]
            )
        if "item_rewards" in quest:
            quest["item_rewards"] = tuple(
                QuestItem(item=items.get(it["id"]), **it)
                for it in quest["item_rewards"]
            )
        yield Quest(**quest)


def _get_drops():
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

    # TEMPORARY GIANT HACK UNTIL I CAN DO MORE SOLVER-ING.
    normal_drops.locations["Cane Pole Ridge"].items[
        "Tea Leaves"
    ] = iron_depot_drops.locations["Cane Pole Ridge"].items["Tea Leaves"]

    # NOTES ABOUT GOLD BOOT DROP RATE
    # RySwim
    # @coderanger as of right now: 11 gold boots in exactly 46,850 casts
    # Colemtg
    # but if there is a way to update manually, for gold boot I had 97 over 320-340k fish.

    return (normal_drops, iron_depot_drops, manual_fish_drops)


def gen_drop_rates():
    import droprates

    normal_drops, iron_depot_drops, manual_fish_drops = _get_drops()

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
            for item, item_drops in sorted(
                loc_drops.items.items(), key=lambda kv: kv[0]
            )
        }

    drop_rates = []
    for location in sorted(location_keys):
        drop_rates.append(
            {
                "location": location,
                "mode": droprates.mode_for_drops(normal_drops.locations[location])[0],
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

    return drop_rates


def gen_drop_rates_gql():
    import droprates

    normal_drops, iron_depot_drops, manual_fish_drops = _get_drops()

    # Build a secondary fixture for Gatsby's GraphQL layer.
    drop_rates_gql = []
    for rate_type, drops in [
        ("normal", normal_drops),
        ("iron_depot", iron_depot_drops),
        ("manual_fishing", manual_fish_drops),
    ]:
        for location, loc_drops in sorted(
            drops.locations.items(), key=lambda kv: kv[0]
        ):
            for item, item_drops in sorted(
                loc_drops.items.items(), key=lambda kv: kv[0]
            ):
                mode, hits = droprates.mode_for_drops(item_drops)
                hits_per_drop = hits / item_drops.drops
                drop_rates_gql.append(
                    {
                        "location": location,
                        "mode": mode,
                        "rate_type": rate_type,
                        "item": item,
                        "rate": hits_per_drop,
                        "hits": hits,
                        "drops": item_drops.drops,
                    }
                )
    return drop_rates_gql


def gen_item_drop_mode():
    import droprates

    items_by_name = {it.name: it for it in load_items()}
    normal_drops, iron_depot_drops, manual_fish_drops = _get_drops()

    drops_from: dict[str, str] = {}
    for drops in [normal_drops, iron_depot_drops, manual_fish_drops]:
        for _, item, item_drops in drops.items:
            drops_from[items_by_name[item].id] = droprates.mode_for_drops(item_drops)[0]

    # A tiny fixture for picking which set of drop rates to use for a given item.
    return [
        {"id": item_id, "dropMode": drop_mode}
        for item_id, drop_mode in drops_from.items()
    ]


def gen_questlines():
    # A fixture for questlines as a whole, based on name prefixes.
    quests = {q.name: q for q in load_quests()}
    quests_by_id = {q.id: q for q in load_quests()}
    pattern = re.compile(r"^\s*(.*?)\s+([MCDLXVI]+)(?: - ([A-Z]))?\s*$")
    questlines = collections.defaultdict(list)
    for quest in quests.values():
        match = pattern.search(quest.name)
        if not match:
            continue
        questline_name = match.group(1)
        weight_roman = match.group(2)
        weight = roman.fromRoman(weight_roman)
        offset = match.group(3)
        if offset:
            weight = weight * 100 + ord(offset)
        questlines[questline_name].append({"id": quest.id, "weight": weight})
    # Check for cases where the first quest doesn't have an I.
    for quest in quests.values():
        if quest.name in questlines:
            questlines[quest.name].append({"id": quest.id, "weight": 1})

    # Questlines considered secondary so they don't count for prev/next links.
    secondary = {"You Must Build A Boat", "Return Our Lost Friend"}

    def override(
        questline: str, quest: str, weight: Optional[Union[int, float]] = None
    ) -> None:
        questlines[questline].append(
            {"id": quests[quest].id, "weight": weight or len(questlines[questline])}
        )

    # Some manual overrides.
    override("Hare Handler", "Of Hares And Feathers")
    override("Corn Quandry", "Never Gonna Give Corn Up", 30.5)
    override("A Horse Of A Different Color", "A Horse, Afraid", 6.5)
    override(
        "A Horse Of A Different Color", "You Spin Me Right Round,Buddy, Right Round"
    )
    override("Not From Around Here", "Now You See It", 4)
    override("Not From Around Here", "Now You Don't", 5)
    override("Pirate Cove", "You Must Build A Boat I", 2.1)
    override("Pirate Cove", "You Must Build A Boat II", 2.2)
    override("Pirate Cove", "You Must Build A Boat III", 2.3)
    override("Pirate Cove", "You Must Build A Boat IV", 2.4)
    override("Pirate Cove", "You Must Build A Boat V", 2.5)
    override("Pirate Cove", "Set Sail for Pirate Cove", 2.6)
    override("Pirate Cove", "Shipwrecked!", 2.7)
    override("Pirate Cove", "You Must Repair A Boat", 10)
    override("Pirate Cove", "Escape from Pirate Cove", 11)
    override("Strange Stones", "Strange Stones Exigent", 11)
    override("Strange Stones", "Not-So-Strange Stones", 12)
    override("Strange Stones", "Return Our Lost Friend I", 13)
    override("Strange Stones", "Return Our Lost Friend II", 14)
    override("Strange Stones", "Return Our Lost Friend III", 15)
    override("Strange Stones", "Return Our Lost Friend IV", 16)
    override("Strange Stones", "Return Our Lost Friend V", 17)
    override("Strange Stones", "Lost and Found", 18)

    def irange(start: int, stop: int) -> range:
        return range(start, stop + 1)

    # A special synthetic questline to cover the whole main arc.
    main_quests = [
        ("Consequences and Defenses", irange(1, 8)),
        ("A Tower Divided", [None, 2, 3]),
        ("A Tower Redecorated", [None, 2, 3]),
        ("A Tower Remade", [None, 2]),
        ("Defenses and Consequences", irange(1, 10)),
        ("Consequences and Defenses", irange(9, 22)),
        ("Defenses and Consequences", irange(11, 22)),
        ("Shadow’s Reach", irange(1, 2)),
        ("Strange Companions", irange(1, 6)),
    ]
    for base, subs in main_quests:
        secondary.add(base)
        for sub in subs:
            quest_name = base
            if sub is not None:
                if isinstance(sub, int):
                    sub = roman.toRoman(sub)
                quest_name += f" {sub}"
            override("Main Story Quests", quest_name)

    # Sort by weight.
    questlines_sorted = sorted(
        (
            {
                "name": k,
                "quests": [q["id"] for q in sorted(v, key=lambda q: q["weight"])],
                "secondary": k in secondary,
            }
            for k, v in questlines.items()
        ),
        key=lambda l: l["name"],
    )
    for q in questlines_sorted:
        if q["quests"]:
            q["image"] = quests_by_id[q["quests"][0]].from_image
    return questlines_sorted


# PHPs short date format. This is probably the same as Python but I don't feel like risking it.
PHP_MONTHS = {
    "Jan": 1,
    "Feb": 2,
    "Mar": 3,
    "Apr": 4,
    "May": 5,
    "Jun": 6,
    "Jul": 7,
    "Aug": 8,
    "Sep": 9,
    "Oct": 10,
    "Nov": 11,
    "Dec": 12,
}


def _parse_quest_available(
    available_from: str, available_to: str, first_seen: datetime
) -> tuple[datetime, datetime]:
    from_month, from_day = available_from.split(" ")
    to_month, to_day = available_to.split(" ")
    from_datetime = datetime(
        first_seen.year,
        PHP_MONTHS[from_month],
        int(from_day),
        0,
        0,
        0,
        tzinfo=ZoneInfo("America/Chicago"),
    )
    if first_seen < from_datetime:
        from_datetime = from_datetime.replace(year=from_datetime.year - 1)
    to_datetime = datetime(
        from_datetime.year,
        PHP_MONTHS[to_month],
        int(to_day),
        23,
        59,
        59,
        tzinfo=ZoneInfo("America/Chicago"),
    )
    if to_datetime < from_datetime:
        to_datetime = to_datetime.replace(year=to_datetime.year + 1)
    return from_datetime, to_datetime


def test_parse_quest_available():
    first_seen = datetime(2022, 3, 1, tzinfo=ZoneInfo("UTC"))
    test_from, test_to = _parse_quest_available("Dec 10", "Dec 20", first_seen)
    assert test_from.date() == date(2021, 12, 10)
    assert test_to.date() == date(2021, 12, 20)
    test_from, test_to = _parse_quest_available("Feb 1", "Feb 5", first_seen)
    assert test_from.date() == date(2022, 2, 1)
    assert test_to.date() == date(2022, 2, 5)
    test_from, test_to = _parse_quest_available("Dec 25", "Jan 5", first_seen)
    assert test_from.date() == date(2021, 12, 25)
    assert test_to.date() == date(2022, 1, 5)


def gen_quest_extra():
    quests = sorted(load_quests(), key=lambda q: int(q.id))

    # Take the "Jan 1" style dates for time-limited quests and convert to real timestamps.
    quest_dates = {}
    for q in quests:
        assert bool(q.available_from) == bool(q.available_to)
        if q.available_from and q.available_to:
            first_seen = datetime.fromtimestamp(q.first_seen / 1000, tz=ZoneInfo("UTC"))
            available_from, available_to = _parse_quest_available(
                q.available_from, q.available_to, first_seen
            )
            quest_dates[q.id] = {
                "availableFrom": int(available_from.timestamp() * 1000),
                "availableTo": int(available_to.timestamp() * 1000),
            }

    # Use the questline data to work out a prev/next for each line'd quest.
    questlines_sorted = gen_questlines()
    quest_adjacency = collections.defaultdict(lambda: {"prev": None, "next": None})
    for questline in questlines_sorted:
        if questline.get("secondary"):
            continue
        it1, it2 = itertools.tee(questline["quests"])
        next(it2, None)
        for a, b in zip(it1, it2):
            assert quest_adjacency[a]["next"] is None
            quest_adjacency[a]["next"] = b
            assert quest_adjacency[b]["prev"] is None
            quest_adjacency[b]["prev"] = a

    # Reverse map for quest search.
    questlines_reverse = collections.defaultdict(list)
    for questline in questlines_sorted:
        for q in questline["quests"]:
            questlines_reverse[q].append(questline["name"])

    return [
        {
            "id": q.id,
            "questlines": questlines_reverse.get(q.id, []),
            **quest_adjacency.get(q.id, {}),
            **quest_dates.get(q.id, {}),
        }
        for q in quests
    ]


def gen_wishing_well():
    # Download and format the Wishing Well data from the spreadsheet.
    spreadsheet_id = "1hYP-_PkvKvIm0hz8nhLhqzzZhAYl0zY6aRDoi6oN5qQ"
    resp = httpx.get(
        f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/B5:C",
        params={"key": os.environ["GOOGLE_API_KEY"]},
    )
    resp.raise_for_status()
    page = resp.json()
    rows = page["values"]
    headers = rows.pop(0)
    # Sanity check just in case.
    assert headers == ["Input", "Output"]
    ww_drops = collections.defaultdict(list)
    for row in rows:
        ww_drops[row[0]].append(row[1])
    # Parse.
    items = {it.name: it for it in load_items()}
    # Fix up some naming errors in the page.
    misnamed_items = {
        # Bad name : good name,
        "R.O.A.S": "R.O.A.S.",
        "GoldFish": "Goldfish",
        "Witch hat": "Witch Hat",
    }
    for bad, good in misnamed_items.items():
        items[bad] = items[good]
    ww_data = []
    for input, outputs in sorted(ww_drops.items(), key=lambda kv: kv[0]):
        for output in sorted(outputs):
            ww_data.append(
                {
                    "input": items[input].id,
                    "output": items[output].id,
                    "chance": 1 / len(outputs),
                }
            )
    return ww_data


def gen_locksmith_boxes():
    items = {it.name: it for it in load_items()}
    locksmith_data = Path(__file__) / ".." / ".." / "data" / "locksmith.yaml"
    boxes = yaml.safe_load(locksmith_data.resolve().open())
    return [
        {
            "box": items[box["box"]].id,
            "gold": box.get("gold"),
            "mode": box.get("mode", "multi"),
        }
        for box in boxes
    ]


def gen_locksmith_items():
    items = {it.name: it for it in load_items()}
    locksmith_data = Path(__file__) / ".." / ".." / "data" / "locksmith.yaml"
    boxes = yaml.safe_load(locksmith_data.resolve().open())
    locksmith_items = []
    for box in boxes:
        box_id = items[box["box"]].id
        mode = box.get("mode", "multi")
        for i, (item, quantity) in enumerate(box.get("items", {}).items()):
            group = 0 if mode == "single" else i
            item_id = items[item].id
            # Parse the quantity into a low and high value.
            if isinstance(quantity, int) or "-" not in quantity:
                # Single value, simple.
                quantity_low = quantity_high = int(quantity)
            else:
                quantity_low, quantity_high = quantity.split("-")
                quantity_low = int(quantity_low)
                if quantity_high == "?":
                    quantity_high = None
                else:
                    quantity_high = int(quantity_high)
            locksmith_items.append(
                {
                    "box": box_id,
                    "group": group,
                    "item": item_id,
                    "quantityLow": quantity_low,
                    "quantityHigh": quantity_high,
                }
            )
    return sorted(locksmith_items, key=lambda i: (i["box"], i["group"], i["item"]))


def gen_location_extra():
    import droprates
    import xp

    xp_per_hit = xp.value_per_hit()
    xp_per_hit_fishing = xp.value_per_hit(fishing=True)
    xp_per_hit_iron_depot = xp.value_per_hit(iron_depot=True)

    silver_per_hit = xp.value_per_hit(silver=True)
    silver_per_hit_fishing = xp.value_per_hit(silver=True)
    silver_per_hit_iron_depot = xp.value_per_hit(silver=True, iron_depot=True)

    loc_extra = [
        {
            "id": loc.id,
            "name": loc.name,
            "baseDropRate": droprates.BASE_DROP_RATES.get(loc.name),
            "xpPerHit": (
                xp_per_hit_fishing if loc.type == "fishing" else xp_per_hit
            ).get(loc.name),
            "xpPerHitIronDepot": xp_per_hit_iron_depot.get(loc.name),
            "silverPerHit": (
                silver_per_hit_fishing if loc.type == "fishing" else silver_per_hit
            ).get(loc.name),
            "silverPerHitIronDepot": silver_per_hit_iron_depot.get(loc.name),
        }
        for loc in load_locations()
    ]
    return sorted(loc_extra, key=lambda l: l["id"])


def gen_tower():
    tower_data_path = Path(__file__) / ".." / ".." / "data" / "tower.txt"
    tower_data = tower_data_path.resolve().open("r").read()
    tower_re = re.compile(
        r"""
^Level
(?P<level>\d+)
You got:$
(?P<item1>[^(]+) \(x(?P<quantity1>[0-9,]+)\)
(?P<item2>[^(]+) \(x(?P<quantity2>[0-9,]+)\)
(?P<item3>[^(]+) \(x(?P<quantity3>[0-9,]+)\)$
    """.strip(),
        re.MULTILINE,
    )
    tower_items = []
    for md in tower_re.finditer(tower_data):
        level = int(md["level"])
        for i in range(1, 4):
            tower_items.append(
                {
                    "level": level,
                    "order": i,
                    "itemName": md[f"item{i}"],
                    "quantity": int(md[f"quantity{i}"].replace(",", "")),
                }
            )

    return tower_items


GEN_FIXTURES = {
    "drop_rates": gen_drop_rates,
    "drop_rates_gql": gen_drop_rates_gql,
    "item_drop_mode": gen_item_drop_mode,
    "questlines": gen_questlines,
    "quest_extra": gen_quest_extra,
    "wishing_well": gen_wishing_well,
    "locksmith_boxes": gen_locksmith_boxes,
    "locksmith_items": gen_locksmith_items,
    "location_extra": gen_location_extra,
    "tower": gen_tower,
}


def cmd_fixutres(gen: list[str] = []):
    data_root = Path(__file__) / ".." / ".." / "data"
    # No inputs means do all.
    if not gen:
        gen = list(GEN_FIXTURES.keys())
    for name in gen:
        fixture_path = data_root / f"{name}.json"
        fixture_data = GEN_FIXTURES[name]()
        json.dump(
            fixture_data,
            fixture_path.resolve().open("w"),
            indent=2,
            sort_keys=True,
        )


if __name__ == "__main__":
    import typer

    typer.run(cmd_fixutres)
