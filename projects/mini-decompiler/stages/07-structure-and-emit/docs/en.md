# Structure the graph and emit C

Stage 7 of 8. This stage applies [Lifting to Pseudocode](../../../../../phases/13-tools-and-protocols/34-lifting-to-pseudocode/docs/en.md), section "Stage 8: Structuring From the Graph", and [Compiler Idioms and Optimization](../../../../../phases/13-tools-and-protocols/39-compiler-idioms-and-optimization/docs/en.md) for the rotated loop and the value table.

## What you build

You build the last two steps of the pipeline and the pipeline itself.

The structurer walks the graph from the entry and matches shapes, after the method of Cifuentes:

- A loop header (a block that a back edge targets) becomes `while (cond) { ... }` when the header holds the exit branch, and `do { ... } while (cond);` otherwise. The condition of a `do` loop comes from the latch, the block whose branch returns to the header.
- A two-way branch closes at its immediate post-dominator. If the join is one of the two successors, the branch is a single `if`. If both arms end in a return, the smaller arm becomes an early-return `if`. Otherwise it is `if-else`.
- A jump table becomes a `switch` with one `case` per index, grouped by target, and the bounds-check branch becomes its `default`.
- A block that is reached a second time becomes `goto block_<address>;`, and the count is reported.

The emitter prints IR expressions as C with a precedence table, declares every non-parameter web at the top, and prints struct definitions and table definitions before the functions. `decompile` composes stages 3 to 7 for one function and lists every unknown. `decompile_all` runs it in address order, and `translation_unit` writes one C file.

## Why it matters

The output of this stage is the input of stage 8. It has to be C that a compiler accepts, and it has to say where it guessed. The goto count is the measure of how much of the graph the shapes explained. On the fixtures it is zero at both optimization levels.

## Work through one concrete case

`band` at `-O0` has the jump table from stage 3. The entry block 0x50 ends with `ja 0xae`. The taken successor is the default block. The fallthrough successor 0x64 holds only the switch, and 0x50 is its only predecessor, so the branch becomes the switch and the taken edge becomes `default`. The join of the switch is 0xb5, the immediate post-dominator of 0x50.

```c
int band(int param_1)
{
  long local_10;
  int local_4;

  local_10 = (unsigned long)(unsigned int)param_1;
  switch (local_10) {
  case 0:
    local_4 = 5;
    break;
  ...
  case 5:
    local_4 = 35;
    break;
  default:
    local_4 = -1;
    break;
  }
  return local_4;
}
```

At `-O1` there is no jump table. The value table read is `lookup_0[...]`, and the branch at 0x58 joins at 0x66, its taken successor, so the result is a single `if` with the negated condition:

```c
static const int lookup_0[6] = {5, 8, 12, 20, 20, 35};

int band(int param_1)
{
  int eax_1;

  eax_1 = -1;
  if ((unsigned int)param_1 <= 5) {
    eax_1 = lookup_0[(unsigned long)(unsigned int)param_1];
  }
  return eax_1;
}
```

The cast `(unsigned int)param_1` keeps the unsigned compare of `ja` exact: -1 is out of range, as in the original. The table length 6 comes from the next offset in `.rodata` that code references, or from the end of the section. That is a heuristic, so `unknowns` says so.

`fold` at `-O1` shows the other two shapes. The entry branch joins at the exit and the `0x93` arm is one block, so it becomes `if (param_2 <= 0) { return 0; }`. The loop at 0x80 exits from its latch, so it is a `do-while`:

```c
  do {
    eax_1 = (esi_1 << 5) - esi_1 + param_1[rdx_1];
    rdx_1 = rdx_1 + 1;
    esi_1 = eax_1;
  } while ((unsigned long)(unsigned int)param_2 != rdx_1);
```

`(esi_1 << 5) - esi_1` is `esi_1 * 31`: clang replaced the multiply with a shift and a subtract.

```figure
pj-mini-decompiler-7
```

Change the post-dominator in the lab and read which shape the branch becomes. Then clear the header-exit box to see the loop change from `while` to `do-while`.

## Implement the contract

Implement these. The starter supplies `negate`, `natural_loops`, `post_dominators`, the `Structurer` helpers (`emit`, `terminator`, `body`, `region_size`, `switch_head`, `run`), `structure`, `Emitter`, `Decompiled` and `PRECEDENCE`.

| function | contract |
|---|---|
| `Structurer.walk(block_id, stop, depth)` | Emit the region from `block_id` up to `stop`. An emitted block becomes a counted goto; a loop header goes to `emit_loop`; otherwise emit the body and follow the terminator. |
| `Structurer.emit_branch(block, term, stop, depth)` | The four branch shapes above, with the switch case when the fallthrough block is a switch head with one predecessor. |
| `Structurer.emit_switch(block, term, default, join, depth)` | Case labels grouped by target in index order, each region followed by `break;`, then `default`. |
| `Structurer.emit_loop(header, stop, depth)` | `while` when the header branch leaves the loop and the header is not its own latch, else `do-while`. Continue at the first exit block. |
| `compare_constants(fn) -> list[int]` | Every constant that a comparison uses. Stage 8 adds each one and its neighbours to the input grid. |
| `table_values(elf, section, offset, width) -> list[int]` | Signed values from `offset` to the next code-referenced offset in the section, or its end. |
| `struct_definition(name, fields) -> str` | One `field_<offset>` per offset, `char pad_<offset>[n]` for each gap. |
| `decompile(elf, name, recognize_division=True, signatures=None) -> Decompiled` | Graph, lift, SSA, optimize, signature, structure, emit, then the unknowns list. |
| `decompile_all(elf, recognize_division=True, functions=None)` | Address order, passing earlier signatures to later calls. |
| `translation_unit(results) -> str` | Struct definitions once, table definitions once, then each function, ending in a newline. |

## Verify and inspect

```bash
python3 scripts/project_test.py mini-decompiler --stage 7 --path learning-artifacts/mini-decompiler --strict
cd learning-artifacts/mini-decompiler
python3 -m minidec decompile samples/samples-x86_64-O1.o
python3 -m minidec decompile samples/samples-x86_64-O0.o --out decompiled-O0.c
python3 -m minidec decompile your-object.o --json
```

The last line accepts an object you compiled with `clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c`. Functions outside the subset raise a decode or lift error that names the address.

## Failure cases

- A region that matches no shape emits `goto block_<address>;` and adds "goto statement(s) remain" to the unknowns. Unbalanced braces are a bug; the tests count them.
- A function with no write to `%rax` emits `return;` and the unknown that `void` is a guess.
- A struct pointer gets the unknown that field names and untouched fields are not visible. An element pointer gets the unknown that `const` and the element count are not visible.
- `--no-division-idioms` keeps the multiply. The output still compiles and still computes the same function.

## Extensions

- Emit `for` loops when a loop has an induction variable with an initial value, a compare and an increment.
- Turn short-circuit conditions (`a && b`) into one `if` when two branches share a target.
- Restructure an irreducible region by node splitting instead of a goto, and compare the output size.
