# Binary Diffing and Symbolic Execution: Matching Functions and Solving for Inputs

> A match between two functions is a claim made by one signature with one quality, and a solved input is one model of one path condition; this lesson builds both and checks them against radiff2, Ghidra, angr, and z3.

**Type:** Build
**Languages:** Python, C, x86-64 assembly, Java (one Ghidra script)
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), 34 (lifting to pseudocode), 36 (rebuild and prove equal)
**Time:** ~150 minutes

## Learning Objectives

- Build five function signatures from an object and its listing: exact bytes, bytes with relocation fields masked, mnemonic sequence, flow-graph shape, and symbol name.
- Run a staged greedy matcher in the BinDiff style, where a signature matches only when it is unique on both sides, and record the stage and quality behind every match.
- Reproduce the case where two byte-identical functions fail a byte correlator on loaded images and pass it after masking, with the relocation arithmetic that explains the four changed bytes.
- Reproduce radiff2's similarity ratios from the Levenshtein distance and explain why one ratio only appears when the comparison uses the 82 bytes radare2 reached.
- Enumerate the paths of a function over a small IR, carry a condition per path, and solve each leaf for inputs with a bounded search.
- Measure path explosion on a loop with a symbolic bound and compare the counts, classes, and models with angr 10.0.3 and z3 5.1.0.

## The Problem

You rebuilt `ledger.c` at `-O2` and asked an agent whether anything changed since the `-O1` build. The agent ran a differ and reported that `grade` was modified, because its bytes differ in the two loaded programs. It then spent its budget explaining a change that does not exist. The 46 bytes of `grade` are identical in the two object files. The differ compared images after relocation, and `.rodata` sits 0x70 bytes further on in the `-O2` program, so one displacement in `grade` grew by 0x70.

The same afternoon you asked which score makes `grade` return 4. The agent read the pseudocode and answered "90". That is one answer. The function returns 4 for every score from 90 to 109, and the question had no bound, so the agent's answer was a sample where you needed a set.

Both failures come from the same gap. A match and a solved input are each a claim with a method behind it. This lesson builds the two methods in standard-library Python and runs the production tools next to them. Where the tools and the code agree you have two derivations. Where they disagree you have an address, a byte, or a bound to look at.

```figure
re-44-matches-and-paths
```

## A Function Signature Is a Claim With a Quality

Flake framed binary diffing in 2004 as the construction of an isomorphism between the function sets of two similar executables. Dullien and Rolles extended it in 2005 to basic blocks and instructions. The BinDiff concepts page describes the strategy that came out of that work. Compute one attribute for every function on both sides. A value that appears exactly once on each side is a match. A value that appears more than once is ambiguous and is drilled down with the next attribute inside that equivalence class. A value with no counterpart stays unmatched. After each pass, the callers and callees of new matches form small sets where the next attribute is likely to be unique, and the process repeats with the next attribute.

Each matching algorithm carries a quality. The page rates hash matching of raw function bytes and name hash matching as very good, the flow-graph MD index and prime signature matching (each mnemonic a small prime, product over the function) as good, string references as medium, and loop count or address sequence as poor. Confidence of a match is the average quality of the algorithms that produced it, weighted by a sigmoid. Function similarity is about 25% matched flow-graph edges, 15% matched basic blocks, 10% matched instructions, and 50% the difference in flow-graph MD index, multiplied by the confidence.

This lesson keeps five of those attributes and the one rule that matters: unique on both sides or no match. It drops the MD index, because the concepts page names it without a formula, and uses a plain degree sequence in its place. The quality labels stay, because a match is only as good as the weakest fact that produced it.

## Five Signatures From One Function Record

The differ reads two things per object. The ELF gives bytes, symbol sizes, and `.rela.*` records. The `llvm-objdump -d` listing gives instruction boundaries and mnemonics, and lesson 33 proved a decoder equal to that listing on every instruction of these objects. `function_record()` checks that every listed instruction's bytes equal the object's bytes at that address and raises otherwise. A stale listing is a changed fixture.

Take `grade` in `ledger-x86_64-O1.o`. The symbol says offset 0x10 and size 46, so the record covers 0x10 to 0x3e and excludes the two-byte `nop` that aligns the next function.

The exact-bytes signature is the SHA-256 of the 46 bytes. The masked-bytes signature zeroes every relocation field first. There is one field: the record `R_X86_64_PC32 .rodata+0x10` at offset 0x36, four bytes wide, the displacement of the `leaq (%rip), %rcx` at 0x33. In a RELA object those four bytes already hold zero, so the two signatures agree on every function of every object here. The mask exists for the next section.

The mnemonic signature hashes the sequence of 14 mnemonics:

```text
movslq imulq movq sarq shrq addl addl xorl cmpl ja movl leaq movl retq
```

The flow-graph shape signature comes from the basic blocks and typed edges of lesson 33, restricted to the blocks the entry can reach. `grade` at `-O1` has three blocks and three edges. Block 0x10 ends in `ja 0x3d` with a taken edge and a fallthrough edge, block 0x31 falls through to 0x3d, and 0x3d returns. The degree sequence lists (in, out) per block in sorted order, so the signature reads `3b 3e [0/2,1/1,2/0]`. For `grade` at `-O0` the record resolves the indirect jump through the five `.rela.rodata` entries exactly as lesson 33 did, which gives eight blocks and eleven edges with four `table` edges.

