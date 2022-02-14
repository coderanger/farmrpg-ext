from unittest.mock import patch

from droprates import compile_drops


@patch("parse_logs.parse_logs")
def test_compile_explores_explore(mock_parse_logs):
    mock_parse_logs.return_value = [
        {
            "type": "explore",
            "ts": 1644664476000,
            "results": {
                "location": "Forest",
                "stamina": 1,
                "items": [{"item": "Wood", "overflow": False}],
            },
        },
        {
            "type": "explore",
            "ts": 1644664476001,
            "results": {
                "location": "Forest",
                "stamina": 1,
                "items": [],
            },
        },
    ]
    explores = compile_drops(explore=True)
    assert explores.explores == 2
    assert explores.lemonades == 0
    assert explores.ciders == 0
    assert explores.drops == 1
    assert explores.locations["Forest"].explores == 2
    assert explores.locations["Forest"].lemonades == 0
    assert explores.locations["Forest"].ciders == 0
    assert explores.locations["Forest"].drops == 1
    assert explores.locations["Forest"].items["Wood"].explores == 2
    assert explores.locations["Forest"].items["Wood"].lemonades == 0
    assert explores.locations["Forest"].items["Wood"].ciders == 0
    assert explores.locations["Forest"].items["Wood"].drops == 1


@patch("parse_logs.parse_logs")
def test_compile_explores_temporary(mock_parse_logs):
    mock_parse_logs.return_value = [
        {
            "type": "explore",
            "ts": 1543664476000,
            "results": {
                "location": "Cane Pole Ridge",
                "stamina": 1,
                "items": [{"item": "Wood", "overflow": False}],
            },
        },
        {
            "type": "explore",
            "ts": 1644664476001,
            "results": {
                "location": "Cane Pole Ridge",
                "stamina": 1,
                "items": [{"item": "Heart Necklace Right Piece", "overflow": False}],
            },
        },
    ]
    explores = compile_drops(explore=True)
    assert explores.explores == 2
    assert explores.lemonades == 0
    assert explores.ciders == 0
    assert explores.drops == 2
    loc = explores.locations["Cane Pole Ridge"]
    assert loc.explores == 2
    assert loc.lemonades == 0
    assert loc.ciders == 0
    assert loc.drops == 2
    assert loc.items["Wood"].explores == 2
    assert loc.items["Wood"].lemonades == 0
    assert loc.items["Wood"].ciders == 0
    assert loc.items["Wood"].drops == 1
    assert loc.items["Heart Necklace Right Piece"].explores == 1
    assert loc.items["Heart Necklace Right Piece"].lemonades == 0
    assert loc.items["Heart Necklace Right Piece"].ciders == 0
    assert loc.items["Heart Necklace Right Piece"].drops == 1


@patch("parse_logs.parse_logs")
def test_compile_explores_cider(mock_parse_logs):
    mock_parse_logs.return_value = [
        {
            "type": "cider",
            "ts": 1644664476000,
            "results": {
                "location": "Forest",
                "explores": 1000,
                "stamina": 663,
                "totalItems": 5,
                "items": [{"item": "Wood", "overflow": False, "quantity": 5}],
            },
        },
    ]
    explores = compile_drops(cider=True)
    assert explores.explores == 1000
    assert explores.lemonades == 0
    assert explores.ciders == 1
    assert explores.drops == 5
    assert explores.locations["Forest"].explores == 1000
    assert explores.locations["Forest"].lemonades == 0
    assert explores.locations["Forest"].ciders == 1
    assert explores.locations["Forest"].drops == 5
    assert explores.locations["Forest"].items["Wood"].explores == 1000
    assert explores.locations["Forest"].items["Wood"].lemonades == 0
    assert explores.locations["Forest"].items["Wood"].ciders == 1
    assert explores.locations["Forest"].items["Wood"].drops == 5


