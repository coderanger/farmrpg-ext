from __future__ import annotations

from typing import TYPE_CHECKING

import structlog


if TYPE_CHECKING:
    from ..game import Game
    from ..items import Item


class AI:
    log: structlog.stdlib.BoundLogger = structlog.stdlib.get_logger(mod="ai")

    def __init__(self, game: Game):
        self.game = game

    def plant(self) -> Item:
        """Decide what to plant next."""
        raise NotImplementedError
