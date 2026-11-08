# Disassembly and Control Flow: From Bytes to a Graph You Can Check

> A disassembly listing is a claim about which bytes are instructions, and this lesson builds the decoder and graph that check the claim.

**Type:** Build
**Languages:** Python, C, x86-64 assembly
**Prerequisites:** Phase 13 · 32 (ELF from scratch)
**Time:** ~150 minutes

## Learning Objectives

- Decode the x86-64 instruction subset in the ledger fixtures from the rules in Intel SDM Volume 2, Chapter 2.
- Prove the decoder against `llvm-objdump -d` on every instruction of every fixture build.
- Run a linear sweep and a recursive descent over the same bytes and explain where each one is wrong.
- Cut instructions into basic blocks and build a control-flow graph with typed edges.
- Compute immediate dominators with the iterative algorithm of Cooper, Harvey, and Kennedy, and find loops from back edges.
- Recover the targets of an indirect jump from the relocation entries that point at its table.

## The Problem

You compiled `ledger.c` at `-O0` and asked an agent what `grade` does. The agent called a disassembler, read the listing, and answered that the function ends in `jmpq *%rax` with no known target. It then wrote pseudocode with a single `return 0`.

You open the same object in `llvm-objdump -d` and see four blocks after the jump that store 4, 3, 2, and 1. The listing had them all along. Nothing in the listing says how execution reaches them, so the tool treated them as dead code.

A listing answers one question only: which bytes form which instruction. It does not say which instructions run, in what order, or from where. To answer them you need three more structures: the bytes that control flow can reach, the basic blocks, and the edges between them.

rea 6.5.0 has no disassembler of its own. For deep analysis, its README asks you to bring Ghidra, Hopper, or IDA. For offline inspection, rea can also call a GNU objdump or a Rizin that you install. Its call graph stops at unresolved targets: "Callers/callees contain only resolved functions.... Targetless computed flow remains unknown.". This lesson builds the part that produces those facts, so you can judge them when a tool reports them.

```figure
re-33-sweep-vs-descent
```

## The Instruction Format Has One Rule Per Field

Intel SDM Volume 2, Figure 2-1 gives the byte order of every instruction. First come optional prefixes, then one to three opcode bytes, then an optional ModRM byte and an optional SIB byte. A displacement of 0, 1, 2, or 4 bytes follows, then an immediate of 0, 1, 2, or 4 bytes. The whole instruction is at most 15 bytes (SDM 2.3.11). AMD APM Volume 3, Chapter 1, Sections 1.1 to 1.7 describe the same format in fewer pages and are a good cross-check.

Each field decides what the next field means. A decoder is therefore a chain of small decisions, and each decision has a sentence in the manual behind it.

### Prefixes come in four groups

SDM 2.1.1 lists the legacy prefixes. Group 1 holds `F0` lock and the repeat prefixes `F2` and `F3`. Group 2 holds the six segment overrides (`2E` is `%cs`) and the branch hints. Group 3 is `66`, the operand-size override. Group 4 is `67`, the address-size override.

The manual says one prefix from each group can be used. Compilers emit more. The alignment padding in `ledger-x86_64-O0.o` at offset `0xf2` reads `66 66 66 66 66 2e 0f 1f 84 00 00 00 00 00`, five copies of `66` in a row. `llvm-objdump` prints it as `nopw %cs:(%rax,%rax)` and so does the decoder you build. The decoder collects every prefix byte it sees and asks later which ones mattered.

`66` has a second job. For SSE instructions it is a mandatory prefix that selects the opcode, so `66 0f ef c0` is `pxor %xmm0, %xmm0` and not a 16-bit anything. `F3 0f 6f` is `movdqu`. The decoder first looks up the pair of mandatory prefix and second opcode byte. Only when that pair has no entry does `66` mean a 16-bit operand.

### REX adds four bits and must sit next to the opcode

SDM 2.2.1 defines REX as one byte from `40` to `4F` with the shape `0100WRXB`. `W` selects a 64-bit operand. `R` extends the ModRM reg field. `X` extends the SIB index field. `B` extends the ModRM r/m field, the SIB base field, or the register in the opcode byte (Table 2-4). REX must come right before the opcode or the escape bytes, and a REX followed by a legacy prefix is ignored.

In `48 89 e5` the byte `48` is REX with `W` set. The opcode `89` is `MOV r/m, r`, and ModRM `e5` selects `%rsp` into `%rbp`. Remove the REX and the same bytes are `movl %esp, %ebp`.

REX changes the names of the byte registers too. With any REX present, encodings 4 to 7 select `%spl`, `%bpl`, `%sil`, and `%dil` instead of `%ah`, `%ch`, `%dh`, and `%bh`. The decoder keeps two tables for that reason.

### Opcodes live in two maps

A one-byte opcode is the common case. `0F` escapes to the two-byte map, and `0F 38` or `0F 3A` escape to three-byte maps that the fixtures never use (SDM 2.1.2). Some opcodes use the ModRM reg field as three more opcode bits, written `/digit` in the manual. `83 /7` is `cmp` with an 8-bit immediate, `83 /5` is `sub`, and `FF /4` is the indirect `jmp`.

