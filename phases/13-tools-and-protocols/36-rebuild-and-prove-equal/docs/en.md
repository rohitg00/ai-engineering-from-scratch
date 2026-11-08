# Rebuild and Prove Equal: Differential Tests, Byte Comparison, and the Evidence Loop

> Passing your tests proves agreement on your tests, so equality needs a grid that reaches every edge and bytes that match after relocation masking.

**Type:** Build
**Languages:** Python, C
**Prerequisites:** Phase 13 · 34 (lifting to pseudocode), Phase 13 · 35 (evidence, confidence, and unknowns)
**Time:** ~110 minutes

## Learning Objectives

- Write a rebuild from the instruction listing and name the evidence record it came from.
- Build an input grid with one class per hazard: zero guard, negative values, truncating division, 32-bit overflow, and a divide trap.
- Run the original and the rebuild in one program and record every cell, including a trap.
- Recompile the rebuild with the original flags and compare function bytes after masking relocation fields.
- Read the constants a relocation points at and compare them, so a wrong literal cannot pass.
- Drive rea's MCP server from a small stdio client and record each step with its evidence id.
- Mint a fail-closed proof record whose id is a hash over its claims and evidence links.

## The Problem

You asked rea for the function dossier of `percent_change` in our `ledger-x86_64-O1.o` fixture. Ghidra 12.1.4 returned pseudocode, and the agent wrote this C from it:

```c
int percent_change(int before, int after) {
    if (before == 0) return 0;
    return (int)(((long)after - before) * 100 / before);
}
```

Four tests pass: `(100, 150)` gives 50, `(200, 100)` gives -50, `(0, 5)` gives 0, `(50, 100)` gives 100. The agent also rebuilt `grade` as four `if` statements on 90, 80, 70, and 60. Six more tests pass. The report says "verified".

That report answers none of these questions:

- What does the original return when `(after - before) * 100` does not fit in 32 bits?
- What does the original return for a score of 110?
- Does the rebuild compile to the same 16 bytes as the original?
- When two compiled functions hold the same bytes, do their relocations point at the same constants?
- Which evidence record did the rebuild come from, and did the agent read the listing or the pseudocode?
- What status does the proof get on a host without a C compiler?

Every target in this lesson is a program we wrote and compiled. The scope and law rules from lesson 32 apply unchanged.

```figure
re-36-prove-equal
```

## What the Evidence Says

The agent loop in `code/main.py` made six calls to rea 6.5.0 over stdio. The recorded run is `code/fixtures/runs/agent-run.json`. The server answered `initialize` with protocol version `2025-11-25`. Three calls returned Evidence records:

| Step | Tool | Time | Evidence id |
|---|---|---|---|
| 2 | `analyze_function percent_change` | 6.31 s | `ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd` |
| 3 | `analyze_function grade` | 0.02 s | `ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1` |
| 4 | `read_bytes 0x1000b4, 20` | 0.00 s | `ev_c26146cfedf4c1ee146d8ff00cfa9a5d3f5335bdd9c97ccf4e1af5f6ea3ed6bc` |

The first call paid for the Ghidra import and auto-analysis. Each record carries `confidence: "observed"`, `authority: "shipped-artifact"`, and the SHA-256 of the object, `9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f`. Ghidra loads the relocatable object with `.text` at `0x100000`, so `percent_change` sits at `0x100000` and `grade` at `0x100010`.

The pseudocode for `percent_change` is where the `long` came from:

```c
undefined1  [16] percent_change(int param_1,int param_2,ulong param_3)
{
  long lVar1;
  undefined1 auVar3 [16];
  if (param_1 != 0) {
    lVar1 = (long)((param_2 - param_1) * 100);
    auVar3._0_8_ = lVar1 / (long)param_1 & 0xffffffff;
    auVar3._8_8_ = lVar1 % (long)param_1 & 0xffffffff;
    return auVar3;
  }
  ...
}
```

The decompiler saw `cltd` and `idivl` write both `edx` and `eax` and modelled a 16-byte return value with a 64-bit division. The listing in the same record says something plainer:

```
0x100000: TEST EDI, EDI
0x100002: JZ 0x0010000d
0x100004: SUB ESI, EDI
0x100006: IMUL EAX, ESI, 0x64
0x100009: CDQ
0x10000a: IDIV EDI
0x10000c: RET
0x10000d: XOR EAX, EAX
0x10000f: RET
```

Every operation is 32 bits wide. `IMUL EAX, ESI, 0x64` multiplies in 32 bits and keeps the low half. `CDQ` sign-extends `eax` into `edx`, and `IDIV EDI` divides the 64-bit pair by a 32-bit divisor. A rebuild that follows the listing is `100 * (after - before) / before` in `int`.

The `grade` record has the same shape. The pseudocode names a table, `*(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4)`, and an unreadable default expression built from `0x66666667`. The listing shows the divide by 10 as `IMUL RAX, RAX, 0x66666667`, `SAR RCX, 0x22`, `SHR RAX, 0x3f`, `ADD ECX, EAX`. Then `ADD ECX, -0x6`, `CMP ECX, 0x4`, and `JA` keep tens from 6 to 10. `XOR EAX, EAX` before the compare is the default of 0. `LEA RCX, [0x1000b4]` and `MOV EAX, dword ptr [RCX + RAX*0x4]` read a table of five 4-byte entries.

Step 4 read those 20 bytes: `01000000 02000000 03000000 04000000 04000000`. The table is `1, 2, 3, 4, 4` for tens 6, 7, 8, 9, 10. That is the `switch` in `ledger.c`, with `case 10` and `case 9` sharing the value 4.

Both proofs in rea's own evidence pages started from the listing and from `read_bytes` of constants. The DX-Ball first pseudocode was `FUN_00406400(void)` with no stack input, and the instruction view corrected it. Read the listing first. Cite the record id, then write the C.

## Write the Candidates

The folder `code/fixtures/candidates/` holds eight rebuilds, one function per file. Four follow the listing or compile to the same code. Four are plausible and wrong, or wrong in a way one hand-written test finds.

| File | Source | What it does |
|---|---|---|
| `percent_change_mul_first.c` | `100 * (after - before) / before` | the listing in C |
| `percent_change_split.c` | `(after * 100 - before * 100) / before` | different text, same bytes after clang folds it |
| `percent_change_wide.c` | `(int)(((long)after - before) * 100 / before)` | the pseudocode's `long`, divides before it wraps |
| `percent_change_div_first.c` | `(after - before) / before * 100` | divides first, so rounding differs |
| `grade_switch.c` | `switch (score / 10)` with the five cases | the original source |
| `grade_table.c` | `unsigned slot = score / 10 - 6; slot < 5 ? points[slot] : 0` | the listing in C |
| `grade_thresholds.c` | `if (score >= 90) return 4; ...` | no upper bound on the top band |
| `grade_case10_wrong.c` | `case 10: return 3;` | one table entry wrong |

Each file compiles with the fixture command, `clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c`. The compiled objects are committed beside the sources so the tests run on a host without clang.

## Leg One: Execute and Compare

McKeeman's 1998 definition of differential testing needs "two or more comparable systems" fed "mechanically generated test cases", and treats a different result, a hang, or a crash as a bug candidate. He named the hard part: "The ugliest problem in testing is evaluating the result of a test." The original function is the oracle here. We do not need to know the right answer. We need the original and the rebuild to disagree nowhere on a grid that reaches every hazard.

### Design the grid

`input_grid()` in `code/main.py` builds 92 cells. For `percent_change` it takes every pair from ten `before` values and seven `after` values:

```
before: 0, 1, -1, 3, -3, 7, 100, -100, 2147483647, -2147483648
after:  0, 5, -5, 105, 536870911, 2147483647, -2147483648
```

For `grade` it takes 22 scores: both sides of each band edge, negatives, 0, 110, and the two `int` limits. `classify()` tags each cell. Overflow has 32 cells, negative 17, boundary 14, plain 12, and zero guard 7. Negative truncation has 5, rounding 2, beyond the switch 2, and trap 1.

