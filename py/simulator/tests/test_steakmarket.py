from simulator.items import Item
from simulator.player import Player
from simulator.steak_market import SteakMarket


def test_init(steak_market: SteakMarket):
    assert steak_market.market_level == 0
    assert steak_market.steak_price != 0
    assert steak_market.kabob_price != 0


def test_level_advance(steak_market: SteakMarket):
    assert steak_market.market_level == 0
    # Advance 14 days.
    steak_market.tick(60 * 60 * 24 * 14)
    assert steak_market.market_level != 0


def test_buy_steaks(player: Player, steak_market: SteakMarket):
    steak_market.steak_price = 50_000
    player.silver = 200_000
    steak_market.buy_steaks(player)
    assert player.silver == 0
    assert player.inventory == {Item["Steak"]: 4}


def test_buy_steaks_max_inv(player: Player, steak_market: SteakMarket):
    steak_market.steak_price = 50_000
    player.silver = 10_000_000
    steak_market.buy_steaks(player)
    assert player.silver == 5_000_000
    assert player.inventory == {Item["Steak"]: 100}


def test_buy_steaks_existing(player: Player, steak_market: SteakMarket):
    steak_market.steak_price = 50_000
    player.silver = 10_000_000
    player.inventory[Item["Steak"]] = 75
    steak_market.buy_steaks(player)
    assert player.silver == 8_750_000
    assert player.inventory == {Item["Steak"]: 100}


def test_buy_steaks_quantity(player: Player, steak_market: SteakMarket):
    steak_market.steak_price = 50_000
    player.silver = 10_000_000
    steak_market.buy_steaks(player, 10)
    assert player.silver == 9_500_000
    assert player.inventory == {Item["Steak"]: 10}


def test_buy_steaks_too_many(player: Player, steak_market: SteakMarket):
    steak_market.steak_price = 50_000
    player.silver = 10_000_000
    steak_market.buy_steaks(player, 150)
    assert player.silver == 5_000_000
    assert player.inventory == {Item["Steak"]: 100}


def test_buy_steaks_full(player: Player, steak_market: SteakMarket):
    steak_market.steak_price = 50_000
    player.silver = 10_000_000
    player.inventory[Item["Steak"]] = 100
    steak_market.buy_steaks(player)
    assert player.silver == 10_000_000
    assert player.inventory == {Item["Steak"]: 100}


def test_sell_steaks(player: Player, steak_market: SteakMarket):
    steak_market.steak_price = 50_000
    player.inventory[Item["Steak"]] = 10
    steak_market.sell_steaks(player)
    assert player.silver == 500_000
    assert player.inventory == {}


def test_sell_steaks_empty(player: Player, steak_market: SteakMarket):
    steak_market.steak_price = 50_000
    steak_market.sell_steaks(player)
    assert player.silver == 0
    assert player.inventory == {}


def test_sell_steaks_quantity(player: Player, steak_market: SteakMarket):
    steak_market.steak_price = 50_000
    player.inventory[Item["Steak"]] = 10
    steak_market.sell_steaks(player, 5)
    assert player.silver == 250_000
    assert player.inventory == {Item["Steak"]: 5}