The decoder in `code/main.py` covers the opcodes in the four fixture objects plus a few neighbours. The list is the eight arithmetic forms, `mov`, `lea`, `movslq`, `movzbl`, `imul`, the shifts, `test`, and `idiv`. It continues with `push`, `pop`, `call`, `ret`, the sixteen conditional jumps, the multi-byte `nop`, and five SSE2 opcodes. Any other opcode raises `DecodeError` with the address and the reason. A decoder that guesses is worse than one that stops.

### ModRM and SIB select the operands

SDM 2.1.3 splits ModRM into `mod` (bits 7:6), `reg` (5:3), and `r/m` (2:0). `mod = 11` means r/m is a register. `mod = 00`, `01`, and `10` mean memory with no displacement, an 8-bit displacement, or a 32-bit displacement. `r/m = 100` means a SIB byte follows. SIB splits into `scale` (7:6), `index` (5:3), and `base` (2:0), and an index of `100` means no index register.

Two special rows in Table 2-2 matter in 64-bit mode. `mod = 00` with `r/m = 101` is not `(%rbp)`. It is a 32-bit displacement relative to the next instruction (SDM 2.2.1.6). `mod = 00` with a SIB base of `101` is a 32-bit displacement with no base register.

Take `8d 44 08 fa` from `grade` at `-O0`. The opcode `8D` is `lea`. ModRM `44` is `01 000 100`: an 8-bit displacement, reg `%eax`, and a SIB follows. SIB `08` is `00 001 000`: scale 1, index `%rcx`, base `%rax`. The displacement byte `fa` is -6. The AT&T text is `leal -0x6(%rax,%rcx), %eax`, which computes `score / 10 - 6`, the switch index.

### The displacement is where the link editor writes

`48 8d 0d 00 00 00 00` is `leaq (%rip), %rcx`. The four zero bytes are the displacement field of a RIP-relative operand. In a relocatable object they are placeholders. The entry in `.rela.text` at offset `0x69` says `R_X86_64_PC32.rodata-0x4`. The psABI (Table 4.9) defines `R_X86_64_PC32` as `S + A - P`: the symbol address plus the addend minus the address of the field.

The processor adds the field to the address of the next instruction, so the final target is `S + A + (end - P)`. For this `lea` the field is the last four bytes, so `end - P` is 4 and the target is `.rodata + (-4) + 4 =.rodata + 0x0`. The addend of -4 compensates for those four bytes in advance. Every RIP-relative operand in the fixtures carries this -4 inside its addend, so `.rodata+0x10` on the `-O1` `lea` means `.rodata+0x14`.

The decoder records the offset of the displacement field inside each instruction. `resolve_reference()` looks that offset up in the relocation table and reports where the operand will point after linking. That one function is what turns `leaq (%rip), %rcx` into "the table at `.rodata+0x0`".

### Immediates are 32 bits at most, with one exception

SDM 2.2.1.5 says immediates stay at most 32 bits in 64-bit mode and are sign-extended. The exception is `MOV r64, imm64` (`B8+r` with `REX.W`), which the AT&T syntax calls `movabsq`. The decoder reads 8-bit immediates as signed for arithmetic (`83 c1 fa` is `addl $-0x6, %ecx`) and as unsigned for shift counts and shuffle selectors (`pshufd $0xee`). That split matches what `llvm-objdump` prints.

Near branches, `push`, and `pop` default to a 64-bit operand and ignore `66` (SDM 2.2.1.7). That is why the decoder names them `pushq`, `popq`, `callq`, and `retq` without reading an operand-size prefix.

## Decode One Instruction by Hand

Before you trust the code, decode `48 69 c0 67 66 66 66` from `grade` on paper.

1. `48` is in `40` to `4F`, so it is REX with `W = 1`. Operand size is 64 bits.
2. `69` is `IMUL r, r/m, imm32`.
3. `c0` is ModRM `11 000 000`: register form, reg `%rax`, r/m `%rax`.
4. The next four bytes are the immediate, little-endian: `0x66666667`.
5. AT&T order is immediate, source, destination: `imulq $0x66666667, %rax, %rax`.

That is seven bytes, and `llvm-objdump` prints the same text. The constant is the reciprocal that lets clang divide by 10 with a multiply and the `sarq $0x22` that follows, which shifts by 34. You will meet that pair again in lesson 34, where the lifter turns it back into `score / 10`.

The decoder does these five steps in `Decoder.decode()`, `_State.modrm()`, and `_State.finish()`. Read them in that order and match each branch to the SDM section named in its docstring.

## Linear Sweep

Schwarz, Debray, and Andrews describe linear sweep in Section 3.1 of "Disassembly of Executable Code Revisited" (WCRE 2002). Start at the first byte of the code section, decode one instruction, continue at the byte after it, and stop at the end. `objdump` works this way, and so does `llvm-objdump`.

