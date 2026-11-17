#!/bin/zsh
cd "$(dirname "$0")"
PY=../.venv/bin/python
L=../logs
step() { echo "### $(date +%H:%M:%S) $* :: $(uptime)" | tee -a $L/queue.log; }
until grep -q "queue3 done" $L/queue.log; do sleep 30; done
step "q4: deep_agent_fs files family 4b"
$PY run.py --models ollama:qwen3:4b-instruct-2507-q4_K_M --harnesses deep_agent_fs --tasks files --out main.jsonl >> $L/q-4b.log 2>&1
curl -s localhost:11434/api/generate -d '{"model":"qwen3:4b-instruct-2507-q4_K_M","keep_alive":0}' > /dev/null
step "q4: deep_agent_fs files family 8b"
$PY run.py --models ollama:qwen3:8b --harnesses deep_agent_fs --tasks files --out main.jsonl >> $L/q-8b.log 2>&1
curl -s localhost:11434/api/generate -d '{"model":"qwen3:8b","keep_alive":0}' > /dev/null
step "q4: sampling variance 4b plain subset30 temperature 0.7 seeds 1-3"
for S in 1 2 3; do
  $PY run.py --models ollama:qwen3:4b-instruct-2507-q4_K_M --harnesses plain --tasks subset30.txt --temperature 0.7 --seed $S --tag t07-s$S --out sampling.jsonl >> $L/q-4b.log 2>&1
done
curl -s localhost:11434/api/generate -d '{"model":"qwen3:4b-instruct-2507-q4_K_M","keep_alive":0}' > /dev/null
if ollama list | awk 'NR>1{print $1}' | grep -qx "gpt-oss:20b"; then
  step "q4: gpt-oss:20b subset30 plain+deep"
  $PY run.py --models ollama:gpt-oss:20b --harnesses plain,deep_agent --tasks subset30.txt --out main.jsonl >> $L/q-big.log 2>&1
  curl -s localhost:11434/api/generate -d '{"model":"gpt-oss:20b","keep_alive":0}' > /dev/null
fi
step "q4: qwen3:14b subset30 plain+deep"
$PY run.py --models ollama:qwen3:14b --harnesses plain,deep_agent --tasks subset30.txt --out main.jsonl >> $L/q-big.log 2>&1
curl -s localhost:11434/api/generate -d '{"model":"qwen3:14b","keep_alive":0}' > /dev/null
step "queue4 done"
