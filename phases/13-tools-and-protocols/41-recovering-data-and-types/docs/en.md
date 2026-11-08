# Recovering Data and Types: Structs, Arrays, C++ Objects, and DWARF

> A decompiler prints `a->balance` when it has a type table and `*(int *)(param_1 + 4)` when it does not. This lesson builds the table from the accesses, reads the real one from DWARF 5, and shows where the two agree.

**Type:** Build
**Languages:** Python, C, C++, x86-64 assembly
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~140 minutes

## Learning Objectives

- Read a struct member access as base register plus displacement, and an array access as base plus index times stride, from the Intel SDM addressing rules.
- Apply the System V alignment rules by hand to `struct account` and explain each padding byte.
- Build a type-recovery pass that turns the accesses in a listing into field offsets, widths, kinds, a stride, and a size, with the evidence for each.
- Write a DWARF 5 reader for `.debug_info`, `.debug_abbrev`, `.debug_str_offsets`, and `.debug_addr` of a relocatable object, and check it against `llvm-dwarfdump`.
- Compare the recovered layout with the DWARF layout and name every difference as missing evidence, a merged access, or an unprovable kind.
- Read an Itanium C++ vtable, its typeinfo, and its mangled names from relocations, and resolve a virtual call to a slot.

## The Problem

You compiled `account.c` without `-g` and asked an agent what `bump` does. The agent sent the object to Ghidra 12.1.4 and got this back:

```c
void bump(long param_1,int param_2)
{
  *(int *)(param_1 + 4) = param_2 + *(int *)(param_1 + 4);
  return;
}
```

The same source compiled with `-g` gives this from the same decompiler:

```c
int bump(account *a,int by)
{
  a->balance = by + a->balance;
  return a->balance;
}
```

The instructions are identical in both objects. The difference is a type table. With the table the decompiler knows that the first parameter points at a 32-byte structure whose field at offset 4 is a 4-byte `int` named `balance`. Without it the decompiler knows only that something 8 bytes wide arrived in `%rdi` and that 4 bytes at `+4` were read and written.

Everything in that table has a source. The offset 4 comes from the displacement byte of `addl 0x4(%rax), %ecx`. The width 4 comes from the `l` suffix. The name comes from a `DW_TAG_member` entry in `.debug_info`. This lesson builds both halves: a pass that recovers what the instructions prove, and a reader that decodes what the compiler recorded. The gap between them is what a type name costs.

```figure
re-41-struct-recovery
```

## A Member Access Is a Displacement

Intel SDM Volume 1, section 3.7.5, defines the effective address as `Offset = Base + (Index * Scale) + Displacement`, with a scale of 1, 2, 4, or 8 and a displacement of 8, 16, or 32 bits. Section 3.7.5.1 adds the 64-bit mode form `RIP + Displacement`. A struct member access uses the first form with no index: the base register holds the address of the object and the displacement is the member offset. An array access adds the index term, and the scale or a separate multiply carries the element size.

Take `bump` at `-O0`. The listing from `llvm-objdump -d -r` reads:

```text
       4: 48 89 7d f8                  	movq	%rdi, -0x8(%rbp)
       e: 48 8b 45 f8                  	movq	-0x8(%rbp), %rax
      12: 03 48 04                     	addl	0x4(%rax), %ecx
      15: 89 48 04                     	movl	%ecx, 0x4(%rax)
```

Decode `03 48 04` with the rules from lesson 33. `03` is `ADD r32, r/m32`. ModRM `48` is `01 001 000`: `mod = 01` means a memory operand with an 8-bit displacement, `reg = 001` is `%ecx`, `r/m = 000` is `%rax`. The displacement byte is `04`. The instruction reads 4 bytes at `%rax + 4` and adds them into `%ecx`. The `l` suffix that `llvm-objdump` prints is the operand size, so the field is 4 bytes wide. The `%rax` came from the frame slot at `-0x8(%rbp)`, and that slot received `%rdi`, the first integer argument under the System V calling convention. Three facts follow: the first parameter is a pointer, the object it points at has a 4-byte field at offset 4, and `bump` reads and writes that field.

Nothing in these bytes says `int`, `balance`, or `struct account`. Nothing says how big the object is. The remaining 28 bytes of the struct are invisible to `bump`.

## The System V Layout Rules

The x86-64 psABI, section 3.1.2, gives three rules for aggregates. "Structures and unions assume the alignment of their most strictly aligned component. Each member is assigned to the lowest available offset with the appropriate alignment. The size of any object is always a multiple of the object's alignment." Figure 3.1 of the same document gives the scalar sizes and alignments: `char` 1 and 1, `short` 2 and 2, `int` 4 and 4, `double` 8 and 8, any pointer 8 and 8.

Apply the rules to the struct in `account.c`:

```c
struct account {
    char kind;
    int balance;
    short code;
    double rate;
    const char *label;
};
```

| Member | Size | Alignment | Lowest offset that fits | Padding before |
|---|---|---|---|---|
| `kind` | 1 | 1 | 0 | 0 |
| `balance` | 4 | 4 | 4 | 3 (bytes 1 to 3) |
| `code` | 2 | 2 | 8 | 0 |
| `rate` | 8 | 8 | 16 | 6 (bytes 10 to 15) |
| `label` | 8 | 8 | 24 | 0 |

The last member ends at 32. The strictest alignment is 8, and 32 is a multiple of 8, so the size is 32 with no tail padding. Nine bytes of the 32 are padding, and the psABI says "The contents of any padding is undefined".

The order of the members decides the size. The same five members as `double, pointer, int, short, char` fill offsets 0, 8, 16, 20, 22 and end at 23, which rounds up to 24. `sysv_layout()` in `code/main.py` applies the three rules and produces both results. Python's `ctypes` module applies the same rules through the host compiler's convention, and `ctypes.sizeof`, `ctypes.alignment`, and the `.offset` of each field give 32, 8, and `0, 4, 8, 16, 24` for the same struct. The program itself prints the third copy when you build and run it on this machine:

```text
sizeof 32 align 8
kind 0 balance 4 code 8 rate 16 label 24
sum 315 tag -3 projected 318.75 label_length 7
```

That native build is arm64. The Arm AAPCS64 states the same aggregate rules in its section 5.10.1, and Apple's arm64 document keeps these five scalar sizes, so the numbers agree across the two targets. The lesson's x86-64 objects are compiled with `-target x86_64-unknown-linux-gnu` so that the ELF reader from lesson 33 and the DWARF reader below work on them.

