import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "runs/2026-11-15-real/suite")


def transcript(record):
    out = []
    for entry in record["log"]:
        result = entry["result"]
        if isinstance(result, int):
            out.append({"op": entry["op"], "http": result})
            continue
        text = "".join(d["text"] for e, d in result if e == "token")
        tools = [(d["name"], d["args"]) for e, d in result if e == "tool_call"]
        statuses = [(d["name"], d["status"]) for e, d in result if e == "tool_result"]
        stops = [d.get("name") for e, d in result if e == "interrupt"]
        done = [d for e, d in result if e == "done"]
        out.append({"op": entry["op"], "say": entry.get("text") or entry.get("decision"), "tool_calls": tools,
                    "tool_results": statuses, "interrupts": stops, "reply": text[:300],
                    "done": done[0] if done else None})
    return out


def main():
    summary = {}
    for model_dir in sorted(p for p in ROOT.iterdir() if p.is_dir()):
        reps = []
        for rep in sorted(model_dir.glob("rep-*")):
            junit = rep / "junit.xml"
            if not junit.exists():
                continue
            cases = {}
            for tc in ET.parse(junit).getroot().iter("testcase"):
                name = tc.get("name")
                failure = tc.find("failure")
                if failure is None:
                    failure = tc.find("error")
                cases[name] = {"outcome": "failed" if failure is not None else ("skipped" if tc.find("skipped") is not None else "passed"),
                               "seconds": float(tc.get("time")),
                               "message": (failure.get("message") or "")[:400] if failure is not None else None}
            details = {}
            for path in sorted((rep / "cases").glob("*.json")) if (rep / "cases").exists() else []:
                record = json.loads(path.read_text())
                details[record["case"]] = {"refunds": record["refunds"], "tickets": record["tickets"],
                                           "transcript": transcript(record)}
            block = (rep / "block.txt").read_text().splitlines()
            reps.append({"rep": rep.name, "block": block, "cases": cases, "details": details,
                         "passed": sum(c["outcome"] == "passed" for c in cases.values()), "total": len(cases)})
        summary[model_dir.name] = reps
    out = ROOT.parent / "summary"
    out.mkdir(exist_ok=True)
    (out / "suite-mac.json").write_text(json.dumps(summary, indent=1, default=str))
    for model, reps in summary.items():
        print(model, [f"{r['passed']}/{r['total']}" for r in reps])
        names = sorted({n for r in reps for n in r["cases"]})
        for n in names:
            marks = "".join("." if r["cases"].get(n, {}).get("outcome") == "passed" else "F" for r in reps)
            if "F" in marks:
                print(f"   {marks} {n}")


if __name__ == "__main__":
    main()
