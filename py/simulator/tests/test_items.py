import pytest
from simulator.items import Item


def test_growth_time_for(player):
    item = Item(name="", id="", image="", growth_time=100)
    assert item.growth_time_for(player) == pytest.approx(100)


def test_growth_time_for_all_perks(super_player):
    item = Item(name="", id="", image="", growth_time=100)
    assert item.growth_time_for(super_player) == pytest.approx(20)


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
