import json
import os
import signal
import subprocess
import sys
import threading
import time
import urllib.request

BASE = "http://127.0.0.1:30001"
LOG = sys.argv[1]


def healthy():
    try:
        with urllib.request.urlopen(BASE + "/health", timeout=2) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code
    except OSError:
        return None


def long_request(results):
    body = json.dumps({"text": "Count from one to two hundred:", "sampling_params": {"max_new_tokens": 3000, "temperature": 0, "ignore_eos": True}}).encode()
    request = urllib.request.Request(BASE + "/generate", body, {"Content-Type": "application/json"})
    start = time.time()
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            data = json.loads(response.read())
            results.append({"status": response.status, "completion_tokens": data["meta_info"]["completion_tokens"], "finish_reason": data["meta_info"]["finish_reason"], "seconds": round(time.time() - start, 1)})
    except Exception as error:
        results.append({"error": repr(error)[:200], "seconds": round(time.time() - start, 1)})


env = dict(os.environ, SGLANG_USE_MLX="1")
command = ["sglang", "serve", "--model-path", "mlx-community/Qwen3-0.6B-4bit", "--disable-cuda-graph", "--host", "127.0.0.1", "--port", "30001", "--mem-fraction-static", "0.4"]
with open(LOG, "w") as log:
    server = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, env=env, start_new_session=True)
    deadline = time.time() + 600
    while healthy() != 200:
        if server.poll() is not None or time.time() > deadline:
            if server.poll() is None:
                os.killpg(server.pid, signal.SIGKILL)
            sys.exit(f"server did not become healthy, see {LOG}")
        time.sleep(2)
    results = []
    worker = threading.Thread(target=long_request, args=(results,))
    worker.start()
    time.sleep(3)
    print(f"health before SIGTERM: {healthy()}")
    os.kill(server.pid, signal.SIGTERM)
    print("sent SIGTERM to the server process only")
    time.sleep(1)
    print(f"health during drain: {healthy()}")
    worker.join()
    print(f"in-flight request: {json.dumps(results[0])}")
    server.wait(timeout=120)
    print(f"server exit code: {server.returncode}")
