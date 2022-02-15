import datetime
import glob
import json
import os
from collections import Counter
from typing import Iterable


def log_files(include_current: bool = True) -> Iterable[str]:
    """Yield all the log files to scan."""
    yield from glob.glob("logs/*.json")
    if include_current:
        cur_log = os.path.expanduser("~/Downloads/log.json")
        if os.path.exists(cur_log):
            yield cur_log


def log_mtime(include_current: bool = True) -> float:
    """Return the mtime of the most recently changed log file."""
    return max(os.stat(p).st_mtime for p in log_files(include_current=include_current))


def parse_logs(log_type=None, since=int(os.environ.get("SINCE", 0))):
    # Parse the logs.
    all_logs = {}
    for log_file in log_files():
        log = json.load(open(log_file))
        for row in log:
            if log_type and row["type"] != log_type:
                continue
            if (row["ts"] / 1000) < since:
                continue
            # Clean up some bad data.
            items = row.get("results", {}).get("items", [])
            if items and "item" not in items[0]:
                continue

            if row["type"] == "cider" and "explores" not in row["results"]:
                # Backfill this.
                row["results"]["explores"] = (
                    1250 if row["results"]["stamina"] >= 750 else 1000
                )

            if row["type"] == "fish" and "items" not in row["results"]:
                row["results"]["items"] = [
                    {
                        "item": row["results"].pop("item"),
                        "overflow": row["results"].pop("overflow"),
                        "quantity": 1,
                    }
                ]

            if row["ts"] not in all_logs:
                # Fix up the old zone/loc thing.
                results = row.get("results")
                if results:
                    location = (
                        results.pop("zone", None)
                        or results.pop("loc", None)
                        or results.pop("location", None)
                    )
                    if location is not None:
                        results["location"] = location
                # Put it in the big blob.
                all_logs[row["ts"]] = row
    # Sort things on timestamp.
    for i, (_, row) in enumerate(sorted(all_logs.items(), key=lambda kv: kv[0])):
        row["id"] = i
        yield row


if __name__ == "__main__":
    # Compile the logs clean things up.
    all_logs = list(parse_logs())
    local_log_files = list(log_files(include_current=False))
    if len(local_log_files) > 1:
        # Move all the old logs into an archival folder (just in case).
        today = datetime.date.today()
        archive_folder = (
            f"old_logs/{datetime.datetime.now().isoformat().replace(':', '_')}"
        )
        os.mkdir(archive_folder)
        for file in local_log_files:
            os.rename(file, f"{archive_folder}/{os.path.basename(file)}")
        # Write out the compiled logs.
        with open("logs/log.json", "w") as out:
            json.dump(all_logs, out)
    # Print some stats.
    counts = Counter(row.get("type") for row in all_logs)
    print(" ".join(f"{k}={v}" for k, v in counts.items()))