The name signature is the symbol name. It is the strongest fact when it exists and nothing when the build is stripped.

One more field rides along for the patch case later. When a function has a `lea` relocation into `.rodata`, a bounds check, and an indexed load, `referenced_table()` reads the table the way lesson 36 did: the `cmpl $0x4` before `ja` gives five entries and the load `movl (%rcx,%rax,4), %eax` gives four bytes each. For `grade` at `-O1` the table at `.rodata+0x14` reads `1, 2, 3, 4, 4`.

## The Greedy Matcher

`match_functions()` runs the stages in order. For each stage it groups the still unmatched functions on each side by that stage's signature and accepts every value that has exactly one function on each side. The match records the stage, the stage's quality, every other signature that also agrees, and a similarity ratio.

```python
for stage in order:
    for signature, candidates in left_groups.items():
        partners = right_groups.get(signature, [])
        if len(candidates) != 1 or len(partners) != 1:
            continue
        a, b = candidates[0], partners[0]
        agreeing = [s.id for s in STAGES if a.signatures()[s.id] == b.signatures()[s.id]]
        matches.append(Match(a, b, stage, agreeing, radare2_ratio(a.raw, b.raw), data_equal))
```

The lesson order runs the four structural stages first and names last, so the structural stages get tested and the names grade them afterwards. For `-O1` against `-O2`:

| Function | Stage | Agreeing signatures | Similarity |
|---|---|---|---|
| `percent_change` | exact bytes | all five | 1.000 |
| `grade` | exact bytes | all five | 1.000 |
| `total` | name | name only | 0.171 |
| `grade_label` | exact bytes | all five | 1.000 |

`total` grew from 31 bytes and 13 instructions to 140 bytes and 41 instructions, because clang vectorised the loop with SSE2 and kept a scalar remainder loop. Its shape went from five blocks and five edges to ten blocks and thirteen edges. Nothing structural survives, and only the symbol links the two.

For `-O0` against `-O1` the same order produces one wrong match:

| Function at -O0 | Matched at -O1 | Stage | Names agree |
|---|---|---|---|
| `percent_change` | `grade_label` | flow-graph shape | no |
| `grade` | `grade` | name | yes |
| `total` | `total` | name | yes |
| `grade_label` | unmatched | | |

`percent_change` at `-O0` is a four-block diamond: an entry that branches on `before == 0`, two arms, and a join that returns. Its degree sequence is `0/2, 1/1, 1/1, 2/0`. `grade_label` at `-O1` has `grade` inlined and the same diamond around the bounds check. The shape is unique on both sides and the rule accepts it. The medium quality label is the warning, and the name stage, run afterwards, contradicts it. The false match also consumes `grade_label` on the right, so the real `percent_change` and `grade_label` pairs stay unmatched.

The BinDiff order runs name matching as the second stage when real names exist, and `BINDIFF_ORDER` in the code does the same. With that order all four `-O0` functions match their `-O1` versions by name, which is the result Ghidra reports below. The lesson keeps both orders in the demo so the failure is visible. A flow-graph shape of four nodes is the shape of every `if` and `else` that joins before the return.

## Identical Bytes, Relocated Operand

Ghidra applies relocations when it imports an object. Its byte correlator therefore compares loaded images, and lesson 36 masked relocation fields for this reason. `load_image()` reproduces the import. It walks the allocated sections in header order, aligns each to its `sh_addralign`, and lays them out from 0x100000. Then it applies every record: `S + A - P` written as a signed 32-bit value for `R_X86_64_PC32` and `R_X86_64_PLT32`, `S + A` as 64 bits for `R_X86_64_64`.

The layout agrees with Ghidra 12.1.4 on every section start in both programs, which the test suite checks against the captured Version Tracking output:

| Section | `-O1` program | `-O2` program |
|---|---|---|
| `.text` | 0x100000, 159 bytes | 0x100000, 271 bytes |
| `.rodata` | 0x1000a0 | 0x100110 |
| `.rodata.str1.1` | 0x1000f0 | 0x100160 |

`.text` is 112 bytes longer at `-O2`, the growth of `total`, so `.rodata` starts 0x70 bytes further on. `grade` sits at 0x100010 in both programs. Its `leaq` at offset 0x33 has its displacement field at 0x36 and ends at 0x3a. The relocation addend 0x10 plus the usual 4 puts the table at `.rodata+0x14`.

In the `-O1` image: `0x1000a0 + 0x14 - 0x10003a = 0x7a = 122`. In the `-O2` image: `0x100110 + 0x14 - 0x10003a = 0xea = 234`. The field bytes are `7a 00 00 00` in one image and `ea 00 00 00` in the other. One byte of 46 differs, the Levenshtein ratio is 0.978, and the exact-bytes stage fails. The masked-bytes stage zeroes the field and passes. `grade_label` moved by the same 0x70 as its table, so its displacements stayed equal and it passes on exact bytes in both views.

Ghidra reports the same split. On `-O1` against `-O2`, Exact Function Bytes Match found `percent_change` and `grade_label`, Exact Function Instructions Match found those two plus `grade`, and Exact Function Mnemonics Match found the same three. The instruction correlator masks operands, which covers the displacement. The lesson's image view gives exact-bytes matches for exactly the two functions Ghidra's byte correlator found and masked-bytes agreement for exactly the three its instruction correlator found. The test suite asserts both equalities.

