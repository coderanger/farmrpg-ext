import pytest
from simulator.items import Item
from simulator.locations import Location
from simulator.player import Player


def test_get():
    loc = Location.get("Forest")
    assert loc.type == "explore"
    assert "Antler" in loc.items


def test_get_missing():
    assert Location.get("Nope!") is None


def test_getitem():
    loc = Location["Forest"]
    assert loc.type == "explore"
    assert "Antler" in loc.items


def test_getitem_missing():
    with pytest.raises(KeyError):
        Location["Nope"]


@pytest.fixture
def forest() -> Location:
    return Location["Forest"]


@pytest.fixture
def large_island() -> Location:
    return Location["Large Island"]


def test_explore(player: Player, forest: Location):
    player.stamina = 100
    forest.explore(player)
    assert player.exploring_xp >= 125
    assert player.stamina == 99
    assert sum(player.inventory.values()) <= 1


def test_explore_bad_location(player: Player, large_island: Location):
    player.stamina = 100
    with pytest.raises(ValueError):
        large_island.explore(player)


def test_explore_no_stamina(player: Player, forest: Location):
    player.stamina = 0
    with pytest.raises(ValueError):
        forest.explore(player)


def test_explore_low_stamina(player: Player, forest: Location):
    player.stamina = 4
    player.exploring_effectiveness[forest] = 10
    forest.explore(player)
    assert player.stamina == 3


def test_explore_enough_stamina(player: Player, forest: Location):
    player.stamina = 100
    player.exploring_effectiveness[forest] = 10
    forest.explore(player)
    assert player.stamina == 90


def test_explore_shoes(player: Player, forest: Location):
    player.stamina = 100
    player.exploring_effectiveness[forest] = 10
    player.perks.add("Sprint Shoes I")
    player.perks.add("Sprint Shoes II")
    forest.explore(player)
    assert player.stamina == 60


def test_explore_drop(player: Player, forest: Location):
    player.max_inventory = 10000
    player.stamina = 10000
    player.exploring_effectiveness[forest] = 10000
    forest.explore(player)
    # Technically this could fail, but not likely.
    assert 1300 < player.inventory[Item["Wood"]] < 1600


def test_explore_wanderer(super_player: Player, forest: Location):
    super_player.stamina = 40000
    super_player.exploring_effectiveness[forest] = 10000
    forest.explore(super_player)
    assert 25000 < super_player.stamina < 28000


def test_lemonade(player: Player, forest: Location):
    player.inventory[Item["Lemonade"]] = 1
    player.exploring_xp = 0
    forest.lemonade(player)
    assert sum(player.inventory.values()) == 10
    assert player.inventory[Item["Lemonade"]] == 0
    assert player.exploring_xp > 0


def test_lemonade_bad_location(player: Player, large_island: Location):
    player.inventory[Item["Lemonade"]] = 1
    with pytest.raises(ValueError):
        large_island.lemonade(player)


def test_lemonade_none_available(player: Player, forest: Location):
    player.inventory[Item["Lemonade"]] = 0
    with pytest.raises(ValueError):
        forest.lemonade(player)


def test_net(player: Player, large_island: Location):
    player.inventory[Item["Fishing Net"]] = 1
    player.fishing_xp = 0
    large_island.net(player)
    assert sum(player.inventory.values()) == 10
    assert player.inventory[Item["Fishing Net"]] == 0
    assert player.fishing_xp > 0


def test_new_bad_location(player: Player, forest: Location):
    player.inventory[Item["Fishing Net"]] = 1
    with pytest.raises(ValueError):
        forest.net(player)


def test_new_none_available(player: Player, large_island: Location):
    player.inventory[Item["Fishing Net"]] = 0
    with pytest.raises(ValueError):
        large_island.net(player)
