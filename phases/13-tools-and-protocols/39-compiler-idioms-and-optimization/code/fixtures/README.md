# Fixtures for lesson 39

Every object here was compiled on this machine from the source beside it with `build_fixtures.sh`. Nothing is downloaded. The compiler was Apple clang 17.0.0 (clang-1700.6.3.2) and the listings come from `/Library/Developer/CommandLineTools/usr/bin/llvm-objdump -d -r` (Apple LLVM 17.0.0). `toolchain.txt` records both version strings at build time.

| File | Built with | Purpose |
|---|---|---|
| `idioms.c` | source | 25 small functions, one or two idioms each: division and modulo by constants, five switch shapes, selects, a tail call, an inlined callee, loops that vectorize or unroll, store and copy loops, and `digest`, which holds five idioms in one body |
| `idioms-x86_64-O{0,1,2,3}.{o,s,objdump.txt}` | `clang -target x86_64-unknown-linux-gnu -O<N> -fno-asynchronous-unwind-tables -c idioms.c` and the same with `-S` | the four levels on x86-64 |
| `idioms-arm64-O{0,1,2,3}.{o,s,objdump.txt}` | `clang -target aarch64-unknown-linux-gnu -O<N> -fno-asynchronous-unwind-tables -c idioms.c` | the four levels on AArch64 |
| `idioms-x86_64-nofastisel-O0.*` | `-O0 -mllvm -fast-isel=false` | the magic multiply appears at `-O0` once FastISel is off |
| `idioms-x86_64-nojt-O2.*` | `-O2 -fno-jump-tables` | every table becomes a comparison tree |
| `idioms-x86_64-novec-O2.*` | `-O2 -fno-vectorize -fno-slp-vectorize` | the loops unroll by 8 instead of vectorizing |
| `idioms-x86_64-nobuiltin-O2.*` | `-O2 -fno-builtin` | the store loop is not turned into `memset` and `memcpy(…, 16)` stays a call |
| `idioms-arm64-jt4-O2.*` | `-O2 -mllvm -min-jump-table-entries=4` | the 5-case `call_switch` stays a comparison tree on AArch64 |
| `dispatch.c`, `dispatch-{x86_64,arm64}-O2.*` | `-O2` for both targets | a 16-case switch of tail calls: a relocation jump table on x86-64, a compressed byte jump table on AArch64 |
| `canary.c`, `canary-x86_64-ssp-O2.*`, `canary-arm64-ssp-O2.*` | `-O2 -fstack-protector-strong` | the stack protector shapes on both targets |
| `canary-x86_64-cet-O2.*` | `-O2 -fcf-protection=full` | `endbr64` as the first instruction of every function |
| `idioms-x86_64-O2.angr.json` | `venv/bin/python capture_angr.py idioms-x86_64-O2.o idioms-x86_64-O2.angr.json` with angr 10.0.3 | CFG block counts and decompiler output for 20 functions |
| `idioms-x86_64-O2.lifts.json` | `venv/bin/python capture_lifts.py idioms-x86_64-O2.o idioms-x86_64-O2.lifts.json` with Capstone 5.0.7 and pypcode 4.0.1 | decoder output with instruction groups, and raw P-code for `div10s` and `mod8s` |
| `idioms-x86_64-O2.radare2.txt` | `r2 -e scr.color=0 -qc '...' idioms-x86_64-O2.o` with radare2 6.2.4 | `afl`, `pdf`, and `pdc` on the division, table, and select functions |
| `idioms-x86_64-O2.rizin.txt` | `rizin -e scr.color=0 -qc '...' idioms-x86_64-O2.o` with rizin 0.9.1 | `afl`, `pdf`, and the RzIL of the `imul` |
| `idioms-x86_64-O2.lldb.txt` | `lldb -b -o 'disassemble -n div10s' ...` with lldb-1703.0.236.21 | the same instructions through the debugger's disassembler |

The exact commands for every entry are in the first line of each text capture and in `build_fixtures.sh`.