## Read the Rest of the Struct by Hand

`bump` sees one field. The other four functions in `account.c` see the rest, and each one shows a different instruction form. All addresses below are from `account-x86_64-O0-g.objdump.txt`.

`sum_balances` indexes an array of the struct:

```text
      51: 48 8b 45 f8                  	movq	-0x8(%rbp), %rax
      55: 48 63 4d ec                  	movslq	-0x14(%rbp), %rcx
      59: 48 c1 e1 05                  	shlq	$0x5, %rcx
      5d: 48 01 c8                     	addq	%rcx, %rax
      60: 8b 40 04                     	movl	0x4(%rax), %eax
```

`%rax` is `list`, `%rcx` is `i` sign-extended to 64 bits, and `shlq $0x5` multiplies it by 32. After the `addq`, `%rax` is `list + 32 * i`, and the load reads 4 bytes at offset 4 of element `i`. The shift count is the only place in this object where the size of the struct appears as a number. The loop that contains these instructions runs from `0x49` to the `jmp 0x49` at `0x72`.

`tag` reads two narrow fields:

```text
      8c: 0f be 00                     	movsbl	(%rax), %eax
      98: 0f bf 48 08                  	movswl	0x8(%rax), %ecx
```

`movsbl` loads one byte at offset 0 and sign-extends it, so the field at 0 is a signed 1-byte integer. `movswl` loads two bytes at offset 8 with sign extension, so the field at 8 is a signed 2-byte integer. At `-O1` the first access becomes `cmpb $0x6c, (%rdi)`, which still says 1 byte at offset 0 and says nothing about the sign.

`projected` reads a float:

```text
      cc: f2 0f 2a 40 04               	cvtsi2sdl	0x4(%rax), %xmm0
      d5: f2 0f 59 40 10               	mulsd	0x10(%rax), %xmm0
```

`cvtsi2sdl` converts a signed 32-bit integer from memory to a double, which confirms that offset 4 holds a signed 4-byte integer. `mulsd` multiplies by a double from memory, so offset 16 holds an 8-byte floating-point value.

`label_length` reads a pointer and then follows it:

```text
      f3: 48 8b 40 18                  	movq	0x18(%rax), %rax
      f7: 48 63 4d f4                  	movslq	-0xc(%rbp), %rcx
      fb: 80 3c 08 00                  	cmpb	$0x0, (%rax,%rcx)
```

The `movq` reads 8 bytes at offset 24. On its own that is an 8-byte integer or a pointer. The `cmpb` uses the loaded value as the base of a memory operand. A value that is used as an address is a pointer. The `cmpb` reads 1 byte at index `%rcx` from it, and at `-O1` the pointer is advanced with `leaq 0x1(%rcx), %rcx` inside the loop, so the pointed-to elements are 1 byte apart.

Put the five functions together and the struct is `{ i8 at 0, i32 at 4, i16 at 8, f64 at 16, pointer at 24 }` with a stride of 32. The gaps at 1 to 3 and 10 to 15 are exactly the padding the psABI rules predicted. What the instructions do not say: the member names, that the pointer is `const char *`, the declared type of the signed byte at 0, which the source spells `char`, and that the five functions receive the same type. The last claim comes from `main`, which passes one frame object to all five. At `-O0` the call sites make that visible: `leaq -0x70(%rbp), %rdi` followed by `addq $0x20, %rdi` before `callq bump`, and `addq $0x40, %rdi` before `callq tag`. The offsets 0, `0x20`, and `0x40` are three elements of one array, and the `memcpy` of `0x60` bytes that fills it is 96 bytes, which is three elements of 32.

## The Pass

`trace_function()` in `code/main.py` walks one function's instructions in address order and keeps a small abstract state. A holder is a 64-bit register or a frame slot such as `-0x8(%rbp)`. Each holder has one of three values. A `Pointer` is a root plus a constant offset plus a set of strides, where a stride records that an unknown multiple of that many bytes was added. An `Index` is an integer of unknown value that is a multiple of a scale. Anything else is nothing.

The state starts with the six System V argument registers holding `Pointer("param0", 0)` through `Pointer("param5", 0)`. Then each instruction applies one rule:

- A `movq` between a 64-bit register and a frame slot copies the value. A 32-bit or narrower write to a register makes it an `Index` with scale 1.
- A `leaq` with a pointer base produces a pointer with the displacement added, and with an index register it adds `scale * index_scale` to the strides. A `leaq` whose base is `%rbp` or `%rsp` names a frame object, which is how `main` passes `rows`.
- `shlq $n` on an `Index` multiplies its scale by `2^n`, and `imulq $k` multiplies by `k`.
- `addq` of a pointer and an index keeps the pointer and adds the index scale to the strides. `addq $k` to a pointer moves its offset and is also recorded as an increment of that register.
- A call makes every caller-saved register unknown, and the argument registers that hold pointers are recorded as a call site.
- Any memory operand whose base register holds a pointer becomes an `Access` with the pointer's root and offset, the width and kind from the mnemonic, and a store flag.

Width and kind come from the mnemonic alone. `access_width()` maps the `b`, `w`, `l`, and `q` suffixes to 1, 2, 4, and 8 bytes, `movsbl` and `movswl` to signed narrow loads, `movzbl` to unsigned, the `sd` and `ss` scalar SSE instructions to 8-byte and 4-byte floats, `cvtsi2sdl` to a signed 4-byte integer source, and the 16-byte `movaps` family to a vector. `leaq` and the `nop` forms are not accesses.

```python
if memory.base in FRAME_REGISTERS:
    return Pointer(f"frame({memory.base}{format_signed(memory.displacement) if memory.displacement else ''})", 0)
base = env.get(memory.base)
if not isinstance(base, Pointer):
    return Unknown
strides = set(base.strides)
if memory.index is not None:
    index_value = env.get(memory.index)
    strides.add((index_value.scale if isinstance(index_value, Index) else 1) * memory.scale)
return Pointer(base.root, base.offset + memory.displacement, frozenset(strides), base.origin)
```

A load of 8 bytes through a pointer produces a new pointer whose root names the field it came from, such as `param0->0x18`. When that value is later used as a base, or advanced with `leaq`, the field it came from is marked as a proven pointer. That is the rule that turns offset 24 from "8 bytes" into "pointer".

### Four kinds of stride evidence

`infer_layout()` merges the accesses of every witness function and collects the stride from four sources, each with the instruction that produced it.