```python
def linear_sweep(code: bytes, start: int = 0, end: int | None = None) -> SweepResult:
    position = start
    while position < end:
        try:
            instruction = decode(code[:end], position)
        except DecodeError:
            undecodable.append((position, code[position]))
            position += 1
            continue
        instructions.append(instruction)
        position = instruction.end
```

The method has one failure mode, and the paper's Figure 1 shows it. Bytes that are data get decoded as instructions, and the decoder then misses the real instruction boundaries for a while. On x86 the decoder usually re-synchronises within a few bytes, which is what makes the error hard to see. Detection happens only on an invalid opcode, and the paper's conclusion is that these algorithms "fail silently".

The sweep is also the oracle for this lesson. The decoder must agree with `llvm-objdump -d` on every instruction of every fixture, and `llvm-objdump` is itself a linear sweep. The captured text lives in `code/fixtures/*.objdump.txt`. The test parses each line into address, bytes, and text, drops the comments after `#`, and compares. The four objects hold 86, 56, 84, and 11 instructions, 237 in total, and the decoder matches all of them.

## Recursive Descent

Section 3.2 of the same paper calls the second method recursive traversal. Start at a known entry point and decode until a control transfer. For a direct jump, continue at the target. For a conditional branch, continue at both the target and the next instruction, and for a call, continue after it, because the callee returns. For a return, stop. Keep a set of visited addresses so the walk ends.

```python
if instruction.flow == "branch":
    worklist.append(instruction.target)
    address = instruction.end
elif instruction.flow == "indirect-jump":
    table = resolver(instruction, instructions) if resolver else None
    if table is None:
        unresolved.append(instruction)
        break
```

The failure mode is the opposite one. An indirect jump has no target in its bytes. The walk stops there, and every block reachable only through the jump stays unknown. The paper's Figure 2 shows a second hazard: a target set derived from relocations that points into the middle of an instruction. The descent in `main.py` records that case as a conflict and stops that path, so the overlap is visible instead of silently decoded twice.

Andriesse and others measured nine disassemblers on 981 compiler-generated binaries (USENIX Security 2016). Inline data and overlapping code were rarer in real compiler output than the literature assumed, and the hard primitive was function boundary recovery. Keep both findings in mind. The trap in the next section is rare in compiler output. The indirect jump in `grade` is common.

## A Fixture Where the Sweep Is Wrong and the Descent Is Right

`code/fixtures/sweep-trap.s` is 24 bytes of hand-written assembly with a four-byte table inside the function body. The function indexes the table with `movzbl (%rcx,%rax), %eax` and jumps over it.

```asm
lookup:
        movslq  %edi, %rax
        leaq    .Ltable(%rip), %rcx
        movzbl  (%rcx,%rax), %eax
        jmp     .Ldone
.Ltable:
        .byte   0x31, 0xc0, 0x90, 0x48
.Ldone:
        addl    $1, %eax
        retq
```

Build it with `clang -target x86_64-unknown-linux-gnu -c sweep-trap.s`. The four table bytes were chosen so that they decode as plausible instructions. `31 c0` is `xorl %eax, %eax`. `90` is `nop`. `48` is a REX prefix, so the sweep joins it with the three bytes of the real `addl $1, %eax` and prints `addq $0x1, %rax`. The captured `llvm-objdump` output shows exactly that:

```text
       e: eb 04                        	jmp	0x14 <lookup+0x14>
      10: 31 c0                        	xorl	%eax, %eax
      12: 90                           	nop
      13: 48 83 c0 01                  	addq	$0x1, %rax
      17: c3                           	retq
```

Nothing in this listing looks broken. Every byte decoded, every mnemonic is real, and the `retq` is present. The listing is still wrong in three ways. The jump at `0xe` targets `0x14`, and no instruction in the listing starts at `0x14`. The instruction that does run at `0x14` is a 32-bit `addl`, and the listing shows a 64-bit `addq` one byte earlier. The four table bytes appear as code.

Recursive descent from the `lookup` symbol decodes six instructions, follows the jump to `0x14`, and reports `addl $0x1, %eax`. It claims none of the four table bytes and none of the eight padding bytes before `plus_one`. `trap_report()` in `main.py` prints the comparison:

```json
"linearSweep": {
  "instructions": 9,
  "atJumpTarget": {"starts": "0x13", "text": "addq\t$0x1, %rax", "startsAtTarget": false},
  "claimedDataBytes": 4,
  "claimedPaddingBytes": 8
},
"recursiveDescent": {
  "instructions": 6,
  "atJumpTarget": "addl\t$0x1, %eax",
  "claimedDataBytes": 0,
  "claimedPaddingBytes": 0
}
```

The test `test_sweep_and_objdump_share_the_same_mistake` asserts that `llvm-objdump` printed `addq $0x1, %rax` at `0x13`. The oracle is a linear sweep and inherits its blind spot. Agreement with the oracle checks the decoder, and the descent checks which instructions run.

## Basic Blocks

Allen defined the basic block in "Control Flow Analysis" (1970). It is a sequence of instructions that is entered only at its first instruction and left only at its last. Yakdan and others restate it for decompilation in Section II.A.2 of "No More Gotos" (NDSS 2015), with the header node as the function entry.

