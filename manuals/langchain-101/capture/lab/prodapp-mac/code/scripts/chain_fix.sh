#!/bin/bash
cd "$(dirname "$0")/.."
R=runs/2026-11-15-real/fix
Q4=ollama:qwen3:4b-instruct-2507-q4_K_M
Q14=ollama:qwen3:14b
for r in 1 2 3; do scripts/suite_fix.sh qwen3-4b $Q4 ollama:qwen3:8b $r; done
for r in 1 2 3; do scripts/suite_fix.sh qwen3-14b $Q14 $Q4 $r; done
export PYTHONPATH=.
MODEL=$Q4 BACKUP_MODEL=$Q14 .venv/bin/python scripts/crash_real.py $R/crash-qwen3-4b 3
MODEL=$Q14 BACKUP_MODEL=$Q4 .venv/bin/python scripts/crash_real.py $R/crash-qwen3-14b 3
MODEL=$Q4 BACKUP_MODEL=$Q14 .venv/bin/python load/loadtest.py $R/load 50 0 20 1
MODEL=$Q4 BACKUP_MODEL=$Q14 .venv/bin/python scripts/capture_stream.py $R/stream
echo chain-fix-done
