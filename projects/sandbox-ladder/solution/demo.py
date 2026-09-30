from pathlib import Path
import json, subprocess, tempfile, sys, shutil

root = Path(__file__).resolve().parent
examples = root.parent / "examples"
args = ["untrusted=true,secrets=true,network=true,host_kernel=false", "--budget", "3"]
args = [
    str(root.parent / value) if value.startswith("examples/") else value
    for value in args
]
subprocess.run([sys.executable, str(root / "cli.py"), *args], check=True)
