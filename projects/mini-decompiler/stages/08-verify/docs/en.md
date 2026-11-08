# Prove the output

Stage 8 of 8. This stage applies [Rebuild and Prove Equal](../../../../../phases/13-tools-and-protocols/36-rebuild-and-prove-equal/docs/en.md), sections "Leg One: Execute and Compare" and "Leg Two: Recompile and Compare", and [Evidence, Confidence, and Unknowns in Binary Analysis](../../../../../phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/docs/en.md) for the report.

## What you build

You build `verify`, the command that turns decompiled text into a claim with evidence. It has two legs and one report.

**Bytes leg.** Recompile `decompiled.c` with the fixture flags (`-target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c`). For each function, cut the original and the candidate out of their objects, zero every relocation field in both, and compare. Then compare the relocation records by offset, type and target section, and compare the words that each PC-relative relocation points at in a data section. Equal masked bytes with different table contents is a difference.

**Behaviour leg.** Compile the original source, the candidate with every function renamed to `cand_<name>`, and a generated C driver. Feed the driver one line per input cell. It calls both versions on copies of the same memory, prints both results and the memory after the call, and prints `trap` when a division traps. Any cell where the two lines differ is a mismatch.

**Report.** `report.json` lists, per function, the signature, the behaviour status with cell counts by kind, the bytes status with reasons, and every unknown from stage 7 plus every leg that did not run. The aggregate is fail-closed.

## Why it matters

Readable C proves nothing. A decompiler output that looks right can swap a signed compare for an unsigned one and still compile. The behaviour leg runs it. A decompiler output that runs right on a few inputs can still differ for `INT_MIN`. The grid crosses the limits on purpose. The bytes leg asks a stricter question: does the same compiler with the same flags produce the same function? When the answer is yes, the C is a source for that function at that optimization level.

## The input grid

Each parameter gets a value set, and the sets are crossed, capped at 400 cells:

| parameter | values |
|---|---|
| int, no pointer parameter in the function | 0, 1, -1, 2, 7, 10, -10, 100, `INT_MAX`, `INT_MIN` |
| int, beside a pointer | 0, 1, 3, 8, -1, 100 (the count stays inside the 4096-word buffer) |
| every compare constant c | c - 1, c and c + 1 are added |
| pointer | five 8-word patterns: zeros, ascending, mixed signs, limits, all -1 |

Each cell is labelled `limit`, `compare-edge`, `zero`, `negative` or `plain` so the report shows what the grid covered.

## Work through one concrete case

Run the command on the committed `-O1` object and its source:

```bash
python3 -m minidec verify samples/samples-x86_64-O1.o --source samples/samples.c --opt O1 --out verify-O1
```

| function | cells | behaviour | bytes | reason |
|---|---|---|---|---|
| `tenths_and_fifths` | 10 | pass | pass | |
| `thirds` | 100 | pass | pass | |
| `band` | 13 | pass | pass | |
| `fold` | 30 | pass | differs | size 38 vs 40 bytes |
| `record` | 30 | pass | pass | |

`band` has 13 cells: the 10 base values plus 4, 5 and 6 from its compare constant 5. Those three cells are `compare-edge`. Its masked bytes are equal, and its relocation points at `.rodata+0x0` in both objects, where both hold `[5, 8, 12, 20, 20, 35]`.

`fold` passes all 30 behaviour cells, but the recompiled loop is 2 bytes longer. The decompiled loop compares a `long` counter with a zero-extended count, where the source uses an `int` index, and clang emits a different instruction sequence for that loop. The aggregate is `behaviour-only`: the program computes the same values on the grid, and the bytes are not the same.

The masking step on `band` at `-O1`: the function is 0x17 bytes, its one relocation is at offset 0xf with width 4, so bytes 0xf to 0x12 become zero in both copies before the compare.

A candidate made from the same source with one table value changed (case 4 returns 21) has equal masked bytes and equal relocation shapes. Only the constant check sees `[5, 8, 12, 20, 21, 35]`, so its status is `differs` with the reason "referenced constants differ".