Each class exists for one reason. The zero guard cells check the `TEST EDI, EDI` branch. Negative cells check truncating division: C and `idiv` round toward zero, so `-9 / 10` is 0 and `-10 / 10` is -1. Rounding cells check that the multiply happens before the divide, so `(105 - 100) * 100 / 100` is 5 and not 0. Overflow cells make `(after - before) * 100` exceed 32 bits. The one trap cell makes the wrapped product equal `INT_MIN` with `before` equal to -1.

Yang, Chen, Eide, and Regehr built Csmith to generate programs with no undefined behaviour. An oracle disagreement on undefined behaviour is noise and never a bug report. Signed overflow is undefined in C. Our oracle is a compiled object with one fixed behaviour, so overflow cells are in scope. The lesson is to know which cells rest on the standard and which rest on the compiled bytes.

### The driver and the trap

`code/driver.c` reads one cell per line from stdin and prints the inputs, the original result, and the rebuild result. `build_harness()` compiles the candidate with `-Dpercent_change=cand_percent_change -Dgrade=cand_grade`, so both versions link into one program under different names. On an x86-64 Linux host the original is the fixture object itself. On any other host it is `ledger.c` compiled natively, and the report records `original_kind: fixture-source`.

The driver installs a `SIGFPE` handler with `sigsetjmp` and `siglongjmp`. For `before = -1` and `after = 536870911`, the difference is 536870912 and the 32-bit product wraps to -2147483648. On x86-64, `idiv` with that dividend and a divisor of -1 raises the divide error exception. The quotient does not fit in 32 bits (Intel SDM Volume 2, IDIV). The handler turns that into the recorded value `trap`.

On AArch64, `sdiv` has no trap and returns -2147483648 for the same operands. Our run on an arm64 Mac recorded exactly that. The oracle depends on the architecture, and the report says which one ran.

### Results

`prove_behaviour(PLAUSIBLE)` builds the `long` rebuild and the threshold rebuild. The ten naive cases pass. The grid fails on 28 cells:

| Function | Inputs | Class | Original | Rebuild |
|---|---|---|---|---|
| `percent_change` | 3, 2147483647 | overflow | -133 | -1431655899 |
| `percent_change` | 100, 2147483647 | overflow | -101 | 2147483547 |
| `percent_change` | 2147483647, 5 | overflow | 0 | -99 |
| `grade` | 110 | beyond the switch | 0 | 4 |
| `grade` | 2147483647 | beyond the switch | 0 | 4 |

All 26 `percent_change` failures are overflow cells with `|before| > 1`. For `before` equal to 1 or -1 the 64-bit quotient truncates back to the wrapped value, so those cells agree by accident. The threshold `grade` fails because the original switch has no case for tens of 11 and above, and `110 / 10` is 11.

`prove_behaviour(EQUAL)` builds `percent_change_mul_first.c` and `grade_switch.c`. All 92 cells agree. `percent_change_div_first.c` fails two of the four naive cases, which is the one case a hand-written test does find.

`oracle_disagreements()` checks a second thing. `percent_change_model()` and `grade_model()` are Python models of the listing, with `wrap32()` for the 32-bit multiply and `idiv32()` for the architecture rule. The report compares the model with the observed original on every cell. Zero disagreements means the model and the binary agree on every cell. The model is derived evidence and the run is observed evidence. The report keeps them in separate fields.

## Leg Two: Recompile and Compare

Behaviour on a grid is one leg. The second leg asks whether the rebuild, compiled with the same compiler and flags, produces the same bytes. The DX-Ball project reported "63 matching bytes" for its helper. The TH04 project reported a 2,139-byte match. Each used the compiler of its own period. rea itself cannot do this. Its `compare_functions` line-diffs provider text and attaches the limitation "Assembly is opaque provider text; relocation normalization is unavailable."

### Read the object

`ElfObject` in `code/main.py` reads one ELF64 relocatable object with `struct.unpack_from`. It checks the magic, the 64-bit class, little-endian data, `e_machine` 62, and `e_type` 1. Then it walks the section headers, the string table, `.symtab`, and every `.rela` section. In the fixture, `percent_change` starts at `.text` offset 0 with size 16 and `grade` at `0x10` with size 46. `total` starts at `0x40` with size 31 and `grade_label` at `0x60` with size 63.

