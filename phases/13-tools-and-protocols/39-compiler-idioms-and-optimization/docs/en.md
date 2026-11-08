# Compiler Idioms: What Optimization Does to Your Code and How to Read It Back

> An optimizing compiler replaces source constructs with cheaper instruction shapes. Each shape has a derivation, and this lesson builds the recognizer that runs the derivation backwards and checks it against the source.

**Type:** Build
**Languages:** Python, C, x86-64 assembly, AArch64 assembly
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode), Phase 13 · 38 (calling conventions)
**Time:** ~150 minutes

## Learning Objectives

- Derive the magic number and shift for division by any constant with the Granlund-Montgomery bound, and recover the divisor from the constants clang emitted.
- Name the five ways LLVM lowers a `switch` and read the entry count, the table location, and the entries from the object.
- Read a vectorized loop as lanes, accumulators, elements per iteration, trip-count mask, reduction, and remainder loop.
- Recognize tail calls, inlined callees, branchless selects, and loops that became `memset` or `memcpy`.
- Report every idiom with its evidence instructions and its decoded source form, on x86-64 and on AArch64, at `-O0` through `-O3`.
- Compare the result with what Ghidra, angr, radare2, rizin, and lldb show for the same bytes.

## The Problem

You compiled `idioms.c` at `-O2` and asked an agent what `div7u` does. The agent read `imulq $0x24924925, %rax, %rax` and answered that the function multiplies by 613566757, shifts, and adds. Every word is true. The function computes `x / 7`.

The same object holds a `switch` with seven cases that has no jump at all, a `switch` with five cases that is a jump table, a `switch` with two cases that is a `sete` and a `cmovne`, and a loop over `n` integers that runs eight integers per iteration in two `xmm` registers and then finishes the rest in a second loop. At `-O0` the same source produced `divl`, seven-entry jump tables, and one scalar loop. At `-O1` the seven-case switch became a table of values and the vector loop did not exist yet.

These shapes are idioms. A compiler emits each one from a rule you can read in its source, and each one can be decoded back to the construct it came from. The decoding is arithmetic, and arithmetic can be checked. Lesson 34 proved one of them, the multiply by `0x66666667`. This lesson builds the recognizer for all of them, runs it over 18 builds of our own code, and verifies all 373 reports against the C source.

```figure
re-39-idioms-by-level
```

## An Idiom Is a Shape With a Derivation

An idiom is a sequence of instructions the compiler emits for one source construct. Three things make it recognizable. It has a fixed shape, the operands carry constants that the derivation predicts, and the shape differs from what a programmer would write by hand.

The recognizer in `code/main.py` works on the text of `llvm-objdump -d -r`, which lesson 33 established as the oracle for instruction boundaries. It parses each function into instructions with address, bytes, mnemonic, operands, and the relocation line that follows it. It reads the object file for two things only: the bytes of `.rodata`, where value tables live, and the `.rela.rodata` entries, where jump-table targets live before linking.

Every detection is an `Idiom` record with a `kind`, a decoded `source` form, a list of `evidence` addresses, a `detail` dictionary, and a `verified` flag. The flag comes from the C source. `parse_source()` reads `idioms.c`, finds each function, and extracts the divisors after `/` and `%`, the multipliers after `*`, the `switch` cases and their values, the `? :` operators, the `for` loops, and the callees. A division idiom is verified when its divisor is in the function's division list. A lookup table is verified when its entries match the case values, up to a constant factor. A tail call is verified when the callee is called in the source. The demo report ends with an `unverified` list, and the test suite asserts that the list is empty for all 18 builds.

Decoding needs names. The recognizer runs a small symbolic evaluator over each function's basic blocks, in listing order, with the parameter names from the source in the argument registers of the System V and AAPCS64 conventions from lesson 38. Stack slots are tracked by their operand text so `-O0` code reads through its spills. At each block entry the states of the predecessors are merged, and where they differ a name that an earlier idiom assigned wins over a constant. That is how `cmovll %edx, %eax` in `digest` reads back as `sum % 10 < 5 ? sum % 10 : 5`: the loop idiom named the accumulator `sum`, the division idiom named its quotient `sum / 10`, and the modulo idiom named its result `sum % 10`. The source writes `rem > 5 ? 5 : rem`. Both expressions give the smaller of `rem` and 5, and they agree at `rem == 5`.

## Division by a Constant

Granlund and Montgomery, "Division by Invariant Integers using Multiplication" (PLDI 1994), replace `n / d` with a multiply and a shift. Pick a shift `s` and a multiplier `m = ceil(2^s / d)`. Then `floor(n * m / 2^s)` equals `floor(n / d)` for every `n` in range when the error `e = m * d - 2^s` is small enough. For unsigned 32-bit `n` the bound is `e <= 2^(s - 32)`. For signed `n` with `|n| < 2^31` the bound is `e <= 2^(s - 31)`, and a sign fix-up adds 1 when `n` is negative, because the floor rounds the wrong way for negative quotients.

`magic_numbers(d, bits, signed)` in `main.py` searches `s` upward from 32 and returns the first pair that satisfies the bound. That search reproduces every constant clang emitted in the fixtures.

### Unsigned 10 by hand

`2^35 / 10 = 3435973836.8`. The ceiling is `3435973837 = 0xCCCCCCCD`. The error is `0xCCCCCCCD * 10 - 2^35 = 2`, and the bound at `s = 35` is `2^3 = 8`. At `s = 34` the error would be 6 against a bound of 4, so 35 is the smallest shift. Check with `n = 123`: `123 * 3435973837 = 422624781951`, and `422624781951 >> 35 = 12`.

clang emits exactly this for `div10u` at `-O2` on x86-64:

```text
       0: 89 f9                        	movl	%edi, %ecx
       2: b8 cd cc cc cc               	movl	$0xcccccccd, %eax
       7: 48 0f af c1                  	imulq	%rcx, %rax
       b: 48 c1 e8 23                  	shrq	$0x23, %rax
```

