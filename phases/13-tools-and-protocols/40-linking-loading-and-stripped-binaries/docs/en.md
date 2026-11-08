# Linking, Loading, and Stripped Binaries: PLT, GOT, Imports, Fixups, and Function Identification

> A linked program calls functions it does not contain. This lesson reads the tables the link editor wrote for those calls in three formats, follows one call to the slot the loader fills, and finds the functions of a build after its names are gone.

**Type:** Build
**Languages:** Python, C, x86-64 and arm64 assembly
**Prerequisites:** Phase 13 · 32 (ELF from scratch), 33 (disassembly and control flow), 38 (calling conventions)
**Time:** ~160 minutes

## Learning Objectives

- Decide from a relocation record and the symbol tables what the link editor makes of it: a fixed distance, a PLT entry with a GOT slot, or a dynamic relocation.
- Read the dynamic section, the PLT, and the GOT of a position-independent ELF executable and follow one call through them with the psABI formulas.
- Read a COFF object (20-byte file header, 40-byte section entries, 18-byte symbols, 10-byte relocations) and the import, export, and base relocation directories of a PE32+ image.
- Decode a Mach-O chained fixup chain word by word and match every word against `dyld_info`.
- State what `strip` removes and what survives in each format, and run the stripped program to prove that it still works.
- Recover the function starts of a stripped arm64 build with `LC_FUNCTION_STARTS`, prologue scans, and call targets, score each method against the symbol table of the unstripped twin, and name the functions with a FLIRT-shaped signature.

## The Problem

You linked `main.c` against `libledger.dylib` and asked an agent which function `main` calls at `0x1000005a0`. The agent disassembled the instruction and read `bl 0x100000694`. That address holds twelve bytes: `adrp x16`, `ldr x16, [x16, #0x38]`, `br x16`. The agent followed the load to `0x100004038`, read the eight bytes `00 00 00 00 00 00 10 80`, and reported a call through a corrupt pointer into kernel space.

Then you stripped the static build of the same program and asked how many functions it has. The agent ran `nm`, saw one name, `__mh_execute_header`, and answered one.

Both answers read the file as if it were the running process. The word at `0x100004038` is a chained fixup. Bit 63 says bind, twelve bits say where the next fixup is, and the low bits say which import to bind. dyld replaces the word with the address of `_puts` before `main` runs. The stripped file lost its symbol table and kept `LC_FUNCTION_STARTS`, which lists all five function starts in nine bytes.

This lesson builds five readers in standard-library Python. A COFF reader for our own objects and a PE32+ reader for the import, export, and base relocation directories. A Mach-O reader for load commands, stubs, the indirect symbol table, the chained fixup chain, and the exports trie, checked word for word against `dyld_info`. An ELF reader for the dynamic section, the PLT, and the GOT, plus a planner that says what a PIE link of our objects would create. A function finder for a stripped build with four methods and a score for each. A signature builder in the shape of FLIRT, with wildcarded relocation bytes and a CRC16 of the tail.

Only Mach-O links on this machine. The arm64 executables and the dylib were linked, stripped, and run. The ELF and COFF objects compiled here with `clang -target`, and no ELF or PE link editor is installed, so the two linked images in those formats were written byte by byte from the specifications by two Python scripts in the fixtures folder. `llvm-objdump` reads them, and so does the library probe. They were not run, and the text says so where it matters.

```figure
re-40-call-through-three-formats
```

## What the Link Editor Does With a Relocation

Lesson 32 read relocation records and lesson 33 applied `S + A - P` to a `lea`. A record names a place `P`, a type, a symbol `S`, and an addend `A`. The x86-64 psABI Table 4.9 gives one formula per type, with `L` for the place of the symbol's PLT entry, `G` for its GOT offset, `GOT` for the GOT address, and `B` for the load base of the image. Three outcomes cover our objects.

The link editor writes the value into the field and the record is gone. `R_X86_64_PC32` against a symbol defined in the inputs is this case. The distance between two bytes of one image never changes, whatever the load address.

The link editor makes a PLT entry and a GOT slot. `R_X86_64_PLT32` against an undefined function is this case. The call gets `L + A - P`, the distance to the entry. The entry jumps through the slot. A `R_X86_64_JUMP_SLOT` record in `.rela.plt` tells the dynamic linker to fill the slot.

The link editor keeps a relocation for the loader. `R_X86_64_64` is an eight-byte absolute address, and a position-independent executable does not know its address until it loads. The record becomes `R_X86_64_RELATIVE` with formula `B + A` in `.rela.dyn`.

`main-x86_64-O1.o` has 18 records: 14 in `.text`, 2 in `.data.rel.ro`, and 2 in `.rodata`. `plan_dynamic_link()` in `code/main.py` applies the three rules to them together with `ledger-x86_64-O1.o`:

| Record | Count | Decision | Why |
|---|---|---|---|
| `R_X86_64_PC32` to `.rodata`, `.L.str`, `fns`, the table in `.rodata` | 16 | in place | the symbol is defined in the inputs |
| `R_X86_64_PLT32` to `percent_change`, `grade`, `total`, `grade_label` | 4 | direct, no PLT | defined in `ledger-x86_64-O1.o`, so the link editor reduces PLT32 to PC32 |
| `R_X86_64_PLT32` to `puts` twice and `printf` twice | 4 | PLT entry and GOT slot | undefined, provided by a shared library |
| `R_X86_64_64` to `grade` in `fns[]` | 2 | `R_X86_64_RELATIVE` | an absolute field in a PIE |

Two imports give a `.plt` of 48 bytes (PLT0 plus two entries of 16), a `.got.plt` of 40 bytes (three reserved slots plus two), and a `.rela.plt` of 48 bytes. The two relative records give a `.rela.dyn` of 48 bytes. These numbers come from the spec applied to our records. The hand-built `tiny-dyn-x86_64` implements the PLT part of this plan for the same two imports, and its sizes match the plan.

The compiler writes `PLT32` on every call, defined or undefined, since binutils 2.31 (H.J. Lu, 2018-02-13) and LLVM 7.0.0 (D43383, 2018-02-20). The link editor decides. A `PLT32` in an object therefore says "a call", and says nothing about whether a PLT entry will exist. Two more types appear in other builds. `R_X86_64_GOTPCRELX` and `R_X86_64_REX_GOTPCRELX` (`G + GOT + A - P`) ask for a GOT slot without a PLT, which `-fno-plt` produces and which the link editor may relax to a direct `lea` or `call` when the symbol is local (psABI Appendix B). `R_X86_64_32` and `R_X86_64_32S` cannot hold an address in a PIE and the link fails. Neither kind occurs in our two objects.

## The Dynamic Section, the PLT, and the GOT

The gABI chapter 5 says that an executable that takes part in dynamic linking has one `PT_INTERP` program header, which must precede any loadable segment, and one `PT_DYNAMIC`, which covers the `.dynamic` section. The section is an array of `Elf64_Dyn` pairs, a signed tag and a value, ended by `DT_NULL`.

`tiny-dyn-x86_64` is 5,184 bytes written by `build_tiny_dyn_elf.py` from the gABI and the psABI. Its dynamic section holds twelve pairs at `0x1000`:

