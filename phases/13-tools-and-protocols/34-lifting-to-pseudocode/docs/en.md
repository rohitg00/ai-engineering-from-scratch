# Lifting to Pseudocode: IR, SSA, and Structuring From Scratch

> Decompiler output is a claim with a hidden derivation. When you build the derivation yourself, every line of that output becomes a thing you can check.

**Type:** Build
**Languages:** Python, C
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow)
**Time:** ~150 minutes

## Learning Objectives

- Lift decoded x86-64 instructions to a small IR with explicit flags, loads, stores, branches, calls, and returns.
- Turn frame slots into local variables and System V argument registers into parameters.
- Build minimal SSA with phi functions on dominance frontiers, then substitute, simplify, and remove dead code.
- Recover `if`, `if` with `else`, `while`, and `do while` from the control-flow graph with post-dominators and back edges.
- Explain the multiply by `0x66666667` as a division by 10 and prove the identity.
- Read Ghidra pseudocode for the same functions line by line and name the instruction, or the guess, behind every difference.

## The Problem

You asked rea for the pseudocode of `percent_change` in `ledger-x86_64-O1.o`. Ghidra 12.1.4 answered in about ten seconds:

```c
undefined1  [16] percent_change(int param_1,int param_2,ulong param_3)

{
  long lVar1;
  undefined1 auVar2 [16];
  undefined1 auVar3 [16];
  
  if (param_1 != 0) {
    lVar1 = (long)((param_2 - param_1) * 100);
    auVar3._0_8_ = lVar1 / (long)param_1 & 0xffffffff;
    auVar3._8_8_ = lVar1 % (long)param_1 & 0xffffffff;
    return auVar3;
  }
  auVar2._8_8_ = 0;
  auVar2._0_8_ = param_3;
  return auVar2 << 0x40;
}
```

The source is four lines long. It takes two `int` values and returns one `int`. Ghidra reports a 16-byte return value and a third parameter that the source does not have. The sixteen bytes of machine code are correct, and Ghidra decoded every one of them correctly. The signature is a guess, and nothing in the text marks it as one.

rea returns this text as the `procedure_pseudo_code` result and attaches one limitation to the record. The limitation reads "Pseudocode is Ghidra decompiler output, not original source and not text-equivalent to Hopper output". The `compare_functions` tool diffs pseudocode as lines of text. Its own dimension record says "Assembly is opaque provider text" and that relocation normalization is unavailable. rea cannot look inside the text, and neither can an agent that only reads it.

rea's DX-Ball record shows the cost. The first decompiler result was `FUN_00406400(void)` calling `__ftol()`. The instruction view showed a stack input and an x87 expression. The agent kept going only because the two views disagreed.

This lesson builds the derivation that the decompiler hides. You start from the 56 instructions that lesson 33 decoded, lift them to an IR, rename into SSA, simplify, and structure. Then you place your pseudocode next to Ghidra's for `percent_change`, `grade`, and `total`, and account for every difference. The tests compile your output with clang and run it against the source over an input grid.

```figure
lifting-stages-percent-change
```

## The Fixture and the Oracle

`code/fixtures/ledger.c` is the shared fixture of this part of the course:

```c
int percent_change(int before, int after) {
    if (before == 0) return 0;
    return (after - before) * 100 / before;
}

int grade(int score) {
    switch (score / 10) {
    case 10:
    case 9: return 4;
    case 8: return 3;
    case 7: return 2;
    case 6: return 1;
    default: return 0;
    }
}

int total(const int *values, int count) {
    int sum = 0;
    for (int i = 0; i < count; i++) sum += values[i];
    return sum;
}
```

`grade_label` is also in the file and in the object, and the demo lifts it too. The three functions above are the ones this lesson tests.

The object was built with `clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c ledger.c`. The `-O0` object sits beside it for the stack-slot section. `code/fixtures/README.md` lists both commands, the SHA-256 of each object, and the rea command that produced the Ghidra fixtures. The build is reproducible byte for byte on the pinned toolchain.

The oracle for the decoder is `llvm-objdump -d -r`. Its text for both objects is committed as `ledger-x86_64-O1.objdump.txt` and `ledger-x86_64-O0.objdump.txt`. A test parses those files and compares every instruction by address, by bytes, and by AT&T text. That covers all 56 instructions at `-O1` and every instruction at `-O0`. When `llvm-objdump` is installed at the pinned path, a second test runs it live and compares again.

Here is `percent_change` as the oracle prints it:

```text
0000000000000000 <percent_change>:
       0: 85 ff                        	testl	%edi, %edi
       2: 74 09                        	je	0xd <percent_change+0xd>
       4: 29 fe                        	subl	%edi, %esi
       6: 6b c6 64                     	imull	$0x64, %esi, %eax
       9: 99                           	cltd
       a: f7 ff                        	idivl	%edi
       c: c3                           	retq
       d: 31 c0                        	xorl	%eax, %eax
       f: c3                           	retq
```

## Stage 1: Bytes to Instructions

Lesson 33 built the decoder. This lesson keeps a small copy so the code runs on its own. The copy covers exactly the opcodes that clang emitted for `ledger.c` at `-O0` and `-O1`. For anything else it raises `DecodeError` with the address and the opcode byte.

The decoder follows the byte order of the Intel SDM, Volume 2, section 2.1. Prefixes come first, then the opcode, then ModR/M, then SIB, then the displacement, then the immediate. Section 2.2.1 adds the REX prefix, one byte from `0x40` to `0x4F`, which must sit directly before the opcode. REX.W selects a 64-bit operand, REX.R extends the `reg` field, REX.X extends the SIB index, and REX.B extends `r/m` or the SIB base. Section 2.1.3 defines the three ModR/M fields `mod`, `reg`, and `r/m`, and the three SIB fields `scale`, `index`, and `base`. In 64-bit mode, `mod = 00` with `r/m = 101` means a 32-bit displacement relative to the next instruction (section 2.2.1.6).

