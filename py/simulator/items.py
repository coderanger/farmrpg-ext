from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Optional

import attrs
from frozendict import frozendict

if TYPE_CHECKING:
    from .player import Player


# For some reason I don't understand, @classmethod doesn't work with operator methods.
class ItemMeta(type):
    @property
    def _all_items(cls) -> dict[str, Item]:
        """Lazy load the item data."""
        if not hasattr(cls, "_all_items_cache"):
            cls._all_items_cache = {
                it["name"]: cls(**it)
                for it in json.load(
                    Path(__file__).joinpath("..", "data", "items.json").resolve().open()
                )
            }
        return cls._all_items_cache

    def get(cls, name: str) -> Optional[Item]:
        return cls._all_items.get(name)

    def __getitem__(cls, name: str) -> Item:
        return cls._all_items[name]


@attrs.define(auto_attribs=True, frozen=True, cache_hash=True)
class Item(metaclass=ItemMeta):
    name: str
    id: str
    image: str
    recipe: frozendict[str, int] = attrs.field(
        default=frozendict(), converter=frozendict
    )
    sell_price: Optional[int] = None
    buy_price: Optional[int] = None
    craft_price: Optional[int] = None
    growth_time: Optional[int] = None
    givable: bool = False
    rarity: Optional[str] = None
    xp: int = 0
    flea_market: bool = False
    mastery: bool = False
    event: bool = False
    first_seen: Optional[int] = None

    def growth_time_for(self, player: Player) -> Optional[int]:
        if self.growth_time is None:
            return None
        discount = player.perk_value(
            {
                "Quicker Farming I": 0.05,
                "Quicker Farming II": 0.1,
                "Quicker Farming III": 0.15,
                "Quicker Farming IV": 0.2,
                "Irrigation System I": 0.1,
                "Irrigation System II": 0.2,
            }
        )
        return round(self.growth_time * (1 - discount))

    def craft_price_for(self, player: Player) -> Optional[int]:
        if self.craft_price is None:
            return None
        discount = player.perk_value(
            {
                "Artisan I": 0.05,
                "Artisan II": 0.1,
                "Artisan III": 0.15,
                "Artisan IV": 0.2,
                "Toolbox I": 0.1,
            }
        )
        return round(self.craft_price * (1 - discount))
