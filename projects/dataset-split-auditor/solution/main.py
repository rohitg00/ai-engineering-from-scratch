import hashlib
import math
import unicodedata


def fingerprint(text):
    if not isinstance(text, str):
        raise ValueError("text required")
    normalized = " ".join(unicodedata.normalize("NFKC", text).casefold().split())
    return hashlib.sha256(normalized.encode()).hexdigest()


def validate(records):
    seen = set()
    for r in records:
        if not isinstance(r, dict) or not all(
            (isinstance(r.get(k), str) and r[k] for k in ("id", "group", "text"))
        ):
            raise ValueError("id, group and text required")
        if r["id"] in seen:
            raise ValueError("duplicate record id")
        seen.add(r["id"])
    return records


def audit(train, test):
    validate(train + test)
    content = sorted(
        {fingerprint(r["text"]) for r in train} & {fingerprint(r["text"]) for r in test}
    )
    groups = sorted({r["group"] for r in train} & {r["group"] for r in test})
    return {
        "content_leaks": content,
        "group_leaks": groups,
        "clean": not content and (not groups),
    }


def split_groups(records, test_fraction=0.2, seed="course"):
    validate(records)
    if (
        not isinstance(test_fraction, (float, int))
        or not math.isfinite(test_fraction)
        or (not 0 < test_fraction < 1)
    ):
        raise ValueError("fraction must be between zero and one")
    train, test = ([], [])
    for r in records:
        value = (
            int(
                hashlib.sha256((str(seed) + "\x00" + r["group"]).encode()).hexdigest(),
                16,
            )
            / 2**256
        )
        (test if value < test_fraction else train).append(dict(r))
    return {"train": train, "test": test}


def summarize(train, test):
    evidence = audit(train, test)
    return {
        "train_rows": len(train),
        "test_rows": len(test),
        "train_groups": len({r["group"] for r in train}),
        "test_groups": len({r["group"] for r in test}),
        "audit": evidence,
        "usable": bool(train and test and evidence["clean"]),
    }
