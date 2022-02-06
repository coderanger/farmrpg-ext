from __future__ import annotations

from io import StringIO
from typing import Optional

import attrs
import structlog

from .ai import AI
from .buildings import HayField, RaptorPen, Sawmill
from .farm import Farm
from .player import Player
from .utils import format_number


def SelfFactory(type: type):
    return attrs.Factory(lambda self: type(game=self), takes_self=True)


@attrs.define
class Game:
    player: Player = SelfFactory(Player)
    farm: Farm = SelfFactory(Farm)
    sawmill: Sawmill = SelfFactory(Sawmill)
    hay_field: HayField = SelfFactory(HayField)
    raptor_pen: RaptorPen = SelfFactory(RaptorPen)
    ai_class: Optional[type] = None
    ai: Optional[AI] = None

    log: structlog.stdlib.BoundLogger = structlog.stdlib.get_logger(mod="farm")

    def __attrs_post_init__(self):
        if self.ai is None and self.ai_class is not None:
            self.ai = self.ai_class(self)

    def tick(self, seconds: int) -> None:
        self.player.tick(seconds)
        self.farm.tick(seconds)
        self.sawmill.tick(seconds)
        self.hay_field.tick(seconds)
        self.raptor_pen.tick(seconds)

    def process_ai(self):
        if self.ai is None:
            return
        if self.farm.can_harvest:
            self.log.debug("AI harvest")
            self.farm.harvest_all()
        if self.farm.can_plant:
            seed = self.ai.plant()
            if seed is not None:
                self.log.debug("AI plant", seed=seed.name)
                self.farm.plant_all(seed)
        if self.raptor_pen.can_pet:
            self.raptor_pen.pet_all()
        while self.player.can_fish:
            loc = self.ai.fish()
            if loc is not None:
                self.log.debug("AI fish", location=loc.name)
                items = loc.net(self.player)
                self.player.sell_all(items)
            else:
                break
        while self.player.can_explore:
            loc = self.ai.explore()
            if loc is not None:
                self.log.debug("AI explore", location=loc.name)
                loc.explore(self.player)
            else:
                break
        self.ai.process()

    def run(self, iterations: int = 60, interval: int = 60) -> None:
        """Run a simulation for the given number of iterations."""
        # ???: Should this run for a given length of simulated time instead?
        for _ in range(iterations):
            self.log.debug(
                "AI state", silver=self.player.silver, stamina=self.player.stamina
            )
            self.process_ai()
            self.tick(interval)

    def summary(self) -> str:
        """Render a string summary of the game state."""
        out = StringIO()
        out.write(f"Silver: {format_number(self.player.silver)}\n")
        out.write(f"Stamina Used: {self.player.stamina_used}\n")
        out.write(f"Explore Count: {self.player.explore_count}\n")
        out.write("Inventory:\n")
        for item, count in self.player.inventory.items():
            out.write(f"\t{item.name}: {count}\n")
        out.write("Overflow:\n")
        for item, count in self.player.overflow_items.items():
            out.write(f"\t{item.name}: {count}\n")
        return out.getvalue()
