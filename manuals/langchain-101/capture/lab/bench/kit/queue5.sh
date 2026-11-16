#!/bin/zsh
cd "$(dirname "$0")"
PY=../.venv/bin/python
M8=ollama:qwen3:8b
L=../logs
step() { echo "### $(date +%H:%M:%S) $* :: $(uptime)" | tee -a $L/queue.log; }
until grep -q "queue4 done" $L/queue.log; do sleep 30; done
step "q5: structured 8b none,extract,tool"
$PY structured.py --models $M8 --variants none,extract,tool --out structured.jsonl >> $L/q-structured.log 2>&1
step "q5: toolscale 8b sizes 5,50"
$PY toolscale.py --models $M8 --sizes 5,50 --selector off,on,on_desc --tasks chain01,chain03,chain05,chain07,chain09,chain11,chain13,chain15,chain17,chain19 --out toolscale.jsonl >> $L/q-toolscale.log 2>&1
curl -s localhost:11434/api/generate -d '{"model":"qwen3:8b","keep_alive":0}' > /dev/null
step "queue5 done"
