from pathlib import Path
import json, subprocess, tempfile, sys, shutil

root = Path(__file__).resolve().parent
examples = root.parent / "examples"
with tempfile.TemporaryDirectory(prefix="native-demo-") as folder:
    binary = Path(folder) / "app"
    subprocess.run(
        ["rustc", "--edition=2021", str(root / "cli.rs"), "-o", str(binary)],
        check=True,
        capture_output=True,
        text=True,
    )
    args = ["examples/orchard-release", "2000", "--activate", "references/restore.md"]
    args = [
        str(root.parent / value) if value.startswith("examples/") else value
        for value in args
    ]
    subprocess.run([str(binary), *args], check=True)
