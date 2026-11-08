# Program Anatomy: An ELF Reader From Scratch

> A compiled program is a set of tables that point at each other. A reader you wrote gives output you can check byte by byte.

**Type:** Build
**Languages:** Python (stdlib), C (fixture only)
**Prerequisites:** Phase 0 · 01 (Dev Environment) with clang installed, Python 3.10 or later, hexadecimal arithmetic
**Time:** ~120 minutes

## Learning Objectives

- State the authorization rule for every target in this track and the four limits of 17 U.S.C. 1201(f).
- Read the ELF header, the section header table, and both string tables with `struct.unpack`.
- Decode `.symtab` entries and `.rela` records with the names from the gABI and the x86-64 psABI.
- Return the exact bytes of a named function and map every file offset to the structure that owns it.
- Read program headers and map a virtual address to a file offset through `PT_LOAD`.
- Read the load commands of a Mach-O object and name the ELF idea that each one matches.

## Before You Start: Authorization and the Law

Every target in lessons 32 to 36 is a program you wrote and compiled. The source is `code/fixtures/ledger.c`, four short C functions. You own the source, the compiler command, and the object files it produced. There is no licence to read, no protection to pass, and no third party whose code you open. The track never covers software protections, licence checks, or programs you do not own.

The rule exists because the law treats disassembly as copying. In *Sega Enterprises Ltd. v. Accolade, Inc.*, 977 F.2d 1510 (9th Cir. 1992), the court held that intermediate copies made during disassembly are copies under the Copyright Act. It then held that "where disassembly is the only way to gain access to the ideas and functional elements embodied in a copyrighted computer program and where there is a legitimate reason for seeking such access, disassembly is a fair use of the copyrighted work, as a matter of law." 

The second case is *Sony Computer Entertainment, Inc. v. Connectix Corp.*, 203 F.3d 596 (9th Cir. 2000). Connectix copied the PlayStation BIOS while it built an emulator, and the court held those copies fair use. Both cases protected the study. Neither protected copied code in the final product.

Two statutes set the limits. 17 U.S.C. 1201(f) lets a person who "has lawfully obtained the right to use a copy of a computer program" circumvent an access control "for the sole purpose of identifying and analyzing those elements of the program that are necessary to achieve interoperability of an independently created computer program with other programs". Four limits stack: a lawful copy, the interoperability purpose, elements that were not already "readily available", and analysis that is otherwise non-infringing. Section 1201(f) is an exception to the anti-circumvention rule only. The copying question stays with fair use.

In the European Union, Directive 2009/24/EC Article 5(3) covers study. A person with a right to use a copy can "observe, study or test the functioning of the program in order to determine the ideas and principles which underlie any element of the program". The right applies while loading, displaying, running, transmitting, or storing the program.

Article 6 permits decompilation without the rightholder's authorisation when it is "indispensable to obtain the information necessary to achieve the interoperability of an independently created computer program". The conditions match 1201(f). A licensee performs the acts, the information was not already readily available, and the acts stay within the parts needed. Article 6(2) bars using the result for any other goal or for a program that is substantially similar in expression. Article 8 makes contract terms contrary to Article 6 or Article 5(3) null and void.

| Source | What it allows | Conditions |
|---|---|---|
| 17 U.S.C. 1201(f) | Circumventing an access control to analyze a program | Lawful copy, interoperability purpose, information not readily available, no infringement |
| Directive 2009/24/EC Art. 5(3) | Observing, studying, and testing a running program | A right to use the copy, acts within normal loading and running |
| Directive 2009/24/EC Art. 6 | Decompilation | Licensee, interoperability purpose, information not readily available, confined to the needed parts |
| *Sega v. Accolade* | Disassembly as fair use | The only way to reach the ideas and functional elements, a legitimate reason |
| *Sony v. Connectix* | Intermediate copies during reverse engineering | A non-infringing final product |

These notes come from the statutes and the opinions, and they are not legal advice. When a future target is not yours, obtain written authorization before you open the file and keep the authorization with your evidence. Section 2.1 of the Reverse Engineering 101 manual gives the full citations and the CJEU cases.

## The Problem

You compiled `ledger.c` and ran `llvm-objdump -t` on the object. The output lists `percent_change` at value `0000000000000000` with size `0000000000000010`. Which 16 bytes of the 1,768-byte file are that function? The listing also shows `R_X86_64_PC32 .rodata+0x10` at offset `0x36`, and the four bytes at that spot in the file are zero. What will they become, and why is the addend `0x10` when the table starts at `0x14`?

rea answers layout questions with `inspect_binary_layout`, and that tool exists only on Linux x64 with pwntools 4.15.0 behind `REA_PWNTOOLS_PYTHON`. On this Mac it is absent. `address_to_file_offset` needs a Ghidra session and a complete copy of the original file bytes with a matching SHA-256. `inspect_artifact` lists what a container holds by path and content hash. It never opens the tables inside an object file. So you write the reader yourself in about 950 lines of Python with `struct.unpack` and no dependency. The tests compare every table with `llvm-objdump` text captured once into the fixtures.

```figure
elf-byte-map
```

## The File Is Tables That Point at Tables

