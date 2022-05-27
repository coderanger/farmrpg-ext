import fixtures

item_ids = {int(it.id) for it in fixtures.load_items()}
max_id = max(item_ids)

# Start at 11 because 1-10 were never used.
for i in range(11, max_id + 1):
    if i not in item_ids:
        print(f"Missing: https://farmrpg.com/index.php#!/item.php?id={i}")

print(f"New: https://farmrpg.com/index.php#!/item.php?id={max_id+1}")
