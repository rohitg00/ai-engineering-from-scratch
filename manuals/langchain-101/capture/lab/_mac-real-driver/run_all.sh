#!/bin/bash
set -u
P=python3
L=$(cd "$(dirname "$0")/.." && pwd)
STOP=$L/STOP
mark() { echo "=== $(date -u +%FT%TZ) $1 | $(uptime)"; }
step() { [ -e $STOP ] && { mark "STOP file, skipping $1"; return 1; }; mark "$1"; }
cd $L/T04-streaming-mac-real
step "T04 real_text" && $P t04_driver.py --phase real_text --port 18160
step "T04 real_tool" && $P t04_driver.py --phase real_tool --port 18161
step "T04 iso qwen3:8b" && $P t04_iso_real.py 5 03-iso38484-qwen3-8b.jsonl > 03-iso38484-qwen3-8b.log 2>&1
cd $L/T06-structured-output-mac-real
step "T06 provider" && $P t06_provider_real.py 3 01-provider-paths.jsonl > 01-provider-paths.log 2>&1
cd $L/TRC-tracing-mac-real
step "TRC latency" && $P trc_driver.py 03-latency "off#1,ok#1,ok-fg#1,ok-fg#2,ok#2,off#2,off#3,ok#3,ok-fg#3" 21 > 03-latency.log 2>&1
step "TRC interleave" && $P trc_driver.py 04-interleave "ok-il#1" 122 > 04-interleave.log 2>&1
step "TRC failure" && TRC_TIMEOUT=300 $P trc_driver.py 01-failure "down,e500,hang,slow,slow-fg,ok-flush,slow-flush" 50 > 01-failure.log 2>&1
step "TRC local" && $P trc_local_real.py 02-tracing-context-local.jsonl > 02-tracing-context-local.log 2>&1
mark "ALL DONE"
