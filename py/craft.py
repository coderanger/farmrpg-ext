import math
from typing import Optional

import attr
from frozendict import frozendict


@attr.s(auto_attribs=True, frozen=True)
class Item:
    name: str
    recipe: frozendict[str, int] = attr.ib(default=frozendict(), converter=frozendict)
    sell_price: Optional[int] = None
    buy_price: Optional[int] = None
    craft_price: Optional[int] = None
    passive_production: bool = False


class ItemDatabase:
    items = [
        Item(name="Stamina", passive_production=True),
        Item(name="Nails", buy_price=1),
        Item(name="Iron", buy_price=50),
        Item(name="Wood", passive_production=True),
        Item(name="Board", recipe={"Wood": 5}, craft_price=1, passive_production=True),
        Item(name="Stone", passive_production=True),
        Item(name="Wood Plank", recipe={"Board": 4, "Nails": 4}, craft_price=2),
        Item(name="Straw", passive_production=True),
        Item(
            name="Twine",
            recipe={"Straw": 2, "Wood": 1},
            craft_price=10,
            sell_price=150,
        ),
        Item(
            name="Sturdy Shield",
            recipe={"Iron": 6, "Nails": 6, "Wood Plank": 1},
            craft_price=500,
            sell_price=4000,
        ),
        Item(
            name="Iron Ring",
            recipe={"Iron": 2, "Stone": 1},
            craft_price=10,
            sell_price=110,
        ),
        Item(
            name="Fancy Pipe",
            recipe={"Wood": 2, "Iron Ring": 3, "Iron": 1},
            craft_price=150,
            sell_price=5000,
        ),
        Item(
            name="Unpolished Shimmer Stone",
            sell_price=10,
            craft_price=10,
        ),
        Item(
            name="Shimmer Stone",
            sell_price=25,
            craft_price=5,
            recipe={"Unpolished Shimmer Stone": 2},
        ),
        Item(
            name="Glass Orb",
            sell_price=60,
            craft_price=10,
            recipe={"Shimmer Stone": 2, "Stone": 1},
        ),
        Item(
            name="Glass Bottle",
            sell_price=10,
            craft_price=25,
            recipe={"Glass Orb": 1, "Stone": 1},
        ),
        Item(name="Coal", sell_price=50),
        Item(
            name="Lantern",
            recipe={
                "Coal": 1,
                "Glass Bottle": 1,
                "Iron": 3,
                "Iron Ring": 1,
                "Twine": 2,
            },
            craft_price=4000,
            sell_price=40000,
        ),
        Item(
            name="Wagon Wheel",
            sell_price=1750,
            craft_price=250,
            recipe={"Board": 12, "Nails": 14},
        ),
        Item(
            name="Sturdy Sword",
            sell_price=11000,
            craft_price=1500,
            recipe={"Iron": 2, "Leather": 1, "Mushroom Paste": 1, "Steel": 1},
        ),
        Item(
            name="Mushroom Paste", sell_price=50, craft_price=2, recipe={"Mushroom": 3}
        ),
        Item(name="Mushroom", sell_price=1),
        Item(name="Leather", sell_price=250, craft_price=25, recipe={"Hide": 2}),
        Item(name="Hide", sell_price=150),
        Item(
            name="Steel",
            sell_price=800,
            craft_price=250,
            recipe={"Carbon Sphere": 1, "Glass Orb": 1, "Iron": 10},
        ),
        Item(name="Carbon Sphere", sell_price=500),
        Item(name="Sandstone", passive_production=True),
        Item(
            name="Sand",
            sell_price=500,
            craft_price=750,
            recipe={"Leather": 1, "Sandstone": 5},
        ),
        Item(
            name="Hourglass",
            sell_price=25000,
            craft_price=2000,
            recipe={"Glass Bottle": 2, "Mushroom Paste": 2, "Sand": 1, "Wood": 6},
        ),
        Item(name="Cotton", sell_price=100000, recipe={"Cotton Seeds": 1}),
        Item(name="Cotton Seeds", buy_price=84000),
        Item(
            name="Green Dye",
            sell_price=35,
            craft_price=2,
            recipe={"Fern Leaf": 6, "Glass Bottle": 1},
        ),
        Item(name="Fern Leaf", sell_price=1),
        Item(
            name="Green Cloak",
            sell_price=125000,
            craft_price=2500,
            recipe={"Cotton": 1, "Green Dye": 10, "Leather": 5, "Twine": 10},
        ),
        Item(
            name="Wooden Shield",
            sell_price=500,
            craft_price=75,
            recipe={"Iron": 1, "Nails": 4, "Wood Plank": 1},
        ),
        Item(
            name="Green Shield",
            sell_price=5500,
            craft_price=500,
            recipe={"Green Dye": 1, "Iron": 3, "Wooden Shield": 1},
        ),
        Item(name="Salt Rock", sell_price=500),
        Item(
            name="Salt",
            sell_price=50000,
            craft_price=10000,
            recipe={"Hammer": 1, "Salt Rock": 50},
        ),
        Item(
            name="Hammer",
            sell_price=150,
            craft_price=10,
            recipe={"Board": 1, "Iron": 1, "Mushroom Paste": 1},
        ),
        Item(
            name="Wooden Bow",
            sell_price=2500,
            craft_price=400,
            recipe={"Fern Leaf": 1, "Iron": 2, "Twine": 2, "Wood": 4},
        ),
        Item(
            name="Sturdy Bow",
            sell_price=80000,
            craft_price=25000,
            recipe={"Mushroom Paste": 2, "Oak": 4, "Steel": 1, "Stone": 2, "Twine": 2}
        ),
        Item(name="Oak", sell_price=100),
        Item(
            name="Fancy Guitar",
            sell_price=65000,
            craft_price=8550,
            recipe={"Iron": 4, "Mushroom Paste": 3, "Oak": 5, "Steel Wire": 6},
        ),
        Item(
            name="Steel Wire",
            sell_price=2000,
            craft_price=100,
            recipe={"Carbon Sphere": 1, "Iron": 10, "Stone": 1},
        ),
        Item(
            name="Treasure Chest",
            sell_price=7500,
            craft_price=1000,
            recipe={"Iron": 12, "Nails": 22, "Wood Plank": 6},
        ),
        Item(
            name="Fishing Net",
            sell_price=150000,  # Not actually but via LI fishing
            craft_price=100,
            recipe={"Antler": 1, "Iron": 4, "Rope": 2},
        ),
        Item(name="Antler", sell_price=250),
        Item(
            name="Rope",
            sell_price=100,
            craft_price=50,
            recipe={"Twine": 3},
        ),
        Item(name="Unpolished Garnet"),
        Item(
            name="Garnet",
            sell_price=15000,
            craft_price=750,
            recipe={"Stone": 1, "Unpolished Garnet": 2},
        ),
        Item(
            name="Garnet Ring",
            sell_price=30000,
            craft_price=1500,
            recipe={"Garnet": 1, "Iron Ring": 1, "Mushroom Paste": 1},
        ),
    ]

    # Get from droprates.py
    stamina_per_drop = {
        "3-leaf Clover": 37.73770491803279,
        "4-leaf Clover": 135.41176470588235,
        "ALL": 2.5102827763496145,
        "Acorn": 20.553571428571427,
        "Amethyst": 101.44329896907216,
        "Ancient Coin": 208.1451612903226,
        "Antler": 49.21610639083857,
        "Apple": 70.26829268292683,
        "Aquamarine": 56.490196078431374,
        "Arrowhead": 59.23877278790574,
        "Bacon": 14406.5,
        "Bird Egg": 78.50795521508545,
        "Blue Feathers": 19.675213675213676,
        "Blue Gel": 70.04664099272571,
        "Bone": 69.75,
        "Carbon Sphere": 48.26298157453936,
        "Caterpillar": 702.8571428571429,
        "Coal": 7.25428027901078,
        "Dice": 2881.0,
        "Dragon Skull": 57626.0,
        "Emberstone": 49.63461538461539,
        "Feathers": 11.166666666666666,
        "Fern Leaf": 17.844961240310077,
        "Fire Ant": 386.168115942029,
        "Giant Centipede": 544.7619047619048,
        "Glass Orb": 21.121112929623568,
        "Gold Feather": 7012.0,
        "Gold Leaf": 7836.941176470588,
        "Herbs": 3273.98,
        "Hide": 40.15310427968656,
        "Horn": 48.888888888888886,
        "Horned Beetle": 452.0,
        "Iron": 13.568636684718625,
        "Lemon": 391.6244019138756,
        "Lemon Quartz": 64.57142857142857,
        "Magicite": 1433.888888888889,
        "Magna Quartz": 4116.142857142857,
        "Medium Chest 02": 11440.0,
        "Moonstone": 2150.8333333333335,
        "Mushroom": 18.018393291858263,
        "Nails": 8.83710407239819,
        "Oak": 8.91946820683267,
        "Orange": 394.455421686747,
        "Orange Gecko": 11440.0,
        "Pine Cone": 230.2,
        "Pocket Watch": 1130.0,
        "Prism Shard": 55.14957264957265,
        "Purple Flower": 20.542797494780793,
        "Raptor Claw": 163699.0,
        "Raptor Egg": 163699.0,
        "Red Berries": 125.15214067278288,
        "Ruby Scorpion": 880.0,
        "Runestone 05": 2302.0,
        "Runestone 09": 5720.0,
        "Runestone 13": 11440.0,
        "Runestone 14": 9840.0,
        "Runestone 17": 12905.0,
        "Runestone 19": 14406.5,
        "Salt Rock": 35.86744084136722,
        "Sandstone": 6.967113276492083,
        "Shimmer Quartz": 77.82312925170068,
        "Shiny Beetle": 287.75,
        "Slimestone": 29.585938911982648,
        "Small Chest 01": 2881.0,
        "Small Chest 02": 14406.5,
        "Snail": 480.1666666666667,
        "Sour Root": 128.59308719560093,
        "Spectacles": 720.25,
        "Spider": 460.4,
        "Stone": 4.536028119507908,
        "Strange Letter": 1968.0,
        "Straw": 17.928677163235097,
        "Striped Feather": 134.84266886326193,
        "Sweet Root": 34.878787878787875,
        "Thorns": 126.8001549186677,
        "Unpolished Emerald": 49.42195540308748,
        "Unpolished Garnet": 54.93255033557047,
        "Unpolished Ruby": 71.9375,
        "Unpolished Shimmer Stone": 13.584629891560585,
        "Wood": 6.881611570247934,
        "Wooden Mask": 976.5,
    }

    # Insert the stam recipes.
    enable_stam = True
    # enable_stam = False
    for i, item in enumerate(items):
        if item.name in stamina_per_drop:
            params = attr.asdict(item)
            if enable_stam:
                # Even in stamina mode, don't explore for buyable or passive items.
                if not item.buy_price and not item.passive_production:
                    params["recipe"] = {"Stamina": stamina_per_drop[item.name]}
            else:
                params["passive_production"] = True
            items[i] = Item(**params)

    items_by_name = {item.name: item for item in items}

    for item in items_by_name.values():
        if not item.recipe and not item.passive_production and not item.buy_price:
            print(f"Error: {item.name} has no production")

    def __getitem__(self, key: str) -> Item:
        return self.items_by_name[key]

    def expand(
        self,
        item: Item,
        save_chance: float = 0,
        craft_price_reduction: float = 0,
        include_buyable: bool = False,
        stop_at: set[Item] = set(),
    ) -> tuple[dict[Item, int], int]:
        pool = [(item, 1)]
        leaves: dict[Item, int] = {}
        crating_cost = 0
        while pool:
            cur_item, cur_count = pool.pop()
            if cur_item.recipe and cur_item not in stop_at:
                for name, count in cur_item.recipe.items():
                    total_count = (cur_count * count) / (1 + save_chance)
                    pool.append((self[name], total_count))
                if cur_item.craft_price:
                    crating_cost += int(
                        math.ceil(cur_item.craft_price * (1 - craft_price_reduction))
                    )
            else:
                count = leaves.get(cur_item, 0)
                leaves[cur_item] = count + cur_count
        if not include_buyable:
            # Convert anything with a buy price to money.
            for item, count in list(leaves.items()):
                if item.buy_price:
                    crating_cost += item.buy_price * count
                    del leaves[item]
        return leaves, crating_cost

    def profit_per(
        self,
        target: Item,
        per: Item,
        mastered: set[Item] = set(),
        grandmastered: set[Item] = set(),
        **kwargs,
    ) -> Optional[float]:
        if not target.sell_price:
            return None
        leaves, cost = self.expand(target, stop_at={per}, **kwargs)
        if per not in leaves:
            return None
        price_multiplier = 1
        if target in grandmastered:
            price_multiplier = 1.2
        elif target in mastered:
            price_multiplier = 1.1
        profit = (target.sell_price * price_multiplier) - cost
        return profit / leaves[per]

    def profit_per_leaf(self, item: Item, **kwargs) -> dict[Item, Optional[float]]:
        profits = {
            leaf: self.profit_per(item, leaf, **kwargs)
            for leaf in self.items
            if leaf.passive_production
        }
        return {leaf: profit for leaf, profit in profits.items() if profit}

    def all_profit_per_leaf(self, **kwargs) -> dict[Item, dict[Item, Optional[float]]]:
        all_profits = {
            item: self.profit_per_leaf(item, **kwargs) for item in self.items
        }
        return {item: profits for item, profits in all_profits.items() if profits}


