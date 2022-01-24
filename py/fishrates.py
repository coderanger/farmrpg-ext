import fixtures
import parse_logs


def net_totals() -> dict[str, dict[str:float]]:
    totals = {}
    for row in parse_logs.parse_logs("net"):
        zone_name = row["results"].get("location")
        if not zone_name:
            continue
        zone_totals = totals.setdefault(zone_name, {"nets": 0, "drops": {}})
        zone_totals["nets"] += 1
        for item in row["results"]["items"]:
            zone_totals["drops"][item["item"]] = (
                zone_totals["drops"].get(item["item"], 0) + 1
            )
    return totals


def net_rates() -> dict[str, dict[str:float]]:
    rates = {}
    for zone, zone_data in net_totals().items():
        zone_total = sum(zone_data["drops"].values())
        rates[zone] = {
            item: count / zone_total for item, count in zone_data["drops"].items()
        }
    return rates


if __name__ == "__main__":
    prices = {}
    for item in fixtures.load_items():
        if item.sell_price:
            prices[item.name] = item.sell_price

    for zone, zone_data in sorted(net_totals().items()):
        print(f"{zone} ({zone_data['nets']}):")
        zone_total = sum(zone_data["drops"].values())
        percs = {
            item: (count, (count / zone_total) * 100)
            for item, count in zone_data["drops"].items()
        }
        value_of_drop = 0
        for item, (count, percent) in sorted(
            percs.items(), reverse=True, key=lambda kv: kv[1][1]
        ):
            print(f"\t{item}: {percent:.4f}% ({count})")
            if item in prices:
                value_of_drop += (percent / 100) * prices[item]
        print(f"\tNet: {value_of_drop * 15}")
