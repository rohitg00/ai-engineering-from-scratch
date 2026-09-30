from pathlib import Path
import json, subprocess, tempfile, sys, shutil

root = Path(__file__).resolve().parent
examples = root.parent / "examples"
from cli import run

cases = json.loads((examples / "cases.json").read_text())
baseline = json.loads((examples / "baseline.json").read_text())
for revision in ["candidate", "regressed"]:
    result = run(
        cases, baseline, json.loads((examples / (revision + ".json")).read_text())
    )
    print(json.dumps({"revision": revision, **result}, indent=2))