`0x23` is 35. The `movl %edi, %ecx` zero-extends the 32-bit argument into a 64-bit register, which is the unsigned form. The recognizer reads the multiplier from the `movl $imm` that feeds the two-operand `imulq`, reads the shift, and calls `divisor_from_magic(0xCCCCCCCD, 35)`. That function tries `2^35 // m = 10` and 11, and accepts 10 because `magic_numbers(10)` gives the same multiplier and shift back.

On AArch64 the same function is `mov w8, #0xcccd; movk w8, #0xcccc, lsl #16; umull x8, w0, w8; lsr x0, x8, #35`. The constant arrives in two 16-bit halves, the multiply is `umull`, and the shift is written in decimal. The recognizer assembles the halves and reports the same divisor.

### Unsigned 7 by hand, with the add fix-up

`2^35 / 7 = 4908534052.57`. The ceiling is `4908534053 = 0x124924925`, which needs 33 bits. The error is 3 against a bound of 8, so the shift is 35, and no smaller shift works. A 32-bit multiply cannot hold the multiplier, so the compiler multiplies by the low 32 bits `0x24924925` and adds the dividend back in a fixed sequence:

```text
      32: 48 69 c0 25 49 92 24         	imulq	$0x24924925, %rax, %rax
      39: 48 c1 e8 20                  	shrq	$0x20, %rax
      3d: 29 c7                        	subl	%eax, %edi
      3f: d1 ef                        	shrl	%edi
      41: 01 f8                        	addl	%edi, %eax
      43: c1 e8 02                     	shrl	$0x2, %eax
```

Read it as `t = (n * 0x24924925) >> 32`, then `q = (((n - t) >> 1) + t) >> 2`. The total shift is `32 + 1 + 2 = 35`. With `n = 100`: `t = 14`, `(100 - 14) >> 1 = 43`, `43 + 14 = 57`, `57 >> 2 = 14`. The recognizer detects the `sub`, `shr`, `add`, `shr` tail after a 32-bit shift, adds `2^32` back to the multiplier, and recovers 7. `evaluate_division()` runs this exact sequence and the test checks it against `n // 7` on the 32-bit edge values. The AArch64 form is `sub w9, w0, w8; add w8, w8, w9, lsr #1; lsr w0, w8, #2`, one instruction shorter because the shifted add is one instruction.

### Signed 3 by hand

`2^32 / 3 = 1431655765.33`, ceiling `1431655766 = 0x55555556`, error 2, and the signed bound at `s = 32` is `2^1 = 2`. The bound holds with no room to spare, so the shift is 32 and clang uses `shrq $0x20`. With `n = -7`: the product is `-10021590362`, the arithmetic shift by 32 gives `-3`, the sign bit is set, so the fix-up adds 1 and the result is `-2`, which is `-7 / 3` in C. The signed fixtures `div10s` and `div3s` both carry the fix-up as `shrq $0x3f` on a copy of the product followed by `addl`.

### What the constants are not

The multiplier alone names no divisor. `0x66666667` with shift 34 is 10. The same multiplier with shift 33 is 5, as lesson 34 showed. The recognizer therefore always pairs the multiplier with the total shift, and the `clangMatchesAlgorithm` field records that the pair is the one the search produces. Powers of two never use the multiply. `magic_numbers()` refuses them, because the compiler emits a shift with a sign bias instead, and `mod8s` in the next section shows that shape.

### The idiom belongs to the instruction selector

At `-O0`, `div10u` is `movl $0xa, %ecx; xorl %edx, %edx; divl %ecx`. `div10s` is `cltd; idivl %ecx`. In the same object, `digest` divides its loop sum by 10 with `imulq $0x66666667`. One flag explains the difference. The fixture `idioms-x86_64-nofastisel-O0.o` was built with `-O0 -mllvm -fast-isel=false`, and in it every division is the multiply, including `div10u` with `movl $0xcccccccd, %ecx; imulq %rcx, %rax; shrq $0x23`. The hardware divide is the fast instruction selector's choice at `-O0`. The multiply is SelectionDAG's lowering, which is what LLVM's `UnsignedDivisionByConstantInfo` and `SignedDivisionByConstantInfo` produce. The `digest` block that holds the division also holds a `switch`, and that block went to SelectionDAG. The recognizer reports both forms, `hardware idivl` and `magic multiply`, and the figure shows the mixed `-O0` function.

## Modulo Follows the Quotient

`x % d` is `x - (x / d) * d`. The compiler computes the quotient with the idiom above, multiplies it back, and subtracts. On x86-64 the multiply back by 10 is `addl %ecx, %ecx; leal (%rcx,%rcx,4), %ecx`, which is `2 * q * 5`. On AArch64 it is one instruction, `msub w0, w8, w9, w0`, which computes `w0 - w8 * w9` with `w9 = 10`. The recognizer follows the quotient register through copies, tracks the accumulated factor through `add`, `lea`, `shl`, and `imul`, and accepts a `sub` when the factor equals the divisor.

When the same quotient also feeds another expression, both idioms stay in the report. At `-O1` the compiler computes `sum / 10` once in `digest` and uses it for the `switch` index and for the modulo. On x86-64 it even combines the quotient twice, `leal (%rax,%rsi), %edi` for the modulo and `addl %esi, %eax` for the switch. The recognizer reports one division and one modulo and marks the quotient as shared. A report that lost the division here would make the `switch` index unreadable.

Signed modulo by a power of two has its own shape, because the quotient is never computed:

```text
      92: 8d 48 07                     	leal	0x7(%rax), %ecx
      95: 85 ff                        	testl	%edi, %edi
      97: 0f 49 cf                     	cmovnsl	%edi, %ecx
      9a: 83 e1 f8                     	andl	$-0x8, %ecx
      9d: 29 c8                        	subl	%ecx, %eax
```

For a negative `x` the code biases by 7 before masking, so that the truncation rounds toward zero as C requires. The masked value is `x` rounded to a multiple of 8, and the subtraction leaves `x % 8`. AArch64 does it with `negs w8, w0; and w9, w0, #0x7; and w8, w8, #0x7; csneg w0, w9, w8, mi`: mask both `x` and `-x`, then pick and negate by the sign. Ghidra names its rule for this `RuleSignMod2nOpt`, with the brief "Convert INT_SREM forms: `(V + (sign >> (64-n)) & (2^n-1)) - (sign >> (64-n)) => V s% 2^n`".

