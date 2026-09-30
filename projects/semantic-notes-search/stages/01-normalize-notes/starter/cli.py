"""Search a caller-owned markdown folder; no service or model required."""

import argparse, json
from pathlib import Path
from main import build_index, search


def run(folder, query, aliases=None, k=3):
    root = Path(folder).resolve()
    if not root.is_dir():
        raise ValueError("notes directory required")
    documents = {}
    for file in sorted(root.rglob("*.md")):
        if file.is_symlink() or not file.resolve().is_relative_to(root):
            raise ValueError("symlink notes are not supported")
        if file.stat().st_size > 100000:
            raise ValueError("note exceeds 100 KB")
        documents[str(file.relative_to(root))] = file.read_text(encoding="utf-8")
    rows = search(build_index(documents, aliases), query, k)
    return {
        "schema_version": 1,
        "query": query,
        "documents": len(documents),
        "matches": [{**row, "preview": documents[row["id"]][:240]} for row in rows],
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("folder")
    p.add_argument("query")
    p.add_argument("--aliases")
    p.add_argument("--k", type=int, default=3)
    p.add_argument("--out")
    a = p.parse_args()
    result = run(
        a.folder,
        a.query,
        json.loads(Path(a.aliases).read_text()) if a.aliases else {},
        a.k,
    )
    text = json.dumps(result, indent=2, ensure_ascii=False)
    if a.out:
        Path(a.out).write_text(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
