import pytest
from simulator.items import Item


def test_add_inventory(player):
    player.max_inventory = 100
    player.add_item(Item["Wood"])
    assert player.inventory[Item["Wood"]] == 1
    assert player.overflow_items[Item["Wood"]] == 0


def test_add_inventory_overflow(player):
    player.max_inventory = 100
    player.add_item(Item["Wood"], 300)
    assert player.inventory[Item["Wood"]] == 100
    assert player.overflow_items[Item["Wood"]] == 200


def test_remove_inventory(player):
    player.inventory = {Item["Wood"]: 10}
    player.remove_item(Item["Wood"])
    assert player.inventory[Item["Wood"]] == 9


def test_remove_inventory_underflow(player):
    with pytest.raises(ValueError):
        player.remove_item(Item["Wood"])


def test_stamina(player):
    assert player.stamina == 0
    player.tick(60 * 10)
    assert player.stamina == 20


def test_stamina_energy_drink(super_player):
    assert super_player.stamina == 0
    super_player.tick(60 * 10)
    assert super_player.stamina == 40