The System V gABI, chapter 4, Figure 4-1, draws two views of one file. The linking view has an ELF header, an optional program header table, sections, and a required section header table. The execution view has an ELF header, a required program header table, segments, and an optional section header table. The gABI adds one sentence that governs the whole reader: "Only the ELF header has a fixed position in the file". Every other structure is found by an offset stored in another structure.

The gABI also fixes the scalar types and says that "ELF uses no bit-fields". `Elf64_Addr` and `Elf64_Off` are 8 bytes, `Elf64_Half` is 2, `Elf64_Word` is 4, and `Elf64_Xword` is 8. The x86-64 psABI, section 4.1.1, requires `ELFCLASS64`, `ELFDATA2LSB`, `e_machine` `EM_X86_64` (62), and `e_flags` 0. Little-endian with fixed widths means `struct.unpack` with a `<` prefix reads every record in one call.

The first 64 bytes of `ledger-x86_64-O1.o`:

```text
00000000: 7f45 4c46 0201 0100 0000 0000 0000 0000  .ELF............
00000010: 0100 3e00 0100 0000 0000 0000 0000 0000  ..>.............
00000020: 0000 0000 0000 0000 2804 0000 0000 0000  ........(.......
00000030: 0000 0000 4000 0000 0000 4000 0b00 0100  ....@.....@.....
```

Read them against the gABI "ELF Header" page. `e_ident` is the 16 bytes `7f 45 4c 46` (the magic), class 2 (64-bit), data 1 (little-endian), version 1, OS ABI 0 (System V), and padding.

Then `e_type` `0x0001` is `ET_REL`, a relocatable object. `e_machine` `0x003e` is 62, `EM_X86_64`. `e_entry` is zero because an object has no entry point. `e_phoff` is zero because an object has no program headers. `e_shoff` is `0x428`, the file offset of the section header table. The last row holds `e_ehsize` `0x40`, `e_phentsize` 0, `e_phnum` 0, `e_shentsize` `0x40`, `e_shnum` `0x0b` (11 headers), and `e_shstrndx` `0x0001`.

The reader turns that row into one call:

```python
fields = struct.unpack_from("<HHIQQQIHHHHHH", data, 16)
```

The format string is the gABI figure read left to right: two halfwords, a word, three 8-byte values, a word, and six halfwords. The reader refuses a file whose magic, class, or byte order differs, and it refuses `e_shentsize` or `e_phentsize` values that are not 64 and 56. A wrong width would make every later offset wrong, so the check sits at the top.

## Section Headers and Two String Tables

Each section header is an `Elf64_Shdr` of 64 bytes (gABI Figure 4-8): `sh_name`, `sh_type`, `sh_flags`, `sh_addr`, `sh_offset`, `sh_size`, `sh_link`, `sh_info`, `sh_addralign`, and `sh_entsize`. The format string is `<IIQQQQIIQQ`. `sh_name` is an offset into the section whose index is `e_shstrndx`, and the name ends at the first zero byte. In this object `e_shstrndx` is 1, and clang named that section `.strtab`, so one table serves both the section names and the symbol names.

The reader prints the 11 headers of the -O1 object:

```text
Idx Name             Type         Flags   Offset     Size       Addr Link Info Align
  0                  NULL                    0x0      0x0        0x0    0    0     0
  1 .strtab          STRTAB                0x368     0xbe        0x0    0    0     1
  2 .text            PROGBITS     AX        0x40     0x9f        0x0    0    0    16
  3 .rela.text       RELA         I        0x2a8     0x48        0x0   10    2     8
  4 .rodata          PROGBITS     A         0xe0     0x50        0x0    0    0     8
  5 .rela.rodata     RELA         I        0x2f0     0x78        0x0   10    4     8
  6 .rodata.str1.1   PROGBITS     AMS      0x130      0xa        0x0    0    0     1
  7 .comment         PROGBITS     MS       0x13a     0x2f        0x0    0    0     1
  8 .note.GNU-stack  PROGBITS              0x169      0x0        0x0    0    0     1
  9 .llvm_addrsig    LLVM_ADDRSIG E        0x368      0x0        0x0   10    0     1
 10 .symtab          SYMTAB                0x170    0x138        0x0    1    9     8
```

Index 0 is the reserved null header. `.text` holds 159 bytes of code at file offset `0x40`, right after the header, with flags `A` (allocated in memory) and `X` (executable). `.rodata` holds 80 bytes of read-only data. `.rodata.str1.1` holds the five label strings `F\0D\0C\0B\0A\0`, 10 bytes, with flags `M` (mergeable) and `S` (strings).

`.comment` holds the 47-byte compiler stamp `\0Apple clang version 17.0.0 (clang-1700.6.3.2)\0`. `.llvm_addrsig` has type `0x6fff4c03`, inside the OS-specific range `SHT_LOOS` to `SHT_HIOS` that the gABI reserves, and LLVM's `ELF.h` names it. Its flag `E` is `SHF_EXCLUDE`, so a linker drops it.

The `sh_link` and `sh_info` columns are the pointers between tables. `.rela.text` has `sh_info` 2 and `sh_link` 10: it patches section 2 and takes its symbols from section 10. `.symtab` has `sh_link` 1, the string table for symbol names, and `sh_info` 9, the index of the first non-local symbol. `sh_addr` is zero in every row because an object has no addresses yet. The linker assigns them.

