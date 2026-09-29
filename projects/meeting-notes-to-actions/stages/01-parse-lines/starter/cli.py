"""Create a source-linked commitment inbox; export only explicitly approved actions."""

import argparse
import csv
import hashlib
import html
import io
import json
import re
from pathlib import Path
from main import parse_notes, validate_action, publish


def proposals(text):
    rows = parse_notes(text)
    for number, line in enumerate(text.splitlines(), 1):
        match = re.fullmatch(
            r"([A-Za-z][A-Za-z ]{0,40}) will (.+) by (\d{4}-\d{2}-\d{2})\.?",
            line.strip(),
        )
        if match:
            rows.append(
                {
                    "owner": match[1],
                    "task": match[2],
                    "due": match[3],
                    "lines": [number],
                    "source": line,
                    "proposal": True,
                }
            )
    return rows


def inbox(text, today, decisions):
    if not isinstance(decisions, dict):
        raise ValueError("decisions must be an object mapping action ids to choices")
    report = publish(proposals(text), today)
    for row in report["actions"]:
        row["id"] = hashlib.sha256(
            json.dumps(
                [row["owner"], row["due"], row["task"], row["lines"]],
                separators=(",", ":"),
            ).encode()
        ).hexdigest()[:16]
    current_ids = {row["id"] for row in report["actions"]}
    unknown = set(decisions) - current_ids
    if unknown:
        raise ValueError("unknown or stale action ids: " + ", ".join(sorted(map(str, unknown))))
    for row in report["actions"]:
        choice = decisions.get(row["id"], "pending")
        if choice not in ["pending", "approved", "rejected"]:
            raise ValueError("unknown review decision")
        if choice == "approved" and row["flags"]:
            raise ValueError("cannot approve missing owner or due date")
        row["decision"] = choice
    report["schema_version"] = 1
    report["source_sha256"] = hashlib.sha256(text.encode()).hexdigest()
    report["approved"] = [r for r in report["actions"] if r["decision"] == "approved"]
    items = "".join(
        "<li><strong>"
        + html.escape(r["owner"])
        + "</strong> "
        + html.escape(r["task"])
        + " <b>"
        + r["decision"]
        + '</b> <select data-id="'
        + r["id"]
        + '"'
        + (" disabled" if r["flags"] else "")
        + ">"
        + "".join(
            "<option" + (" selected" if choice == r["decision"] else "") + ">" + choice + "</option>"
            for choice in ("pending", "approved", "rejected")
        )
        + '</select> <a href="#line-'
        + str(r["lines"][0])
        + '">source</a><code>'
        + r["id"]
        + "</code></li>"
        for r in report["actions"]
    )
    source = "".join(
        '<div id="line-'
        + str(n)
        + '"><b>'
        + str(n)
        + "</b> "
        + html.escape(line)
        + "</div>"
        for n, line in enumerate(text.splitlines(), 1)
    )
    report["html"] = (
        '<!doctype html><meta charset="utf-8"><title>Commitment inbox</title><h1>Review commitments</h1><p>Approve by adding the displayed id to a decisions JSON file. Unknown commitments cannot be approved.</p><button id="download">Download review decisions</button><ul>'
        + items
        + "</ul><h2>Original notes</h2><pre>"
        + source
        + '</pre><script>document.getElementById("download").onclick=()=>{const decisions=Object.fromEntries([...document.querySelectorAll("select[data-id]")].map(e=>[e.dataset.id,e.value]));const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(decisions,null,2)],{type:"application/json"}));a.download="decisions.json";a.click();URL.revokeObjectURL(a.href);};</script>'
    )
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("notes", type=Path)
    parser.add_argument("--today", required=True)
    parser.add_argument("--decisions", type=Path)
    parser.add_argument("--output", type=Path, default=Path("actions.json"))
    parser.add_argument("--html", type=Path, default=Path("actions.html"))
    parser.add_argument("--csv", type=Path)
    args = parser.parse_args()
    report = inbox(
        args.notes.read_text(),
        args.today,
        json.loads(args.decisions.read_text()) if args.decisions else {},
    )
    args.html.write_text(report.pop("html"))
    if args.csv:
        with args.csv.open("w", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=["id", "owner", "due", "task"])
            writer.writeheader()
            writer.writerows(
                {k: r[k] for k in writer.fieldnames} for r in report["approved"]
            )
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