| Kind | Where it comes from | Build that shows it |
|---|---|---|
| `scale` | an `Index` with scale above 1 reached a pointer, from `shlq $0x5` or `imulq` | `-O0`, `shlq $0x5, %rcx` at `0x59` |
| `loop-step` | a 64-bit increment of the base or index register inside a loop that also contains the access | `-O1`, `addq $0x20, %rdx` at `0x24` |
| `offset-delta` | same-width accesses through one base register inside one loop, at offsets a constant apart | `-O2`, eight loads 32 apart |
| `call-site` | the offsets at which one frame object is passed to the witness functions | `-O0`, `main` passes `rows`, `rows+0x20`, `rows+0x40` |

A loop is a backward `jmp` or conditional branch, and an increment counts only when the loop range contains both the increment and the access. That rule excludes the `addl $0x1, %eax` that advances `i` at `-O0`, because it is a 32-bit add and because the access does not go through `%eax`. The final stride is the greatest common divisor of every value found. The size is the stride when the stride is at least as large as the end of the last field.

### The vectorised loop at -O2

At `-O2` clang vectorises `sum_balances`. The loop body from `0x50` to `0xaa` reads eight elements per pass:

```text
      3b: 48 8d 87 e4 00 00 00         	leaq	0xe4(%rdi), %rax
      50: 66 0f 6e 50 80               	movd	-0x80(%rax), %xmm2
      55: 66 0f 6e 98 60 ff ff ff      	movd	-0xa0(%rax), %xmm3
      61: 66 0f 6e 90 40 ff ff ff      	movd	-0xc0(%rax), %xmm2
      69: 66 0f 6e a0 20 ff ff ff      	movd	-0xe0(%rax), %xmm4
      7d: 66 0f 6e 10                  	movd	(%rax), %xmm2
      81: 66 0f 6e 58 e0               	movd	-0x20(%rax), %xmm3
      8a: 66 0f 6e 50 c0               	movd	-0x40(%rax), %xmm2
      8f: 66 0f 6e 60 a0               	movd	-0x60(%rax), %xmm4
      a0: 48 05 00 01 00 00            	addq	$0x100, %rax
      aa: 75 a4                        	jne	0x50 <sum_balances+0x40>
```

`%rax` starts at `list + 0xe4`. The eight displacements place the loads at offsets `0x04, 0x24, 0x44, 0x64, 0x84, 0xa4, 0xc4, 0xe4` from `list`, which are `4, 36, 68, 100, 132, 164, 196, 228`. The increment is `0x100`, which is 256. A pass that records offsets as it sees them reports eight fields and a struct of at least 232 bytes. The listing is correct and the conclusion is wrong.

`fold_unrolled()` applies one rule. Inside one loop, take the same-width accesses through one base register. Their offsets are `d` apart, here 32. If the loop step is `k * d` and there are exactly `k` distinct offsets, the loop was unrolled `k` times, and every access is the same element access at offset `(offset - lowest) mod d`. Here `256 = 8 * 32` with eight offsets, so all eight loads fold onto offset 4, and the stride evidence records `offset-delta 32`, `unrolled 32`, and `loop-step 256`. The scalar remainder loop at `0xe0` adds `scale 32` from `shlq $0x5, %rdx` and `loop-step 32` from `addq $0x20, %rdx`. The greatest common divisor of all five values is 32.

The figure has a button that turns folding off. With it off, the `-O2` build shows seven fields past byte 32 and no size. That state is what a reader sees who trusts the displacement without the loop.

## DWARF 5 From the Bytes

The `-g` build of `account.c` carries eight debug sections. `.debug_info` is 493 bytes, `.debug_abbrev` 179, `.debug_str` 230, `.debug_str_offsets` 124, `.debug_addr` 112, `.debug_line` 312, `.debug_line_str` 12, and `.debug_frame` 264. The introduction of the DWARF 5 standard lists `.debug_str_offsets`, `.debug_addr`, and `.debug_line_str` as new in Version 5. The reader in `code/main.py` needs the first five.

### The unit header

Section 7.5.1.1 of the standard gives the full compilation unit header: `unit_length`, `version`, `unit_type`, `address_size`, and `debug_abbrev_offset`. The first twelve bytes of `.debug_info` are:

```text
e9 01 00 00   unit_length = 0x1e9 = 489
05 00         version = 5
01            unit_type = DW_UT_compile
08            address_size = 8
00 00 00 00   debug_abbrev_offset = 0
```

The `unit_type` byte is new in Version 5, and the standard says so in the same section. The length counts the bytes after itself, so the next unit would start at `4 + 489 = 493`, the end of the section. `llvm-dwarfdump --debug-info` prints the same five values on its `Compile Unit:` line, and the first test parses that line and compares.

### Abbreviations

Section 2.1 says each debugging information entry "consists of an identifying tag and a series of attributes". The entry itself stores only an abbreviation code. The code selects a declaration in `.debug_abbrev` (section 7.5.3) that names the tag, says whether children follow, and lists each attribute with its form. This object has 14 declarations. Two matter here:

```text
[12] DW_TAG_structure_type  DW_CHILDREN_yes
     DW_AT_name              DW_FORM_strx1
     DW_AT_byte_size         DW_FORM_data1
     DW_AT_decl_file         DW_FORM_data1
     DW_AT_decl_line         DW_FORM_data1
[13] DW_TAG_member           DW_CHILDREN_no
     DW_AT_name              DW_FORM_strx1
     DW_AT_type              DW_FORM_ref4
     DW_AT_decl_file         DW_FORM_data1
     DW_AT_decl_line         DW_FORM_data1
     DW_AT_data_member_location  DW_FORM_data1
```

`parse_abbreviations()` reads ULEB128 code, ULEB128 tag, one children byte, then attribute and form pairs until a `0, 0` pair. Section 7.5.6 gives the form encodings: `data1` is one byte, `ref4` is a 4-byte offset relative to the unit, `strx1` is a 1-byte index into the string offsets table, `sec_offset` and `data4` are 4 bytes, `addrx` is a ULEB128 index into the address table, `exprloc` is a ULEB128 length and that many bytes, and `flag_present` has no bytes at all.

### Decode the balance member by hand

The structure entry for `account` starts at offset `0x195` with the bytes `0c 15 20 00 03`. The abbreviation code is 12, the structure. `DW_AT_name` is string index `0x15`, `DW_AT_byte_size` is `0x20` = 32, `DW_AT_decl_file` is 0, and `DW_AT_decl_line` is 3, which is the line of `struct account {` in the source.

The second member entry starts at `0x1a3` with `0d 10 88 01 00 00 00 05 04`:

