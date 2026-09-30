"""Compare JSON ranking runs against graded judgments with query-level deltas."""

import argparse, json
from pathlib import Path
from main import compare_systems


def run(baseline, candidate, judgments, k=3):
    systems = compare_systems(
        {"baseline": baseline, "candidate": candidate}, judgments, k
    )
    deltas = [
        {
            "query": q,
            "delta_ndcg": systems["candidate"]["queries"][q]["ndcg"]
            - systems["baseline"]["queries"][q]["ndcg"],
            "before": baseline[q],
            "after": candidate[q],
        }
        for q in judgments
    ]
    return {
        "schema_version": 1,
        "cutoff": k,
        "systems": systems,
        "deltas": sorted(deltas, key=lambda x: (x["delta_ndcg"], x["query"])),
        "regressions": sum(x["delta_ndcg"] < 0 for x in deltas),
        "evaluation_scope": "supplied judgments; unjudged documents receive zero gain",
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    for name in ["baseline", "candidate", "judgments"]:
        p.add_argument(name)
    p.add_argument("--k", type=int, default=3)
    p.add_argument("--out")
    p.add_argument("--fail-on-regression", action="store_true")
    a = p.parse_args()
    result = run(
        *(
            json.loads(Path(getattr(a, n)).read_text())
            for n in ["baseline", "candidate", "judgments"]
        ),
        a.k,
    )
    text = json.dumps(result, indent=2)
    if a.out:
        Path(a.out).write_text(text + "\n")
    print(text)
    return int(a.fail_on_regression and result["regressions"] > 0)


if __name__ == "__main__":
    raise SystemExit(main())
