import pytest
from simulator.farm import Farm
from simulator.game import Game
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