1. `0d` is abbreviation 13, a member.
2. `10` is `DW_AT_name` as `strx1`: string index 16.
3. `88 01 00 00` is `DW_AT_type` as `ref4`: offset `0x188` from the unit start, which is the `DW_TAG_base_type` entry named `int`.
4. `00` is `DW_AT_decl_file` and `05` is `DW_AT_decl_line`: line 5 of `account.c`.
5. `04` is `DW_AT_data_member_location`: offset 4.

Section 5.7.6 says a member entry "may have either a DW_AT_data_member_location attribute or a DW_AT_data_bit_offset attribute" and that an integer constant "is the offset in bytes from the beginning of the containing entity". That byte is the same number as the displacement in `addl 0x4(%rax), %ecx`, and `compare_layouts()` is the function that puts the two side by side.

### Strings and addresses go through two tables

String index 16 is not an offset into `.debug_str`. The reader takes `DW_AT_str_offsets_base` from the unit entry, which is 8, and reads the 4-byte entry at `8 + 4 * 16` in `.debug_str_offsets`. That entry holds the offset of `"balance"` in `.debug_str`. The same indirection applies to addresses. The entry for `sum_balances` starts with the bytes `07 07`: abbreviation 7, a subprogram, then `DW_AT_low_pc` as `addrx` index 7. The 8-byte entry at `8 + 8 * 7` in `.debug_addr` is `0x30`, the address of the function in `.text`. The first six entries of that table are the addresses of the six string literals.

In a relocatable object neither table holds its final values. Every entry in `.debug_str_offsets` is zero in the file, and `.rela.debug_str_offsets` holds 29 `R_X86_64_32` relocations against `.debug_str` with the real offset in the addend. `.debug_addr` has 13 `R_X86_64_64` relocations against `.text` and `.rodata.str1.1`. `.debug_info` has four relocations of its own: the abbreviation offset, `DW_AT_str_offsets_base` as `.debug_str_offsets+0x8`, `DW_AT_stmt_list`, and `DW_AT_addr_base` as `.debug_addr+0x8`. `ElfObject.relocated()` applies `S + A` for the 32-bit and 64-bit types before the reader parses a section. A section symbol has value 0 in an object file, so the field receives the addend. `llvm-dwarfdump` does the same resolution, which is why its output shows names and addresses with every index resolved.

### Types, functions, and locations

`DwarfInfo.type_name()` follows `DW_AT_type` references. The `label` member points at a `DW_TAG_pointer_type`, which points at a `DW_TAG_const_type`, which points at the `char` base type, so the name composes to `const char *`. `type_size()` returns `DW_AT_byte_size` for base types and structures, 8 for a pointer, and count times element size for an array. `type_kind()` reduces the `DW_AT_encoding` of a base type to `int` with a sign, or `float`, and a pointer type to `pointer`, which is the vocabulary the comparison uses.

`DwarfInfo.functions()` reads six `DW_TAG_subprogram` entries. `bump` runs from `0x0` to `0x21`, which is `DW_AT_low_pc` plus the `DW_AT_high_pc` length. Its frame base is `DW_OP_reg6 RBP`, and its parameter `a` has the location expression `91 78`: `DW_OP_fbreg` with the SLEB128 value `0x78`, which is -8. That is the frame slot `-0x8(%rbp)` into which the listing stored `%rdi` at address `0x4`. The debug information and the instructions describe the same slot from two sides.

## Compare the Two Layouts

`compare_layouts()` walks the DWARF members and looks for an inferred field at the same offset. A member with no field is `no-evidence`. A field of a different size is `size-mismatch`. A pointer member whose field was never dereferenced is `pointer-unproven`. A kind that disagrees, such as a float where the instructions used integer arithmetic, is `kind-mismatch`. Inferred fields that start inside a member or inside padding are `unexpected`. The size compares the stride with `DW_AT_byte_size`.

The numbers for the three builds, from `python3 code/main.py`:

| Build | Accesses through the first parameter | Fields | Stride evidence | Members matched | Size |
|---|---|---|---|---|---|
| `-O0` | 11 | 5 | `scale 32`, `call-site 32`, `call-site 64` | 5 of 5 | 32, match |
| `-O1` | 9 | 5 | `loop-step 32` | 5 of 5 | 32, match |
| `-O2` | 17 | 5 after folding, 12 before | `offset-delta 32`, `unrolled 32`, `loop-step 256`, `scale 32`, `loop-step 32` | 5 of 5 | 32, match |

The inferred gaps are bytes 1 to 3 and 10 to 15 in every build, and those are exactly the padding bytes of the DWARF layout. Every inferred field sits at a multiple of its own size, which is what the psABI rules require, and `natural_alignment_ok()` records that.

Add the functions one at a time and the picture changes. With `bump` alone the layout is one field at offset 4, the size is unknown, and the lower bound is 8. `sum_balances` adds the stride. `tag` adds offsets 0 and 8. `projected` adds the float at 16. `label_length` adds the pointer at 24 and proves it is a pointer. `main` adds the call sites at `-O0` and adds nothing at `-O1` and `-O2`, because the compiler inlined every call. The figure steps through this order for each build.

Three things stay out of reach. The names are not in the instructions. The qualifier `const` is not in the instructions. The pointee type of `label` is only "elements 1 byte apart" from the `leaq 0x1(%rcx), %rcx` in the string loop, which is consistent with `char` and with `unsigned char` and `_Bool`. At `-O1` the sign of the byte at offset 0 is unknown, because `cmpb $0x6c, (%rdi)` compares without extending. The pass reports `int8` there and `i8` at `-O0`, where `movsbl` sign-extends. These are the facts lesson 35 records as unknowns.

## C++ Objects

`shapes.cpp` defines `Shape` with a virtual destructor, a pure virtual `area()`, and a virtual `name()`, and `Rect`, which derives from `Shape` and adds two `int` members. The Itanium C++ ABI governs how clang lays these out on x86-64 Linux.

### Mangled names

Section 5.1.2 of the ABI says "a name is mangled by prefixing `_Z` to an encoding of its name". The object has 19 such symbols. `_ZNK4Rect4areaEv` reads as `_Z`, then `N` for a nested name, `K` for a const member function, `4Rect` and `4area` as length-prefixed source names, `E` to close the nested name, and `v` for an empty parameter list. `llvm-cxxfilt` prints `Rect::area() const`. `_Z8describeRK5Shapei` is `describe(Shape const&, int)`: `R` is a reference, `K` is const, `5Shape` is the class, `i` is `int`. The special names in section 5.1.4 are `_ZTV` for a vtable, `_ZTI` for typeinfo, and `_ZTS` for the typeinfo name string. Constructors and destructors are `C1`, `C2`, `D0`, `D1`, and `D2`, so `_ZN4RectD0Ev` and `_ZN4RectD2Ev` both print as `Rect::~Rect()`: the deleting destructor and the base-object destructor share a source name.

