from __future__ import annotations

from typing import TYPE_CHECKING, Optional

import structlog

from ..locations import Location

if TYPE_CHECKING:
    from ..game import Game
    from ..items import Item


class AI:
    log: structlog.stdlib.BoundLogger = structlog.stdlib.get_logger(mod="ai")

    def __init__(self, game: Game):
        self.game = game

    def plant(self) -> Optional[Item]:
        """Decide what to plant next."""
        return None

    def fish(self) -> Optional[Location]:
        """Decide where to fish."""
        return None

    def explore(self) -> Optional[Location]:
        """Decide where to explore."""
        return None

    def process(self) -> None:
        """Handle all other per-tick logic."""
        return None

    def finish(self) -> None:
        """Do any cleanup before the end."""
        return None
