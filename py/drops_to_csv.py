import csv
import sys

import droprates

if __name__ == "__main__":
    out = csv.DictWriter(sys.stdout, ["Location", "Item", "Total Location Stamina", "Item Drops"])
    out.writeheader()
    for location, loc_data in droprates.total_drops().items():
        for item, drops in loc_data["drops"].items():
            out.writerow({
                "Location": location,
                "Item": item,
                "Total Location Stamina": loc_data["stamina"],
                "Item Drops": drops,
            })
