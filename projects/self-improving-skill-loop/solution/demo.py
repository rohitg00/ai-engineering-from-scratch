from pathlib import Path
import json, subprocess, tempfile, sys, shutil

root = Path(__file__).resolve().parent
examples = root.parent / "examples"
from cli import experiment, promote

result = experiment(json.loads((examples / "support-cases.json").read_text()))
print(
    json.dumps(
        {
            "candidate": result,
            "promotion": "not requested; inspect candidate digest before approval",
        },
        indent=2,
    )
)
