from pathlib import Path
import json, subprocess, tempfile, sys, shutil

root = Path(__file__).resolve().parent
examples = root.parent / "examples"
from cli import run

print(
    json.dumps(
        run(
            *(
                json.loads((examples / (name + ".json")).read_text())
                for name in ["baseline", "candidate", "judgments"]
            )
        ),
        indent=2,
    )
)