| Tag | Number | Value | Meaning |
|---|---|---|---|
| `DT_NEEDED` | 1 | `libc.so.6` | a string table offset, `0xb`, the library to load |
| `DT_HASH` | 4 | `0x1a0` | the SysV hash table |
| `DT_STRTAB` | 5 | `0x188` | `.dynstr` |
| `DT_SYMTAB` | 6 | `0x140` | `.dynsym`, 24 bytes per entry |
| `DT_STRSZ` | 10 | `0x15` | 21 bytes of strings |
| `DT_SYMENT` | 11 | `0x18` | 24 |
| `DT_PLTGOT` | 3 | `0x10c0` | `.got.plt` |
| `DT_PLTRELSZ` | 2 | `0x30` | two 24-byte records |
| `DT_PLTREL` | 20 | 7 | the records are `DT_RELA` |
| `DT_JMPREL` | 23 | `0x1b8` | `.rela.plt` |
| `DT_FLAGS_1` | `0x6ffffffb` | `0x08000000` | `DF_1_PIE`, a GNU tag |
| `DT_NULL` | 0 | 0 | end |

The gABI says why `DT_JMPREL` is separate: it "holds the address of relocation entries associated solely with the procedure linkage table. Separating these relocation entries lets the dynamic linker ignore them during process initialization, if lazy binding is enabled." `DF_BIND_NOW` in `DT_FLAGS`, `DF_1_NOW` in `DT_FLAGS_1`, or `LD_BIND_NOW` in the environment turn lazy binding off and the dynamic linker processes them at startup.

### PLT0 and the entry for puts

psABI section 5.2 gives the two shapes in Figure 5.2. Here are the bytes of our file:

```text
     1f0: ff 35 d2 0e 00 00    pushq  0xed2(%rip)      # 0x10c8 = GOT+8
     1f6: ff 25 d4 0e 00 00    jmpq   *0xed4(%rip)     # 0x10d0 = GOT+16
     1fc: 0f 1f 40 00          nopl   (%rax)

     200: ff 25 d2 0e 00 00    jmpq   *0xed2(%rip)     # 0x10d8 = GOT+24, the slot for puts
     206: 68 00 00 00 00       pushq  $0x0             # index 0 into DT_JMPREL
     20b: e9 e0 ff ff ff       jmp    0x1f0            # PLT0
```

Do the arithmetic once. The RIP-relative displacement is relative to the next instruction. `0x1f6 + 0xed2 = 0x10c8`, which is `.got.plt + 8`. `0x1fc + 0xed4 = 0x10d0`, which is `.got.plt + 16`. `0x206 + 0xed2 = 0x10d8`, the fourth slot. `0x210 - 0x20 = 0x1f0`, PLT0. Every entry is 16 bytes, so the entry for `exit` starts at `0x210`, pushes `$0x1`, and reads `0x10e0`.

The GOT reserves three slots. psABI 5.2: entry zero holds the address of `_DYNAMIC`, and "entries one and two in the global offset table also are reserved". Our `.got.plt` reads `0x1000, 0, 0, 0x206, 0x216`. glibc fills slot one with its `struct link_map` and slot two with `_dl_runtime_resolve` when it loads the file. Slot three holds `0x206` in the file, which is the `pushq` inside `puts@plt`. psABI: the slot "initially ... holds the address of the following pushq instruction".

So the first call runs `call 0x200`, `jmpq *0x10d8` lands on `pushq $0`, `jmp 0x1f0` pushes GOT+8 and jumps through GOT+16 into the resolver, which reads record 0 of `DT_JMPREL`, `R_X86_64_JUMP_SLOT puts`, looks `puts` up in `libc.so.6`, writes its address into `0x10d8`, and jumps there. The second call runs `call`, `jmpq *0x10d8`, and arrives. Drepper writes that "the overhead for all but the first call is therefore 'only' one indirect jump". The psABI footnote on `%r11` explains one register choice in lesson 38: it is a scratch register so "code in the PLT need not spill any registers".

The call site in `.text` reads `e8 d4 ff ff ff` at `0x227`, and `0x22c - 0x2c = 0x200`. `llvm-objdump` prints `callq 0x200 <puts@plt>` for it and names the entry from the `.rela.plt` record, which is how `plt_entries()` names it too.

### What the file does not have

The file has no `PT_GNU_RELRO`. Jakub Jelinek proposed RELRO on the binutils list on 2004-01-06: move the sections written only during relocation to the start of the writable segment, so the dynamic linker can `mprotect` them read-only afterwards. GNU ld's default script puts `.init_array`, `.fini_array`, `.data.rel.ro`, `.dynamic`, and `.got` inside, and keeps only the three reserved slots of `.got.plt` inside, 24 bytes, because the other slots are written lazily. That is partial RELRO. `-z now` sets `DF_BIND_NOW` and moves the whole `.got.plt` inside, full RELRO, because nothing is written after startup. glibc's `_dl_protect_relro` calls `mprotect(start, end - start, PROT_READ)` on the page-aligned range. `-fno-plt` goes one step further on the compiler side: calls go through `jmpq *name@GOTPCREL(%rip)`, lazy binding is impossible, and GCC's manual says that "all external symbols are resolved at load time".

The file has no version sections either. A real link against `libc.so.6` adds `.gnu.version`, one `Elfxx_Half` per `.dynsym` entry, and `.gnu.version_r`, a `Verneed` for each library with `Vernaux` records for each version name. `printf@GLIBC_2.2.5` means: the entry of `printf` in `.gnu.version` holds an index, the `Vernaux` whose `vna_other` equals that index has `vna_name` "GLIBC_2.2.5", under the `Verneed` whose `vn_file` is "libc.so.6". Index 0 is local, 1 is global, and bit 15 (`VERSYM_HIDDEN`, `0x8000`) hides a version from the link editor.

The hash table is a SysV `DT_HASH` with one bucket and a three-entry chain, 24 bytes. The dynamic linker needs `DT_HASH` or `DT_GNU_HASH` to look symbols up in the file. This file exports nothing, and it was not run here, so whether glibc accepts a one-bucket table is unverified.

### .dynsym, .symtab, and strip

The gABI makes `.dynsym` and `.dynstr` allocated sections and `.symtab` and `.strtab` unallocated ones. The dynamic linker reads the first pair and never the second. Drepper: "The normal symbol table is not used at run-time and it is therefore not necessary to strip a binary of it. It has no impact on performance."

GNU `strip --strip-all` removes `.symtab`, `.strtab`, `.debug_*`, and `.comment`. Every allocated section stays: `.interp`, `.dynsym`, `.dynstr`, `.gnu.hash`, `.gnu.version*`, `.rela.dyn`, `.rela.plt`, `.plt`, `.text`, `.rodata`, `.eh_frame`, `.init_array`, `.dynamic`, `.got`, `.got.plt`, `.data`, `.bss`, and the notes. Section headers stay unless you add `--strip-section-headers` (binutils 2.41) or run `llvm-strip --strip-sections`. `--strip-debug` keeps the symbols. `--only-keep-debug` writes the debug file that `--add-gnu-debuglink` names from the stripped one, with a CRC32 in `.gnu_debuglink`, and `ld --build-id` writes `.note.gnu.build-id` so a debugger can match the two.

## The COFF Object

`clang -target x86_64-pc-windows-msvc -O1 -fno-asynchronous-unwind-tables -c` produced `main-x86_64.obj` and `ledger-x86_64.obj`. The PE Format page defines the object: a 20-byte file header, no optional header, a section table of 40-byte entries, a symbol table of 18-byte records, and 10-byte relocation records per section.

