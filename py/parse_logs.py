import datetime
import glob
import json
import os
from collections import Counter


def parse_logs(log_type=None, since=int(os.environ.get("SINCE", 0))):
    # Find all the log files to scan.
    log_files = glob.glob("logs/*.json")
    if os.path.exists("/Users/coderanger/Downloads/log.json"):
        log_files.append("/Users/coderanger/Downloads/log.json")
    # Parse the logs.
    all_logs = {}
    for log_file in log_files:
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
    log_files = glob.glob("logs/*.json")
    if len(log_files) > 1:
        # Move all the old logs into an archival folder (just in case).
        today = datetime.date.today()
        archive_folder = (
            f"old_logs/{datetime.datetime.now().isoformat().replace(':', '_')}"
        )
        os.mkdir(archive_folder)
        for file in log_files:
            os.rename(file, f"{archive_folder}/{os.path.basename(file)}")
        # Write out the compiled logs.
        with open("logs/log.json", "w") as out:
            json.dump(all_logs, out)
    # Print some stats.
    counts = Counter(row.get("type") for row in all_logs)
    print(" ".join(f"{k}={v}" for k, v in counts.items()))