Two gABI rules let the reader draw a complete map of the file. Sections "are contiguous and do not overlap", and a file "may contain inactive space". The reader sorts every structure by offset and fills the holes:

```text
     0x0 +64    header   ELF header
    0x40 +159   section  .text
    0xdf +1     gap      inactive space
    0xe0 +80    section  .rodata
   0x130 +10    section  .rodata.str1.1
   0x13a +47    section  .comment
   0x169 +7     gap      inactive space
   0x170 +312   section  .symtab
   0x2a8 +72    section  .rela.text
   0x2f0 +120   section  .rela.rodata
   0x368 +190   section  .strtab
   0x426 +2     gap      inactive space
   0x428 +704   table    section header table
```

The three gaps total 10 bytes, and each one is alignment. `.rodata` has `sh_addralign` 8, so it starts at `0xe0` rather than `0xdf`. `.symtab` has alignment 8, so seven bytes sit unused after `.comment`. The section header table itself is aligned to 8.

Sections of type `SHT_NOBITS` occupy no file bytes at all, so the map skips them. Nothing in this object has that type. A `.bss` in a linked program does, and a reader that trusts `sh_size` there reads past the file.

## Symbols: Binding, Type, Section, Value, Size

An `Elf64_Sym` is 24 bytes (gABI Figure 4-18): `st_name`, `st_info`, `st_other`, `st_shndx`, `st_value`, `st_size`, format `<IBBHQQ`. `st_info` packs two fields: the binding in the high four bits and the type in the low four. The gABI names the bindings `STB_LOCAL` 0, `STB_GLOBAL` 1, `STB_WEAK` 2, and the types `STT_NOTYPE` 0, `STT_OBJECT` 1, `STT_FUNC` 2, `STT_SECTION` 3, `STT_FILE` 4. The low two bits of `st_other` hold the visibility, `STV_DEFAULT` 0 here throughout.

```text
Idx            Value   Size Bind   Type    Section          Name
  0              0x0      0 LOCAL  NOTYPE  *UND*
  1              0x0      0 LOCAL  FILE    *ABS*            ledger.c
  2              0x0     20 LOCAL  OBJECT  .rodata          labels.rel
  3              0x0      0 LOCAL  SECTION .rodata          .rodata
  4              0x2      2 LOCAL  OBJECT  .rodata.str1.1   .L.str.1
  5              0x4      2 LOCAL  OBJECT  .rodata.str1.1   .L.str.2
  6              0x6      2 LOCAL  OBJECT  .rodata.str1.1   .L.str.3
  7              0x8      2 LOCAL  OBJECT  .rodata.str1.1   .L.str.4
  8              0x0      0 LOCAL  SECTION .rodata.str1.1   .rodata.str1.1
  9              0x0     16 GLOBAL FUNC    .text            percent_change
 10             0x10     46 GLOBAL FUNC    .text            grade
 11             0x40     31 GLOBAL FUNC    .text            total
 12             0x60     63 GLOBAL FUNC    .text            grade_label
```

Index 0 is the reserved undefined symbol. `st_shndx` names the section that defines the symbol, with three reserved values: `SHN_UNDEF` 0, `SHN_ABS` `0xfff1` for the file name, and `SHN_COMMON` `0xfff2`. Section symbols have an empty name, so `llvm-objdump` prints the section's own name for them, and the reader does the same. The gABI rule that "all symbols with STB_LOCAL binding precede the weak and global symbols" shows up as the first nine rows, and `.symtab` recorded 9 in `sh_info` for that reason.

In a relocatable object `st_value` is an offset inside the symbol's section, because `sh_addr` is zero. The file offset of a function is therefore `sh_offset + st_value - sh_addr`, and its length is `st_size`:

```python
section = elf.sections[symbol.st_shndx]
file_offset = section.sh_offset + (symbol.st_value - section.sh_addr)
code = elf.data[file_offset : file_offset + symbol.st_size]
```

For `percent_change` that is `0x40 + 0`, and the 16 bytes are `85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3`. The sizes matter as much as the starts. `grade` ends at `.text` offset `0x3e`. The two bytes `66 90` that follow are a `nop` the compiler added so that `total` starts at `0x40`, a 16-byte boundary. Those two bytes belong to no symbol. Lesson 33 uses `st_size` as the stop condition for a disassembler, and lesson 36 masks them out before it compares a rebuild.

## Relocations: What the Zero Bytes Mean

An `Elf64_Rela` is 24 bytes (gABI Figure 4-23): `r_offset`, `r_info`, and a signed `r_addend`, format `<QQq`. The gABI splits `r_info` with two macros: `ELF64_R_SYM(i)` is `i >> 32` and `ELF64_R_TYPE(i)` is `i & 0xffffffff`. In a relocatable file `r_offset` is an offset inside the section named by the table's `sh_info`. The type names and formulas come from the x86-64 psABI, Table 4.9. There `S` is the symbol value, `A` the addend, `P` the place being patched, and `L` the PLT entry. `R_X86_64_64` is `S + A`, `R_X86_64_PC32` is `S + A - P`, and `R_X86_64_PLT32` is `L + A - P`.

