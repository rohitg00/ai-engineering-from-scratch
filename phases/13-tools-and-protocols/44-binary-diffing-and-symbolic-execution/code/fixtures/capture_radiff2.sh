#!/bin/sh
set -eu
cd "$(dirname "$0")"
RADIFF2="${RADIFF2:-radiff2}"

"$RADIFF2" -v > radiff2-version.txt 2>&1

for pair in "O0 O1" "O1 O2" "O1 O1"; do
  set -- $pair
  "$RADIFF2" -AC "ledger-x86_64-$1.o" "ledger-x86_64-$2.o" 2>/dev/null | grep 'sym\.' > "radiff2-AC-$1-vs-$2.txt"
done

"$RADIFF2" -e bin.relocs.apply=true -AC ledger-x86_64-O0.o ledger-x86_64-O1.o 2>/dev/null | grep 'sym\.' > radiff2-AC-relocs-O0-vs-O1.txt
"$RADIFF2" -AOC ledger-x86_64-O0.o ledger-x86_64-O1.o 2>/dev/null | grep 'sym\.' > radiff2-AOC-O0-vs-O1.txt
"$RADIFF2" -AOC ledger-x86_64-O1.o ledger-x86_64-O2.o 2>/dev/null | grep 'sym\.' > radiff2-AOC-O1-vs-O2.txt
"$RADIFF2" -s ledger-x86_64-O1.o ledger-x86_64-O2.o 2>/dev/null > radiff2-s-O1-vs-O2.txt
"$RADIFF2" -ss ledger-x86_64-O1.o ledger-x86_64-O2.o 2>/dev/null > radiff2-ss-O1-vs-O2.txt
