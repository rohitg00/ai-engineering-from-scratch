import json
import math


def validate_cases(cases):
    seen = set()
    for c in cases:
        if (
            not isinstance(c, dict)
            or not isinstance(c.get("id"), str)
            or (not c["id"])
            or (c["id"] in seen)
        ):
            raise ValueError("unique case id required")
        seen.add(c["id"])
        if (
            not isinstance(c.get("prompt"), str)
            or not isinstance(c.get("checks"), list)
            or (not c["checks"])
        ):
            raise ValueError("prompt and checks required")
        for check in c["checks"]:
            if check.get("kind") not in ("contains", "excludes", "json"):
                raise ValueError("unknown check")
            if check["kind"] != "json" and (not isinstance(check.get("value"), str)):
                raise ValueError("check text required")
    return cases


def reject_json_constant(value):
    raise ValueError(value)


def score_response(response, checks):
    evidence = []
    for check in checks:
        passed = False
        if isinstance(response, str):
            if check["kind"] == "contains":
                passed = check["value"] in response
            elif check["kind"] == "excludes":
                passed = check["value"] not in response
            elif check["kind"] == "json":
                try:
                    json.loads(
                        response,
                        parse_constant=reject_json_constant,
                    )
                    passed = True
                except (ValueError, TypeError):
                    pass
            else:
                raise ValueError("unknown check")
        evidence.append({"kind": check["kind"], "passed": passed})
    return {
        "passed": bool(checks) and all((e["passed"] for e in evidence)),
        "checks": evidence,
    }


def compare(cases, baseline, candidate):
    validate_cases(cases)
    rows = []
    for c in cases:
        old = score_response(baseline.get(c["id"]), c["checks"])["passed"]
        new = score_response(candidate.get(c["id"]), c["checks"])["passed"]
        if old and new:
            state = "stable_pass"
        elif not old and not new:
            state = "stable_fail"
        elif old:
            state = "regressed"
        else:
            state = "improved"
        rows.append({"id": c["id"], "state": state, "passed": new})
    return {
        "cases": rows,
        "regressions": sum((r["state"] == "regressed" for r in rows)),
        "improvements": sum((r["state"] == "improved" for r in rows)),
        "pass_rate": sum((r["passed"] for r in rows)) / len(rows) if rows else 0,
    }


def release_gate(report, min_pass=1.0, max_regressions=0):
    if (
        not isinstance(min_pass, (int, float))
        or not math.isfinite(min_pass)
        or (not 0 <= min_pass <= 1)
    ):
        raise ValueError("pass threshold in [0,1] required")
    if not isinstance(max_regressions, int) or max_regressions < 0:
        raise ValueError("nonnegative regression budget required")
    ship = (
        bool(report["cases"])
        and report["pass_rate"] >= min_pass
        and (report["regressions"] <= max_regressions)
    )
    return {
        "decision": "ship" if ship else "block",
        "pass_rate": report["pass_rate"],
        "regressions": report["regressions"],
    }
