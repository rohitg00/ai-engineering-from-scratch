#!/bin/zsh
cd "$(dirname "$0")"
PY=$HOME/.cache/aiefs-manuals-wip/langchain-research/bench/.venv/bin/python
L=../logs
export OLLAMA_HOST=127.0.0.1:11435
M8=ollama:qwen3:8b
M14=ollama:qwen3:14b
MG=ollama:gpt-oss:20b
FAILS=chain04,chain10,chain15,chain16,chain20,sql02,sql03,sql07,sql09,sql10,sql11,sql12,sql16,sql18,r04,r06,r09,r10,r12,r13,r18,files04,files07,files11,multi13
MISS=chain02,chain03,chain05,chain06,chain08,chain09,chain11,chain12,chain14,chain15,chain17,chain18,chain19,chain20,sql02,sql03,sql05,sql06,sql08,sql09,sql11,sql12,sql14,sql15,sql17,sql18,sql20
step() { echo "### $(date +%H:%M:%S) $* :: $(uptime)" | tee -a $L/queue.log; }

step "r: 8b create_agent + RubricMiddleware(14b) on 25"
$PY run2.py --models $M8 --harness agent_rubric --judge $M14 --judge-host http://127.0.0.1:11434 --max-calls 20 --tasks $FAILS --out rubric.jsonl --tag rubric14 >> $L/q-rubric.log 2>&1
step "x: 8b deep_ptc chain+sql"
$PY run2.py --models $M8 --harness deep_ptc --tasks chain,sql --out ptc.jsonl --tag ptc >> $L/q-ptc.log 2>&1
step "x: 14b deep_ptc 39"
$PY run2.py --models $M14 --harness deep_ptc --tasks chain,sql --out ptc.jsonl --tag ptc >> $L/q-ptc.log 2>&1
step "x: gpt-oss deep_ptc 39"
$PY run2.py --models $MG --harness deep_ptc --tasks chain,sql --out ptc.jsonl --tag ptc >> $L/q-ptc.log 2>&1
step "x: 14b deep_control missing 27"
$PY run2.py --models $M14 --harness deep_control --tasks $MISS --out ptc.jsonl --tag base >> $L/q-ptc.log 2>&1
step "x: gpt-oss deep_control missing 27"
$PY run2.py --models $MG --harness deep_control --tasks $MISS --out ptc.jsonl --tag base >> $L/q-ptc.log 2>&1
step "x: 8b deep_ptc_nudge chain+sql"
$PY run2.py --models $M8 --harness deep_ptc_nudge --tasks chain,sql --out ptc.jsonl --tag nudge >> $L/q-ptc.log 2>&1
step "x/r: done"
