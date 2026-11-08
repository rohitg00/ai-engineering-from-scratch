#!/bin/sh
set -eu
cd "$(dirname "$0")"

CLANG=${CLANG:-clang}
LLVM_BIN=${LLVM_BIN:-/Library/Developer/CommandLineTools/usr/bin}
OBJDUMP="$LLVM_BIN/llvm-objdump"
COMMON="-fno-asynchronous-unwind-tables"

{
  "$CLANG" --version | head -1
  "$OBJDUMP" --version | head -1
  "$LLVM_BIN/llvm-dwarfdump" --version | head -1
} > toolchain-versions.txt

build() {
  triple="$1"
  tag="$2"
  for O in 0 2; do
    out="convention-$tag-O$O"
    "$CLANG" -target "$triple" "-O$O" $COMMON -c convention.c -o "$out.o"
    "$OBJDUMP" -d -r "$out.o" > "$out.objdump.txt"
    "$OBJDUMP" -t "$out.o" > "$out.symbols.txt"
  done
}

build x86_64-unknown-linux-gnu x86_64-linux
build x86_64-pc-windows-msvc x86_64-windows
build aarch64-unknown-linux-gnu aarch64-linux

"$CLANG" -target arm64-apple-macos -O2 $COMMON -c convention.c -o convention-arm64-macos-O2.o
"$OBJDUMP" -d -r convention-arm64-macos-O2.o > convention-arm64-macos-O2.objdump.txt
"$OBJDUMP" -t convention-arm64-macos-O2.o > convention-arm64-macos-O2.symbols.txt

"$CLANG" -target x86_64-pc-windows-msvc -O2 -c convention.c -o convention-x86_64-windows-O2-seh.o
"$OBJDUMP" -d -r convention-x86_64-windows-O2-seh.o > convention-x86_64-windows-O2-seh.objdump.txt
"$OBJDUMP" -h convention-x86_64-windows-O2-seh.o > convention-x86_64-windows-O2-seh.sections.txt
"$OBJDUMP" -s -j .xdata convention-x86_64-windows-O2-seh.o > convention-x86_64-windows-O2-seh.xdata.txt
"$OBJDUMP" -r convention-x86_64-windows-O2-seh.o > convention-x86_64-windows-O2-seh.relocs.txt

DWARFDUMP="$LLVM_BIN/llvm-dwarfdump"
"$CLANG" -target x86_64-unknown-linux-gnu -O2 -c convention.c -o convention-x86_64-linux-O2-eh.o
"$DWARFDUMP" --eh-frame convention-x86_64-linux-O2-eh.o > convention-x86_64-linux-O2-eh.eh-frame.txt
"$CLANG" -target aarch64-unknown-linux-gnu -O2 -c convention.c -o convention-aarch64-linux-O2-eh.o
"$DWARFDUMP" --eh-frame convention-aarch64-linux-O2-eh.o > convention-aarch64-linux-O2-eh.eh-frame.txt

"$CLANG" -target x86_64-unknown-linux-gnu -O0 $COMMON -mno-red-zone -c convention.c -o convention-x86_64-linux-O0-noredzone.o
"$OBJDUMP" -d convention-x86_64-linux-O0-noredzone.o > convention-x86_64-linux-O0-noredzone.objdump.txt

"$CLANG" -target x86_64-unknown-linux-gnu -O2 $COMMON -fno-omit-frame-pointer -c convention.c -o convention-x86_64-linux-O2-fp.o
"$OBJDUMP" -d convention-x86_64-linux-O2-fp.o > convention-x86_64-linux-O2-fp.objdump.txt

shasum -a 256 convention.c *.o > SHA256SUMS.txt
