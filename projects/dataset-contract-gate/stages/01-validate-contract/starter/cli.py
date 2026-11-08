import argparse
import json
from pathlib import Path
import sys

from main import evaluate, render_html


def main():
    parser = argparse.ArgumentParser(
        description="Validate a local JSONL dataset against an explicit version-1 teaching contract."
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("--contract", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--check", action="store_true", help="exit 1 when a quality rule fails"
    )
    args = parser.parse_args()
    try:
        rows = [json.loads(line) for line in args.input.read_text().splitlines()]
        result = evaluate(rows, json.loads(args.contract.read_text()))
        args.output.mkdir(parents=True, exist_ok=True)
        for name in ("accepted", "quarantine"):
            (args.output / (name + ".jsonl")).write_text(
                "".join(
                    json.dumps(row, ensure_ascii=False, allow_nan=False) + "\n"
                    for row in result[name]
                )
            )
        receipt = {
            key: value
            for key, value in result.items()
            if key not in {"accepted", "quarantine"}
        }
        (args.output / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
        (args.output / "review.html").write_text(render_html(result))
        print(json.dumps(receipt, sort_keys=True))
        return int(args.check and not result["passed"])
    except (OSError, ValueError, TypeError) as error:
        print("contract gate: invalid input or output: " + str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
