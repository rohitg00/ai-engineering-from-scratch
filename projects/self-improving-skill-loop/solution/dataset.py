"""Leakage-aware development split: identities, content and groups form components."""

import hashlib
import unicodedata


def fingerprint(text):
    return hashlib.sha256(
        " ".join(unicodedata.normalize("NFKC", text).casefold().split()).encode()
    ).hexdigest()


def split_cases(cases, holdout_fraction=0.25):
    if not 0 < holdout_fraction < 1:
        raise ValueError("fraction must lie inside zero and one")
    seen, parents, owners, labels = set(), {}, {}, {}

    def find(key):
        parents.setdefault(key, key)
        if parents[key] != key:
            parents[key] = find(parents[key])
        return parents[key]

    def union(a, b):
        a, b = find(a), find(b)
        parents[max(a, b)] = min(a, b)

    for case in cases:
        key, label, text = (case.get(k) for k in ("id", "label", "text"))
        if (
            not all(isinstance(x, str) and x.strip() for x in (key, label, text))
            or key in seen
        ):
            raise ValueError("unique id, text and label required")
        seen.add(key)
        find(key)
        content = fingerprint(text)
        if content in labels and labels[content] != label:
            raise ValueError("identical content has conflicting labels")
        labels[content] = label
        links = ["content:" + content]
        if case.get("group"):
            if not isinstance(case["group"], str):
                raise ValueError("group must be a string")
            links.append("group:" + case["group"])
        for link in links:
            if link in owners:
                union(key, owners[link])
            else:
                owners[link] = key
    members = {}
    for case in cases:
        members.setdefault(find(case["id"]), []).append(case)
    result = {"development": [], "holdout": []}
    for group in members.values():
        token = min(fingerprint(c["text"]) for c in group)
        score = int(token[:8], 16) / 2**32
        result["holdout" if score < holdout_fraction else "development"].extend(
            dict(c) for c in group
        )
    for rows in result.values():
        rows.sort(key=lambda c: c["id"])
    return result


def audit_partitions(development, holdout):
    a = {fingerprint(c["text"]) for c in development}
    b = {fingerprint(c["text"]) for c in holdout}
    ga = {c["group"] for c in development if c.get("group")}
    gb = {c["group"] for c in holdout if c.get("group")}
    result = {"content_leaks": sorted(a & b), "group_leaks": sorted(ga & gb)}
    result["usable"] = not result["content_leaks"] and not result["group_leaks"]
    return result