@patch("parse_logs.parse_logs")
def test_compile_explores_cider_overflow(mock_parse_logs):
    mock_parse_logs.return_value = [
        {
            "type": "cider",
            "ts": 1644664476000,
            "results": {
                "location": "Forest",
                "explores": 1000,
                "stamina": 663,
                "totalItems": 7,
                "items": [
                    {"item": "Wood", "overflow": False, "quantity": 5},
                    {"item": "Stone", "overflow": False, "quantity": 2},
                    {"item": "Stone", "overflow": True, "quantity": 0},
                ],
            },
        },
        {
            "type": "explore",
            "ts": 1644664476000,
            "results": {
                "location": "Forest",
                "stamina": 1,
                "items": [{"item": "Stone", "overflow": False}],
            },
        },
    ]
    explores = compile_drops(cider=True, explore=True)
    assert explores.explores == 1001
    assert explores.lemonades == 0
    assert explores.ciders == 1
    assert explores.drops == 6
    assert explores.locations["Forest"].explores == 1001
    assert explores.locations["Forest"].lemonades == 0
    assert explores.locations["Forest"].ciders == 1
    assert explores.locations["Forest"].drops == 6
    assert explores.locations["Forest"].items["Wood"].explores == 1001
    assert explores.locations["Forest"].items["Wood"].lemonades == 0
    assert explores.locations["Forest"].items["Wood"].ciders == 1
    assert explores.locations["Forest"].items["Wood"].drops == 5
    assert explores.locations["Forest"].items["Stone"].explores == 1
    assert explores.locations["Forest"].items["Stone"].lemonades == 0
    assert explores.locations["Forest"].items["Stone"].ciders == 0
    assert explores.locations["Forest"].items["Stone"].drops == 1


@patch("parse_logs.parse_logs")
def test_compile_explores_fake_lemonade(mock_parse_logs):
    mock_parse_logs.return_value = [
        {
            "type": "lemonade",
            "results": {
                "location": "Cane Pole Ridge",
                "items": [
                    {"item": "Stone", "overflow": False, "quantity": 1},
                    {
                        "item": "Unpolished Shimmer Stone",
                        "overflow": False,
                        "quantity": 1,
                    },
                    {
                        "item": "Unpolished Shimmer Stone",
                        "overflow": False,
                        "quantity": 1,
                    },
                    {"item": "Mushroom", "overflow": False, "quantity": 1},
                    {
                        "item": "Unpolished Shimmer Stone",
                        "overflow": False,
                        "quantity": 1,
                    },
                    {"item": "Iron", "overflow": True, "quantity": 1},
                    {"item": "Wood", "overflow": False, "quantity": 1},
                    {"item": "Iron", "overflow": True, "quantity": 1},
                    {"item": "Iron", "overflow": True, "quantity": 1},
                    {"item": "Wood", "overflow": False, "quantity": 1},
                    {
                        "item": "Unpolished Shimmer Stone",
                        "overflow": False,
                        "quantity": 1,
                    },
                    {"item": "Iron", "overflow": True, "quantity": 1},
                    {
                        "item": "Unpolished Shimmer Stone",
                        "overflow": False,
                        "quantity": 1,
                    },
                    {"item": "Stone", "overflow": False, "quantity": 1},
                    {"item": "Iron", "overflow": True, "quantity": 1},
                    {"item": "Lemon Quartz", "overflow": False, "quantity": 1},
                    {
                        "item": "Unpolished Shimmer Stone",
                        "overflow": False,
                        "quantity": 1,
                    },
                    {
                        "item": "Unpolished Shimmer Stone",
                        "overflow": False,
                        "quantity": 1,
                    },
                    {"item": "Iron", "overflow": True, "quantity": 1},
                    {"item": "Iron", "overflow": True, "quantity": 1},
                ],
            },
            "ts": 1644646984454,
            "id": 116335,
        },
    ]
    drops = compile_drops(lemonade=True, lemonade_fake_explores=True)
    assert drops.lemonades == 1
    assert drops.explores == 70
