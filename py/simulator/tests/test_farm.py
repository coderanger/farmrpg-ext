import pytest
from simulator.items import Item


def test_plant(player, farm):
    player.inventory = {Item["Pepper Seeds"]: 1}
    farm.plant(0, Item["Pepper Seeds"])
    assert 0 in farm.plots
    assert player.farming_xp == 15
    assert player.inventory == {}


def test_plant_missing_seeds(farm):
    with pytest.raises(ValueError):
        farm.plant(0, Item["Pepper Seeds"])


def test_plant_negative(player, farm):
    player.inventory = {Item["Pepper Seeds"]: 1}
    with pytest.raises(ValueError):
        farm.plant(-1, Item["Pepper Seeds"])


def test_plant_bad_row(player, farm):
    player.inventory = {Item["Pepper Seeds"]: 1}
    with pytest.raises(ValueError):
        farm.plant(100, Item["Pepper Seeds"])


def test_plant_twice(player, farm):
    player.inventory = {Item["Pepper Seeds"]: 2}
    farm.plant(0, Item["Pepper Seeds"])
    with pytest.raises(ValueError):
        farm.plant(0, Item["Pepper Seeds"])


def test_harvest(player, farm):
    player.inventory = {Item["Pepper Seeds"]: 1}
    farm.plant(0, Item["Pepper Seeds"])
    farm.tick(60)
    farm.harvest(0)
    assert player.inventory == {Item["Peppers"]: 1}
    assert player.farming_xp == 25


def test_harvest_double(super_player, farm):
    super_player.inventory = {Item["Pepper Seeds"]: 1}
    farm.plant(0, Item["Pepper Seeds"])
    farm.tick(60)
    farm.harvest(0)
    assert super_player.inventory == {Item["Peppers"]: 2}
    assert super_player.farming_xp == 25


def test_harvest_mushrooms(player, farm):
    player.inventory = {Item["Mushroom Spores"]: 1}
    farm.plant(0, Item["Mushroom Spores"])
    farm.tick(60 * 90)
    farm.harvest(0)
    assert player.inventory == {Item["Mushroom"]: 10}
    assert player.farming_xp == 25


def test_harvest_unplanted(player, farm):
    with pytest.raises(ValueError):
        farm.harvest(0)
    assert player.inventory == {}


def test_plant_all(player, farm):
    player.inventory = {Item["Pepper Seeds"]: 3}
    farm.plant_all(Item["Pepper Seeds"])
    assert 0 in farm.plots
    assert 1 in farm.plots
    assert 2 in farm.plots
    assert 3 not in farm.plots
    assert player.farming_xp == 45
    assert player.inventory == {}


def test_harvest_all(player, farm):
    player.inventory = {Item["Pepper Seeds"]: 3}
    farm.plant_all(Item["Pepper Seeds"])
    farm.tick(60)
    farm.harvest_all()
    assert player.inventory == {Item["Peppers"]: 3}