At `-O0` AArch64 writes modulo as `sdiv w9, w8, w10; mul w9, w9, w10; subs w0, w8, w9`. The recognizer accepts that form too and reports `hardware sdiv + mul + subs`.

## Five Ways to Lower a switch

LLVM decides the shape of a `switch` in two places. `SimplifyCFG::simplifySwitchLookup` runs at `-O1` and above and turns a switch whose cases all produce constants into a table of values, when there are at least three cases and the target can build lookup tables. Its table kinds are `SingleValueKind`, `LinearMapKind`, `BitMapKind`, and `ArrayKind`. The `-O0` pipeline never runs this pass. The remaining switches reach `SwitchLowering::findJumpTables` in instruction selection, which builds a jump table when the cluster has at least `min-jump-table-entries` entries, 4 by default, and is dense enough: `NumCases * 100 >= Range * MinDensity` with `jump-table-density` 10 for normal functions and 40 under `-Os`. What is left becomes a binary search over the case constants, with `splitWorkItem` choosing the pivot. The fixtures hold one function per outcome.

| Function | Source | `-O0` x86-64 | `-O2` x86-64 | `-O2` AArch64 |
|---|---|---|---|---|
| `linear_switch` | cases 0 to 6 return 10 to 70 | jump table, 7 entries | linear map `10*k + 10`, default -1 | `madd` and `csinv` |
| `table_switch` | cases 0 to 6 return 10 to 60 then 71 | jump table, 7 entries | lookup table at `.rodata+0x28` | lookup table at `.rodata+0x0` |
| `call_switch` | cases 0 to 4 call one of five pointers | jump table, 5 entries | jump table, 5 entries | comparison tree, pivot 1 |
| `sparse_switch` | cases 1, 100, 10000, 1000000, 100000000 | compare chain | comparison tree, pivot 9999 | comparison tree, pivot 9999 |
| `two_cases` | cases 3 and 4 return 7 and 9 | compare chain | select chain `k != 3 ? (k == 4)*9 : 7` | two `csel` |

### The lookup table, read from the object

`table_switch` at `-O2`:

```text
      d0: b8 ff ff ff ff               	movl	$0xffffffff, %eax
      d5: 83 ff 06                     	cmpl	$0x6, %edi
      d8: 77 0c                        	ja	0xe6 <table_switch+0x16>
      da: 89 f8                        	movl	%edi, %eax
      dc: 48 8d 0d 00 00 00 00         	leaq	(%rip), %rcx
		00000000000000df:  R_X86_64_PC32	.rodata+0x24
      e3: 8b 04 81                     	movl	(%rcx,%rax,4), %eax
      e6: c3                           	retq
```

The bounds check `cmpl $6; ja` means 7 valid entries. The relocation addend `0x24` plus the 4 bytes of the RIP-relative field puts the table at `.rodata+0x28`, the rule lesson 33 derived. The bytes there are `0a 00 00 00 14 00 00 00 ...`, so the entries are `[10, 20, 30, 40, 50, 60, 71]`, and they equal the source case values. The assembler named this table `.Lswitch.table.table_switch` in the `.s` file, with a comment `@switch.table.table_switch`. In the object only the relocation and the bytes remain. There is no jump, so the control-flow graph has three blocks.

The AArch64 form puts the table address together with `adrp x8` and `add x8, x8, #0x0`, each carrying its own relocation to `.rodata`, and loads with `ldr w0, [x8, w0, uxtw #2]`. The recognizer reads the addend from the `add` relocation.

### The linear map, with no table at all

`linear_switch` returns `10 * (k + 1)` for `k` in 0 to 6. `simplifySwitchLookup` detects the affine relation and emits arithmetic:

```text
      b0: 83 ff 07                     	cmpl	$0x7, %edi
      b3: 8d 04 bf                     	leal	(%rdi,%rdi,4), %eax
      b6: 8d 4c 00 0a                  	leal	0xa(%rax,%rax), %ecx
      ba: b8 ff ff ff ff               	movl	$0xffffffff, %eax
      bf: 0f 42 c1                     	cmovbl	%ecx, %eax
```

The evaluator reads `leal (%rdi,%rdi,4)` as `5*k`, `leal 0xa(%rax,%rax)` as `10*k + 10`, and the `cmovb` after `cmpl $7` as `k < 7 ? 10*k + 10 : -1`. The recognizer then checks the formula against every source case and marks the idiom verified. AArch64 reaches the same expression with `madd w8, w0, w8, w9` and `csinv w0, w8, wzr, lo`, where `csinv` with `wzr` yields `-1` on the default path.

### The jump table, read from relocations

`call_switch` at `-O2` is the shape lesson 33 recovered in `grade` at `-O0`: `cmpl $4; ja`, a `leaq` to `.rodata-0x4`, a `movslq` of a 4-byte entry, `addq`, and `jmpq *%rax`. The five entries are relocations in `.rela.rodata`, and `target = addend - 4k` gives `0x10c, 0x107, 0x10e, 0x110, 0x109`, five distinct blocks that each tail-jump through a function pointer. The `dispatch` fixture scales this to 16 cases: 16 relocation entries on x86-64, and on AArch64 a compressed table of 16 single bytes read with `ldrb w11, [x9, x8]`, scaled by 4 with `add x10, x10, x11, lsl #2`, and based on an `adr` of the first case block. The recognizer decodes `[0x24, 0x74, 0x54, ...]` from the byte table and reports `compressed: true`.

### The same switch at four levels

`digest` holds a switch on `sum / 10` with cases 6 to 10 and values 1, 2, 4, 8, 8, then multiplies the result by 16. On x86-64 it is a jump table at `-O0`, a lookup table at `-O1` with entries `[16, 32, 64, 128, 128]`, and a jump table again at `-O2` and `-O3` whose four case blocks store `0x10`, `0x20`, `0x40`, `0x80`. From `-O1` upward the multiplication by 16 has moved into the cases. At `-O0` the cases store 1, 2, 4, and 8, and the multiplication stays after the switch. For the `-O1` lookup table the recognizer compares the entries with the source values, finds a constant ratio, and reports `foldedFactor: 16`. On AArch64 the `-O2` form is a comparison tree with a pivot at 8, equality tests for 6, 7, and 8, and a range test `sub w9, w9, #9; cmp w9, #2; b.hs` that covers cases 9 and 10 in two instructions. The recognizer reports `rangeTests: [[9, 10]]`.

