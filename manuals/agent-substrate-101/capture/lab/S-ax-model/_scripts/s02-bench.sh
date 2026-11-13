set -u
E=~/evidence/S-ax-model/10-model; mkdir -p $E
cat > $E/bench.py <<'PY'
import json, sys, time, urllib.request
base = "http://172.18.0.5:11434"
def post(path, body):
    req = urllib.request.Request(base + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    t = time.time()
    with urllib.request.urlopen(req, timeout=600) as r:
        d = json.loads(r.read())
    return d, time.time() - t
tool = {"type": "function", "function": {"name": "get_pod_count", "description": "Return the number of pods in a Kubernetes namespace", "parameters": {"type": "object", "properties": {"namespace": {"type": "string"}}, "required": ["namespace"]}}}
print("model\tkind\trun\twall_s\tprompt_tokens\toutput_tokens\tprompt_eval_s\teval_s\ttokens_per_s\tresult")
for m in sys.argv[1:]:
    post("/api/chat", {"model": m, "messages": [{"role": "user", "content": "hi"}], "stream": False, "options": {"num_predict": 4}})
    for i in range(5):
        d, w = post("/api/chat", {"model": m, "messages": [{"role": "user", "content": "Explain in about 120 words what a container snapshot is."}], "stream": False, "options": {"num_predict": 200, "seed": i}})
        ev = d["eval_duration"] / 1e9
        print(f"{m}\tgenerate\t{i}\t{w:.3f}\t{d.get('prompt_eval_count')}\t{d['eval_count']}\t{d.get('prompt_eval_duration',0)/1e9:.3f}\t{ev:.3f}\t{d['eval_count']/ev:.1f}\tok", flush=True)
    for i in range(10):
        d, w = post("/v1/chat/completions", {"model": m, "seed": i, "messages": [{"role": "system", "content": "Use the tools to answer."}, {"role": "user", "content": "How many pods are in the namespace ax-system?"}], "tools": [tool]})
        msg = d["choices"][0]["message"]
        tc = msg.get("tool_calls") or []
        ok = "no-tool-call"
        if tc:
            try:
                a = json.loads(tc[0]["function"]["arguments"])
                ok = "ok" if tc[0]["function"]["name"] == "get_pod_count" and a.get("namespace") == "ax-system" else "wrong-args:" + json.dumps(a)
            except Exception as e:
                ok = "bad-json"
        u = d.get("usage", {})
        print(f"{m}\ttoolcall\t{i}\t{w:.3f}\t{u.get('prompt_tokens')}\t{u.get('completion_tokens')}\t\t\t\t{ok}", flush=True)
PY
python3 $E/bench.py qwen2.5:1.5b qwen2.5:3b | tee $E/10-bench.tsv
docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.CPUPerc}}' ollama > $E/11-ollama-mem.txt; cat $E/11-ollama-mem.txt
docker exec ollama ollama ps | tee $E/12-ollama-ps.txt
free -m | sed -n 2p | tee $E/13-guest-mem.txt
