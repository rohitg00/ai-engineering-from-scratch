# Fixtures for lesson 37

Every object here was compiled on this machine from the source beside it, and every tool output was captured on this machine from those objects. Nothing is downloaded. The objects are byte for byte identical to the fixtures of lesson 33.

## Programs

| File | Built with | Purpose |
|---|---|---|
| `ledger.c` | source shared with lesson 33 | four functions: `percent_change`, `grade`, `total`, `grade_label` |
| `ledger-x86_64-O0.o` | `clang -target x86_64-unknown-linux-gnu -O0 -fno-asynchronous-unwind-tables -c ledger.c -o ledger-x86_64-O0.o` | `grade` holds a jump table that the tools resolve differently |
| `ledger-x86_64-O1.o` | same command with `-O1` | the agreement case: every tool finds 3, 3, 5, 4 blocks |
| `ledger-x86_64-O2.o` | same command with `-O2` | `total` is vectorised, 10 blocks in every tool |
| `sweep-trap.s` | hand written | four data bytes inside `.text` |
| `sweep-trap.o` | `clang -target x86_64-unknown-linux-gnu -c sweep-trap.s -o sweep-trap.o` | the linear sweep decodes the data as code |

Compiler: Apple clang version 17.0.0 (clang-1700.6.3.2). `build_fixtures.sh` holds the exact commands.

## Captures

`capture_tools.py` ran every tool once and wrote `captures.json`, which records the date, the host, every tool version, and the exact command behind every file. The lesson code and the tests read only these files. They never start a tool.

| Tool | Version | Files | Command |
|---|---|---|---|
| llvm-objdump | Apple LLVM version 17.0.0 | `*.objdump.txt` | `llvm-objdump -d -r FILE.o` |
| radare2 | 6.2.4 | `*.radare2.json` | `r2 -e scr.color=0 -qc 'iSj' FILE.o`, then `aaa; aflj`, and per function `aaa; afbj @ ADDR`, `aaa; pdfj @ ADDR`, `aaa; pdc @ ADDR` |
| rizin | 0.9.1 | `*.rizin.json` | `rizin -e scr.color=0 -qc '<same commands without pdc>' FILE.o` |
| angr | 10.0.3 (pyvex 10.0.3, cle 10.0.3) | `*.angr.json` | `python capture_angr.py FILE.o OUT.json`: `CFGFast(normalize=True, data_references=True)` and `Decompiler` on every symbol function |
| Ghidra | 12.1.4 | `*.ghidra.json` | `analyzeHeadless PROJECT_DIR lesson37 -import FILE.o -scriptPath . -postScript ExportAnalysis.java OUT.json -deleteProject` |
| pyvex, pypcode, radare2, rizin | 10.0.3, 4.0.1, 6.2.4, 0.9.1 | `ir-lifts.json` | `python capture_ir.py`, then `r2 -a x86 -b 64 -qc 'e asm.esil=true; wx HEX; pd 1' -` and `rizin -a x86 -b 64 -qc 'wx HEX; aoi 1' malloc://16` |

Each JSON capture keeps the tool's own addresses. The tools map `.text` at different bases: llvm-objdump prints section offsets, radare2 and rizin map the object at `0x08000040`, angr at `0x400000`, Ghidra at `0x100000`. The lesson code subtracts each base.

`ExportAnalysis.java` lists the instructions inside each Ghidra function body, the basic blocks of `BasicBlockModel` with their flow types, the raw P-code of every instruction, the decompiled C, and the data references. It does not list instructions outside function bodies.

Ghidra needs JDK 21. Inside a sandbox that denies the default Java temporary directory, set `JAVA_TOOL_OPTIONS=-Djava.io.tmpdir=$TMPDIR`.

IDA Pro and Binary Ninja were not run. The lesson describes them from their documentation.
