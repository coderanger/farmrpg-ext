from __future__ import annotations

from typing import TYPE_CHECKING

import attrs

from .items import Item
from .xp import LevelProperty

if TYPE_CHECKING:
    from .game import Game
    from .player import Player


@attrs.define
class Sawmill:
    game: Game = attrs.field(repr=False)
    boards_per_hour: int = 0
    wood_per_hour: int = 0
    seconds_until_generate: int = 60 * 60

    def tick(self, seconds: int) -> None:
        self.seconds_until_generate -= seconds
        while self.seconds_until_generate <= 0:
            self.game.player.add_item(Item["Board"], self.boards_per_hour)
            self.game.player.add_item(Item["Wood"], self.wood_per_hour)
            self.seconds_until_generate += 60 * 60


@attrs.define
class HayField:
    game: Game = attrs.field(repr=False)
    straw_per_ten_minutes: int = 0
    seconds_until_generate: int = 60 * 10

    def tick(self, seconds: int) -> None:
        self.seconds_until_generate -= seconds
        while self.seconds_until_generate <= 0:
            self.game.player.add_item(Item["Straw"], self.straw_per_ten_minutes)
            self.seconds_until_generate += 60 * 10


@attrs.define
class Raptor:
    xp: int = 0
    can_pet: bool = True
    level = LevelProperty()

    def pet(self, player: Player) -> None:
        if not self.can_pet:
            raise ValueError("cannot pet right now")
        self.xp += 1700 if player.has_perk("Animal Lover") else 850
        self.can_pet = False

    def generate(self, player: Player) -> None:
        level = self.level
        if level >= 5:
            player.add_item(Item["Antler"], level * 10)
            player.add_item(Item["Steak Kabob"], level * 5)
        self.can_pet = True


@attrs.define
class RaptorPen:
    game: Game = attrs.field(repr=False)
    raptors: list[Raptor] = attrs.Factory(list)
    seconds_until_generate: int = 60 * 60 * 24

    @property
    def can_pet(self) -> bool:
        return any(raptor.can_pet for raptor in self.raptors)

    def pet_all(self) -> None:
        for raptor in self.raptors:
            if raptor.can_pet:
                raptor.pet(self.game.player)

    def tick(self, seconds: int) -> None:
        # If we have more eggs than raptors, add them here.
        for _ in range(
            self.game.player.inventory[Item["Raptor Egg"]] - len(self.raptors)
        ):
            self.raptors.append(Raptor())
        self.seconds_until_generate -= seconds
        while self.seconds_until_generate <= 0:
            for raptor in self.raptors:
                raptor.generate(self.game.player)
            self.seconds_until_generate += 60 * 60 * 24

    def _add_raptor(self, level=1, quantity=1) -> None:
        """Add a raptor for debugging-y things."""
        self.game.player.add_item(Item["Raptor Egg"], quantity)
        for _ in range(quantity):
            raptor = Raptor()
            raptor.level = level
            self.raptors.append(raptor)