rea 6.5.0's `compare_functions` line-diffs provider text. On the assembly dimension it attaches the limitation "relocation normalization is unavailable". The loader and the mask in this lesson supply that normalization.

## What radiff2 Measures

radare2 6.2.4 ships `radiff2`. With `-AC` it analyses both files and prints one row per function: the left size and address, MATCH or UNMATCH, a ratio, and the right size and address. The captured rows for our objects:

| Pair | `percent_change` | `grade` | `total` | `grade_label` |
|---|---|---|---|---|
| `-O0` vs `-O1` | UNMATCH 0.130435 | UNMATCH 0.426829 | UNMATCH 0.106061 | UNMATCH 0.269841 |
| `-O1` vs `-O2` | MATCH 1.000000 | MATCH 1.000000 | UNMATCH 0.171429 | MATCH 1.000000 |
| `-O1` vs `-O1` | MATCH 1.000000 | MATCH 1.000000 | MATCH 1.000000 | MATCH 1.000000 |

The ratio in the radare2 source is `1 - distance / max(len_a, len_b)`, where the distance is the Levenshtein distance between the two function fingerprints and a fingerprint is the concatenation of the function's basic blocks in address order. The match threshold is 0.7. `radare2_ratio()` in `code/main.py` implements the same formula over the raw function bytes and reproduces 0.130435, 0.106061, 0.269841, and 0.171429 to six decimals.

It does not reproduce 0.426829 for `grade` at `-O0`. Over the 118 bytes of the function the ratio is 0.296610. radare2 prints `118` in the size column. Its fingerprint is shorter. Without applied relocations it cannot resolve the jump table, so its analysis reaches the entry block, the block that ends in `jmpq *%rax`, the default case, and the return: 82 bytes, the same 82 that lesson 33's plain recursive descent claimed. The Levenshtein distance between those 82 bytes and the 46 bytes at `-O1` is 47, and `1 - 47/82 = 0.426829`. With `-e bin.relocs.apply=true` radare2 finds all 118 bytes and prints 0.288136, which equals the lesson's ratio over the relocated images, where the four displacement bytes differ from the zero fields of the object. Two tools agree only when they compare the same bytes, and the size column does not say which bytes went in.

`-O` restricts the fingerprint to opcode bytes and zeroes the operands. The `-O0` versus `-O1` ratios rise to 0.239130, 0.512195, 0.303030, and 0.523810, and `total` at `-O1` versus `-O2` rises to 0.192857. Whole-file distances exist too: `-s` (Myers) reports similarity 0.956 and distance 162 between the two objects, `-ss` (Levenshtein) 0.927 and 137. Those numbers include headers, symbol tables, and relocation sections and say nothing about functions.

## Ghidra Version Tracking Correlators

Ghidra's Version Tracking tool matches a source program to a destination program with correlators. The function correlators are Exact Function Bytes Match, Exact Function Instructions Match (operands masked), Exact Function Mnemonics Match, and Duplicate Function Instructions Match (1:N and N:M). Data correlators are Exact, Duplicate, and Similar Data Match. Symbol correlators match names exactly, as duplicates, or by similarity. Reference correlators use accepted matches to find more. Functions must be defined in the destination program, and the minimum function length defaults to 10 bytes. Auto Version Tracking runs Exact Symbol Name, Exact Data, Exact Function Bytes, Exact Function Instructions, Exact Function Mnemonics, Duplicate Function Instructions, then a reference correlator, and creates implied matches for accepted ones. A BSim correlator was added in 11.2.

The lesson captured the correlators headlessly. `capture_ghidra_vt.sh` imports the three objects into a project and runs `ListVersionTrackingMatches.java`, a short script that extends `AbstractGhidraVersionTrackingScript`, opens the source and destination programs by path, runs the six non-reference correlators in the Auto Version Tracking order, and prints one line per block, function, correlator, and match. Every number in this section comes from those two text files.

| Correlator | `-O0` to `-O1` | `-O1` to `-O2` |
|---|---|---|
| Exact Symbol Name Match | 4 functions | 4 functions, 5 data items (`labels.rel`, `.L.str.1` to `.L.str.4`) |
| Exact Data Match | 0 | 0 |
| Exact Function Bytes Match | 0 | 2 (`percent_change`, `grade_label`) |
| Exact Function Instructions Match | 0 | 3 (adds `grade`) |
| Exact Function Mnemonics Match | 0 | 3 |
| Duplicate Function Instructions Match | 0 | 0 |

Every function changed between `-O0` and `-O1`, so only the names matched, which is the result the lesson's matcher gives in the BinDiff order. Every match printed similarity 1.000 and confidence 10.000. The help page describes the exact correlators as similarity 1.0 and confidence 1.0, so the scale of the printed confidence is an open question this lesson records and does not resolve.

Program Differences, under Tools, is a different thing. It compares two programs with the same address space on bytes, labels, code units, references, comments, and functions at equal addresses. It is an address-aligned diff and matches nothing that moved.

## Diaphora and Binary Ninja, From Their Documentation