Two flags move these boundaries. `-fno-jump-tables` turns `table_switch`, `call_switch`, and the `digest` switch into comparison trees on x86-64, with pivots 2 and 4 for the seven-case function. On AArch64, `-mllvm -min-jump-table-entries=4` leaves `call_switch` as a comparison tree, so on that target the entry count was not the deciding input for a five-case switch of indirect calls. The fixture `idioms-arm64-jt4-O2.o` records that run.

GCC puts both decisions in `tree-switch-conversion.cc`, with the classes `jump_table_cluster`, `bit_test_cluster`, `switch_decision_tree`, and `switch_conversion`. Its `-ftree-switch-conversion` is on at `-O2`, `-fjump-tables` and `-fbit-tests` at `-O1`, and the jump table threshold comes from `case-values-threshold`, whose default is the machine's value. No GCC is installed on this machine, so those names come from the GCC source and manual, and Compiler Explorer is where you check them.

## Loops: Vectorized, Unrolled, or Replaced

LLVM's loop vectorizer is on at `-O2`, `-O3`, and `-Os`, and off at `-O0` and `-O1`, a rule that dates to LLVM 3.4 in January 2014. `sum_n` at `-O2` shows every part of the shape:

```text
     1f6: 83 fe 07                     	cmpl	$0x7, %esi
     1f9: 77 09                        	ja	0x204 <sum_n+0x14>
     206: 81 e2 f8 ff ff 7f            	andl	$0x7ffffff8, %edx
     230: f3 0f 6f 14 37               	movdqu	(%rdi,%rsi), %xmm2
     235: 66 0f fe c2                  	paddd	%xmm2, %xmm0
     239: f3 0f 6f 54 37 10            	movdqu	0x10(%rdi,%rsi), %xmm2
     23f: 66 0f fe ca                  	paddd	%xmm2, %xmm1
     243: 48 83 c6 20                  	addq	$0x20, %rsi
     24a: 75 e4                        	jne	0x230 <sum_n+0x40>
     24c: 66 0f fe c8                  	paddd	%xmm0, %xmm1
     250: 66 0f 70 c1 ee               	pshufd	$0xee, %xmm1, %xmm0
     262: 66 0f 7e c8                  	movd	%xmm1, %eax
     270: 03 04 97                     	addl	(%rdi,%rdx,4), %eax
     279: 75 f5                        	jne	0x270 <sum_n+0x80>
```

The guard `cmpl $7; ja` sends trip counts below 8 to the scalar loop. The mask `andl $0x7ffffff8` rounds the trip count down to a multiple of 8. The body loads 32 bytes per iteration into two `xmm` accumulators, four 32-bit lanes each, so the vectorization factor is 4 and the interleave factor is 2. After the loop, `paddd`, two `pshufd`, two more `paddd`, and `movd` reduce the eight lanes to one integer. The loop at `0x270` is the scalar remainder for the last 0 to 7 elements. The recognizer finds the loop from its back edge, sees the SIMD registers, reads the lane count from `paddd`, counts distinct accumulators, divides the step `0x20` by 4, and reports `4 lanes x 2 accumulators = 8 elements per iteration`, with the mask, the guard, the reduction, and the remainder loop as fields. AArch64 does the same with `ldp q2, q3`, two `add v.4s`, `addv s0, v0.4s`, and `fmov w8, s0`.

A fixed trip count removes the loop. `sum4` is one `movdqu`, the reduction, and `movd`, with no back edge. `poly8` cannot vectorize, because each iteration depends on the previous accumulator, so the compiler unrolls it eight times: eight loads at offsets 0 through `0x1c` from `%rdi`, each followed by a shift by 5 and a subtract that compute `acc * 31`. The recognizer counts the loads at consecutive offsets from one base and reports `loop unrolled by 8, no back edge`. On AArch64 the same loads arrive as four `ldp` pairs.

Turn the vectorizer off with `-fno-vectorize -fno-slp-vectorize` and `sum_n` becomes a scalar loop unrolled by 8, with eight `addl k(%rdi,%rdx,4), %eax` and `addq $8`, plus a remainder loop. `sum4` becomes four adds. The recognizer reports `unrolled loop` with `copies: 8` and `indexStep: 8` for the first and `copies: 4` for the second.

Lesson 33 found two back edges in `total` at `-O2` and called them two loops. This lesson names them: one vector body and one scalar remainder of the same source loop. A back edge is a loop only when its target can reach it again. `is_loop()` checks that, because `digest` on AArch64 contains backward branches to a shared default block that are not loops, and the first version of the recognizer counted them as vector loops.

### Loops that become library calls

`LoopIdiomRecognize` turns a loop that stores zero into every byte into a call to `memset`, from `-O1` upward. `fill` at `-O2` is `testl %esi, %esi; jle; movl %esi, %edx; xorl %esi, %esi; jmp memset@PLT`. The call is a tail jump with the relocation `R_X86_64_PLT32 memset-0x4`, and the function's `retq` is only on the empty path. The recognizer reports `store loop recognized as memset(...)` and verifies it against the source loop, because the source never names `memset`.

`copy16` calls `memcpy` with a constant 16, and the x86 backend expands it inline as `movups (%rsi), %xmm0; movups %xmm0, (%rdi)`, within its limit of 8 stores per `memcpy`. At `-O0` the same call is two 8-byte `movq` pairs. With `-fno-builtin` the call stays a call, `jmp memcpy@PLT` with `movl $0x10, %edx`, and `fill` keeps its loop, which the vectorizer then turns into a loop of two 16-byte `movups` stores per iteration. The recognizer reports `vectorized store loop: 2 x 16-byte stores = 32 bytes per iteration` for that build.

## Calls That Disappear or Become Jumps

