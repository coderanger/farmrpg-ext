import logging

import structlog
import typer

from .ai import get_ai
from .game import Game


def simulator(
    ai: str,
    verbose: bool = False,
    ticks: int = 60 * 60,
    silver: int = 1000000,
    perks: bool = False,
):
    if not verbose:
        structlog.configure(
            wrapper_class=structlog.make_filtering_bound_logger(logging.INFO)
        )
    game = Game(ai_class=get_ai(ai))
    game.player.silver = silver
    game.player.has_all_perks = perks
    game.run(ticks)
    game.player.silver -= silver
    print(game.summary())


if __name__ == "__main__":
    typer.run(simulator)
