import argparse
import copy
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
GPU = HERE / "gpu"
OUT = GPU / "out-gb10"
SUMMARY = GPU / "summary" / "miles-gb10-lab.json"
PAUSES = OUT / "thermostat.log"
REPLAY_INPUT = OUT / "e2-n16-503-per-second.txt"
REPLAY_STORED = OUT / "503-bursts.txt"
LIVE_CHECKS = {
    "custom-rm-noenv-hang.txt": ["lines with 503 Service Unavailable: 44", "lines with rollout N metrics: 0", "first timestamped line: 2026-10-23 00:19:02", "last timestamped line: 2026-10-23 02:17:06", "No module named 'my_rewards'"],
    "frac-low-kv.txt": ["#tokens: 3082", "perf/rollout_time': 385.5", "perf/rollout_time': 60.69"],
    "tracker-eval-checks.txt": ["TypeError: unsupported operand type(s) for +: 'NoneType' and 'str'", "W&B offline mode enabled.", "Saving tensorboard log to /root/lab/runs/plain/tb.", "503 lines 5311", "503 lines 4339"],
    "resume-check.txt": ["[FSDP] Loaded model from /ckpt/run-a/iter_0000002/model", "step 2:", "lines mentioning a missing tracker or folder: 0"],
    "live-check-summary.txt": ["successfully saved checkpoint from iteration", "latest_checkpointed_iteration.txt: release", "model.safetensors", "tokenizer.json"],
}
L4_CHECKS = {
    "logprobs-top-p.txt": ["vLLM --logprobs-mode processed_logprobs          +0.0527", "median residual 8e-9", "SGLang return_logprob, ORIGINAL_LOGPROB=0        0.0000"],
    "logprob-gap-by-dtype.txt": ["1,961 sampled tokens from 32 prompts", "3 answers ended at the end token before 64 tokens", "BF16     BF16      0.0073", "FP16     FP16      0.00094", "BF16     FP32      0.0076", "FP16     FP32      0.0010"],
}
REPLAY_COMMAND = "$ python3 watchdog_replay.py"

sys.dont_write_bytecode = True
sys.path.insert(0, str(GPU))
import summarize_miles


def lab_runs():
    configured = os.environ.get("MILES_LAB_RUNS")
    folder = Path(configured) if configured else Path.home() / "miles-lab" / "runs"
    if (folder / "status.txt").exists():
        return folder
    if configured:
        raise SystemExit(f"MILES_LAB_RUNS is {folder}, which holds no status.txt")
    return None


def replay_output():
    result = subprocess.run([sys.executable, str(GPU / "watchdog_replay.py"), str(REPLAY_INPUT)], capture_output=True, text=True, check=True)
    return result.stdout


def stored_replay():
    lines = REPLAY_STORED.read_text().splitlines()
    start = next(index for index, line in enumerate(lines) if line.startswith(REPLAY_COMMAND))
    return "\n".join(lines[start + 1:]) + "\n"


def summary_problems(summary, pause_log=PAUSES):
    problems = []
    pauses = summarize_miles.load_pauses(pause_log)
    if len(pauses) != summary["pauses"]:
        problems.append(f"the pause log holds {len(pauses)} pauses and the summary {summary['pauses']}")
    for name, run in summary["runs"].items():
        rows = copy.deepcopy(run["per_step"])
        summarize_miles.mark_pauses(rows, pauses)
        if rows != run["per_step"]:
            problems.append(f"{name}: the pause marks differ from the pause log")
        if run["steps"] != len(rows):
            problems.append(f"{name}: {run['steps']} steps recorded, {len(rows)} rows stored")
        median = {field: summarize_miles.median_of(rows, field) for field in summarize_miles.KEEP.values()}
        if median != run["median"]:
            problems.append(f"{name}: the medians differ from the stored steps")
        if summarize_miles.clean_medians(rows) != run["median_unpaused"]:
            problems.append(f"{name}: the clean-step medians differ from the stored steps")
    return problems


def fresh_summary_problems(runs):
    with tempfile.TemporaryDirectory() as folder:
        fresh = Path(folder) / "summary.json"
        summarize_miles.main(runs, fresh, runs / "thermostat.log")
        if json.loads(fresh.read_text()) != json.loads(SUMMARY.read_text()):
            return [f"a fresh summary of {runs} differs from {SUMMARY.name}"]
    return []


def check():
    problems = []
    if replay_output() != stored_replay():
        problems.append(f"the watchdog replay differs from {REPLAY_STORED.name}")
    problems += summary_problems(json.loads(SUMMARY.read_text()))
    for name, quoted in LIVE_CHECKS.items():
        text = (OUT / name).read_text()
        problems += [f"{name}: the quoted value {value!r} is missing" for value in quoted if value not in text]
    for name, quoted in L4_CHECKS.items():
        text = (GPU / "out-l4" / name).read_text()
        problems += [f"out-l4/{name}: the quoted value {value!r} is missing" for value in quoted if value not in text]
    runs = lab_runs()
    if runs is None:
        print("skipped: the raw run logs stay on the DGX Spark that recorded them, so only the stored outputs were compared. Set MILES_LAB_RUNS to a runs folder to compare a fresh summary.")
    else:
        problems += fresh_summary_problems(runs)
    for problem in problems:
        print(f"drift: {problem}")
    if problems:
        return 1
    print("capture check passed: watchdog replay, pause marks, medians, and live-check notes match the stored outputs")
    return 0


def changed_runs(old, new):
    names = sorted(set(old["runs"]) | set(new["runs"]))
    return [name for name in names if old["runs"].get(name) != new["runs"].get(name)]


def run():
    runs = lab_runs()
    if runs is None:
        print("skipped: no runs folder with status.txt. The GPU captures record on the DGX Spark, see the lab notes.")
        return 0
    pause_log = runs / "thermostat.log"
    with tempfile.TemporaryDirectory() as folder:
        fresh = Path(folder) / "summary.json"
        summarize_miles.main(runs, fresh, pause_log)
        new = json.loads(fresh.read_text())
        old = json.loads(SUMMARY.read_text())
        problems = summary_problems(new, pause_log)
        old_names = set(old["runs"]) | set(old["excluded"])
        new_names = set(new["runs"]) | set(new["excluded"])
        problems += [f"{name}: stored, but missing from the runs folder" for name in sorted(old_names - new_names)]
        if problems:
            for problem in problems:
                print(f"drift: {problem}")
            print("the stored summary was not replaced")
            return 1
        for name in changed_runs(old, new):
            print(f"changed: {name}")
        for name in sorted(set(old.get("partial", [])) - set(new.get("partial", []))):
            print(f"completed: {name} is no longer partial")
        shutil.copyfile(fresh, SUMMARY)
    shutil.copyfile(pause_log, PAUSES)
    return check()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    return check() if args.check else run()


if __name__ == "__main__":
    sys.exit(main())
