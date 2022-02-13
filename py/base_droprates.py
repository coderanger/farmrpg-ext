from fractions import Fraction

import typer

import droprates


def base_droprates(cider: bool = False, limit: int = 20) -> None:
    for loc, loc_explores in sorted(
        droprates.compile_drops(explore=True, cider=cider).locations.items()
    ):
        drops_per_explore = loc_explores.drops / loc_explores.explores
        rounded = Fraction(drops_per_explore).limit_denominator(limit)
        num, denom = rounded.as_integer_ratio()
        print(f"{loc}: {num}/{denom} ({loc_explores.explores})")


if __name__ == "__main__":
    typer.run(base_droprates)
