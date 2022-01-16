import datetime
import sys
from collections import Counter
from typing import Optional

import parse_logs


def farm_count(location: str, time_from: datetime.datetime, time_to: Optional[datetime.datetime] = None) -> dict[str, int]:
    totals = Counter()
    time_to = datetime.datetime.now()
    for row in parse_logs.parse_logs():
        if row.get("results", {}).get("location") != location:
            continue
        row_ts = datetime.datetime.fromtimestamp(row["ts"] / 1000)
        if time_from < row_ts < time_to:
            totals[row["type"]] += 1
            totals["stamina"] += row.get("results", {}).get("stamina", 0)
    return totals


if __name__ == "__main__":
    counts = farm_count(sys.argv[1], datetime.datetime.now() - datetime.timedelta(hours=int(sys.argv[2])))
    print(counts)