The construction is a two-pass scan over the decoded instructions, sorted by address. The first pass collects leaders. A leader is the entry, a branch or jump target, a table target, or the instruction after any control transfer. The second pass starts a new block at every leader and at every gap in the address sequence.

```python
for instruction in self.instructions:
    if instruction.address in leaders or current is None or current.end != instruction.address:
        current = Block(instruction.address, [])
        self.blocks[instruction.address] = current
    current.instructions.append(instruction)
```

Edges follow from the last instruction of each block. A return has no successor. A jump has one, tagged `jump`. A conditional branch has two, tagged `taken` and `fallthrough`. A plain instruction at the end of a block falls through to the next block, which happens when the next instruction is a branch target. An indirect jump has the targets of its table, tagged `table`, or none, and the block is recorded in `unresolved`.

Two more facts come out of the same scan. A block that the entry cannot reach is unreachable, and the sweep over `grade` at `-O0` produces five of them. A block whose start address falls inside an instruction of another method's listing is the overlap case from the trap.

## The Control-Flow Graph of total

`total` at `-O1` is 31 bytes and 13 instructions:

```text
      40: 85 f6                        	testl	%esi, %esi
      42: 7e 18                        	jle	0x5c <total+0x1c>
      44: 89 f1                        	movl	%esi, %ecx
      46: 31 d2                        	xorl	%edx, %edx
      48: 31 c0                        	xorl	%eax, %eax
      4a: 66 0f 1f 44 00 00            	nopw	(%rax,%rax)
      50: 03 04 97                     	addl	(%rdi,%rdx,4), %eax
      53: 48 ff c2                     	incq	%rdx
      56: 48 39 d1                     	cmpq	%rdx, %rcx
      59: 75 f5                        	jne	0x50 <total+0x10>
      5b: c3                           	retq
      5c: 31 c0                        	xorl	%eax, %eax
      5e: c3                           	retq
```

The leaders are `0x40` (entry), `0x44` (after the `jle`), `0x50` (target of the `jne`), `0x5b` (after the `jne`), and `0x5c` (target of the `jle`). Five blocks, five edges:

| From | To | Kind | Why |
|---|---|---|---|
| `0x40` | `0x44` | fallthrough | `jle` not taken, count is positive |
| `0x40` | `0x5c` | taken | count is zero or negative, return 0 |
| `0x44` | `0x50` | fallthrough | the `nopw` is alignment inside the block, execution passes through it |
| `0x50` | `0x50` | taken | `jne 0x50`, the loop |
| `0x50` | `0x5b` | fallthrough | loop exit, return the sum |

The six-byte `nopw` at `0x4a` is padding so that the loop head at `0x50` sits on a 16-byte boundary. It is reachable, so it belongs to block `0x44`. The one-byte `nop` at `0x5f` after the last `retq` is also padding, and nothing reaches it. The sweep over the function makes a sixth block for it, and `unreachable()` lists it.

At `-O2` the same function is 140 bytes with two loops. The SSE2 body at `0x80` adds eight values per pass with `paddd`, and the scalar remainder runs at `0xc0`. The CFG has two back edges, `0x80 -> 0x80` and `0xc0 -> 0xc0`, and the test suite checks both.

## Dominators With the Iterative Algorithm

A block `d` dominates a block `b` when every path from the entry to `b` passes through `d`. The immediate dominator of `b` is the dominator of `b` that is closest to `b`. The notion goes back to Prosser (1959) through Allen (1970), and it is the structure that lesson 34 needs to place `if` and `while` correctly.

Cooper, Harvey, and Kennedy wrote "A Simple, Fast Dominance Algorithm" (2001). They argue that the data-flow formulation, run in reverse postorder with a compact representation, beats Lengauer-Tarjan (1979) on graphs under about a thousand nodes. Their paper says its purpose is "not to present a new algorithm". It shows that simple algorithms can win in practice and are good teaching tools. A function CFG almost never has a thousand nodes.

```python
def intersect(first: int, second: int) -> int:
    while first != second:
        while number[first] > number[second]:
            first = idom[first]
        while number[second] > number[first]:
            second = idom[second]
    return first

changed = True
while changed:
    changed = False
    for start in order[1:]:
        processed = [p for p in self.predecessors(start) if p in idom]
        candidate = processed[0]
        for other in processed[1:]:
            candidate = intersect(other, candidate)
        if idom.get(start) != candidate:
            idom[start] = candidate
            changed = True
```

`number` holds the reverse postorder position of each block, with the entry at 0. `intersect` walks two fingers up the current dominator tree until they meet. The paper writes the comparison with postorder numbers and `<`. This code uses reverse postorder numbers, so the comparison is `>`. Everything else follows the paper's pseudocode.

