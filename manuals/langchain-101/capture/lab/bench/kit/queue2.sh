#!/bin/zsh
cd "$(dirname "$0")"
PY=../.venv/bin/python
L=../logs
step() { echo "### $(date +%H:%M:%S) $* :: $(uptime)" | tee -a $L/queue.log; }
until grep -q "queue done" $L/queue.log; do sleep 30; done
for M in qwen3:30b-a3b gpt-oss:20b qwen3:14b; do
  if ollama list | awk 'NR>1{print $1}' | grep -qx "$M"; then
    step "$M subset30 plain+deep"
    $PY run.py --models ollama:$M --harnesses plain,deep_agent --tasks subset30.txt --out main.jsonl >> $L/q-big.log 2>&1
    curl -s localhost:11434/api/generate -d "{\"model\":\"$M\",\"keep_alive\":0}" > /dev/null
  else
    step "$M not present, skipped"
  fi
done
step "queue2 done"
