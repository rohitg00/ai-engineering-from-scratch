import argparse
import json
from pathlib import Path
import sys

from main import process, render_html


def main():
    parser = argparse.ArgumentParser(
        description="Redact bounded detectors from local {id,text} JSONL."
    )
    parser.add_argument("input", type=Path)
    parser.add_argument(
        "--literals", type=Path, help="JSON array of exact strings to remove"
    )
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        records = [
            json.loads(line)
            for line in args.input.read_text().splitlines()
            if line.strip()
        ]
        literals = json.loads(args.literals.read_text()) if args.literals else []
        result = process(records, literals)
        args.output.mkdir(parents=True, exist_ok=True)
        (args.output / "redacted.jsonl").write_text(
            "".join(
                json.dumps(row, ensure_ascii=False) + "\n" for row in result["records"]
            )
        )
        (args.output / "receipt.json").write_text(
            json.dumps(
                {key: value for key, value in result.items() if key != "records"},
                indent=2,
            )
            + "\n"
        )
        (args.output / "review.html").write_text(render_html(result))
        print(json.dumps(result["totals"], sort_keys=True))
        return 0
    except (OSError, ValueError, TypeError):
        print(
            "redaction failed: check input shape, unique non-sensitive ids, literal limits and file permissions",
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
