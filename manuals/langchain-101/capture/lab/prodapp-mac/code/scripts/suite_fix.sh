#!/bin/bash
cd "$(dirname "$0")/.."
label=$1; model=$2; backup=$3; rep=$4
dir=runs/2026-11-15-real/fix/suite/$label/rep-$rep
mkdir -p "$dir"
{ echo "# block fix $label rep $rep"; echo "# model $model backup $backup"; echo "# start $(date -u +%FT%TZ)"; echo "# uptime $(uptime)"; } > "$dir/block.txt"
USAGE_FILE=$dir/usage.jsonl MODEL=$model BACKUP_MODEL=$backup TEST_RUN_DIR=$dir \
  .venv/bin/python -m pytest -v -rA --junitxml="$dir/junit.xml" \
  "tests/test_evals.py::test_eval[refund_approved_once]" \
  "tests/test_evals.py::test_eval[refund_rejected_has_no_side_effect]" \
  "tests/test_evals.py::test_eval[refund_asked_twice]" \
  "tests/test_evals.py::test_eval[refund_tool_replay_is_idempotent]" \
  "tests/test_evals.py::test_eval[new_message_while_waiting_for_approval]" \
  "tests/test_evals.py::test_eval[status_then_refund_in_one_thread]" \
  "tests/test_durability.py::test_kill_mid_refund_then_resume_refunds_once" > "$dir/pytest.txt" 2>&1
code=$?
{ echo "# end $(date -u +%FT%TZ)"; echo "# uptime $(uptime)"; echo "# exit $code"; } >> "$dir/block.txt"
tail -1 "$dir/pytest.txt"
