# Fixtures for lesson 33

Every object here was compiled on this machine from the source beside it. Nothing is downloaded.

| File | Built with | Purpose |
|---|---|---|
| `ledger.c` | source shared with `manuals/reverse-engineering-101/capture/fixtures/ledger.c` | four functions: `percent_change`, `grade`, `total`, `grade_label` |
| `ledger-x86_64-O0.o` | `clang -target x86_64-unknown-linux-gnu -O0 -fno-asynchronous-unwind-tables -c ledger.c -o ledger-x86_64-O0.o` | `grade` holds a real jump table: `jmpq *%rax` with five `.rela.rodata` entries |
| `ledger-x86_64-O1.o` | `clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c ledger.c -o ledger-x86_64-O1.o` | `grade` becomes a value table load, `total` is a scalar loop |
| `ledger-x86_64-O2.o` | `clang -target x86_64-unknown-linux-gnu -O2 -fno-asynchronous-unwind-tables -c ledger.c -o ledger-x86_64-O2.o` | `total` is vectorised with SSE2 and has two loops |
| `sweep-trap.s` | hand written | a byte table inside `.text` that a linear sweep decodes as code |
| `sweep-trap.o` | `clang -target x86_64-unknown-linux-gnu -c sweep-trap.s -o sweep-trap.o` | the built trap |
| `*.objdump.txt` | `/Library/Developer/CommandLineTools/usr/bin/llvm-objdump -d FILE.o` (Apple LLVM 17.0.0) | the oracle the decoder tests compare against |

The compiler was Apple clang 17.0.0 (clang-1700.6.3.2). The three `ledger` objects are byte for byte identical to the capture fixtures in `manuals/reverse-engineering-101/capture/fixtures/`.
