import json
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

R = Path("runs/2026-11-15-real")
F = R / "fix"
CASES = ["refund_approved_once", "refund_rejected_has_no_side_effect", "refund_asked_twice",
         "refund_tool_replay_is_idempotent", "new_message_while_waiting_for_approval", "status_then_refund_in_one_thread"]
CRASH = "test_kill_mid_refund_then_resume_refunds_once"


def junit(path):
    out = {}
    for tc in ET.parse(path).getroot().iter("testcase"):
        bad = tc.find("failure") is not None or tc.find("error") is not None
        out[tc.get("name").replace("test_eval[", "").rstrip("]")] = "failed" if bad else "passed"
    return out


def run(root, model):
    reps = []
    for rep in sorted((root / model).glob("rep-*")):
        if not (rep / "junit.xml").exists():
            continue
        outcomes = junit(rep / "junit.xml")
        rows, proposals = {}, []
        for case in CASES:
            hits = list((rep / "cases").glob(f"*-{case}.json"))
            if not hits:
                continue
            record = json.loads(hits[0].read_text())
            rows[case] = record["refunds"]
            for entry in record["log"]:
                if isinstance(entry["result"], list):
                    for kind, data in entry["result"]:
                        if kind == "interrupt":
                            proposals.append({"case": case, "amount_cents": data["args"].get("amount_cents"),
                                              "description": data.get("description")})
                        if kind == "tool_result" and data["name"] == "refund_order":
                            proposals.append({"case": case, "result": data["content"]})
        reps.append({"rep": rep.name, "outcomes": {k: v for k, v in outcomes.items() if k in CASES + [CRASH]},
                     "refund_rows": rows, "approvals_and_results": proposals,
                     "block": (rep / "block.txt").read_text().splitlines()})
    return reps


def main(out):
    result = {"after": {}, "before": {}, "crash_after": {}, "crash_suite_after": {}, "load": {},
              "note": "crash test results inside fix/suite were recorded with a broken parser and are replaced by fix/suite-crash"}
    for model in ("qwen3-4b", "qwen3-14b"):
        result["after"][model] = run(F / "suite", model)
        for rep in result["after"][model]:
            rep["outcomes"].pop(CRASH, None)
        suite_crash = []
        for rep in sorted((F / "suite-crash" / model).glob("rep-*")):
            if (rep / "junit.xml").exists():
                report = rep / "crash-test.json"
                data = json.loads(report.read_text()) if report.exists() else {}
                suite_crash.append({"rep": rep.name, "outcome": junit(rep / "junit.xml").get(CRASH),
                                    "first_run_last_event": data.get("first_run_last_event"),
                                    "refund_rows": len(data.get("refund_rows") or []), "after_restart_next": data.get("after_restart_next")})
        result["crash_suite_after"][model] = suite_crash
        result["before"][model] = [{"rep": r["rep"], "outcomes": r["outcomes"], "refund_rows": r["refund_rows"]}
                                   for r in run(R / "suite", model)]
        crash = F / f"crash-{model}" / "crash-trials.json"
        if crash.exists():
            result["crash_after"][model] = [{k: t.get(k) for k in ("trial", "outcome", "approval_re_asked", "after_restart_next",
                                                                   "replayed_flags", "refunded_cents")}
                                            | {"refund_rows": len(t.get("refund_rows") or []),
                                               "first_interrupt_description": (t.get("first_interrupts") or [{}])[0].get("description")}
                                            for t in json.loads(crash.read_text())]
    for label, folder in (("after", F / "load"), ("before", R / "load")):
        summary = folder / "load-summary.json"
        if not summary.exists():
            continue
        for cell in json.loads(summary.read_text()):
            if cell["workers"] == 1 and cell["users"] == 50:
                rows = json.loads((folder / "load-1w-50u-0ms.rows.json").read_text())
                ends = Counter()
                for log in folder.glob("load-1w-50u-0ms-w*.log.jsonl"):
                    for line in log.read_text().splitlines():
                        e = json.loads(line)
                        if e["event"] == "run.end":
                            ends[e["status"]] += 1
                cell["client_errors"] = dict(Counter(r.get("error") for r in rows if r["kind"] == "error"))
                cell["server_run_end"] = dict(ends)
                cell["runs_per_s_exact"] = round(cell["ok"] / cell["wall_s"], 3)
                cell["run_seconds"] = sorted(round(r["seconds"], 3) for r in rows if r.get("seconds") is not None)
                result["load"][label] = cell
    Path(out).write_text(json.dumps(result, indent=1, default=str))
    for model in result["after"]:
        print(model, "after", [Counter(r["outcomes"].values()) for r in result["after"][model]],
              "before", [Counter(r["outcomes"].values()) for r in result["before"][model]])
        print("  zero/over rows after", [{c: v for c, v in r["refund_rows"].items() if v} for r in result["after"][model]])
    for label, cell in result["load"].items():
        print(label, cell["runs"], cell["ok"], cell["kinds"], cell["client_errors"], cell["server_run_end"], cell["runs_per_s_exact"], cell["p50_s"], cell["p95_s"])


if __name__ == "__main__":
    main(sys.argv[1])