The -O1 object has eight records:

```text
  .rela.text       0x36 R_X86_64_PC32          .rodata+0x10
  .rela.text       0x84 R_X86_64_PC32          .rodata+0x24
  .rela.text       0x93 R_X86_64_PC32          .rodata-0x4
  .rela.rodata      0x0 R_X86_64_PC32          .rodata.str1.1
  .rela.rodata      0x4 R_X86_64_PC32          .L.str.1+0x4
  .rela.rodata      0x8 R_X86_64_PC32          .L.str.2+0x8
  .rela.rodata      0xc R_X86_64_PC32          .L.str.3+0xc
  .rela.rodata     0x10 R_X86_64_PC32          .L.str.4+0x10
```

Take the first one apart. Offset `0x36` lies inside `grade`, which spans `0x10` to `0x3e`. The instruction at `0x33` is `48 8d 0d 00 00 00 00`, a `lea` of a RIP-relative address, and its four-byte displacement sits at `0x36`. The processor adds the displacement to the address of the next instruction, `0x3a`.

The compiler wants the result to be `.rodata + 0x14`, where a five-entry table of 32-bit values `1, 2, 3, 4, 4` begins. So the stored value must be `(.rodata + 0x14) - 0x3a`. The formula `S + A - P` with `P = 0x36` gives `.rodata + A - 0x36`. Setting the two equal gives `A = 0x14 - 4 = 0x10`. The addend carries the target offset minus the four bytes between the displacement and the end of the instruction.

That table is how clang compiled the `switch` in `grade` at -O1. The code computes `score / 10` with a multiply by `0x66666667` and two shifts, subtracts 6, compares with 4, and indexes the table. The -O1 ELF object keeps no symbol for the table. The reference is the section symbol `.rodata` plus an addend, and only the arm64 build of the same source names it `l_switch.table.grade`. The second record, at `0x84` in `grade_label`, points at a second table of 8-byte values at `.rodata + 0x28`. The third, at `0x93`, points at `.rodata + 0x0`, the start of `labels.rel`.

The five `.rela.rodata` records fill `labels.rel`. Each entry sits at offset `4i` and gets the addend `4i`, so `S + A - P` reduces to the string's address minus the base of the table. `grade_label` reads an entry with `movslq`, adds the table base back, and has the pointer. The first record names the section symbol `.rodata.str1.1` with addend 0 because the string `F` is the first byte of that section. The others name `.L.str.1` to `.L.str.4`, the compiler's local labels for `D`, `C`, `B`, and `A`.

The same source compiles to three different tables at three optimization levels. The reader shows the difference without a disassembler:

| Build | Where `labels` lives | How `grade` selects | How `grade_label` reaches `grade` |
|---|---|---|---|
| -O0 | `.data`, five 8-byte pointers, five `R_X86_64_64` records | A jump table in `.rodata`: five `R_X86_64_PC32` records pointing into `.text` | A call with `R_X86_64_PLT32 grade-0x4` |
| -O1 | `.rodata` as `labels.rel`, five 32-bit relative entries | A value table at `.rodata+0x14`, one `R_X86_64_PC32` | Inlined, no call |
| -O2 | Same as -O1 | Same as -O1 | Inlined, `total` grows to 140 bytes |

At -O0 the `switch` is a real jump table whose five entries point back into `.text` at `+0x91`, `+0x8c`, `+0x87`, `+0x82`, and `+0x86`. The call to `grade` carries the same `-0x4` addend for the same reason as the `lea`. At -O1 the optimizer saw that every case returns a constant and replaced the jumps with a table of results. Lesson 33 decodes both shapes.

## Program Headers: The Loader's View

A relocatable object has no program headers, so `e_phnum` is 0. An executable or a shared object has them, and the loader reads nothing else. An `Elf64_Phdr` is 56 bytes (gABI Figure 5-1): `p_type`, `p_flags`, `p_offset`, `p_vaddr`, `p_paddr`, `p_filesz`, `p_memsz`, `p_align`, format `<IIQQQQQQ`. The gABI fixes three rules for `PT_LOAD` entries. They appear in ascending `p_vaddr` order, and a `p_memsz` larger than `p_filesz` means zero fill. `p_vaddr` is congruent to `p_offset` modulo `p_align`.

Every target in this track is a program you built, and no linker on this Mac produces a Linux executable from `ledger.o`. So the fixture `tiny-x86_64` comes from `code/fixtures/build_tiny_elf.py`, which writes 736 bytes with `struct.pack`. The file holds an ELF header, two program headers, a 36-byte `_start`, a 3-byte `.rodata`, a symbol table, and six section headers. `_start` writes `ok\n` to file descriptor 1 and exits with status 42. On Linux x86-64 it runs. Here it is a fixture for the program header path.

```text
Program headers:
  PT_LOAD          r-x offset=0x0 vaddr=0x400000 filesz=0x2e0 memsz=0x2e0 align=0x1000
  PT_GNU_STACK     rw- offset=0x0 vaddr=0x0 filesz=0x0 memsz=0x0 align=0x10

entry 0x4000b0 is file offset 0xb0 through PT_LOAD
```

