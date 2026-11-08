# procedure_assembly

> procedure_assembly returns the Ghidra Listing text of one function as a string, one instruction per line, with the address first and no bytes.

You want to see the division by ten in `grade` as the processor sees it. The C source says `score / 10`. The arm64 code has no divide instruction at all, and reading why is the first thing assembly teaches.

When you finish this section, you can read the 15 instructions of `_grade`, split them into three blocks, and explain the multiply by `0x66666667`.

## The call and the text

```listing
title: procedure_assembly for _grade
source: capture/out/10-mcp-06-procedure-assembly-grade.json
lang: json
note: The request arguments and the start of the result. The result is one string with newlines, cut after the second line.
---
"name": "procedure_assembly",
"arguments": {
  "procedure": "_grade"
}
…
"normalized_result": "0x100000518: mov w8, #0x6667\n0x10000051c: movk w8, #0x6666, LSL #16\n…
```

The bridge resolves the procedure, scans its instructions with no limit, renders each one as text, and attaches any no-return call warnings. The record carries the limitation "Assembly is Ghidra Listing text and does not claim textual equivalence with Hopper output.". The text is Ghidra's rendering, so register names, immediates, and spacing follow Ghidra, not clang or `llvm-objdump`.

The dossier of [section 4.6](#s-analyze-function-and-pseudocode) carries the same lines as an array, which is easier to read.

```listing
title: the fifteen instructions of _grade
source: capture/out/06-function-grade.json
lang: json
note: The assembly array of the dossier, complete.
---
"assembly": [
  "0x100000518: mov w8, #0x6667",
  "0x10000051c: movk w8, #0x6666, LSL #16",
  "0x100000520: smull x8, w0, w8",
  "0x100000524: lsr x9, x8, #0x3f",
  "0x100000528: asr x8, x8, #0x22",
  "0x10000052c: add w8, w8, w9",
  "0x100000530: sub w8, w8, #0x6",
  "0x100000534: cmp w8, #0x4",
  "0x100000538: b.hi 0x10000054c",
  "0x10000053c: adrp x9, 0x100000000",
  "0x100000540: add x9, x9, #0x7d0",
  "0x100000544: ldr w0, [x9, w8, UXTW #0x2]",
  "0x100000548: ret",
  "0x10000054c: mov w0, #0x0",
  "0x100000550: ret"
],
```

## Reading the fifteen instructions

The argument `score` arrives in `w0`, the low 32 bits of `x0`, and the result leaves in `w0`. Read the text in four groups.

The first two lines build a constant. `mov w8, #0x6667` sets the low half, and `movk w8, #0x6666, LSL #16` inserts the high half, so `w8` is `0x66666667`.

The next four lines divide by ten without a divide. `smull x8, w0, w8` multiplies the two 32-bit values into a 64-bit product. `asr x8, x8, #0x22` shifts the product right by 34, and `lsr x9, x8, #0x3f` takes its sign bit. `add w8, w8, w9` adds the sign bit, which corrects the rounding for a negative score. The result is `score / 10` with C truncation. [Lesson 34](phases/13-tools-and-protocols/34-lifting-to-pseudocode) proves that `0x66666667` and a shift of 34 give that quotient for every 32-bit `int`.

The next three lines are the switch. `sub w8, w8, #0x6` turns the cases 6 to 10 into the indexes 0 to 4. `cmp w8, #0x4` and `b.hi 0x10000054c` send any index above 4 to the default. The compare is unsigned, so a negative score, which gives a negative index, also goes to the default. That is one instruction doing the work of the `default` label and the cases below 6.

The last six lines are the two returns. `adrp x9, 0x100000000` and `add x9, x9, #0x7d0` form the address `0x1000007d0`, the start of `__TEXT,__const` from [section 3.2](#s-inspect-binary-layout-and-the-load-image). `ldr w0, [x9, w8, UXTW #0x2]` loads the 32-bit word at that address plus four times the index. The 20 bytes at file offset 2000 are `1, 2, 3, 4, 4` as little-endian words, so the load returns the grade. The default path is `mov w0, #0x0` and `ret`.

```figure
id: fig-4-4
kind: state
title: the three blocks of _grade
claim: Ghidra's basic_blocks split the fifteen instructions at the one conditional branch, and both leaf blocks end in ret with no successor.
caption: Read from the top block. The arrows are the two successors of the first block, and each leaf block has an empty successors list. From capture/out/06-function-grade.json.
```

**Basic block:** a run of instructions with one entry at the top and one exit at the bottom. Control enters only at the first instruction and leaves only after the last. The dossier's `basic_blocks` lists three for `_grade`: `0x100000518` to `0x10000053c` with successors `0x10000053c` and `0x10000054c`, and the two leaf blocks with no successors. [Lesson 33](phases/13-tools-and-protocols/33-disassembly-and-control-flow) builds the decoder and the block splitter that produce the same partition from bytes.

## The same function on x86-64

```listing
title: grade in the x86-64 object
source: capture/out/06-function-grade-x86_64-O1.json
lang: json
note: The assembly array of the x86-64 dossier, complete. Ghidra renders x86 in Intel syntax with uppercase mnemonics.
---
"assembly": [
  "0x100010: MOVSXD RAX, EDI",
  "0x100013: IMUL RAX, RAX, 0x66666667",
  "0x10001a: MOV RCX, RAX",
  "0x10001d: SAR RCX, 0x22",
  "0x100021: SHR RAX, 0x3f",
  "0x100025: ADD ECX, EAX",
  "0x100027: ADD ECX, -0x6",
  "0x10002a: XOR EAX, EAX",
  "0x10002c: CMP ECX, 0x4",
  "0x10002f: JA 0x0010003d",
  "0x100031: MOV EAX, ECX",
  "0x100033: LEA RCX, [0x1000b4]",
  "0x10003a: MOV EAX, dword ptr [RCX + RAX*0x4]",
  "0x10003d: RET"
],
```

Fourteen instructions, the same shape. The multiply is one instruction, `IMUL RAX, RAX, 0x66666667`, and the two shifts are 34 and 63 again. `XOR EAX, EAX` sets the default return value to zero before the compare, so the default path needs no extra block and the function has one `RET`. The table is at `0x1000b4`, which is `.rodata` plus `0x14`. The listing shows that address as a plain number because Ghidra applied the relocation when it loaded the object. [Section 4.6](#s-analyze-function-and-pseudocode) returns to the `XOR` line, because the decompiler wrote it in a way that hides the zero.

## Where the no-return warnings go

`raw_result.limitations` is empty for `_grade`. When a function calls something Ghidra marked as never returning, the scan can stop there, and this list names the call site. On macOS and Linux, rea runs a repair script after the import. It clears wrong no-return flags on six common library names, so the bodies you read here are the repaired ones. The docs state the effect of a flag that stays. A call that Ghidra inferred as no-return can end the body before the bytes that follow it {{ghidra §Admitted function-analysis semantics}}.

```takeaways
- Read assembly in groups: constants, arithmetic, the compare and branch, the returns.
- Treat an unsigned compare after a subtract as a bounds check that also rejects negatives.
- Name the table an `adrp` and `add` pair points to, then read its bytes at the file offset.
- Check `raw_result.limitations` for a terminal call before you trust the body size.
```

Sources: capture/out/10-mcp-06-procedure-assembly-grade.json, capture/out/06-function-grade.json, capture/out/06-function-grade-x86_64-O1.json, capture/out/04-inspect-macho.json, capture/fixtures/ledger-arm64-O1, capture/fixtures/ledger.c; rea 6.7.0 at 27dc42d: bridge/ghidra/ReaGhidraBridge.java, src/ghidra/GhidraProviderCapabilities.ts; rea docs/ghidra-provider.md
