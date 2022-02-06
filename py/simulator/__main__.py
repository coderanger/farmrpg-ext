import logging

import structlog
import typer

from .ai import get_ai
from .game import Game
from .utils import format_number, parse_time


def player_baseline(game: Game) -> None:
    """A blank setup, as if they had just started."""
    pass


def player_low(game: Game) -> None:
    """A few days or weeks into playing."""
    game.player.max_inventory = 210
    game.sawmill.boards_per_hour = 150
    game.sawmill.wood_per_hour = 80
    game.player.perks.update(
        [
            "Negotiator I",
            "Negotiator II",
            "Quicker Farming I",
            "Wanderer I",
            "Wanderer II",
            "Wanderer III",
            "Fertilizer I",
        ]
    )


def player_mid(game: Game) -> None:
    """Maybe two months of casual play."""
    game.player.max_inventory = 600
    game.sawmill.boards_per_hour = 200
    game.sawmill.wood_per_hour = 175
    game.hay_field.straw_per_ten_minutes = 200
    game.player.perks.update(
        [
            "Negotiator I",
            "Negotiator II",
            "Negotiator III",
            "Quicker Farming I",
            "Quicker Farming II",
            "Wanderer I",
            "Wanderer II",
            "Wanderer III",
            "Wanderer IV",
            "Fertilizer I",
            "Reinforced Netting",
        ]
    )
    game.raptor_pen._add_raptor(level=6, quantity=3)
    game.raptor_pen._add_raptor(level=5, quantity=1)
    game.raptor_pen._add_raptor(level=1, quantity=1)


def player_high(game: Game) -> None:
    """Late game player."""
    game.player.has_all_perks = True
    game.player.max_inventory = 2000
    game.sawmill.boards_per_hour = 1000
    game.sawmill.wood_per_hour = 1000
    game.hay_field.straw_per_ten_minutes = 300
    game.raptor_pen._add_raptor(level=10, quantity=20)


PLAYERS = {
    "baseline": player_baseline,
    "low": player_low,
    "mid": player_mid,
    "high": player_high,
}


STARTER_SILVER = 1_000_000


def simulator(
    ai: str,
    player: str,
    verbose: bool = False,
    time: str = "7d",
    summary: bool = False,
    seconds: bool = False,  # Run with 1 second ticks instead of 1 minute.
):
    if not verbose:
        structlog.configure(
            wrapper_class=structlog.make_filtering_bound_logger(logging.INFO)
        )
    log = structlog.get_logger(mod="main")
    tick_length = 1 if seconds else 60
    ticks = parse_time(time, tick_length)
    log.info(
        "Starting simulation",
        ticks=ticks,
        tick_length=tick_length,
        ai=ai,
        player=player,
    )
    game = Game(ai_class=get_ai(ai))
    PLAYERS[player](game)
    game.player.silver += STARTER_SILVER
    game.run(ticks, tick_length)
    game.player.silver -= STARTER_SILVER
    if summary:
        print(game.summary())
    hours = (ticks * tick_length) / (60 * 60)
    print(
        f"Profit: {format_number(game.player.silver)} ({format_number(game.player.silver/hours)}/hour)"
    )


if __name__ == "__main__":
    typer.run(simulator)
