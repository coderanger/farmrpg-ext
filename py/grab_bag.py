import math
from collections import Counter, defaultdict

import typer

import fixtures
import parse_logs


def cmd_grab_bag():
    items = {it.id: it for it in fixtures.load_items()}
    grab_bags = defaultdict(lambda: defaultdict(list))
    bag_counts = Counter()
    for row in parse_logs.parse_logs("locksmith"):
        item = items[row["results"]["id"]]
        if not item.name.startswith("Grab Bag"):
            continue
        bag_counts[item.name] += 1
        for output in row["results"]["items"]:
            grab_bags[item.name][output["item"]].append(
                int(output["quantity"]) / int(row["results"]["quantity"])
            )
        if int(row["results"]["quantity"]) == 1 and len(row["results"]["items"]) != 1:
            raise ValueError(f"{item.name} not behaving like a grab bag: {row}")
    for bag, bag_items in sorted(grab_bags.items()):
        print(f"{bag}: (x{bag_counts[bag]})")
        for item, counts in sorted(bag_items.items()):
            print(
                f"\t{item}: {math.floor(min(counts))}-{math.ceil(max(counts))} ({sum(counts)/len(counts):.2f})"
            )


if __name__ == "__main__":
    typer.run(cmd_grab_bag)
