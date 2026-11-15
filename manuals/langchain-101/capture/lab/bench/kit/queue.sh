#!/bin/zsh
cd "$(dirname "$0")"
PY=../.venv/bin/python
M4=ollama:qwen3:4b-instruct-2507-q4_K_M
M8=ollama:qwen3:8b
L=../logs
step() { echo "### $(date +%H:%M:%S) $* :: $(uptime)" | tee -a $L/queue.log; }

step "4b plain+deep full"
$PY run.py --models $M4 --harnesses plain,deep_agent --out main.jsonl >> $L/q-4b.log 2>&1
step "4b create_agent+langgraph subset30"
$PY run.py --models $M4 --harnesses create_agent,langgraph --tasks subset30.txt --out main.jsonl >> $L/q-4b.log 2>&1
step "structured 4b none,extract,tool"
$PY structured.py --models $M4 --variants none,extract,tool --out structured.jsonl >> $L/q-structured.log 2>&1
step "structured 4b provider subset10"
$PY structured.py --models $M4 --variants provider --tasks chain01,chain05,chain09,chain13,chain17,sql01,sql05,sql09,sql13,sql17 --out structured.jsonl >> $L/q-structured.log 2>&1
step "toolscale 4b"
$PY toolscale.py --models $M4 --sizes 5,20,50,100 --selector off,on,on_desc --tasks chain01,chain03,chain05,chain07,chain09,chain11,chain13,chain15,chain17,chain19 --out toolscale.jsonl >> $L/q-toolscale.log 2>&1
step "repeats 4b subset30 plain+deep r1,r2"
$PY run.py --models $M4 --harnesses plain,deep_agent --tasks subset30.txt --repeats 2 --repeat-offset 1 --out main.jsonl >> $L/q-4b.log 2>&1
step "8b plain+deep full"
$PY run.py --models $M8 --harnesses plain,deep_agent --out main.jsonl >> $L/q-8b.log 2>&1
step "8b create_agent+langgraph subset30"
$PY run.py --models $M8 --harnesses create_agent,langgraph --tasks subset30.txt --out main.jsonl >> $L/q-8b.log 2>&1
step "queue done"
