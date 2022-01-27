import itertools
from collections import Counter
from typing import Any

import _pytest.config
import pytest
from _pytest.assertion import util
from simulator.farm import Farm
from simulator.game import Game
from simulator.items import Item
from simulator.player import Player


@pytest.fixture
def game() -> Game:
    return Game()


@pytest.fixture
def player(game: Game) -> Player:
    return game.player


@pytest.fixture
def super_player(player: Player) -> Player:
    player.has_all_perks = True
    return player


@pytest.fixture
def farm(game: Game) -> Farm:
    return game.farm


def pytest_assertrepr_compare(
    config: _pytest.config.Config, op: str, left: Any, right: Any
):
    if (
        isinstance(left, dict)
        and isinstance(right, dict)
        and op == "=="
        and all(
            isinstance(key, Item) for key in itertools.chain(left.keys(), right.keys())
        )
    ):
        left = {it.name: q for it, q in left.items()}
        right = {it.name: q for it, q in right.items()}
        return util.assertrepr_compare(config=config, op=op, left=left, right=right)
