import itertools
import json
import re
from pathlib import Path
from typing import Iterable, Optional

import attrs

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


if __name__ == "__main__":
    import droprates

    items_by_name = {it.name: it for it in load_items()}

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

    location_keys = set(
        itertools.chain(
            normal_drops.locations.keys(),
            iron_depot_drops.locations.keys(),
            manual_fish_drops.locations.keys(),
        )
    )

    drops_from = {}
    for drops in [normal_drops, iron_depot_drops, manual_fish_drops]:
        for _, item, item_drops in drops.items:
            drops_from[items_by_name[item].id] = droprates.mode_for_drops(item_drops)[0]

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

    drop_rates_path = Path(__file__) / ".." / ".." / "data" / "drop_rates.json"
    json.dump(drop_rates, drop_rates_path.resolve().open("w"), indent=2, sort_keys=True)

    # Build a secondary fixture for Gatsby's GraphQL layer.
    drop_rates_gql = []
    for rate_type, drops in [
        ("normal", normal_drops),
        ("iron_depot", iron_depot_drops),
        ("manual_fishing", manual_fish_drops),
    ]:
        for location, loc_drops in drops.locations.items():
            for item, item_drops in loc_drops.items.items():
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
    drop_rates_gql_path = Path(__file__) / ".." / ".." / "data" / "drop_rates_gql.json"
    json.dump(
        drop_rates_gql,
        drop_rates_gql_path.resolve().open("w"),
        indent=2,
        sort_keys=True,
    )

    # A tiny fixture for picking which set of drop rates to use for a given item.
    item_drop_mode_path = Path(__file__) / ".." / ".." / "data" / "item_drop_mode.json"
    json.dump(
        [
            {"id": item_id, "dropMode": drop_mode}
            for item_id, drop_mode in drops_from.items()
        ],
        item_drop_mode_path.resolve().open("w"),
        indent=2,
        sort_keys=True,
    )
