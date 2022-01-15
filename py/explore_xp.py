import droprates
import fixtures


def xp_per_stam() -> dict[str, float]:
    items = {it["name"]: it for it in fixtures.load_fixture("items")}
    totals = {}
    for location, loc_data in droprates.total_drops().items():
        loc_total = 0
        for item, drops in loc_data["drops"].items():
            item_xp = items.get(item, {}).get("xp")
            if not item_xp:
                # print(f"No XP for {location} {item}")
                continue
            drops_per_stam = drops / loc_data["stamina"]
            loc_total += drops_per_stam * item_xp
        totals[location] = loc_total
    return totals


if __name__ == "__main__":
    for location, val in sorted(xp_per_stam().items(), key=lambda kv: kv[1]):
        print(f"{location}: {val}")
