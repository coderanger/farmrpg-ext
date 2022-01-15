import json
import re
from pathlib import Path

comment_re = re.compile(r"^//.*$")
export_re = re.compile(r"^export default ")


def load_fixture(name: str) -> list[dict]:
    # Load the data.
    fixture_path = Path(__file__) / ".." / ".." / "lib" / "fixtures" / f"{name}.js"
    raw_fixture = fixture_path.resolve().read_text().splitlines()
    # Remove any comments and then remove any leading blank lines.
    raw_fixture = [comment_re.sub("", line) for line in raw_fixture]
    while not raw_fixture[0].strip():
        raw_fixture.pop(0)
    # Remove the "export default " prefix.
    raw_fixture[0] = export_re.sub("", raw_fixture[0])
    # Parse it!
    return json.loads("\n".join(raw_fixture))
