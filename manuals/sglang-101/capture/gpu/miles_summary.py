import ast
import json
import re
import statistics
import sys
from pathlib import Path

ANSI = re.compile(r"\x1b\[[0-9;]*m")
PERF = re.compile(r"metrics\.py:\d+ - perf (\d+): (\{.*\})")
TRAIN = re.compile(r"(\{'train/loss'.*?\})")
TIMER = re.compile(r"Timer (\w+) end \(elapsed: ([0-9.]+)s\)")
KEEP_PERF = ["rollout/raw_reward_unfiltered", "rollout/response_len/mean", "rollout/truncated_ratio", "rollout/prefix_cache_hit_rate", "perf/rollout_time", "perf/tokens_per_gpu_per_sec"]
KEEP_TRAIN = ["train/train_rollout_logprob_abs_diff", "train/train_rollout_kl", "train/ppo_kl", "train/pg_clipfrac", "train/grad_norm"]


def parse(path):
    rollouts, trains, timers = {}, [], {}
    for raw in path.read_text(errors="replace").splitlines():
        line = ANSI.sub("", raw)
        match = PERF.search(line)
        if match:
            values = ast.literal_eval(match.group(2))
            rollouts[int(match.group(1))] = {key: values.get(key) for key in KEEP_PERF}
            continue
        match = TRAIN.search(line)
        if match:
            values = ast.literal_eval(match.group(1))
            trains.append({key: values.get(key) for key in KEEP_TRAIN})
        for name, elapsed in TIMER.findall(line):
            timers.setdefault(name, []).append(float(elapsed))
    steps = [dict(rollout=index, **rollouts[index], **(trains[index] if index < len(trains) else {})) for index in sorted(rollouts)]
    return {"rollouts": steps, "timers_s": {name: {"median": round(statistics.median(values), 2), "max": round(max(values), 2), "n": len(values)} for name, values in sorted(timers.items())}}


if __name__ == "__main__":
    out = {Path(name).stem: parse(Path(name)) for name in sys.argv[2:]}
    Path(sys.argv[1]).write_text(json.dumps(out, indent=1) + "\n")
    for run, data in out.items():
        diffs = [step.get("train/train_rollout_logprob_abs_diff") for step in data["rollouts"]]
        print(run, len(data["rollouts"]), "rollouts, logprob diff", diffs[:2], "...")
