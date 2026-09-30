"""Read jobs, reserve before execution, and retain a machine-readable receipt."""

import argparse
import hashlib
import json
import time
from pathlib import Path
from main import ledger, reserve, settle, schedule, nonnegative


def execute_jobs(jobs, limit, deadline_ms, invoke=None):
    state = ledger(limit)
    nonnegative(deadline_ms)
    seen = set()
    for job in jobs:
        if not isinstance(job.get("id"), str) or not job["id"] or job["id"] in seen:
            raise ValueError("unique job ids required")
        seen.add(job["id"])
        nonnegative(job["cost"])
    events = []
    start = time.monotonic()
    invoke = invoke or local_action
    for job in jobs:
        if (time.monotonic() - start) * 1000 >= deadline_ms:
            events.append({"id": job["id"], "status": "rejected", "reason": "deadline"})
            continue
        try:
            state = reserve(state, job["id"], job["cost"])
        except ValueError as error:
            events.append({"id": job["id"], "status": "rejected", "reason": str(error)})
            continue
        try:
            value, actual = invoke(job)
            updated = settle(state, job["id"], actual)
        except Exception as error:
            # An unknown receipt retains the reservation until reconciliation.
            events.append(
                {
                    "id": job["id"],
                    "status": "needs_reconciliation",
                    "reserved": job["cost"],
                    "reason": str(error),
                }
            )
            continue
        state = updated
        events.append(
            {
                "id": job["id"],
                "status": "completed",
                "reserved": job["cost"],
                "actual": actual,
                "unused": job["cost"] - actual,
                "value": value,
            }
        )
    return {
        "schema_version": 1,
        "ledger": state,
        "events": events,
        "elapsed_ms": round((time.monotonic() - start) * 1000, 3),
    }


def local_action(job):
    action = job.get("action", {})
    if action.get("kind") != "sha256" or not isinstance(action.get("text"), str):
        raise ValueError("local action requires kind=sha256 and text")
    return hashlib.sha256(action["text"].encode()).hexdigest(), job.get(
        "actual_cost", job["cost"]
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--mode", choices=["replay", "execute"], default="replay")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    data = json.loads(args.input.read_text())
    if data.get("schema_version") != 1 or data.get("unit") not in [
        "nano_dollars",
        "teaching_units",
    ]:
        raise ValueError("version1 and explicit integer cost unit required")
    fn = execute_jobs if args.mode == "execute" else schedule
    report = fn(data["jobs"], data["limit"], data["deadline_ms"])
    report.update(
        schema_version=1,
        unit=data["unit"],
        mode=args.mode,
        cost_source="caller supplied receipts; not provider metering",
    )
    text = json.dumps(report, indent=2)
    if args.output:
        args.output.write_text(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
