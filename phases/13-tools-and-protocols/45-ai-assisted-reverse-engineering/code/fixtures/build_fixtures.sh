#!/bin/sh
set -eu
cd "$(dirname "$0")"

CLANG="${CLANG:-clang}"
OBJDUMP="${OBJDUMP:-$(command -v llvm-objdump || echo /Library/Developer/CommandLineTools/usr/bin/llvm-objdump)}"
DWARFDUMP="${DWARFDUMP:-$(command -v llvm-dwarfdump || echo /Library/Developer/CommandLineTools/usr/bin/llvm-dwarfdump)}"
FLAGS="-target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c"
RENAMES="-Dpercent_change=f1 -Dgrade=f2 -Dtotal=f3 -Dgrade_label=f4"

$CLANG $FLAGS $RENAMES ledger.c -o ledger-x86_64-O1-renamed.o
$CLANG $FLAGS -g ledger.c -o ledger-x86_64-O1-g.o
$CLANG $FLAGS $RENAMES ledger-poisoned.c -o ledger-x86_64-O1-poisoned.o

for source in candidates/*.c; do
    $CLANG $FLAGS "$source" -o "${source%.c}.o"
done

$OBJDUMP -d -r ledger-x86_64-O1-renamed.o > ledger-x86_64-O1-renamed.objdump.txt
$OBJDUMP -t ledger-x86_64-O1-renamed.o > ledger-x86_64-O1-renamed.symtab.txt
$OBJDUMP -s -j .rodata.str1.1 -j .rodata ledger-x86_64-O1-poisoned.o > ledger-x86_64-O1-poisoned.sections.txt
$DWARFDUMP --debug-info ledger-x86_64-O1-g.o > ledger-x86_64-O1-g.dwarfdump.txt
$DWARFDUMP --debug-abbrev ledger-x86_64-O1-g.o > ledger-x86_64-O1-g.abbrev.txt
for object in candidates/*.o; do
    $OBJDUMP -d -r "$object" > "${object%.o}.objdump.txt"
done

$CLANG --version | head -1
$OBJDUMP --version | head -1
