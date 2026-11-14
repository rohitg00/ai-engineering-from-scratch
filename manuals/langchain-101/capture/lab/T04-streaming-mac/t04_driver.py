import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

EVID = Path(__file__).resolve().parent.parent
PY = str(EVID.parent / "lab" / ".venv" / "bin" / "python")
S = EVID / "_scripts"
OUT = EVID / "T04"
ALL = ["plain_openai", "chatopenai_stream", "agent_messages", "agent_messages_updates", "astream_events_v2",
       "stream_events_v3", "stream_events_v3_raw", "astream_events_v3", "astream_events_v3_gather"]
AGENT_ONLY = ALL[2:]

PHASES = {
    "text": dict(model="text|K=40|R=20|P=50", scenario="text", variants=ALL, blocks=5, per=10, warm=1, mode="stub"),
    "tool": dict(model="tool|A=200|Ra=2.5|K=40|R=20|P=50", scenario="tool", variants=ALL, blocks=5, per=10, warm=1, mode="stub"),
    "subagent": dict(model="subagent|A=20|Ra=2.5|K=40|R=20|P=50", scenario="subagent", variants=AGENT_ONLY, blocks=4, per=5, warm=1, mode="stub"),
    "ollama": dict(model="qwen3:4b-instruct-2507-q4_K_M", scenario="ollama_text", variants=ALL, blocks=4, per=5, warm=1, mode="proxy"),
}


def wait(port):
    for _ in range(100):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1)
            return
        except Exception:
            time.sleep(0.1)
    raise RuntimeError("server")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--phase", required=True)
    p.add_argument("--port", type=int, default=18150)
    a = p.parse_args()
    cfg = PHASES[a.phase]
    srv_log = OUT / f"{a.phase}-server.jsonl"
    runs = OUT / f"{a.phase}-runs.jsonl"
    drv = open(OUT / f"{a.phase}-driver.jsonl", "a")
    srv = subprocess.Popen([PY, str(S / "t04_stream_server.py"), "--port", str(a.port), "--log", str(srv_log), "--mode", cfg["mode"]],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait(a.port)
        for b in range(cfg["blocks"]):
            order = cfg["variants"] if b % 2 == 0 else list(reversed(cfg["variants"]))
            for v in order:
                if (OUT / "STOP").exists():
                    return
                drv.write(json.dumps({"t": time.time(), "block": b, "variant": v, "load_before": os.getloadavg()}) + "\n")
                drv.flush()
                subprocess.run([PY, str(S / "t04_run.py"), "--variant", v, "--scenario", cfg["scenario"], "--model", cfg["model"],
                                "--port", str(a.port), "--n", str(cfg["per"]), "--warmup", str(cfg["warm"]), "--block", str(b),
                                "--out", str(runs)], check=False, timeout=1800, stderr=subprocess.DEVNULL)
                print(a.phase, b, v, flush=True)
    finally:
        srv.terminate()
        srv.wait(5)


if __name__ == "__main__":
    main()