`CoffObject` in `code/main.py` reads all four. The file header says machine `0x8664`, 10 sections, 37 symbol records, `SizeOfOptionalHeader` 0. The section table names `.text`, `.data`, `.bss`, six sections called `.rdata`, and `/16`. A name that starts with `/` is a decimal offset into the string table, which begins with its own four-byte size; `/16` resolves to `.llvm_addrsig`, which is the name `llvm-objdump -h` prints.

The 37 records include auxiliary records. A section symbol (storage class 3) carries one that holds the section length, the relocation count, a checksum, and a COMDAT selection. Five of the `.rdata` sections have selection 2, "any", and hold one string literal each under an MSVC-mangled name: `??_C@_04JDDJEAHN@even?$AA@` is the string "even". The link editor keeps one copy of each. The last record is `.file` with the auxiliary record "main.c". `llvm-objdump -t` prints these as `[ 0]`, `AUX scnlen ...`, `[ 2]`, and so on, skipping the auxiliary indexes, and the test compares our index and name pairs with that text.

The relocations: 14 `IMAGE_REL_AMD64_REL32` in `.text` and 4 `IMAGE_REL_AMD64_ADDR64` in `.rdata`. `REL32` is "the 32-bit relative address from the byte following the relocation". That is `R_X86_64_PC32` with the `-4` built in: the ELF record carries addend `-4` because the record has an addend field, and the COFF record has none. `ledger-x86_64.obj` has three `REL32` at `0x36`, `0x84`, and `0x93`, and lesson 32's `ledger-x86_64-O1.o` has its three `R_X86_64_PC32` at the same three offsets. The code is the same, and the formats differ only in where the four is written. `ADDR64` is an eight-byte absolute address, the `labels` table of string pointers, and it becomes a base relocation in the image, as `R_X86_64_64` becomes `R_X86_64_RELATIVE`.

| | ELF `Elf64_Rela` | COFF relocation | Mach-O `relocation_info` |
|---|---|---|---|
| record size | 24 bytes | 10 bytes | 8 bytes |
| fields | offset, type and symbol in `r_info`, addend | offset, symbol index, type | address, then a 32-bit word with symbolnum:24, pcrel:1, length:2, extern:1, type:4 |
| addend | explicit | none, lives in the field | none, or an `ARM64_RELOC_ADDEND` record before the real one |
| the call to `puts` | `R_X86_64_PLT32 puts-0x4` | `IMAGE_REL_AMD64_REL32 puts` | `ARM64_RELOC_BRANCH26 _puts` |

## The PE Image: Imports, Exports, and Base Relocations

`tiny-x86_64.exe` is 2,560 bytes written by `build_tiny_pe.py`. It has the same job as the tiny ELF: call `puts` and `exit` from `msvcrt.dll`. It also exports one name and carries one base relocation, so the three directories this lesson needs are all present. `pefile` 2024.8.26 and `llvm-objdump -p` both read it, and both captures are fixtures.

Walk the headers. The MS-DOS stub starts with `MZ` and at offset `0x3c` holds `e_lfanew`, `0x40`. At `0x40` the signature `PE\0\0`. Then the COFF file header: machine `0x8664`, 4 sections, `SizeOfOptionalHeader` 240, characteristics `0x22` (executable image, large address aware). The optional header starts with the `Magic` field, `0x20b`, which means PE32+. `AddressOfEntryPoint` is `0x1000`, `ImageBase` is `0x140000000`, `SectionAlignment` `0x1000`, `FileAlignment` `0x200`, `SizeOfImage` `0x5000`, `Subsystem` 3 (console). `DllCharacteristics` `0x8160` decodes to `HIGH_ENTROPY_VA 0x0020`, `DYNAMIC_BASE 0x0040`, `NX_COMPAT 0x0100`, and `TERMINAL_SERVER_AWARE 0x8000`. Then 16 data directories of RVA and size. Four are set: Export at `0x2080` size `0x4d`, Import at `0x2000` size `0x28`, Base Relocation at `0x4000` size `0xc`, IAT at `0x2040` size `0x18`.

Addresses in an image are RVAs, offsets from the load base. The section table maps them to file offsets: `.text` RVA `0x1000` at file `0x200`, `.rdata` RVA `0x2000` at `0x400`, `.data` RVA `0x3000` at `0x600`, `.reloc` RVA `0x4000` at `0x800`. `PeImage.rva_to_offset()` is that table.

### The import directory

At RVA `0x2000` sits an array of 20-byte import descriptors ended by a zero descriptor. Ours has one: Import Lookup Table `0x2028`, timestamp 0, forwarder chain 0, name `0x2068`, Import Address Table `0x2040`. The name RVA points at "msvcrt.dll". The lookup table holds 64-bit entries ended by zero. Bit 63 set means import by ordinal, with the ordinal in bits 15 to 0. Bit 63 clear means bits 30 to 0 are the RVA of a hint/name entry: a 16-bit hint, "an index into the export name pointer table", then the ASCII name. Ours are `0x2058` (hint 0, "puts") and `0x2060` (hint 0, "exit").

The spec says the IAT is "identical to the contents of the import lookup table until the image is bound". Our IAT at `0x2040` holds the same two RVAs, and the test checks that the 24 bytes at `0x2028` equal the 24 bytes at `0x2040`. "During binding, the entries in the import address table are overwritten with the 32-bit (for PE32) or 64-bit (for PE32+) addresses of the symbols that are being imported." The Windows loader does that before the entry point runs. There is no lazy binding and no stub. The code reaches the slot directly:

```text
    100b: ff 15 2f 10 00 00    call qword ptr [rip + 0x102f]   # 0x1011 + 0x102f = 0x2040, the IAT slot of puts
    1013: ff 15 2f 10 00 00    call qword ptr [rip + 0x102f]   # 0x1019 + 0x102f = 0x2048, the IAT slot of exit
```

`FF /2` is the indirect near call. The two instructions have the same bytes because each one sits eight bytes after the other and reads a slot eight bytes after the other. `iat_calls()` scans the code section for `ff 15`, adds six and the displacement, and names the slot from the import directory.

### The export directory

At RVA `0x2080` the 40-byte export directory table: flags, timestamp, version, a name RVA pointing at "tiny-x86_64.exe", ordinal base 1, 1 address table entry, 1 name pointer. Three tables follow. The Export Address Table at `0x20a8` holds one RVA, `0x1000`. The Export Name Pointer Table at `0x20ac` holds one RVA to the string "tiny_entry". The Export Ordinal Table at `0x20b0` holds one 16-bit unbiased index, 0. Name `k` maps to address entry `ordinals[k]`, and the exported ordinal is `ordinals[k] + ordinal base`. The spec adds a rule we do not use: an address entry that points inside the export section is a forwarder string such as `MYDLL.expfunc`, and the name pointer table is "ordered lexically to allow binary searches".

### Base relocations

`.reloc` holds blocks. Each block starts with a page RVA and a block size, then 16-bit entries with the type in the top four bits and a page offset in the low twelve. Our one block: page `0x3000`, size 12, entry `0xa000`, type 10, `IMAGE_REL_BASED_DIR64`, offset 0, and a padding entry of type 0, `IMAGE_REL_BASED_ABSOLUTE`. The eight bytes at RVA `0x3000` hold `0x1400020d0`, the image base plus the RVA of the string "linked by hand". If the loader places the image anywhere else, it adds the difference to that field. The spec: "Image files do not contain COFF relocations ... An image contains relocation information in the form of base relocations in the .reloc section (unless the image has the IMAGE_FILE_RELOCS_STRIPPED attribute)." `/DYNAMICBASE` is on by default in current link.exe, so images carry `.reloc` and `DYNAMIC_BASE`.

