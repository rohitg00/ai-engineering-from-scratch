#!/bin/bash
set -u
cd "$(dirname "$0")/.."
label=$1; model=$2; backup=$3; rep=$4; shift 4
dir=runs/2026-11-15-real/suite/$label/rep-$rep
mkdir -p "$dir"
{ echo "# block $label rep $rep"; echo "# model $model backup $backup"; echo "# start $(date -u +%FT%TZ)"; echo "# uptime $(uptime)"; } > "$dir/block.txt"
USAGE_FILE=$dir/usage.jsonl MODEL=$model BACKUP_MODEL=$backup TEST_RUN_DIR=$dir LEDGER_CELL="prodapp|evals|$label" \
  .venv/bin/python -m pytest -v -rA --durations=0 --junitxml="$dir/junit.xml" "$@" > "$dir/pytest.txt" 2>&1
code=$?
{ echo "# end $(date -u +%FT%TZ)"; echo "# uptime $(uptime)"; echo "# exit $code"; } >> "$dir/block.txt"
tail -1 "$dir/pytest.txt"
