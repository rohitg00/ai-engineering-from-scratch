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

from offline import prefetch, with_dataset

HERE = Path(__file__).resolve().parent
CLIENTS = HERE.parent
PROFILES = {
    "gb10": {"model": "Qwen/Qwen3-30B-A3B-Instruct-2507", "fp8": "Qwen/Qwen3-30B-A3B-Instruct-2507-FP8", "draft": "lmsys/SGLang-EAGLE3-Qwen3-30B-A3B-Instruct-2507-SpecForge-Nex", "fraction": "0.7", "min_gib": 100},
    "l4": {"model": "Qwen/Qwen3-8B", "fp8": "Qwen/Qwen3-8B-FP8", "draft": "Tengyunw/qwen3_8b_eagle3", "fraction": "0.85", "min_gib": 20},
}
PROFILE = os.environ.get("SGLANG_KIT_PROFILE", "gb10")
OUT = HERE / f"out-{PROFILE}"
MODEL = PROFILES[PROFILE]["model"]
MODEL_FP8 = PROFILES[PROFILE]["fp8"]
DRAFT = PROFILES[PROFILE]["draft"]
PORT = 30000
BASE = f"http://127.0.0.1:{PORT}"
PYTHON = sys.executable
SERVER = ["--host", "127.0.0.1", "--port", str(PORT), "--enable-cache-report", "--enable-metrics", "--mem-fraction-static", PROFILES[PROFILE]["fraction"]]
NO_GRAPH = ["--cuda-graph-backend-decode", "disabled", "--cuda-graph-backend-prefill", "disabled"]
DATASET = None
EAGLE = ["--speculative-algorithm", "EAGLE3", "--speculative-draft-model-path", DRAFT, "--speculative-num-steps", "3", "--speculative-eagle-topk", "1", "--speculative-num-draft-tokens", "4"]


def bench(name, *args):
    return lambda: [PYTHON, "-m", "sglang.benchmark.serving", "--backend", "sglang", "--port", str(PORT), "--seed", "7", "--output-file", str(OUT / f"{name}.jsonl"), *with_dataset(args, DATASET)]


def random_load(name, concurrency, prompts):
    return (f"bench-random-c{concurrency}", bench(name, *RANDOM, "--num-prompts", str(prompts), "--max-concurrency", str(concurrency)))


RANDOM = ["--dataset-name", "random", "--random-input-len", "512", "--random-output-len", "128", "--random-range-ratio", "1.0"]
SHARED = ["--dataset-name", "generated-shared-prefix", "--gsp-num-groups", "4", "--gsp-prompts-per-group", "16", "--gsp-system-prompt-len", "2048", "--gsp-question-len", "128", "--gsp-output-len", "64", "--gsp-range-ratio", "1.0", "--max-concurrency", "8"]