| Opcode bytes | Form | Fixture example |
|---|---|---|
| `01 29 31 39 85 89` | `op Ev, Gv` | `29 fe` `subl %edi, %esi` |
| `03 2b 3b 8b 8d` | `op Gv, Ev` | `03 04 97` `addl (%rdi,%rdx,4), %eax` |
| `63` with REX.W | `movsxd Gv, Ev` | `48 63 c7` `movslq %edi, %rax` |
| `69` and `6b` | `imul Gv, Ev, imm` | `48 69 c0 67 66 66 66` |
| `83 /0 /5 /7` | `add sub cmp Ev, imm8` | `83 c1 fa` `addl $-0x6, %ecx` |
| `c1 /5 /7` | `shr sar Ev, imm8` | `48 c1 f9 22` `sarq $0x22, %rcx` |
| `f7 /7` | `idiv Ev` | `f7 ff` `idivl %edi` |
| `ff /0 /4` | `inc Ev`, `jmp Ev` | `48 ff c2` `incq %rdx` |
| `70` to `7f`, `eb`, `e8` | `jcc rel8`, `jmp rel8`, `call rel32` | `74 09` `je 0xd` |
| `99`, `c3`, `90`, `0f 1f` | `cltd`, `retq`, `nop` | `66 0f 1f 44 00 00` `nopw (%rax,%rax)` |

The `leaq (%rip), %rcx` at `grade+0x23` is seven bytes with a zero displacement. The object carries a relocation `R_X86_64_PC32.rodata+0x10` at offset `0x36`, the displacement field. The lifter resolves it in stage 3.

## Stage 2: Blocks and Dominators

A basic block is a sequence of statements with one entry at the top and one exit at the bottom. That is the definition from Allen (1970), and every decompiler paper reuses it. `build_blocks()` collects leaders: the function entry, every jump target inside the function, and every address after a jump or return. Each block gets successors from its last instruction. A conditional jump has two successors and a `jmp` has one. A `ret` has none, and a block that ends in an ordinary instruction falls through to the next leader.

`total` at `-O1` has five blocks:

| Block | Instructions | Successors |
|---|---|---|
| `0x40` | `testl %esi, %esi` then `jle 0x5c` | `0x5c`, `0x44` |
| `0x44` | `movl %esi, %ecx`, `xorl %edx, %edx`, `xorl %eax, %eax`, `nopw` | `0x50` |
| `0x50` | `addl (%rdi,%rdx,4), %eax`, `incq %rdx`, `cmpq %rdx, %rcx`, `jne 0x50` | `0x50`, `0x5b` |
| `0x5b` | `retq` | exit |
| `0x5c` | `xorl %eax, %eax` then `retq` | exit |

`immediate_dominators()` is the iterative algorithm of Cooper, Harvey, and Kennedy (2001). It walks the blocks in reverse postorder and intersects the dominators of the processed predecessors until nothing changes. On graphs this small it finishes in two passes. For `total` it says that `0x44` dominates `0x50`. It also says that `0x50` dominates itself through the back edge, which is how stage 8 finds the loop.

The same function runs twice more. `dominance_frontiers()` uses it for SSA in stage 5. `post_dominators()` runs it on the reversed graph with a virtual exit node to find joins in stage 8.

## Stage 3: Lifting to a Small IR

The IR has six statement kinds: `Assign`, `Store`, `Branch`, `Jump`, `IndirectJump`, and `Return`. Expressions are constants, variables, binary operations with a width, casts (`sext`, `zext`, `trunc`), and loads. Five more shapes exist only to be simplified away later: `Flags`, `Cond`, `Concat`, `SignFill`, and `Symbolic`.

Registers are variables named by their 64-bit family. A write to `%eax` is an `Assign` to `rax` with width 32, and a read of `%eax` is a read of `rax` at width 32. In 64-bit mode a 32-bit write zero-extends into the full register, so a later 64-bit read of the same value is a `zext`. The lifter does not know the reaching definition, so it records the read width and lets SSA insert the cast in stage 5.

| Instruction | IR statements |
|---|---|
| `subl %edi, %esi` | `flags = cmp(esi, edi)` then `esi = esi - edi` |
| `testl %edi, %edi` | `flags = test(edi, edi)` |
| `je 0xd` | `if je(flags) goto 0xd else goto 0x4` |
| `xorl %eax, %eax` | `eax = 0` |
| `cltd` | `edx = signfill(eax)` |
| `idivl %edi` | `dividend = edx:eax`, `eax = dividend / edi`, `edx = dividend % edi` |
| `movslq %edi, %rax` | `rax = sext64(edi)` |
| `sarq $0x22, %rcx` | `rcx = rcx >>s 34` |
| `shrq $0x3f, %rax` | `rax = rax >>u 63` |
| `addl (%rdi,%rdx,4), %eax` | `flags = add(eax, load32(rdi + rdx * 4))` then `eax = eax + load32(rdi + rdx * 4)` |
| `leaq (%rip), %rcx` with its relocation | `rcx = &.rodata+0x14` |
| `pushq %rbp`, `movq %rsp, %rbp`, `subq $0x10, %rsp`, `popq %rbp` | nothing, frame bookkeeping |
| `retq` | `return rax` |

### Flags are a variable

Every instruction that sets the condition codes writes one variable named `flags`, and every conditional jump reads it. A `cmp a, b` writes `cmp(a, b)`, a `test a, b` writes `test(a, b)`, and `sub` writes the same `cmp` shape as a side effect. A `jcc` becomes `Branch(Cond(cc, flags), target, fallthrough)`. The condition code decides the comparison operator when the two meet in stage 6:

| Code | After `cmp(a, b)` | After `test(a, a)` |
|---|---|---|
| `je` | `a == b` | `a == 0` |
| `jne` | `a != b` | `a != 0` |
| `jl`, `jge`, `jle`, `jg` | signed `<`, `>=`, `<=`, `>` | signed compare with 0 |
| `jb`, `jae`, `jbe`, `ja` | unsigned `<`, `>=`, `<=`, `>` | unsigned compare with 0 |

