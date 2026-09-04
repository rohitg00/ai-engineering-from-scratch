"""Validate migration-review Skill arguments without reading the filesystem."""

from __future__ import annotations

import json
import sys
from pathlib import PurePosixPath


def validate_paths(paths: list[str]) -> dict[str, object]:
    accepted: list[str] = []
    rejected: list[dict[str, str]] = []
    for raw in paths:
        normalized = raw.replace("\\", "/")
        path = PurePosixPath(normalized)
        reason = ""
        if path.is_absolute() or ".." in path.parts:
            reason = "path must be repository-relative without parent traversal"
        elif not path.parts or path.parts[0] != "migrations":
            reason = "path must be under migrations/"
        elif path.suffix.lower() not in {".sql", ".py"}:
            reason = "migration file must end in .sql or .py"
        if reason:
            rejected.append({"path": raw, "reason": reason})
        else:
            accepted.append(normalized)
    if not paths:
        rejected.append({"path": "", "reason": "at least one migration path is required"})
    return {
        "status": "valid" if not rejected else "blocked",
        "accepted": accepted,
        "rejected": rejected,
    }


def main(argv: list[str]) -> int:
    result = validate_paths(argv)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["status"] == "valid" else 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