The 16 bytes of `percent_change` are `85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3`. The function has no relocations. `grade` has one: offset `0x26` inside the function, type `R_X86_64_PC32`, symbol `.rodata`, addend `0x10`. It belongs to the 7-byte `leaq` at offset `0x23`, whose last four bytes are the displacement field.

### Mask, then compare the records

In a RELA object the addend lives in the relocation record, and the four field bytes are zero. The candidate `grade_switch.o` also holds zero there. A plain byte compare passes while the two relocations name different places. `mask_relocations()` zeroes the field on both sides anyway, so the same method holds for REL objects and for Mach-O, where the field carries the addend.

Then `prove_bytes()` compares the relocation records by offset, type, and target section. The original says `.rodata+0x10` and the candidate says `.rodata-0x4`. The addend differs because the candidate object has no `labels.rel` table in front of its switch table. A different addend is a different offset, not a different function.

### Read the constants the relocation points at

For a PC-relative field that ends its instruction, the CPU adds the next instruction address, so the target is symbol plus addend plus 4. In the original that is `.rodata+0x14`, and in the candidate it is `.rodata+0x0`. `read_table()` reads five 4-byte entries there. Both hold `1, 2, 3, 4, 4`.

The count five comes from the listing: `CMP ECX, 0x4` with `JA` admits indexes 0 to 4, and `[RCX + RAX*0x4]` reads 4 bytes per index. `CLAIMS` in `code/main.py` records that shape for `grade` and records zero relocations for `percent_change`.

This step exists because of a bug the TH08 project documented. Its older comparison "replayed the target address into the instruction's relocation field, then compared instruction bytes without checking the floating-literal data at that address. Source `0.0` could therefore appear exact against target `128.0`." The fix audited 1,548 floating-literal references and corrected twelve more. `grade_case10_wrong.c` is our version of that bug. Its 46 code bytes equal the original, its relocation record has the same shape, and its table is `1, 2, 3, 4, 3`. Only the constant check fails it.

### Results

| Candidate | Size | Masked bytes | Relocation records | Table | Status |
|---|---|---|---|---|---|
| `percent_change_mul_first` | 16 vs 16 | equal | none | none | pass |
| `percent_change_split` | 16 vs 16 | equal | none | none | pass |
| `percent_change_wide` | 16 vs 26 | size differs | none | none | fail |
| `percent_change_div_first` | 16 vs 18 | size differs | none | none | fail |
| `grade_switch` | 46 vs 46 | equal | same shape | `1,2,3,4,4` both | pass |
| `grade_table` | 46 vs 46 | equal | same shape | `1,2,3,4,4` both | pass |
| `grade_thresholds` | 46 vs 39 | size differs | 1 vs 0 | none | fail |
| `grade_case10_wrong` | 46 vs 46 | equal | same shape | `1,2,3,4,4` vs `1,2,3,4,3` | fail |

Two results deserve a second look. `percent_change_split.c` has different source text and identical bytes, because clang treats signed overflow as undefined and folds `after * 100 - before * 100` into one multiply. `grade_table.c` also matches byte for byte, so the compiler reached the same table from an array index and from a `switch`. A byte match proves that this compiler, with these flags, produced the same code from the candidate. It does not prove the candidate is the original source text.

Size is a diagnostic and not an acceptance. rea's evidence pages record a 1,825-byte candidate with the right length and 467 differing bytes. The `wide` rebuild is 26 bytes because `movslq`, `imulq`, `cqto`, and `idivq` replaced the 32-bit forms. The listing had told us the width before any compile.

## The Agent Loop Over rea

Sixty-five of rea's MCP tools have no CLI command, and `verify_reconstruction` is one of them. `McpStdioClient` in `code/main.py` is the smallest client that reaches them. It starts `npx -y rea-agents@6.5.0 mcp`, writes one JSON-RPC request per line to stdin, and reads one JSON object per line from stdout on a thread. It sends `initialize` with protocol version `2025-11-25`, then `notifications/initialized`, then `tools/call`. The default deadline per call is 330 s, the same number rea allows for a Ghidra cold start.

