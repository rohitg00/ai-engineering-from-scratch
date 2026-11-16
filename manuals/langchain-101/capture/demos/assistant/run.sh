#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-../../.venv/bin/python}"
export MODEL="${MODEL:-qwen3:4b-instruct-2507-q4_K_M}"
OUT="${OUT:-../../lab/assistant}"
unset $(env | grep -oE '^(LANGSMITH|LANGCHAIN|LANGGRAPH)_[A-Z_]+' || true)
export LANGSMITH_TRACING=false
mkdir -p "$OUT"
export WORK="$(mktemp -d "${TMPDIR:-/tmp}/assistant.XXXXXX")"
LOG="$OUT/run${DURABILITY:+-$DURABILITY}.log"
export ROWS="$OUT/run${DURABILITY:+-$DURABILITY}.jsonl"
: > "$ROWS"
: > "$LOG"
trap 'rm -rf "$WORK"' EXIT

step() {
  ( exec "$PY" assistant.py "$@" ) 2>&1 | grep -v -E 'Warning|warnings.warn' | tee -a "$LOG"
  local code=${PIPESTATUS[0]}
  echo "  exit       $code" | tee -a "$LOG"
}

echo "model $MODEL, temperature 0, seed 42; every step is a new Python process" | tee -a "$LOG"
step 1-remember t1 say "Please remember two facts: I prefer short replies, and my manager's email address is lead@example.org."
step 2-ask-to-send t1 say "Email my manager that the quarterly report is ready."
CRASH_AFTER_SEND=1 step 3-approve-then-crash t1 approve
step 4-resume-after-crash t1 resume
step 5-approve-again t1 approve
step 6-third-turn t1 say "Thanks. What is my manager's email address?"
step 7-new-thread t2 say "What do you remember about how I like replies?"
{
  echo
  echo "== files after the run"
  sqlite3 "$WORK/outbox.sqlite" "SELECT 'sent', idempotency_key, recipient, subject FROM sent; SELECT 'attempt', n, idempotency_key, outcome FROM attempts;"
  sqlite3 "$WORK/checkpoints.sqlite" "SELECT 'checkpoints', thread_id, COUNT(*) FROM checkpoints GROUP BY thread_id;"
  sqlite3 "$WORK/memory.sqlite" "SELECT 'store', prefix, key, value FROM store;"
} | tee -a "$LOG"
curl -s http://127.0.0.1:11434/api/generate -d "{\"model\": \"$MODEL\", \"keep_alive\": 0}" > /dev/null || true
