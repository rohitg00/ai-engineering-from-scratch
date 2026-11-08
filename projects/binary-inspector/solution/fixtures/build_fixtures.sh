#!/bin/sh
set -eu
cd "$(dirname "$0")"
FLAGS="-fno-asynchronous-unwind-tables"

clang -target x86_64-unknown-linux-gnu -O0 $FLAGS -c tally.c -o tally-x86_64-O0.o
clang -target x86_64-unknown-linux-gnu -O2 $FLAGS -c tally.c -o tally-x86_64-O2.o
clang -target x86_64-unknown-linux-gnu -O2 $FLAGS -c main.c -o main-x86_64-O2.o
clang++ -target x86_64-unknown-linux-gnu -O2 $FLAGS -fno-exceptions -fno-rtti -c names.cpp -o names-x86_64-O2.o

clang -target x86_64-pc-windows-msvc -mno-incremental-linker-compatible -O0 $FLAGS -c tally.c -o tally-x86_64-O0.obj
clang -target x86_64-pc-windows-msvc -mno-incremental-linker-compatible -O2 $FLAGS -c tally.c -o tally-x86_64-O2.obj
clang -target x86_64-pc-windows-msvc -mno-incremental-linker-compatible -O2 $FLAGS -c main.c -o main-x86_64-O2.obj

clang -target arm64-apple-macos -O2 $FLAGS -c tally.c -o tally-arm64-O2.o
clang -target arm64-apple-macos -O0 $FLAGS main.c tally.c -o tally-arm64-O0
clang -target arm64-apple-macos -O2 $FLAGS main.c tally.c -o tally-arm64-O2
cp tally-arm64-O2 tally-arm64-O2.stripped
strip tally-arm64-O2.stripped
clang -target arm64-apple-macos -O2 $FLAGS -dynamiclib -install_name @rpath/libtally.dylib tally.c -o libtally.dylib
cp libtally.dylib libtally.stripped.dylib
strip libtally.stripped.dylib

python3 build_tiny_pe.py

shasum -a 256 tally-x86_64-O0.o tally-x86_64-O2.o main-x86_64-O2.o names-x86_64-O2.o \
  tally-x86_64-O0.obj tally-x86_64-O2.obj main-x86_64-O2.obj \
  tally-arm64-O2.o tally-arm64-O0 tally-arm64-O2 tally-arm64-O2.stripped \
  libtally.dylib libtally.stripped.dylib tiny-x86_64.exe > SHA256SUMS
cat SHA256SUMS
