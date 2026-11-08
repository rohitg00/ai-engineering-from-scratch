import ast
import json
import re
import statistics
import sys
from datetime import datetime, timedelta
from pathlib import Path

ANSI = re.compile(r"\x1b\[[0-9;]*m")
STAMP = re.compile(r"\[(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\.\d+ ")
LINE = re.compile(r" - (perf|step|rollout) (\d+): (\{.*\})\s*$")
BARE = re.compile(r"(?<=[:\s\[,])(nan|inf|-inf)(?=[,}\]])")
KEEP = {
    "rollout/raw_reward": "reward",
    "rollout/episode_response_length/mean": "length",
    "rollout/truncated": "cut_share",
    "rollout/raw_reward_unfiltered": "reward_all_samples",
    "rollout/zero_std/count_0": "groups_all_wrong",
    "rollout/zero_std/count_1": "groups_all_right",
    "rollout/dynamic_filter/drop_zero_std_0": "dropped_all_wrong",
    "rollout/dynamic_filter/drop_zero_std_1": "dropped_all_right",
    "train/train_rollout_logprob_abs_diff": "logprob_abs_diff",
    "train/train_rollout_kl": "train_rollout_kl",
    "train/entropy_loss": "entropy",
    "train/grad_norm": "grad_norm",
    "train/pg_clipfrac": "clip_fraction",
    "perf/step_time": "step_time_s",
    "perf/rollout_time": "rollout_time_s",
    "perf/log_probs_time": "log_probs_time_s",
    "perf/train_time": "train_time_s",
    "perf/update_weights_time": "update_weights_time_s",
    "perf/sleep_time": "sleep_time_s",
    "perf/wake_up_time": "wake_up_time_s",
}


def stamp(text):
    return datetime.fromisoformat(text.replace(" ", "T"))


def parse(path):
    steps = {}
    with open(path, errors="ignore") as handle:
        for raw in handle:
            if " - " not in raw or "{" not in raw:
                continue
            clean = ANSI.sub("", raw)
            match = LINE.search(clean)
            if not match:
                continue
            try:
                values = ast.literal_eval(BARE.sub("None", match.group(3)))
            except (ValueError, SyntaxError):
                continue
            row = steps.setdefault(int(match.group(2)), {})
            for key, name in KEEP.items():
                if key in values and values[key] is not None and name not in row:
                    row[name] = round(float(values[key]), 6)
            when = STAMP.search(clean)
            if not when:
                continue
            if "perf/rollout_time" in values and "rollout_end" not in row:
                row["rollout_end"] = when.group(1)
            if "perf/step_time" in values and "step_end" not in row:
                row["step_end"] = when.group(1)
    return [dict(step=index, **steps[index]) for index in sorted(steps)]


def load_pauses(path):
    pauses = []
    opened = None
    if not path:
        return pauses
    if not Path(path).exists():
        raise FileNotFoundError(f"pause log {path} does not exist")
    for line in Path(path).read_text().splitlines():
        match = re.match(r"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)Z (.*)$", line)
        if not match:
            continue
        moment = stamp(match.group(1))
        if match.group(2).startswith("pause"):
            opened = opened or moment
        elif opened and (match.group(2).startswith("resume") or match.group(2).startswith("done")):
            pauses.append((opened, moment))
            opened = None
    return pauses


def paused_seconds(pauses, end_text, length):
    if end_text is None or length is None:
        return None
    end = stamp(end_text)
    start = end - timedelta(seconds=length)
    total = 0.0
    for left, right in pauses:
        overlap = (min(end, right) - max(start, left)).total_seconds()
        if overlap > 0:
            total += overlap
    return round(total, 1)


def mark_pauses(rows, pauses):
    for row in rows:
        row["rollout_paused_s"] = paused_seconds(pauses, row.get("rollout_end"), row.get("rollout_time_s"))
        row["step_paused_s"] = paused_seconds(pauses, row.get("step_end"), row.get("step_time_s"))


def median_of(rows, name):
    values = [row[name] for row in rows if name in row]
    return round(statistics.median(values), 6) if values else None


def clean_rows(rows, name):
    gate = "rollout_paused_s" if name == "rollout_time_s" else "step_paused_s"
    return [row for row in rows if row.get(gate) == 0]


def clean_medians(rows):
    result = {}
    for name in KEEP.values():
        if not name.endswith("_s"):
            continue
        kept = clean_rows(rows, name)
        result[name] = {"median": median_of(kept, name), "steps": len([row for row in kept if name in row])}
    return result


def main(runs_dir, out_file, thermostat=None):
    runs_dir = Path(runs_dir)
    status = {}
    for line in (runs_dir / "status.txt").read_text().splitlines():
        if " EXIT=" in line:
            name, code = line.rsplit(" EXIT=", 1)
            status[name.strip()] = int(code)
    pauses = load_pauses(thermostat)
    runs = {}
    for name, code in status.items():
        log = runs_dir / f"{name}.log"
        if code not in (0, 124) or not log.exists():
            continue
        rows = parse(log)
        if not rows:
            continue
        mark_pauses(rows, pauses)
        runs[name] = {
            "steps": len(rows),
            "partial": code == 124,
            "median": {field: median_of(rows, field) for field in KEEP.values()},
            "median_unpaused": clean_medians(rows),
            "per_step": rows,
        }
    summary = {
        "machine": "NVIDIA DGX Spark GB10, 128 GB unified memory",
        "image": "radixark/miles:latest",
        "model": "Qwen/Qwen3-0.6B unless the run name says otherwise",
        "dataset": "zhuzilin/gsm8k",
        "timing_rule": "median_unpaused keeps only steps whose window overlaps no heat-guard pause. The rollout window ends at the rollout perf line and lasts rollout_time_s. The step window ends at the trainer perf line and lasts step_time_s.",
        "pauses": len(pauses),
        "excluded": {name: code for name, code in status.items() if code not in (0, 124)},
        "partial": [name for name, code in status.items() if code == 124],
        "runs": runs,
    }
    Path(out_file).write_text(json.dumps(summary, indent=1) + "\n")
    print(f"{len(runs)} runs written to {out_file}, {len(pauses)} pauses")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