`agent_loop()` makes the six calls and records each one:

```json
{
  "step": 2,
  "tool": "analyze_function",
  "arguments": {"procedure": "percent_change"},
  "seconds": 6.31,
  "is_error": false,
  "evidence_id": "ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd",
  "confidence": "observed",
  "authority": "shipped-artifact",
  "limitations": ["Resolved reference metadata identifies computed, indirect, external, call, jump, and data edges; unresolved targetless flows remain unknown, and function classifications distinguish thunks and externals.", "..."],
  "result_sha256": "..."
}
```

The complete Evidence records are stored under their ids in the same file. The pseudocode and the listing the rebuild came from are part of the fixture. `table_address()` finds the `LEA` operand in the `grade` listing and feeds it to `read_bytes`. `open_binary`, `get_evidence_bundle`, and `close_binary` return no Evidence record and are recorded with a null id.

`run_agent(live=True)` drives rea when `npx` is on the path and `GHIDRA_INSTALL_DIR` names a directory. Otherwise it replays the fixture and says so on stderr. The tests go one step further. `code/tests/fake_rea_server.py` is a stand-in server that answers each `tools/call` with the recorded record for the same tool and arguments. The client and the loop run against it on every test run, with no rea, Ghidra, or Java installed.

### What rea's verifier can and cannot say

rea's `verify_reconstruction` takes claims that point at comparison Evidence and returns pass, fail, or unknown per claim. Its fixed limitation reads "Pass means every declared claim passed; it does not establish global implementation equivalence." A claim about a function compares provider text from `compare_functions`. A behavioural claim compares two recorded process captures from `compare_process_captures`. When a source record has incomplete call coverage, a claim about calls is `unknown`. Nothing inside rea compiles a rebuilt function or runs it over your input grid. The two legs in this lesson are the part rea leaves to you.

rea's obligation ledger expects a proof record with `predicate_type: "rea.reconstruction-proof"`, `operation: "verify_reconstruction_obligations"`, `confidence: "observed"`, and `normalized_result.passed === true`. No public rea tool emits one. `build_proof()` in `code/main.py` mints it:

```json
{
  "predicate_type": "rea.reconstruction-proof",
  "operation": "verify_reconstruction_obligations",
  "confidence": "observed",
  "authority": "controlled-replay",
  "normalized_result": {
    "passed": true,
    "status": "pass",
    "claims": [
      {"claim_id": "percent_change.behaviour", "kind": "behavioral", "status": "pass", "evidence_ids": ["ev_e88b10dc..."]},
      {"claim_id": "grade.behaviour", "kind": "behavioral", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]},
      {"claim_id": "percent_change.bytes", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_e88b10dc..."]},
      {"claim_id": "grade.bytes", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]},
      {"claim_id": "grade.referenced-constants", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]}
    ]
  },
  "evidence_links": ["ev_e88b10dc...", "ev_67b6d3f9..."],
  "evidence_id": "ev_..."
}
```

The id is `ev_` plus the SHA-256 of the record without the id, over sorted-key compact JSON. `aggregate()` is fail-closed: `fail` wins, then `unknown`, and an empty claim list is `unknown`. On a host without a C compiler the two behaviour claims are `unknown`, so the record says `unknown` even when both byte claims pass. `authority` is `controlled-replay`, because the proof comes from our own harness and not from the object file alone.

## What the Research Says

Liu, Raff, and Micinski measured eight decompilation systems in nine configurations in 2026. Candidates that passed every test the benchmark includes still diverged on fuzzed inputs. The rate was 4.9 percent overall and up to 13 percent for one system. On 300 GitHub library functions and 287 CVE-grounded functions, the strongest refinement model raised Ghidra's build rate from 75 percent to 90 percent. Over the same functions the behavioural match rate fell from 74 percent to 62 percent. They traced the cause to invented fields, types, callees, and guards that replaced the visible unknowns a traditional decompiler leaves behind.

