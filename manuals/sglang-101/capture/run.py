import argparse
import json
import os
import platform
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
MODEL = "mlx-community/Qwen3-0.6B-4bit"
PORT = 30000
BASE = f"http://127.0.0.1:{PORT}"
PYTHON = sys.executable
COMMON = ["--model-path", MODEL, "--disable-cuda-graph", "--host", "127.0.0.1", "--port", str(PORT), "--enable-cache-report", "--enable-metrics", "--mem-fraction-static", "0.4"]


def bench(name, *args):
    return lambda: [PYTHON, "-m", "sglang.benchmark.serving", "--backend", "sglang", "--port", str(PORT), "--seed", "7", "--output-file", str(OUT / f"{name}.jsonl"), *args]


RANDOM = ["--dataset-name", "random", "--random-input-len", "512", "--random-output-len", "128", "--random-range-ratio", "1.0"]
SHARED = ["--dataset-name", "generated-shared-prefix", "--gsp-num-groups", "4", "--gsp-prompts-per-group", "16", "--gsp-system-prompt-len", "2048", "--gsp-question-len", "128", "--gsp-output-len", "64", "--gsp-range-ratio", "1.0", "--max-concurrency", "8"]

EXPERIMENTS = [
    {"name": "default", "flags": [], "clients": [
        ("generate", [PYTHON, str(HERE / "one_request.py")]),
        ("cache-experiment", [PYTHON, str(HERE / "cache_experiment.py"), "5"]),
        ("bench-random-c1", bench("bench-random-c1", *RANDOM, "--num-prompts", "16", "--max-concurrency", "1")),
        ("bench-random-c8", bench("bench-random-c8", *RANDOM, "--num-prompts", "32", "--max-concurrency", "8")),
        ("bench-random-c32", bench("bench-random-c32", *RANDOM, "--num-prompts", "128", "--max-concurrency", "32")),
        ("bench-shared-prefix", bench("bench-shared-prefix", *SHARED)),
        ("metrics", None),
    ]},
    {"name": "no-radix-cache", "flags": ["--disable-radix-cache"], "clients": [
        ("bench-shared-prefix", bench("no-radix-cache-bench-shared-prefix", *SHARED)),
        ("metrics", None),
    ]},
    {"name": "no-overlap", "flags": ["--disable-overlap-schedule"], "expect_crash": True, "clients": [
        ("bench-random-c8", bench("no-overlap-bench-random-c8", *RANDOM, "--num-prompts", "32", "--max-concurrency", "8")),
    ]},
    {"name": "small-pool", "flags": ["--max-total-tokens", "4096"], "clients": [
        ("bench-long-output-c16", bench("small-pool-bench-long-output-c16", "--dataset-name", "random", "--random-input-len", "256", "--random-output-len", "512", "--random-range-ratio", "1.0", "--num-prompts", "32", "--max-concurrency", "16")),
        ("metrics", None),
    ]},
]


def healthy():
    try:
        with urllib.request.urlopen(BASE + "/health", timeout=2) as response:
            return response.status == 200
    except OSError:
        return False


def start_server(name, flags, log_path):
    if healthy():
        raise RuntimeError(f"{name}: another server already answers on port {PORT}")
    env = dict(os.environ, SGLANG_USE_MLX="1")
    command = [shutil.which("sglang") or "sglang", "serve", *COMMON, *flags]
    log = open(log_path, "w")
    process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, env=env, start_new_session=True)
    deadline = time.time() + 600
    while time.time() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"{name}: server exited with {process.returncode}, see {log_path}")
        if healthy():
            return process, command
        time.sleep(2)
    stop_server(process)
    raise RuntimeError(f"{name}: server did not become healthy, see {log_path}")


def stop_server(process):
    try:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=60)
    except (ProcessLookupError, PermissionError, subprocess.TimeoutExpired):
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
    deadline = time.time() + 60
    while healthy() and time.time() < deadline:
        time.sleep(1)


def save_metrics(path):
    with urllib.request.urlopen(BASE + "/metrics", timeout=10) as response:
        path.write_text(response.read().decode())


def environment():
    import mlx.core as mx
    import sglang
    import torch
    return {
        "sglang": sglang.__version__,
        "torch": torch.__version__,
        "mlx": mx.__version__,
        "python": platform.python_version(),
        "macos": platform.mac_ver()[0],
        "machine": platform.machine(),
        "model": MODEL,
    }


def missing_requirement():
    if platform.system() != "Darwin" or platform.machine() != "arm64":
        return "needs macOS on Apple silicon"
    try:
        import mlx.core
        import sglang
    except ImportError as error:
        return f"SGLang with the MLX extra is not installed ({error.name})"
    if sglang.__version__ != "0.5.22":
        return f"needs SGLang 0.5.22, found {sglang.__version__}"
    if not shutil.which("sglang"):
        return "the sglang command is not on PATH"
    return None


def read(path):
    return path.read_text() if path.exists() else ""


def bench_facts(text):
    keys = ("Successful requests", "Total input tokens", "Total generated tokens")
    return {key: line.split(":", 1)[1].strip() for line in text.splitlines() for key in keys if line.startswith(key + ":")}