`tail_caller` returns `tail_target(x + 1)`. At `-O0` it is `addl $0x1, %edi; callq tail_target@PLT; addq $0x10, %rsp; popq %rbp; retq`. At `-O2` it is `incl %edi; jmp tail_target@PLT` and nothing else. The caller's frame is gone and the callee returns to the caller's caller. On AArch64 the jump is `b tail_target` with `R_AARCH64_JUMP26`. The recognizer treats a `jmp` or `b` that carries a call relocation as a tail call. Lesson 33's recursive descent must treat it as a function exit, because the target is outside the function.

`twice_sum` calls `leaf_add`. At `-O0` the call is there, `callq leaf_add@PLT`. From `-O1` the body of `leaf_add`, `leal (%rdi,%rsi), %eax`, appears inside `twice_sum` and no call remains. At `-O0` clang marks every function `optnone` and `noinline` and runs only the always-inliner. The recognizer knows from the source that `twice_sum` calls `leaf_add`, finds no call or tail jump to it, and then looks for the callee's body shape in the caller: the mnemonic and source operands with the destination removed, so `add w8, w1, w0` in the AArch64 caller matches `add w0, w1, w0` in the callee. One match is the evidence.

`dispatch` combines both: a 16-entry jump table whose every case is `movl %esi, %edi; jmp fN@PLT`. The recognizer reports one switch and 16 tail calls, all verified against the 16 calls in the source.

## Branches That Became Data Moves

`clamp_max` is `movl %esi, %eax; cmpl %esi, %edi; cmovgl %edi, %eax`. The evaluator names `%edi` as `a` and `%esi` as `b`, records the compare, and reads the `cmovg` as `a > b ? a : b`, which is the source text. `abs_int` is `movl %edi, %eax; negl %eax; cmovsl %edi, %eax` and reads as `-x < 0 ? x : -x`; AArch64 writes it as `cmp w0, #0; cneg w0, w0, mi` and reads as `x < 0 ? -x : x`. `is_pos` is `xorl %eax, %eax; testl %edi, %edi; setg %al`, which reads as `(x > 0)`. These are `-fif-conversion` in GCC's words and `cmov` selection in LLVM's. LLVM's `X86CmovConversion` pass can turn a `cmov` back into branches when it judges that profitable, which is why the same source can show either shape in a loop.

At `-O0` none of these exist. `clamp_max` is a compare, a `jle`, two stores to the same slot, and a load. The recognizer reports nothing for it at `-O0` and `branchless select` from `-O1`, which is one of the facts the figure makes visible.

`mul9` is one `leal (%rdi,%rdi,8), %eax`, and the recognizer reports `strength reduction` with `x * 9`, because the source multiplies by 9. It only does so when the source has the factor; a `lea` that scales a table index is not a multiplication.

## Two Hardening Features That Look Like Idioms

The stack protector is a compiler feature, and it leaves a shape that an agent will otherwise read as program logic. `canary.c` compiled with `-fstack-protector-strong` for x86-64 Linux gives:

```text
       7: 64 48 8b 04 25 28 00 00 00   	movq	%fs:0x28, %rax
      10: 48 89 44 24 40               	movq	%rax, 0x40(%rsp)
      26: 64 48 8b 0c 25 28 00 00 00   	movq	%fs:0x28, %rcx
      2f: 48 3b 4c 24 40               	cmpq	0x40(%rsp), %rcx
      34: 75 05                        	jne	0x3b <with_canary+0x3b>
      3b: e8 00 00 00 00               	callq	0x40 <plain_leaf>
		000000000000003c:  R_X86_64_PLT32	__stack_chk_fail-0x4
```

`%fs:0x28` is `stack_guard` in glibc's `tcbhead_t`, at byte offset 40, and LLVM's `getIRStackGuard` names that slot for glibc, bionic, and Fuchsia. The prologue copies the guard above the buffer, the epilogue compares, and the failure path calls `__stack_chk_fail`. On AArch64 Linux the guard comes from the global `__stack_chk_guard` through the GOT with `adrp` and `ldr`, and the failure is `bl __stack_chk_fail`. The recognizer reports the guard source, the slot, the compare, and the fail call. `plain_leaf`, which has no array, has no canary under `strong`, which protects functions with arrays, `alloca`, or address-taken locals. The research notes also record the MSVC form under `/GS`, a cookie mixed with `%rsp` and checked by `__security_check_cookie`; no MSVC linker exists on this machine, so that shape is described from the compiler's assembly output only.

`-fcf-protection=full` puts `endbr64`, bytes `f3 0f 1e fa`, as the first instruction of every function. It is a landing pad for indirect branches on processors with control-flow enforcement, and it executes as a `nop` elsewhere. Ghidra's x86-64 function-start patterns include the `endbr64` prefixed variants of `push rbp; mov rbp, rsp` for this reason. The recognizer reports it as `cet landing pad`, so a function that starts with four unusual bytes is not mistaken for data.

## What the Decompilers Fold

Every decompiler in lesson 37 runs some of these derivations as rewrite rules. Ghidra's decompiler names them in `ruleaction.cc`. `RuleDivOpt` is "Convert INT_MULT and shift forms into INT_DIV or INT_SDIV", with the forms `sub( (zext(V)*c), d) >> e => V / (2^n/(c-1)) where n = d*8 + e` and the signed variant with `sext` and `s>>`. `RuleModOpt` is "Simplify expressions that optimize INT_REM and INT_SREM". `RuleDivTermAdd` handles the add fix-up, `RuleSignDiv2` turns `(V + -1*(V s>> 31)) s>> 1` into `V s/ 2`, and `RulePositiveDiv` turns a signed division of values with clear sign bits into the unsigned one. Lesson 37 captured Ghidra 12.1.4 on lesson 33's `grade` at `-O1`, and the output reads `uVar2 = param_1 / 10 - 6;`. The division is folded.

The input to those rules is visible without Java. The venv's pypcode 4.0.1 lifts with the same SLEIGH specification Ghidra uses, and `code/fixtures/idioms-x86_64-O2.lifts.json` holds the raw P-code for `div10s`: 112 entries for seven instructions, of which 7 are the `IMARK` markers that open each instruction, among them `RAX = RAX * unique[95a00:8]` after `unique[95a00:8] = sext(0x66666667)`, `RCX = RCX >> unique[d1a00:4]`, and `RAX = RAX s>> unique[c5c00:4]`. The `shrq` carries 41 operations and the `sarq` carries 40, and most of them compute the flags. `RuleDivOpt` matches the multiply and the two shifts in this stream, and dead-code elimination removes the flags that nothing reads.

