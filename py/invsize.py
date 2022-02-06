import math
import sys


def gold_for_invsize(size: int) -> int:
    size -= 100  # Starting inventory
    increases = math.ceil(size / 50)
    # Starts at 15, increments by 15 for each +50.
    return sum(range(15, 15 * (increases + 1), 15))


def test_gold_for_invsize():
    assert gold_for_invsize(300) == 150


def gold_to_dollars(gold: int) -> int:
    # 6,500 gold == $200
    return math.ceil(gold / 6500) * 200


def test_gold_to_dollars():
    assert gold_to_dollars(10000) == 400


if __name__ == "__main__":
    invsize = int(sys.argv[1])
    gold = gold_for_invsize(invsize)
    dollars = gold_to_dollars(gold)
    print(f"{invsize} is {gold} gold or ${dollars}")
