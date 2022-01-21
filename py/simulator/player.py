from __future__ import annotations

from collections import Counter
from numbers import Number
from typing import TYPE_CHECKING, Optional, TypeVar

import attrs
import structlog

if TYPE_CHECKING:
    from .game import Game
    from .items import Item


PerkValue = TypeVar("PerkValue", bound=Number)


@attrs.define
class Player:
    game: Game = attrs.field(repr=False)
    # Basics.
    silver: int = 0
    farming_xp: int = 0
    fishing_xp: int = 0
    crafting_xp: int = 0
    exploring_xp: int = 0
    inventory: Counter[Item, int] = attrs.field(factory=Counter, converter=Counter)
    max_inventory: int = 100
    stamina: int = 0
    max_stamina: int = 100
    perks: set[str] = attrs.Factory(set)
    has_all_perks: bool = False
    # Tracking stuff.
    overflow_items: Counter[Item, int] = attrs.field(factory=Counter, converter=Counter)
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

    def perk_value(self, perks: dict[str, PerkValue]) -> PerkValue:
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
        self.silver += silver
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
