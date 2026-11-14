#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-../../.venv/bin/python}"
MODELS="${MODELS:-qwen3:4b-instruct-2507-q4_K_M qwen3:8b}"
OUT="${OUT:-../../lab/sql-agent}"
DB="${CHINOOK_DB:-Chinook.db}"
SHA=84f5d9143ac4deebdb81650ab650e226d909e660106846b119a5c47c33f94c13
if [ ! -f "$DB" ]; then
  curl -fsSL -o "$DB" https://storage.googleapis.com/benchmarks-artifacts/chinook/Chinook.db
fi
echo "$SHA  $DB" | shasum -a 256 -c -
unset $(env | grep -oE '^(LANGSMITH|LANGCHAIN|LANGGRAPH)_[A-Z_]+' || true)
export LANGSMITH_TRACING=false
mkdir -p "$OUT"
for MODEL in $MODELS; do
  TAG="$(echo "$MODEL" | sed -E 's/^qwen3:([0-9.]+b).*/\1/')"
  WORK="$(mktemp -d "${TMPDIR:-/tmp}/sql-agent.XXXXXX")"
  "$PY" sql_agent.py "$MODEL" "$DB" "$WORK" "$OUT/run-$TAG.jsonl" 2>&1 | sed "s#$WORK#<work>#g" | tee "$OUT/run-$TAG.log"
  rm -rf "$WORK"
  curl -s http://127.0.0.1:11434/api/generate -d "{\"model\": \"$MODEL\", \"keep_alive\": 0}" > /dev/null || true
done
