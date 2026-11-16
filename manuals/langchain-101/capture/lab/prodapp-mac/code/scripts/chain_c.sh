#!/bin/bash
cd "$(dirname "$0")/.."
R=runs/2026-11-15-real
Q4=ollama:qwen3:4b-instruct-2507-q4_K_M
Q14=ollama:qwen3:14b
export PYTHONPATH=.
scripts/cache_probe.sh $R/ollama-cache-probe.txt
MODEL=$Q4 BACKUP_MODEL=$Q14 .venv/bin/python scripts/crash_real.py $R/crash-map 10
MODEL=$Q4 BACKUP_MODEL=$Q14 RESUME_FORM=plain .venv/bin/python scripts/crash_real.py $R/crash-plain 10
MODEL=$Q14 BACKUP_MODEL=$Q4 .venv/bin/python scripts/drain_real.py $R/drain 5
MODEL=$Q4 BACKUP_MODEL=$Q14 .venv/bin/python scripts/capture_stream.py $R/stream
MODEL=$Q4 BACKUP_MODEL=$Q14 .venv/bin/python scripts/disconnect_real.py $R/disconnect 5
MODEL=$Q4 BACKUP_MODEL=$Q14 .venv/bin/python scripts/service_real.py $R/service
echo chain-c-done
