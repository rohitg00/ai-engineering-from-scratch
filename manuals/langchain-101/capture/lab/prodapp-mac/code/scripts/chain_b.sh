#!/bin/bash
cd "$(dirname "$0")/.."
for r in 1 2 3; do scripts/suite.sh qwen3-14b ollama:qwen3:14b ollama:qwen3:4b-instruct-2507-q4_K_M $r; done
.venv/bin/python -c "import app.ledger as l; t=l.total(); assert t < 39.0, t; print('ledger before haiku', round(t, 6), 'prodapp', round(l.total('prodapp'), 6))"
scripts/suite.sh haiku anthropic:claude-haiku-5-5 ollama:qwen3:4b-instruct-2507-q4_K_M 1 tests/test_evals.py
.venv/bin/python -c "import app.ledger as l; print('ledger after haiku', round(l.total(), 6), 'prodapp', round(l.total('prodapp'), 6))"