Our `percent_change_wide.c` is one of those invented types. The pseudocode offered a `long`, the rebuild kept it, and the result compiled, passed ten tests, and failed 26 overflow cells. The grade-threshold rebuild is an invented guard. Both would count as re-executable under the LLM4Decompile metric, which recompiles the output and runs the benchmark's assertions. Ghidra's own pseudo-C passed 20.12 percent of those assertions on HumanEval-Decompile.

DecompileBench measured 23,400 functions from 130 real programs. It found LLM methods 52.2 percent lower on functionality correctness than industrial decompilers, with higher understandability scores.

The three proofs the field uses are the three legs you can build. Phoenix and DREAM recompile the output and run the original program's tests. McKeeman and Csmith run generated inputs against the original with inputs kept inside defined behaviour. Ramos and Engler check two C functions with bounded symbolic execution, which proves equality on all explored paths up to an input size. This lesson builds the first two. The third is the practice lab in lesson 35's evidence ledger when a grid is too small to trust.

## Build It

Run the standard-library harness:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/main.py
```

With clang on the path, the demo compiles both candidate pairs and runs 92 cells for each. It recompiles eight candidates, replays the agent run, and mints the proof record. Without clang it reads the committed objects and reports the behaviour claims as `unknown`.

Expected shape on an arm64 Mac:

```json
{
  "host": "aarch64 Darwin",
  "originalKind": "fixture-source",
  "gridCells": 92,
  "plausible": {"naivePassed": true, "gridMismatches": 28, "oracleDisagreements": 0},
  "equal": {"naivePassed": true, "gridMismatches": 0, "oracleDisagreements": 0},
  "legTwo": {
    "percent_change_mul_first": {"status": "pass", "reasons": []},
    "percent_change_wide": {"status": "fail", "reasons": ["size 16 vs 26 bytes"]},
    "grade_case10_wrong": {"status": "fail", "reasons": ["referenced constants differ: [1, 2, 3, 4, 4] vs [1, 2, 3, 4, 3]"]}
  },
  "agentRun": {"mode": "replayed fixture", "server": {"name": "rea", "version": "6.5.0", "protocolVersion": "2025-11-25"}},
  "proof": {"status": "pass", "evidence_id": "ev_..."}
}
```

Read `code/main.py` in this order:

1. `wrap32()`, `c_div()`, `idiv32()`, and the two `*_model()` functions hold the integer semantics of the listing.
2. `input_grid()` and `classify()` build and tag the 92 cells.
3. `build_harness()` and `execute()` compile one program from the original, the renamed candidates, and `driver.c`, then run the cells.
4. `prove_behaviour()` returns the leg-one report with mismatches and model disagreements.
5. `ElfObject` reads headers, symbols, and `.rela` records. `mask_relocations()` and `read_table()` prepare the compare.
6. `prove_bytes()` returns the leg-two report with sizes, masked ranges, relocation shape, and tables.
7. `McpStdioClient` and `agent_loop()` drive rea and record each step.
8. `build_proof()` and `aggregate()` mint the fail-closed record.

## Use It

To prove a new function equal, repeat these steps:

1. Fetch `analyze_function` for the function and record the evidence id. Read the listing before the pseudocode.
2. Write the candidate from the listing's operation widths. Keep the original's function name.
3. List every multiply, add, subtract, and divide in the listing. Add grid inputs that wrap each one at its width.
4. Add both sides of every compare constant in the listing. For `grade` those were 6 and 4 after the subtract.
5. Add every divisor that can trap on the target, and record which architecture ran the grid.
6. Run both legs and read the reasons before the status.
7. Keep the proof record beside the candidate. Its `evidence_links` tell a reader which records the claim rests on.

Rerun both legs after any compiler update. A byte match is a statement about one compiler with one set of flags.

## Interactive Lab

### Lab A: the model and the run

From the `code` directory, open Python:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal/code
python3 -q
```

Run:

```python
from main import *
percent_change_model(3, INT_MAX)
percent_change_model(-1, 536870911, "x86_64")
percent_change_model(-1, 536870911, "aarch64")
report = prove_behaviour(PLAUSIBLE)
report.naive_passed, len(report.mismatches), report.mismatches[0]
```

The first call gives -133, the wrapped product divided by 3. The second gives `'trap'` and the third gives -2147483648. The report shows ten naive cases passed and 28 grid cells failed. Compare `report.oracle_disagreements` with an empty list.

### Lab B: read the object

```python
obj = ElfObject(ORIGINAL_OBJECT)
grade = obj.function("grade")
grade.size, grade.data[0x26:0x2a].hex(), grade.relocations
read_table(obj, grade.relocations[0], 5, 4)
```

The field bytes are `00000000`. The relocation names `.rodata` with addend `0x10`, and the table reads `[1, 2, 3, 4, 4]`.

### Lab C: break one constant

```python
report = prove_bytes("grade", CANDIDATES / "grade_case10_wrong.o")
report.masked_equal, report.relocations_match, report.tables_equal, report.reasons()
```

The bytes match, the records match, and the tables do not. Now edit `grade_case10_wrong.c` so `case 10` returns 4 again, recompile it with the fixture command, and watch the status change to `pass`.

### Lab D: drive rea

With rea 6.5.0 and Ghidra 12.1.4 installed:

```bash
GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec \
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
python3 code/main.py --live
```

The first `analyze_function` takes several seconds while Ghidra imports the object. Compare the new evidence ids with the committed run. The same bytes under the same analysis profile give the same ids, because the id is a content hash that excludes the file path.

## Practice Lab

Extend both legs to `total` and `grade_label` from the same object.

Requirements:

- For `total`, the input is an array and a count. Build cells with count 0, a negative count, one element, and sums that wrap at 32 bits.
- For `grade_label`, the function calls `grade` inline and reads `labels.rel`, a table of five relative string offsets with their own relocations in `.rela.rodata`.
- Add a `CLAIMS` entry for `grade_label` with two relocations and a table of five 4-byte entries, and compare the strings the entries point at.
- Record which cells the model and the run disagree on, if any, and explain each one from the listing.
- Add one claim per leg per function to the proof record and keep the aggregate fail-closed.

Success means the proof record lists four functions, every claim carries an evidence id, and `grade_label` fails when one label string differs.

## Graded Lab

Five questions about the fixtures of this lesson. Find each answer with the code you built, then write it into `code/lab_answers.json`. Write numbers as numbers or as hex strings such as `"0x40"`, and lists as JSON lists.

1. `t1`: percent_change_model(3, 105) on x86_64.
2. `t2`: percent_change_model(0, 5) on x86_64.
3. `t3`: grade_model(100).
4. `t4`: the number of cells in input_grid().
5. `t5`: the number of grid cells where the x86_64 model traps.

