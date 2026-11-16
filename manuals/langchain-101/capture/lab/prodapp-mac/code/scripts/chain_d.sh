#!/bin/bash
cd "$(dirname "$0")/.."
R=runs/2026-11-15-real
export PYTHONPATH=. MODEL=ollama:qwen3:4b-instruct-2507-q4_K_M BACKUP_MODEL=ollama:qwen3:14b
.venv/bin/python scripts/ollama_parallel.py $R/load/ollama-parallel.json 1,2,4,8 3
for k in 1 2 3 4 5; do .venv/bin/python load/loadtest.py $R/load-baseline-$k 1 0 20 1; done
.venv/bin/python load/loadtest.py $R/load 10,50 0 20 1,2,4
echo chain-d-done
