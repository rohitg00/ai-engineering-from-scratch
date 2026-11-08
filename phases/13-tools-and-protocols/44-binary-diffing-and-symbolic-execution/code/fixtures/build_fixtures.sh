#!/bin/sh
set -eu
cd "$(dirname "$0")"
OBJDUMP="${OBJDUMP:-/Library/Developer/CommandLineTools/usr/bin/llvm-objdump}"

for level in O0 O1 O2; do
  clang -target x86_64-unknown-linux-gnu -"$level" -fno-asynchronous-unwind-tables -c ledger.c -o "ledger-x86_64-$level.o"
  "$OBJDUMP" -d "ledger-x86_64-$level.o" > "ledger-x86_64-$level.objdump.txt"
done

clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c grade_case10_wrong.c -o grade_case10_wrong.o
"$OBJDUMP" -d grade_case10_wrong.o > grade_case10_wrong.objdump.txt

shasum -a 256 ledger-x86_64-O0.o ledger-x86_64-O1.o ledger-x86_64-O2.o grade_case10_wrong.o

sh capture_radiff2.sh
sh capture_ghidra_vt.sh
"${VENV_PYTHON:-python3}" capture_angr.py
"${VENV_PYTHON:-python3}" capture_z3.py
