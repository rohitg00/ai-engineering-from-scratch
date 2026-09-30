import subprocess
import tempfile
from pathlib import Path

with tempfile.TemporaryDirectory() as directory:
    subprocess.run(
        [
            "go",
            "run",
            ".",
            "--before",
            "fixtures/before.html",
            "--after",
            "fixtures/after.html",
            "--out",
            directory,
        ],
        cwd=Path(__file__).parent,
        check=True,
    )
    print("Navigation counters and footer timestamps were filtered out.")
    print(
        "Run go run . --out ./web-change-output to keep the portable HTML, JSON and baseline."
    )
