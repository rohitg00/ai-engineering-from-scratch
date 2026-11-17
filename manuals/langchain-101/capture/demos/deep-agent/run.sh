#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-../../.venv/bin/python}"
MODEL="${MODEL:-qwen3:8b}"
OUT="${OUT:-../../lab/deep-agent}"
unset $(env | grep -oE '^(LANGSMITH|LANGCHAIN|LANGGRAPH)_[A-Z_]+' || true)
export LANGSMITH_TRACING=false
mkdir -p "$OUT"
"$PY" -W ignore deep_agent.py "$MODEL" "$OUT/run.jsonl" 2>&1 | tee "$OUT/run.log"
curl -s http://127.0.0.1:11434/api/generate -d "{\"model\": \"$MODEL\", \"keep_alive\": 0}" > /dev/null || true