`xorl %eax, %eax` is lifted straight to `eax = 0`. The flags it sets are written as `add` style flags that no jump in the fixture reads. The `xor` idiom matters in `grade`, where Ghidra lost it.

### cltd and idiv

`cltd` fills `%edx` with the sign bit of `%eax`. `idivl %edi` divides the 64-bit pair `%edx:%eax` by `%edi`, puts the quotient in `%eax`, and the remainder in `%edx`. The lifter writes the pair into a temporary named `dividend` first. The remainder statement then reads the old `%eax` and not the fresh quotient. In SSA the high half shows up as `signfill` of the low half. The simplifier reduces the pair to the low half, and the division becomes a 32-bit `/`.

### Stack slots at -O0

At `-O0` clang keeps every local in the frame. `percent_change` stores `%edi` to `-0x8(%rbp)` and `%esi` to `-0xc(%rbp)`, then reads them back for every use. The lifter watches for `pushq %rbp` followed by `movq %rsp, %rbp`. After that prologue, a memory operand with base `%rbp`, no index, and a displacement becomes a variable named `local_<hex>`. `-0x8(%rbp)` is `local_8`, `-0xc(%rbp)` is `local_c`.

The frame instructions themselves produce no IR, and neither do `subq` and `addq` on `%rsp`. Any other memory operand stays a `Load` or `Store`.

### Relocations

The `leaq (%rip), %rcx` in `grade` has displacement zero in the file. The relocation at offset `0x36` says `R_X86_64_PC32.rodata+0x10`. The linker will write `S + A - P` into the field. `S` is the address of `.rodata`, `A` is the addend `0x10`, and `P` is the address of the field. The instruction then computes `next_ip + disp = (P + 4) + S + A - P = S + A + 4`.

The lifter applies the same arithmetic without a linker. The target offset is the addend plus the distance from the field to the end of the instruction, `0x10 + 4 = 0x14`. The IR says `rcx = &.rodata+0x14`, and the table there holds the five `int` values `1, 2, 3, 4, 4`.

## Stage 4: Parameters From the Calling Convention

The System V AMD64 psABI, section 3.2.3, passes INTEGER class arguments in `%rdi`, `%rsi`, `%rdx`, `%rcx`, `%r8`, `%r9`, in that order. The result returns in `%rax` and then `%rdx`. Section 3.2.1 says that `%rbp`, `%rbx`, and `%r12` through `%r15` belong to the caller and must be preserved. Everything else belongs to the callee.

`collect_params()` applies one rule: an argument register that is read before any write in the function is a parameter. The highest such register fixes the count, so a function that reads `%rsi` and never `%rdi` still has two parameters. `percent_change` reads `%edi` and `%esi`, so it has `param_1` and `param_2`. `grade` reads only `%edi`. `total` reads `%rdi` as a 64-bit base and `%esi` as a 32-bit count.

Now Ghidra's `param_3` has an explanation. `idivl` writes `%rdx`, and the psABI allows a 128-bit INTEGER return in `%rax:%rdx`. In an object file there is no caller to say how wide the return value is. Ghidra kept both registers as the return value.

On the zero path, `xorl %eax, %eax` writes only `%eax`. Ghidra read `%rdx` there as an input of the function, and that input became `param_3`. The instructions are right. The signature is a guess about the parts the instructions leave open.

## Stage 5: SSA, One Name per Definition

After lifting, `grade` writes `rax` four times and `rcx` three times. Cytron, Ferrante, Rosen, Wegman, and Zadeck (1991) define static single assignment form. Each variable is assigned exactly once, and phi functions at join points select among the definitions that reach them. Their construction has two steps. Section 5.1 places phi functions using dominance frontiers, and section 5.2 renames every definition and use with a walk over the dominator tree. `insert_phis()` and `rename()` follow those two sections.

The SSA listing of `total` shows what the construction produces:

```text
block 0x44 -> 0x50
  ecx_1 = esi_0
  edx_1 = 0
  eax_1 = 0
block 0x50 -> 0x50, 0x5b
  eax_2 = phi(0x44: eax_1, 0x50: eax_3)
  rdx_2 = phi(0x44: edx_1, 0x50: rdx_3)
  flags_2 = phi(0x44: flags_1, 0x50: flags_5)
  flags_3 = add(eax_2, load32(rdi_0 + rdx_2 * 4))
  eax_3 = eax_2 + load32(rdi_0 + rdx_2 * 4)
  flags_4 = inc(rdx_2, 1)
  rdx_3 = rdx_2 + 1
  flags_5 = cmp(zext64(ecx_1), rdx_3)
  if jne(flags_5) goto 0x50 else goto 0x5b
```

Version 0 of a register is its value at entry. `esi_0` and `rdi_0` are the parameters. The loop header `0x50` has two predecessors, the setup block and itself, so every variable with a definition in the loop gets a phi there. The `flags_2` phi is dead on arrival. Minimal SSA places it because `flags` has definitions in both predecessors, and stage 6 removes it because nothing reads it.

The renaming step also fixes widths. `edx_1 = 0` is a 32-bit definition and `rdx_3 = rdx_2 + 1` is 64-bit, so the phi `rdx_2` takes the wider width. The read of `%rcx` in `cmpq %rdx, %rcx` is 64-bit while its definition `ecx_1 = esi_0` is 32-bit, so the use becomes `zext64(ecx_1)`. Every cast in the final pseudocode comes from this one rule.

The "lite" part is the way out of SSA. `coalesce_webs()` joins each phi with its arguments into one variable, called a web, and gives the web one name. This works for the shapes a compiler emits for these functions. It can break on parallel copies, where two phis at one join exchange values, and the lesson does not handle that case. Cytron's section 7 describes the general exit through coloring.

## Stage 6: Simplify, Substitute, Remove Dead Code

`optimize()` repeats three passes until nothing changes. The simplifier rewrites expressions bottom up with these rules:

| Before | After |
|---|---|
| `Cond(je, cmp(a, b))` | `a == b`, and the same for the other nine codes |
| `Cond(jle, test(a, a))` | `a <= 0` |
| `x + (-6)` | `x - 6` |
| `trunc32(zext64(x))` where `x` is 32-bit | `x` |
| `trunc32(a + b)` on 64-bit operands | `trunc32(a) + trunc32(b)` |
| `(signfill(x): x) / d` | `x / d` at width 32 |
| `load32(base + idx * 4)` | `base[idx]` |
| `trunc32(p >>s 34) + trunc32(p >>u 63)` with `p = sext64(x) * 0x66666667` | `x / 10` |

Forward substitution moves a definition into its only use. The rule has three conditions. The use is in the same block. The use is a statement and not a phi. When the definition contains a load, no store or call sits between the definition and the use. A constant or a section address is substituted anywhere except into a phi, because a phi argument has to stay a variable for the web.

Dead code removal deletes an assignment or a phi whose destination has no use and whose expression has no call. The order of the passes matters. In `percent_change` the remainder `edx_2 = dividend_1 % edi_0` is dead, so it goes first. That leaves `edx_1 = signfill(eax_1)` with one use, so it is substituted into `dividend_1 = edx_1:eax_1`.

The pair rule then reduces `signfill(eax_1):eax_1` to `eax_1`, and the division becomes `eax_1 / edi_0`. Now `eax_1 = esi_1 * 100` has one use, and `esi_1 = esi_0 - edi_0` has one use, and both move into the return statement. The `flags` definitions have been substituted into the branch conditions and disappear. Four instructions become one line:

```c
return (param_2 - param_1) * 100 / param_1;
```

### The 0x66666667 multiply

`grade` divides the score by 10, and clang emits no `idiv`. It emits `imulq $0x66666667, %rax, %rax`, then `sarq $0x22, %rcx` on a copy, then `shrq $0x3f, %rax`, then adds the two. Granlund and Montgomery, "Division by Invariant Integers using Multiplication" (PLDI 1994), describe the method. The compiler picks a multiplier `m` and a shift `s`. For every `x` in the range, `(x * m) >> s` must equal `x / d`.

Here `m = 0x66666667 = 1717986919` and `s = 34`. The arithmetic checks out: `2^34 / 10 = 1717986918.4`, and the ceiling is `1717986919`. The error is `m * 10 - 2^34 = 6`. For the identity to hold on every 32-bit `x`, the error times `2^31` must stay below `2^34`, so the error must be at most 8. Six is at most eight, so `(x * m) >> 34` equals `floor(x / 10)` for every non-negative `int`.

For negative `x` the floor rounds away from zero while C rounds toward zero. `shrq $0x3f` extracts the sign bit of the product, which is 1 exactly when `x` is negative. Adding it corrects the rounding.

`magic_divisor(m, s)` tests a candidate pair. It computes `d` as the integer quotient of `2^s` by `m` and tries `d` and `d + 1`. It accepts a `d` only when `m` equals the ceiling of `2^s / d` and the error bound holds. The same multiplier with `s = 33` gives `d = 5`, which is correct, because `0x66666667` is also the ceiling of `2^33 / 5`. A test checks the identity against `c_div(x, 10)` on 2,406 values including both ends of the `int` range.

With recognition on, `grade` reads `ecx_1 = param_1 / 10 - 6;`. With recognition off, the demo prints the raw form:

```c
rax_1 = (long)param_1 * 0x66666667;
ecx_1 = (int)(rax_1 >> 34) + (int)((unsigned long)rax_1 >> 63) - 6;
```

Both compile and both compute the same values. Keep the switch. When you read code from a compiler you have not studied, the raw form is the honest one.

## Stage 7: Types From Use

Machine code has widths and no types. `infer_types()` turns three kinds of evidence into C types. A web whose definitions are 32 bits wide is `int`, and a 64-bit web is `long`. A web that is the base of an element access `base[idx]` with 4-byte elements is `int *`. The pointer type spreads along copies and phis, so `local_8 = param_1` at `-O0` makes both of them `int *`. The return type is the width of the value in the `return` statements.

The result for `total` is `int total(int *param_1, int param_2)`. Ghidra wrote `int total(long param_1,uint param_2)`. Both are consistent with the instructions. The lifter used the scaled load as pointer evidence. Ghidra kept the register width and wrote the access as `*(int *)(param_1 + uVar2 * 4)`. Neither can see `const`, and neither can tell `int *` from `unsigned *`.

Lee, Avgerinos, and Brumley (TIE, NDSS 2011) frame type recovery as constraint solving over a lattice. The result is an upper and a lower bound instead of one guess. Noonan, Loginov, and Cok (Retypd, PLDI 2016) add polymorphism and recursion. They report 98 percent recall on `const` pointer annotations from idioms the compiler leaves behind. This lesson uses the two cheapest rules from that line of work and names what they cannot see.

Unsigned arithmetic is kept in the expressions and not in the variable types. `ja` after `cmpl $0x4, %ecx` prints as `(unsigned int)ecx_1 > 4`, and `shrq` prints as `(unsigned long)rax_1 >> 63`. The variables stay signed so that a reader sees the register value and the one place where the instruction treats it as unsigned.

## Stage 8: Structuring From the Graph

Cifuentes (1994), chapter 6, matches regions of the graph against the shapes of a high-level language. Loops come first (6.6.1), then two-way conditionals (6.6.2), then n-way conditionals (6.6.3). Yakdan, Eschweiler, Gerhards-Padilla, and Smith (NDSS 2015) take the other road. They derive the condition under which each node executes and build the structure from those conditions, with no fixed shapes. Their motivation is a measurement. Hex-Rays on one sample produced 1,571 `goto` statements in 49,514 lines, one per 32 lines, and their structuring produced none on 1,530 coreutils functions.

`structure()` is a small member of the first family. It needs two facts from stage 2. The immediate post-dominator of a block that ends in a `Branch` is the join of the conditional. A back edge is an edge to a block that dominates its source. The natural loop is the set of blocks that reach the back edge source without passing the header.

