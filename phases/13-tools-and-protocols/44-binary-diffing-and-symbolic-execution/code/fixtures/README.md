# Fixtures for lesson 44

Every object here was compiled on this machine from the source beside it, and every tool output was captured on this machine from those objects. Nothing is downloaded. `build_fixtures.sh` runs every command below in order.

## Objects

| File | Built with | Purpose |
|---|---|---|
| `ledger.c` | source shared with lessons 32 to 36 | four functions: `percent_change`, `grade`, `total`, `grade_label` |
| `ledger-x86_64-O0.o` | `clang -target x86_64-unknown-linux-gnu -O0 -fno-asynchronous-unwind-tables -c ledger.c` | `grade` holds a jump table with five `.rela.rodata` entries |
| `ledger-x86_64-O1.o` | same command with `-O1` | `grade` reads a value table, `total` is a scalar loop |
| `ledger-x86_64-O2.o` | same command with `-O2` | `total` is vectorised with SSE2 and grows from 31 to 140 bytes |
| `grade_case10_wrong.c` | copy of the lesson 36 candidate | the same 46 code bytes as `grade` at `-O1` with the table entry for case 10 changed to 3 |
| `grade_case10_wrong.o` | same command with `-O1` | the patch-analysis fixture: byte-identical code, different constant |
| `*.objdump.txt` | `/Library/Developer/CommandLineTools/usr/bin/llvm-objdump -d FILE.o` (Apple LLVM 17.0.0) | the listings the differ reads for instruction boundaries and mnemonics |

The compiler was Apple clang 17.0.0 (clang-1700.6.3.2). SHA-256 of the three `ledger` objects: `b2046c12...` (O0), `9a4a8082...` (O1), `ce31eaf1...` (O2). They are byte for byte the objects of lesson 33.

## Tool captures

| File | Command | Tool version |
|---|---|---|
| `radiff2-AC-O0-vs-O1.txt`, `radiff2-AC-O1-vs-O2.txt`, `radiff2-AC-O1-vs-O1.txt` | `radiff2 -AC A.o B.o`, lines that name a `sym.` | radare2 6.2.4 (`radiff2-version.txt`) |
| `radiff2-AC-relocs-O0-vs-O1.txt` | `radiff2 -e bin.relocs.apply=true -AC` | same |
| `radiff2-AOC-*.txt` | `radiff2 -AOC`, opcode bytes only | same |
| `radiff2-s-O1-vs-O2.txt`, `radiff2-ss-O1-vs-O2.txt` | `radiff2 -s` (Myers) and `-ss` (Levenshtein) over the whole files | same |
| `ghidra-vt-O0-vs-O1.txt`, `ghidra-vt-O1-vs-O2.txt` | `capture_ghidra_vt.sh`: `analyzeHeadless` imports the three objects, then runs `ghidra/ListVersionTrackingMatches.java` as a post-script with the source and destination program paths as arguments | Ghidra 12.1.4, OpenJDK 21 (`ghidra-version.txt`) |
| `angr-runs.json` | `capture_angr.py` in a Python 3.12 venv with angr 10.0.3 | angr 10.0.3, claripy vendored as `angr.rustylib.claripy` |
| `z3-runs.json` | `capture_z3.py` in the same venv | z3-solver 5.1.0.0 |

`ListVersionTrackingMatches.java` runs the six Auto Version Tracking correlators one at a time in the documented order and prints one `VT|` line per program block, per function, per correlator, and per match. The shell script keeps the Ghidra settings, cache, and temp directories under one work directory so a run leaves nothing in the home directory.

The tests read the committed captures, so they pass on a host without radare2, Ghidra, angr, or z3. Tests that compare against a capture skip when the capture file is missing.