For `total` at `-O1` the result is `idom(0x44) = 0x40`, `idom(0x50) = 0x44`, `idom(0x5b) = 0x50`, and `idom(0x5c) = 0x40`. The edge `0x50 -> 0x50` is a back edge because its target dominates its source, and a back edge marks a loop (Allen 1970). `back_edges()` returns it. The test `test_dominators_on_a_hand_built_diamond_with_a_loop` runs the same code on a 16-byte sequence with a join point, so `intersect` sees two predecessors.

## The Jump Table in grade at -O0

At `-O0` clang compiles the `switch` in `grade` to the position-independent jump table idiom:

```text
      5d: 83 e8 04                     	subl	$0x4, %eax
      60: 77 38                        	ja	0x9a <grade+0x6a>
      62: 48 8b 45 f0                  	movq	-0x10(%rbp), %rax
      66: 48 8d 0d 00 00 00 00         	leaq	(%rip), %rcx
		0000000000000069:  R_X86_64_PC32	.rodata-0x4
      6d: 48 63 04 81                  	movslq	(%rcx,%rax,4), %rax
      71: 48 01 c8                     	addq	%rcx, %rax
      74: ff e0                        	jmpq	*%rax
```

Read it as four facts. The `subl $0x4` followed by `ja` is a bounds check: indexes above 4 go to the default case at `0x9a`, so the table has five entries. The `leaq` with its relocation puts the table address in `%rcx`, and the previous section showed that address is `.rodata+0x0`. The `movslq` loads a signed 32-bit entry scaled by 4. The `addq` adds the table base, so each entry is the distance from the table to its case block.

In the object file every table byte is zero. The targets exist only as relocations in `.rela.rodata`:

```text
RELOCATION RECORDS FOR [.rodata]:
OFFSET           TYPE                     VALUE
0000000000000000 R_X86_64_PC32            .text+0x91
0000000000000004 R_X86_64_PC32            .text+0x8c
0000000000000008 R_X86_64_PC32            .text+0x87
000000000000000c R_X86_64_PC32            .text+0x82
0000000000000010 R_X86_64_PC32            .text+0x86
```

Apply `S + A - P` to entry `k` at offset `4k`. The stored value is `.text + A - (.rodata + 4k)`, and the code adds `.rodata + 0` to it, so the target is `.text + A - 4k`. Entry 0 is `0x91 - 0 = 0x91`, entry 1 is `0x8c - 4 = 0x88`, and entry 2 is `0x87 - 8 = 0x7f`. Entries 3 and 4 are `0x82 - 12 = 0x76` and `0x86 - 16 = 0x76`. Cases 6, 7, 8, 9, and 10 of `score / 10` go to the blocks that store 1, 2, 3, 4, and 4. That matches the C source line for line, including the shared case for 9 and 10.

`recover_table()` does this arithmetic. `jump_table_resolver()` matches the idiom backwards from the `jmpq`. It finds the `addq` that made the register, the `movslq` that loaded it, the `leaq` that made the base, and the bounding `ja`. The descent then pushes the four distinct targets and continues. A linked executable has final values in the table and no relocations. The same function then reads the signed 32-bit entries and adds the table address, and `evidence` records which path produced the targets.

The numbers for `grade` at `-O0`, from `python3 code/main.py cfg code/fixtures/ledger-x86_64-O0.o grade`:

| Method | Instructions | Blocks | Edges | Bytes | What is wrong |
|---|---|---|---|---|---|
| linear sweep | 34 | 9 | 7 | 118 code + 10 padding | 5 unreachable blocks, no edge into the four case blocks, padding decoded as `nopw` |
| recursive descent | 25 | 3 | 2 | 82 code | 36 code bytes never reached, `jmpq *%rax` at `0x74` unresolved |
| descent with the table | 33 | 8 | 11 | 118 code | nothing |

With the table the dominator tree is complete. The `idom` of each case block is `0x62`, the block with the jump. The `idom` of `0xa1` is the entry `0x30`, because the default path from `0x9a` reaches `0xa1` without passing `0x62`.

## What the Optimizer Did to grade at -O1

You will see `grade` described as a switch that compiles to a jump table. The bytes say something more specific. At `-O1` and `-O2` there is no indirect jump in `grade` at all:

```text
      2c: 83 f9 04                     	cmpl	$0x4, %ecx
      2f: 77 0c                        	ja	0x3d <grade+0x2d>
      31: 89 c8                        	movl	%ecx, %eax
      33: 48 8d 0d 00 00 00 00         	leaq	(%rip), %rcx
		0000000000000036:  R_X86_64_PC32	.rodata+0x10
      3a: 8b 04 81                     	movl	(%rcx,%rax,4), %eax
      3d: c3                           	retq
```

The relocation addend `0x10` plus the usual 4 puts the table at `.rodata+0x14`. The load is a plain `movl`, and the bytes there are `01 00 00 00 02 00 00 00 03 00 00 00 04 00 00 00 04 00 00 00`. The compiler replaced the five case blocks with a table of the five return values. There is a relocation, a table, and a bounds check. The control flow is three blocks and three edges with one conditional branch. `find_value_tables()` reports it as a `value-table` with entries `[1, 2, 3, 4, 4]` and `evidence: "bytes"`.

