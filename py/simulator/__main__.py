import logging

import structlog

from .ai import SillyAI
from .game import Game

DEBUG = True

if __name__ == "__main__":
    if not DEBUG:
        structlog.configure(
            wrapper_class=structlog.make_filtering_bound_logger(logging.INFO)
        )
    game = Game(ai_class=SillyAI)
    game.player.silver = 36
    game.run(60)
    print(game.summary())
