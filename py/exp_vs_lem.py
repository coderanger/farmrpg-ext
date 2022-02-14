import statistics
from typing import Optional

import typer

import droprates


def exp_vs_lem(drop_threshold: Optional[int] = None) -> None:
    explores = droprates.compile_drops(explore=True)
    lemonade = droprates.compile_drops(lemonade=True)
    for location in sorted(explores.locations.keys() | lemonade.locations.keys()):
        explore_loc = explores.locations[location]
        lemonade_loc = lemonade.locations[location]
        base_drop_rate = droprates.BASE_DROP_RATES[location]

        if explore_loc.explores == 0:
            print(f"{location} NO EXPLORES")
            continue
        if lemonade_loc.lemonades == 0:
            print(f"{location} NO LEMONADES")
            continue

        exp_vs_lem_rates = []
        adj_exp_vs_lem_rates = []

        for item in sorted(explore_loc.items.keys() | lemonade_loc.items.keys()):
            if explore_loc.items[item].drops == 0:
                print(f"{location} {item} NO EXPLORE DROPS")
                continue
            if lemonade_loc.items[item].drops == 0:
                print(f"{location} {item} NO LEMONADE DROPS")
                continue
            if drop_threshold is not None and (
                explore_loc.items[item].drops < drop_threshold
                or lemonade_loc.items[item].drops < drop_threshold
            ):
                print(f"{location} {item} NOT ENOUGH DROPS")
                continue

            explore_drop_rate = explore_loc.items[item].drops / explore_loc.drops
            lemonade_drop_rate = lemonade_loc.items[item].drops / lemonade_loc.drops
            drops_per_explore = (
                explore_loc.items[item].drops / explore_loc.items[item].explores
            )
            adjusted_drops_per_explore = drops_per_explore / base_drop_rate
            exp_vs_lem_rate = explore_drop_rate / lemonade_drop_rate
            adj_exp_vs_lem_rate = adjusted_drops_per_explore / lemonade_drop_rate
            print(f"{location} {item} {exp_vs_lem_rate:.3f} {adj_exp_vs_lem_rate:.3f}")
            exp_vs_lem_rates.append(exp_vs_lem_rate)
            adj_exp_vs_lem_rates.append(adj_exp_vs_lem_rate)

        if exp_vs_lem_rates and adj_exp_vs_lem_rates:
            print(
                f"{location} AVERAGE {statistics.mean(exp_vs_lem_rates):.3f} {statistics.mean(adj_exp_vs_lem_rates):.3f}"
            )


if __name__ == "__main__":
    typer.run(exp_vs_lem)
