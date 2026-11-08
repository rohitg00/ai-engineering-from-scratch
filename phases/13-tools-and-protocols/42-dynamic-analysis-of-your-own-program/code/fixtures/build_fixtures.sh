#!/bin/sh
set -eu
cd "$(dirname "$0")"

OBJDUMP=/Library/Developer/CommandLineTools/usr/bin/llvm-objdump
DWARFDUMP=/Library/Developer/CommandLineTools/usr/bin/llvm-dwarfdump

clang --version | head -1
lldb --version | head -1

clang -g -O0 -o account-O0 account.c
clang -g -O2 -o account-O2 account.c

for variant in O0 O2; do
  "$OBJDUMP" -d "account-$variant" > "account-$variant.objdump.txt"
  nm "account-$variant" > "account-$variant.nm.txt"
  "$DWARFDUMP" --debug-info "account-$variant.dSYM/Contents/Resources/DWARF/account-$variant" > "account-$variant.dwarfdump.txt"
done

codesign -dvvv account-O0 > account-O0.codesign.txt 2>&1
codesign -d --entitlements - account-O0 >> account-O0.codesign.txt 2>&1

python3 ../main.py capture