`Demangler` in `code/main.py` covers that subset plus the builtin type codes of section 5.1.5.2 and the `S_` substitutions of section 5.1.10. The test runs it on all 19 names and compares with the captured `llvm-cxxfilt --no-strip-underscore` output. The flag matters on macOS, where the tool strips one leading underscore by default and then fails to recognise `Z8describe...`.

### The vtable from its relocations

Section 2.5.2 of the ABI lists the components of a virtual table in order: virtual call offsets, virtual base offsets, offset to top, the typeinfo pointer, and then the virtual function pointers. The address point, the value an object's vptr holds, is the address of the first function pointer (section 2.6.2). `Rect` has no virtual bases, so its table is offset to top, typeinfo, and functions.

The symbol `_ZTV4Rect` is 0x30 bytes, six 8-byte slots. In the object every byte is zero. The contents are in `.rela.data.rel.ro._ZTV4Rect`:

```text
0000000000000008 R_X86_64_64              _ZTI4Rect
0000000000000010 R_X86_64_64              _ZN4RectD2Ev
0000000000000018 R_X86_64_64              _ZN4RectD0Ev
0000000000000020 R_X86_64_64              _ZNK4Rect4areaEv
0000000000000028 R_X86_64_64              _ZNK4Rect4nameEv
```

Slot 0 holds the offset to top, which is 0 and needs no relocation. Slot 1 is the typeinfo. The address point is at `+16`. From there, slot 0 is the complete-object destructor, slot 1 the deleting destructor, slot 2 `area`, slot 3 `name`. `read_vtable()` reads the symbol size, the relocations in its range, and the zero at offset 0. `Shape`'s table has the same shape with `__cxa_pure_virtual` in slot 2, which is the runtime function that a pure virtual call reaches.

### RTTI

Section 2.9.4 describes `std::type_info` as a vptr followed by a pointer to the mangled type name, and lists the derived classes. `_ZTI4Rect` has three relocations: `_ZTVN10__cxxabiv120__si_class_type_infoE+0x10`, `_ZTS4Rect`, and `_ZTI5Shape`. The first is the vtable of `__si_class_type_info`, the class the ABI uses for a type with a single public non-virtual base at offset zero, and the `+0x10` is that vtable's address point. The second points at the string `4Rect`, which is the mangled type name, and `name()` on a `type_info` returns exactly that string. The third is the base. `_ZTI5Shape` uses `__class_type_info` and has no base pointer. `read_typeinfo()` returns these three facts.

### The virtual call

`describe` at `-O0` makes one virtual call:

```text
       f: 48 8b 7d f8                  	movq	-0x8(%rbp), %rdi
      13: 48 8b 07                     	movq	(%rdi), %rax
      16: ff 50 10                     	callq	*0x10(%rax)
```

The first `movq` loads the object pointer. The second reads 8 bytes at offset 0 of the object, which is the vptr, because the ABI places it first in a class with virtual functions. The `callq` goes through `0x10` past the vptr, and `0x10 / 8` is slot 2. `find_virtual_calls()` matches the pattern and reports both candidates: `Rect::area() const` from `_ZTV4Rect` and `__cxa_pure_virtual` from `_ZTV5Shape`. Which one runs depends on the object, which is why the call is indirect.

DWARF records the same slot. The `DW_TAG_subprogram` entries for `area` in both classes carry `DW_AT_vtable_elem_location (DW_OP_constu 0x2)`, `name` carries slot 3, and the destructors carry slot 0. `Rect` is a `DW_TAG_structure_type` of 16 bytes with a `DW_TAG_inheritance` entry for `Shape` at offset 0 and members `w` at 8 and `h` at 12. `Shape` is 8 bytes with one artificial member `_vptr$Shape`. Two independent derivations give slot 2 for `area`: the relocation table and the debug entries.

At `-O1` the object has no vtable at all. `main` constructs `Rect` as a local, so the compiler resolved `r.name()` and `describe(r, 2)` at compile time and inlined them. Nothing takes the address of the table, so the table is not emitted. `describe` still contains `movq (%rdi), %rax` and `callq *0x10(%rax)`, because its parameter can be any `Shape`. A missing vtable is a fact about one object file, and the test `test_the_optimised_object_keeps_the_call_pattern_but_drops_the_vtables` checks both halves.

The Microsoft ABI differs in every one of these details. Decorated names start with `?` and encode the calling convention, so `void test(void)` compiled as C++ `__cdecl` is `?test@@ZAXXZ`. The RTTI locator sits at `vfptr[-1]` as a `_RTTICompleteObjectLocator`, and the symbols are `??_7` for a vftable and `??_R4` for the locator. Microsoft's own documentation says there are "no standards for C++ naming between compiler vendors". This lesson's fixtures are Itanium only.

## How the Tools Present Recovered Types

Every row below that names an output was produced on this machine and captured into `code/fixtures/tools/`. Rows for tools that are not installed here describe their documentation and say so.

| Tool | Version, licence | Where types live | On our fixtures |
|---|---|---|---|
| Ghidra | 12.1.4, 2026-09-21, Apache-2.0 | Data Type Manager with built-in, user-defined, and derived types; `.gdt` archives; types used by a program are copied into it | With DWARF: `/DWARF/account.c/account size=32 align=8` and `a->balance = by + a->balance;`. Without: `*(int *)(param_1 + 4)` with `long param_1`, `tag(char *param_1)`, and `*(char **)(param_1 + 0x18)` |
| IDA Pro | 9.4, 2026-07-13, commercial; IDA Free is non-commercial with a cloud decompiler for x86 only | Local Types window, `.til` type libraries, DWARF and PDB import into a `dwarf` or `pdb` folder | Not installed. Documentation only |
| Binary Ninja | 6.0, 2026-09-03, commercial with a Free edition | Type editing, header import and export, type archives, debug info from DWARF and PDB, type libraries, platform types | Not installed. Documentation only |
| radare2 | 6.2.4, 2026-10-05, LGPLv3 | `ts`, `tsc`, `afvd` | `ts` and `tsc account` printed nothing for the relocatable object with `bin.dbginfo=true`; `pdf` shows `mov dword [rax + 4], ecx` with source line comments from DWARF |
| rizin | 0.9.1, 2026-06-29, LGPL core | `ts`, `tsc`, `afvd` | `tsc account` printed `struct account { char kind; int balance; short code; double rate; const char *label; };` from DWARF; the build without `-g` lists only its bundled header types |
| lldb | lldb-1703.0.236.21 | `image lookup -t` | `byte-size = 32` and the full `compiler_type` text from the ELF object |
| gdb | not installed here | `ptype /o` prints "the offsets and sizes of fields in a struct" with holes marked | Documentation only |
| pyelftools | 0.33, public domain | Python API over `.debug_info` | A 43-line script prints the same five members and `unit version 5` |
| llvm-dwarfdump | Apple LLVM 17.0.0 | `--debug-info`, `--debug-abbrev`, `--debug-str-offsets` | The oracle for every reader test |

