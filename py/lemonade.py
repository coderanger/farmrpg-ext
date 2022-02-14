from collections import Counter

import fixtures
import parse_logs


def total_drops():
    totals = {}
    for row in parse_logs.parse_logs("lemonade"):
        zone_name = row["results"].get("location")
        if not zone_name:
            continue
        zone_totals = totals.setdefault(zone_name, {"lemonades": 0, "drops": {}})
        zone_totals["lemonades"] += 1
        for item in row["results"]["items"]:
            zone_totals["drops"][item["item"]] = (
                zone_totals["drops"].get(item["item"], 0) + 1
            )
    return totals


def drop_rates() -> dict[str, dict[str, float]]:
    rates = {}
    for zone, zone_data in total_drops().items():
        zone_total = sum(zone_data["drops"].values())
        rates[zone] = {
            item: count / zone_total for item, count in zone_data["drops"].items()
        }
    return rates


if __name__ == "__main__":
    items = {it.name: it for it in fixtures.load_items()}

    for zone, zone_data in sorted(total_drops().items()):
        print(f"{zone} ({zone_data['lemonades']}):")
        zone_total = sum(zone_data["drops"].values())
        percs = {
            item: (count, (count / zone_total) * 100)
            for item, count in zone_data["drops"].items()
        }
        for item, (count, percent) in sorted(
            percs.items(), reverse=True, key=lambda kv: kv[1][1]
        ):
            print(f"\t{item}: {percent:.4f}% ({count})")

        drops_by_rarity: Counter[str] = Counter()
        for item, count in zone_data["drops"].items():
            drops_by_rarity[items[item].rarity or "NONE"] += count
        for rarity, count in sorted(drops_by_rarity.items()):
            print(f"\t{rarity.upper()}: {(count * 100 / zone_total):.4f}")