The single `PT_LOAD` maps the whole 736-byte file at `0x400000`. The reader maps an address to a file offset by finding the `PT_LOAD` that contains it and computing `p_offset + (address - p_vaddr)`. For the entry point that is `0 + (0x4000b0 - 0x400000) = 0xb0`, the start of `.text`.

This is the computation behind rea's `address_to_file_offset`. For a Ghidra target, that tool returns `{address, file_offset}`. The Hopper provider also returns `provider_file_offset` and `image_base_file_offset`. The tool needs a complete original copy of the file, and the SHA-256 of that copy must match the target. The documentation of rea's `inspect_binary_layout` adds a line to keep: "A linked address is not a runtime address". A position-independent executable loads at a base the kernel chooses, and the file offset is the only stable coordinate.

Program headers also explain why a stripped executable still runs. A linker can remove the section header table entirely, and `e_shoff` becomes zero. A tool that walks sections then sees nothing. The loader never looked at them.

## The Same Ideas in Mach-O

Apple publishes no prose specification for Mach-O. The headers in the XNU source are the specification: `EXTERNAL_HEADERS/mach-o/loader.h`, `nlist.h`, and `reloc.h`. The fixture `ledger-arm64-O1.o` is the same `ledger.c` built with `clang -target arm64-apple-macos -O1 -fno-asynchronous-unwind-tables -c`.

A `mach_header_64` is 32 bytes: `magic`, `cputype`, `cpusubtype`, `filetype`, `ncmds`, `sizeofcmds`, `flags`, `reserved`. The magic is `0xfeedfacf`, `MH_MAGIC_64`. `cputype` is `0x0100000c`, `CPU_TYPE_ARM64`. `filetype` is 1, `MH_OBJECT`. `ncmds` is 5 and `sizeofcmds` is 616: the load commands occupy the 616 bytes after the header, and each one starts with `{cmd, cmdsize}`. The flag `0x2000` is `MH_SUBSECTIONS_VIA_SYMBOLS`.

```text
Load commands:
  0 LC_SEGMENT_64                cmdsize=472 at 0x20
  1 LC_BUILD_VERSION             cmdsize=24 at 0x1f8
  2 LC_LINKER_OPTIMIZATION_HINT  cmdsize=16 at 0x210
  3 LC_SYMTAB                    cmdsize=24 at 0x220
  4 LC_DYSYMTAB                  cmdsize=80 at 0x238
```

`LC_SEGMENT_64` (0x19) is the Mach-O answer to both ELF tables. Its `segment_command_64` has `segname`, `vmaddr`, `vmsize`, `fileoff`, `filesize`, `maxprot`, `initprot`, `nsects`, and `flags`. Then `nsects` records of type `section_64`, 80 bytes each, follow in the same command. The `loader.h` comment on `MH_OBJECT` says the sections live "in one unnamed segment with no segment padding". The fixture shows that: one segment with an empty name, `fileoff` 648, `filesize` 456, and five sections.

```text
  Idx Section                    Addr   Size Offset Reloff Nreloc Type
    1 __TEXT,__text               0x0   0xd0    648   1104      6 S_REGULAR
    2 __DATA,__const             0xd0   0x28    856   1152      5 S_REGULAR
    3 __TEXT,__cstring           0xf8    0xa    896      0      0 S_CSTRING_LITERALS
    4 __TEXT,__const            0x108   0x40    912      0      0 S_REGULAR
    5 __LD,__compact_unwind     0x148   0x80    976   1192      4 S_REGULAR
```

Each section names its parent segment in `segname`, so two sections called `__const` are distinct because one is `__DATA,__const` and the other `__TEXT,__const`. Relocations are per section through `reloff` and `nreloc`, where ELF has a separate `.rela.X` section per target.

Each `relocation_info` is 8 bytes. A signed `r_address` comes first. A 32-bit field follows, packed as `r_symbolnum` (24 bits), `r_pcrel` (1), `r_length` (2), `r_extern` (1), and `r_type` (4). The six `__text` records are three pairs of `ARM64_RELOC_PAGE21` and `ARM64_RELOC_PAGEOFF12`, one pair per table reference. An arm64 `adrp` plus `add` does what one x86-64 `lea` does, so each reference needs two records. The five `__DATA,__const` records are `ARM64_RELOC_UNSIGNED` with `r_length` 3, so each one patches an 8-byte absolute pointer.

At -O1 the arm64 build kept `labels` as plain pointers where the x86-64 build made a relative table.

`LC_SYMTAB` (0x2) holds `symoff` 1240, `nsyms` 17, `stroff` 1512, `strsize` 176, and 1512 plus 176 is 1688, the file size. Each `nlist_64` is 16 bytes: `n_strx`, `n_type`, `n_sect`, `n_desc`, `n_value`. `n_type` is a bit field. `N_TYPE` (mask `0x0e`) equal to `N_SECT` (`0xe`) means defined in the section whose 1-based ordinal is `n_sect`. `N_EXT` (`0x01`) marks an external symbol.

`nlist_64` has no size field. To get the 24 bytes of `_percent_change` the reader takes the next symbol address in the same section, `_grade` at `0x18`. C symbols carry a leading `_` here, so the function is `_percent_change`.

