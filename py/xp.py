import typer

import droprates
import fixtures


def value_per_hit(
    fishing: bool = False,
    verbose: bool = False,
    silver: bool = False,
    iron_depot: bool = False,
) -> dict[str, float]:
    items = {it.name: it for it in fixtures.load_items()}
    totals = {}
    for location, loc_drops in droprates.compile_drops(
        explore=not fishing,
        lemonade=not fishing,
        fish=fishing,
        net=fishing,
        lemonade_fake_explores=True,
        nets_fake_fishes=True,
        iron_depot=iron_depot,
    ).locations.items():
        loc_total = 0
        for item_name, drops in loc_drops.items.items():
            item = items.get(item_name)
            if item is None:
                if verbose:
                    print(f"Unknown item {item_name} in {location}")
                continue
            item_value = item.sell_price if silver else item.xp
            if not item_value:
                if verbose:
                    print(f"No value for {location} {item_name}")
                continue
            drops_per_hit = drops.drops / (drops.explores or drops.fishes)
            loc_total += drops_per_hit * item_value
        totals[location] = loc_total
    return totals


def xp_cmd(
    fishing: bool = False,
    verbose: bool = False,
    silver: bool = False,
    iron_depot: bool = False,
) -> None:
    for location, val in sorted(
        value_per_hit(fishing, verbose, silver, iron_depot).items(),
        key=lambda kv: kv[1],
    ):
        print(
            f"{location}: {val:.2f} {'silver' if silver else 'xp'} / {'fish' if fishing else 'explore'}"
        )


if __name__ == "__main__":
    typer.run(xp_cmd)