A PE image has no symbol table to strip. The file header's `PointerToSymbolTable` "should be zero for an image because COFF debugging information is deprecated", and the names live in a separate PDB. What survives in every image is the import directory, the export directory, and, for 64-bit code, `.pdata`, whose `RUNTIME_FUNCTION` entries name the start and end of every function that allocates stack or calls another function. Leaf functions are absent from it.

## The Mach-O Image: Load Commands, Stubs, and the Indirect Symbol Table

`ledger_main` is the linked arm64 executable. `otool -h` prints 19 load commands and flags `0x00200085`. `MH_NOUNDEFS 0x1`, `MH_DYLDLINK 0x4`, `MH_TWOLEVEL 0x80`, and `MH_PIE 0x200000` sum to that value. The 19 commands are four `LC_SEGMENT_64` (`__PAGEZERO`, `__TEXT`, `__DATA_CONST`, `__LINKEDIT`), two `LC_LOAD_DYLIB` (`@rpath/libledger.dylib` then `/usr/lib/libSystem.B.dylib`), and one each of `LC_DYLD_CHAINED_FIXUPS`, `LC_DYLD_EXPORTS_TRIE`, `LC_SYMTAB`, `LC_DYSYMTAB`, `LC_LOAD_DYLINKER`, `LC_UUID`, `LC_BUILD_VERSION`, `LC_SOURCE_VERSION`, `LC_MAIN`, `LC_RPATH`, `LC_FUNCTION_STARTS`, `LC_DATA_IN_CODE`, and `LC_CODE_SIGNATURE`. `MachoFile.command_names()` returns the same list in the same order as `otool -l`.

`__TEXT` starts at `0x100000000`. `__text` is 256 bytes at `0x100000558`, `main` and nothing else, because the four ledger functions live in the dylib. `__stubs` is 84 bytes at `0x100000658`, seven stubs of twelve bytes. `__DATA_CONST` starts at `0x100004000` with `__got`, 64 bytes, eight pointer slots of section type `S_NON_LAZY_SYMBOL_POINTERS`, and `__const`, 32 bytes, the `fns[]` and `names[]` tables of `main.c`.

### One stub, by hand

The stub for `_puts` is at `0x100000694`:

```text
    30 00 00 90    adrp x16, 0x100004000
    10 1e 40 f9    ldr  x16, [x16, #0x38]
    00 02 1f d6    br   x16
```

`0x90000030` is `adrp`. The register is the low five bits, 16. `immlo` is bits 30 to 29, 0. `immhi` is bits 23 to 5, 1. The value is `immhi << 2 | immlo = 4`, in pages of 4,096 bytes, so the target page is the page of the instruction, `0x100000000`, plus `0x4000`. `0xf9401e10` is `ldr` with an unsigned 12-bit offset scaled by 8: bits 21 to 10 are 7, times 8 is `0x38`, so the load reads `0x100004038`. `0xd61f0200` is `br x16`. The arm64 stub in ld64's source is this exact three-instruction `StubAtom`.

Which name belongs to the slot comes from the indirect symbol table. `LC_DYSYMTAB` points at 15 indexes into the symbol table. A stubs section says in `reserved1` where its run of indexes starts and in `reserved2` how large each stub is (12). A pointer section uses `reserved1` and eight bytes per slot. `__stubs` starts at index 0 and `__got` at index 7, so stub 5 maps to symbol table entry 10, `_puts`, and slot 7 of `__got` maps to the same entry. `otool -Iv` prints both runs, and `indirect_table()` reproduces every row.

### Two-level namespace

`nm -m` prints `(undefined) external _puts (from libSystem)` and `(undefined) external _grade (from libledger)`. The library comes from the symbol record itself. `nlist.h` defines `GET_LIBRARY_ORDINAL(n_desc)` as bits 15 to 8 of `n_desc`, 1 for the first `LC_LOAD_DYLIB`, 2 for the second, `0xfe` for dynamic lookup, `0xff` for the executable. `ld(1)`: "With -two_levelnamespace (the default), the linker only searches dylibs on the command line for symbols, and records in which dylib they were found." `nm_lines()` renders the twelve records from `n_type`, `n_sect`, `n_desc`, and `n_value`, and the test compares its output line for line with the captured `nm -m`. Relink with `-Wl,-flat_namespace` and read `otool -h` to see the `MH_TWOLEVEL` bit disappear.

## Chained Fixups, Byte for Byte

`LC_DYLD_CHAINED_FIXUPS` is a `linkedit_data_command`: `dataoff 0x8000`, `datasize 208`. The 208 bytes follow `fixup-chains.h`.

The header is seven 32-bit fields: `fixups_version 0`, `starts_offset 32`, `imports_offset 80`, `symbols_offset 112`, `imports_count 8`, `imports_format 1` (`DYLD_CHAINED_IMPORT`), `symbols_format 0` (uncompressed). `llvm-objdump --macho --chained-fixups` prints these seven values and the test compares them.

At offset 32, `dyld_chained_starts_in_image`: `seg_count 4` and four offsets, one per segment, zero for segments without fixups. Only `__DATA_CONST` has one. Its `dyld_chained_starts_in_segment` reads `size 24`, `page_size 0x4000`, `pointer_format 6` (`DYLD_CHAINED_PTR_64_OFFSET`, "target is vm offset"), `segment_offset 0x4000`, `max_valid_pointer 0`, `page_count 1`, and one `page_start` of 0. `DYLD_CHAINED_PTR_START_NONE`, `0xffff`, would mean a page with no fixups.

The chain starts at file offset `0x4000 + 0`. Each 64-bit word carries two things: what to write there, and where the next word is.

```text
  dyld_chained_ptr_64_bind    ordinal:24  addend:8  reserved:19  next:12  bind:1 = 1
  dyld_chained_ptr_64_rebase  target:36   high8:8   reserved:7   next:12  bind:1 = 0
```

Read the first word, `0x8010000000000000`. Bit 63 is set, a bind. `next` is bits 62 to 51, `0x002`, in units of 4 bytes, so the next fixup is 8 bytes on. The ordinal is 0. Read the twelfth word at `0x4058`, `0x00000000000006db`. Bit 63 clear, a rebase. `next` is 0, the end of the chain. The target is `0x6db`, a vm offset, and the image base `0x100000000` makes it `0x1000006db`, the string "odd" in `__cstring`. The word before it, `0x00100000000006d6`, rebases `names[0]` to "even".

The walk visits twelve words: eight binds in `__got` with ordinals 0 to 7, two binds in `__const` with ordinal 0 (both entries of `fns[]` point at `_grade`), and the two rebases of `names[]`. `chained_fixups()` returns them with their file offsets and raw words, and the test compares the twelve `(offset, raw)` pairs with `dyld_info -fixup_chain_details`, which prints `raw: 0x8010000000000000 bind: (next: 002, bindOrdinal: 0x000000)` for the first.

The imports table at offset 80 has eight 32-bit entries: `lib_ordinal:8`, `weak_import:1`, `name_offset:23`, with names at offset 112. Ordinals 0 to 3 are `_grade`, `_grade_label`, `_percent_change`, `_total` from library 1, and 4 to 7 are `___stack_chk_fail`, `___stack_chk_guard`, `_printf`, `_puts` from library 2. `fixup_rows()` joins the two tables into the lines `dyld_info -fixups` prints, such as `__DATA_CONST __got 0x100004038 bind libSystem/_puts`, and the test compares all twelve.