`LC_DYSYMTAB` (0xb) records the same locals-first rule as the ELF `sh_info`: `ilocalsym` 0, `nlocalsym` 13, `iextdefsym` 13, `nextdefsym` 4. `LC_BUILD_VERSION` (0x32) records `platform` 1 (macOS), `minos` 26.0, and `sdk` 26.2 as packed `XXXX.YY.ZZ` integers. That command is why the arm64 fixture is committed as bytes. A build on a Mac with another SDK produces a different file.

The reader's `compare_formats` puts the two files side by side:

| Idea | ELF, `ledger-x86_64-O1.o` | Mach-O, `ledger-arm64-O1.o` |
|---|---|---|
| File identity | `e_ident` `7f 45 4c 46`, class 64, data LSB | `magic` `0xfeedfacf` |
| Machine | `e_machine` 62, `EM_X86_64` | `cputype` `0x100000c`, `CPU_TYPE_ARM64` |
| File kind | `e_type` 1, `ET_REL` | `filetype` 1, `MH_OBJECT` |
| Where the tables are | `e_shoff` `0x428`, 11 section headers | 5 load commands, 616 bytes after the header |
| The code | `.text` at `0x40`, size `0x9f`, flags `AX` | `__TEXT,__text` at 648, size `0xd0`, in the unnamed segment |
| Symbol names | `.symtab` (section 10), names in `.strtab` through `sh_link` 1 | `LC_SYMTAB` `symoff` 1240, `nsyms` 17, names at `stroff` 1512 |
| Symbol size | `st_size`: `percent_change` is 16 bytes | No field: next symbol minus this one, 24 bytes |
| Relocations | `.rela.text`, 3 records, `R_X86_64_PC32` | `__text` `reloff` 1104, 6 records, `PAGE21` and `PAGEOFF12` |
| Function bytes | `percent_change`: 16 bytes at `0x40` | `_percent_change`: 24 bytes at `0x288` |

rea reads Mach-O through `inspect_macho`, which runs `otool -h -l`, `nm -gjU`, `dyld_info -imports -exports`, and `dwarfdump --uuid` through `xcrun`. Your reader needs none of them, and it reads the same `symoff` and `stroff` that `otool -l` prints. The `open_binary` tool of rea detects ELF, MZ, PE, and thin or universal Mach-O from the magic bytes. It also reads `e_machine` at offset 18 itself. That is the first 20 bytes of what you built here. For a file with no header, you give `format: raw-binary`, the architecture, and the entry address. The Ghidra provider refuses a universal binary and asks for a thinned slice. Your reader does the same when it sees `0xcafebabe`.

## Build It

Run the standard-library reader:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/main.py
```

The demo reads `ledger-x86_64-O1.o` and prints its header, sections, symbols, relocations, and file offset map. It then prints the four function byte strings, reads `ledger-arm64-O1.o`, and prints the comparison table. It ends with the program headers of `tiny-x86_64`. Expected lines:

```text
percent_change: 16 bytes at file offset 0x40: 85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3
grade: 46 bytes at file offset 0x50: 48 63 c7 48 69 c0 67 66 66 66 ...
entry 0x4000b0 is file offset 0xb0 through PT_LOAD
```

Pass a path to read one file: `python3 code/main.py code/fixtures/ledger-x86_64-O0.o`. The reader picks ELF or Mach-O from the first four bytes.

Read `code/main.py` in this order:

1. `ElfFile._read_header()` checks the magic, class, byte order, and entry sizes, then unpacks the header.
2. `ElfFile._read_sections()` and `read_cstring()` read the section header table and resolve names through `e_shstrndx`.
3. `ElfFile._read_symbols()` splits `st_info`, resolves names through `sh_link`, and keeps the reserved section indexes readable.
4. `ElfFile._read_relocations()` walks every `SHT_RELA` section, splits `r_info`, and names types from Table 4.9.
5. `ElfFile.function_span()` and `function_bytes()` turn a symbol into a file range and the bytes in it.
6. `ElfFile.file_offset_map()` sorts every structure by offset and fills the inactive space.
7. `ElfFile._read_program_headers()` and `address_to_file_offset()` handle executables.
8. `MachOFile` reads the header, the load commands, `LC_SEGMENT_64` with its sections, `LC_SYMTAB`, `LC_BUILD_VERSION`, and per-section relocations.
9. `compare_formats()` names the same idea in both files with the values read from each.

## Use It

Import the reader from later lessons with `from main import ElfFile` after adding this lesson's `code` directory to `sys.path`. Lesson 33 asks it for `function_bytes` and `relocations_for(".text")`. Lesson 35 records its output as observed evidence. Lesson 36 asks it for the relocation offsets to mask before a byte comparison.

Compile your own C into an object with the same `clang -target x86_64-unknown-linux-gnu -c` command and run the reader on it. Add a relocation name only when the x86-64 psABI Table 4.9 lists it. Add a section type only when the gABI or the producing toolchain documents it. When the reader meets a value it has no name for, it prints the number in hexadecimal rather than guessing.

## Interactive Lab

### Lab A: the header by hand

From the `code` directory, open Python:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/code
python3 -q
```

Run:

```python
import struct
from main import ElfFile, FIXTURES
data = (FIXTURES / "ledger-x86_64-O1.o").read_bytes()
data[:4], data[4], data[5]
struct.unpack_from("<HHIQQQIHHHHHH", data, 16)
elf = ElfFile(data)
elf.header.e_shoff, elf.header.e_shnum, elf.sections[elf.header.e_shstrndx].name
```

The tuple shows `e_type` 1, `e_machine` 62, and `e_shoff` 1064, which is `0x428`. The last line shows that section 1, `.strtab`, holds the section names.

### Lab B: the value table behind the switch

```python
rodata = elf.section_bytes(elf.section(".rodata"))
[int.from_bytes(rodata[i : i + 4], "little") for i in range(0x14, 0x28, 4)]
[int.from_bytes(rodata[i : i + 8], "little") for i in range(0x28, 0x50, 8)]
[r for r in elf.relocations_for(".text") if r.symbol == ".rodata"]
```

Both tables read `1, 2, 3, 4, 4`. Check them against `ledger.c`: `grade(65)` computes `65 / 10 - 6 = 0` and reads entry 0, which is 1, the value of `case 6`. `grade(100)` reads entry 4, which is 4, the value shared by `case 10` and `case 9`.

### Lab C: three builds of one source

```python
for level in ("O0", "O1", "O2"):
    obj = ElfFile.from_path(FIXTURES / f"ledger-x86_64-{level}.o")
    print(level, [s.name for s in obj.sections if s.name in (".data", ".rodata")])
    print(level, sorted({r.type_name for r in obj.relocations}))
    print(level, {s.name: s.st_size for s in obj.symbols if s.type == "FUNC"})
```

The -O0 object has a `.data` section and three relocation types. The -O1 and -O2 objects have no `.data` and one type. `total` is 66 bytes at -O0, 31 at -O1, and 140 at -O2.

### Lab D: the same function in Mach-O

```python
from main import MachOFile
macho = MachOFile.from_path(FIXTURES / "ledger-arm64-O1.o")
[(c.name, c.cmdsize) for c in macho.load_commands]
macho.function_span("_percent_change")
macho.function_bytes("_percent_change")[:4].hex()
```

The span is 24 bytes at file offset 648. The first four bytes are `a0000034`, the little-endian form of the instruction `0x340000a0`, which `llvm-objdump -d` prints as `cbz w0, 0x14`. That is the `before == 0` guard, the same test that the x86-64 build encodes as `85 ff 74 09`.

## Practice Lab

Extend the reader to a linked program. On a Linux x86-64 machine, build `clang -O1 -shared -fPIC code/fixtures/ledger.c -o libledger.so` and `clang -O1 code/fixtures/ledger.c -o ledger_main` with a `main` you add, then run the reader on both.

Requirements:

- Read `.dynsym` with the same `Elf64_Sym` layout, since `SHT_DYNSYM` is 11 and the record is unchanged.
- Read `.dynamic` as `Elf64_Dyn` records of `d_tag` and `d_val`, and name `DT_NEEDED`, `DT_STRTAB`, `DT_SYMTAB`, `DT_RELA`, and `DT_JMPREL` from the gABI "Dynamic Section" page.
- List the undefined symbols with `st_shndx` `SHN_UNDEF` as the imports, and the `R_X86_64_JUMP_SLOT` records in `.rela.plt` as the call sites that reach them.
- Map every `PT_LOAD` segment to the sections it contains, using the gABI rule that "an object file segment contains one or more sections".
- Prove with `address_to_file_offset` that every defined function's bytes in the shared object are the bytes `function_bytes` returns.
- Capture `llvm-objdump -h -t -r -p` and `llvm-objdump -T` text for both files into `code/fixtures/` and compare the reader against them in tests.

Success means the import list, the segment map, and every function range agree with the captured tool output, with no tool run during the tests.

## Graded Lab

Five questions about the fixtures of this lesson. Find each answer with the code you built, then write it into `code/lab_answers.json`. Write numbers as numbers or as hex strings such as `"0x40"`, and lists as JSON lists.

1. `t1`: e_shoff of ledger-x86_64-O1.o, as a number.
2. `t2`: st_size of percent_change in ledger-x86_64-O1.o.
3. `t3`: file offset of .text in ledger-x86_64-O1.o, as hex.
4. `t4`: relocation type names in ledger-x86_64-O0.o, sorted, as a list.
5. `t5`: the five int values at .rodata+0x14 in ledger-x86_64-O1.o, as a list.

