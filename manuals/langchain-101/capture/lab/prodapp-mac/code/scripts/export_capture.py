import re
import shutil
import socket
import subprocess
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent
HOME = str(Path.home())
HOSTS = sorted({socket.gethostname().split(".")[0], socket.gethostname(),
                subprocess.run(["hostname", "-s"], capture_output=True, text=True).stdout.strip()} - {""}, key=len, reverse=True)
USER = Path.home().name
CODE = ["app", "tests", "load", "cost/cost_model.py", "cost/prices.json", "deploy", "data/faq.json", "pytest.ini",
        "requirements.lock", "scripts"]
RUNS = "runs/2026-11-15-real"
SKIP_SUFFIX = {".pyc"}
REPLACEMENTS = [
    (re.escape(HOME + "/.cache/aiefs-manuals-wip/langchain-research/prodapp"), "prodapp"),
    (re.escape(HOME), "~"),
    (re.escape("$TMPDIR"), "$TMPDIR"),
    *[(r"\b" + re.escape(h) + r"(\.local)?\b", "the-mac") for h in HOSTS],
    (r"\b" + re.escape(USER) + r"\b", "user"),
]
removed = {}


def scrub(text):
    for pattern, repl in REPLACEMENTS:
        text, n = re.subn(pattern, repl, text)
        if n:
            removed[repl] = removed.get(repl, 0) + n
    return text


def copy(src, dst):
    if src.is_dir():
        for child in sorted(src.iterdir()):
            if child.name in ("__pycache__", ".pytest_cache") or child.suffix in SKIP_SUFFIX:
                continue
            copy(child, dst / child.name)
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    try:
        dst.write_text(scrub(src.read_text()))
    except UnicodeDecodeError:
        shutil.copyfile(src, dst)


def main(out):
    out = Path(out)
    for item in CODE:
        copy(SRC / item, out / "code" / item)
    copy(SRC / RUNS, out / "runs")
    lines = [f"{repl}: {n} replacements" for repl, n in sorted(removed.items())]
    (out / "REDACTIONS.txt").write_text(
        "Scrubbed on export: home directory paths, the temporary directory, the host name, and the user name.\n"
        "Each line counts replacements by their placeholder. The original values are not recorded.\n" + "\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main(sys.argv[1])
