from datetime import date
import html
import re


def parse_notes(text):
    if not isinstance(text, str):
        raise ValueError("notes must be text")
    rows = []
    for line, raw in enumerate(text.splitlines(), 1):
        if not raw.lstrip().startswith("ACTION "):
            continue
        parts = raw.strip()[7:].split("|", 2)
        if len(parts) != 3:
            raise ValueError(f"malformed action on line {line}")
        owner, due, task = (p.strip() for p in parts)
        rows.append(
            {"owner": owner, "due": due, "task": task, "lines": [line], "source": raw}
        )
    return rows


def validate_action(action):
    if not isinstance(action, dict) or not all(
        (
            isinstance(action.get(k), str) and action[k].strip()
            for k in ("owner", "due", "task")
        )
    ):
        raise ValueError("nonempty action fields required")
    lines = action.get("lines")
    if (
        not isinstance(lines, list)
        or not lines
        or any(
            not isinstance(line, int) or isinstance(line, bool) or line < 1
            for line in lines
        )
    ):
        raise ValueError("nonempty list of positive integer source lines required")
    flags = []
    if action["owner"] == "?":
        flags.append("needs_owner")
    if action["due"] == "?":
        flags.append("needs_date")
    else:
        if not re.fullmatch("\\d{4}-\\d{2}-\\d{2}", action["due"]):
            raise ValueError("ISO date required")
        date.fromisoformat(action["due"])
    return {**action, "flags": flags}


def deduplicate(actions):
    result = {}
    for action in actions:
        checked = validate_action(action)
        key = tuple(
            (" ".join(checked[k].casefold().split()) for k in ("owner", "due", "task"))
        )
        if key in result:
            result[key]["lines"] = sorted(set(result[key]["lines"] + checked["lines"]))
        else:
            result[key] = {**checked, "lines": list(checked["lines"])}
    return list(result.values())


def publish(actions, today):
    now = date.fromisoformat(today)
    rows = deduplicate(actions)
    ready = review = overdue = 0
    parts = []
    for r in rows:
        is_overdue = r["due"] != "?" and date.fromisoformat(r["due"]) < now
        ready += not r["flags"]
        review += bool(r["flags"])
        overdue += is_overdue
        fields = " | ".join((html.escape(r[k]) for k in ("owner", "due", "task")))
        label = "review: " + ", ".join(r["flags"]) if r["flags"] else "ready"
        parts.append(
            "<li>"
            + fields
            + " <small>lines "
            + ",".join(html.escape(str(line)) for line in r["lines"])
            + "; "
            + label
            + ("; overdue" if is_overdue else "")
            + "</small></li>"
        )
    return {
        "html": '<!doctype html><meta charset="utf-8"><title>Action review</title><h1>Meeting actions</h1><ul>'
        + "".join(parts)
        + "</ul>",
        "ready": ready,
        "review": review,
        "overdue": overdue,
        "actions": rows,
    }