Ghidra's output without DWARF shows the same two rules at work. Its decompiler assigned `char *` to the parameter of `tag` because the function compares one byte through it, and `char **` to the field at `0x18` because `label_length` dereferences the loaded value and compares bytes. Those are the same two rules the pass in this lesson applies: width from the instruction, pointer from the dereference. Ghidra's decompiler documentation says that p-code varnodes "do not necessarily have a data-type associated with them" and that the decompiler "ultimately assigns a formal data-type" by propagation. The option "Infer constant pointers" extends the same propagation to constants. Ghidra 12.1 added bitfield recovery to the decompiler, which this lesson's fixtures do not exercise.

The hand-made table is the other half of the story. Ghidra's Data Type Manager, IDA's Local Types, Binary Ninja's type archives, and rizin's `td` all let you type the struct from the recovered layout and watch the decompiler re-render. The pass tells you what to type and which fields you are guessing.

rea 6.5.0 with its Ghidra provider returns the decompiler text as a record. Everything in the Ghidra row applies to it, and the record carries the type names without the evidence that produced them. Running `python3 code/main.py infer` on the same listing gives you that evidence.

## Type Inference Research

The pass here is the constraint-generation half of a type inference system, restricted to one struct reached from a parameter. The field has gone further.

- TIE (Lee, Avgerinos, Brumley, NDSS 2011) framed type reconstruction as constraint generation and solving over a binary IR, measured conservativeness and precision, and compared against a commercial decompiler on 87 coreutils programs.
- Retypd (Noonan, Loginov, Cok, PLDI 2016) added subtyping, polymorphism, and recursive types, and reported reconstruction of pointer `const` annotations with 98% recall. An open-source implementation exists under GrammaTech's name.
- OSPREY (Zhang and others, IEEE S&P 2021) treats each memory location as a random variable and infers the most probable types.
- DIRTY (Chen and others, USENIX Security 2022) and ReSym (Xie and others, CCS 2024) post-process decompiler output with learned models, and ReSym reports 72.9% precision on full struct layouts.
- RecStruct (Chen and others, USENIX Security 2026) recovers nested structs without a decompiler, with flow-insensitive symbolic execution and union-find over stack slots.

The stack struct is the first thing this lesson's pass skips. At `-O1`, `main` keeps `rows` on the stack and the inlined code reads `0x24(%rsp)`, `0x40(%rsp)`, `0x48(%rsp)`, `0x30(%rsp)`, and `0x38(%rsp)`. Those offsets modulo 32 are 4, 0, 8, 16, and 24: the same struct, with no parameter to seed from. The Practice Lab asks you to recover it.

## Build It

Run the demo:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types
python3 code/main.py
```

The output is one JSON report with five parts. `dwarf` holds the unit header, the structures, and the functions of the `-O0` object. `oracles` holds the psABI rule layout, the `ctypes` layout, the DWARF layout, the native run, and an `agree` flag. `builds` holds the accesses, the inferred layout, and the comparison for each of the three objects. `cxx` holds the demangled names, both vtables, both typeinfo records, the virtual call, and the DWARF slots. `tools` lists the captured tool outputs.

Expected shape:

```json
{
  "dwarf": {"unit": {"unitLength": 489, "version": 5, "unitType": "DW_UT_compile", "addressSize": 8, "abbrevOffset": 0}, "...": "..."},
  "oracles": {"agree": true, "psabiRules": {"size": 32, "align": 8, "...": "..."}, "...": "..."},
  "builds": {
    "O0": {"layout": {"stride": 32, "size": 32, "gaps": [1, 2, 3, 10, 11, 12, 13, 14, 15], "...": "..."}, "comparison": {"matches": 5, "members": 5, "...": "..."}},
    "O1": {"...": "..."},
    "O2": {"...": "..."}
  },
  "cxx": {"virtualCalls": [{"slot": 2, "candidates": {"Shape": "__cxa_pure_virtual", "Rect": "_ZNK4Rect4areaEv"}, "...": "..."}], "...": "..."}
}
```

Read `code/main.py` in this order:

1. `ElfObject` reads sections, symbols, and relocations, and `relocated()` applies `S + A` to a debug section.
2. `parse_abbreviations()` and `DwarfInfo._parse_unit()` read the header, the abbreviation table, and the entries, then resolve `strx` and `addrx` through the two tables.
3. `DwarfInfo.struct_layouts()` and `functions()` turn entries into `StructLayout` and `FunctionInfo` records, with `type_name()`, `type_size()`, and `type_kind()`.
4. `parse_listing()`, `parse_memory()`, and `access_width()` read the `llvm-objdump` text.
5. `trace_function()` is the abstract state machine, and `fold_unrolled()` and `infer_layout()` turn accesses into a layout.
6. `compare_layouts()` produces the status rows, and `sysv_layout()` and `ctypes_layout()` are the two other oracles.
7. `Demangler`, `read_vtable()`, `read_typeinfo()`, and `find_virtual_calls()` cover the C++ object.

Four more commands exist. `python3 code/main.py dwarf FILE.o` prints the structures and functions of any DWARF 5 relocatable object. `python3 code/main.py infer LISTING.txt [FILE.o]` runs the pass on a listing and, with an object, compares against its DWARF. `python3 code/main.py demangle NAME...` and `python3 code/main.py vtable FILE.o` cover the C++ half.

## Use It

On a new object you built yourself:

1. Capture `llvm-objdump -d -r` of the object and keep it beside the object. The pass reads that text.
2. Run `python3 code/main.py infer` on the listing. Read the witnesses line first: it names the functions whose first parameter was used as a memory base. If a function is missing, its parameter never reached a memory operand, or it reached one through a path the pass does not track.
3. Read each field with its access count. One access is one witness. Record a field with a single witness as inferred.
4. Read the stride evidence. A `call-site` or `scale` entry is strong. A single `loop-step` entry with no other kind is weak, because an unrolled loop reports the step of several elements. If `unrolled` appears, check the fold by hand.
5. If a `-g` build exists, run the comparison and read every row that is not `match`. A `no-evidence` row names a member no function touched. An `unexpected` row names an access the pass could not place.
6. Type the layout into your tool's type manager as a struct, and record which fields, names, and kinds are guesses.

Keep the three oracles in reach. When the rules, `ctypes`, and DWARF disagree on a layout you wrote, you have found a packed struct, a bit-field, or a target with different rules.

## Interactive Lab

### Lab A: decode the member entry

From the `code` directory, open Python:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types/code
python3 -q
```

