import parse_logs

totals = {}

for row in parse_logs.parse_logs("explore"):
    zone_name = row["results"].get("location")
    if not zone_name:
        continue
    zone_totals = totals.setdefault(zone_name, {"stamina": 0, "drops": {}})
    zone_totals["stamina"] += row["results"]["stamina"]
    for item in row["results"]["items"]:
        zone_totals["drops"][item["item"]] = zone_totals["drops"].get(item["item"], 0) + 1
        zone_totals["drops"]["ALL"] = zone_totals["drops"].get("ALL", 0) + 1

combined_stam_per_drop = {}
for zone, zone_totals in sorted(totals.items()):
    print(f"{zone} ({zone_totals['stamina']}):")
    for item, drops in sorted(zone_totals["drops"].items()):
        stam_per_drop = zone_totals['stamina'] / drops
        if stam_per_drop < combined_stam_per_drop.get(item, 1000000000000):
            combined_stam_per_drop[item] = stam_per_drop
        print(f"\t{item}: {stam_per_drop} ({drops})")

print("Combined:")
for item, stam_per_drop in sorted(combined_stam_per_drop.items()):
    print(f"        \"{item}\": {stam_per_drop},")
