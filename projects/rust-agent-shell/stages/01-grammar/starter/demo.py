import pathlib, subprocess, tempfile
root = pathlib.Path(__file__).resolve().parent
with tempfile.TemporaryDirectory(prefix="rust-project-") as directory:
    binary = pathlib.Path(directory) / "demo"
    subprocess.run(["rustc", "--edition", "2021", str(root / "main.rs"), "-o", str(binary)], check=True)
    subprocess.run([str(binary), "--demo"], cwd=root, check=True)
