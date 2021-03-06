from __future__ import annotations

import json
import random
from pathlib import Path
from typing import TYPE_CHECKING, Mapping, Optional

import attrs
import structlog
from frozendict import frozendict

from .items import Item

if TYPE_CHECKING:
    from .player import Player


class _ItemPicker:
    """Helper class for the logic to pick a random item from a dict[str,float] rates bucket."""

    def __init__(self, rates: Mapping[str, float], allow_none: bool = False):
        # Copy the dict to be extra sure we get the population and weights in the same order.
        pairs = list(rates.items())
        self.items: list[Optional[Item]] = [Item[p[0]] for p in pairs]
        self.weights = [p[1] for p in pairs]
        if allow_none:
            # Deal with the chance to get nothing.
            self.items.append(None)
            self.weights.append(1 - sum(self.weights))

    def choices(self, k: int = 1) -> list[Item]:
        return [
            it
            for it in random.choices(self.items, weights=self.weights, k=k)
            if it is not None
        ]


# For some reason I don't understand, @classmethod doesn't work with operator methods.
class LocationMeta(type):
    @property
    def _all_locations(cls) -> dict[str, Location]:
        """Lazy load the location data."""
        if not hasattr(cls, "_all_locations_cache"):
            cls._all_locations_cache = {
                str(loc["name"]): cls(**loc)
                for loc in json.load(
                    Path(__file__)
                    .joinpath("..", "data", "locations.json")
                    .resolve()
                    .open()
                )
            }
        return cls._all_locations_cache

    def get(cls, name: str) -> Optional[Location]:
        return cls._all_locations.get(name)

    def __getitem__(cls, name: str) -> Location:
        return cls._all_locations[name]


@attrs.define(auto_attribs=True, frozen=True, cache_hash=True)
class Location(metaclass=LocationMeta):
    type: str
    name: str
    id: str
    items: tuple = attrs.field(default=tuple(), converter=tuple)
    explore_rates: frozendict[str, float] = attrs.field(
        default=frozendict(), converter=frozendict
    )
    lemonade_rates: frozendict[str, float] = attrs.field(
        default=frozendict(), converter=frozendict
    )
    net_rates: frozendict[str, float] = attrs.field(
        default=frozendict(), converter=frozendict
    )
    # Initialized below in __attrs_post_init__.
    _explore_picker: _ItemPicker = attrs.field(default=None, repr=False)
    _lemonade_picker: _ItemPicker = attrs.field(default=None, repr=False)
    _net_picker: _ItemPicker = attrs.field(default=None, repr=False)

    log: structlog.stdlib.BoundLogger = structlog.stdlib.get_logger(mod="location")

    def __attrs_post_init__(self):
        object.__setattr__(
            self, "_explore_picker", _ItemPicker(self.explore_rates, allow_none=True)
        )
        object.__setattr__(self, "_lemonade_picker", _ItemPicker(self.lemonade_rates))
        object.__setattr__(self, "_net_picker", _ItemPicker(self.net_rates))

    def explore(self, player: Player) -> list[Item]:
        if self.type != "explore":
            raise ValueError("can only explore in exploration locations")
        if player.stamina <= 0:
            raise ValueError("stamina is required for exploration")
        # Copy the game behavior re: stamina effectiveness
        effectiveness = player.exploring_effectiveness_for(self)
        if player.stamina < effectiveness:
            effectiveness = 1
        # Generate the items.
        found_items = self._explore_picker.choices(effectiveness)
        # XP is generated in a weird looping way, was an old bug upstream and left as an XP bonus.
        xp_bonus = 1 + player.perk_value(
            {
                "Exploring Primer": 0.1,
                "Exploring Primer II": 0.1,
                "Exploring Almanac": 0.1,
            }
        )
        wanderer_chance = player.perk_value(
            {
                "Wanderer I": 0.04,
                "Wanderer II": 0.07,
                "Wanderer III": 0.09,
                "Wanderer IV": 0.13,
            }
        )
        base_xp = round(125 * effectiveness * xp_bonus)
        stamina_used = 0
        for _ in range(effectiveness):
            if wanderer_chance == 0 or random.random() <= wanderer_chance:
                stamina_used += 1
        item_xp = round(sum(it.xp or 0 for it in found_items) * xp_bonus)
        self.log.debug(
            "Explored",
            location=self.name,
            effectiveness=effectiveness,
            items=f"[{', '.join(it.name for it in found_items)}]",
            base_xp=base_xp,
            item_xp=item_xp,
            stamina_used=stamina_used,
        )
        for item in found_items:
            player.add_item(item)
        player.exploring_xp += base_xp + item_xp
        player.stamina -= stamina_used
        player.stamina_used += stamina_used
        player.explore_count += effectiveness
        return found_items

    def lemonade(self, player: Player) -> list[Item]:
        if self.type != "explore":
            raise ValueError("can only use lemonade in exploration locations")
        if player.inventory[Item["Lemonade"]] < 1:
            raise ValueError("no lemonade to use")
        lemonade_items = 20 if player.has_perk("Lemon Squeezer") else 10
        found_items = self._lemonade_picker.choices(lemonade_items)
        # n.b. lemonade does not use XP bonus multipliers.
        base_xp = 5000
        item_xp = sum(it.xp or 0 for it in found_items)
        self.log.debug(
            "Used lemonade",
            location=self.name,
            items=f"[{', '.join(it.name for it in found_items)}]",
            base_xp=base_xp,
            item_xp=item_xp,
        )
        player.remove_item(Item["Lemonade"])
        for item in found_items:
            player.add_item(item)
        player.exploring_xp += base_xp + item_xp
        return found_items

    def net(self, player: Player) -> list[Item]:
        if self.type != "fishing":
            raise ValueError("can only use nets in fishing locations")
        if player.inventory[Item["Fishing Net"]] < 1:
            raise ValueError("no net to use")
        xp_bonus = 1 + player.perk_value(
            {
                "Fishing Primer": 0.1,
                "Fishing Primer II": 0.1,
                "Fishing Almanac": 0.1,
            }
        )
        net_items = 15 if player.has_perk("Reinforced Netting") else 10
        found_items = self._net_picker.choices(net_items)
        # This appears to be a non-linear setup. And I am only guessing for 1.0.
        base_xp = {1.0: 1075, 1.1: 1245, 1.2: 1350, 1.3: 1465}
        item_xp = round(sum(it.xp or 0 for it in found_items) * xp_bonus)
        self.log.debug(
            "Used net",
            location=self.name,
            items=f"[{', '.join(it.name for it in found_items)}]",
            base_xp=base_xp,
            item_xp=item_xp,
        )
        player.remove_item(Item["Fishing Net"])
        for item in found_items:
            player.add_item(item)
        player.fishing_xp += item_xp
        return found_items
