from pathlib import Path
import json, subprocess, tempfile, sys, shutil

root = Path(__file__).resolve().parent
examples = root.parent / "examples"
with tempfile.TemporaryDirectory(prefix="firewall-demo-") as folder:
    binary = Path(folder) / "app"
    subprocess.run(
        ["rustc", "--edition=2021", str(root / "cli.rs"), "-o", str(binary)],
        check=True,
        capture_output=True,
        text=True,
    )
    workspace = Path(folder) / "workspace"
    shutil.copytree(examples / "workspace", workspace)
    commands = [
        ["reader", "r1", "read", "notes.md"],
        ["reader", "r2", "write", "notes.md", str(examples / "approved-note.md")],
        [
            "editor",
            "r3",
            "write",
            "notes.md",
            str(examples / "approved-note.md"),
            "--approve",
        ],
    ]
    for command in commands:
        result = subprocess.run(
            [str(binary), str(workspace), *command], capture_output=True, text=True
        )
        print(
            json.dumps(
                {
                    "request_id": command[1],
                    "exit": result.returncode,
                    "result": json.loads(result.stdout)
                    if result.returncode == 0
                    else result.stderr.strip(),
                },
                indent=2,
            )
        )
