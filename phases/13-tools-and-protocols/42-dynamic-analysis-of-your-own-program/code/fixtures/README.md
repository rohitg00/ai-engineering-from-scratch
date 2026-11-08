# Fixtures for lesson 42

Every file here is a program we wrote and compiled on this machine, or the output of a tool run on that program. Nothing is downloaded. The debugger only ever ran against these two builds.

| File | What it is |
|---|---|
| `account.c` | The lesson program: `struct account` with five fields, `bump`, `classify`, `sum_balances`, and a `main` that calls them once, three times, and once. |
| `account-O0`, `account-O0.dSYM/` | `clang -g -O0 -o account-O0 account.c`. Mach-O arm64, ad-hoc linker-signed, DWARF 5 in the dSYM bundle. |
| `account-O2`, `account-O2.dSYM/` | `clang -g -O2 -o account-O2 account.c`. Same source, every call in `main` inlined and folded. |
| `account-O0.objdump.txt`, `account-O2.objdump.txt` | `llvm-objdump -d` of each binary. The harness reads function ranges and conditional branches from these. |
| `account-O0.nm.txt`, `account-O2.nm.txt` | `nm` of each binary. Both list `_bump`, `_classify`, `_sum_balances`. |
| `account-O0.dwarfdump.txt`, `account-O2.dwarfdump.txt` | `llvm-dwarfdump --debug-info` of each dSYM. The struct layout the harness checks memory against. |
| `account-O0.codesign.txt` | `codesign -dvvv` and `codesign -d --entitlements -` of the `-O0` binary. |
| `session-O0.lldb`, `session-O2.lldb` | The command files `python3 ../main.py capture` wrote from the plan. The tests check they equal the plan. |
| `session-O0.lldb.txt`, `session-O2.lldb.txt` | The lldb batch transcripts of those sessions, with the command line, lldb version, and date in a `#` header. |
| `core-save-O0.lldb`, `core-save-O0.lldb.txt` | Stop at `bump`, then `process save-core --style stack`. The core file itself is not kept. |
| `core-load-O0.lldb`, `core-load-O0.lldb.txt` | Load that core with `lldb -c` and read the backtrace, the struct, and the memory. |
| `types-O0.lldb`, `types-O0.lldb.txt` | The lldb Python API without a process: embedded Python version, struct fields, struct size, function ranges. |
| `sandbox-O0.lldb.txt` | The same `session-O0` plan run inside the session's Seatbelt sandbox. The launch fails before any stop. |
| `build_fixtures.sh` | The exact commands that produced every file above. |

Tool versions on 2026-10-14, macOS 26.2 (Darwin 25.2.0), Apple silicon:

- Apple clang 17.0.0 (clang-1700.6.3.2), Command Line Tools with SDK 26.2
- lldb-1703.0.236.21, embedded Python 3.9.6
- `llvm-objdump` and `llvm-dwarfdump` from `/Library/Developer/CommandLineTools/usr/bin`, Apple LLVM version 17.0.0

Rebuild everything with `sh build_fixtures.sh` from this directory. The capture step needs a shell that can launch processes under lldb. Inside a Seatbelt sandbox it writes a transcript like `sandbox-O0.lldb.txt` instead. Stack addresses in a fresh capture differ from the committed transcripts when the environment differs, so the tests pin the committed transcripts and the live mode grades a fresh run on its own.
