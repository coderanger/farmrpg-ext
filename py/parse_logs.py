import glob
import json
import os.path


def parse_logs(log_type=None):
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
            if row["ts"] not in all_logs:
                # Fix up the old zone/loc thing.
                results = row.get("results")
                if results:
                    location = results.pop("zone", None) or results.pop("loc", None) or results.pop("location", None)
                    if location is not None:
                        results["location"] = location
                # Put it in the big blob.
                all_logs[row["ts"]] = row
    # Sort things on timestamp.
    for _, row in sorted(all_logs.items(), key=lambda kv: kv[0]):
        yield row


if __name__ == '__main__':
    pass
    # print(list(parse_logs()))
    # for row
