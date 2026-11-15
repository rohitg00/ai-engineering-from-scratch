import asyncio
import json
import subprocess
import sys
import time
from pathlib import Path

import httpx

MODEL = "qwen3:4b-instruct-2507-q4_K_M"
SYSTEM = ("You are the support assistant for an outdoor gear shop. Use tools to look up orders and help-center "
          "answers; never invent order data. Refunds need human approval. Keep replies short.")


def body(n):
    return {"model": MODEL, "stream": False, "think": False,
            "options": {"temperature": 0, "seed": 42, "num_predict": 64},
            "messages": [{"role": "system", "content": SYSTEM},
                         {"role": "user", "content": f"Customer {n} asks: how long does standard shipping take? Answer in two sentences."}]}


async def one(http, n):
    started = time.perf_counter()
    r = (await http.post("http://localhost:11434/api/chat", json=body(n))).json()
    return {"seconds": round(time.perf_counter() - started, 3), "prompt_eval_count": r.get("prompt_eval_count"),
            "eval_count": r.get("eval_count"), "eval_ms": round(r.get("eval_duration", 0) / 1e6, 1),
            "load_ms": round(r.get("load_duration", 0) / 1e6, 1)}


async def main(out, levels="1,2,4,8", rounds="3"):
    result = {"model": MODEL, "uptime_before": subprocess.run(["uptime"], capture_output=True, text=True).stdout.strip(),
              "levels": []}
    async with httpx.AsyncClient(timeout=300) as http:
        await one(http, 0)
        for level in map(int, levels.split(",")):
            for r in range(int(rounds)):
                started = time.perf_counter()
                rows = await asyncio.gather(*(one(http, 100 * level + k) for k in range(level)))
                wall = time.perf_counter() - started
                tokens = sum(x["eval_count"] or 0 for x in rows)
                result["levels"].append({"concurrent": level, "round": r + 1, "wall_s": round(wall, 3),
                                         "output_tokens": tokens, "tokens_per_s": round(tokens / wall, 1), "requests": rows})
                print(level, r + 1, round(wall, 2), round(tokens / wall, 1), flush=True)
    result["uptime_after"] = subprocess.run(["uptime"], capture_output=True, text=True).stdout.strip()
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(json.dumps(result, indent=1))


if __name__ == "__main__":
    asyncio.run(main(*sys.argv[1:]))
