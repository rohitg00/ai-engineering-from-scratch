#!/bin/sh
set -eu
cd "$(dirname "$0")"
OBJDUMP="${OBJDUMP:-/Library/Developer/CommandLineTools/usr/bin/llvm-objdump}"
NOUNWIND="-fno-asynchronous-unwind-tables"

clang -target arm64-apple-macos -O1 $NOUNWIND -dynamiclib -install_name @rpath/libledger.dylib ledger.c -o libledger.dylib
clang -target arm64-apple-macos -O1 $NOUNWIND main.c -L. -lledger -Wl,-rpath,@executable_path -o ledger_main
clang -target arm64-apple-macos -O1 $NOUNWIND main.c -L. -lledger -Wl,-rpath,@executable_path -Wl,-no_fixup_chains -o ledger_main_nochain
cp ledger_main ledger_main.stripped && strip ledger_main.stripped
cp libledger.dylib libledger.stripped.dylib && strip libledger.stripped.dylib

for level in O0 O2; do
  clang -target arm64-apple-macos -"$level" $NOUNWIND -c ledger.c -o "ledger-arm64-$level.o"
  clang -target arm64-apple-macos -"$level" $NOUNWIND -c main.c -o "main-arm64-$level.o"
  clang -target arm64-apple-macos -"$level" $NOUNWIND "main-arm64-$level.o" "ledger-arm64-$level.o" -o "static-arm64-$level"
  cp "static-arm64-$level" "static-arm64-$level.stripped" && strip "static-arm64-$level.stripped"
  "$OBJDUMP" -r "ledger-arm64-$level.o" > "ledger-arm64-$level.objdump-r.txt"
  "$OBJDUMP" -r "main-arm64-$level.o" > "main-arm64-$level.objdump-r.txt"
  nm -n "static-arm64-$level" > "static-arm64-$level.nm.txt"
  nm -n "static-arm64-$level.stripped" > "static-arm64-$level.stripped.nm.txt" 2>&1 || true
  dyld_info -function_starts "static-arm64-$level.stripped" > "static-arm64-$level.stripped.function-starts.txt"
  "$OBJDUMP" --macho -d "static-arm64-$level.stripped" > "static-arm64-$level.stripped.objdump.txt"
done

clang -target x86_64-unknown-linux-gnu -O1 $NOUNWIND -c ledger.c -o ledger-x86_64-O1.o
clang -target x86_64-unknown-linux-gnu -O1 $NOUNWIND -c main.c -o main-x86_64-O1.o
"$OBJDUMP" -h -t -r ledger-x86_64-O1.o > ledger-x86_64-O1.objdump.txt
"$OBJDUMP" -h -t -r main-x86_64-O1.o > main-x86_64-O1.objdump.txt
python3 build_tiny_dyn_elf.py
"$OBJDUMP" -h -p -T -R -d tiny-dyn-x86_64 > tiny-dyn-x86_64.objdump.txt

clang -target x86_64-pc-windows-msvc -O1 $NOUNWIND -c ledger.c -o ledger-x86_64.obj
clang -target x86_64-pc-windows-msvc -O1 $NOUNWIND -c main.c -o main-x86_64.obj
"$OBJDUMP" -h -t -r ledger-x86_64.obj > ledger-x86_64.obj.objdump.txt
"$OBJDUMP" -h -t -r main-x86_64.obj > main-x86_64.obj.objdump.txt
python3 build_tiny_pe.py
"$OBJDUMP" -h -p tiny-x86_64.exe > tiny-x86_64.exe.objdump.txt

./ledger_main > ledger_main.run.txt; echo "exit=$?" >> ledger_main.run.txt
./ledger_main.stripped > ledger_main.stripped.run.txt; echo "exit=$?" >> ledger_main.stripped.run.txt
./static-arm64-O2.stripped > static-arm64-O2.stripped.run.txt; echo "exit=$?" >> static-arm64-O2.stripped.run.txt
otool -h ledger_main > ledger_main.otool-h.txt
otool -h ledger_main_nochain > ledger_main_nochain.otool-h.txt
otool -l ledger_main > ledger_main.otool-l.txt
otool -l ledger_main_nochain > ledger_main_nochain.otool-l.txt
otool -l ledger_main.stripped > ledger_main.stripped.otool-l.txt
otool -Iv ledger_main > ledger_main.otool-Iv.txt
otool -v -s __TEXT __stubs ledger_main > ledger_main.stubs.txt
dyld_info -fixups ledger_main > ledger_main.dyld-fixups.txt
dyld_info -fixup_chain_details ledger_main > ledger_main.dyld-chain-details.txt
dyld_info -imports ledger_main > ledger_main.dyld-imports.txt
dyld_info -fixups ledger_main_nochain > ledger_main_nochain.dyld-fixups.txt
dyld_info -exports libledger.dylib > libledger.dyld-exports.txt
dyld_info -exports libledger.stripped.dylib > libledger.stripped.dyld-exports.txt
dyld_info -function_starts libledger.stripped.dylib > libledger.stripped.function-starts.txt
"$OBJDUMP" --macho --chained-fixups ledger_main > ledger_main.chained-fixups.txt
nm -m ledger_main > ledger_main.nm.txt
nm -m ledger_main.stripped > ledger_main.stripped.nm.txt
nm -m libledger.dylib > libledger.nm.txt
nm -m libledger.stripped.dylib > libledger.stripped.nm.txt 2>&1 || true

shasum -a 256 libledger.dylib ledger_main ledger_main_nochain static-arm64-O0 static-arm64-O2 ledger-arm64-O0.o ledger-arm64-O2.o main-arm64-O0.o main-arm64-O2.o ledger-x86_64-O1.o main-x86_64-O1.o tiny-dyn-x86_64 ledger-x86_64.obj main-x86_64.obj tiny-x86_64.exe
