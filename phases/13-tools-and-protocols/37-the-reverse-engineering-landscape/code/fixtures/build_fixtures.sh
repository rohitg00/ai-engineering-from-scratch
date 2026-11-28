#!/bin/sh
set -eu
cd "$(dirname "$0")"
clang --version | head -1
clang -target x86_64-unknown-linux-gnu -O0 -fno-asynchronous-unwind-tables -c ledger.c -o ledger-x86_64-O0.o
clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c ledger.c -o ledger-x86_64-O1.o
clang -target x86_64-unknown-linux-gnu -O2 -fno-asynchronous-unwind-tables -c ledger.c -o ledger-x86_64-O2.o
clang -target x86_64-unknown-linux-gnu -c sweep-trap.s -o sweep-trap.o
ls -l ledger-x86_64-O0.o ledger-x86_64-O1.o ledger-x86_64-O2.o sweep-trap.o
echo "objects built; run python3 capture_tools.py to re-capture the tool outputs"