So the "corrupt pointer" at `0x100004038` is import 7. dyld walks this chain once, at load, and writes the address of `_puts` into the slot. Apple's WWDC22 session put it this way: "in the 64-bit pointer location in DATA, some of the bits contain the offset to the next fixup location. Also packed in there is a bit that says if the fixup is a bind or a rebase." Xcode 13 made the format the default for a deployment target of macOS 12 or iOS 15, and Xcode 13.3 extended it to macOS 11 and iOS 13.4. There is no lazy binding in this format. Every slot is bound before `main` runs.

### The layout it replaced

`ledger_main_nochain` is the same link with `-Wl,-no_fixup_chains`. It has `LC_DYLD_INFO_ONLY` instead, with four byte-coded tables: rebase 8 bytes, bind 72, lazy bind 120, export 64. It also has three sections the chained file lacks: `__TEXT,__stub_helper` (108 bytes), a `__got` of only 16 bytes holding `___stack_chk_guard` and `dyld_stub_binder`, and `__DATA,__la_symbol_ptr` (56 bytes, seven slots). `dyld_info -fixups` lists seven `lazy-bind` rows and seven rebases that point each lazy slot at its own trampoline in `__stub_helper`. The trampoline pushes an index and jumps to `dyld_stub_binder`, which resolves the name and writes the slot. That is the PLT and GOT of the previous section in Mach-O shapes: `__la_symbol_ptr` is `.got.plt`, `__stub_helper` is PLT0 and the `pushq $index`, and `dyld_stub_binder` is `_dl_runtime_resolve`. `code/main.py` reports the offsets and sections of this file and does not decode the bind opcodes; the practice lab asks for that.

### The exports trie

`LC_DYLD_EXPORTS_TRIE` is a prefix tree. Each node is a uleb128 terminal size, then, if it is nonzero, uleb128 flags and a uleb128 offset, then one byte of child count and, for each child, a string edge and a uleb128 node offset. `exports_trie()` walks it. On `libledger.dylib` it returns `_percent_change 0x410`, `_grade 0x428`, `_total 0x464`, `_grade_label 0x498`, the four offsets `dyld_info -exports` prints. On the executable it returns `__mh_execute_header`, `_fns`, and `_main`.

## What strip Leaves

Apple's `strip(1)` says that with no options on a dynamically linked executable it behaves like `-u -r`: save undefined symbols and symbols referenced dynamically. `-x` removes local symbols. `-N` removes the whole symbol table and string table. "For dynamic shared libraries, the maximum level of stripping is usually -x", because "Only global symbols are used by the dynamic linking process".

Observed on our fixtures. `strip ledger_main` took `LC_SYMTAB` from 12 to 10 records and removed `_main`, `_fns`, and `_names`. The eight undefined imports stay, because dyld needs their names to bind, and `__mh_execute_header` stays because it is `REFERENCED_DYNAMICALLY`. The tenth record is a stab of type `N_OPT` named `radr://5614542`, which Apple's tools write so the table is never empty; `nm` does not print it. The stripped program prints the same three lines as the original and exits 0. `LC_FUNCTION_STARTS` still has one start, `main`.

`strip libledger.dylib` with no options went further than the man page's usual `-x`: `LC_SYMTAB` has 0 records and `nm` prints "no symbols". The exports trie still lists the four functions at the same offsets, because dyld binds through the trie and never through `LC_SYMTAB`. `LC_FUNCTION_STARTS` still lists four starts. Lab C links a fresh `main.c` against the stripped dylib to show that the link editor is also served by the trie.

| What | ELF after `--strip-all` | PE image | Mach-O after `strip` |
|---|---|---|---|
| static symbol table | gone | never present in an image | local and defined names gone, undefined imports stay |
| names the loader binds | `.dynsym` and `.dynstr` stay | import directory stays | imports stay in `LC_SYMTAB` and in the chained imports table |
| exported names | `.dynsym` stays | export directory stays | exports trie stays |
| function starts | `.eh_frame` FDEs, unless built without unwind tables | `.pdata` for non-leaf functions | `LC_FUNCTION_STARTS` stays |
| debug information | `.debug_*` gone | in the PDB, never in the image | in the dSYM, never in the image |
| section or load command headers | stay unless `--strip-section-headers` | stay | stay |

## Finding Functions Without Symbols

`static-arm64-O2` links `main-arm64-O2.o` and `ledger-arm64-O2.o` into one executable with five functions in `__text`. `nm -n` of the unstripped file is the ground truth: `_main` at `0x100000500` (244 bytes), `_percent_change` at `0x1000005f4` (24), `_grade` at `0x10000060c` (60), `_total` at `0x100000648` (248), `_grade_label` at `0x100000740` (72). `static-arm64-O2.stripped` has no `N_SECT` symbol inside `__text`. `FunctionFinder` runs four methods on it and `score()` compares each list with the truth.

### LC_FUNCTION_STARTS

The command points at nine bytes in `__LINKEDIT`: `80 0a f4 01 18 3c f8 01 00`. The format is uleb128 deltas, the first from the `__TEXT` address. `80 0a` is `0x500`, so the first start is `0x100000500`. `f4 01` is `0xf4`, so `0x1000005f4`. `18` gives `0x10000060c`, `3c` gives `0x100000648`, `f8 01` gives `0x100000740`, and `00` ends the list. Five of five, no false positives, at `-O0` and at `-O2`. The link editor writes this table for the unwinder and the crash reporter, and `strip` does not touch it. Ghidra reads it in its "Mach-O Function Starts" analyzer, `dyld_info -function_starts` prints it, and LIEF exposes it as `function_starts`.

### Prologue scans

Ghidra's AARCH64 start patterns begin with `fd 7b bf a9`, which is `stp x29, x30, [sp, #-0x10]!`. On our files it finds 0 of 5 at both levels. clang emits `sub sp, sp, #N` first and then `stp x29, x30, [sp, #M]` with a positive offset, so the pre-index form never occurs. A mask for `sub sp, sp, #imm`, `(word & 0xff0003ff) == 0xd10003ff`, finds 5 of 5 at `-O0`, where every function has a frame, and 1 of 5 at `-O2`, where `percent_change`, `grade`, `total`, and `grade_label` are leaf functions with no frame at all. `percent_change` starts with `cbz w0, ...`. A prologue scan reports what the compiler chose to emit, and lesson 38 showed how often that is nothing.

Neither scan produced a false positive here, because the program is small. One-byte patterns such as the x86-64 `55` of `push rbp` hit inside other instructions, which is why Ghidra's x86-64 pattern files pair a post-pattern like `55 48 89 e5` with a pre-pattern such as `ret` or `nop` that must end the previous function.

### Call targets

Every `bl` in `__text` names a function start, because a `bl` into the middle of a function is something a compiler does not emit for C. The encoding is `0x94000000` with a signed 26-bit word offset. The `bl` at `0x1000005a0` reads `3d 00 00 94`: `0x3d` is 61, times 4 is `0xf4`, so the target is `0x100000694`. In `ledger_main` that is the stub for `_puts`. In the static build, `call_targets()` collects the targets inside `__text`, drops the ones that land in `__stubs`, and adds the `LC_MAIN` entry, because nothing calls `main`. Five of five at both levels. Nucleus (Andriesse, Slowinska, Bos, 2017) builds its function detection on this idea for compiler-generated code, and Andriesse and others measured in 2016 that function boundaries are the hard part of disassembly, harder than instruction boundaries.

## A FLIRT-Shaped Signature

