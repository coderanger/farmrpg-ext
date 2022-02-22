from collections import Counter

import parse_logs

harvests = 0
totals = Counter()

for row in parse_logs.parse_logs("harvestall"):
    results = row["results"]
    seeds = Counter(c["seed"] for c in results["crops"])
    drops = {i["item"]: i["quantity"] for i in results["items"]}

    focus_seeds = seeds.get("Pea Seeds")
    drops.pop("Peas", None)
    if focus_seeds and drops:
        print(f"{focus_seeds=} {drops=}")
        totals.update(drops)
    harvests += focus_seeds or 0

print(harvests)
print(totals)