Diaphora is an IDA Pro plugin, first released in 2015 and at version 3.4.2 as of 2026-08-18. It is AGPL-3.0 since 2.0 and needs IDAPython, so it runs in IDA Home or IDA Pro and not in IDA Free. It exports each database to SQLite and runs its heuristics as SQL queries. Each heuristic has a name, a category of Best, Partial, or Unreliable, a ratio type, and optional flags such as SAME_CPU or SLOW. The names in the current source read like the stages of this lesson with more of them: Bytes hash, Same address and mnemonics, Same cleaned assembly, Mnemonics small-primes-product, Same nodes, edges, loops and strongly connected components, Topological sort hash, and pseudo-code fuzzy hashes that need the Hex-Rays decompiler. Its release notes show the tuning history: slow heuristics only run below about 2,000 functions, and "Same graph" moved to the unreliable category. That move is the four-block diamond of this lesson, seen at scale.

Binary Ninja 6.0, released 2026-09-03, added Binary Similarity as a framework with providers and resolvers. It ships BinDiff as a structural provider and WARP for exact function matches that tolerate relocatable operands, and its guide says to use WARP when functions match apart from relocatable instructions and BinDiff when they stay structurally related after recompilation. The feature is in the Ultimate edition only. Binary Ninja has no package manager install here and was not run, so this paragraph comes from its documentation and nothing else.

BinDiff itself has been open source since 2023-09-25 under Apache-2.0, with v8 the latest release. It needs a disassembler and the BinExport plugin, which supports IDA Pro 9.4 or later, Binary Ninja, and Ghidra. The free path for a learner is Ghidra plus BinExport plus the BinDiff command line. The lesson did not run it, and its Practice Lab asks you to.

## Same Code, Different Constant

Lesson 36 kept a candidate rebuild of `grade` whose table has 3 as its last entry, where the original has 4. `grade_case10_wrong.o` has the same 46 code bytes as `grade` at `-O1`. The matcher pairs them on exact bytes with every signature agreeing. The referenced-table check reads `1, 2, 3, 4, 4` through one relocation and `1, 2, 3, 4, 3` through the other and reports `dataEqual: false`. The three other `-O1` functions are unmatched on the left, because the candidate object holds one function.

This is the patch-analysis shape. A function differ that stops at bytes says nothing changed. Ghidra's Exact Data Match and BinDiff's string-reference matching exist for the same reason. The lesson's version is small: for every matched pair, compare the bytes each function's relocations point at, with the count from the bounds check and the width from the load.

## Symbolic Execution: Paths, Conditions, Solvers

King described symbolic execution in 1976. Inputs become symbols. Each statement updates a symbolic store. Each branch adds a condition to the path, and a solver decides whether the path is feasible and produces a concrete input that follows it. A function with branches becomes a tree of paths, and a leaf is a return with a condition attached.

Baldoni, Coppa, D'Elia, Demetrescu, and Finocchi surveyed the field in 2018. Their section 5 names path explosion as the central cost: an executor may fork at every branch, so the state count can grow exponentially in the number of branches, and a loop whose bound depends on a symbolic input gives an unbounded set of paths. The mitigations they list are pruning unrealizable paths by solving at each branch, summaries for functions and loops, state merging, and under-approximation. Concolic execution runs the program concretely and symbolically at once, records the conditions along the concrete run, negates one, and asks the solver for the next input. DART (2005), CUTE (2005), and SAGE (2008) are the named systems.

KLEE (Cadar, Dunbar, Engler, OSDI 2008) is a symbolic virtual machine over LLVM bitcode, so its input is `clang -emit-llvm` output and not a binary. It ships a POSIX environment model and a replay library. On the 89 GNU coreutils programs it reached 84.5% line coverage against 67.7% for the developers' tests and found 56 serious bugs. KLEE 3.2 was released 2025-12-23 under the NCSA licence, with LLVM 16 recommended.

angr works on binaries. `angr.Project` holds a CLE loader that maps the object and applies relocations, a lifter that turns a block into VEX IR (`block.vex`) with pypcode as an alternative, and a factory for states. A `SimState` holds registers, memory, and a solver. A `SimulationManager` steps stashes of states named `active`, `deadended`, `found`, `avoided`, and `errored`, and `explore(find=..., avoid=...)` wraps it. Per step the engines run in order: failure, syscall, hook, unicorn for concrete data, and VEX as the fallback. claripy is the solver front end over Z3, and in angr 10.0 it is a vendored Rust implementation imported as `from angr import claripy`. angr 10.0.3 was uploaded on 2026-10-10, is BSD-2-Clause, and needs Python 3.12 or later. Z3 5.1.0, released 2026-08-16 under MIT, is the solver behind angr, Triton, and KLEE's optional backend.

## A Tiny Executor Over the Lesson 34 IR

The executor in `code/main.py` uses a small IR with the statement shapes of lesson 34: `Assign`, `Branch`, `Jump`, `Return`, plus the `Switch` terminator that lesson 34's Practice Lab asked for. Expressions are `Const`, `Var`, `Bin` with a width, `Cast`, `Load` from a named concrete table, and `Not`. The four fixture functions are lifted by hand at the level lesson 34 reaches after simplification, where the `0x66666667` multiply has become `score / 10`, and every IR block lists the instruction addresses it came from. `check_ir_against_listing()` asserts that the addresses cover the function's listing exactly once.

`grade` at `-O0` in that IR:

