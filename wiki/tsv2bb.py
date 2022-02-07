import csv
import io
from pathlib import Path


def tsv_to_bbcode(path: Path) -> str:
    out = io.StringIO()
    reader = csv.reader(path.open(), dialect="excel-tab")
    out.write("[table][tr]")
    # Spit out the first row as headers.
    for item in next(reader):
        out.write(f"[th]{item}[/th]")
    out.write("[/tr]")
    # Then the rest of the rows.
    for row in reader:
        out.write("[tr]")
        for item in row:
            out.write(f"[td]{item}[/td]")
        out.write("[/tr]")
    out.write("[/table]\n")
    return out.getvalue()


if __name__ == "__main__":
    import sys

    for arg in sys.argv[1:]:
        path = Path(arg)
        print(tsv_to_bbcode(path))