For a `Branch` with join `j`:

- If `j` is the jump target, emit `if (!cond) { fallthrough region }` and continue at `j`.
- If `j` is the fallthrough, emit `if (cond) { target region }` and continue at `j`.
- If `j` is the function exit, both arms return. Emit the smaller arm as `if (cond) {... }` and the other arm after it, without an `else`. This is the early return in `percent_change` and `total`.
- Otherwise emit `if (cond) { target } else { fallthrough }` and continue at `j`. This is `percent_change` at `-O0`, where both arms store `local_4` and meet at the epilogue.

For a loop header:

- If the header ends in a `Branch` with one successor outside the loop, emit `while (cond) { body }`. `total` at `-O0` has this shape: the header compares `local_14` with `local_c` and leaves on `jge`.
- If the header is also the block with the back edge, or the latch exits instead, emit `do { body } while (cond);`. `total` at `-O1` has this shape: block `0x50` adds, increments, compares, and jumps to itself.

An `IndirectJump` ends a block with no successors. `grade` at `-O0` is a real jump table, `jmpq *%rax` through five relative offsets at `.rodata+0x0`, and lesson 33 resolves those targets. Here the lifter prints a note instead. Four blocks at `0x76`, `0x7f`, `0x88`, and `0x91` are reached only through the indirect jump and were not lifted. The practice lab adds the `switch`.

### What -O1 did to the switch

At `-O1` clang did not keep a jump table for `grade`. It computed `score / 10 - 6` and compared the result with 4 as an unsigned number. Then it loaded the return value from a five-entry table of `int` at `.rodata+0x14`. The unsigned compare is one instruction that covers both `score / 10 < 6` and `score / 10 > 10`. A negative difference is a large unsigned value, so it fails the same check.

The table holds `1, 2, 3, 4, 4` for the quotients 6 through 10. The `switch` with five `return` statements became an `if` and an array read. The lifter emits exactly that, and names the table `lookup_14` after its section offset.

The length of the table is a heuristic. `table_values()` reads from the table start to the next `.rodata` offset that any `.text` relocation references, or to the end of the section. In this object the next referenced offset is `0x28`, the table of `grade_label`, so `lookup_14` has `(0x28 - 0x14) / 4 = 5` entries. The unsigned compare against 4 agrees. Ghidra does not know the length either. It wrote `*(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4)`, a byte address plus an offset, and left the five values for the reader to look up.

## Side by Side With Ghidra

The demo prints each pair. The Ghidra text comes from `code/fixtures/ghidra/*.json`, the Evidence records that rea returned on 2026-10-14. The command was `npx -y rea-agents@6.5.0 decompile ledger-x86_64-O1.o <function> --provider ghidra --format json`. Each record carries `confidence: observed` and `authority: shipped-artifact`. The text is observed. The claims inside the text are derived, and the records do not say which ones.

### percent_change

```text
lifter                                         | ghidra
-----------------------------------------------+-----------------------------------------------
int percent_change(int param_1, int param_2)   | undefined1  [16] percent_change(int param_1,int param_2,ulong param_3)
{                                              | {
  if (param_1 == 0) {                          |   long lVar1;
    return 0;                                  |   undefined1 auVar2 [16];
  }                                            |   undefined1 auVar3 [16];
  return (param_2 - param_1) * 100 / param_1;  |   if (param_1 != 0) {
}                                              |     lVar1 = (long)((param_2 - param_1) * 100);
                                               |     auVar3._0_8_ = lVar1 / (long)param_1 & 0xffffffff;
                                               |     auVar3._8_8_ = lVar1 % (long)param_1 & 0xffffffff;
                                               |     return auVar3;
                                               |   }
                                               |   auVar2._8_8_ = 0;
                                               |   auVar2._0_8_ = param_3;
                                               |   return auVar2 << 0x40;
                                               | }
```

| Difference | Instruction or guess |
|---|---|
| Return type `undefined1 [16]` against `int` | Guess. `idivl` writes `%rax` and `%rdx`, and no caller fixes the return width. Both registers were kept. |
| `param_3` | Guess that follows from the first. On the zero path only `%eax` is written, so `%rdx` is read as an input. |
| `lVar1 / (long)param_1 & 0xffffffff` against `/ param_1` | Instruction. `cltd` plus `idivl` is a 64-bit division of a sign-extended 32-bit value, truncated to 32 bits. Both texts describe it. Ours reduced the pair with the `signfill` rule. |
| `lVar1 % (long)param_1` kept | Follows from the return type. The remainder in `%rdx` is dead in our analysis and alive in Ghidra's. |
| `if (param_1 != 0)` with the zero case after it | Instruction order. `je 0xd` jumps to the zero return. Ghidra put the computed arm first, we put the smaller arm first. Both are correct. |
| `return auVar2 << 0x40` | Guess. A 16-byte value with `param_3` in the low half, shifted into the high half, is how the decompiler expresses `%rax = 0` with `%rdx` unknown. |

The repaired version in `code/fixtures/ghidra/ledger-x86_64-O1.ghidra-repaired.c` edits only this function, and the test compares it with the source over 81 input pairs.

### grade

```text
lifter                                         | ghidra
-----------------------------------------------+-----------------------------------------------
static const int lookup_14[5] = {1, 2, 3, 4, 4}; | uint grade(int param_1)
int grade(int param_1)                         | {
{                                              |   uint uVar1;
  int eax_1;                                   |   uint uVar2;
  int ecx_1;                                   |   
                                               |   uVar2 = param_1 / 10 - 6;
  ecx_1 = param_1 / 10 - 6;                    |   uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);
  eax_1 = 0;                                   |   if (uVar2 < 5) {
  if ((unsigned int)ecx_1 <= 4) {              |     uVar1 = *(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4);
    eax_1 = lookup_14[(unsigned long)(unsigned int)ecx_1]; |   }
  }                                            |   return uVar1;
  return eax_1;                                | }
}                                              |
```

