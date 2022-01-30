import pytest
from simulator.items import Item
from simulator.player import Player


def test_growth_time_for(player):
    item = Item(name="", id="", image="", growth_time=100)
    assert item.growth_time_for(player) == 100


def test_growth_time_for_all_perks(super_player):
    item = Item(name="", id="", image="", growth_time=100)
    assert item.growth_time_for(super_player) == 20


def test_growth_time_for_ungrowable(player: Player):
    assert Item["Wood"].growth_time_for(player) is None


def test_get():
    apple = Item.get("Apple")
    assert apple is not None
    assert apple.name == "Apple"
    assert apple.id == "44"


def test_get_missing():
    assert Item.get("Nope!") is None


def test_getitem():
    apple = Item["Apple"]
    assert apple.name == "Apple"
    assert apple.id == "44"


def test_getitem_missing():
    with pytest.raises(KeyError):
        Item["Nope"]


def test_craft_price_for(player: Player):
    assert Item["Fancy Pipe"].craft_price_for(player) == 150


def test_craft_price_for_all_perks(super_player: Player):
    assert Item["Fancy Pipe"].craft_price_for(super_player) == 60


def test_craft_price_for_uncraftable(player: Player):
    assert Item["Wood"].craft_price_for(player) is None