`grade_label` at `-O2` goes one step further. The `labels` array of five string pointers became a table of five 32-bit offsets at `.rodata+0x0`. Each entry carries a `R_X86_64_PC32` relocation against the string section, and the function adds the table address to the entry it loads. `recover_table()` reads those five relocations and returns offsets `0, 2, 4, 6, 8` into `.rodata.str1.1`, which hold `F`, `D`, `C`, `B`, and `A`. The same arithmetic that recovers a jump table recovers a relative data table, because both are `S + A - P` at a known offset.

The lesson from the two builds is to name what the bytes show. A jump table changes the control-flow graph. A value table changes a load. Calling both "the switch" hides the difference that lesson 34 has to reconstruct.

## What rea and Ghidra Give You Here

rea 6.5.0 with the Ghidra 12.1.4 provider returns the Listing text of a function from `procedure_assembly` as one string. `inspect_native_instruction` returns the bytes, length, decoder text, operand tokens, typed references, and flow of one instruction, with the return classified from p-code. `xrefs` returns the sorted unique source addresses from Ghidra's `ReferenceManager.getReferencesTo`. `analyze_function` carries the CFG and `body` of the function. `procedure_info` gives the body as inclusive ranges and warns that "Gaps and shared tails must not be treated as owned bytes".

Every one of those facts is Ghidra's recursive descent plus its analyzers, serialised. The rea analysis profile pins contract versions for `instruction_flow_evidence`, `function_references`, and `jump_table_evidence`. A result therefore names the rules that produced it. What it cannot do is show its work. When Ghidra does not find the table, the flow is "unknown", and the case blocks are missing from callers, callees, and the CFG.

You now have the work. Run `python3 code/main.py cfg` on the same object and compare block starts, edge counts, and the recovered table with what the provider returns. Where they agree you have two independent derivations. Where they differ you have a specific address to look at, which is what lesson 35 records as an unknown.

A note on the decoder as a program. Capstone 6.0.0-Alpha10 (2026-07-21) fixed out-of-bounds reads and writes under CVE-2026-55893 and CVE-2026-55894, and 5.0.9 (2026-05-28) backported CVE fixes. A decoder reads bytes it did not write. The 15-byte limit, the truncation check in `_Cursor.byte()`, and the refusal to guess an unknown opcode protect `main.py` from input it was not built for.

## Build It

Run the demo:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow
python3 code/main.py
```

The output is one JSON report. For each fixture object it gives the oracle agreement. For each function it gives instruction, block, and edge counts under the three methods. It also lists unreachable blocks, unresolved indirect jumps, back edges, immediate dominators, and any tables. It ends with the trap comparison.

Expected shape:

```json
{
  "fixtures": {
    "ledger-x86_64-O0.o": {
      "oracle": "86/86 instructions agree with llvm-objdump",
      "functions": {
        "grade": {
          "range": "0x30-0xa6",
          "paddingBytes": 10,
          "linearSweep": {"instructions": 34, "blocks": 9, "edges": 7, "unreachableBlocks": ["0x76", "0x7f", "0x88", "0x91", "0xa6"], "...": "..."},
          "recursiveDescent": {"instructions": 25, "blocks": 3, "edges": 2, "unresolvedIndirectJumps": ["0x74"], "...": "..."},
          "recursiveDescentWithTables": {"instructions": 33, "blocks": 8, "edges": 11, "...": "..."},
          "tables": [{"kind": "jump-table", "table": ".rodata+0x0", "count": 5, "entries": ["0x91", "0x88", "0x7f", "0x76", "0x76"], "evidence": "relocation", "...": "..."}]
        }
      }
    }
  },
  "sweepTrap": {"...": "..."}
}
```

Read `code/main.py` in this order:

1. `ElfObject` reads section headers, symbols, and `.rela.*` entries, and `symbolize()` names an address the way `llvm-objdump` does.
2. `Decoder.decode()` reads prefixes and REX, then dispatches on the one-byte or two-byte opcode map.
3. `_State.modrm()` reads ModRM, SIB, and the displacement, and records the displacement field offset.
4. `resolve_reference()` applies `S + A - P` to the relocation on a displacement or immediate field.
5. `linear_sweep()` and `recursive_descent()` are the two methods, each with its failure recorded.
6. `recover_table()` and `jump_table_resolver()` read a table through its relocations or its bytes.
7. `ControlFlowGraph` builds leaders, blocks, and typed edges, and `dominators()` is the iterative algorithm.
8. `analyze_function()` runs every method on one function and `compare_with_oracle()` checks the decoder.

Two more commands exist. `python3 code/main.py disasm FILE.o` prints a listing with the relocation target after each instruction that has one. `python3 code/main.py cfg FILE.o FUNCTION` prints the analysis of one function.

## Use It

Use the three methods in this order on a new object.

1. Run the oracle comparison first. A decoder that disagrees with `llvm-objdump` on a plain instruction has a bug, and every later structure inherits it.
2. Run the recursive descent from every function symbol and read `unresolved`. Each entry is an indirect jump or call whose targets you do not have.
3. For each unresolved jump, look for the table idiom and the relocation that points at it. If the idiom does not match, read the bytes before the jump and write down what you see. That note is the first unknown in lesson 35.
4. Compare the sweep and the descent byte by byte. Bytes that only the sweep claims are padding or data. Bytes that neither claims are unreachable or belong to a function you have not found.
5. Build the CFG from the descent with recovered tables and read the back edges. Each one is a loop that lesson 34 will turn into `while` or `for`.

Keep the oracle text files with the objects. When you move to a new compiler version, re-capture them, because a changed listing is a changed fixture.

## Interactive Lab

### Lab A: decode on paper, then check

From the `code` directory, open Python:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow/code
python3 -q
```

