import fixtures

max_id = max(int(it.id) for it in fixtures.load_items())
print(f"https://farmrpg.com/index.php#!/item.php?id={max_id+1}")