angr 10.0.3 ran on our `-O2` object, and `idioms-x86_64-O2.angr.json` holds its decompiler output for 20 functions. It folds the unsigned form: `div10u` is `return a0 / 10;`. It does not fold the signed form: `div10s` is `v1 = a0 * 1717986919; return ((long long)(v1) >> 0x22) + (v1 >> 63);` and `mod10s` is `a0 - (...) * 2 * 5`. For `div7u` it prints `(a0 / 7 + ((a0 * 6 / 7 & 0xffffffff) >> 1 & 0xffffffff) & 0xffffffff) >> 2`, where the fix-up terms survive as arithmetic. It folds `mul9` to `a0 * 9`, `linear_switch` to `(a0 < 7 ? a0 * 10 + 10 : 0xffffffff)`, `clamp_max` to `((int)a1 < (int)a0 ? a0 : a1)`, `is_pos` to `a0 > 0`, and `fill` to `return memset(a0, 0, a1);`. It prints `table_switch` as a load `*(int *)(4 * a0 + 4195400)` without the values, `sum_n` with `_mm_add_epi32` and `_mm_shuffle_epi32` intrinsics, and `tail_caller` as `tail_target(); return;` with the argument lost. In `digest` the jump table becomes `goto *((void *)(...))` with the table arithmetic written out.

radare2 6.2.4 and rizin 0.9.1, built from source into the research cache, were run on the same object. radare2's `pdc` prints `div10s` as `rax = rax * 0x66666667; rcx >>>= 0x3f; rax >>= 0x22; eax += ecx`, register-level pseudo-C with no folding, and `table_switch` as `eax = dword [rcx + rax*4]` with a `RELOC 32 .rodata` comment on the `lea`. rizin has no built-in decompiler; its `aoi` prints the RzIL of the `imul` as a 128-bit product. lldb-1703.0.236.21 loads the ELF object and its `disassemble -n div10s` prints the same seven instructions as `llvm-objdump`, because both use LLVM's disassembler. Capstone 5.0.7 decodes the same bytes and reports groups such as `ret` and `mode64`; it is a decoder, and an idiom is never in a decoder's output. IDA Pro and Binary Ninja were not run here. Their documentation describes the stages where such rewriting happens, microcode optimization and the MLIL to HLIL passes, and this lesson makes no claim about which idioms they fold.

Compiler Explorer is the tool for the forward direction. Paste `idioms.c`, pick a compiler entry such as "x86-64 clang 18.1.0" or "ARM64 GCC 14.2.0", and set the flags. The service lists about 1,050 C compiler entries and has an API: `GET /api/compilers/c` returns the identifiers and `POST /api/compiler/<id>/compile` returns the assembly as JSON. Matt Godbolt's 2019 ACM Queue article walks through the division, population count, chained conditional, and summation idioms with this tool. Use it for GCC output, which this machine cannot produce, and compare GCC's jump table thresholds and `-O2` vectorization defaults from GCC 12 with the clang output in the fixtures.

## Build It

Run the demo:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization
python3 code/main.py
```

The output is one JSON report. For each of the 18 builds it lists every function and its idioms, with kind, source form, evidence addresses, verification, and the detail fields. It ends with a kind matrix per build, the `-O2` versus `-O3` comparison for both architectures, and the `unverified` list.

Expected shape:

```json
{
  "builds": {
    "idioms-x86_64-O2": {
      "arch": "x86_64", "level": "O2", "flags": "x86_64",
      "functions": {
        "div7u": [{"kind": "division", "source": "x / 7", "evidence": ["0x30", "0x32", "0x39", "0x3d", "0x3f", "0x41", "0x43"], "verified": true, "form": "magic multiply with add fix-up", "magic": "0x24924925", "effectiveMagic": "0x124924925", "shift": 35, "...": "..."}],
        "table_switch": [{"kind": "switch", "source": "switch (k) as lookup table", "table": ".rodata+0x28", "entries": 7, "values": [10, 20, 30, 40, 50, 60, 71], "...": "..."}],
        "sum_n": [{"kind": "vector loop", "lanes": 4, "accumulators": 2, "elementsPerIteration": 8, "...": "..."}]
      }
    }
  },
  "kindMatrix": {"idioms-x86_64-O2": {"division": 5, "modulo": 3, "switch": 6, "vector loop": 3, "...": "..."}},
  "sameCodeAtO2AndO3": {"x86_64": {"identical": true}, "arm64": {"identical": false, "differences": ["..."]}},
  "unverified": []
}
```

Read `code/main.py` in this order:

1. `parse_listing()` turns the `llvm-objdump -d -r` text into functions, instructions, and attached relocations for both architectures.
2. `ElfFile` reads sections, symbols, and `.rela.*` entries, and `words()` reads table entries.
3. `magic_numbers()`, `divisor_from_magic()`, and `evaluate_division()` are the Granlund-Montgomery derivation forward, backward, and as the instruction sequence.
4. `parse_source()` extracts the constructs the verification needs from the C file.
5. `Evaluator` is the block-by-block symbolic pass that names registers and stack slots.
6. `find_divisions()` and `find_modulos()` match the multiply, shift, fix-up, multiply-back, and power-of-two forms.
7. `find_switches()` classifies jump tables, lookup tables, linear maps, select chains, comparison trees, and compare chains.
8. `find_vector_loops()`, `find_unrolled_loops()`, `find_tail_calls()`, `find_inlined_calls()`, `find_selects()`, `find_memory_builtins()`, `find_stack_protector()`, `find_cet()`, and `find_strength_reduction()` cover the rest.
9. `analyze_function()` runs them in order, feeding each idiom's result name into the next evaluator pass.

Three more commands exist. `python3 code/main.py scan FILE.objdump.txt [FUNCTION]` runs the recognizer on one listing, with the object and the matching C file found beside it. `python3 code/main.py magic DIVISOR [signed]` prints the multiplier, shift, error, and whether the identity holds on the edge values. `python3 code/main.py figure-data` prints the data the figure embeds.

## Use It

Use the recognizer in this order on a new object you built.

1. Capture `llvm-objdump -d -r` from the object and keep the exact compiler command beside it. The recognizer reads the architecture from the listing header.
2. Run `scan` on the listing and read the `unverified` entries first. Each one is either a construct the source parser did not see or a shape the recognizer misread, and both deserve a look at the evidence addresses.
3. For every division, read the `algorithm` field. When `clangMatchesAlgorithm` is true, the compiler chose the smallest valid shift. When it is false, the compiler had a reason you do not know yet; write the constants down.
4. For every switch, compare the `lowering` across the levels you built. A table that becomes a tree, or a tree that becomes a table, marks a threshold you can name from the LLVM source.
5. For every loop, read `elementsPerIteration` and `scalarRemainderLoop`, then confirm the two back edges lesson 33 reports are one source loop.
6. Run one decompiler on the same object, quote its text next to each idiom, and record which ones it folded. That record is the baseline for lesson 45.

## Interactive Lab

### Lab A: derive a magic number, then find it

From the `code` directory, open Python:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization/code
python3 -q
```