Run:

```python
from main import *
decode(bytes.fromhex("48 8d 0d 00 00 00 00"), 0).text
decode(bytes.fromhex("8d 44 08 fa"), 0).text
decode(bytes.fromhex("66 66 66 66 66 2e 0f 1f 84 00 00 00 00 00"), 0).length
```

Write down what you expect before each call. Then remove the `48` from the first one and see the operand size change. Then try `decode(bytes.fromhex("0f 0a"), 0)` and read the `DecodeError`.

### Lab B: the relocation on a lea

```python
elf = load_fixture("ledger-x86_64-O0.o")
code = elf.section(".text").data
lea = decode(code, 0x66)
lea.displacement_offset
resolve_reference(elf, lea)
```

The reference says `.rodata+0x0`. Change the address to `0x116` in `grade_label` and read the reference into `.data`. Then decode the `callq` at `0x10e` and resolve it. The immediate field carries `R_X86_64_PLT32 grade-0x4`, and the resolved target is `0x30`, which is `grade`.

### Lab C: watch the two methods disagree

```python
trap = load_fixture("sweep-trap.o")
text = trap.section(".text").data
[i.text for i in linear_sweep(text, 0, 0x20).instructions]
[i.text for i in recursive_descent(text, [0], 0x20).sorted_instructions()]
```

Count the instructions in each list and find the one that starts at `0x13`. Then change the last table byte in `sweep-trap.s` from `0x48` to `0xe8`, rebuild, and run both again. The sweep now swallows the `addl` and the `retq` into a `callq` with a target outside the section. The function appears to have no return.

### Lab D: dominators by hand

```python
analysis = analyze_function(load_fixture("ledger-x86_64-O1.o"), "total")
analysis.cfg.edges
analysis.cfg.reverse_postorder()
analysis.cfg.dominators()
analysis.cfg.back_edges()
```

Draw the five blocks on paper and compute the dominators before you look at the result. Then run the same four lines on `grade` at `-O0` and explain why `idom(0xa1)` is `0x30` and not `0x62`.

## Practice Lab

Add an indirect call site to the fixtures and extend the analysis.

Requirements:

- Write a C function that calls through a function pointer chosen from a small array. Build it at `-O0` and `-O1` and commit the objects with their `llvm-objdump` text.
- Make the decoder agree with the oracle on both objects. Add opcodes only when an instruction in the fixture needs them.
- Extend `recursive_descent()` so an indirect call records the call site in `calls` with `None` as the target and continues after it.
- Write a resolver that reads the function pointer array through its relocations and reports the possible callees.
- Add the callee set to the function report as `indirectCalls` with the evidence kind for each target.
- Write a test that fails when the resolver returns a target that is not a function symbol.

Success means `python3 code/main.py cfg` names every possible callee with the relocation that proves it, and the oracle comparison still passes on every object.

## Graded Lab

Five questions about the fixtures of this lesson. Find each answer with the code you built, then write it into `code/lab_answers.json`. Write numbers as numbers or as hex strings such as `"0x40"`, and lists as JSON lists.

1. `t1`: instructions that recursive descent decodes in grade at -O1.
2. `t2`: basic blocks in total at -O1.
3. `t3`: address of the loop header in total at -O1, as hex.
4. `t4`: in sweep-trap.o, the address where the linear sweep instruction that covers 0x14 starts, as hex.
5. `t5`: entries in the jump table of grade at -O0.

Check your answers:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow
python3 code/lab.py
```

The checker computes each expected value from `code/main.py` on the committed fixtures. It prints `PASS`, `FAIL` or `TODO` for each task and a score, and it exits 0 only when all five pass. `python3 code/lab.py my-answers.json` checks another file. `code/tests/test_lab.py` proves that the checker accepts the right answers and rejects a wrong one.

### See it run

The [Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler?program=trap&sweep=linear) machine runs this lesson as its decode bed and block board. This link opens `sweep-trap.o` with linear sweep: the bed shows the four data bytes decoded as code, and a pin marks the jump target at `0x14` inside the `addq` at `0x13`. Switch the decoder to recursive descent to see the jump skip the data.

## Lesson Artifact

This lesson includes `outputs/skill-disassembly-and-control-flow.md`. Use it to turn an object and a function name into a checked listing, blocks, typed edges, dominators, and every unresolved transfer. It requires an oracle comparison, both disassembly methods, byte accounting, relocation evidence for every recovered table, and a statement of what stayed unknown.

## Verify It

Run the demo and the deterministic suite:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow
python3 code/main.py
python3 code/tests/test_main.py
```

