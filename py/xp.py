import typer

import droprates
import fixtures


def xp_per_hit(fishing: bool = False, verbose: bool = False) -> dict[str, float]:
    items = {it["name"]: it for it in fixtures.load_fixture("items")}
    totals = {}
    for location, loc_drops in droprates.compile_drops(
        explore=not fishing,
        lemonade=not fishing,
        fish=fishing,
        net=fishing,
        lemonade_fake_explores=True,
        nets_fake_fishes=True,
    ).locations.items():
        loc_total = 0
        for item, drops in loc_drops.items.items():
            item_xp = items.get(item, {}).get("xp")
            if not item_xp:
                if verbose:
                    print(f"No XP for {location} {item}")
                continue
            drops_per_hit = drops.drops / (drops.explores or drops.fishes)
            loc_total += drops_per_hit * item_xp
        totals[location] = loc_total
    return totals


def xp_cmd(fishing: bool = False) -> None:
    for location, val in sorted(xp_per_hit(fishing).items(), key=lambda kv: kv[1]):
        print(f"{location}: {val:.2f} xp / {'fish' if fishing else 'explore'}")


if __name__ == "__main__":
    typer.run(xp_cmd)
