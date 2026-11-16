#!/bin/zsh
cd "$(dirname "$0")"
PY=../.venv/bin/python
M4=ollama:qwen3:4b-instruct-2507-q4_K_M
M8=ollama:qwen3:8b
L=../logs
step() { echo "### $(date +%H:%M:%S) $* :: $(uptime)" | tee -a $L/queue.log; }
unload() { curl -s localhost:11434/api/generate -d "{\"model\":\"$1\",\"keep_alive\":0}" > /dev/null; }
step "q3: 4b deep full (resume)"
$PY run.py --models $M4 --harnesses deep_agent --out main.jsonl >> $L/q-4b.log 2>&1
step "q3: 4b create_agent+langgraph subset30"
$PY run.py --models $M4 --harnesses create_agent,langgraph --tasks subset30.txt --out main.jsonl >> $L/q-4b.log 2>&1
step "q3: structured 4b none,extract,tool"
$PY structured.py --models $M4 --variants none,extract,tool --out structured.jsonl >> $L/q-structured.log 2>&1
step "q3: structured 4b provider subset10"
$PY structured.py --models $M4 --variants provider --tasks chain01,chain05,chain09,chain13,chain17,sql01,sql05,sql09,sql13,sql17 --out structured.jsonl >> $L/q-structured.log 2>&1
step "q3: toolscale 4b"
$PY toolscale.py --models $M4 --sizes 5,20,50,100 --selector off,on,on_desc --tasks chain01,chain03,chain05,chain07,chain09,chain11,chain13,chain15,chain17,chain19 --out toolscale.jsonl >> $L/q-toolscale.log 2>&1
step "q3: repeats 4b subset30 plain+deep r1,r2"
$PY run.py --models $M4 --harnesses plain,deep_agent --tasks subset30.txt --repeats 2 --repeat-offset 1 --out main.jsonl >> $L/q-4b.log 2>&1
unload qwen3:4b-instruct-2507-q4_K_M
step "q3: 8b plain full"
$PY run.py --models $M8 --harnesses plain --out main.jsonl >> $L/q-8b.log 2>&1
step "q3: 8b deep+create_agent+langgraph subset30"
$PY run.py --models $M8 --harnesses deep_agent,create_agent,langgraph --tasks subset30.txt --out main.jsonl >> $L/q-8b.log 2>&1
unload qwen3:8b
for M in qwen3:30b-a3b gpt-oss:20b; do
  if ollama list | awk 'NR>1{print $1}' | grep -qx "$M"; then
    step "q3: $M subset30 plain+deep"
    $PY run.py --models ollama:$M --harnesses plain,deep_agent --tasks subset30.txt --out main.jsonl >> $L/q-big.log 2>&1
    unload $M
  else
    step "q3: $M not present, skipped"
  fi
done
step "q3: 8b deep full remainder"
$PY run.py --models $M8 --harnesses deep_agent --out main.jsonl >> $L/q-8b.log 2>&1
step "queue3 done"