```text
0x30: local_8 = score; local_10 = score / 10 - 6; if (local_10 >u 4) goto 0x9a else 0x62
0x62: switch local_10 -> 0x91, 0x88, 0x7f, 0x76, 0x76
0x76: local_4 = 4; goto 0xa1        0x7f: local_4 = 3; goto 0xa1
0x88: local_4 = 2; goto 0xa1        0x91: local_4 = 1; goto 0xa1
0x9a: local_4 = 0                    0xa1: return local_4
```

The switch targets come from `jump_table_targets()`, the same relocation arithmetic as lesson 33, so the IR reads the fixture.

`execute()` keeps a worklist of path states. A state has the current block, the trace of blocks, the condition list, and an environment that maps each variable to an expression over the inputs. `Assign` substitutes the environment into the source and stores the result. `Branch` substitutes into the condition, then asks the solver twice: once with the condition added, once with its negation. A side the solver cannot satisfy is dropped, which is the eager pruning the survey describes. `Switch` groups the table entries by target and forks once per distinct target with the disjunction of the entry equalities, which is how angr treats a symbolic jump target too. `Return` substitutes into the value and closes the leaf. A trace longer than the step limit marks the path truncated and stops it.

Follow the path to `return 4` by hand. The entry assigns `local_10 = score / 10 - 6`. The branch condition `local_10 >u 4` is false on this path, so the condition list holds `!(score / 10 - 6 >u 4)`. The switch entries 3 and 4 both point at 0x76, so the fork to 0x76 adds `score / 10 - 6 == 3 || score / 10 - 6 == 4`. Block 0x76 assigns `local_4 = 4`, jumps to 0xa1, and the return substitutes to `4`. The leaf is the pair of that condition and that value.

The solver is `BoundedSearch`. It holds a finite domain per input, enumerates the product of the domains, and evaluates each constraint with C semantics: 32-bit wraparound, truncating division, signed and unsigned comparisons, and arithmetic or logical shifts. A division by zero or a table index outside the table makes that assignment fail the constraint. For `score` in -200 to 1200 the five paths of `grade` cost 44,460 evaluations and a few milliseconds. Solving each leaf for the input set gives:

| Leaf | Returns | Condition | Scores in the bound |
|---|---|---|---|
| 0x76 | 4 | `!(q >u 4) && (q == 3 \|\| q == 4)` | 90 to 109, 20 inputs |
| 0x7f | 3 | `!(q >u 4) && q == 2` | 80 to 89, 10 inputs |
| 0x88 | 2 | `!(q >u 4) && q == 1` | 70 to 79, 10 inputs |
| 0x91 | 1 | `!(q >u 4) && q == 0` | 60 to 69, 10 inputs |
| 0x9a | 0 | `q >u 4` | 1,351 inputs, the rest of the bound |

`q` stands for `score / 10 - 6`. The same classes come out of `grade` at `-O1`, where the IR has two paths, the table path returning `lookup_14[q]` and the default path returning 0, and the question becomes a constraint on the returned value, because there is no case block to reach. The table `lookup_14` is read from the object's `.rodata` at 0x14.

The bound is the limit of the method. A bounded search is complete inside its domain and silent outside it. Within -200 to 1200 no score in 60 to 109 returns 0 and no score of 110 or more returns a non-zero value. z3 proves both for all 2^32 scores, and the next section shows where the two methods return different witnesses.

## Path Explosion Measured

`total` at `-O1` is the loop of lesson 33: a test on `count`, a loop body that adds `values[rdx]` and increments `rdx`, and a `jne` back to the body while `rdx != rcx`. In the IR `rcx` is `zext64(count)` and `rdx` starts at 0. Each pass through the back edge forks on `rdx != count` with `rdx` a constant, so the path for `count = c` runs the body `c` times and exits. With `count` bounded to 0 to 2 the executor finds 3 paths. With 0 to 4 it finds 5, and with 0 to 8 it finds 9. Every path returns the triangular sum of its count: (0, 0), (1, 1), (2, 3), up to (8, 36). angr reports 3, 5, and 9 deadended states and the same nine count-and-sum pairs at all three optimization levels, including `-O2`, whose vector loop needs a count of at least 8 and therefore never changes the path count in this range.

With no bound the executor never finishes, because every iteration count is one more feasible path. The lesson's cap of 24 blocks per path, run with `count` up to 64, returns 22 paths, truncates 2, and never starts the other 41 of the 65 that exist. The report gives those three numbers. The solve cost grows too: 33 evaluations at bound 2, 115 at 4, 531 at 8, and 6,900 for the capped run.

## angr and z3 on the Same Questions

`capture_angr.py` ran angr 10.0.3 over the three objects. CLE loaded each relocatable object with the ELF backend at 0x400000, applied 13 relocations for `-O0` and 8 for the others, and resolved the four symbols. For `grade` with one symbolic 64-bit argument, `run()` ended with 5 deadended states at `-O0` and 2 at `-O1` and `-O2`, in 0.475, 0.408, and 0.318 seconds. Adding `eax == v` to each deadended state and asking the solver for the signed minimum and maximum gave 60 to 69, 70 to 79, 80 to 89, and 90 to 109 for `v` from 1 to 4 at every level, and -2147483648 to 2147483647 for 0. Both cross checks were unsat.

