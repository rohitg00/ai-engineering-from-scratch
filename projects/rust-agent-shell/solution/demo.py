from pathlib import Path
import json, subprocess, tempfile, sys, shutil

root = Path(__file__).resolve().parent
examples = root.parent / "examples"
args = ["examples/workspace", "examples/requests.jsonl"]
args = [
    str(root.parent / value) if value.startswith("examples/") else value
    for value in args
]
subprocess.run([sys.executable, str(root / "client.py"), *args], check=True)
