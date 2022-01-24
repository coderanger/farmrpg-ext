import sys

import parse_logs


def total_drops() -> dict[str, dict[str, int]]:
    totals = {}
    for row in parse_logs.parse_logs("explore"):
        location_name = row["results"].get("location")
        if not location_name:
            continue
        loc_data = totals.setdefault(location_name, {"stamina": 0, "drops": {}})
        loc_data["stamina"] += row["results"]["stamina"]
        for item in row["results"]["items"]:
            loc_data["drops"][item["item"]] = loc_data["drops"].get(item["item"], 0) + 1
            loc_data["drops"]["ALL"] = loc_data["drops"].get("ALL", 0) + 1
    return totals


def rates_per_stam() -> dict[str, dict[str, float]]:
    rates = {}
    for loc, loc_data in total_drops().items():
        loc_rates = {}
        for item, drops in loc_data["drops"].items():
            if item == "ALL":
                continue
            loc_rates[item] = drops / loc_data["stamina"]
        rates[loc] = loc_rates
    return rates


def drop_rates() -> dict[str, dict[str, float]]:
    rates = {}
    for loc, loc_data in total_drops().items():
        zone_total = sum(
            drops for item, drops in loc_data["drops"].items() if item != "ALL"
        )
        loc_rates = {}
        for item, drops in loc_data["drops"].items():
            if item == "ALL":
                continue
            loc_rates[item] = drops / zone_total
        rates[loc] = loc_rates
    return rates


if __name__ == "__main__":
    item_filter = sys.argv[1] if len(sys.argv) > 1 else None
    combined_stam_per_drop = {}
    for zone, zone_totals in sorted(total_drops().items()):
        print(f"{zone} ({zone_totals['stamina']}):")
        for item, drops in sorted(zone_totals["drops"].items()):
            if item_filter and item != item_filter:
                continue
            stam_per_drop = zone_totals["stamina"] / drops
            if stam_per_drop < combined_stam_per_drop.get(item, 1000000000000):
                combined_stam_per_drop[item] = stam_per_drop
            print(f"\t{item}: {stam_per_drop} ({drops})")

    print("Combined:")
    for item, stam_per_drop in sorted(combined_stam_per_drop.items()):
        print(f'        "{item}": {stam_per_drop},')
