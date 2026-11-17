import json
import re
import os
import platform
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

T21 = Path(__file__).resolve().parent.parent
SCRIPTS = T21 / "_scripts"
LAB = T21.parent.parent / "lab"
PY = str(LAB / ".venv" / "bin" / "python")
KEY_FILE = Path.home() / ".config" / "aiefs" / "langsmith.key"
PREFIX = "aiefs-lc101-"
MODEL = "qwen3:4b-instruct-2507-q4_K_M"
MODEL_SETTINGS = {"model": MODEL, "temperature": 0, "seed": 42, "reasoning": False}
API = "https://api.smith.langchain.com"


def read_key():
    return KEY_FILE.read_text().strip()


def scrub(text, key=None):
    key = key or read_key()
    if not text:
        return text
    out = text.replace(key, "<LANGSMITH_API_KEY>")
    if len(key) > 12:
        out = out.replace(key[:12], "<key-prefix>")
    out = re.sub(r"lsv2_[\w*]*\*{3,}[\w]*", "<masked-key>", out)
    return out


def child_env(extra=None, with_key=True):
    base = {k: v for k, v in os.environ.items() if not k.startswith(("LANGSMITH", "LANGCHAIN", "ANTHROPIC", "OPENAI"))}
    if with_key:
        base["LANGSMITH_API_KEY"] = read_key()
    base["PYTHONDONTWRITEBYTECODE"] = "1"
    base.update(extra or {})
    return base


def ollama_ps():
    try:
        with urllib.request.urlopen("http://127.0.0.1:11434/api/ps", timeout=3) as r:
            d = json.load(r)
        return [{"name": m["name"], "expires_at": m.get("expires_at")} for m in d.get("models", [])]
    except Exception as e:
        return [{"error": repr(e)}]


def ollama_procs():
    try:
        out = subprocess.run(["ps", "-axo", "pid,pcpu,etime,command"], capture_output=True, text=True).stdout
        return [l.strip()[:160] for l in out.splitlines() if "ollama" in l.lower() and "grep" not in l][:8]
    except Exception as e:
        return [repr(e)]


def env_snapshot():
    return {"t": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "load": os.getloadavg(), "ollama_ps": ollama_ps(),
            "machine": "the Mac (Apple M1 Max, 10 cores, 64 GiB)", "python": platform.python_version()}


def api(method, path, body=None, params=None, timeout=30):
    import requests
    h = {"x-api-key": read_key()}
    t0 = time.perf_counter()
    r = requests.request(method, API + path, headers=h, json=body, params=params, timeout=timeout)
    dt = time.perf_counter() - t0
    try:
        data = r.json()
    except Exception:
        data = r.text[:2000]
    return r.status_code, data, {k: v for k, v in r.headers.items()}, dt


def jdump(path, obj, mode="w"):
    s = json.dumps(obj, default=str)
    s = scrub(s)
    with open(path, mode) as f:
        f.write(s + "\n")