Run:

```python
from main import *
elf = load_object("account-x86_64-O0-g.o")
dwarf = DwarfInfo(elf)
dwarf.header()
elf.section(".debug_info").data[0x1a3:0x1ac].hex(" ")
dwarf.dies[0x1a3].attributes
dwarf.type_name(dwarf.type_of(dwarf.dies[0x1a3]))
```

Decode the nine bytes on paper with abbreviation 13 before you look at the dictionary. Then read the raw section without relocations, `elf.section(".debug_str_offsets").data[8:16].hex()`, and the relocated one, `elf.relocated(".debug_str_offsets")[8:16].hex()`, and explain the difference.

### Lab B: trace one function

```python
listing = load_listing("account-x86_64-O0-g.objdump.txt")
trace = trace_function("label_length", listing["label_length"])
[(hex(a.address), a.root, a.offset, a.width, a.kind) for a in trace.accesses]
trace.pointer_uses
trace_function("sum_balances", listing["sum_balances"]).loops
```

Write down, before running, which access proves that offset 24 is a pointer. Then run the same lines on the `-O1` listing and find the `leaq 0x1(%rcx), %rcx` in `trace.increments`.

### Lab C: fold the vectorised loop

```python
o2 = load_listing("account-x86_64-O2-g.objdump.txt")
trace = trace_function("sum_balances", o2["sum_balances"])
sorted({a.offset for a in trace.accesses})
folded, evidence = fold_unrolled(trace, trace.accesses)
sorted({a.offset for a in folded}), [(e.kind, e.value, e.text) for e in evidence]
```

Then run `analyze_build("O2", fold=False)["comparison"]` and count the `unexpected` rows. Change the fold rule so it requires the loop step to be exactly `k * d` with `k` at least 2, and confirm that the `-O1` loop, with one access and step 32, is left alone.

### Lab D: the vtable and the names

```python
shapes = load_object("shapes-x86_64-O0-g.o")
read_vtable(shapes, "_ZTV4Rect")
read_typeinfo(shapes, "_ZTI4Rect")
demangle("_ZNK4Rect4areaEv"), demangle("_Z8describeRK5Shapei")
find_virtual_calls(load_listing("shapes-x86_64-O0-g.objdump.txt"), [read_vtable(shapes, "_ZTV5Shape"), read_vtable(shapes, "_ZTV4Rect")])
```

Compute the slot from `callq *0x10(%rax)` on paper, then confirm it against `DwarfInfo(shapes).struct("Rect").virtual_methods`. Then load `shapes-x86_64-O1-g.o` and try `read_vtable` on it. Read the `ElfError` and explain why the symbol is absent.

## Practice Lab

Recover the stack struct in `main` at `-O1`.

Requirements:

- Extend `trace_function()` so that a frame slot region can be a root. Seed it from the `movaps` stores that fill `0x0(%rsp)` to `0x5f(%rsp)` from `.data.rel.ro`, which is the 96-byte initializer of `rows`.
- Attribute the inlined accesses `0x24(%rsp)`, `0x40(%rsp)`, `0x48(%rsp)`, `0x30(%rsp)`, and `0x38(%rsp)` to that root and report their offsets modulo a candidate stride.
- Derive the stride 32 from the loop at `0x120` to `0x12c`, where `%r14` starts at 4 and advances by `0x20` until `0x64`, and show that the loop bound `0x64` is three elements plus the field offset.
- Compare the result with the DWARF layout and reach five matches, and record which kinds stay unproven.
- Add a test that fails when the frame root is attributed to a parameter.

Success means `python3 code/main.py infer` on the `-O1` listing lists `main` as a witness with a frame root, and the comparison shows five matches from `main` alone.

## Lesson Artifact

This lesson includes `outputs/skill-recovering-data-and-types.md`. Use it to turn a listing and an optional debug build into a struct layout with evidence per field, a stride with its sources, a comparison against DWARF, and a list of what stayed unknown. It requires the access table, the stride evidence, the fold check, the DWARF oracle when one exists, and a statement of names and qualifiers that no instruction can supply.

## Verify It

Run the demo and the deterministic suite:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

Verification should prove:

- the unit header, the 14 abbreviations, and the five member offsets agree with `llvm-dwarfdump`
- names arrive through the relocated `.debug_str_offsets` table and the unit's `str_offsets_base` and `addr_base` are 8
- six functions carry the ranges, `DW_OP_reg6 RBP`, and `DW_OP_fbreg` locations the dump shows, and their low addresses equal the listing's function starts
- an object without `.debug_info` raises, and the LEB128 decoders handle `0x78` as -8
- `pyelftools` and `lldb` print the same layout as the reader
- the psABI rules, `ctypes`, DWARF, and the native run give offsets `0, 4, 8, 16, 24` and size 32, and the reordered struct is 24 bytes
- the listing parser reads 13 instructions in `bump`, attaches `R_X86_64_PLT32 bump-0x4` to the call at `0x194`, and finds the backward jump at `0x72`
- memory operands, widths, kinds, and signs decode from the AT&T text and the mnemonic
- `bump` at `-O0` reads its pointer back from the frame slot and makes three accesses at offset 4
- the stride comes from `shlq $0x5` at `-O0`, from `addq $0x20, %rdx` at `-O1`, and from eight loads folded by a step of 256 at `-O2`
- `label_length` proves the pointer at offset 24 by dereferencing it
- `main` passes one frame object at offsets 0, `0x20`, and `0x40` at `-O0` and calls nothing but `printf` at `-O1`
- every build matches five of five members with size 32 and gaps equal to the DWARF padding
- without folding the `-O2` build reports seven fields past byte 32 and no size
- the demangler reproduces all 19 `llvm-cxxfilt` strings
- both vtables, both typeinfo records, and the virtual call at `0x16` resolve to slot 2, and DWARF agrees
- the `-O1` C++ object keeps the call pattern and has no vtable
- the Ghidra, rizin, and radare2 captures show the struct with DWARF and the raw offsets without it
- the interactive figure embeds the same data the analysis produces

