#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-../../.venv/bin/python}"
OUT="${OUT:-../../lab/failure-drill}"
unset $(env | grep -oE '^(LANGSMITH|LANGCHAIN|LANGGRAPH|OPENAI)_[A-Z_]+' || true)
export LANGSMITH_TRACING=false
mkdir -p "$OUT"
"$PY" drill.py "$OUT/drill.jsonl" 2>&1 | tee "$OUT/drill.log"
