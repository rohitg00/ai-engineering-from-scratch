#!/bin/bash
cd "$(dirname "$0")/.."
R=runs/2026-11-15-real/fix
until grep -q chain-fix-done $R/chain.out; do sleep 10; done
Q4=ollama:qwen3:4b-instruct-2507-q4_K_M
Q14=ollama:qwen3:14b
for m in qwen3-4b qwen3-14b; do
  if [ $m = qwen3-4b ]; then model=$Q4; backup=$Q14; else model=$Q14; backup=$Q4; fi
  for r in 1 2 3; do
    dir=$R/suite-crash/$m/rep-$r; mkdir -p $dir
    { echo "# uptime $(uptime)"; } > $dir/block.txt
    MODEL=$model BACKUP_MODEL=$backup TEST_RUN_DIR=$dir .venv/bin/python -m pytest -v -rA --junitxml=$dir/junit.xml \
      tests/test_durability.py::test_kill_mid_refund_then_resume_refunds_once > $dir/pytest.txt 2>&1
    tail -1 $dir/pytest.txt
  done
  PYTHONPATH=. MODEL=$model BACKUP_MODEL=$backup .venv/bin/python scripts/crash_real.py $R/crash-$m 3
done
echo chain-fix2-done
