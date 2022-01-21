from ..items import Item
from .base import AI


class SillyAI(AI):
    """A nonsensical AI used for testing and development."""

    def plant(self) -> Item:
        self.game.player.sell_item(Item["Peppers"])
        self.game.player.buy_item(Item["Pepper Seeds"], self.game.farm.crop_plots)
        return Item["Pepper Seeds"]
