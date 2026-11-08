from pathlib import Path, PurePosixPath
import hashlib, json


def inventory(folder):
    """Return sorted {path,size,sha256,suffix} records for regular files beneath folder. Reject symbolic links; paths are root-relative POSIX paths. Stream SHA-256 in 64 KiB chunks."""
    raise NotImplementedError("Implement inventory using API.md and the stage lesson")


def categorize(record):
    """Return {category,scores,evidence}. A recognized extension earns 3 points; workshop/handout name words earn documents 1 point each. Highest positive score wins, alphabetic tie-break; no evidence means other."""
    raise NotImplementedError("Implement categorize using API.md and the stage lesson")


def plan_moves(records, occupied=None):
    """Return schema_version=1 moves and duplicate_groups. Moves preserve original path/hash and choose category/basename, appending -2, -3 before suffix for case-insensitive collisions. occupied contains existing destination paths. No filesystem mutation."""
    raise NotImplementedError("Implement plan_moves using API.md and the stage lesson")


def review_plan(folder, plan, decisions=None):
    """Validate current source bytes and optional {fingerprint,approved:[source paths]}; return plan with approved booleans plus fingerprint. Reject missing/changed files, traversal and unknown/duplicate approvals. This is the file-manager integration gate; it never moves files."""
    raise NotImplementedError("Implement review_plan using API.md and the stage lesson")