At `-O0` the aggregate is also `behaviour-only`: `band` differs in size (106 vs 114 bytes); its emitted switch uses a `long` index variable that the source does not have. `record` differs in 8 bytes; the emitted C keeps no stack copies of the parameters, and the `-O0` original does.

```figure
pj-mini-decompiler-8
```

Add a pointer parameter in the lab and watch the per-scalar values drop from 10 to 6 and the cell count multiply by 5. Clear the `clang on PATH` box: both legs become `unknown`, and so does the aggregate.

## Implement the contract

Implement these in the `verify` module. The starter supplies the constants, `fixture_flags`, `find_clang`, `host_description`, `read_referenced`, `ByteComparison`, `Cell`, `driver_source`, `Harness`, `build_harness`, `parse_result`, `run_cells` and `BehaviourReport`.

| function | contract |
|---|---|
| `recompile(source, opt, out) -> Path` | Run clang with `fixture_flags(opt)`. Missing clang or a compile error raises `VerifyError` with the compiler text. |
| `mask_relocations(data, relocations) -> (bytes, ranges)` | Zero `width` bytes at each relocation offset; return the masked bytes and the `(offset, width)` ranges. |
| `compare_function_bytes(original, candidate, name, tables=None) -> ByteComparison` | Masked compare, relocation shape compare, referenced constant compare. A function missing from the candidate is `unknown`, never a pass. |
| `classify(args, constants) -> str` | The cell label, in the priority order of the grid section. |
| `input_grid(signature, constants=None, limit=400) -> list[Cell]` | The crossed value sets above, with no duplicate cells. |
| `differential_test(original_source, candidate_source, decompiled, opt, workdir)` | Build the harness and run every function's grid. |
| `aggregate(behaviour, bytes_status) -> str` | `fail` if any behaviour fails; `unknown` if there is no function or any leg is unknown; `pass` if all bytes pass; otherwise `behaviour-only`. |
| `evidence_report(...) -> dict` | The JSON report with the limits of each claim. |
| `verify(object_path, source_path=None, opt="O1", out_dir=None, functions=None, recognize_division=True) -> dict` | Decompile, write `decompiled.c`, recompile and compare bytes, run the grid when the source and clang exist, write `report.json`. |

The CLI `verify` command exits 0 for `pass` and `behaviour-only` and 1 for `fail` and `unknown`, so a CI job can gate on it.

## Verify and inspect

```bash
python3 scripts/project_test.py mini-decompiler --all --path learning-artifacts/mini-decompiler --strict
cd learning-artifacts/mini-decompiler
python3 -m minidec verify samples/samples-x86_64-O1.o --source samples/samples.c --opt O1 --out verify-O1
python3 -m minidec verify your-object.o --source your-source.c --opt O1 --out verify-yours
```

Without clang on `PATH`, the recompile and differential tests skip with the reason "clang is not on PATH: the recompile leg cannot run; the committed-object legs still ran". A skipped test prevents completion evidence, so install clang to finish the project. The masking, grid, driver, aggregate and committed-object tests run on every host.

## Failure cases

- `int f(int a) { return a +; }` makes `recompile` raise `VerifyError` that starts with "recompile failed".
- A candidate where `fold` uses a `long` accumulator is 45 bytes against 38, and the reason says "size 38 vs 45 bytes".
- Comparing `band` against an object that has no `band` is `unknown` with the function name in the reason.
- `verify` with no source writes behaviour `unknown` for every function, "was not compared" in the unknowns, and an aggregate of `unknown` even when every byte compare passes.
- `fixture_flags("O9")` raises `ValueError`.

## Limits of the claim

The behaviour leg compiles the original source and the candidate for the host. On an arm64 host it compares the behaviour of the C source, and it does not execute the committed x86-64 object. A pass covers the grid on this host and is not a proof of equivalence for every input. The bytes leg is a statement about one compiler version with one set of flags. Pointer parameters reach the driver as `void *`, which is correct for the psABI because the psABI passes every pointer in an INTEGER register.

## Extensions

- Run the committed x86-64 object itself under an x86-64 emulator so the behaviour leg also covers the original machine code.
- Add a random leg seeded from the object hash, and record the seed in the report so a mismatch can be replayed.
- Write a minimizer that shrinks a mismatching cell to the smallest input that still differs.
