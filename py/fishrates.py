import parse_logs

totals = {}

for row in parse_logs.parse_logs("net"):
    zone_name = row["results"].get("location")
    if not zone_name:
        continue
    zone_totals = totals.setdefault(zone_name, {"nets": 0, "drops": {}})
    zone_totals["nets"] += 1
    for item in row["results"]["items"]:
        zone_totals["drops"][item["item"]] = zone_totals["drops"].get(item["item"], 0) + 1

for zone, zone_data in sorted(totals.items()):
    print(f"{zone} ({zone_data['nets']}):")
    zone_total = sum(zone_data["drops"].values())
    percs = {item: (count, (count / zone_total) * 100) for item, count in zone_data["drops"].items()}
    for item, (count, percent) in sorted(percs.items(), reverse=True, key=lambda kv: kv[1][1]):
        print(f"\t{item}: {percent:.4f}% ({count})")
