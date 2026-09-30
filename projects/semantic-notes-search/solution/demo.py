from pathlib import Path
import json, subprocess, tempfile, sys, shutil

root = Path(__file__).resolve().parent
examples = root.parent / "examples"
from cli import run

aliases = json.loads((examples / "aliases.json").read_text())
print(
    json.dumps(
        {
            "without_alias": run(examples / "notes", "release replicas"),
            "with_alias": run(examples / "notes", "release replicas", aliases),
            "unicode": run(examples / "notes", "cafe\u0301"),
        },
        indent=2,
        ensure_ascii=False,
    )
)
