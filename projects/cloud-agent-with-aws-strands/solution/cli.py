"""Execute a validated read-only plan against local recordings or explicit AWS CLI reads."""

import argparse
import json
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from plan import validate_plan
from executor import execute
from retry import cached_read


def time_window(entry):
    values = []
    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    for key in ("start", "end"):
        raw = entry.get(key)
        if not isinstance(raw, str):
            raise ValueError(
                "Provide both start and end as timezone-aware ISO timestamps"
            )
        try:
            stamp = datetime.fromisoformat(
                raw[:-1] + "+00:00" if raw.endswith("Z") else raw
            )
        except ValueError as error:
            raise ValueError("Provide valid ISO start/end timestamps") from error
        if stamp.tzinfo is None or stamp.utcoffset() is None:
            raise ValueError("Start/end timestamps must include a timezone")
        values.append((stamp - epoch) // timedelta(milliseconds=1))
    if values[0] < 0 or values[1] <= values[0]:
        raise ValueError("Window requires 0 <= start < end in epoch milliseconds")
    return values


def aws_arguments(operation, resource, config):
    entry = config[resource]
    common = ["aws", "--region", entry["region"], "--output", "json", "--no-cli-pager"]
    if operation == "inventory.list":
        return common + [
            "ecs",
            "describe-services",
            "--cluster",
            entry["cluster"],
            "--services",
            resource,
        ]
    if operation == "logs.read":
        arguments = common + [
            "logs",
            "filter-log-events",
            "--log-group-name",
            entry["log_group"],
            "--limit",
            "20",
        ]
        if "start" in entry or "end" in entry:
            start, end = time_window(entry)
            arguments += ["--start-time", str(start), "--end-time", str(end)]
        return arguments
    if operation == "metrics.read":
        time_window(entry)
        return common + [
            "cloudwatch",
            "get-metric-statistics",
            "--namespace",
            "AWS/ECS",
            "--metric-name",
            "CPUUtilization",
            "--dimensions",
            "Name=ClusterName,Value=" + entry["cluster"],
            "Name=ServiceName,Value=" + resource,
            "--start-time",
            entry["start"],
            "--end-time",
            entry["end"],
            "--period",
            "60",
            "--statistics",
            "Average",
        ]
    raise ValueError("unknown read operation")


def run(payload, provider):
    plan = validate_plan(payload["plan"], payload["scope"])
    cache, receipts = {}, []

    def read(operation, resource):
        receipt = cached_read(
            operation, resource, provider, cache, retries=payload.get("retries", 1)
        )
        receipts.append(
            {
                "operation": operation,
                "resource": resource,
                "cached": receipt["cached"],
                "attempts": receipt["attempts"],
            }
        )
        return receipt["value"]

    result = execute(
        plan,
        read,
        max_steps=payload.get("max_steps", 5),
        max_chars=payload.get("max_chars", 4000),
    )
    return {"schema_version": 1, **result, "receipts": receipts}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--mode", choices=["recording", "aws"], default="recording")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    payload = json.loads(args.input.read_text())

    def provider(operation, resource):
        if args.mode == "recording":
            return payload["recordings"][resource][operation]
        try:
            response = subprocess.run(
                aws_arguments(operation, resource, payload["aws"]),
                check=True,
                capture_output=True,
                text=True,
                timeout=10,
            )
        except subprocess.TimeoutExpired as error:
            raise TimeoutError("AWS read exceeded ten seconds") from error
        if len(response.stdout) > 1000000:
            raise ValueError("AWS response exceeds one megabyte")
        return json.loads(response.stdout)

    result = run(payload, provider)
    result["mode"] = args.mode
    text = json.dumps(result, indent=2)
    if args.output:
        args.output.write_text(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
