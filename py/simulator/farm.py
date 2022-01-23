from __future__ import annotations

import random
from typing import TYPE_CHECKING

import attrs
import structlog

from .items import Item

if TYPE_CHECKING:
    from .game import Game


# Map seeds to crops.
SEEDS_TO_CROPS = {
    Item["Pepper Seeds"]: Item["Peppers"],
    Item["Carrot Seeds"]: Item["Carrot"],
    Item["Pea Seeds"]: Item["Peas"],
    Item["Cucumber Seeds"]: Item["Cucumber"],
    Item["Eggplant Seeds"]: Item["Eggplant"],
    Item["Radish Seeds"]: Item["Radish"],
    Item["Onion Seeds"]: Item["Onion"],
    Item["Hops Seeds"]: Item["Hops"],
    Item["Potato Seeds"]: Item["Potato"],
    Item["Tomato Seeds"]: Item["Tomato"],
    Item["Leek Seeds"]: Item["Leek"],
    Item["Watermelon Seeds"]: Item["Watermelon"],
    Item["Corn Seeds"]: Item["Corn"],
    Item["Cabbage Seeds"]: Item["Cabbage"],
    Item["Pine Seeds"]: Item["Pine Tree"],
    Item["Pumpkin Seeds"]: Item["Pumpkin"],
    Item["Wheat Seeds"]: Item["Wheat"],
    Item["Mushroom Spores"]: Item["Mushroom"],
    Item["Broccoli Seeds"]: Item["Broccoli"],
    Item["Cotton Seeds"]: Item["Cotton"],
    Item["Sunflower Seeds"]: Item["Sunflower"],
    Item["Beet Seeds"]: Item["Beet"],
}


@attrs.define
class FarmPlot:
    crop: Item
    seconds_until_ready: int


@attrs.define
class Farm:
    game: Game = attrs.field(repr=False)
    crop_rows: int = 1
    plots: dict[int, FarmPlot] = attrs.Factory(dict)

    log: structlog.stdlib.BoundLogger = structlog.stdlib.get_logger(mod="farm")

    @property
    def crop_plots(self) -> int:
        return self.crop_rows * 4

    def tick(self, seconds: int) -> None:
        for plot in self.plots.values():
            plot.seconds_until_ready -= seconds

    def plant(self, plot: int, seed: Item) -> None:
        if plot < 0 or plot >= self.crop_plots:
            raise ValueError(f"plot {plot} is out of range")
        if plot in self.plots:
            raise ValueError(f"plot {plot} is already planted")
        crop = SEEDS_TO_CROPS[seed]
        self.log.debug("Planting", plot=plot, seed=seed.name, crop=crop.name)
        self.game.player.remove_item(seed)
        self.plots[plot] = FarmPlot(
            crop=crop, seconds_until_ready=seed.growth_time_for(self.game.player)
        )
        # TODO xp bonus
        self.game.player.farming_xp += 15

    def harvest(self, plot: int) -> None:
        if plot < 0 or plot >= self.crop_plots:
            raise ValueError(f"plot {plot} is out of range")
        if plot not in self.plots:
            raise ValueError(f"plot {plot} is not planted")
        if self.plots[plot].seconds_until_ready > 0:
            raise ValueError(f"plot {plot} is not ready")
        double_chance = self.game.player.perk_value(
            {
                "Double Prizes I": 0.15,
                "Double Prizes II": 0.25,
                "TEST Double Prizes": 1,
            }
        )
        # Special case for Mushroom Spores
        base_quantity = 10 if self.plots[plot].crop == Item["Mushroom"] else 1
        quantity = (
            base_quantity * 2 if random.random() <= double_chance else base_quantity
        )
        plot_data = self.plots.pop(plot)
        self.log.debug(
            "Harvesting", plot=plot, crop=plot_data.crop.name, quantity=quantity
        )
        self.game.player.add_item(plot_data.crop, quantity)
        # No matter how many items were produced, XP is based on just one.
        # TODO xp bonus
        self.game.player.farming_xp += plot_data.crop.xp

    def plant_all(self, seed: Item) -> None:
        for plot in range(self.crop_plots):
            if plot not in self.plots and self.game.player.inventory[seed] > 0:
                self.plant(plot, seed)

    def harvest_all(self) -> None:
        for plot in range(self.crop_plots):
            if plot in self.plots and self.plots[plot].seconds_until_ready <= 0:
                self.harvest(plot)

    @property
    def can_plant(self) -> bool:
        """Return true if there are any open plots for planting."""
        return any(plot not in self.plots for plot in range(self.crop_plots))

    @property
    def can_harvest(self) -> bool:
        """Return true if any plots are ready for harvest."""
        return any(plot.seconds_until_ready <= 0 for plot in self.plots.values())
