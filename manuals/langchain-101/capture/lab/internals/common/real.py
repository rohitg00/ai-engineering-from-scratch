import json
import os
import platform
import subprocess
import time
import urllib.request
from typing import Any, ClassVar

from langchain_ollama import ChatOllama

BASE_URL = "http://127.0.0.1:11434"
M4B = "qwen3:4b-instruct-2507-q4_K_M"
M8B = "qwen3:8b"
NUM_CTX = 8192


class TimedChatOllama(ChatOllama):
    calls: ClassVar[list] = []

    def _generate(self, messages, stop=None, run_manager=None, **kwargs: Any):
        t0 = time.perf_counter()
        try:
            r = super()._generate(messages, stop=stop, run_manager=run_manager, **kwargs)
        finally:
            dt = time.perf_counter() - t0
        meta = {}
        if r.generations:
            meta = {**(r.generations[0].generation_info or {}), **(r.generations[0].message.response_metadata or {})}
        TimedChatOllama.calls.append({
            "t_end": time.perf_counter(), "model_s": dt, "model": self.model,
            "prompt_eval_count": meta.get("prompt_eval_count"), "eval_count": meta.get("eval_count"),
            "total_duration_s": (meta.get("total_duration") or 0) / 1e9,
            "load_duration_s": (meta.get("load_duration") or 0) / 1e9,
            "n_tool_calls": len(getattr(r.generations[0].message, "tool_calls", []) or []) if r.generations else None,
        })
        return r


def chat(model=M4B, *, num_ctx=NUM_CTX, reasoning=False, cls=TimedChatOllama, **kw):
    return cls(model=model, temperature=0, seed=42, reasoning=reasoning, num_ctx=num_ctx,
               keep_alive="60m", base_url=BASE_URL, **kw)


def settings(model=M4B, num_ctx=NUM_CTX, reasoning=False, **extra):
    return {"provider": "ollama 0.31.1 (CPU)", "model": model, "temperature": 0, "seed": 42,
            "think/reasoning": reasoning, "num_ctx": num_ctx, **extra}


def loadavg():
    try:
        return open("/proc/loadavg").read().split()[:3]
    except OSError:
        return None


def ollama_ps():
    try:
        with urllib.request.urlopen(BASE_URL + "/api/ps", timeout=5) as r:
            return [{"name": m["name"], "size_vram": m.get("size_vram"), "context_length": m.get("context_length")} for m in json.load(r).get("models", [])]
    except Exception as e:
        return str(e)


def machine():
    return {
        "name": "the x86 server guest",
        "cpu": "AMD EPYC 7452 (KVM guest, 32 vCPU, 48 GiB, no GPU)",
        "platform": platform.platform(),
        "python": platform.python_version(),
        "loadavg_1_5_15": loadavg(),
        "ollama_ps": ollama_ps(),
    }


def other_python_procs():
    try:
        out = subprocess.run(["ps", "-eo", "pid,pcpu,comm,args"], capture_output=True, text=True).stdout.splitlines()
        return [l for l in out[1:] if "python" in l and str(os.getpid()) not in l.split()[0]][:10]
    except Exception:
        return []