EXPERIMENTS = [
    {"name": "default", "model": MODEL, "flags": [], "clients": [
        ("generate", [PYTHON, str(CLIENTS / "one_request.py")]),
        ("cache-experiment", [PYTHON, str(CLIENTS / "cache_experiment.py"), "5"]),
        random_load("bench-random-c1", 1, 16),
        random_load("bench-random-c8", 8, 64),
        random_load("bench-random-c32", 32, 128),
        random_load("bench-random-c64", 64, 256),
        ("bench-shared-prefix", bench("bench-shared-prefix", *SHARED)),
        ("structured", [PYTHON, str(HERE / "structured_probe.py")]),
        ("determinism", [PYTHON, str(HERE / "determinism_probe.py"), "5"]),
        ("metrics", None),
    ]},
    {"name": "no-cuda-graph", "model": MODEL, "flags": NO_GRAPH, "clients": [
        random_load("no-cuda-graph-bench-random-c1", 1, 16),
        random_load("no-cuda-graph-bench-random-c8", 8, 64),
    ]},
    {"name": "no-radix-cache", "model": MODEL, "flags": ["--disable-radix-cache"], "clients": [
        ("bench-shared-prefix", bench("no-radix-cache-bench-shared-prefix", *SHARED)),
        ("metrics", None),
    ]},
    {"name": "no-overlap", "model": MODEL, "flags": ["--disable-overlap-schedule"], "expect_crash": True, "clients": [
        random_load("no-overlap-bench-random-c8", 8, 64),
    ]},
    {"name": "small-pool", "model": MODEL, "flags": ["--max-total-tokens", "4096"], "clients": [
        ("bench-long-output-c16", bench("small-pool-bench-long-output-c16", "--dataset-name", "random", "--random-input-len", "256", "--random-output-len", "512", "--random-range-ratio", "1.0", "--num-prompts", "32", "--max-concurrency", "16")),
        ("metrics", None),
    ]},
    {"name": "fp8", "model": MODEL_FP8, "flags": ["--kv-cache-dtype", "fp8_e4m3"], "clients": [
        ("generate", [PYTHON, str(CLIENTS / "one_request.py")]),
        random_load("fp8-bench-random-c1", 1, 16),
        random_load("fp8-bench-random-c8", 8, 64),
        random_load("fp8-bench-random-c32", 32, 128),
    ]},
    {"name": "eagle3", "model": MODEL, "flags": EAGLE, "env": {"SGLANG_ALLOW_OVERWRITE_LONGER_CONTEXT_LEN": "1"}, "clients": [
        ("generate", [PYTHON, str(CLIENTS / "one_request.py")]),
        random_load("eagle3-bench-random-c1", 1, 16),
        random_load("eagle3-bench-random-c8", 8, 64),
        random_load("eagle3-bench-random-c32", 32, 128),
        ("metrics", None),
    ]},
    {"name": "eagle3-no-env", "model": MODEL, "flags": EAGLE, "expect_start_failure": True, "clients": []},
    {"name": "idle-probe", "model": MODEL, "flags": [], "clients": [
        ("ttft-idle", [PYTHON, str(HERE / "ttft_idle_probe.py")]),
    ]},
    {"name": "deterministic", "model": MODEL, "flags": ["--enable-deterministic-inference"], "clients": [
        ("determinism", [PYTHON, str(HERE / "determinism_probe.py"), "5"]),
        random_load("deterministic-bench-random-c8", 8, 64),
    ]},
]


def healthy():
    try:
        with urllib.request.urlopen(BASE + "/health", timeout=2) as response:
            return response.status == 200
    except OSError:
        return False


def start_server(name, model, flags, log_path, env=None):
    if healthy():
        raise RuntimeError(f"{name}: another server already answers on port {PORT}")
    command = [shutil.which("sglang") or "sglang", "serve", "--model-path", model, *SERVER, *flags]
    log = open(log_path, "w")
    process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, env={**os.environ, **(env or {})}, start_new_session=True)
    deadline = time.time() + 1800
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
    import flashinfer
    import sgl_kernel
    import sglang
    import torch
    free, total = torch.cuda.mem_get_info()
    driver = subprocess.run(["nvidia-smi", "--query-gpu=driver_version", "--format=csv,noheader"], capture_output=True, text=True).stdout.strip()
    return {
        "sglang": sglang.__version__,
        "sglang_kernel": sgl_kernel.__version__,
        "flashinfer": flashinfer.__version__,
        "torch": torch.__version__,
        "cuda": torch.version.cuda,
        "driver": driver,
        "gpu": torch.cuda.get_device_name(0),
        "compute_capability": ".".join(map(str, torch.cuda.get_device_capability(0))),
        "gpu_memory_total_gib": round(total / 2**30, 1),
        "gpu_memory_free_gib_at_start": round(free / 2**30, 1),
        "python": platform.python_version(),
        "machine": platform.machine(),
        "profile": PROFILE,
        "models": [MODEL, MODEL_FP8, DRAFT],
        "hf_hub_offline": os.environ.get("HF_HUB_OFFLINE") == "1",
    }


