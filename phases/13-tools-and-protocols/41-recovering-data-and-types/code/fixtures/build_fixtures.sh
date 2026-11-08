#!/bin/sh
set -eu
cd "$(dirname "$0")"

TARGET=x86_64-unknown-linux-gnu
CLANG=${CLANG:-clang}
CLANGXX=${CLANGXX:-clang++}
LLVM_BIN=${LLVM_BIN:-/Library/Developer/CommandLineTools/usr/bin}
OBJDUMP="$LLVM_BIN/llvm-objdump"
DWARFDUMP="$LLVM_BIN/llvm-dwarfdump"
CXXFILT="$LLVM_BIN/llvm-cxxfilt"
COMMON="-fno-asynchronous-unwind-tables -fdebug-compilation-dir=."

{
  "$CLANG" --version | head -1
  "$OBJDUMP" --version | head -1
  "$DWARFDUMP" --version | head -1
  "$CXXFILT" --version | sed -n 2p
} > toolchain-versions.txt

for O in 0 1 2; do
  "$CLANG" -target "$TARGET" -g "-O$O" $COMMON -c account.c -o "account-x86_64-O$O-g.o"
  "$OBJDUMP" -d -r "account-x86_64-O$O-g.o" > "account-x86_64-O$O-g.objdump.txt"
done

"$CLANG" -target "$TARGET" -O1 -fno-asynchronous-unwind-tables -c account.c -o account-x86_64-O1.o
"$OBJDUMP" -d -r account-x86_64-O1.o > account-x86_64-O1.objdump.txt

"$DWARFDUMP" --debug-info account-x86_64-O0-g.o > account-x86_64-O0-g.dwarfdump.txt
"$DWARFDUMP" --debug-abbrev --debug-str-offsets --debug-addr --debug-str account-x86_64-O0-g.o > account-x86_64-O0-g.dwarfdump-tables.txt
"$OBJDUMP" -r account-x86_64-O0-g.o > account-x86_64-O0-g.relocs.txt

for O in 0 1; do
  "$CLANGXX" -target "$TARGET" -g "-O$O" $COMMON -c shapes.cpp -o "shapes-x86_64-O$O-g.o"
  "$OBJDUMP" -d -r "shapes-x86_64-O$O-g.o" > "shapes-x86_64-O$O-g.objdump.txt"
done

"$OBJDUMP" -t shapes-x86_64-O0-g.o > shapes-x86_64-O0-g.symbols.txt
"$OBJDUMP" -r shapes-x86_64-O0-g.o > shapes-x86_64-O0-g.relocs.txt
"$OBJDUMP" -t shapes-x86_64-O1-g.o > shapes-x86_64-O1-g.symbols.txt
"$DWARFDUMP" --debug-info shapes-x86_64-O0-g.o > shapes-x86_64-O0-g.dwarfdump.txt
awk '{print $NF}' shapes-x86_64-O0-g.symbols.txt | grep '^_Z' | sort -u > shapes-x86_64-O0-g.mangled.txt
"$CXXFILT" --no-strip-underscore < shapes-x86_64-O0-g.mangled.txt > shapes-x86_64-O0-g.cxxfilt.txt

NATIVE="${TMPDIR:-/tmp}/account-native-$$"
"$CLANG" -g -O0 -o "$NATIVE" account.c
"$NATIVE" > account-native.run.txt
rm -f "$NATIVE"
rm -rf "$NATIVE.dSYM"

shasum -a 256 account.c shapes.cpp *.o > SHA256SUMS.txt