## Production Failure Modes

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Unrolled loop | Eight fields 32 bytes apart and a 232-byte struct | Loop step 256 equals 8 times the offset delta 32, so one field at offset 4 |
| Stride read from one increment | `sizeof` 256 from `addq $0x100` | The greatest common divisor of every stride source, with the scalar tail's `addq $0x20` |
| 8-byte field called a pointer | `void *` at offset 24 | A later access uses the loaded value as a base, or the kind stays `int64` |
| Pointer called an integer | `long` at offset 24 | The dereference at `0xfb`, recorded as pointer proof |
| Narrow compare | `char` with a sign | `cmpb` carries no sign; only `movsbl` or `movzbl` does |
| Five functions assumed to share a type | One struct with no evidence of aliasing | Call sites in `main` that pass one frame object, or an explicit analyst assertion |
| Strings read from `.debug_str` by index | Garbage names from a relocatable object | `str_offsets_base` plus the relocated `.debug_str_offsets` entry |
| Addresses read as numbers | `low_pc` of 0 for every function | `addrx` through the relocated `.debug_addr` table |
| DWARF 4 object | A reader that misparses the header | Version check on the second header field; 4 has no `unit_type` byte |
| Missing vtable | "the class has no virtual functions" | The `-O1` object inlined every call; the `-O0` object has the table and its relocations |
| Vtable slot read from the wrong base | Off-by-two slot numbers | The address point is 16 bytes past the symbol, after offset-to-top and typeinfo |
| Mangled name stripped | `Z8describeRK5Shapei` left as is | `--no-strip-underscore` on macOS, or a demangler that checks for `_Z` |
| Struct typed from one tool's guess | `char *param_1` taken as the field type | The width and the dereference, written as evidence, and the name marked as a guess |

## Operational Rule

Recover a field from an access and a stride from a loop, and attach the instruction to each. Fold unrolled loops before you trust an offset past the stride. Read DWARF through its abbreviations and its relocated tables, never by index into a string section. Compare field by field and write every member without evidence, every unproven pointer, and every name as unknown. In a C++ object, read the vtable from its relocations and the slot from the call, then use DWARF to confirm the slot you read.

## Further Reading

- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, section 3.1.2: Data Representation](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64), section 5.10: Composite Types](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [Writing ARM64 code for Apple platforms](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms)
- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 1, section 3.7.5: Specifying an Offset](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [DWARF Debugging Information Format Version 5, sections 2.1, 5.7.6, 7.5.1.1, 7.5.3, 7.5.6](https://dwarfstd.org/doc/DWARF5.pdf)
- [Itanium C++ ABI, sections 2.5 (Virtual Table Layout), 2.9 (Run-Time Type Information), 5.1 (External Names)](https://itanium-cxx-abi.github.io/cxx-abi/abi.html)
- [Microsoft Learn: Decorated names](https://learn.microsoft.com/en-us/cpp/build/reference/decorated-names?view=msvc-170) and [Name Decoration](https://learn.microsoft.com/en-us/cpp/error-messages/tool-errors/name-decoration?view=msvc-170)
- [llvm-dwarfdump command guide](https://llvm.org/docs/CommandGuide/llvm-dwarfdump.html) and [llvm-cxxfilt command guide](https://llvm.org/docs/CommandGuide/llvm-cxxfilt.html)
- [Python ctypes: Structure layout, sizeof, alignment](https://docs.python.org/3/library/ctypes.html)
- [Ghidra Data Type Manager](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Base/src/main/help/help/topics/DataTypeManagerPlugin/data_type_manager_description.htm), [Decompiler Concepts](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/main/help/help/topics/DecompilePlugin/DecompilerConcepts.html), [Decompiler Options](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/main/help/help/topics/DecompilePlugin/DecompilerOptions.html), and [Ghidra 12.1.4 release](https://github.com/NationalSecurityAgency/ghidra/releases/tag/Ghidra_12.1.4_build)
- [IDA 9.1 user guide: Types](https://docs.hex-rays.com/9.1/user-guide/types), [IDA 9.4 release post](https://hex-rays.com/blog/ida-9.4-release-a-new-dyld-shared-cache-swift-analysis-new-teams-add-on-and-more-), and [IDA Free](https://hex-rays.com/ida-free)
- [Binary Ninja user guide: Types](https://docs.binary.ninja/guide/types/) and [Binary Ninja 6.0 Krypton](https://binary.ninja/2026/09/03/binary-ninja-6.0-krypton.html)
- [radare2 6.2.4 release](https://github.com/radareorg/radare2/releases/tag/6.2.4) and [rizin v0.9.1 release](https://github.com/rizinorg/rizin/releases/tag/v0.9.1)
- [GDB manual: Examining the Symbol Table, ptype /o](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Symbols.html)
- [pyelftools on PyPI](https://pypi.org/project/pyelftools/)
- [Lee, Avgerinos, Brumley, "TIE: Principled Reverse Engineering of Types in Binary Programs" (NDSS 2011)](https://www.ndss-symposium.org/ndss2011/tie-principled-reverse-engineering-of-types-in-binary-programs/)
- [Noonan, Loginov, Cok, "Polymorphic Type Inference for Machine Code" (PLDI 2016)](https://arxiv.org/abs/1603.05495) and [the retypd repository](https://github.com/GrammaTech/retypd)
- [Zhang et al., "OSPREY: Recovery of Variable and Data Structure via Probabilistic Analysis for Stripped Binary" (IEEE S&P 2021)](https://ieeexplore.ieee.org/document/9519451/)
- [Chen et al., "Augmenting Decompiler Output with Learned Variable Names and Types" (USENIX Security 2022)](https://www.usenix.org/conference/usenixsecurity22/presentation/chen-qibin)
- [Xie et al., "ReSym: Harnessing LLMs to Recover Variable and Data Structure Symbols from Stripped Binaries" (CCS 2024)](https://dl.acm.org/doi/10.1145/3658644.3670340)
- [Chen et al., "RecStruct" (USENIX Security 2026)](https://www.usenix.org/conference/usenixsecurity26/presentation/chen-yuxin)
