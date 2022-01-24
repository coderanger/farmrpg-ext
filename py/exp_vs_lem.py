import droprates
import lemonade

lem = lemonade.drop_rates()
# exp = droprates.rates_per_stam()
exp = droprates.drop_rates()

locations = set(lem.keys()) | set(exp.keys())

for loc in sorted(locations):
    print(f"{loc}:")
    lem_data = lem.get(loc, {})
    exp_data = exp.get(loc, {})
    items = set(lem_data.keys()) | set(exp_data.keys())
    for item in sorted(items):
        lem_rate = lem_data.get(item, 0)
        exp_rate = exp_data.get(item, 0)
        if lem_rate == 0 or exp_rate == 0:
            print(f"\t{item}: NO MATCH")
        else:
            print(f"\t{item}: {lem_rate / exp_rate}")
