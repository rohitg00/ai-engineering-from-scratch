# Lift to IR and build SSA

Stage 4 of 8. This stage applies [Lifting to Pseudocode](../../../../../phases/13-tools-and-protocols/34-lifting-to-pseudocode/docs/en.md), sections "Stage 3: Lifting to a Small IR" and "Stage 5: SSA, One Name per Definition", and [Calling Conventions and Stack Frames](../../../../../phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames/docs/en.md) for the frame-pointer prologue.

## What you build

You build two things.

The lifter turns each decoded instruction into IR statements. The IR has assignments, stores, branches, jumps, a switch through a recovered table and returns. Its expressions are constants, variables with a width, binary operations, casts, loads, flag records and section addresses. Registers become variables named by their 64-bit family (`eax` writes `rax` at width 32). The flags register is an ordinary variable named `flags`. Frame bookkeeping (`push`, `pop`, `mov %rsp, %rbp`, stack adjustments) produces no statements, and a slot at a constant offset from `%rbp` becomes a local variable such as `local_8`.

The SSA builder gives every definition its own version. It places phi statements on the iterated dominance frontier of each variable's definition sites, renames uses over the dominator tree, and inserts a cast where a use has a different width than the definition it reads.

## Why it matters

x86-64 instructions do several things at once. `subl %edi, %esi` writes `%esi` and six flags. A later `jle` reads two of those flags. If the lifter writes the flags as a variable, stage 5 can see that `jle` after `testl %esi, %esi` means `esi <= 0`, and dead code removal can delete every flag write that no branch reads.

SSA makes every later question local. "Which value does this use read?" has one answer, the single definition with that version. A value that arrives from two paths is a phi, and the phi lists which predecessor provides which version.

## Work through one concrete case

`fold` at `-O1` has five blocks. Before SSA, the lifted loop block 0x80 reads:

```text
block 0x80 -> 0x80, 0x92
  eax = eax << 5
  flags = cmp(eax, esi)
  eax = eax - esi
  flags = add(eax, load32(rdi + rdx * 4))
  eax = eax + load32(rdi + rdx * 4)
  flags = inc(rdx, 1)
  rdx = rdx + 1
  esi = eax
  flags = cmp(rcx, rdx)
  if jne(flags) goto 0x80 else goto 0x92
```

The variables defined inside the loop are `eax`, `rdx`, `esi` and `flags`. The loop header 0x80 is in its own dominance frontier, because the back edge comes from 0x80 itself. So `insert_phis` places four phis at 0x80, one per variable. `ecx` is defined only in 0x74, whose frontier is empty, so it gets no phi.

Renaming walks the dominator tree 0x70, 0x74, 0x80, then 0x92 and 0x93:

```text
block 0x74 -> 0x80
  ecx_1 = esi_0
  edx_1 = 0
  esi_1 = 0
  eax_1 = esi_1
block 0x80 -> 0x80, 0x92
  esi_2 = phi(0x74: esi_1, 0x80: esi_3)
  rdx_2 = phi(0x74: edx_1, 0x80: rdx_3)
  eax_2 = phi(0x74: eax_1, 0x80: eax_5)
  flags_2 = phi(0x74: flags_1, 0x80: flags_6)
  ...
  flags_6 = cmp(zext64(ecx_1), rdx_3)
```

Version 0 is the value at function entry: `esi_0` is the second argument and `rdi_0` the first. Two width facts appear here. `ecx_1` is a 32-bit definition and `cmp(rcx, rdx)` reads 64 bits, so the use becomes `zext64(ecx_1)`; writing a 32-bit register clears the upper half. The `rdx` phi has a 32-bit source (`edx_1 = 0`) and a 64-bit source (`rdx_3`), so the phi is widened to 64 bits.

At `-O0` the same loop keeps its values in stack slots. `movl %edi, -0x8(%rbp)` lifts to `local_8 = rdi`, and the loop header 0xd9 gets phis for `local_10` and `local_14`.

```figure
pj-mini-decompiler-4
```

Move the definitions of `x` between blocks in the lab. A definition in only one arm puts a phi at the join. With the back edge to the entry, the entry gets a phi whose first source is the entry value `x_0`.

## Implement the contract

Implement these. The starter supplies the IR dataclasses, `LiftContext`, `children`, `rebuild`, `rewrite`, `iter_nodes`, `variables`, `stmt_exprs`, `map_stmt`, `IrPrinter` and `to_ssa`.

| function | contract |
|---|---|
| `lift_instruction(insn, ctx) -> list` | One instruction to IR statements. `sub` and `cmp` write `Flags("cmp", destination, source)`; `test` writes `Flags("test", ...)`; `xor r, r` and `sub r, r` write constant 0. `cltd` writes `rdx = signfill(rax)`; `idivl` writes `dividend = rdx:rax`, then the quotient and remainder. A RIP-relative operand with a relocation is a `Symbolic(section, offset)`. A call becomes `rax = call name(args)` using known signatures. An instruction with no rule raises `LiftError` with its address. Signedness evidence goes into `ctx.signedness`. |
| `lift_function(elf, graph, signatures=None) -> Function` | Lift every reachable block in address order. Unreachable blocks and unresolved jumps go into `notes`. Copy the dominators from the graph into `fn.idom`. |
| `insert_phis(fn) -> int` | Phis on the iterated dominance frontier of every variable's definition sites. A phi at the entry block also takes `Var(name, 0, 0)` keyed by `EXIT`. Returns the number placed. |
| `rename(fn)` | One version stack per variable over the dominator tree; version 0 is the entry value. Record every definition width in `fn.def_width`, widen each phi to its widest source, and wrap each use whose width differs from its definition in `zext` or `trunc`. |
| `check_single_assignment(fn) -> list[str]` | The `name_version` keys defined more than once. An empty list means the function is in SSA form. |

IR statements are mutable and compared by identity. Expressions are frozen and compared by value.

## Verify and inspect

```bash
python3 scripts/project_test.py mini-decompiler --stage 4 --path learning-artifacts/mini-decompiler --strict
cd learning-artifacts/mini-decompiler
python3 -m minidec decompile samples/samples-x86_64-O1.o --function fold --ir
```

The `--ir` output prints the IR before SSA and the SSA form. The decompiled C at the end of the output needs stages 5 to 7.

## Failure cases

- `cmovg` (`0f 4f c1`) decodes, but the lifter has no rule for it and raises `LiftError` naming 0x40.
- A use of a register before any write is version 0, and stage 6 decides whether it is an argument.
- A phi that receives a 32-bit and a 64-bit version is widened; leaving it at 32 bits would truncate the loop index in the emitted C.
- A loop whose header is the entry needs the entry value as a phi source. Without it, the first iteration reads an undefined version.

## Extensions

- Lift `setcc` and `cmovcc` to conditional expressions and test them on a fixture with a ternary operator.
- Split the flags variable into the six individual flags and show which branches read only ZF.
- Replace the minimal phi placement with pruned SSA: skip a phi when the variable is not live at the join.