def missing_requirement():
    if platform.system() != "Linux":
        return "needs Linux with an NVIDIA GPU"
    try:
        import sglang
        import torch
    except ImportError as error:
        return f"SGLang is not installed ({error.name})"
    if sglang.__version__ != "0.5.22":
        return f"needs SGLang 0.5.22, found {sglang.__version__}"
    if not torch.cuda.is_available():
        return "no CUDA device"
    if PROFILE not in PROFILES:
        return f"unknown profile {PROFILE}, use one of {', '.join(PROFILES)}"
    if torch.cuda.mem_get_info()[1] < PROFILES[PROFILE]["min_gib"] * 2**30:
        return f"the {PROFILE} profile needs a GPU with at least {PROFILES[PROFILE]['min_gib']} GiB of memory"
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
        "stable-system-prompt cached over 2900": (facts.get("stable-system-prompt") or 0) > 2900,
        "id-at-start cached under 50": (facts.get("id-at-start") or 0) < 50,
        "id-at-end cached over 2900": (facts.get("id-at-end") or 0) > 2900,
    }


def generate_facts(text):
    blocks = text.split("POST /v1/chat/completions")
    native = json.loads(blocks[0].replace("POST /generate", "", 1))
    chat = json.loads(blocks[1])
    return {
        "generate prompt_tokens": native["meta_info"]["prompt_tokens"],
        "generate completion_tokens": native["meta_info"]["completion_tokens"],
        "chat usage": {k: chat["usage"][k] for k in ("prompt_tokens", "completion_tokens")},
    }


def structured_facts(text):
    return {row["case"]: row["valid"] for row in map(json.loads, text.splitlines())}


def determinism_facts(text):
    summary = json.loads(text.splitlines()[-1])
    return {"distinct_alone": summary["distinct_alone"], "rounds": summary["rounds"]}


def log_facts(text):
    keep = ("max_running_requests=", "RuntimeError:", "Error:")
    facts = set()
    for line in text.splitlines():
        if "max_running_requests=" in line:
            facts.add("max_running_requests=" + line.split("max_running_requests=")[1].split(",")[0])
        elif any(marker in line for marker in keep[1:]):
            facts.add(line.split("] ", 1)[-1].strip())
    return sorted(facts)


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
        elif path.name.endswith("generate.txt"):
            result[path.name] = generate_facts(text)
        elif path.name.endswith("structured.txt"):
            result[path.name] = structured_facts(text)
        elif path.name.endswith("determinism.txt"):
            result[path.name] = determinism_facts(text)
        elif path.name.endswith("metrics.txt"):
            result[path.name] = metric_names(text)
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
    global DATASET
    selected = [e for e in EXPERIMENTS if not only or e["name"] in only]
    models = {e["model"] for e in selected} | ({DRAFT} if any(DRAFT in e["flags"] for e in selected) else set())
    DATASET = prefetch(sorted(models))
    OUT.mkdir(exist_ok=True)
    (OUT / "environment.json").write_text(json.dumps(environment(), indent=2) + "\n")
    for experiment in EXPERIMENTS:
        if only and experiment["name"] not in only:
            continue
        name = experiment["name"]
        env = experiment.get("env", {})
        if experiment.get("expect_start_failure"):
            try:
                process, command = start_server(name, experiment["model"], experiment["flags"], OUT / f"server-{name}.log", env)
            except RuntimeError as error:
                print(f"[{name}] refused to start as expected: {error}", flush=True)
                continue
            stop_server(process)
            raise RuntimeError(f"{name}: the server started, but this configuration is expected to fail at startup")
        process, command = start_server(name, experiment["model"], experiment["flags"], OUT / f"server-{name}.log", env)
        (OUT / f"server-{name}.command.txt").write_text(" ".join([*(f"{k}={v}" for k, v in env.items()), "sglang", *command[1:]]) + "\n")
        try:
            for client, command in experiment["clients"]:
                print(f"[{name}] {client}", flush=True)
                target = OUT / (f"{client}.txt" if name == "default" else f"{name}-{client}.txt")
                if command is None:
                    save_metrics(target)
                    continue
                if callable(command):
                    command = command()
                result = subprocess.run(command, capture_output=True, text=True, timeout=3600)
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
