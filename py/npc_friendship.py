import csv as csv_
import statistics
import sys
from collections import defaultdict
from pathlib import Path
from typing import Literal

import rich.box
import rich.console
import rich.table
import typer
import yaml as yaml_

import fixtures
import parse_logs

XpCurve = list[dict[Literal["level", "xp"], int]]

# Items which I'm not spading at this time (rare or expensive).
IGNORE_MISSING = {
    "10 Gold",
    "100 Gold",
    "25 Gold",
    "5 Gold",
    "50 Gold",
    "Backpack",
    "Blitzen",
    "Box of Chocolate",
    "Christmas Present 01",
    "Christmas Present 07",
    "Clubs",
    "Comet",
    "Cupid",
    "Dancer",
    "Dasher",
    "Diamonds",
    "Donner",
    "Egg 01",
    "Egg 02",
    "Egg 03",
    "Egg 04",
    "Egg 05",
    "Egg 06",
    "Egg 07",
    "Egg 08",
    "Egg 09",
    "Egg 10",
    "Egg 11",
    "Egg 12",
    "Fall Basket",
    "Fireworks",
    "Hearts",
    "Mushroom Stew",
    "Onion Soup",
    "Pot of Gold (Large)",
    "Pot of Gold (Medium)",
    "Pot of Gold (Small)",
    "Prancer",
    "Rudolph",
    "Snowball",
    "Spades",
    "Spring Basket",
    "Summer Basket",
    "Tackle Box",
    "Treat Bag 02",
    "Valentines Card",
    "Vixen",
    "frank's Basket",
}

NAME_MAP = {
    "Charles Horsington III": "Charles",
    "Captain Thomas": "Cpt Thomas",
}


def xp_for(xp_curve: XpCurve, level: int, progress: float):
    prev_xp = xp_curve[level - 1]["xp"]
    next_xp = xp_curve[level]["xp"]
    delta = next_xp - prev_xp
    return prev_xp + (delta * (progress / 100))


def missing_cmd(xp_per_item: dict[str, dict[str, list[float]]]):
    # Print a table of tradable items which do not appear.
    tradable_items = {
        it.name: it
        for it in fixtures.load_items()
        if it.givable and it.name not in IGNORE_MISSING and not it.event
    }
    missing_ids = set((it.name, it.id) for it in tradable_items.values())
    table = rich.table.Table(box=rich.box.MINIMAL)
    table.add_column("NPC")
    table.add_column("Item")
    for npc_name, data in sorted(xp_per_item.items()):
        for item_name, item in sorted(tradable_items.items()):
            if item_name not in data:
                table.add_row(
                    npc_name,
                    item_name,
                    item.id,
                )
            if (item_name, item.id) in missing_ids:
                missing_ids.remove((item_name, item.id))
    console = rich.console.Console()
    console.print(table)
    print("Overall:")
    print(", ".join(v[0] for v in sorted(missing_ids)))
    print(", ".join(repr(v[1]) for v in sorted(missing_ids)))


def townsfolks_tsv_cmd():
    items = {it.name: it for it in fixtures.load_items()}
    data_root = Path(__file__).resolve().parent.parent / "data"
    in_file = data_root / "townsfolk.tsv"
    out_file = data_root / "npc_items.yaml"
    reader = csv_.DictReader(in_file.open(), dialect="excel-tab")
    data = []
    for row in reader:
        loves: set[str] = {i for i in row["Loves"].split(",") if items[i].givable}
        likes: set[str] = {i for i in row["Likes"].split(",") if items[i].givable}
        hates: set[str] = {i for i in row["Hates"].split(",") if items[i].givable}
        if (likes | loves) & hates:
            raise Exception("Items can't be both liked and hated")
        data.append(
            {
                "name": NAME_MAP.get(row["Name"], row["Name"]),
                "loves": sorted(loves),
                "likes": sorted(likes - loves),
                "hates": sorted(hates),
            }
        )
    yaml_.dump(sorted(data, key=lambda d: d["name"]), out_file.open("w"))


def npc_friendship_cmd(
    missing: bool = False,
    csv: bool = False,
    yaml: bool = False,
    import_tsv: bool = False,
):
    if import_tsv:
        townsfolks_tsv_cmd()
        return

    xp_curve: XpCurve = fixtures.load_fixture("xp")
    items = {it.id: it for it in fixtures.load_items()}
    # xp_per_item[npc_name][item_name] = [xp, xp, xp]
    xp_per_item: dict[str, dict[str, list[float]]] = defaultdict(
        lambda: defaultdict(list)
    )

    # Work out the estimated XP increase for each NPC and item.
    for row in parse_logs.parse_logs("npc_mail"):
        results = row["results"]
        before_xp = xp_for(xp_curve, **results["before"])
        after_xp = xp_for(xp_curve, **results["after"])
        if after_xp <= 10:
            # Can't trust this.
            continue
        average_xp = (after_xp - before_xp) / int(results["quantity"])
        # print(f"Got {items[results['itemId']].name} to {results['to']}: {average_xp=}")
        xp_per_item[results["to"]][items[results["itemId"]].name].append(average_xp)

    # I think this one is wrong in my data, hardwire it.
    xp_per_item["frank"]["3-leaf Clover"] = [1.0]

    # Alternate mode.
    if missing:
        missing_cmd(xp_per_item)
        return

    # Another alternate mode, generate the fixture input file.
    if yaml:
        data = []
        for npc_name, npc_data in sorted(xp_per_item.items()):
            npc = {
                "name": npc_name,
                "loves": [],
                "likes": [],
                "hates": [],
            }
            for item_name, xps in sorted(npc_data.items()):
                if not xps:
                    continue
                xp = round(statistics.mean(xps))
                if xp == 1:
                    # Ignore it.
                    pass
                elif xp == 150:
                    npc["loves"].append(item_name)
                elif xp == 25:
                    npc["likes"].append(item_name)
                elif xp == -50:
                    npc["hates"].append(item_name)
                else:
                    sys.stderr.write(
                        f"Unexpected item XP: {npc_name=} {item_name=} {xp=}: {xps}\n"
                    )
            data.append(npc)
        out_file = Path(__file__).resolve().parent.parent / "data" / "npc_items.yaml"
        yaml_.dump(data, out_file.open("w"))

    # Build a table.
    all_items = set()
    columns = ["Item"]
    for npc_name, data in sorted(xp_per_item.items()):
        columns.append(npc_name)
        all_items = all_items | data.keys()
    rows = []
    for item_name in sorted(all_items):
        row = [item_name]
        for npc_name, data in sorted(xp_per_item.items()):
            xps = data.get(item_name, [])
            if xps:
                row.append(f"{statistics.mean(xps):.3f}")
                # row.append(",".join(f"{xp:.3f}" for xp in xps))
                # row.append(str(len(xps)))
            else:
                row.append("N/A")
        rows.append(row)

    if csv:
        # CSV table.
        out = csv_.writer(sys.stdout, dialect="excel-tab")
        out.writerow(columns)
        out.writerows(rows)
    else:
        # Pretty table.
        table = rich.table.Table(box=rich.box.MINIMAL)
        for col in columns:
            table.add_column(col)
        for row in rows:
            table.add_row(*row)
        console = rich.console.Console()
        console.print(table)


if __name__ == "__main__":
    typer.run(npc_friendship_cmd)
