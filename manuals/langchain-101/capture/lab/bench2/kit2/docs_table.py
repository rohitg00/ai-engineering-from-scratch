import json
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[3] / "docs-audit" / "live" / "pages" / "oss_python_deepagents_models.md"
COLS = ["overall", "file_operations", "retrieval", "tool_use", "memory", "conversation", "summarization"]


def parse(text):
    out = []
    for line in text.splitlines():
        if not line.startswith("| ") or "%" not in line:
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        model = cells[0].replace("\\_", "_")
        vals, runs = {}, {}
        for k, c in zip(COLS, cells[1:]):
            m = re.search(r"(\d+)%", c)
            vals[k] = int(m.group(1)) / 100 if m else None
            r = re.search(r"runs/(\d+)", c)
            runs[k] = r.group(1) if r else None
        out.append({"model": model, "scores": vals, "runs": runs, "distinct_runs": len({v for v in runs.values() if v})})
    return out


if __name__ == "__main__":
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else SRC
    rows = parse(src.read_text())
    dest = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "docs-eval-table.json"
    dest.write_text(json.dumps({"source": "docs.langchain.com oss/python/deepagents/models at docs commit 04d4d4a (live copy 2026-11-15)", "rows": rows}, indent=1))
    print(len(rows), "rows ->", dest)
