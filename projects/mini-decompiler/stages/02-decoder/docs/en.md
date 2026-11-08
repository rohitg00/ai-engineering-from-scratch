# Decode the x86-64 subset

Stage 2 of 8. This stage applies [Disassembly and Control Flow](../../../../../phases/13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md), sections "The Instruction Format Has One Rule Per Field" and "Linear Sweep".

## What you build

You build a decoder for the part of x86-64 that clang emits for the fixtures at `-O0` and `-O1`. `decode(code, address)` reads one instruction and returns an `Instruction` with its bytes, a normalized operation, its operands, its operand width, its control-flow kind and its branch target. It also records where the displacement field and the immediate field sit inside the instruction. `linear_sweep` decodes a byte range in address order and lists every byte that it cannot decode.

The decoder is checked against a disassembler listing. For every instruction of the four committed objects, your address, your bytes and your AT&T text must equal the captured listing.

## Why it matters

Every later stage trusts the decoder. A wrong operand width changes a 32-bit value into a 64-bit value, and the recompiled C then differs from the original. A wrong field offset makes stage 3 miss the relocation on the `lea` that holds the jump table base.

The listing gives you an oracle with no judgment in it. You do not decide that your decode looks right. You compare it.

## The subset

| group | encodings |
|---|---|
| prefixes | `66`, `67`, `f2`, `f3`, `f0`, segment overrides `2e 36 3e 26 64 65`, then one REX byte `40` to `4f` |
| ALU | `01 09 11 19 21 29 31 39 85 89` (Ev, Gv), `03 0b 13 1b 23 2b 33 3b 8b` (Gv, Ev), accumulator forms, groups `81 83` |
| data | `88 8a`, `8d` lea, `b8`+r mov, `c7 /0`, `63` movslq, `0f b6 b7 be bf` movzx and movsx |
| arithmetic | `69 6b 0f af` imul, `c1 d1` shifts, `f7` test, not, neg, mul, imul, div, idiv, `99` cltd, `ff /0 /1` |
| control | `70`-`7f`, `0f 80`-`8f`, `e8`, `e9`, `eb`, `ff /2 /4`, `c3`, `0f 90`-`9f` setcc, `0f 40`-`4f` cmovcc |
| other | `90`, `0f 1f` multi-byte nop, `cc`, `0f 0b`, `50`-`5f` push and pop |

Anything else raises `DecodeError` with the address and the opcode bytes.

## Work through one concrete case

At address 0x3 of `tenths_and_fifths` at `-O1`, the bytes are `48 69 c0 67 66 66 66`.

| offset | byte | field | meaning |
|---|---|---|---|
| 0 | `48` | REX | W=1, so the operand size is 64 bits |
| 1 | `69` | opcode | `imul Gv, Ev, Iz`: three operands, 32-bit immediate |
| 2 | `c0` | ModRM | mod=3 (register form), reg=0 (`rax`), rm=0 (`rax`) |
| 3 to 6 | `67 66 66 66` | immediate | 0x66666667, sign-extended to 64 bits |

The result is `imulq $0x66666667, %rax, %rax`, length 7, width 64, `immediate_offset` 3. Remove the `48` and the same bytes decode as `imull` with a 32-bit operand size. The two forms compute different values, and stage 5 recognizes the division idiom only in the 64-bit product.

A memory operand at `-O0`: `48 63 04 81` at 0x6f is `movslq (%rcx,%rax,4), %rax`. ModRM `04` has mod=0 and rm=4, so a SIB byte follows. SIB `81` has scale 1 << 2 = 4, index 0 (`rax`) and base 1 (`rcx`).

A RIP-relative operand: `48 8d 0d 00 00 00 00` at 0x5c is `leaq (%rip), %rcx`. ModRM `0d` has mod=0 and rm=5, which in 64-bit mode means RIP plus a 32-bit displacement. The displacement field starts at offset 3, so its absolute address is 0x5f. That is the `r_offset` of the relocation from stage 1.

A branch: `77 0c` at 0x58 is `ja` with an 8-bit displacement of 12. The target is the end of the instruction plus 12: 0x5a + 0xc = 0x66.

```figure
pj-mini-decompiler-2
```

Type other bytes into the lab, for example `48 63 04 81` or `66 0f 1f 44 00 00`, and read the field table before you write the decoder branch for them.

## Implement the contract

Implement these in the `decoder` module. The starter supplies the operand classes, the `Instruction` dataclass, the AT&T renderer, `_Cursor`, the `_State` helpers (`operand_size`, `register`, `immediate`, `displacement`, `finish`, `relative`), `parse_objdump`, `compare_with_objdump` and `disassemble`.

| function | contract |
|---|---|
| `decode(code: bytes, address: int) -> Instruction` | `address` is an index into `code`. Read legacy prefixes, then at most one REX byte, then the opcode; `0f` selects the two-byte map. An address outside `code` raises `DecodeError`. |
| `_State.modrm(reg_width, rm_width) -> (Reg, Reg or Mem, int)` | Read ModRM, then SIB and displacement for memory forms. REX.R extends reg, REX.X the index, REX.B rm or the base. mod 0 with rm 5 is RIP-relative. SIB index 4 means no index; SIB base 5 with mod 0 means no base and a 32-bit displacement. |
| `_one_byte(state, opcode) -> Instruction` | The one-byte opcodes of the subset table. |
| `_two_byte(state, opcode) -> Instruction` | The `0f` opcodes of the subset table. |
| `linear_sweep(code, start=0, end=None) -> SweepResult` | Decode from `start` to `end`. On `DecodeError`, record `(address, byte)` in `undecodable` and continue at the next byte. |

Operand order follows AT&T: source first, destination last. `Instruction.flow` is `next`, `branch`, `jump`, `call`, `return`, `indirect-jump` or `indirect-call`. Immediates are signed, except for `mov` and shift counts, which the listing prints unsigned.

## Verify and inspect

```bash
python3 scripts/project_test.py mini-decompiler --stage 2 --path learning-artifacts/mini-decompiler --strict
cd learning-artifacts/mini-decompiler
python3 -m minidec disasm samples/samples-x86_64-O1.o --oracle samples/samples-x86_64-O1.objdump.txt
```

The starter copied the fixture objects and listings into `samples`. You can also pass your own object and a listing you captured with `llvm-objdump -d -r`. The command prints every instruction with the relocation target after it, and then reports `oracle: 56/56 instructions agree with llvm-objdump`. The `-O0` object has 102 instructions. The held-out objects have 76 and 38.

## Failure cases

- `90 0f 0a` decoded at address 1 raises `DecodeError` whose reason names `0f 0a`.
- `48 69 c0 67 66` stops inside the immediate and raises instead of reading past the end.
- Fifteen `66` prefixes and a `90` is 16 bytes, which is longer than the 15-byte architectural limit, and raises.
- `31 c0 0f 0a c3` swept linearly gives `xorl %eax, %eax`, two undecodable bytes at 2 and 3, and `retq`.

## Extensions

- Add `movsd` and `cvtsi2sd` with the `f2` prefix and XMM registers, and extend the oracle check to a fixture that uses `double`.
- Add VEX prefixes (`c4`, `c5`) and decode one AVX instruction from your own compiled loop.
- Make `linear_sweep` restart at the next function symbol after a decode error, and measure how many instructions it recovers.
