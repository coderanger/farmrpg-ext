import droprates

normal_drops = droprates.compile_drops(
    explore=True,
    lemonade=True,
    net=True,
    iron_depot=True,
    lemonade_fake_explores=True,
    nets_fake_fishes=True,
)

big_drops = droprates.compile_drops(
    explore=True,
    lemonade=True,
    net=True,
    iron_depot=True,
    lemonade_fake_explores=True,
    nets_fake_fishes=True,
    cider=True,
    palmer=True,
    large_net=True,
)

for loc in normal_drops.locations.keys() & big_drops.locations.keys():
    normal_loc = normal_drops.locations[loc]
    big_loc = big_drops.locations[loc]
    for item in normal_loc.items.keys() & big_loc.items.keys():
        normal_item = normal_loc.items[item]
        big_item = big_loc.items[item]
        normal_hits = normal_item.fishes or normal_item.explores
        big_hits = big_item.fishes or big_item.explores
        normal_rate = normal_hits / normal_item.drops
        big_rate = big_hits / big_item.drops
        rate_diff = big_rate - normal_rate
        rate_pct_diff = rate_diff * 100 / normal_rate
        if abs(rate_pct_diff) >= 5:
            print(f"{loc} {item}: {rate_pct_diff} {normal_rate:.2f} {big_rate:.2f}")
        else:
            # print(f"{loc} {item}: {rate_pct_diff}")
            pass
