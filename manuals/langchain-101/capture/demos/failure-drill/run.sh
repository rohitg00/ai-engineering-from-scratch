#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-../../.venv/bin/python}"
OUT="${OUT:-../../lab/failure-drill-x86}"
unset $(env | grep -oE '^(LANGSMITH|LANGCHAIN|LANGGRAPH|OPENAI)_[A-Z_]+' || true)
export LANGSMITH_TRACING=false
mkdir -p "$OUT"
for run in 1 2 3; do
  "$PY" drill.py "$OUT/drill-run$run.jsonl" 2>&1 | tee "$OUT/drill-run$run.log"
done