Check your answers:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/lab.py
```

The checker computes each expected value from `code/main.py` on the committed fixtures. It prints `PASS`, `FAIL` or `TODO` for each task and a score, and it exits 0 only when all five pass. `python3 code/lab.py my-answers.json` checks another file. `code/tests/test_lab.py` proves that the checker accepts the right answers and rejects a wrong one.

### See it run

The [Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler) machine runs this lesson as its first two stations. The reel reads the header of the object file that holds `percent_change`, and the cabinet opens `.text` and reads the symbol. Switch Symbols off to see which facts the symbol table carried.

## Lesson Artifact

This lesson produces `outputs/skill-program-anatomy-elf-from-scratch.md`. Use it with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md. The skill turns a compiled object or executable the user built into a layout report. The report gives the file range of every structure, symbol, and relocation, checked against captured tool output.

## Verify It

Run the demo and the deterministic suite:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

The suite proves:

- every section index, name, size, address, and kind matches the captured `llvm-objdump -h` text for the three x86-64 objects and the tiny executable
- every symbol value, binding, type, section, size, and name matches the captured `llvm-objdump -t` text
- every relocation offset, type name, symbol, and addend matches the captured `llvm-objdump -r` text, including `R_X86_64_PLT32` and `R_X86_64_64` at -O0
- both program headers of `tiny-x86_64` match the captured `llvm-objdump -p` text, and the objects have none
- `percent_change` is 16 bytes at file offset `0x40` with the expected bytes, and every function lies inside `.text`
- the file offset map covers every byte of every fixture once, with the three alignment gaps of the -O1 object in their places
- the entry point of `tiny-x86_64` maps to file offset `0xb0` through `PT_LOAD`, and a relocatable object refuses address mapping
- the Mach-O header, every load command, the segment, the five sections, `LC_SYMTAB`, and `LC_BUILD_VERSION` match the captured `--private-headers` text
- the Mach-O symbols and the 15 relocations match the captured `llvm-objdump` text, and `_percent_change` is 24 bytes at offset 648
- a wrong magic, a 32-bit class, a big-endian file, a truncated table, a universal binary, and a C source file all raise `FormatError`
- `build_tiny_elf.py` reproduces the committed `tiny-x86_64` byte for byte
- the figure module `site/figures-re-32.js` carries the exact bytes of `ledger-x86_64-O1.o`

## Production Failure Modes

| Failure | What the weak reading reports | What the reader must prove |
|---|---|---|
| `st_value` used as a file offset | "`percent_change` is at 0" | Offset is `sh_offset + st_value - sh_addr`, here `0x40` |
| Padding counted as code | "`grade` is 48 bytes" | `st_size` is 46 and the `66 90` after it belongs to no symbol |
| Section names read from the wrong table | Garbage names or an exception | `e_shstrndx` names the table, here section 1 |
| `sh_size` trusted for `SHT_NOBITS` | A read past the end of the file | `.bss` has no file bytes and the map skips it |
| Zero bytes read as the operand | "`lea 0(%rip)`" | The `.rela.text` record at `0x36` names `.rodata+0x10` |
| Addend read as the target offset | "the table starts at `0x10`" | `S + A - P` with the instruction end gives `0x14` |
| Sections walked on a stripped executable | "the file has no code" | `PT_LOAD` maps every address the loader uses |
| A linked address treated as a runtime address | A wrong offset under a random base | The file offset from `PT_LOAD` is the stable coordinate |
| A Mach-O section looked up by `sectname` alone | Two `__const` sections collapse into one | `segname,sectname` is the name |
| A size field expected in `nlist_64` | An exception or zero bytes | The next symbol in the same section ends the function |
| A universal binary read as one Mach-O | "magic `0xcafebabe` is unknown" | Refuse it and ask for a thinned slice |
| The arm64 object rebuilt on another Mac | "the fixture changed" | `LC_BUILD_VERSION` records the SDK, so the committed bytes are the fixture |

## Operational Rule

Read the header you can trust, follow the offsets it holds, and name every field from the specification that defines it. Keep the tool output you compared against as a committed fixture, so the comparison runs without the tool. When a value has no name in the specification, print the number. The reader you can check byte by byte is the one that every later lesson builds on.

## Further Reading

- [System V gABI, chapter 4: Object Files](https://www.sco.com/developers/gabi/latest/ch4.intro.html) and the [ELF Header](https://www.sco.com/developers/gabi/latest/ch4.eheader.html), [Sections](https://www.sco.com/developers/gabi/latest/ch4.sheader.html), [Symbol Table](https://www.sco.com/developers/gabi/latest/ch4.symtab.html), and [Relocation](https://www.sco.com/developers/gabi/latest/ch4.reloc.html) pages
- [System V gABI, chapter 5: Program Header](https://www.sco.com/developers/gabi/latest/ch5.pheader.html) and [Dynamic Linking](https://www.sco.com/developers/gabi/latest/ch5.dynamic.html)
- [System V ABI, AMD64 Architecture Processor Supplement](https://gitlab.com/x86-psABIs/x86-64-ABI), Table 4.9 Relocation Types
- [Apple XNU `loader.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h), [`nlist.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/nlist.h), and [`reloc.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/reloc.h)
- [17 U.S.C. 1201](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section1201&num=0&edition=prelim) and [Directive 2009/24/EC](https://eur-lex.europa.eu/eli/dir/2009/24/oj/eng)
- [Sega v. Accolade, 977 F.2d 1510](https://law.resource.org/pub/us/case/reporter/F2/977/977.F2d.1510.92-15655.html) and [Sony v. Connectix, 203 F.3d 596](https://law.resource.org/pub/us/case/reporter/F3/203/203.F3d.596.99-15852.html)
- [rea 6.5.0 `docs/binary-diagnostics.md`](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/binary-diagnostics.md) and [`docs/ghidra-provider.md`](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/ghidra-provider.md)
