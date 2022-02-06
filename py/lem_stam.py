import droprates

if __name__ == "__main__":
    data = {}
    for loc, loc_data in droprates.total_drops().items():
        stamina = loc_data["stamina"]
        drops = loc_data["drops"]["ALL"]
        data[loc] = stamina / drops
    for loc, stam_per_drop in sorted(data.items(), key=lambda kv: kv[1]):
        print(f"{loc}: ten={stam_per_drop * 10:.1f} twenty={stam_per_drop * 20:.1f}")
