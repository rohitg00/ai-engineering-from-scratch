#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-../../.venv/bin/python}"
MODELS="${MODELS:-qwen3:4b-instruct-2507-q4_K_M qwen3:8b}"
OUT="${OUT:-../../lab/retrieval-agent}"
ROOT="$(cd ../../../../.. && pwd)"
unset $(env | grep -oE '^(LANGSMITH|LANGCHAIN|LANGGRAPH)_[A-Z_]+' || true)
export LANGSMITH_TRACING=false
mkdir -p "$OUT"
(cd "$ROOT" && shasum -a 256 $(sed -n 's/^    "\(phases\/[^"]*\)",$/\1/p' "$OLDPWD/retrieval_agent.py")) > "$OUT/corpus.txt"
for MODEL in $MODELS; do
  TAG="$(echo "$MODEL" | sed -E 's/^qwen3:([0-9.]+b).*/\1/')"
  "$PY" retrieval_agent.py "$MODEL" "$ROOT" "$OUT/run-$TAG.jsonl" 2>&1 | sed "s#$ROOT/##g" | tee "$OUT/run-$TAG.log"
  curl -s http://127.0.0.1:11434/api/generate -d "{\"model\": \"$MODEL\", \"keep_alive\": 0}" > /dev/null || true
done
curl -s http://127.0.0.1:11434/api/embed -d '{"model": "nomic-embed-text", "keep_alive": 0}' > /dev/null || true