| Difference | Instruction or guess |
|---|---|
| `param_1 / 10 - 6` in both | Instruction. Both recognized the `0x66666667` idiom. |
| `uVar1 = -(param_1 >> 0x1f) ^ (uint)(... >> 0x3f)` against `eax_1 = 0` | Instruction `xorl %eax, %eax` at `grade+0x1a`. The register is zero. Ghidra expressed the `xor` as the sign of `param_1` exclusive-or the sign bit of the product, two spellings of the same bit, and did not cancel them. The value is 0 for every `int`, and the test proves it over 141 scores. A reader who trusts the text believes the default depends on the score. |
| `uVar2 < 5` against `(unsigned int)ecx_1 <= 4` | Instruction `cmpl $0x4, %ecx` then `ja`. Same condition. Ghidra typed `uVar2` as `uint`, we cast at the use. |
| `*(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4)` against `lookup_14[...]` | Instruction plus relocation. Ghidra loaded the object with `.rodata` at `0x001000a0`, so `0x001000b4` is `.rodata + 0x14`. It applied the relocation and kept a byte address. We named the table and read its five values. |
| `uint` return against `int` | Guess on both sides. The instructions only say 32 bits. |

### total

```text
lifter                                         | ghidra
-----------------------------------------------+-----------------------------------------------
int total(int *param_1, int param_2)           | int total(long param_1,uint param_2)
{                                              | {
  int eax_1;                                   |   int iVar1;
  int ecx_1;                                   |   ulong uVar2;
  long rdx_1;                                  |   
                                               |   if (0 < (int)param_2) {
  if (param_2 <= 0) {                          |     uVar2 = 0;
    return 0;                                  |     iVar1 = 0;
  }                                            |     do {
  ecx_1 = param_2;                             |       iVar1 = iVar1 + *(int *)(param_1 + uVar2 * 4);
  rdx_1 = 0;                                   |       uVar2 = uVar2 + 1;
  eax_1 = 0;                                   |     } while (param_2 != uVar2);
  do {                                         |     return iVar1;
    eax_1 = eax_1 + param_1[rdx_1];            |   }
    rdx_1 = rdx_1 + 1;                         |   return 0;
  } while ((unsigned long)(unsigned int)ecx_1 != rdx_1); | }
  return eax_1;                                |
}                                              |
```

| Difference | Instruction or guess |
|---|---|
| `int *param_1` against `long param_1` | Inference on our side from `addl (%rdi,%rdx,4), %eax`. Ghidra kept the width. |
| `uint param_2` and `(int)param_2` against `int param_2` | Ghidra chose unsigned because `cmpq %rdx, %rcx` compares the zero-extended count. We kept `int` and cast at the compare. |
| `do { } while` in both | Instruction `jne 0x50` from the block to itself. The compiler rotated the loop. The `-O0` object keeps the `while`. |
| `ecx_1 = param_2` kept against `param_2 != uVar2` | Our substitution rule stays inside one block. The copy `movl %esi, %ecx` is in the setup block and the compare is in the loop, so the variable stays. Ghidra propagated it. |
| `(unsigned long)(unsigned int)ecx_1` | Instruction. `movl %esi, %ecx` zero-extends, and the 64-bit compare reads the full register. |

The behaviour test compiles the Ghidra text for `grade` and `total` unchanged. It adds two `typedef` lines and a definition of `DAT_001000b4` from the twenty bytes at `.rodata+0x14`. Both functions match the source over the grid.

## What the Research Says About Reading Pseudocode

LLM4Decompile (EMNLP 2024) measured Ghidra alone at 20.12 percent re-executability on HumanEval-Decompile. About one in five functions recompiled and passed the assertions that come with the benchmark. Refining Ghidra's output with their 6.7B model raised that to 52.74 percent. DecompileBench (Findings of ACL 2025) ran six industrial decompilers and six LLM approaches on 23,400 functions from 130 programs. The LLM outputs read better and had 52.2 percent lower functionality correctness.

Liu, Raff, and Micinski (arXiv 2609.05370, September 2026) explain the gap. They used 300 GitHub library functions and 287 CVE-grounded functions. The strongest refinement model raised Ghidra's build rate from 75 to 90 percent while the behavioural match rate fell from 74 to 62 percent. Candidates that passed every test in the benchmark still diverged on fuzzed inputs. That happened in 4.9 percent of cases across eight systems, and in up to 13 percent for one system. Up to one tenth of disclosed vulnerabilities disappeared from the refined code.

The cause they trace is simple. Invented fields, types, callees, and guards replaced the visible unknowns that the decompiler had left in the text.

This is the reason the lifter prints `(unsigned long)(unsigned int)ecx_1` instead of a prettier name. It prints a note instead of a `switch` for the unresolved jump, and `lookup_14` instead of a label a model would invent. Every line has a derivation you can read in `code/main.py`. Ghidra's `undefined1 [16]` is ugly and honest. A refinement model's clean `int percent_change(int, int)` is right for the wrong reason. The same model will produce a clean wrong signature on the next function.

## Build It

Run the demo:

```bash
cd phases/13-tools-and-protocols/34-lifting-to-pseudocode
python3 code/main.py
```

The demo decodes all four functions of the `-O1` object and compares every instruction with the committed `llvm-objdump` text. For `percent_change`, `grade`, and `total` it prints the IR before SSA, the SSA listing with phi functions, and the pseudocode next to the Ghidra text. Then it prints `grade` with division recognition switched off, the `-O0` versions of `percent_change`, `total`, and `grade_label`, and a summary:

```json
{
  "functions": ["grade", "grade_label", "percent_change", "total"],
  "instructions": 56,
  "blocks": {"percent_change": 3, "grade": 3, "total": 5, "grade_label": 4},
  "phis": {"percent_change": 0, "grade": 1, "total": 2, "grade_label": 1},
  "objdumpDifferences": 0
}
```

Read `code/main.py` in this order:

