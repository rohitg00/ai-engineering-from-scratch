# Fixtures for lesson 45

Every file here is ours. `ledger.c` is the same source as in lessons 33, 35, and 36. The eight candidate reconstructions in `candidates/` were written by hand for this lesson to stand in for typical model outputs. They are not the output of any model, and each report says so in its `label` field.

Build and capture command, recorded on 2026-10-14 with Apple clang version 17.0.0 (clang-1700.6.3.2) and the Apple LLVM version 17.0.0 `llvm-objdump` and `llvm-dwarfdump` from the macOS Command Line Tools:

```
sh build_fixtures.sh
```

The compiler flags for every object are `clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c`. The three ledger objects differ only in their symbol names, debug sections, and read-only data. Their 159 `.text` bytes are identical to each other and to `ledger-x86_64-O1.o` in lesson 36.

| File | Content |
|---|---|
| `ledger.c` | the original source: `percent_change`, `grade`, `total`, `grade_label` |
| `ledger-poisoned.c` | the same source plus one read-only string that addresses the analyst |
| `ledger-x86_64-O1-renamed.o` | the target. Built with `-Dpercent_change=f1 -Dgrade=f2 -Dtotal=f3 -Dgrade_label=f4`, so the symbols are `f1` to `f4`. SHA-256 `3561e8175748e19d631552d52869fe235a82471137528ac2e5ef6b6145967d0c` |
| `ledger-x86_64-O1-g.o` | the ground truth. Built with the original names and `-g`, DWARF 5. SHA-256 `7bbe0c151e24f58ff70f2057239b12c4538852805d35e1390b9b51e286be853e` |
| `ledger-x86_64-O1-poisoned.o` | `ledger-poisoned.c` with the renames, for the untrusted-content lab. SHA-256 `c2ed0a89156ac36162d33c03f740930d8480b75244047aa31b5e8e8708a695bc` |
| `ledger-x86_64-O1-renamed.objdump.txt` | `llvm-objdump -d -r` of the target, the source of every immediate the citation check accepts |
| `ledger-x86_64-O1-renamed.symtab.txt` | `llvm-objdump -t` of the target |
| `ledger-x86_64-O1-g.dwarfdump.txt`, `ledger-x86_64-O1-g.abbrev.txt` | `llvm-dwarfdump --debug-info` and `--debug-abbrev` of the ground truth |
| `ledger-x86_64-O1-poisoned.sections.txt` | `llvm-objdump -s` of the two read-only sections of the poisoned object |
| `candidates/<id>.c` | one candidate reconstruction per file, four per target function |
| `candidates/<id>.report.json` | the candidate's report: target, claims, citations, label, tool, cost |
| `candidates/<id>.o`, `candidates/<id>.objdump.txt` | each candidate compiled with the fixture flags, and its listing |
| `build-record.json` | the capture record: the compiler identity, the flags, and the source and object digests that bind each committed candidate object to its source |
| `runs/scorecards-aarch64-darwin.json` | one run of `python3 code/main.py --save-runs` on an arm64 Mac, the source of the figure data |

Candidates by target and kind:

| Candidate | Target | Kind | Written to represent |
|---|---|---|---|
| `f1_mul_first` | `f1` | correct | the listing in C |
| `f1_wide_long` | `f1` | plausible but wrong | a 64-bit intermediate that skips the 32-bit overflow |
| `f1_base_64` | `f1` | wrong constant | the byte `0x64` read as decimal 64 |
| `f1_safe_div` | `f1` | invented helper | a helper and a message that do not exist, over code that compiles to the original bytes |
| `f2_switch` | `f2` | correct | the original `switch` |
| `f2_thresholds` | `f2` | plausible but wrong | threshold tests with no upper bound, under a different name |
| `f2_case10_wrong` | `f2` | wrong constant | one table entry wrong |
| `f2_clamp` | `f2` | invented helper | a clamp helper and a message that do not exist |

The tests read the committed objects, listings, and the recorded run, so they pass on a host without clang. With clang present they also rebuild every candidate and rerun the grid and the corpus. The rebuild comparison runs only when the installed clang reports the identity recorded above and in `build-record.json`: the byte-comparison contract is the same compiler and flags, so any other clang is treated like no clang and the committed objects stand in while `build-record.json` still matches them to the candidate sources. An edited source leaves the byte field `unknown` instead of judging the stale committed object. `build-record.json` is committed fixture metadata — `--save-runs` rewrites only the snapshots in `runs/`, never the capture record.
