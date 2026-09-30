from pathlib import Path
import json, subprocess, tempfile, sys, shutil

root = Path(__file__).resolve().parent
examples = root.parent / "examples"
from cli import ingest, query

with tempfile.TemporaryDirectory(prefix="orchard-freshness-") as folder:
    index = Path(folder) / "index.json"
    before = ingest(index, json.loads((examples / "before.json").read_text()))
    old = query(index, "tokens", 110, 60)
    after = ingest(index, json.loads((examples / "after.json").read_text()))
    print(
        json.dumps(
            {
                "before": old,
                "changes": after,
                "after": query(index, "tokens", 210, 60),
                "expired": query(index, "tokens", 500, 60),
            },
            indent=2,
        )
    )
