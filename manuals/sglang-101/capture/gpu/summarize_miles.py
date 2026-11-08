import ast
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
KEEP = (
    "rollout/raw_reward",
    "train/train_rollout_logprob_abs_diff",
    "train/train_rollout_kl",
    "train/grad_norm",
    "perf/step_time",
    "perf/train_wait_time",
    "perf/train_time",
    "perf/log_probs_time",
    "perf/actor_train_time",
    "perf/update_weights_time",
    "perf/sleep_time",
    "perf/wake_up_time",
    "perf/actor_train_tok_per_s",
    "perf/wait_time_ratio",
)
STEP = re.compile(r" - (?:rollout|step) (\d+): \{")


def parse(log):
    steps = {}
    current = None
    for line in log.read_text(errors="replace").splitlines():
        match = STEP.search(line)
        if match:
            current = int(match.group(1))
        start = line.find("{'")
        end = line.rfind("}")
        if current is None or start < 0 or end <= start:
            continue
        try:
            values = ast.literal_eval(line[start:end + 1])
        except (SyntaxError, ValueError):
            continue
        if isinstance(values, dict):
            row = steps.setdefault(current, {"step": current})
            row.update({key: round(value, 6) for key, value in values.items() if key in KEEP and isinstance(value, (int, float))})
    return [steps[key] for key in sorted(steps)]


if __name__ == "__main__":
    lab = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "miles-lab"
    summary = {"model": "Qwen/Qwen3-0.6B", "dataset": "zhuzilin/gsm8k", "runs": {}}
    for log in sorted((lab / "runs").glob("*.log")):
        summary["runs"][log.stem] = parse(log)
    target = HERE / "summary" / "miles-gb10.json"
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(summary, indent=1) + "\n")
    print({name: len(rows) for name, rows in summary["runs"].items()})