def cache_facts(text):
    facts = {}
    for line in text.splitlines():
        row = json.loads(line)
        if "summary" in row:
            facts[row["summary"]] = row["median_cached_tokens"]
    return {
        "stable-system-prompt cached": facts.get("stable-system-prompt"),
        "id-at-start cached under 50": (facts.get("id-at-start") or 0) < 50,
        "id-at-end cached over 2900": (facts.get("id-at-end") or 0) > 2900,
    }


def generate_facts(text):
    blocks = text.split("POST /v1/chat/completions")
    native = json.loads(blocks[0].replace("POST /generate", "", 1))
    chat = json.loads(blocks[1])
    return {
        "generate text": native["text"],
        "generate prompt_tokens": native["meta_info"]["prompt_tokens"],
        "chat content": chat["choices"][0]["message"]["content"],
        "chat usage": {k: chat["usage"][k] for k in ("prompt_tokens", "completion_tokens")},
    }


def log_facts(text):
    keep = ("bytes_per_slot=", "Tree cache initialized", "Using the Python TreeCore", "RuntimeError:")
    facts = []
    for line in text.splitlines():
        for marker in keep:
            if marker in line:
                facts.append(line.split("] ", 1)[-1].split("sys_available")[0] if marker != "bytes_per_slot=" else "bytes_per_slot=" + line.split("bytes_per_slot=")[1].split(",")[0])
    return sorted(set(facts))


def metric_names(text):
    return sorted({line.split("{")[0].split(" ")[0] for line in text.splitlines() if line.startswith("sglang:")})


def facts(directory):
    result = {}
    for path in sorted(directory.glob("*.txt")):
        text = read(path)
        if path.name.startswith("server-") and path.name.endswith(".command.txt"):
            result[path.name] = text.strip()
        elif "bench-" in path.name:
            result[path.name] = bench_facts(text)
        elif path.name == "cache-experiment.txt":
            result[path.name] = cache_facts(text)
        elif path.name == "generate.txt":
            result[path.name] = generate_facts(text)
        elif path.name.endswith("metrics.txt"):
            result[path.name] = metric_names(text)
        elif path.name == "serve-help.txt":
            result[path.name] = sorted({line.split()[0].rstrip(",") for line in text.splitlines() if line.strip().startswith("--")})
    for path in sorted(directory.glob("server-*.log")):
        result[path.name] = log_facts(read(path))
    return result


def check():
    reason = missing_requirement()
    if reason:
        print(f"skipped: {reason}")
        return 0
    import tempfile
    global OUT
    recorded = OUT
    with tempfile.TemporaryDirectory() as temporary:
        OUT = Path(temporary)
        record()
        fresh = facts(OUT)
    expected = facts(recorded)
    drift = [name for name in sorted(set(expected) | set(fresh)) if expected.get(name) != fresh.get(name)]
    for name in drift:
        print(f"drift: {name}\n  recorded: {expected.get(name)}\n  now:      {fresh.get(name)}")
    print(f"{len(expected) - len(drift)} of {len(expected)} files match")
    return 1 if drift else 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", nargs="*", help="experiment names to run")
    parser.add_argument("--check", action="store_true", help="capture again into a temporary directory and compare stable facts")
    args = parser.parse_args()
    if args.check:
        sys.exit(check())
    reason = missing_requirement()
    if reason:
        sys.exit(f"cannot record: {reason}")
    record(args.only)


def record(only=None):
    OUT.mkdir(exist_ok=True)
    (OUT / "environment.json").write_text(json.dumps(environment(), indent=2) + "\n")
    if not only:
        try:
            result = subprocess.run([shutil.which("sglang") or "sglang", "serve", "--help"], capture_output=True, text=True, env=dict(os.environ, SGLANG_USE_MLX="1"), timeout=300)
        except subprocess.TimeoutExpired as error:
            raise RuntimeError("sglang serve --help did not finish in 300 s") from error
        (OUT / "serve-help.txt").write_text(result.stdout)
    for experiment in EXPERIMENTS:
        if only and experiment["name"] not in only:
            continue
        name = experiment["name"]
        process, command = start_server(name, experiment["flags"], OUT / f"server-{name}.log")
        (OUT / f"server-{name}.command.txt").write_text(" ".join(["SGLANG_USE_MLX=1", "sglang", *command[1:]]) + "\n")
        try:
            for client, command in experiment["clients"]:
                print(f"[{name}] {client}", flush=True)
                target = OUT / (f"{client}.txt" if name == "default" else f"{name}-{client}.txt")
                if command is None:
                    save_metrics(target)
                    continue
                if callable(command):
                    command = command()
                result = subprocess.run(command, capture_output=True, text=True, timeout=1800)
                target.write_text((result.stdout + result.stderr).replace(str(Path.home()), "~"))
                crashed = process.poll() is not None
                if result.returncode != 0 or crashed:
                    print(f"[{name}] {client} exited {result.returncode}, server running: {not crashed}", flush=True)
                    if experiment.get("expect_crash") and crashed:
                        break
                    raise RuntimeError(f"{name}: {client} failed, see {target}")
        finally:
            stop_server(process)
    print("done", flush=True)


if __name__ == "__main__":
    main()