The reach-a-block form used CFGFast on `grade` at `-O0`, which lists the eight blocks lesson 33 found, then `explore(find=0x400076)` for the block that stores 4. It found one state with three still active in 0.47 seconds, with minimum 90 and maximum 109 on the argument and samples 91, 93, 94, 97, and 101.

For `percent_change`, two deadended states with the constraints `before[31:0] != 0` and `before[31:0] == 0`. Asking the non-zero state for `eax == 50` gave `before = 21055744, after = 332315210` at `-O0`, `40566804, 834296877` at `-O1`, and `-24484867, 993934694` at `-O2`. The bounded search in -16 to 16 answers `before = -10, after = -15`. z3, asked the same question over the lesson 34 listing, answers `before = -25092599, after = 305712160`. The test suite evaluates all five pairs with the IR evaluator and each gives 50. A model proves that an input exists. It is not the input, and three correct tools gave three different ones.

`capture_z3.py` models the `-O1` listing of `grade` in 32-bit bit-vectors with the multiply, the two shifts, and the table, and asks four more questions. The listing differs from the source `switch` for some 32-bit score: unsat in 0.068 seconds, so the compiled function equals the source on all 2^32 inputs. The listing differs from lesson 36's threshold rebuild: sat at score 706346536, where `score / 10` is 70634653 and the switch falls to the default while the thresholds return 4. The same difference restricted to 0 to 109: unsat, which is why lesson 36's grid could not see it. For `percent_change`, `before == 3` with result -133 is sat with `after = 1073741823`, the overflow cell of lesson 36, and the bounded search finds a second witness inside its domain, `after = -1`, where `(-1 - 3) * 100 / 3` truncates to -133 with no overflow at all.

## Build It

Run the demo:

```bash
cd phases/13-tools-and-protocols/44-binary-diffing-and-symbolic-execution
python3 code/main.py
```

The output is one JSON report. `diffs` holds the object-file and loaded-image matches for `-O0` against `-O1` and `-O1` against `-O2`, plus the `-O0` pair in the BinDiff order. `toolComparison` puts the lesson's stage next to the radiff2 verdict and ratio and the Ghidra correlators for every function. `patch` is the `grade_case10_wrong.o` case. `radare2Ratios` reproduces the radiff2 numbers, `gradeRelocationCase` shows the layout and the two displacements, and `symbolic` holds the paths, classes, and explosion counts.

Read `code/main.py` in this order:

1. `ElfObject` reads sections, symbols, and `.rela.*` records. `parse_listing()` reads the `llvm-objdump` text.
2. `jump_table_targets()` and `build_cfg()` give reachable blocks and typed edges. `FunctionRecord.signatures()` builds the five signatures.
3. `load_image()` lays out the allocated sections and applies `S + A - P` and `S + A`.
4. `match_functions()` is the staged matcher. `levenshtein()` and `radare2_ratio()` give the similarity.
5. `parse_radiff2()` and `parse_ghidra_vt()` read the captured tool outputs for the comparison.
6. `evaluate()`, `substitute()`, and `BoundedSearch` are the expression semantics and the solver.
7. `execute()` enumerates paths. `solve_returns()` asks each leaf for an input set.
8. `grade_ir_o0()`, `grade_ir_o1()`, `percent_change_ir_o1()`, and `total_ir_o1()` are the hand lifts with their instruction addresses.

Three more commands exist. `python3 code/main.py diff A.o B.o` diffs two objects whose listings sit beside them, and `--image` diffs their loaded images. `python3 code/main.py paths grade O0` prints the paths and classes of one function, `paths total 8` the loop with a bound. `python3 code/main.py figure-data` prints the data the interactive figure embeds.

## Use It

Use the differ and the executor in this order on two builds of your own program.

1. Capture a listing for each object and let `function_record()` verify it against the bytes. Fix the listing before anything else.
2. Diff the object files first. Read the stage of every match and treat flow-graph shape matches as suggestions until a second signature agrees.
3. Diff the loaded images. A function that drops from exact bytes to masked bytes moved relative to its data, and the displacement arithmetic names the section that moved.
4. For every match, compare the referenced tables. Same code with different constants is a modified function.
5. Run the names stage and compare. When the build has symbols, run the BinDiff order and use the structural result only to grade the stages.
6. When a tool reports a ratio, find out which bytes went into it before you compare it with your own.
7. For the function whose inputs you want, write the IR with one address per statement, run `execute()` with a bound on every symbolic loop counter, and solve each leaf. Report the bound with the result.
8. Run the same query through angr or z3 when they are available and compare the class bounds. A sample is one model.

## Interactive Lab

### Lab A: five signatures by hand

From the `code` directory, open Python:

```bash
cd phases/13-tools-and-protocols/44-binary-diffing-and-symbolic-execution/code
python3 -q
```

Run:

```python
from main import *
grade = {r.name: r for r in fixture_records("ledger-x86_64-O1.o")}["grade"]
grade.raw.hex(" ")
grade.masked_bytes() == grade.raw
grade.mnemonics
grade.cfg_shape()
grade.signatures()
```

Write down the four bytes at offset 0x26 of the function before you print `grade.raw`. Then run the same lines on `grade` from `ledger-x86_64-O0.o` and count the `table` edges in `grade.edges`.

### Lab B: watch the relocation break the byte hash