Check your answers:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/lab.py
```

The checker computes each expected value from `code/main.py` on the committed fixtures. It prints `PASS`, `FAIL` or `TODO` for each task and a score, and it exits 0 only when all five pass. `python3 code/lab.py my-answers.json` checks another file. `code/tests/test_lab.py` proves that the checker accepts the right answers and rejects a wrong one.

### See it run

The [Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler) machine ends with pseudocode and files it as inferred: the page does not prove it. This lesson is the step that turns that claim into a checked one.

## Output Skill

This lesson produces `outputs/skill-rebuild-and-prove-equal.md`. Use it to turn function evidence and a candidate rebuild into a two-legged proof and a proof record. The skill requires the listing before the pseudocode, a grid with every hazard class, relocation masking plus a constant check, and a fail-closed aggregate.

## Verify It

Run the demo and the test suite:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

The 35 tests prove:

- `c_div()` truncates toward zero and `wrap32()` follows two's complement
- the model gives -133 for `(3, INT_MAX)`, `trap` for the trap cell on x86-64, and -2147483648 on AArch64
- the grid has 92 cells and every hazard class, and the naive cases avoid every hard class
- the ELF reader finds four functions at the recorded offsets and sizes
- `percent_change` is 16 bytes with no relocations and `grade` has one `R_X86_64_PC32` at `0x26`
- the relocation field bytes are zero and masking changes nothing in this RELA object
- all eight committed candidates reach the expected status, with the recorded reasons
- `grade_case10_wrong` passes masked bytes and fails only the constant check
- the recorded leg-one runs show ten naive passes, 28 mismatches, and zero model disagreements
- with a compiler, both pairs rebuild and rerun with the same outcome
- the agent run targets the committed object by SHA-256, in order, with `ev_` ids on every Evidence step
- the `read_bytes` record equals the table the ELF reader finds
- the client drives the fake server and records the same evidence ids as the real run
- an error result from the server goes into the run record
- `aggregate()` is fail-closed and the proof id recomputes from its content

## Production Failure Modes

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Rebuild keeps the decompiler's `long` | "ten tests pass" | 26 overflow cells differ from the original |
| Thresholds replace a switch | "every grade band passes" | 110 and larger return 0 in the original |
| Divide before multiply | "formula is algebraically equal" | rounding cells differ, naive cases fail |
| Trap cell skipped | "no crashes" | x86-64 raises `#DE`, AArch64 returns `INT_MIN`, the report names the host |
| Byte compare without masking | "bytes equal" | relocation records name different offsets |
| Masking without reading constants | "bytes equal after masking" | `1,2,3,4,3` differs from `1,2,3,4,4` |
| Size taken as acceptance | "same length" | differing bytes inside the same length |
| Different compiler or flags | "bytes differ, rebuild wrong" | the same source gives different bytes, so the compare is void |
| Model treated as observation | "model agrees" | the run is observed, the model is derived, disagreements are listed |
| Claim without evidence id | "verified" | every claim links an `ev_` record of the function it covers |
| No compiler on the CI host | "passed" | behaviour claims are `unknown` and the aggregate is `unknown` |
| Pseudocode read as source | "decompiler says long" | the listing shows `IMUL EAX`, `CDQ`, `IDIV EDI` |

## Operational Rule

Write the rebuild from the listing and name the record it came from. Run it against the original over a grid that wraps every intermediate and crosses every compare constant. Recompile it with the original flags, mask the relocation fields, compare the records, and read the constants they point at. Record each claim with its evidence id, and let an unverified claim stay unknown.

## Further Reading

- [McKeeman, Differential Testing for Software, Digital Technical Journal 10(1), 1998](https://www.cs.tufts.edu/comp/150FP/archive/bill-mckeeman/DifferentailTesting.pdf)
- [Yang, Chen, Eide, Regehr, Finding and Understanding Bugs in C Compilers, PLDI 2011](https://doi.org/10.1145/1993498.1993532)
- [Ramos, Engler, Practical, Low-Effort Equivalence Verification of Real Code, CAV 2011](https://doi.org/10.1007/978-3-642-22110-1_55)
- [Schwartz, Lee, Woo, Brumley, Native x86 Decompilation Using Semantics-Preserving Structural Analysis, USENIX Security 2013](https://www.usenix.org/conference/usenixsecurity13/technical-sessions/presentation/schwartz)
- [Liu, Raff, Micinski, When LLM Decompilers Recompile More and Preserve Less, arXiv 2609.05370, 2026](https://arxiv.org/abs/2609.05370)
- [Gao et al., DecompileBench, Findings of ACL 2025](https://aclanthology.org/2025.findings-acl.1194/)
- [Tan et al., LLM4Decompile, arXiv 2403.05286, 2024](https://arxiv.org/abs/2403.05286)
- [System V gABI, Chapter 4, Relocation](https://www.sco.com/developers/gabi/latest/ch4.reloc.html)
- [x86-64 psABI repository, relocation types](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 2, IDIV](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Arm Architecture Reference Manual for A-profile, DDI 0487, SDIV](https://developer.arm.com/documentation/ddi0487/latest)
- [rea 6.5.0 MCP contracts](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/mcp-contracts.md)
- [rea 6.5.0 reconstruction obligation ledgers](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/reconstruction-obligation-ledgers.md)
