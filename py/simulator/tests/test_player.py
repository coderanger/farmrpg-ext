import pytest
from simulator.items import Item
from simulator.player import Player


def test_add_inventory(player: Player):
    player.max_inventory = 100
    player.add_item(Item["Wood"])
    assert player.inventory[Item["Wood"]] == 1
    assert player.overflow_items[Item["Wood"]] == 0


def test_add_inventory_overflow(player: Player):
    player.max_inventory = 100
    player.add_item(Item["Wood"], 300)
    assert player.inventory[Item["Wood"]] == 100
    assert player.overflow_items[Item["Wood"]] == 200


def test_remove_inventory(player: Player):
    player.inventory[Item["Wood"]] = 10
    player.remove_item(Item["Wood"])
    assert player.inventory[Item["Wood"]] == 9


def test_remove_inventory_underflow(player: Player):
    with pytest.raises(ValueError):
        player.remove_item(Item["Wood"])


def test_stamina(player: Player):
    assert player.stamina == 0
    player.tick(60 * 10)
    assert player.stamina == 20


def test_stamina_energy_drink(super_player: Player):
    assert super_player.stamina == 0
    super_player.tick(60 * 10)
    assert super_player.stamina == 40


def test_items_needed_to_craft(player: Player):
    needed = player.items_needed_to_craft(Item["Fancy Pipe"])
    assert needed == {Item["Iron"]: 1, Item["Wood"]: 2, Item["Iron Ring"]: 3}


def test_items_needed_to_craft_partial(player: Player):
    player.inventory[Item["Wood"]] = 2
    player.inventory[Item["Iron Ring"]] = 2
    needed = player.items_needed_to_craft(Item["Fancy Pipe"])
    assert needed == {Item["Iron"]: 1, Item["Iron Ring"]: 1}


def test_items_needed_to_craft_over(player: Player):
    player.inventory[Item["Iron"]] = 2
    player.inventory[Item["Wood"]] = 2
    player.inventory[Item["Iron Ring"]] = 5
    needed = player.items_needed_to_craft(Item["Fancy Pipe"])
    assert needed == {}


def test_items_needed_to_craft_multi(player: Player):
    needed = player.items_needed_to_craft(Item["Fancy Pipe"], 3)
    assert needed == {Item["Iron"]: 3, Item["Wood"]: 6, Item["Iron Ring"]: 9}


def test_items_needed_to_craft_multi_partial(player: Player):
    player.inventory[Item["Wood"]] = 4
    player.inventory[Item["Iron Ring"]] = 4
    needed = player.items_needed_to_craft(Item["Fancy Pipe"], 2)
    assert needed == {Item["Iron"]: 2, Item["Iron Ring"]: 2}


def test_craft(player: Player):
    player.inventory[Item["Iron"]] = 1
    player.inventory[Item["Wood"]] = 2
    player.inventory[Item["Iron Ring"]] = 3
    player.silver = 150
    player.craft(Item["Fancy Pipe"])
    assert player.inventory == {Item["Fancy Pipe"]: 1}
    assert player.silver == 0
    assert player.crafting_xp == 5000
