#!/bin/zsh
cd "$(dirname "$0")"
PY=$HOME/.cache/aiefs-manuals-wip/langchain-research/bench/.venv/bin/python
L=../logs
export OLLAMA_HOST=127.0.0.1:11435
M4=ollama:qwen3:4b-instruct-2507-q4_K_M
M8=ollama:qwen3:8b
step() { echo "### $(date +%H:%M:%S) $* :: $(uptime)" | tee -a $L/queue.log; }

step "p: 4b profile B subset30"
$PY run2.py --models $M4 --harness deep_profile --profile B --tasks subset30.txt --out profiles.jsonl --tag profB >> $L/q-profiles.log 2>&1
step "p: 8b profile B subset30"
$PY run2.py --models $M8 --harness deep_profile --profile B --tasks subset30.txt --out profiles.jsonl --tag profB >> $L/q-profiles.log 2>&1
step "p: 4b profile B rest of 99"
$PY run2.py --models $M4 --harness deep_profile --profile B --out profiles.jsonl --tag profB >> $L/q-profiles.log 2>&1
step "p: 8b profile B rest of 99"
$PY run2.py --models $M8 --harness deep_profile --profile B --out profiles.jsonl --tag profB >> $L/q-profiles.log 2>&1
step "p: 4b profile A subset30"
$PY run2.py --models $M4 --harness deep_profile --profile A --tasks subset30.txt --out profiles.jsonl --tag profA >> $L/q-profiles.log 2>&1
step "p: 8b profile A subset30"
$PY run2.py --models $M8 --harness deep_profile --profile A --tasks subset30.txt --out profiles.jsonl --tag profA >> $L/q-profiles.log 2>&1
step "p: done"
