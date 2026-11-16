#!/bin/zsh
cd "$(dirname "$0")"
PY=../.venv/bin/python
L=../logs
step() { echo "### $(date +%H:%M:%S) $* :: $(uptime)" | tee -a $L/queue.log; }
step "q6: qwen3:30b-a3b (thinking variant; think on, num_predict 4096) subset30 plain+deep"
$PY run.py --models ollama:qwen3:30b-a3b --harnesses plain,deep_agent --tasks subset30.txt --out main.jsonl >> $L/q-big.log 2>&1
curl -s localhost:11434/api/generate -d '{"model":"qwen3:30b-a3b","keep_alive":0}' > /dev/null
step "q6: 8b deep full remainder"
$PY run.py --models ollama:qwen3:8b --harnesses deep_agent --out main.jsonl >> $L/q-8b.log 2>&1
step "queue3 done (via q6)"