Verification should prove:

- the decoder agrees with `llvm-objdump -d` on all 237 instructions of the four fixture objects
- REX.W selects 64-bit operands and REX.R and REX.B extend the register fields
- ModRM and SIB render the AT&T memory operand, including scale, index, and signed displacement
- a RIP-relative displacement is recorded with its field offset inside the instruction
- repeated legacy prefixes and a segment override decode like the oracle
- a mandatory `66` prefix selects the SSE opcode and leaves the registers 32-bit
- 8-bit immediates are sign-extended for arithmetic and unsigned for shift counts
- an instruction over 15 bytes, a truncated instruction, and an unknown opcode raise `DecodeError`
- `R_X86_64_PC32` on a `lea` resolves to the table and `R_X86_64_PLT32` on a `call` resolves to the callee
- the sweep decodes the trap table as code and has no instruction at the jump target
- the descent never claims the table or the padding and reads `addl $0x1, %eax` at the target
- `llvm-objdump` makes the same mistake as the sweep on the trap
- an entry inside an instruction is recorded as a conflict
- an unresolved indirect jump stops the descent and is listed
- `total` at `-O1` has five blocks, five typed edges, one back edge, and the expected immediate dominators
- a hand-built diamond with a loop gives the dominators the algorithm defines
- `total` at `-O2` has two loops
- `grade` at `-O0` yields a five-entry jump table from `.rela.rodata` with targets `0x91, 0x88, 0x7f, 0x76, 0x76`
- without the table `grade` at `-O0` has three blocks and one unresolved jump
- `grade` at `-O1` and `-O2` is a value table `[1, 2, 3, 4, 4]` with no indirect jump
- `grade_label` at `-O2` reads a relative string table through five relocations
- the interactive figure embeds the same data the analysis produces

## Production Failure Modes

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Data inside `.text` | A plausible listing with every byte decoded | The descent claims no data byte and the jump target starts an instruction |
| Padding after the last return | A `nopw` instruction at the end of the function | The bytes are unreachable from the entry |
| Indirect jump through a table | "jmp rax" and four dead blocks | Table address from the `lea` relocation, entry count from the bounds check, targets from `.rela.rodata` |
| Switch turned into a value table | "a jump table with a relocation" | A `movl` load from `.rodata+0x14`, three blocks, no indirect transfer |
| Call with a zero displacement | `callq 0x113`, the next instruction | `R_X86_64_PLT32 grade-0x4` resolves to `0x30` |
| Decoder guesses an unknown opcode | A mnemonic that looks right | `DecodeError` with the address, and the sweep records the byte |
| Instruction longer than 15 bytes | A very long "instruction" | The cursor raises before reading byte 16 |
| Branch into the middle of an instruction | Two overlapping listings | A conflict record with both addresses |
| Loop reported as straight-line code | No `while` in the pseudocode | A back edge whose target dominates its source |
| Oracle captured from a different compiler | Tests pass on stale text | The fixture README names the exact compiler and command |

## Operational Rule

Decode against an oracle, walk control flow from known entries, and account for every byte as claimed, padding, data, or unreachable. Recover each indirect target from a relocation or a table you can point at. Record the rest as unknown, with the address.

## Further Reading

- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 2, Chapter 2: Instruction Format](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [AMD64 Architecture Programmer's Manual Volume 3, Chapter 1: Instruction Encoding](https://docs.amd.com/v/u/en-US/24594_3.38_APM_Vol3_PUB)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, Table 4.9: Relocation Types](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Schwarz, Debray, Andrews, "Disassembly of Executable Code Revisited" (WCRE 2002)](https://www2.cs.arizona.edu/~debray/Publications/disasm.pdf)
- [Andriesse et al., "An In-Depth Analysis of Disassembly on Full-Scale x86/x64 Binaries" (USENIX Security 2016)](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/andriesse)
- [Allen, "Control Flow Analysis" (1970)](https://doi.org/10.1145/800028.808479)
- [Cooper, Harvey, Kennedy, "A Simple, Fast Dominance Algorithm" (2001)](https://www.cs.tufts.edu/~nr/cs257/archive/keith-cooper/dom14.pdf)
- [Lengauer, Tarjan, "A fast algorithm for finding dominators in a flowgraph" (1979)](https://doi.org/10.1145/357062.357071)
- [Capstone 6.0.0-Alpha10 release notes](https://github.com/capstone-engine/capstone/releases/tag/6.0.0-Alpha10)
- rea 6.5.0 source at tag `3b79af2` that this lesson describes: `README.md`, `docs/ghidra-provider.md`, `docs/ghidra-dos.md`, `docs/reverse-engineering-tools.md`, `bridge/ghidra/ReaGhidraBridge.java`, `src/contracts/officialToolContracts.ts`, `src/ghidra/GhidraAnalysisProfile.ts`.
