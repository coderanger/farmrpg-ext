from typing import Optional

import rich.box
import rich.console
import rich.table
import typer

import droprates

drop_args = {
    "explore": True,
    "lemonade": True,
    "cider": True,
    "palmer": True,
    "fish": False,
    "net": True,
    "large_net": True,
    "harvest": True,
    "lemonade_fake_explores": True,
    "nets_fake_fishes": True,
    "iron_depot": True,
}

missing_ignore = {
    "Iron",
    "Nails",
    "Egg 07",
    "Egg 08",
    "Heart Necklace Left Piece",
    "Heart Necklace Right Piece",
}


def cmd_where():
    drops = droprates.compile_drops(runecube=True, **drop_args)

    data = []
    for loc, loc_drops in drops.locations.items():
        data.append((loc, droprates.mode_for_drops(loc_drops)[1], loc_drops.drops))

    data.sort(key=lambda row: row[1])

    table = rich.table.Table(box=rich.box.MINIMAL)
    table.add_column("Location")
    table.add_column("Hits")
    table.add_column("Drops")
    for loc, hits, drops in data:
        table.add_row(loc, str(hits), str(drops))

    console = rich.console.Console()
    console.print(table)


def cmd_missing(
    location_names: Optional[list[str]] = None, drops: Optional[int] = None
):
    pre_iron_depot_drops = droprates.compile_drops(
        runecube=False, **{**drop_args, "iron_depot": False}
    )
    without_drops = droprates.compile_drops(runecube=False, **drop_args)
    with_drops = droprates.compile_drops(runecube=True, **drop_args)
    without_fishing_drops = droprates.compile_drops(
        runecube=False, **{**drop_args, "net": False, "large_net": False, "fish": True}
    )
    with_fishing_drops = droprates.compile_drops(
        runecube=True, **{**drop_args, "net": False, "large_net": False, "fish": True}
    )

    if not location_names:
        location_names = sorted(
            set(pre_iron_depot_drops.locations.keys())
            | set(without_drops.locations.keys())
            | set(with_drops.locations.keys())
            | set(without_fishing_drops.locations.keys())
            | set(with_fishing_drops.locations.keys())
        )

    data = []
    drops_limit = drops or 100
    for location in location_names:
        pre_iron_depot_loc_drops = pre_iron_depot_drops.locations[location].items
        without_loc_drops = without_drops.locations[location].items
        with_loc_drops = with_drops.locations[location].items
        without_fishing_loc_drops = without_fishing_drops.locations[location].items
        with_fishing_loc_drops = with_fishing_drops.locations[location].items
        all_items = sorted(
            set(pre_iron_depot_loc_drops.keys())
            | set(without_loc_drops.keys())
            | set(with_loc_drops.keys())
            | set(without_fishing_loc_drops.keys())
            | set(with_fishing_loc_drops.keys())
        )
        for item in all_items:
            # Some items we just don't care about.
            if item in missing_ignore:
                continue

            if (item in pre_iron_depot_loc_drops or item in without_loc_drops) and (
                item not in with_loc_drops or with_loc_drops[item].drops < drops_limit
            ):
                data.append(
                    (
                        location,
                        item,
                        "Normal",
                        with_loc_drops[item].drops if item in with_loc_drops else 0,
                    )
                )
            elif item in without_fishing_loc_drops and (
                item not in with_fishing_loc_drops
                or with_fishing_loc_drops[item].drops < drops_limit
            ):
                data.append(
                    (
                        location,
                        item,
                        "Manual Fishing",
                        with_fishing_loc_drops[item].drops
                        if item in with_fishing_loc_drops
                        else 0,
                    )
                )

    table = rich.table.Table(box=rich.box.MINIMAL)
    if len(location_names) > 1:
        table.add_column("Location")
    table.add_column("Item")
    table.add_column("Type")
    table.add_column("Drops")
    for (
        location_name,
        item_name,
        type_name,
        item_drops,
    ) in data:
        color = None
        if item_drops == 0:
            color = "red"
        elif item_drops <= 25:
            color = "yellow"
        row: list[str] = [item_name, type_name, str(item_drops)]
        if len(location_names) > 1:
            row.insert(0, location_name)
        table.add_row(*row, style=color)

    console = rich.console.Console()
    console.print(table)


def cmd_runecube(
    location_names: Optional[list[str]] = typer.Argument(None),
    drops: Optional[int] = None,
    missing: bool = False,
):
    if missing:
        return cmd_missing(location_names, drops)

    if not location_names:
        return cmd_where()

    without_drops = droprates.compile_drops(runecube=False, **drop_args)
    with_drops = droprates.compile_drops(runecube=True, **drop_args)

    if len(location_names) == 1 and location_names[0] == "*":
        location_names = list(
            set(without_drops.locations.keys()) | set(with_drops.locations.keys())
        )

    data = []
    for location_name in location_names:
        without_loc_drops = without_drops.locations.get(location_name)
        with_loc_drops = with_drops.locations.get(location_name)
        if without_loc_drops is None or with_loc_drops is None:
            continue

        items_names = set(without_loc_drops.items.keys()) | set(
            with_loc_drops.items.keys()
        )
        for item_name in items_names:
            without_item_drops = without_loc_drops.items.get(item_name)
            with_item_drops = with_loc_drops.items.get(item_name)
            if without_item_drops is None or with_item_drops is None:
                continue
            without_rate = (
                droprates.mode_for_drops(without_item_drops)[1]
                / without_item_drops.drops
            )
            with_rate = (
                droprates.mode_for_drops(with_item_drops)[1] / with_item_drops.drops
            )
            if drops is not None and with_item_drops.drops < drops:
                continue
            data.append(
                (
                    location_name,
                    item_name,
                    without_rate,
                    with_rate,
                    without_item_drops.drops,
                    with_item_drops.drops,
                )
            )

    data.sort(key=lambda row: row[2])

    table = rich.table.Table(box=rich.box.MINIMAL)
    if len(location_names) > 1:
        table.add_column("Location")
    table.add_column("Item")
    table.add_column("Without Rate")
    table.add_column("Without Drops")
    table.add_column("With Rate")
    table.add_column("With Drops")
    table.add_column("Diff")
    for (
        location_name,
        item_name,
        without_rate,
        with_rate,
        without_drops,
        with_drops,
    ) in data:
        difference = with_rate / without_rate
        color = None
        if difference > 1.1:
            color = "red"
        elif difference < 0.9:
            color = "green"
        row: list[str] = [
            item_name,
            f"{without_rate:.2f}",
            str(without_drops),
            f"{with_rate:.2f}",
            str(with_drops),
            f"{difference * 100:.2f}%",
        ]
        if len(location_names) > 1:
            row.insert(0, location_name)
        table.add_row(*row, style=color)

    console = rich.console.Console()
    console.print(table)


if __name__ == "__main__":
    typer.run(cmd_runecube)