Hex-Rays describes FLIRT in its documentation: a pattern is "first 32 bytes of a function where all variant bytes are marked", the variant bytes come from fixups and external references, patterns live in a tree, and beyond the pattern "we calculate the CRC16 of the bytes starting from position 33 until the first variant byte" and store that length. Two functions with the same pattern and CRC are told apart by a tail byte at a position where they differ, then by the names they reference. A collision that nothing separates is "solved by natural intelligence". Functions shorter than four bytes without external references are excluded, and "the signature file contains no byte from the original libraries, except for the names of the functions".

`signatures_from_object()` builds that from `ledger-arm64-O2.o` and `main-arm64-O2.o`, the way FLAIR builds it from a library's objects. Every `relocation_info` record covers one four-byte word, and those bytes become variant. The `.pat` line layout, documented in rizin's parser, is the pattern, the CRC length, the CRC16, the function length, `:0000` and the name, and `^offset name` for each referenced name:

```text
A00000342800004B890C8052087D091B000DC01AC0035FD6 00 0000 0018 :0000 _percent_change
E8CC8C52C8CCAC72087C289B09FD7FD308FD62930801090B081900511F110071 04 9AAF 003C :0000 _grade ^0000 l_switch.table.grade ^0001 l_switch.table.grade
E8CC8C52C8CCAC72087C289B09FD7FD308FD62930801090B081900511F110071 04 9AAF 0048 :0000 _grade_label ^0000 l_switch.table.grade_label ^0001 l_switch.table.grade_label ^0002 _labels ^0003 _labels
```

`_percent_change` is 24 bytes, so its pattern is the whole function and the CRC length is 0. `_grade` is 60 bytes with its first relocation at byte 36, so the CRC covers four bytes. The CRC16 is the one the public `.pat` parsers use: polynomial `0x8408`, initial value `0xffff`, complement, then swap the two bytes. Its value for the ASCII string "123456789" is `0x6e90`, and the test pins that.

`match_signatures()` tries every signature at every function start of the stripped build, pattern first, then CRC. At `-O0` all five functions get their names and nothing collides. At `-O2` the two lines above collide. `grade_label` inlined `grade`, so the two functions share their first 36 bytes and the four CRC bytes. Both signatures match at `0x10000060c` and at `0x100000740`. The tail splits them: at byte 44 `_grade` has `20` and `_grade_label` has `28`, which is `ldr w0, [x9, w8, uxtw #2]` against `ldr x8, [x9, w8, uxtw #3]`, and the lengths are 60 against 72. The report records both collisions and the byte that decided them. Five of five named, at both levels.

The test `test_object_bytes_equal_linked_bytes_outside_relocated_words` checks the premise: every non-variant byte of each object function equals the byte at the same offset in the linked executable, so the link editor changed only the relocated words. `_total` has no relocation and no variant byte at all.

### What the tools do with the same idea

IDA Pro 9.4 ships FLIRT signatures per processor and the `sigmake` tool to build them; IDA Free covers x86 and x86-64 only and is for non-commercial use. Lumina is a server that keys function metadata by an md5 of the function and skips functions under 32 bytes. Ghidra 12.1.4 (Apache-2.0) has Function ID: a full hash over mnemonics and addressing modes that is "robust against changes due to linking" and a specific hash that adds constant operands, scored per matched instruction, with parent and child functions as tie-breakers; its shipped databases cover Visual Studio libraries only, and you populate your own from your own binaries. Binary Ninja 6.0 Krypton (commercial, with a Free edition) uses WARP (Apache-2.0): the function GUID is a UUIDv5 over the basic block GUIDs, each a UUIDv5 over block bytes after zeroing "all relocatable instructions" and dropping NOPs, with called, caller, and adjacent functions as constraints. BinDiff 8 (Apache-2.0) matches functions between two binaries with a fixed order of steps, from hash matching through flow graph MD indexes to call sequence matching, and weights the similarity from matched edges, blocks, instructions, and the flow graph MD index. Diaphora 3.4.3 (AGPL-3.0, IDA only) adds the small primes product, where each mnemonic maps to a prime and a function is the product, an order-free multiset fingerprint. radare2 6.2.4 (LGPL-3.0) has zignatures (`zg`, `z/`, `zb`) and reads FLIRT `.sig` files with `zfs`; rizin 0.9.1 (LGPL-3.0) creates `.pat` or `.sig` from an open binary with `Fc` and applies one with `Fs`.

IDA and Binary Ninja are closed and are described here from their documentation. radare2 and rizin are not installed on this machine, and their commands are quoted from their books and sources. The tools that ran on these fixtures are `clang`, `ld`, `llvm-objdump`, `otool`, `nm`, `strip`, and `dyld_info` from the Command Line Tools, and LIEF 1.0.0, pyelftools 0.33, and pefile 2024.8.26 through the probe. LIEF read every format here, including the COFF objects, which it has supported since 0.17.0, and reported ten bindings and two rebases on `ledger_main`, the same twelve fixups. pyelftools read the ELF files only. pefile refused `main-x86_64.obj` with `PEFormatError: 'DOS Header magic not found.'` and read the tiny image.

## Build It

Run the demo:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries
python3 code/main.py
```

The output is one JSON report with five parts. `elf` holds the relocation counts of the two objects, the link plan, and the dynamic section, PLT, and GOT of `tiny-dyn-x86_64`. `coff` holds the sections, relocations, functions, and undefined names of the two objects. `pe` holds the headers, directories, imports, exports, base relocations, and IAT calls of `tiny-x86_64.exe`. `macho` holds `ledger_main` with its stubs, chained fixups, fixup rows, and exports, the legacy layout of `ledger_main_nochain`, the dylib, and the two strip reports. `identification` holds the truth, the four methods with scores, and the signatures with their collisions, at `-O0` and `-O2`.

Expected shape:

```json
{
  "elf": {"linkPlan": {"pltSymbols": ["puts", "printf"], "sizes": {".plt": 48, ".got.plt": 40, ".rela.plt": 48, ".rela.dyn": 48}, "...": "..."}, "tiny-dyn-x86_64": {"...": "..."}},
  "coff": {"main-x86_64.obj": {"...": "..."}},
  "pe": {"imports": [{"dll": "msvcrt.dll", "iat": "0x2040", "...": "..."}], "...": "..."},
  "macho": {"ledger_main": {"flags": "0x200085", "fixupRows": ["__DATA_CONST __got 0x100004000 bind libledger/_grade", "..."], "...": "..."}, "strip": {"...": "..."}},
  "identification": {"O2": {"methods": {"functionStarts": {"recall": "5/5"}, "prologueSub": {"recall": "1/5"}, "...": "..."}, "correctNames": 5}}
}
```

Read `code/main.py` in this order:

1. `ElfFile` reads headers, sections, both symbol tables, and relocations, and `dynamic_entries()`, `jump_slots()`, `plt_entries()`, and `plt0()` read the linked image.
2. `plan_dynamic_link()` applies Table 4.9 and section 5.2 to the relocation records of relocatable objects.
3. `CoffObject` reads the file header, section table, 18-byte symbols with their auxiliary records, and 10-byte relocations.
4. `PeImage` reads the MS-DOS stub, PE signature, optional header, data directories, sections, and the import, export, and base relocation directories, and `iat_calls()` decodes `ff 15`.
5. `MachoFile` reads load commands, segments, `nlist` records, the indirect symbol table, stubs, chained fixups, the exports trie, and object relocations.
6. `FunctionFinder` runs the four start finders and `score()` compares each with the truth.
7. `signatures_from_object()` and `match_signatures()` build and apply the FLIRT-shaped signatures.
8. The `parse_*` functions read the captured tool text that the tests compare against.

More commands: `python3 code/main.py elf FILE`, `coff FILE`, `pe FILE`, and `macho FILE` print one report. `python3 code/main.py plan OBJECT...` prints the link plan for any set of ELF objects. `python3 code/main.py functions STRIPPED UNSTRIPPED OBJECT...` scores the finders and the signatures on another pair of your own builds.

## Use It

Use the readers in this order on a program you built.

1. Read the headers and name the format and the kind: relocatable object, executable, or shared library. The reader refuses what it does not know, and that refusal is information.
2. List the imports with their providers: `DT_NEEDED` and `.dynsym`, the import directory, or the chained imports table and `LC_LOAD_DYLIB`. Every call to a name on that list leaves the image.
3. Follow one call by hand to its slot. Write down the call bytes, the stub or PLT bytes, the slot address, the word in the file, and what the loader writes there. If the word in the file looks like garbage, decode it as a fixup before you call it garbage.
4. Compare the symbol table with the exports and the function starts. Names the loader needs survive `strip`. Names only a debugger needs do not. Say which group a missing name belonged to.
5. In a stripped build, run the finders you can run and score them against the unstripped twin while you still have one. Prefer the tables the link editor wrote, `LC_FUNCTION_STARTS`, `.pdata`, or `.eh_frame`, over byte patterns, and use call targets to fill gaps.
6. Build signatures from your own objects and apply them. Record every collision and the byte that split it. A name that two signatures claimed is an unknown until the tail or a referenced name decides it.

Keep the captured tool text with the files. When the toolchain changes, recapture, because a changed listing is a changed fixture.

## Interactive Lab

### Lab A: the PLT by hand

From the `code` directory, open Python:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/code
python3 -q
```

