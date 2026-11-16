#!/bin/zsh
cd "$(dirname "$0")"
PY=../.venv/bin/python
L=../logs
H=anthropic:claude-haiku-5-5
S=anthropic:claude-sonnet-5-5
step() {
  T=$($PY ledger_total.py)
  echo "### $(date +%H:%M:%S) $* :: ledger USD $T :: $(uptime)" | tee -a $L/queue.log
}
step "A1 haiku plain full100"
$PY run.py --models $H --harnesses plain --max-tokens 1024 --cell-token-cap 300000 --run-token-cap 2000000 --out main.jsonl >> $L/q-anthropic.log 2>&1
step "A2 haiku deep_agent full100"
$PY run.py --models $H --harnesses deep_agent --max-tokens 1024 --cell-token-cap 300000 --run-token-cap 6000000 --out main.jsonl >> $L/q-anthropic.log 2>&1
step "A3 haiku deep_agent_fs files20"
$PY run.py --models $H --harnesses deep_agent_fs --tasks files --max-tokens 1024 --cell-token-cap 300000 --run-token-cap 1500000 --out main.jsonl >> $L/q-anthropic.log 2>&1
for V in none extract tool provider; do
  step "A4 haiku structured $V"
  $PY structured.py --models $H --variants $V --run-token-cap 1500000 --out structured.jsonl >> $L/q-anthropic.log 2>&1
done
step "A5 haiku toolscale"
$PY toolscale.py --models $H --sizes 5,20,50,100 --selector off,on --tasks chain01,chain03,chain05,chain07,chain09,chain11,chain13,chain15,chain17,chain19 --run-token-cap 5000000 --out toolscale.jsonl >> $L/q-anthropic.log 2>&1
step "A6 sonnet plain subset30"
$PY run.py --models $S --harnesses plain --tasks subset30.txt --max-tokens 1024 --cell-token-cap 300000 --run-token-cap 600000 --out main.jsonl >> $L/q-anthropic.log 2>&1
step "A7 sonnet deep_agent subset30"
$PY run.py --models $S --harnesses deep_agent --tasks subset30.txt --max-tokens 1024 --cell-token-cap 300000 --run-token-cap 2000000 --out main.jsonl >> $L/q-anthropic.log 2>&1
step "anthropic queue done"
