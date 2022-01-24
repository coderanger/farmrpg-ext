from __future__ import annotations

from collections import Counter
from typing import TYPE_CHECKING, Literal, Optional, TypeVar

import attrs
import structlog

from .items import Item

if TYPE_CHECKING:
    from .game import Game
    from .locations import Location


PerkValue = TypeVar("PerkValue", int, float)


@attrs.define
class Player:
    game: Game = attrs.field(repr=False)
    # Basics.
    silver: int = 0
    farming_xp: int = 0
    fishing_xp: int = 0
    crafting_xp: int = 0
    exploring_xp: int = 0
    inventory: Counter[Item] = attrs.field(factory=Counter, converter=Counter)
    max_inventory: int = 100
    stamina: int = 0
    max_stamina: int = 100
    perks: set[str] = attrs.Factory(set)
    has_all_perks: bool = False
    exploring_effectiveness: dict[Location, int] = attrs.Factory(dict)
    # Tracking stuff.
    overflow_items: Counter[Item] = attrs.field(factory=Counter, converter=Counter)
    seconds_until_stamina: int = 120

    log: structlog.stdlib.BoundLogger = structlog.stdlib.get_logger(mod="player")

    def tick(self, seconds: int) -> None:
        self.seconds_until_stamina -= seconds
        while self.seconds_until_stamina <= 0:
            if self.stamina < self.max_stamina:
                self.log.debug("Generating stamina")
                self.stamina += 4
                if self.has_perk("Energy Drink"):
                    self.stamina += 4
            self.seconds_until_stamina += 120

    def add_item(self, item: Item, quantity: int = 1) -> int:
        self.inventory[item] += quantity
        if self.inventory[item] > self.max_inventory:
            self.overflow_items[item] += self.inventory[item] - self.max_inventory
            self.inventory[item] = self.max_inventory
        return self.inventory[item]

    def remove_item(self, item: Item, quantity: int = 1) -> int:
        if self.inventory[item] < quantity:
            raise ValueError(
                f"Cannot remove {quantity} of {item}, you only have {self.inventory[item]}"
            )
        self.inventory[item] -= quantity
        after_quantity = self.inventory[item]
        if after_quantity <= 0:
            # To keep the inventory tidy, make tests cleaner.
            del self.inventory[item]
        return after_quantity

    def has_perk(self, perk: str) -> bool:
        # TODO validate perk names so I can catch typos.
        return self.has_all_perks or perk in self.perks

    def perk_value(self, perks: dict[str, PerkValue]) -> PerkValue | Literal[0]:
        """Handle the very common case of needing to sum multiple values from different perks."""
        return sum(value for perk, value in perks.items() if self.has_perk(perk))

    def sell_item(self, item: Item, quantity: Optional[int] = None) -> None:
        if not item.sell_price:
            raise ValueError(f"{item.name} cannot be sold")
        if quantity is None:
            # Max sell by default.
            quantity = self.inventory[item]
        sell_bonus = self.perk_value(
            {
                "Negotiator I": 0.05,
                "Negotiator II": 0.1,
                "Negotiator III": 0.15,
                "Negotiator IV": 0.20,
                "Fertilizer I": 0.1,
            }
        )
        silver = quantity * item.sell_price * (1 + sell_bonus)
        # This check we have enough of the item.
        self.remove_item(item, quantity)
        self.silver += round(silver)
        self.log.debug("Selling item", item=item.name, quantity=quantity, silver=silver)

    def buy_item(self, item: Item, quantity: Optional[int] = None) -> None:
        if not item.buy_price:
            raise ValueError(f"{item.name} cannot be bought")
        if quantity is None:
            # Fill inventory.
            quantity = self.max_inventory - self.inventory[item]
        silver = quantity * item.buy_price
        if self.silver < silver:
            raise ValueError(f"cannot afford {quantity} of {item.name}")
        self.silver -= silver
        self.add_item(item, quantity)
        self.log.debug("Buying item", item=item.name, quantity=quantity, silver=silver)

    def exploring_effectiveness_for(self, location: Location) -> int:
        multiplier = 1
        if self.has_perk("Sprint Shoes I"):
            multiplier *= 2
        if self.has_perk("Sprint Shoes II"):
            multiplier *= 2
        return self.exploring_effectiveness.get(location, 1) * multiplier

    def items_needed_to_craft(self, item: Item) -> dict[Item, int]:
        """Return how many of each direct ingredient are not currently available."""
        if not item.recipe:
            raise ValueError(f"{item.name} is not craftable")
        needed: dict[Item, int] = {}
        for name, quantity in item.recipe.items():
            ingredient = Item[name]
            ingredient_needed = quantity - self.inventory[ingredient]
            if ingredient_needed > 0:
                needed[ingredient] = ingredient_needed
        return needed

    def craft(self, item: Item) -> None:
        if item.craft_price is None:
            raise ValueError(f"{item.name} is not craftable")
        needed = self.items_needed_to_craft(item)
        if needed:
            raise ValueError(f"{item.name} is missing ingredients: {needed}")
        price_reduction = self.perk_value(
            {
                "Artisan I": 0.05,
                "Artisan II": 0.1,
                "Artisan III": 0.15,
                "Artisan IV": 0.2,
                "Toolbox I": 0.1,
            }
        )
        craft_price = round(item.craft_price * (1 - price_reduction))
        if self.silver < craft_price:
            raise ValueError("not enough silver")
        xp_bonus = self.perk_value(
            {
                "Crafting Primer": 0.1,
                "Crafting Primer II": 0.1,
                "Crafting Almanac": 0.1,
            }
        )
        xp = round(item.xp * (1 + xp_bonus))
        self.log.debug("Crafting", item=item, price=craft_price, xp=xp)
        for name, quantity in item.recipe.items():
            self.remove_item(Item[name], quantity)
        self.silver -= craft_price
        self.add_item(item)
        self.crafting_xp += xp