Run:

```python
from main import *
magic_numbers(10), magic_numbers(10, signed=True)
magic_numbers(7), magic_numbers(7, signed=True)
divisor_from_magic(0x66666667, 34, signed=True), divisor_from_magic(0x66666667, 33, signed=True)
```

Compute `ceil(2^35 / 10)` on paper before the first call. Then add a function `unsigned div13(unsigned x) { return x / 13; }` to a copy of `idioms.c`, build it at `-O2` with the command in `build_fixtures.sh`, and check the constant in the listing against `magic_numbers(13)`.

### Lab B: the table and the tree

```python
listing = load_listing("idioms-x86_64-O2.objdump.txt")
elf = load_elf("idioms-x86_64-O2.o")
sources = load_source("idioms.c")
[i.to_dict() for i in analyze_function(listing, "table_switch", elf, sources)]
[i.to_dict() for i in analyze_function(listing, "sparse_switch", elf, sources)]
elf.words(".rodata", 0x28, 7)
```

Change `71` back to `70` in a copy of `table_switch`, rebuild at `-O2`, and watch the lookup table become a linear map. Then change one case value to 1000 and watch it stay an `ArrayKind` table.

### Lab C: the loop at three settings

```python
for name in ("idioms-x86_64-O1", "idioms-x86_64-O2", "idioms-x86_64-novec-O2"):
    print(name, [i.source for i in analyze_function(load_listing(name + ".objdump.txt"), "sum_n", load_elf(name + ".o"), sources)])
```

Draw the control-flow graph of `sum_n` at `-O2` by hand, mark the guard, the mask, the vector body, the reduction, and the remainder loop, and compare with the `detail` fields.

### Lab D: the shared quotient

```python
for name in ("idioms-x86_64-O1", "idioms-arm64-O1"):
    print([(i.kind, i.source, i.detail.get("sharedQuotient")) for i in analyze_function(load_listing(name + ".objdump.txt"), "digest", load_elf(name + ".o"), sources)])
```

Read the `-O1` listing of `digest` and find the two instructions that combine the quotient with its sign fix-up on x86-64. Then explain why the AArch64 build needs only one.

## Practice Lab

Add bit tricks to the fixtures and extend the recognizer.

Requirements:

- Write `popcount`, `ctz`, and `rotl` functions with the GCC builtins and a shift-or rotate, build them at `-O2` with and without `-mpopcnt -mbmi`, and commit the objects with their listings.
- Recognize the `0x55555555`, `0x33333333`, `0x0f0f0f0f`, `0x01010101` population-count sequence that `TargetLowering::expandCTPOP` emits, and report it as `popcount` with the four constants as evidence.
- Recognize `rep bsfl` as the `tzcnt`-or-`bsf` encoding and `roll %cl` as the rotate, and decode both to the builtin.
- Add the new kinds to `parse_source()` verification, so a `popcount` idiom is verified only when the source calls `__builtin_popcount`.
- Add a test per idiom that reads the constants from the fixture listing.

Success means `python3 code/main.py` reports the three new kinds with `verified: true` in both builds, and the suite still reports an empty `unverified` list.

## Lesson Artifact

This lesson includes `outputs/skill-compiler-idioms-and-optimization.md`. Use it to turn a listing, an object, and its source into a verified idiom report with a decompiler comparison. It requires evidence addresses for every claim, the magic-number derivation for every division, the lowering kind and entry source for every switch, and a quoted decompiler line for every idiom.

## Verify It

Run the demo and the deterministic suite:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

Verification should prove:

- the listing parser reads 25 functions from the `-O2` object, keeps the bytes, and attaches `R_X86_64_PC32 .rodata+0x24` to the `leaq` in `table_switch`
- the ELF reader returns `[10, 20, 30, 40, 50, 60, 71]` from `.rodata+0x28` and ten relocations in `.rela.rodata`
- `magic_numbers` returns `0xcccccccd` with shift 35, `0x66666667` with 34, `0x124924925` with 35 and the add form, `0x55555556` with 32, and `0xaaaaaaab` with 33
- the identity holds on the 32-bit edge values for every divisor from 2 to 64 that is not a power of two, signed and unsigned
- `divisor_from_magic` recovers 10, 5, 7, and 3 from their pairs and rejects a wrong pair
- the add fix-up sequence computes `n // 7` exactly
- the four x86-64 divisions report the right multiplier, shift, divisor, and form, and the four AArch64 divisions decode `mov` and `movk`
- `-O0` uses `divl` and `idivl`, `-O0 -fast-isel=false` uses the multiply, and `digest` at `-O0` mixes the two
- modulo is recognized as multiply-back, `msub`, power-of-two, `sdiv` plus `mul` plus `subs`, and hardware `idivl`
- a shared quotient keeps both the division and the modulo at `-O1`
- the five lowerings are classified at `-O2` on both architectures, with the formula, the values, the targets, the pivots, and the select expression
- `-O0` switches are jump tables on x86-64 and compare chains on AArch64
- the `digest` switch is a jump table, then a lookup table with folded factor 16, then a jump table with four distinct targets on x86-64, and a comparison tree with the range test 9 to 10 on AArch64
- `-fno-jump-tables` produces comparison trees, and the 16-case `dispatch` reads its targets from relocations on x86-64 and from a compressed byte table on AArch64
- the vector loop reports 4 lanes, 2 accumulators, 8 elements per iteration, the mask, the guard, the reduction, and the remainder loop
- fixed-trip loops are fully vectorized or fully unrolled, and `-fno-vectorize` unrolls by 8
- `-O1` has no vectorization, `-O2` and `-O3` are identical on x86-64, and on AArch64 they differ only in `call_switch`, where `-O3` has 17 instructions and `-O2` has 18
- `-fno-builtin` turns the store loop into a vectorized store loop and keeps `memcpy` a call
- tail calls, the `memset` replacement, the inline 16-byte copy, and the `-O0` two-move copy are recognized
- the inlined callee is found from `-O1` by its body shape
- selects decode to `a > b ? a : b`, `-x < 0 ? x : -x`, `(x > 0)`, and `sum % 10 < 5 ? sum % 10 : 5`
- the stack protector reports `%fs:0x28`, the slot, and `__stack_chk_fail`, and `endbr64` is reported on every function of the CET build
- the source parser reads function-pointer parameters, the switch cases, the calls, and the accumulator names
- every idiom in every build is verified and the kind matrices match
- the interactive figure embeds the same data the analysis produces

