#!/bin/sh
# Rebuild every fixture in this directory and recapture the llvm-objdump oracle text.
# The committed bytes are the fixture. Run this only to regenerate them on purpose.
set -eu
cd "$(dirname "$0")"
OBJDUMP="${OBJDUMP:-/Library/Developer/CommandLineTools/usr/bin/llvm-objdump}"

for level in O0 O1 O2; do
  clang -target x86_64-unknown-linux-gnu -"$level" -fno-asynchronous-unwind-tables -c ledger.c -o "ledger-x86_64-$level.o"
  "$OBJDUMP" -h -t -r "ledger-x86_64-$level.o" > "ledger-x86_64-$level.objdump.txt"
done

clang -target arm64-apple-macos -O1 -fno-asynchronous-unwind-tables -c ledger.c -o ledger-arm64-O1.o
"$OBJDUMP" -h -t -r ledger-arm64-O1.o > ledger-arm64-O1.objdump.txt
"$OBJDUMP" --macho --private-headers ledger-arm64-O1.o > ledger-arm64-O1.load-commands.txt

python3 build_tiny_elf.py
"$OBJDUMP" -h -t -r -p tiny-x86_64 > tiny-x86_64.objdump.txt

shasum -a 256 ledger-x86_64-O0.o ledger-x86_64-O1.o ledger-x86_64-O2.o ledger-arm64-O1.o tiny-x86_64
