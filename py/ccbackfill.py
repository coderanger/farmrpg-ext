import json
import re
import sys

import fixtures

lines = open("../data/community_center_backfill.txt").readlines()

cc = []

line_re = re.compile(
    r"^(\d+)/(\d+) ([0-9.]+)([km]) (.*) for (\d+) (.*?)( - failed)?(?: - ([0-9.]+)%)?$"
)

items = {it.name.lower(): it for it in fixtures.load_items()}


def fix_item(name: str) -> str:
    name = name.lower()
    if name == "gold":
        return "Gold"
    if name[:2] == "rs":
        name = f"runestone {int(name[2:]):02d}"
    if name in items:
        name = items[name].name
    elif name[:-1] in items:
        name = items[name[:-1]].name
    else:
        raise ValueError(f"Bad item {name}")
    return name


for line in lines:
    if line[0] == "#":
        continue
    match = line_re.match(line)
    if match:
        month = int(match[1])
        day = int(match[2])
        goal_quantity = float(match[3])
        goal_multiplier = match[4]
        goal_item = match[5]
        reward_quantity = int(match[6])
        reward_item = match[7]
        failed = bool(match[8])
        progress_pct = float(match[9]) if match[9] else None

        goal_quantity *= {"k": 1000, "m": 1_000_000}[goal_multiplier]

        goal_item = fix_item(goal_item)
        reward_item = fix_item(reward_item)

        year = 2021 if month == 12 else 2022

        progress = None
        if progress_pct:
            progress = int(goal_quantity * (progress_pct / 100))
        elif failed:
            progress = 0

        cc.append(
            {
                "date": f"{year}-{month:02d}-{day:02d}",
                "goalItem": goal_item,
                "goalQuantity": goal_quantity,
                "rewardItem": reward_item,
                "rewardQuantity": reward_quantity,
                "progress": progress,
            }
        )

    else:
        print(f"FAILED MATCH: {line}")

json.dump(cc, sys.stdout, indent=2)
