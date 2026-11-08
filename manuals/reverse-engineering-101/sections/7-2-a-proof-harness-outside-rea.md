# A proof harness beyond compare_functions

> compare_functions line-diffs Ghidra text, so equality of a rebuilt function needs a harness that runs both over an input grid and compares bytes after masking relocations.

You rebuilt `percent_change` from the pseudocode in [Section 4.6](#s-analyze-function-and-pseudocode), kept the `long` the decompiler offered, and ten hand-written tests pass. [Section 7.1](#s-verify-reconstruction) showed that rea can only tell you whether two Ghidra texts match. The proof that your rebuild equals the original has to come from a harness you run yourself. [Lesson 36](phases/13-tools-and-protocols/36-rebuild-and-prove-equal) builds one in the Python standard library.

The capture kit ran that harness over `ledger-x86_64-O1.o` and recorded four files under `17-`. When you finish this section, you can run both legs of the harness over your rebuild and read the mismatch rows and the byte report. You can then say which hazard class or which relocation each failure names.

## What compare_functions can see

`compare_functions` compares two `analyze_function` records in eight dimensions: `identity`, `pseudocode`, `assembly`, `comments`, `calls`, `references`, `strings_names`, and `cfg` ([the capture](manuals/reverse-engineering-101/capture/out/10-mcp-20-compare-functions-percent-change.json)). The pseudocode and assembly dimensions are a bounded line diff of two strings. The status is `unknown` when the diff takes more than 100 ms or more than 10,000 edits. The assembly dimension carries two fixed limitations:

```listing
title: the assembly dimension of the percent_change comparison
source: capture/out/10-mcp-20-compare-functions-percent-change.json
lang: json
note: One of the eight dimension objects. The counts are characters of provider text. The digests and the text delta are cut.
---
              "dimension": "assembly",
              "left_count": 161,
              "right_count": 161,
              "evidence_links": [
                "ev_b492c85e…",
                "ev_142cc943…"
              ],
              "limitations": [
                "Exact provider text is compared without address or generated-name normalization; layout-only differences do not establish a behavior change.",
                "Assembly is opaque provider text; relocation normalization is unavailable."
              ],
              "status": "unchanged",
```

For `total` the same comparison reported `changed` in five dimensions ([the capture](manuals/reverse-engineering-101/capture/out/10-mcp-21-compare-functions-total.json)). The pseudocode grew from 300 to 2,904 characters and the assembly from 336 to 1,866. The two records came from one source line compiled at `-O1` and `-O2`. A text comparison therefore says nothing about behaviour in either direction. The same function can print as different text, and a wrong function can print as the same text.

rea 6.7.0 has no compiler replay and no relocation-aware byte comparison. The two legs below are the part rea leaves to you.

## Leg one: execute and compare

**Input grid:** the list of input cells the harness feeds to the original and to the rebuild. Each class of cells stands for one hazard the listing shows. The lesson's `input_grid()` takes every pair of ten `before` values and seven `after` values for `percent_change`, and 22 scores for `grade`, 92 cells in all. Each cell has a class, and the class says why it exists.

```listing
title: the 92 cells by hazard class
source: capture/out/17-harness-grid.json
lang: json
note: The input values and the ten naive cases are cut.
---
{
  "cells": 92,
  "classes": {
    "overflow": 32,
    "negative": 17,
    "boundary": 14,
    "plain": 12,
    "zero guard": 7,
    "negative truncation": 5,
    "beyond the switch": 2,
    "rounding": 2,
    "trap": 1
  },
  …
}
```

The zero guard cells take the `before == 0` branch. The negative cells check that division truncates toward zero, so `-9 / 10` is 0 and `-10 / 10` is -1. The rounding cells check that the multiply happens before the divide. The overflow cells make `(after - before) * 100` exceed 32 bits. The one trap cell makes the wrapped product equal `INT_MIN` with `before` equal to -1.

For `grade`, the boundary cells sit on both sides of 60, 70, 80, 90, and 100. The two cells beyond the switch are 110 and `INT_MAX`.

The harness compiles `ledger.c` and one candidate per function into one program with the lesson's `driver.c`. The candidate is renamed with `-Dpercent_change=cand_percent_change -Dgrade=cand_grade`, so both versions link under different names. The driver reads one cell per line, prints both results, and turns a `SIGFPE` into the value `trap`.

The ELF object cannot run on the Mac that recorded the capture. The oracle there is `ledger.c` compiled natively at `-O1`, and the report says so in `original_kind: fixture-source`. The capture ran two pairs. The plausible pair is `percent_change_wide.c`, the pseudocode's `long`, with `grade_thresholds.c`, four `if` statements on 90, 80, 70, and 60:

```c
int percent_change(int before, int after) {
    if (before == 0) return 0;
    return (int)(((long)after - before) * 100 / before);
}
```

```listing
title: the plausible pair over the grid
source: capture/out/17-harness-execute-plausible.json
lang: json
note: 26 of the 28 mismatch rows are cut, and the 92 result rows are cut.
---
  "candidates": {
    "percent_change": "phases/13-tools-and-protocols/36-rebuild-and-prove-equal/code/fixtures/candidates/percent_change_wide.c",
    "grade": "phases/13-tools-and-protocols/36-rebuild-and-prove-equal/code/fixtures/candidates/grade_thresholds.c"
  },
  "original": "fixtures/ledger.c compiled with the host clang at -O1",
  "original_kind": "fixture-source",
  "host": "aarch64 Darwin",
  "arch": "aarch64",
  "naive_passed": true,
  "cells": 92,
  "mismatches": [
    {
      "function": "percent_change",
      "args": [
        3,
        2147483647
      ],
      "kind": "overflow",
      "original": -133,
      "candidate": -1431655899,
      "match": false
    },
    …
    {
      "function": "grade",
      "args": [
        110
      ],
      "kind": "beyond the switch",
      "original": 0,
      "candidate": 4,
      "match": false
    },
    …
  ],
```

All ten naive cases pass, and 28 of the 92 cells fail. The 26 `percent_change` failures are all overflow cells with `|before| > 1`. The original wraps the product to 32 bits and then divides, and the `long` rebuild divides the unwrapped product. For `before` equal to 1 or -1 the two agree by accident, because the 64-bit quotient truncates back to the wrapped value. The two `grade` failures are 110 and `INT_MAX`. The original switch has no case for tens of 11 and above and returns 0, and the threshold rebuild returns 4.

The equal pair is `percent_change_mul_first.c`, which is `100 * (after - before) / before`, with `grade_switch.c`, the original source. It agrees on all 92 cells and the model of the listing disagrees with the observed original on none ([the capture](manuals/reverse-engineering-101/capture/out/17-harness-execute-equal.json)). One row of that file deserves a look:

```listing
title: the trap cell on an arm64 host
source: capture/out/17-harness-execute-equal.json
lang: json
note: One of the 92 rows.
---
    {
      "function": "percent_change",
      "args": [
        -1,
        536870911
      ],
      "kind": "trap",
      "original": -2147483648,
      "candidate": -2147483648,
      "match": true
    },
```

The difference is 536870912, the 32-bit product wraps to -2147483648, and the divisor is -1. On x86-64 `IDIV` raises the divide error exception, because the quotient does not fit in 32 bits {{spec Intel SDM Vol. 2, IDIV}}. On AArch64 `SDIV` has no trap and returns -2147483648 {{spec Arm DDI 0487, SDIV}}. The report records `"arch": "aarch64"` with the row, and a run of the same grid on a Linux x86-64 host records the string `trap` instead. The oracle depends on the architecture, so a proof names the host that ran it.

## Leg two: recompile and compare bytes

**Relocation masking:** zeroing the bytes of every relocation field in both functions before comparing them. The two steps that follow compare the relocation records by offset, type, and target section, then read the bytes each relocation points at. The lesson's `ElfObject` reads the ELF64 object with `struct.unpack_from`, and `mask_relocations()`, `prove_bytes()`, and `read_table()` do the three steps. Without the first step a plain byte compare rejects a correct rebuild whose table sits at another offset. Without the third step it accepts a wrong one.

```listing
title: grade in the original object
source: capture/out/17-harness-bytes.json
lang: json
note: One of the four function entries. The start is the offset inside .text.
---
      "grade": {
        "section": ".text",
        "start": 16,
        "size": 46,
        "bytes": "4863c74869c0676666664889c148c1f92248c1e83f01c183c1fa31c083f904770c89c8488d0d000000008b0481c3",
        "relocations": [
          {
            "offset": 38,
            "type": "R_X86_64_PC32",
            "symbol": ".rodata",
            "addend": 16
          }
        ]
      },
```

`grade` is 46 bytes with one `R_X86_64_PC32` relocation at offset 38, the displacement of the `lea` that loads the table address. In a RELA object the addend lives in the record and the four field bytes are zero. The hex above shows them as `00000000` before `8b0481c3`. The target is `.rodata+0x10`, and because the field ends its instruction the CPU adds 4, so the table starts at `.rodata+0x14`. Each candidate was compiled with `clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c`, the fixture command, and compared with this entry.

```listing
title: a wrong constant passes the masked compare
source: capture/out/17-harness-bytes.json
lang: json
note: One of the eight candidate entries. The source path, the differing offsets, the masked ranges, and the two tables are cut, and the reasons line prints both tables.
---
      "candidate": "grade_case10_wrong",
      …
      "original_size": 46,
      "candidate_size": 46,
      "masked_equal": true,
      …
      "relocations_match": true,
      "relocations": [
        {
          "offset": 38,
          "type": "R_X86_64_PC32",
          "original_target": ".rodata+0x10",
          "candidate_target": ".rodata-0x4",
          "same_shape": true
        }
      ],
      …
      "status": "fail",
      "reasons": [
        "referenced constants differ: [1, 2, 3, 4, 4] vs [1, 2, 3, 4, 3]"
      ]
```

`grade_case10_wrong.c` returns 3 for `case 10`. Its 46 code bytes equal the original after masking, and its one relocation has the same offset, type, and section. Only the five table entries differ.

The addends differ in every `grade` candidate, `+0x10` against `-0x4`. The original object holds the `labels` table of `grade_label` in `.rodata` before the switch table, and the candidate object does not. A different addend is a different offset, so the harness compares the shape of the record and then reads the table through it. Both tables read `1, 2, 3, 4, 4` for the two correct rebuilds.

| Candidate | Source text | Size | Masked bytes | Relocation records | Table | Status |
|---|---|---|---|---|---|---|
| `percent_change_mul_first` | `100 * (after - before) / before` | 16 and 16 | equal | none | none | pass |
| `percent_change_split` | `(after * 100 - before * 100) / before` | 16 and 16 | equal | none | none | pass |
| `percent_change_wide` | the pseudocode's `long` | 16 and 26 | size differs | none | none | fail |
| `percent_change_div_first` | `(after - before) / before * 100` | 16 and 18 | size differs | none | none | fail |
| `grade_switch` | the original `switch` | 46 and 46 | equal | same shape | `1, 2, 3, 4, 4` on both sides | pass |
| `grade_table` | `points[slot]` with a bound check | 46 and 46 | equal | same shape | `1, 2, 3, 4, 4` on both sides | pass |
| `grade_thresholds` | four `if` statements | 46 and 39 | size differs | 1 against 0 | none | fail |
| `grade_case10_wrong` | `case 10: return 3;` | 46 and 46 | equal | same shape | `1, 2, 3, 4, 4` against `1, 2, 3, 4, 3` | fail |

Two rows say what a byte match means. `percent_change_split.c` has different source text and identical bytes, because clang treats signed overflow as undefined and folds the two multiplies into one. `grade_table.c` reaches the same table from an array index as the original does from a `switch`. A match proves that this compiler with these flags produced the same code from the candidate. It does not prove that the candidate is the original text.

Size is a diagnostic and never an acceptance. `percent_change_wide` is 26 bytes because `movslq`, `imulq`, `cqto`, and `idivq` replaced the 32-bit forms. The listing had shown the widths before any compile.

```figure
id: fig-7-2
kind: flow
title: two legs of one proof
claim: Leg one runs the original and the candidate over 92 cells, and leg two compares 46 masked bytes, one relocation record, and five table entries.
caption: Read each column top down. Grey boxes are the harness and the compiler, which run outside rea, and green boxes are the fixture bytes. Teal is a passed check and rose is a failed one. From capture/out/17-harness-execute-plausible.json, 17-harness-execute-equal.json, and 17-harness-bytes.json.
```

```figure
id: fig-7-3
kind: decision
title: where each of the eight candidates stops
claim: Three candidates stop at the size check, one passes every byte check and fails on the table it points at, and four reach pass.
caption: Read top down. Each grey box is one check of leg two. The dashed rose boxes to its right are the candidates that fail there, with the reason the report prints. The teal boxes at the bottom passed every check. From capture/out/17-harness-bytes.json.
```

## What the 2026 measurements add

The hazards in the grid are not special to this fixture. Liu, Raff, and Micinski measured eight decompilation systems in nine configurations in 2026 ([arXiv 2609.05370](https://arxiv.org/abs/2609.05370)). Candidates that passed every test of the benchmark still diverged on fuzzed inputs. That happened for 4.9 percent of them overall and for up to 13 percent in one system. The test set was 300 library functions and 287 functions with disclosed vulnerabilities. There the strongest refinement model raised Ghidra's build rate from 75 to 90 percent, and the behavioural match rate fell from 74 to 62 percent.

They traced the cause to invented fields, types, callees, and guards that replaced the visible unknowns a decompiler leaves behind. `percent_change_wide.c` is an invented type, and `grade_thresholds.c` is an invented guard. Both compile, both pass the ten naive cases, and both count as re-executable under a benchmark that recompiles and runs the assertions it includes. The authors propose per-function driver synthesis and fuzzing from the reference, which is leg one with a generated grid.

The lesson adds a third source for the constant check. The rea evidence pages describe a reconstruction project that compared instruction bytes while trusting the relocation target. A source literal of `0.0` passed against a target literal of `128.0` until the project audited 1,548 floating-point references. `grade_case10_wrong.c` is this manual's version of that defect, and `read_table()` is the audit.

```takeaways
- Write the rebuild from the listing widths, then run it over a grid that wraps every intermediate.
- Compile the candidate with the original flags and compare bytes only after you mask the relocation fields.
- Read the bytes each relocation points at, because a wrong constant passes a masked compare.
- Record the host and the compiler with every proof, because the trap cell and the bytes depend on both.
```

Sources: capture/out/17-harness-grid.json, 17-harness-execute-plausible.json, 17-harness-execute-equal.json, 17-harness-bytes.json, 17-harness.txt, 10-mcp-20-compare-functions-percent-change.json, 10-mcp-21-compare-functions-total.json, 00-versions.txt; capture/README.md; phases/13-tools-and-protocols/36-rebuild-and-prove-equal/code/main.py, driver.c, fixtures/candidates/; rea at rea-agents-6.7.0 (27dc42d): src/domain/functionComparisonDimensions.ts (Liu, Raff, Micinski, arXiv 2609.05370, 2026); Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 2, IDIV; Arm Architecture Reference Manual for A-profile, DDI 0487, SDIV
