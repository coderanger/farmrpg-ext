import fixtures

# Items that just have no properties.
ITEMS_WITH_NO_DATA = {
    "Feed",
}


def all_items_from_wiki_list():
    with open("item_list.tsv") as item_list:
        for line in item_list:
            yield line.split("\t")[0].strip()


def find_incomplete_items():
    for item in fixtures.load_fixture("items"):
        item_name = item.pop("name")
        if item_name in ITEMS_WITH_NO_DATA:
            continue
        item_id = item.pop("id")
        item.pop("image")
        if not item:
            yield item_name, f"https://farmrpg.com/index.php#!/item.php?id={item_id}"


def find_missing_items():
    all_items = set(all_items_from_wiki_list())
    known_items = set(it["name"] for it in fixtures.load_fixture("items"))
    return all_items - known_items


if __name__ == "__main__":
    print("INCOMPLETE:")
    for name, link in find_incomplete_items():
        print(f"{name}: {link}")
    print("MISSING:")
    for name in sorted(find_missing_items()):
        print(name)