1. `read_object()` reads section headers, the symbol table, and the `.rela` sections of an ELF64 relocatable object.
2. `decode_one()` and `render_att()` decode one instruction and print it the way `llvm-objdump` does.
3. `build_blocks()`, `immediate_dominators()`, and `dominance_frontiers()` build the graph facts.
4. `lift_insn()` turns one instruction into IR statements and resolves relocations.
5. `insert_phis()` and `rename()` build SSA and insert width casts.
6. `make_simplifier()`, `substitute_once()`, and `remove_dead_code()` run inside `optimize()`.
7. `collect_params()`, `coalesce_webs()`, and `infer_types()` name and type the webs.
8. `structure()` with `post_dominators()` and `natural_loops()` emits the C body.
9. `lift_function()` ties the stages together and `lift_all()` lifts a whole object with callee signatures.

## Use It

To lift a function from your own object, build it with `clang -target x86_64-unknown-linux-gnu -c` and call `lift_all(read_object(path))`. When the decoder raises `DecodeError`, read the opcode byte from the message and find it in the SDM opcode map. Then add one entry to the tables at the top of the file. When the lifter raises on a mnemonic, add one rule to `lift_insn()`. When the structurer emits a `goto`, print the graph with `IrPrinter` and decide which shape rule is missing. Each addition is small and each one is checked against `llvm-objdump` or clang by the existing tests.

When Ghidra is installed, run rea on the same function and place the two texts side by side. Fill the difference table before you believe either text. A difference with an instruction behind it is a presentation choice. A difference with no instruction behind it is a guess, and the guess can be on either side.

## Interactive Lab

### Lab A: one function through five stages

From the `code` directory, open Python:

```bash
cd phases/13-tools-and-protocols/34-lifting-to-pseudocode/code
python3 -q
```

Run:

```python
from main import *
obj = read_object(FIXTURES / "ledger-x86_64-O1.o")
lifted = lift_function(obj, "percent_change")
for insn in lifted.decoded: print(f"0x{insn.address:x}: {insn.raw.hex(' ')}  {insn.att()}")
print(lifted.ir_text)
print(lifted.ssa_text)
print(lifted.pseudocode)
```

Follow `%esi` from `subl %edi, %esi` to `esi_1 = esi_0 - edi_0` to `(param_2 - param_1)`. The byte `fe` is the ModR/M of the `subl`, with `mod = 11`, `reg = edi`, and `r/m = esi`.

### Lab B: the division idiom

```python
print(lift_function(obj, "grade", recognize_division=False).pseudocode)
print(magic_divisor(0x66666667, 34), magic_divisor(0x66666667, 33), magic_divisor(0x66666667, 31))
```

The first line prints the raw multiply and shifts. The second prints `10 5 None`. Work out why the same multiplier divides by 5 with one shift less, and why shift 31 fails the error bound.

### Lab C: a new object stops the decoder

Build the fixture at `-O2` and lift it:

```bash
clang -target x86_64-unknown-linux-gnu -O2 -fno-asynchronous-unwind-tables -c fixtures/ledger.c -o "$TMPDIR/ledger-O2.o"
python3 -c 'from main import *; from pathlib import Path; import os; lift_all(read_object(Path(os.environ["TMPDIR"]) / "ledger-O2.o"))'
```

The decoder stops at `0x56` with `opcode 81 is outside the fixture subset`. Opcode `81` is the group 1 form with a 32-bit immediate. The instruction is `andl $0x7ffffff8, %edx`, and clang used it in the vectorized loop of `total`. Add it beside `0x83` in `decode_one()`, rerun, and note which opcode stops you next. The subset grows one entry at a time, and each entry is checked against `llvm-objdump`.

### Lab D: Ghidra's default value in grade

```python
print(ghidra_pseudocode("grade"))
for score in (-25, 0, 59, 60, 100, 115):
    sign = -(score >> 31)
    product_sign = ((score * 0x66666667) & ((1 << 64) - 1)) >> 63
    print(score, sign ^ product_sign)
```

Every row prints 0. Ghidra's `uVar1` expression is correct and unreadable, and the instruction `xorl %eax, %eax` says it in two bytes.

## Practice Lab

Add `switch` recovery for `grade` at `-O0`.

Requirements:

- Read the five relocations in `.rela.rodata` of `ledger-x86_64-O0.o`, each `R_X86_64_PC32.text+offset`, and compute the five case targets from the table at `.rodata+0x0`.
- Add a `Switch` terminator to the IR with the index expression, the target list, and the default from the `ja` before the table load.
- Give the switch block one successor per target so that dominators, post-dominators, and SSA keep working.
- Emit `switch (local_10) { case 0:... }` with one `case` per target and the shared epilogue after the join.
- Keep the note for any indirect jump whose table you cannot bound.
- Compile the result with clang and compare it with the source over the score grid in the tests.

Success means `grade` at `-O0` and `grade` at `-O1` produce the same output over the grid, with one `switch` and no `goto`.

## Graded Lab

Five questions about the fixtures of this lesson. Find each answer with the code you built, then write it into `code/lab_answers.json`. Write numbers as numbers or as hex strings such as `"0x40"`, and lists as JSON lists.

1. `t1`: parameters that the calling convention gives percent_change at -O1.
2. `t2`: phi functions in the SSA form of total at -O1.
3. `t3`: the divisor that magic_divisor finds for 0x66666667 with shift 34.
4. `t4`: the last statement of the percent_change pseudocode at -O1, as one line of text.
5. `t5`: the recovered C type of param_1 of total at -O1.

Check your answers:

```bash
cd phases/13-tools-and-protocols/34-lifting-to-pseudocode
python3 code/lab.py
```

The checker computes each expected value from `code/main.py` on the committed fixtures. It prints `PASS`, `FAIL` or `TODO` for each task and a score, and it exits 0 only when all five pass. `python3 code/lab.py my-answers.json` checks another file. `code/tests/test_lab.py` proves that the checker accepts the right answers and rejects a wrong one.

### See it run

