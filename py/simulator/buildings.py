from __future__ import annotations

from typing import TYPE_CHECKING

import attrs

from .items import Item

if TYPE_CHECKING:
    from .game import Game


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

    # def generate(self, game: Game) -> None:


@attrs.define
class RaptorPen:
    raptors: list[Raptor] = attrs.Factory(list)
    seconds_until_generate: int = 60 * 10
