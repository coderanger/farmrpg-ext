from __future__ import annotations

import itertools
import random
from io import StringIO
from typing import TYPE_CHECKING, Iterator, Optional

import attrs
import structlog

from .items import Item
from .utils import format_number

if TYPE_CHECKING:
    from .game import Game
    from .player import Player


@attrs.define
class SteakMarket:
    game: Game = attrs.field(repr=False)
    steak_price: int = 0
    market_level: int = 0
    market_level_cycle: Iterator[int] = attrs.Factory(
        lambda: iter(itertools.cycle([0, 1, 2, 3, 2, 1]))
    )
    kabob_price: int = 0
    seconds_until_new_market_level: int = 0
    seconds_until_new_steak_price: int = 0
    seconds_until_new_kabob_price: int = 0

    # Statistics
    total_steaks_bought: int = 0
    total_steaks_sold: int = 0
    total_steaks_silver_spent: int = 0
    total_steaks_silver_received: int = 0
    total_kabobs_bought: int = 0
    total_kabobs_sold: int = 0
    total_kabobs_silver_spent: int = 0
    total_kabobs_silver_received: int = 0

    log: structlog.stdlib.BoundLogger = structlog.stdlib.get_logger(mod="steak_market")

    STEAK_PRICE_DELTA = [1_000, 2_500, 10_000, 25_000]

    # This is a guess from historical data.
    KABOB_HIGH_RANGE_CHANCE = 1 / 30

    # Real data as of 2022-02-16
    DAYS_IN_STABLE = [10, 10, 10, 10, 11, 10, 11, 12, 12]
    DAYS_IN_NON_STABLE = [
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        3,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        3,
        4,
        4,
        4,
        3,
        4,
        4,
        4,
        4,
        2,
        4,
        4,
        4,
        3,
        4,
        3,
        4,
        3,
        4,
        3,
        3,
        4,
        4,
        3,
        3,
        4,
    ]

    def __attrs_post_init__(self) -> None:
        self.tick(0)

    def tick(self, seconds: int) -> None:
        self.seconds_until_new_market_level -= seconds
        while self.seconds_until_new_market_level <= 0:
            # Advance the cycle.
            self.market_level = next(self.market_level_cycle)
            # Work out how long until the next. Until I have a better option, I'm using
            # sampling of real values.
            days = random.choice(
                self.DAYS_IN_STABLE
                if self.market_level == 0
                else self.DAYS_IN_NON_STABLE
            )
            self.log.debug(
                "New market level", market_level=self.market_level, days=days
            )
            self.seconds_until_new_market_level += 60 * 60 * 24 * days

        self.seconds_until_new_steak_price -= seconds
        while self.seconds_until_new_steak_price <= 0:
            delta = self.STEAK_PRICE_DELTA[self.market_level]
            self.steak_price = random.randint(50_000 - delta, 50_000 + delta)
            self.seconds_until_new_steak_price += 60 * 60 * 24
            self.log.debug(
                "New steak price",
                price=self.steak_price,
                market_level=self.market_level,
            )

        self.seconds_until_new_kabob_price -= seconds
        while self.seconds_until_new_kabob_price <= 0:
            high_range = random.random() < self.KABOB_HIGH_RANGE_CHANCE
            if high_range:
                self.kabob_price = random.randint(10_500, 12_500)
            else:
                self.kabob_price = random.randint(9_500, 10_500)
            self.seconds_until_new_kabob_price += 60 * 60
            self.log.debug("New kabob price", price=self.kabob_price)

    def summary(self) -> str:
        if self.total_steaks_bought == 0 and self.total_kabobs_bought == 0:
            # Don't print if it wasn't used.
            return ""
        out = StringIO()
        out.write("\n")
        out.write("Steak Market\n")
        out.write("============\n")
        out.write(
            f"Bought: steak={self.total_steaks_bought} kabob={self.total_kabobs_bought}\n"
        )
        out.write(
            f"Sold: steak={self.total_steaks_sold} kabob={self.total_kabobs_sold}\n"
        )
        steak_profit = (
            self.total_steaks_silver_received - self.total_steaks_silver_spent
        )
        kabob_profit = (
            self.total_kabobs_silver_received - self.total_kabobs_silver_spent
        )
        total_profit = steak_profit + kabob_profit
        out.write(
            f"Profit: steak={format_number(steak_profit)} ({steak_profit * 100 / total_profit:.2f}%) "
            f"kabob={format_number(kabob_profit)} ({kabob_profit * 100 / total_profit:.2f}%)\n"
        )
        return out.getvalue()

    def _buy(
        self, item: Item, price: int, player: Player, quantity: Optional[int] = None
    ) -> int:
        if quantity is None:
            quantity = min(player.silver // price, player.max_inventory)
        quantity = min(quantity, player.max_inventory - player.inventory[item])
        if quantity == 0:
            # Can't buy any.
            return 0
        if player.silver < quantity * price:
            raise ValueError("insufficent silver")
        player.silver -= quantity * price
        player.add_item(item, quantity)
        self.log.debug(
            f"Buying {item.name}", item=item.name, price=price, quantity=quantity
        )
        return quantity

    def buy_steaks(self, player: Player, quantity: Optional[int] = None) -> None:
        quantity = self._buy(Item["Steak"], self.steak_price, player, quantity)
        self.total_steaks_bought += quantity
        self.total_steaks_silver_spent += quantity * self.steak_price

    def buy_kabobs(self, player: Player, quantity: Optional[int] = None) -> None:
        quantity = self._buy(Item["Steak Kabob"], self.kabob_price, player, quantity)
        self.total_kabobs_bought += quantity
        self.total_kabobs_silver_spent += quantity * self.kabob_price

    def _sell(
        self, item: Item, price: int, player: Player, quantity: Optional[int] = None
    ) -> int:
        if quantity is None:
            quantity = player.inventory[item]
        if quantity == 0:
            # None to sell.
            return 0
        player.remove_item(item, quantity)
        player.silver += price * quantity
        self.log.debug(
            f"Selling {item.name}", item=item.name, price=price, quantity=quantity
        )
        return quantity

    def sell_steaks(self, player: Player, quantity: Optional[int] = None) -> None:
        quantity = self._sell(Item["Steak"], self.steak_price, player, quantity)
        self.total_steaks_sold += quantity
        self.total_steaks_silver_received += quantity * self.steak_price

    def sell_kabobs(self, player: Player, quantity: Optional[int] = None) -> None:
        quantity = self._sell(Item["Steak Kabob"], self.kabob_price, player, quantity)
        self.total_kabobs_sold += quantity
        self.total_kabobs_silver_received += quantity * self.kabob_price
