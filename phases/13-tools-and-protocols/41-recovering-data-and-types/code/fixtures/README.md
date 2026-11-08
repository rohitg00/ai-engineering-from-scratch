# Fixtures for lesson 41

Every object here was compiled on this machine from the two sources beside it. Nothing is downloaded. `build_fixtures.sh` holds the exact commands and `SHA256SUMS.txt` the resulting hashes. `capture_tools.sh` holds the commands that produced the files in `tools/`.

## Sources

| File | Purpose |
|---|---|
| `account.c` | `struct account` with members at offsets 0, 4, 8, 16, 24 and size 32; `bump`, `sum_balances`, `tag`, `projected`, `label_length` each touch different members; `main` prints the layout and passes one array of three to all five |
| `shapes.cpp` | `Shape` with a virtual destructor, a pure virtual `area()`, and a virtual `name()`; `Rect : Shape`; `describe` makes one virtual call |

Both sources declare `printf` themselves so that they compile for the Linux target without a system header.

## Objects and captured text

Built with Apple clang 17.0.0 (clang-1700.6.3.2). The text files beside each object are from the Apple Command Line Tools `llvm-objdump`, `llvm-dwarfdump`, and `llvm-cxxfilt`, all "Apple LLVM version 17.0.0". `toolchain-versions.txt` records the four version lines.

| File | Command | Role |
|---|---|---|
| `account-x86_64-O0-g.o`, `-O1-g.o`, `-O2-g.o` | `clang -target x86_64-unknown-linux-gnu -g -O{0,1,2} -fno-asynchronous-unwind-tables -fdebug-compilation-dir=. -c account.c` | DWARF 5 objects at three optimisation levels; the pass reads their listings, the reader parses the `-O0` object |
| `account-x86_64-O1.o` | same without `-g` | the object the tools see without debug information |
| `*.objdump.txt` | `llvm-objdump -d -r FILE.o` | the listings the pass reads |
| `account-x86_64-O0-g.dwarfdump.txt` | `llvm-dwarfdump --debug-info` | the oracle for the DWARF reader tests |
| `account-x86_64-O0-g.dwarfdump-tables.txt` | `llvm-dwarfdump --debug-abbrev --debug-str-offsets --debug-addr --debug-str` | the abbreviation table and the two indirection tables |
| `account-x86_64-O0-g.relocs.txt` | `llvm-objdump -r` | every relocation, including the ones on the debug sections |
| `shapes-x86_64-O0-g.o`, `shapes-x86_64-O1-g.o` | `clang++ -target x86_64-unknown-linux-gnu -g -O{0,1} -fno-asynchronous-unwind-tables -fdebug-compilation-dir=. -c shapes.cpp` | the `-O0` object carries both vtables; the `-O1` object has none |
| `shapes-x86_64-O0-g.symbols.txt`, `.relocs.txt`, `.dwarfdump.txt` | `llvm-objdump -t`, `llvm-objdump -r`, `llvm-dwarfdump --debug-info` | symbols, vtable relocations, and class entries |
| `shapes-x86_64-O0-g.mangled.txt`, `.cxxfilt.txt` | symbol names starting with `_Z`, and `llvm-cxxfilt --no-strip-underscore` over them | the demangler oracle |
| `account-native.run.txt` | `clang -g -O0 -o account account.c && ./account` on the arm64 host | the program's own report of its layout |

`-fdebug-compilation-dir=.` makes `DW_AT_comp_dir` the string `.` so that the objects do not depend on the directory they were built in. The objects are reproducible byte for byte.

## Tool captures in `tools/`

Produced by `capture_tools.sh` on 2026-10-14 on macOS 26.2 arm64. Each tool's version is in the matching `*-version.txt`.

| File | Tool and command |
|---|---|
| `ghidra-account-dwarf.txt`, `ghidra-account-nodwarf.txt`, `ghidra-shapes-dwarf.txt` | Ghidra 12.1.4 `analyzeHeadless ... -import FILE.o -postScript ListTypes.java` with OpenJDK 21.0.12.1; `ghidra/ListTypes.java` lists every `Structure` in the Data Type Manager and decompiles the five account functions |
| `rizin-account.txt`, `rizin-account-nodwarf.txt` | rizin 0.9.1 with `ts`, `tsc account`, `afvd`, and `pdf` on `sym.bump`, with `bin.dbginfo=true` for the `-g` object |
| `radare2-account.txt` | radare2 6.2.4 with the same commands and `bin.relocs.apply=true` |
| `lldb-account.txt`, `lldb-shapes.txt` | Apple lldb-1703.0.236.21, `image lookup -t account`, `image lookup -n bump`, `image lookup -t Rect`, `image lookup -t Shape` |
| `pyelftools-account.txt` | `pyelftools_struct.py` under Python 3.12.12 with pyelftools 0.33 |

radare2 and rizin were built from source into a local prefix for this course. Ghidra came from the Homebrew formula `ghidra`. The capture script skips any tool that is absent and prints which one it skipped.
