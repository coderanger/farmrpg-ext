from typing import Any, Optional


class LevelProperty:
    def __init__(self, attr: str, xp_curve: dict[int, int]):
        self.attr = attr
        self.xp_curve = xp_curve
        self.reverse_curve = sorted(
            ((v, k) for k, v in xp_curve.items()), key=lambda kv: kv[1]
        )

    def __get__(self, obj: Any, objtype: Optional[type] = None) -> int:
        level = 1
        xp_value = getattr(obj, self.attr)
        for xp_threshold, level_threshold in self.reverse_curve:
            if xp_threshold > xp_value:
                break
            level = level_threshold
        return level

    def __set__(self, obj: Any, level: int):
        setattr(obj, self.attr, self.xp_curve[level])


PLAYER_XP_CURVE = {
    # This is an assumption.
    1: 0,
    # There are the explicitly known values.
    42: 3525402,
    43: 3920195,
    44: 4360783,
    45: 4852479,
    46: 5401211,
    47: 6013595,
    48: 6697015,
    49: 7459711,
    50: 8310879,
    51: 9260782,
    52: 10320873,
    53: 11503934,
    54: 12824230,
    55: 14297680,
    56: 15942050,
    57: 17777166,
    58: 19825155,
    59: 22110710,
    60: 24661389,
    61: 27507946,
    62: 30684703,
    63: 34229963,
    64: 38186473,
    65: 42601938,
    66: 47529596,
    67: 53666776,
    68: 60515868,
    69: 68159454,
    70: 76689695,
    71: 86209443,
    72: 96833481,
    73: 108689907,
    74: 121921678,
    75: 136688334,
    76: 153167922,
    77: 171559142,
    78: 192083743,
    79: 214989197,
    80: 240551683,
    81: 269079417,
    82: 300916368,
    83: 336446405,
    84: 376097926,
    85: 420349023,
    86: 469733247,
    87: 524846040,
    88: 586351916,
    89: 654992473,
    90: 731595334,
    91: 817084126,
    92: 912489617,
    93: 1018962144,
    94: 1137785484,
    95: 1270392331,
    96: 1418381572,
    97: 1583537564,
    98: 1767851651,
    99: 2000000000,
}

# Calculate the 2-41 values.
for level in range(2, 42):
    PLAYER_XP_CURVE[level] = round(31580.7731508038 * (1.118029202147977 ** level))


ANIMAL_XP_CURVE = {
    1: 0,
    2: 1250,
    3: 3750,
    4: 7250,
    5: 11750,
    6: 17750,
    7: 25250,
    8: 34250,
    9: 45250,
    10: 58250,
    11: 71400,
    12: 99000,
}


def player_level_property(attr: str) -> LevelProperty:
    return LevelProperty(attr, PLAYER_XP_CURVE)


def animal_level_property() -> LevelProperty:
    return LevelProperty("xp", ANIMAL_XP_CURVE)
