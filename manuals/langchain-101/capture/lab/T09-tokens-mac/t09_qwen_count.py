import json
import sys

import ollama

OUT = sys.argv[1]
files = sys.argv[2:]
rows = []
for path in files:
    for line in open(path):
        r = json.loads(line)
        tools = [{"type": "function", "function": t} for t in r["tool_schemas"]]
        variants = {
            "system+user 'hi'+tools": ([{"role": "system", "content": r["system_prompt"]}, {"role": "user", "content": "hi"}], tools),
            "user 'hi' only": ([{"role": "user", "content": "hi"}], []),
            "system+user 'hi', no tools": ([{"role": "system", "content": r["system_prompt"]}, {"role": "user", "content": "hi"}], []),
        }
        for label, (msgs, tl) in variants.items():
            counts = []
            for rep in range(3):
                res = ollama.chat(model="qwen3:8b", messages=msgs, tools=tl or None, think=False,
                                  options={"num_predict": 1, "temperature": 0, "seed": 42, "num_ctx": 16384})
                counts.append(res.prompt_eval_count)
            rows.append({"deepagents": r["deepagents"], "profile_model": r["model"], "variant": label, "qwen3_prompt_eval_count_x3": counts})
            print(rows[-1], flush=True)
ollama.generate(model="qwen3:8b", prompt="", keep_alive=0) if False else None
with open(OUT, "w") as f:
    for r in rows:
        f.write(json.dumps(r) + "\n")
