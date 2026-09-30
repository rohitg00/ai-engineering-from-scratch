import subprocess
import sys
import tempfile
from pathlib import Path

root = Path(__file__).parent
with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(
        [
            sys.executable,
            str(root / "pipeline.py"),
            "--input",
            str(root / "fixtures/repair-note.wav"),
            "--transcript-file",
            str(root / "fixtures/reference.json"),
            "--out",
            tmp,
        ],
        check=True,
    )
print(
    "Run pipeline.py with --endpoint for actual speech recognition; the fixture demo uses supplied reference text."
)
