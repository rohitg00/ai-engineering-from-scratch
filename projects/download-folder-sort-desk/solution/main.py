from pathlib import Path, PurePosixPath
import hashlib, json


def inventory(folder):
    """Return sorted {path,size,sha256,suffix} records for regular files beneath folder. Reject symbolic links; paths are root-relative POSIX paths. Stream SHA-256 in 64 KiB chunks."""
    root = Path(folder)
    if root.is_symlink() or not root.is_dir():
        raise ValueError("folder must be a real directory")
    records = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError("symbolic links require separate review")
        if not path.is_file():
            continue
        digest = hashlib.sha256()
        with path.open("rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                digest.update(chunk)
        records.append(
            {
                "path": path.relative_to(root).as_posix(),
                "size": path.stat().st_size,
                "sha256": digest.hexdigest(),
                "suffix": path.suffix.lower(),
            }
        )
    return records


def categorize(record):
    """Return {category,scores,evidence}. A recognized extension earns 3 points; workshop/handout name words earn documents 1 point each. Highest positive score wins, alphabetic tie-break; no evidence means other."""
    names = {
        "documents": {".txt", ".md", ".pdf", ".docx"},
        "images": {".png", ".jpg", ".jpeg", ".svg"},
        "tables": {".csv", ".tsv", ".xlsx"},
        "archives": {".zip", ".gz", ".tar"},
    }
    scores = {k: 0 for k in names}
    evidence = []
    for category, extensions in names.items():
        if record["suffix"] in extensions:
            scores[category] += 3
            evidence.append(f"extension {record['suffix']}: {category} +3")
    stem = Path(record["path"]).stem.lower()
    for word in ("workshop", "handout"):
        if word in stem:
            scores["documents"] += 1
            evidence.append(f"name contains {word}: documents +1")
    best = sorted(scores, key=lambda c: (-scores[c], c))[0]
    return {
        "category": best if scores[best] else "other",
        "scores": scores,
        "evidence": evidence,
    }


def plan_moves(records, occupied=None):
    """Return schema_version=1 moves and duplicate_groups. Moves preserve original path/hash and choose category/basename, appending -2, -3 before suffix for case-insensitive collisions. occupied contains existing destination paths. No filesystem mutation."""
    used = {p.casefold() for p in occupied or []}
    moves = []
    groups = {}
    seen = set()
    for r in records:
        path = PurePosixPath(r["path"])
        if path.is_absolute() or ".." in path.parts or r["path"] in seen:
            raise ValueError("unsafe or duplicate source path")
        seen.add(r["path"])
        c = categorize(r)
        name = path.name
        dest = f"{c['category']}/{name}"
        n = 2
        while dest.casefold() in used:
            dest = f"{c['category']}/{path.stem}-{n}{path.suffix}"
            n += 1
        used.add(dest.casefold())
        moves.append({**r, **c, "destination": dest, "approved": False})
        groups.setdefault(r["sha256"], []).append(r["path"])
    return {
        "schema_version": 1,
        "moves": moves,
        "duplicate_groups": [
            {"sha256": h, "paths": p} for h, p in groups.items() if len(p) > 1
        ],
    }


def review_plan(folder, plan, decisions=None):
    """Validate current source bytes and optional {fingerprint,approved:[source paths]}; return plan with approved booleans plus fingerprint. Reject missing/changed files, traversal and unknown/duplicate approvals. This is the file-manager integration gate; it never moves files."""
    if plan.get("schema_version") != 1:
        raise ValueError("unsupported plan")
    unsigned = {key: value for key, value in plan.items() if key != "fingerprint"}
    unsigned["moves"] = [{**move, "approved": False} for move in plan["moves"]]
    fingerprint = hashlib.sha256(
        json.dumps(unsigned, sort_keys=True).encode()
    ).hexdigest()
    if decisions is not None and decisions.get("fingerprint") != fingerprint:
        raise ValueError("stale approval: source content or destination plan changed")
    current = {r["path"]: r for r in inventory(folder)}
    destinations = set()
    known = set()
    for m in plan["moves"]:
        d = PurePosixPath(m["destination"])
        if (
            d.is_absolute()
            or ".." in d.parts
            or m["destination"].casefold() in destinations
        ):
            raise ValueError("unsafe destination")
        destinations.add(m["destination"].casefold())
        known.add(m["path"])
        if m["path"] not in current or current[m["path"]]["sha256"] != m["sha256"]:
            raise ValueError("source changed")
    approved = (decisions or {}).get("approved", [])
    if len(set(approved)) != len(approved) or not set(approved) <= known:
        raise ValueError("invalid approval")
    return {
        **plan,
        "moves": [{**m, "approved": m["path"] in approved} for m in plan["moves"]],
        "fingerprint": fingerprint,
    }