```python
case = grade_relocation_case()
case["layout"]
case["displacements"], case["rodataShift"]
case["objectBytesEqual"], case["imageBytesEqual"], case["maskedImageBytesEqual"]
```

Compute `0x100110 + 0x14 - 0x10003a` on paper before you read `displacements`. Then change the base in `load_image()` to 0x400000 and confirm that the displacements do not change, because both operands move together.

### Lab C: the false match and the order that avoids it

```python
report = diff_fixtures("ledger-x86_64-O1.o", "ledger-x86_64-O2.o")
[(m.left.name, m.right.name, m.stage) for m in report.matches]
report = diff_fixtures("ledger-x86_64-O0.o", "ledger-x86_64-O1.o")
[(m.left.name, m.right.name, m.stage, m.names_agree) for m in report.matches]
report = diff_fixtures("ledger-x86_64-O0.o", "ledger-x86_64-O1.o", stages=BINDIFF_ORDER)
[(m.left.name, m.right.name, m.stage) for m in report.matches]
```

Print `records(...)["percent_change"].cfg_shape()` for `-O0` and `grade_label` for `-O1` and read the two degree sequences. Then write a sixth stage that hashes the sorted mnemonics, so order no longer matters, and see whether it separates them.

### Lab D: paths and the bound

```python
report = grade_paths("O0")
[(p["trace"], p["condition"], p["returns"]) for p in report["paths"]]
report["returns"]["4"]
total_paths(2), total_paths(4), total_paths(8)
total_paths(64, step_limit=24)["truncated"]
```

Change `SCORE_DOMAIN` to `range(0, 110)` and rerun `grade_paths("O0")`. The class for 0 shrinks to 60 inputs and the two cross checks still hold. Then set the domain to `range(90, 100)` and read which leaves have no model at all.

## Practice Lab

Run BinDiff on the fixtures and compare it with the three results you already have.

Requirements:

- Install the BinExport extension in Ghidra 12.1.4 and export the three ledger programs. Record the BinExport release tag and the Ghidra version.
- Install the BinDiff 8 command line and produce the `-O0` versus `-O1` and `-O1` versus `-O2` results with the similarity-only option.
- Capture the per-function similarity and confidence into `code/fixtures/` with the exact commands in `build_fixtures.sh`.
- Extend `tool_comparison()` with a `bindiff` column and add a test that compares BinDiff's matched set on `-O1` versus `-O2` with the lesson's masked-bytes set.
- Write one paragraph that names the algorithm BinDiff used for `grade` and whether it compared loaded images.

Success means the demo prints four tool columns per function and the new test states one equality or one explained difference.

## Lesson Artifact

This lesson includes `outputs/skill-binary-diffing-and-symbolic-execution.md`. Use it to turn two builds and a function into a staged diff with a stated quality per match, an explanation of every unmatched or changed function, and a path report with a solved input set per leaf and the bound that produced it.

## Verify It

Run the demo and the suite:

