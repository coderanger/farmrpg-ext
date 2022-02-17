from typing import Optional

from ..items import Item
from ..locations import Location
from .base import AI


class FisherAI(AI):
    """An AI that makes nets and does fishing."""

    def fish(self) -> Optional[Location]:
        return Location["Large Island"]

    def explore(self) -> Optional[Location]:
        return Location["Forest"]

    def process(self) -> None:
        self.game.player.buy_item(Item["Iron"])
        while self.game.player.can_craft(Item["Twine"]):
            self.game.player.craft(Item["Twine"])
        while self.game.player.can_craft(Item["Rope"]):
            self.game.player.craft(Item["Rope"])
        while self.game.player.can_craft(Item["Fishing Net"]):
            self.game.player.craft(Item["Fishing Net"])