db = ItemDatabase()

# profits = db.all_profit_per_leaf()
profits = db.all_profit_per_leaf(
    save_chance=0.2,
    craft_price_reduction=0.60,
    mastered={
        db["Wood Plank"],
    },
    grandmastered={
        db["Board"],
        db["Iron Ring"],
        db["Fancy Pipe"],
        db["Sturdy Shield"],
        db["Twine"],
    },
)


def print_forward(profits: dict[Item, dict[Item, Optional[float]]]):
    for item, item_profits in sorted(profits.items(), key=lambda kv: kv[0].name):
        print(f"{item.name}:")
        for leaf, profit in sorted(
            item_profits.items(), reverse=True, key=lambda kv: kv[1]
        ):
            print(f"\t{int(math.floor(profit))}/{leaf.name}")


def print_reverse(profits: dict[Item, dict[Item, Optional[float]]]):
    by_leaf: dict[Item, dict[Item, float]] = {}
    for item, item_profits in profits.items():
        for leaf, profit in item_profits.items():
            by_leaf.setdefault(leaf, {})[item] = profit
    print_forward(by_leaf)


print_forward(profits)
print("-------------")
print_reverse(profits)

# p = db.profit_per(db["Fishing Net"], db["Stamina"], save_chance=0.2, craft_price_reduction=0.60)
# # p = db.expand(db["Fishing Net"], stop_at={db["Stamina"]}, save_chance=0.2, craft_price_reduction=0.60)
# print(p)