```bash
cd phases/13-tools-and-protocols/44-binary-diffing-and-symbolic-execution
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

Verification should prove:

- the symbol tables give the four functions with sizes 46, 118, 66, 39 at `-O0`, 16, 46, 31, 63 at `-O1`, and 16, 46, 140, 63 at `-O2`
- the `.rela.text` records of the `-O1` object describe as `llvm-objdump -r` prints them
- every listed instruction lies in its symbol extent and its bytes equal the object, and a changed byte raises
- `total` at `-O1` has five blocks, five edges, and one self loop, and its shape string is deterministic
- `grade` at `-O0` recovers five jump-table targets from `.rela.rodata` and has eight blocks and eleven edges
- without the table, `grade` at `-O0` reaches 82 bytes in four blocks
- `percent_change` at `-O0` and `grade_label` at `-O1` have the same four-block shape
- exact and masked hashes agree on every function of a relocatable object
- `-O1` and `-O2` share bytes for three functions, `-O0` and `-O1` share none
- the referenced table of `grade` reads `1, 2, 3, 4, 4` and the candidate's reads `1, 2, 3, 4, 3`
- the loader places `.text`, `.rodata`, and `.rodata.str1.1` where Ghidra placed them in both programs
- `R_X86_64_PC32` is written as `S + A - P` and gives displacement 122, and `R_X86_64_64` entries in `.data` receive string addresses
- `grade` bytes agree in the objects and differ in the images by a 0x70 shift, and masking restores the match
- `-O1` versus `-O2` matches three functions on exact bytes and `total` by name; the image view matches `grade` by masked bytes with similarity 1 - 1/46
- the lesson order produces one false flow-graph shape match on `-O0` versus `-O1`, and the BinDiff order matches all four by name
- the patch candidate matches on bytes and fails on referenced data
- the Levenshtein ratio reproduces 0.130435, 0.106061, 0.269841, 0.171429, 0.426829 over 82 bytes, and the relocated-bytes ratios radiff2 prints with relocations applied
- radiff2's MATCH set equals the exact-bytes stage, and Ghidra's byte and instruction correlators equal the image view's exact and masked sets
- Ghidra found only names on `-O0` versus `-O1`, with similarity 1.0 and confidence 10.0 on every match
- the hand-lifted IR covers every listed instruction once, and the evaluator follows C semantics
- `grade` has five paths at `-O0` with the switch conditions and two at `-O1` with the same classes
- the bounded classes 60 to 69, 70 to 79, 80 to 89, 90 to 109 equal angr's at all three levels and z3's, with 5 and 2 deadended states and the reach-a-block range 90 to 109
- the two cross checks have no model in the bound, in angr, or in z3, and z3 proves the listing equal to the source switch
- every `percent_change` model from the bounded search, angr, and z3 evaluates to the requested value
- `total` gives 3, 5, 9 paths with the triangular sums, the same as angr, and the step cap returns 22 and truncates 2
- the figure data carries both views, the relocation numbers, and five leaves with their input sets, and the site module embeds the same data

## Production Failure Modes

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Byte hash on a loaded image | "grade modified" between two builds with identical code | The field offset, the two displacements, and the section shift; the masked hash matches |
| Masked hash on a relocatable object | "masking made no difference" | The fields were already zero; the relocation records and the referenced constants carry the change |
| Flow-graph shape alone | A confident pair of unrelated functions | A second signature agrees, or the names contradict and the match is dropped |
| Names before structure on a stripped build | Nothing matches | The structural stages with their qualities, and the unmatched list |
| A ratio compared across tools | "radiff2 says 0.43 and the lesson says 0.30" | Which bytes each side fingerprinted; 82 bytes without relocations, 118 with |
| Same code, different constant | "exact match" | The table read through the relocation and the bounds check |
| One model reported as the input | "the score is 90" | The class 90 to 109 with its count, and the bound it was found in |
| Bounded search reported as unsat | "no input gives -133" | Unsat inside the bound only; z3 finds 1073741823 outside it |
| Symbolic loop without a bound | A timeout | The bound or the cap, the paths returned, truncated, and never started |
| Closed tool described as run | Numbers with no capture | A capture file with the command and version, or a sentence saying documentation only |

## Operational Rule

Match on one signature at a time, accept only values unique on both sides, and keep the stage and its quality with the match. Diff the objects and the loaded images and explain every function that changes stage between the two. Enumerate paths with a solver at every branch, bound every symbolic loop, and report an input set with its bound. A single model without a bound is a sample.

## Further Reading

- [BinDiff concepts: matching strategy, algorithms, and quality ratings](https://github.com/google/bindiff/blob/main/docs/concepts.md)
- [BinDiff repository and the v8 open-source release](https://github.com/google/bindiff/releases/tag/v8)
- [BinExport README: IDA Pro, Binary Ninja, and Ghidra exporters](https://github.com/google/binexport)
- [Flake, "Structural Comparison of Executable Objects" (DIMVA 2004) and Dullien, Rolles, "Graph-based comparison of Executable Objects" (SSTIC 2005), shipped in the BinDiff repository](https://github.com/google/bindiff/tree/main/docs/papers)
- [Diaphora README and heuristics source](https://github.com/joxeankoret/diaphora)
- [Ghidra Version Tracking correlators help page](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/VersionTracking/src/main/help/help/topics/VersionTrackingPlugin/VT_Correlators.html)
- [Ghidra Auto Version Tracking help page](https://www.ghidradocs.com/11.0_PUBLIC/help/VersionTracking/help/topics/VersionTrackingPlugin/VT_AutoVT.html)
- [Ghidra 12.1.4 release](https://github.com/NationalSecurityAgency/ghidra/releases)
- [Binary Ninja 6.0 "Krypton" release notes](https://binary.ninja/2026/09/03/binary-ninja-6.0-krypton.html) and [Binary Similarity user guide](https://docs.binary.ninja/guide/similarity.html)
- [radare2 book: radiff2](https://book.rada.re/tools/radiff2/intro.html) and [radare2 6.2.4 source](https://github.com/radareorg/radare2/releases/tag/6.2.4)
- [King, "Symbolic execution and program testing" (CACM 1976)](https://dl.acm.org/doi/10.1145/360248.360252)
- [Baldoni et al., "A Survey of Symbolic Execution Techniques" (ACM Computing Surveys 2018)](https://dl.acm.org/doi/10.1145/3182657)
- [Cadar, Sen, "Symbolic execution for software testing: three decades later" (CACM 2013)](https://dl.acm.org/doi/10.1145/2408776.2408795)
- [Cadar, Dunbar, Engler, "KLEE: Unassisted and Automatic Generation of High-Coverage Tests for Complex Systems Programs" (OSDI 2008)](https://www.usenix.org/legacy/events/osdi08/tech/full_papers/cadar/cadar.pdf) and [KLEE 3.2 release](https://github.com/klee/klee/releases/tag/v3.2)
- [Shoshitaishvili et al., "SoK: (State of) The Art of War: Offensive Techniques in Binary Analysis" (IEEE S&P 2016)](https://oaklandsok.github.io/papers/shoshitaishvili2016.pdf)
- [angr documentation: loading, simulation managers, and the simulation pipeline](https://docs.angr.io/en/latest/core-concepts/toplevel.html) and [angr 10.0.3 on PyPI](https://pypi.org/project/angr/)
- [Z3 5.1.0 release](https://github.com/Z3Prover/z3/releases/tag/z3-5.1.0)
- [Triton dynamic binary analysis library](https://github.com/JonathanSalwan/Triton)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, Table 4.9: Relocation Types](https://gitlab.com/x86-psABIs/x86-64-ABI)