The [Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler?opt=O0) machine runs this lesson as its lift press, type pins, structuring jig and printer, with the IR, SSA and pseudocode that `code/main.py` prints. This link opens the `-O0` object: three stack slots become locals and the jig closes both jaws for the if/else.

## Artifact

This lesson produces `outputs/skill-lifting-to-pseudocode.md`. Use it to lift one function with a derivation for every line and to fill the difference table against a decompiler's text. The artifact requires the reference disassembly, the relocations, the calling convention, the compile check, the behaviour comparison, and a verdict for every differing line.

## Verify It

Run the demo and the deterministic suite:

```bash
cd phases/13-tools-and-protocols/34-lifting-to-pseudocode
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

The suite has 25 tests. Verification proves:

- the decoder agrees with the committed `llvm-objdump` text on every instruction of both objects, and with a live `llvm-objdump` when it is installed
- REX, ModR/M, SIB, and the displacement field offset of `leaq (%rip), %rcx` are decoded as the SDM describes
- an opcode outside the subset raises `DecodeError` instead of guessing
- the ELF reader lists the four functions and the three `.text` relocations
- `total` has five blocks, `0x44` dominates `0x50`, and `0x50` is a loop header with itself as the body
- `%rdi` and `%rsi` become `param_1` and `param_2`, and `param_1` in `total` is `int *`
- `test` and `cmp` with `je`, `jle`, `ja`, and `jge` become `==`, `<=`, unsigned `>`, and `<`
- SSA places two live phi functions at the loop header of `total` and none in `percent_change`
- the pseudocode of `percent_change`, `grade`, and `total` equals the expected text
- `grade` reads `param_1 / 10 - 6` with recognition on and the raw multiply with recognition off
- `0x66666667` with shift 34 divides by 10, with shift 33 divides by 5, and the identity holds on the grid
- stack slots at `-O0` become `local_4`, `local_8`, `local_c`, and the frame pointer never appears
- the table at `.rodata+0x14` reads `1, 2, 3, 4, 4` through the relocation
- the indirect jump in `grade` at `-O0` is reported with its four unlifted blocks
- the Ghidra fixtures contain the 16-byte return, the `param_3`, the unsimplified `xor`, and the `long param_1`
- the six emitted units compile with `clang -std=c11 -Wall -Werror` for `x86_64-unknown-linux-gnu`
- the lifted functions, the repaired Ghidra text, and the source print the same 232 lines over the input grid

## Production Failure Modes

| Failure | What the weak reading reports | What the derivation must show |
|---|---|---|
| Decompiler widens the return value | "returns a 16-byte struct" | `idivl` writes `%rdx`, and no caller fixes the width |
| Decompiler adds a parameter | "takes three arguments" | The register is read on one path only because the return width was guessed |
| Idiom goes unrecognized | "multiplies by a magic constant" | The multiplier is the ceiling of `2^s / d` and the error bound holds |
| Idiom is recognized and a `xor` is lost | "default depends on the input" | `xorl %eax, %eax` writes zero, two spellings of one bit cancel |
| Pointer typed as integer | "takes a long" | A scaled 4-byte load from the register is pointer evidence |
| Table length unknown | "reads past the table" | The next referenced offset or the section end bounds it, and the range check agrees |
| Loop shape misread | "while loop" | The header has no exit, the latch jumps back, so it is `do while` |
| Indirect jump guessed | "switch with five cases" | The targets come from `.rela.rodata`, or the jump is reported as unresolved |
| Substitution across a store | "one expression" | A loaded value moved past a store or a call changes meaning |
| Refinement model edits the text | "compiles and looks right" | Build rate up, behaviour match down, invented guards replaced visible unknowns |
| Decoder guesses an unknown opcode | "disassembly looks fine" | `DecodeError` with the address and the byte, then one table entry checked against `llvm-objdump` |

## Operational Rule

Treat pseudocode as a derivation you have not seen. Reproduce it from the instructions with a lifter you can read. Place the two texts side by side, and write the instruction or the guess behind every line that differs. Compile both and run both against the source when you have it. A line without an instruction behind it stays a guess no matter how clean it reads.

## Further Reading

- [Intel SDM Volume 2, chapter 2, Instruction Format](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [System V AMD64 psABI, section 3.2, Function Calling Sequence](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Cytron et al., Efficiently Computing Static Single Assignment Form and the Control Dependence Graph, TOPLAS 1991](https://doi.org/10.1145/115372.115320)
- [Cooper, Harvey, Kennedy, A Simple, Fast Dominance Algorithm, 2001](https://www.cs.tufts.edu/~nr/cs257/archive/keith-cooper/dom14.pdf)
- [Cifuentes, Reverse Compilation Techniques, PhD thesis, QUT 1994](https://eprints.qut.edu.au/36820/)
- [Yakdan et al., No More Gotos, NDSS 2015](https://www.ndss-symposium.org/ndss2015/ndss-2015-programme/no-more-gotos-decompilation-using-pattern-independent-control-flow-structuring-and-semantics/)
- [Granlund, Montgomery, Division by Invariant Integers using Multiplication, PLDI 1994](https://doi.org/10.1145/178243.178249)
- [Lee, Avgerinos, Brumley, TIE, NDSS 2011](https://www.ndss-symposium.org/ndss2011/tie-principled-reverse-engineering-of-types-in-binary-programs/)
- [Noonan, Loginov, Cok, Polymorphic Type Inference for Machine Code, PLDI 2016](https://arxiv.org/abs/1603.05495)
- [LLM4Decompile, EMNLP 2024](https://arxiv.org/abs/2403.05286)
- [DecompileBench, Findings of ACL 2025](https://aclanthology.org/2025.findings-acl.1194/)
- [Liu, Raff, Micinski, When LLM Decompilers Recompile More and Preserve Less, 2026](https://arxiv.org/abs/2609.05370)
- [rea 6.5.0 Ghidra provider notes](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/ghidra-provider.md)
- rea 6.5.0 source at tag `3b79af2` that this lesson describes: `src/domain/functionComparisonDimensions.ts`, `website/evidence/dx-ball-sound-pan.md`.
