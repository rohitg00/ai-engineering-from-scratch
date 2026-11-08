#!/bin/sh
set -eu
cd "$(dirname "$0")"

CLANG=${CLANG:-clang}
OBJDUMP=${OBJDUMP:-/Library/Developer/CommandLineTools/usr/bin/llvm-objdump}
FLAGS="-fno-asynchronous-unwind-tables"

$CLANG --version | head -1 > toolchain.txt
$OBJDUMP --version | head -1 >> toolchain.txt

build() {
  target=$1; tag=$2; level=$3; src=$4; extra=$5
  out="${src%.c}-${tag}-${level}"
  $CLANG -target "$target" "-$level" $FLAGS $extra -c "$src" -o "$out.o"
  $CLANG -target "$target" "-$level" $FLAGS $extra -S "$src" -o "$out.s"
  $OBJDUMP -d -r "$out.o" > "$out.objdump.txt"
}

for level in O0 O1 O2 O3; do
  build x86_64-unknown-linux-gnu x86_64 $level idioms.c ""
  build aarch64-unknown-linux-gnu arm64 $level idioms.c ""
done

build x86_64-unknown-linux-gnu x86_64 O2 dispatch.c ""
build aarch64-unknown-linux-gnu arm64 O2 dispatch.c ""
build x86_64-unknown-linux-gnu x86_64-nofastisel O0 idioms.c "-mllvm -fast-isel=false"
build aarch64-unknown-linux-gnu arm64-jt4 O2 idioms.c "-mllvm -min-jump-table-entries=4"
build x86_64-unknown-linux-gnu x86_64-ssp O2 canary.c "-fstack-protector-strong"
build x86_64-unknown-linux-gnu x86_64-cet O2 canary.c "-fcf-protection=full"
build aarch64-unknown-linux-gnu arm64-ssp O2 canary.c "-fstack-protector-strong"
build x86_64-unknown-linux-gnu x86_64-nojt O2 idioms.c "-fno-jump-tables"
build x86_64-unknown-linux-gnu x86_64-novec O2 idioms.c "-fno-vectorize -fno-slp-vectorize"
build x86_64-unknown-linux-gnu x86_64-nobuiltin O2 idioms.c "-fno-builtin"
