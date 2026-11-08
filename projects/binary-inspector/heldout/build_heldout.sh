#!/bin/sh
set -eu
cd "$(dirname "$0")"
FLAGS="-fno-asynchronous-unwind-tables"

clang -target x86_64-unknown-linux-gnu -O2 $FLAGS -c meter.c -o meter-x86_64-O2.o
clang -target x86_64-unknown-linux-gnu -O2 $FLAGS -c meter_main.c -o meter_main-x86_64-O2.o
clang -target x86_64-pc-windows-msvc -mno-incremental-linker-compatible -O2 $FLAGS -c meter.c -o meter-x86_64-O2.obj
clang -target x86_64-pc-windows-msvc -mno-incremental-linker-compatible -O2 $FLAGS -c meter_main.c -o meter_main-x86_64-O2.obj
clang -target arm64-apple-macos -O0 $FLAGS meter_main.c meter.c -o meter-arm64-O0
clang -target arm64-apple-macos -O2 $FLAGS meter_main.c meter.c -o meter-arm64-O2
cp meter-arm64-O2 meter-arm64-O2.stripped
strip meter-arm64-O2.stripped

shasum -a 256 meter-x86_64-O2.o meter_main-x86_64-O2.o meter-x86_64-O2.obj meter_main-x86_64-O2.obj \
  meter-arm64-O0 meter-arm64-O2 meter-arm64-O2.stripped > SHA256SUMS
cat SHA256SUMS
