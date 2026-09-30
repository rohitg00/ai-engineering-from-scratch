"""Replay recorded provider usage through Rust integer arithmetic and a reservation ledger."""

import argparse, json, subprocess, tempfile
from pathlib import Path


def counters(raw):
    raw = raw.get("usage", raw)
    result = [
        raw.get("input_tokens"),
        raw.get("output_tokens"),
        raw.get("input_tokens_details", {}).get("cached_tokens", 0),
    ]
    if any(isinstance(n, bool) or not isinstance(n, int) or n < 0 for n in result):
        raise ValueError("nonnegative integer usage counters required")
    return result


def replay(data, meter):
    limit = data["limit"]
    rates = data["rates"]
    spent = 0
    rows = []
    seen = set()
    if isinstance(limit, bool) or not isinstance(limit, int) or limit < 0:
        raise ValueError("integer nano-dollar limit required")
    for request in data["requests"]:
        key = request["id"]
        if not isinstance(key, str) or not key or key in seen:
            raise ValueError("unique request id required")
        seen.add(key)
        estimate = request["estimate"]
        quote = meter(
            [
                estimate["input_tokens"],
                estimate["output_limit"],
                estimate.get("cached_tokens", 0),
            ],
            rates,
        )
        if spent + quote > limit:
            rows.append(
                {
                    "id": key,
                    "reserved": 0,
                    "actual": 0,
                    "unused": 0,
                    "status": "blocked",
                    "reason": "reservation exceeds remaining budget",
                }
            )
            continue
        actual = meter(counters(request["usage"]), rates)
        spent += actual
        rows.append(
            {
                "id": key,
                "reserved": quote,
                "cost": quote,
                "actual": actual,
                "unused": max(0, quote - actual),
                "overrun": max(0, actual - quote),
                "status": "settled" if actual <= quote else "overrun",
            }
        )
        if spent > limit:
            break
    return {
        "schema_version": 1,
        "unit": "nano_dollars",
        "mode": "recorded_usage_replay",
        "limit": limit,
        "spent": spent,
        "remaining": max(0, limit - spent),
        "over_budget": spent > limit,
        "settlements": rows,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input")
    parser.add_argument("--out")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="cost-meter-private-") as folder:
        binary = Path(folder) / "meter"
        subprocess.run(
            [
                "rustc",
                "--edition=2021",
                str(Path(__file__).with_name("cli.rs")),
                "-o",
                str(binary),
            ],
            check=True,
            capture_output=True,
            text=True,
        )

        def meter(usage, rates):
            if any(
                isinstance(n, bool) or not isinstance(n, int) or n < 0
                for n in usage + list(rates.values())
            ):
                raise ValueError("nonnegative integer counters and rates required")
            result = subprocess.run(
                [
                    str(binary),
                    ",".join(map(str, usage)),
                    str(rates["input"]),
                    str(rates["output"]),
                    str(rates["cached"]),
                    str(2**64 - 1),
                ],
                capture_output=True,
                text=True,
            )
            if result.returncode:
                raise ValueError(result.stderr.strip())
            return json.loads(result.stdout)["cost"]

        result = replay(json.loads(Path(args.input).read_text()), meter)
    payload = json.dumps(result, indent=2)
    if args.out:
        Path(args.out).write_text(payload + "\n")
    print(payload)


if __name__ == "__main__":
    main()