## Production Failure Modes

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Multiply by a large odd constant | "multiplies by 1717986919" | The constant is `ceil(2^s / d)` for one `d`, the error satisfies the bound, and the shift is the smallest valid one |
| Add fix-up after a 32-bit shift | Five arithmetic instructions | The multiplier is 33 bits wide and the tail is the add form of the same method |
| Same multiplier, different shift | The same divisor | The shift selects the divisor: 34 is 10, 33 is 5 |
| Power-of-two signed modulo | "adds 7, masks, subtracts" | The bias rounds toward zero and the result is `x % 8` |
| Indexed load from `.rodata` | "a jump table" | A lookup table of values, with entries read from the bytes at addend plus 4 |
| Affine arithmetic and a `cmov` | "computes 10k + 10" | A switch lowered as a linear map, verified against every source case |
| Compare chain with ordered splits | "a sequence of ifs" | A binary search over the case constants with the pivots named |
| Backward branch to a default block | "a loop" | The target leaves the region with an unconditional jump; it is a shared tail |
| Two back edges in one function | "two loops" | One source loop: the vector body and its scalar remainder |
| `jmp memset@PLT` with no `ret` | "the function has no return" | A tail call that returns through the callee, replacing a store loop |
| Callee missing from the call graph | "never called" | Inlined: the callee's body shape appears in the caller |
| `%fs:0x28` load and compare | "reads thread-local data" | The stack protector canary, with the fail path to `__stack_chk_fail` |
| Four odd bytes at function start | "data before the function" | `endbr64`, the CET landing pad |
| Decompiler shows raw arithmetic | "the tool is wrong" | The tool did not apply a fold; the derivation gives the source form and the quoted output records the gap |

## Operational Rule

Match the shape, run the derivation backwards, and write the constants that prove it. Report every idiom with its evidence addresses and its decoded source form, verify each one against the source you compiled, and quote what each decompiler printed for the same bytes.

## Further Reading

- [Granlund, Montgomery, "Division by Invariant Integers using Multiplication" (PLDI 1994)](https://gmplib.org/~tege/divcnst-pldi94.pdf)
- [Warren, Hacker's Delight, 2nd edition, Chapter 10: Integer Division By Constants](https://www.informit.com/store/hackers-delight-9780321842688)
- [Lemire, Kaser, Kurz, "Faster Remainder by Direct Computation" (2019)](https://arxiv.org/abs/1902.01961)
- [libdivide, header-only division by runtime constants](https://github.com/ridiculousfish/libdivide)
- [LLVM `DivisionByConstantInfo.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Support/DivisionByConstantInfo.cpp)
- [LLVM `SwitchLoweringUtils.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/SwitchLoweringUtils.cpp) and [`TargetLoweringBase.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/TargetLoweringBase.cpp)
- [LLVM `SimplifyCFG.cpp`, `simplifySwitchLookup`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Transforms/Utils/SimplifyCFG.cpp)
- [LLVM Auto-Vectorization documentation](https://llvm.org/docs/Vectorizers.html) and [LLVM 3.4 release notes](https://releases.llvm.org/3.4/docs/ReleaseNotes.html)
- [LLVM `LoopIdiomRecognize.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Transforms/Scalar/LoopIdiomRecognize.cpp)
- [LLVM `X86CmovConversion.cpp`](https://github.com/llvm/llvm-project/blob/release/20.x/llvm/lib/Target/X86/X86CmovConversion.cpp)
- [LLVM `StackProtector.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/StackProtector.cpp) and [`X86ISelLoweringCall.cpp`, `getIRStackGuard`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Target/X86/X86ISelLoweringCall.cpp)
- [glibc `sysdeps/x86_64/nptl/tls.h`, `tcbhead_t`](https://sourceware.org/git/?p=glibc.git;a=blob;f=sysdeps/x86_64/nptl/tls.h)
- [GCC `tree-switch-conversion.cc`](https://github.com/gcc-mirror/gcc/blob/master/gcc/tree-switch-conversion.cc), [GCC Optimize Options](https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html), and [GCC 12 release notes](https://gcc.gnu.org/gcc-12/changes.html)
- [Ghidra decompiler `ruleaction.cc`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/decompile/cpp/ruleaction.cc)
- [angr decompiler documentation](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [radare2 book: decompilers](https://book.rada.re/arch/decompile.html)
- [Compiler Explorer API](https://github.com/compiler-explorer/compiler-explorer/blob/main/docs/API.md)
- [Godbolt, "Optimizations in C++ Compilers: A practical journey", ACM Queue 17(5), 2019](https://queue.acm.org/detail.cfm?id=3372264)
- [Microsoft, `/GS` (Buffer Security Check)](https://learn.microsoft.com/en-us/cpp/build/reference/gs-buffer-security-check)
