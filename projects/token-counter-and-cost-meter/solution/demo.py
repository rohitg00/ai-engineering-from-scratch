from pathlib import Path
import json, subprocess, tempfile, sys, shutil

root = Path(__file__).resolve().parent
examples = root.parent / "examples"
args = ["examples/usage.json"]
args = [
    str(root.parent / value) if value.startswith("examples/") else value
    for value in args
]
subprocess.run([sys.executable, str(root / "usage.py"), *args], check=True)