Run:

```python
from main import *
elf = load_elf("tiny-dyn-x86_64")
[(e.tag_name, e.text) for e in elf.dynamic_entries()]
elf.plt0()
[(e.symbol, hex(e.address), hex(e.slot), hex(e.slot_initial)) for e in elf.plt_entries()]
[hex(w) for w in elf.got_plt_words()]
```

Before each call, compute the answer from the bytes in the text above. Then change `IMPORTS` in `build_tiny_dyn_elf.py` to three names, rebuild, and predict the new sizes of `.plt`, `.got.plt`, and `.rela.plt` before you read them.

### Lab B: one chained fixup

```python
exe = load_macho("ledger_main")
stub = next(s for s in exe.stubs() if s.symbol == "_puts")
stub.lines()
raw = int.from_bytes(exe.read(stub.slot, 8), "little")
hex(raw), raw >> 63, (raw >> 51) & 0xfff, raw & 0xffffff
[(i.index, i.name, i.library) for i in exe.chained_fixups()["imports"]]
```

Decode the bind word on paper first: the bind bit, the `next` field in units of four bytes, the ordinal. Then read the word eight bytes further and confirm it is the next fixup. Then read the last word of the chain at `0x100004058` and explain why its `next` is zero.

### Lab C: strip and relink

In the fixtures directory, link a fresh program against the fully stripped dylib:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/code/fixtures
clang -target arm64-apple-macos -O1 main.c -L. -lledger.stripped -Wl,-rpath,@executable_path -o /tmp/relinked
nm /tmp/relinked | grep ' U '
dyld_info -exports libledger.stripped.dylib
```

The link succeeds with a library whose `LC_SYMTAB` is empty, because the link editor reads the exports trie. Then run `python3 ../main.py macho libledger.stripped.dylib` and compare `symtab`, `exports`, and `functionStarts`. Then strip the static build with `-N` instead and see what `dyld_info -function_starts` still prints.

### Lab D: the collision

```python
from main import *
stripped = load_macho("static-arm64-O2.stripped")
sigs = signatures_from_object(load_macho("ledger-arm64-O2.o"))
[s.pat_line() for s in sigs]
starts = FunctionFinder(stripped).function_starts()
match_signatures(sigs, stripped, starts)
```

Read the two collision records. Then build the signatures from `ledger-arm64-O0.o`, match them against `static-arm64-O0.stripped`, and explain from the `.pat` lines why no collision occurs at `-O0`. Then shorten `PATTERN_LENGTH` to 16 and count how many functions collide.

## Practice Lab

Decode the legacy binding tables and add the PE finder.

Requirements:

- Decode the `LC_DYLD_INFO_ONLY` rebase, bind, and lazy bind opcode streams of `ledger_main_nochain` into rows with segment, section, address, type, and target, and make them equal the 21 rows in the captured `dyld_info -fixups` text.
- Add a `PT_GNU_RELRO` program header and a `DT_FLAGS` with `DF_BIND_NOW` to `build_tiny_dyn_elf.py`, move `.got.plt` inside the covered range, and make `llvm-objdump -p` show the new header. Say in the fixtures README which part of full RELRO this reproduces and which part only glibc can perform.
- Write a `.pdata` reader for a PE32+ image and a function finder that uses `RUNTIME_FUNCTION` begin addresses. Build an object with `clang -target x86_64-pc-windows-msvc -c` without `-fno-asynchronous-unwind-tables`, read its `.pdata` relocations, and state which of its functions are leaf functions that the table omits.
- Write a test for each reader that compares with captured tool text.

Success means `python3 code/main.py macho ledger_main_nochain` prints the same 21 fixup rows that `dyld_info` prints, the tiny ELF carries a `PT_GNU_RELRO` that `llvm-objdump` lists, and the `.pdata` finder names the functions it can and lists the leaf functions it cannot.

## Lesson Artifact

This lesson includes `outputs/skill-linking-loading-and-stripped-binaries.md`. Use it to turn a program you built into a list of its imports with their providers, one call traced to the slot the loader fills, a statement of what `strip` removed and what survived, and a scored recovery of function starts and names in a stripped build. It requires the unstripped twin as ground truth, a captured tool listing for every claim, and a record of every collision.

## Verify It

Run the demo and the deterministic suite:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries
python3 code/main.py
python3 code/tests/test_main.py
```

Verification should prove:

- the dynamic section of `tiny-dyn-x86_64` matches `llvm-objdump -p` tag for tag, and `DT_FLAGS_1` carries `DF_1_PIE`
- the two `R_X86_64_JUMP_SLOT` records match `llvm-objdump -R` and name `puts` and `exit`
- PLT0 pushes GOT+8 and jumps through GOT+16, each entry reads its slot and pushes its index, and each slot holds the address of its own `pushq`
- the sections and program headers of the tiny ELF match `llvm-objdump -h -p`
- the relocation records of the two ELF objects match `llvm-objdump -r`
- the link plan finds two PLT symbols, four direct calls, two relative relocations, and the sizes of the tiny image
- the COFF section table, 37 symbol records with auxiliary records, and relocations match `llvm-objdump -h -t -r`, and `/16` resolves to `.llvm_addrsig`
- the three COFF `REL32` records of `ledger` sit at the three ELF `PC32` offsets
- the PE headers, `DllCharacteristics`, and data directories match `llvm-objdump -p`
- the import directory, hint/name entries, and IAT match `llvm-objdump` and `pefile`, and the IAT equals the lookup table before binding
- the export directory and the `DIR64` base relocation decode, and the relocated pointer names the string "linked by hand"
- `ff 15` at RVA `0x100b` resolves to the IAT slot of `puts`
- Mach-O flags, the 19 load command names, and the two libraries match `otool`
- the seven stubs decode to the eight `__got` slots and the indirect symbol table matches `otool -Iv`
- the chained fixups header matches `llvm-objdump --macho --chained-fixups`
- the chain walk reproduces all twelve raw words of `dyld_info -fixup_chain_details`
- the fixup rows and the imports table match `dyld_info -fixups` and `-imports`
- the exports trie matches `dyld_info -exports` for the dylib and for its stripped copy
- `nm_lines()` equals `nm -m` for the executable and its stripped copy
- `strip` removed `_main`, `_fns`, and `_names`, kept nine names and one `radr://5614542` stab, and the stripped program prints the same output
- the legacy layout has `LC_DYLD_INFO_ONLY`, seven lazy pointers, and rebases into `__stub_helper`
- arm64 object relocations match `llvm-objdump -r`
- `LC_FUNCTION_STARTS` recovers five of five at both levels and equals `nm` and `dyld_info -function_starts`
- the `sub sp` scan finds five of five at `-O0` and one of five at `-O2`, and the `stp` frame scan finds none
- `bl` targets plus the `LC_MAIN` entry recover five of five
- the signatures name all five functions at both levels and record the `grade` collision split by byte 44
- the CRC16 of "123456789" is `0x6e90`, and the eight bytes under the GOT-load pair of `main` are variant
- every non-variant object byte equals the linked byte
- the demo and the figure data report the same addresses, and the site module embeds the same data in ES5

## Production Failure Modes

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| A `bl` or `call` lands in a stub | "calls an unnamed function at 0x694" | the stub bytes, the slot it loads, and the import the slot binds |
| A GOT word read from the file | "corrupt pointer 0x8010000000000007" | bit 63 is bind, `next` is 2, ordinal 7 is `_puts` from library 2 |
| `PLT32` in an object | "every call goes through the PLT" | defined symbols are reduced to a direct distance, only undefined ones get an entry |
| Partial RELRO read as full | "GOT is read-only" | `.got.plt` slots after the three reserved ones sit outside `PT_GNU_RELRO` without `-z now` |
| COFF `REL32` compared with ELF `PC32` | "the Windows build has different relocations" | same offsets, the `-4` lives in the ELF addend and in the COFF field |
| IAT read before load | "imports point at strings" | the IAT equals the lookup table until the loader binds, and the strings are hint/name entries |
| A stripped dylib | "no symbols, nothing exported" | the exports trie and `LC_FUNCTION_STARTS` list every function |
| `nm` on a stripped executable | "one function" | `LC_FUNCTION_STARTS` lists five starts, nine bytes long |
| A prologue scan at `-O2` | "one function" | four leaf functions have no frame, call targets and the starts table find them |
| Two functions share 36 bytes | "grade_label is grade" | the tail byte at 44 and the lengths 60 and 72 split the collision |
| A tool run on another machine's build | the numbers in this text | recapture every listing from your own fixtures |

## Operational Rule

Follow every external call from the call site to the slot the loader fills, and decode the word in that slot as the format defines it before you call it an address. Strip only after you have recorded what the loader still needs. Recover function starts from the tables the link editor wrote before you scan for bytes, score every finder against a twin with symbols, and record each signature collision with the byte that split it.

## Further Reading

- [System V gABI, chapter 5: Program Loading and Dynamic Linking](https://www.sco.com/developers/gabi/latest/ch5.dynamic.html)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement: section 5.2 and Table 4.9](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Drepper, "How To Write Shared Libraries", version 4.1.2](https://akkadia.org/drepper/dsohowto.pdf)
- [Drepper, "ELF Symbol Versioning"](https://akkadia.org/drepper/symbol-versioning)
- [Jelinek, "Little hardening DSOs/executables against exploits", binutils list, 2004-01-06](https://www.sourceware.org/ml/binutils/2004-01/msg00070.html)
- [Taylor, "Linker relro", 2008](https://www.airs.com/blog/archives/189)
- [binutils commit bd7ab16b: PLT32 for calls, 2018-02-13](https://gnu.googlesource.com/binutils-gdb/+/bd7ab16b4537788ad53521c45469a1bdae84ad4a) and [LLVM D43383](https://reviews.llvm.org/D43383)
- [GNU Binutils: strip](https://sourceware.org/binutils/docs/binutils/strip.html) and [llvm-objcopy](https://llvm.org/docs/CommandGuide/llvm-objcopy.html)
- [Microsoft, PE Format](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)
- [CALL instruction reference, FF /2](https://www.felixcloutier.com/x86/call)
- [Apple, mach-o/loader.h](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h) and [mach-o/nlist.h](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/nlist.h)
- [Apple dyld, mach-o/fixup-chains.h](https://github.com/apple-oss-distributions/dyld/blob/main/include/mach-o/fixup-chains.h)
- [Apple ld64, stub_arm64.hpp](https://github.com/apple-oss-distributions/ld64/blob/main/src/ld/passes/stubs/stub_arm64.hpp)
- [Xcode 13 release notes: chained fixups](https://developer.apple.com/documentation/xcode-release-notes/xcode-13-release-notes) and [WWDC22 session 110362, "Link fast: Improve build and launch times"](https://developer.apple.com/videos/play/wwdc2022/110362/)
- [strip(1)](https://keith.github.io/xcode-man-pages/strip.1.html), [ld(1)](https://keith.github.io/xcode-man-pages/ld.1.html), and [dyld(1)](https://keith.github.io/xcode-man-pages/dyld.1.html)
- [Hex-Rays, IDA F.L.I.R.T. Technology: In-Depth](https://docs.hex-rays.com/core/flirt/concepts/ida-f.l.i.r.t.-technology-in-depth) and [Lumina overview](https://docs.hex-rays.com/add-ons/lumina/overview)
- [Ghidra Function ID help](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/FunctionID/src/main/help/help/topics/FunctionID/FunctionID.html) and [AARCH64 function start patterns](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/AARCH64/data/patterns/AARCH64_LE_patterns.xml)
- [Vector 35, WARP](https://github.com/Vector35/warp) and [Binary Ninja WARP guide](https://docs.binary.ninja/guide/warp.html)
- [BinDiff manual](https://www.zynamics.com/bindiff/manual/) and [BinDiff source](https://github.com/google/bindiff)
- [Diaphora](https://github.com/joxeankoret/diaphora)
- [rizin pat.c, the .pat parser](https://github.com/rizinorg/rizin/blob/dev/librz/sign/pat.c), [radare2 flirt.c](https://github.com/radareorg/radare2/blob/master/libr/anal/flirt.c), and [radare2 book: Zignatures](https://book.rada.re/signatures/zignatures.html)
- [Andriesse et al., "An In-Depth Analysis of Disassembly on Full-Scale x86/x64 Binaries" (USENIX Security 2016)](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/andriesse) and [Andriesse, Slowinska, Bos, "Compiler-Agnostic Function Detection in Binaries" (EuroS&P 2017)](https://danielandriesse.com/papers/eurosp-2017.pdf)
- [Bao et al., ByteWeight (USENIX Security 2014)](https://www.usenix.org/conference/usenixsecurity14/technical-sessions/presentation/bao) and [Shin, Song, Moazzezi, "Recognizing Functions in Binaries with Neural Networks" (USENIX Security 2015)](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/shin)
- [LIEF changelog](https://lief.re/doc/latest/changelog.html), [pyelftools](https://github.com/eliben/pyelftools), and [pefile](https://github.com/erocarrera/pefile)
