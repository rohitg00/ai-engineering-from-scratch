# Evidence: cheatsheets/re-from-scratch-tools.md

Abbreviations: P13 = phases/13-tools-and-protocols. D32 = P13/32-program-anatomy-elf-from-scratch/docs/en.md, M32 = P13/32-program-anatomy-elf-from-scratch/code/main.py, D33 = P13/33-disassembly-and-control-flow/docs/en.md, D34 = P13/34-lifting-to-pseudocode/docs/en.md. BI = projects/binary-inspector, MD = projects/mini-decompiler.

## From bytes to checked C (architecture)
- Object file from ledger.c built by clang: D32:21, D32:219, D32:306
- ELF reader: sections, symbols, rela: D32:292-300
- Decoder: REX, ModRM, SIB: D33:47-67, D33:380-381
- CFG: blocks, dominators: D33:186-268, D33:385
- Lifter: IR, flags variable: D34:145, D34:165-167
- SSA: phi and rename: D34:206
- Simplify: substitute, dead code: D34:235, D34:248
- Structure: if, while, do while: D34:291-303
- Edges: bytes to ELF reader, function bytes to decoder (D32:304), stage order: D34:448-456, MD/README.md:72-79

## Run the lessons (command-table)
- python3 code/main.py in lesson 32: D32:277-280
- python3 code/main.py with a path, picks ELF or Mach-O: D32:288
- python3 code/main.py in lesson 33, one JSON report: D33:349-352
- disasm FILE.o listing with relocation targets: D33:388
- cfg FILE.o FUNCTION, analysis of one function: D33:388
- python3 code/main.py in lesson 34, IR, SSA, Ghidra text: D34:431-434
- python3 -m unittest discover -s code/tests -v: D32:394, D34:547
- python3 code/tests/test_main.py: D33:485

## ELF64 record formats (task-table)
- "<HHIQQQIHHHHHH" at offset 16: D32:75, D32:326
- Elf64_Shdr 64 bytes, <IIQQQQIIQQ: D32:82
- Elf64_Sym 24 bytes, <IBBHQQ: D32:131
- Elf64_Rela 24 bytes, <QQq: D32:164
- Elf64_Phdr 56 bytes, <IIQQQQQQ: D32:199
- ELF64_R_SYM(i) is i >> 32: D32:164
- ELF64_R_TYPE(i) is i & 0xffffffff: D32:164
- nlist_64 16 bytes with no size field: D32:249, D32:251

## Address arithmetic (concepts)
- sh_offset + st_value - sh_addr, length st_size: D32:152
- R_X86_64_PC32 is S + A - P: D32:164, D33:71
- R_X86_64_64 is S + A, R_X86_64_PLT32 is L + A - P: D32:164
- .rodata+0x10 on the lea means .rodata+0x14: D33:73
- p_offset + (address - p_vaddr): D32:211
- Mach-O size from the next symbol in the same section: D32:251, D32:425
- 0x66666667 with shift 34, error 6, at most 8: D34:262

## Read an object in Python (annotated-code)
- import ElfFile, MachOFile, FIXTURES: D32:323, D32:359
- ElfFile.from_path(FIXTURES / "ledger-x86_64-O1.o"): M32:876
- e_shoff 0x428 (1064) and 11 headers: D32:70, D32:328, D32:331
- function_span: M32:377, 16 bytes at 0x40: D32:403
- function_bytes, 85 ff 74 09: M32:389, D32:160, D32:283
- relocations_for(".text"), 3 records: D32:304, D32:266
- file_offset_map, three gaps of alignment: M32:407, D32:125
- tiny ElfFile.from_path(FIXTURES / "tiny-x86_64"): M32:878
- address_to_file_offset(0x4000b0) gives 0xb0 through PT_LOAD: M32:393, M32:887, D32:208
- MachOFile.from_path and function_span("_percent_change"), 24 bytes at 648: D32:360-366

## Sweep or descent: grade at -O0 (comparison)
- Instructions 34, 25, 33: D33:307-309
- Blocks 9, 3, 8: D33:307-309
- Edges 7, 2, 11: D33:307-309
- Failure per method, unresolved jmpq *%rax: D33:307-309
- Use: oracle agreement (D33:117), which bytes run (D33:184), full CFG (D33:309, D33:398)

## Analyze a new object (flow)
1. Oracle comparison with llvm-objdump first: D33:394
2. Descent from every function symbol, read unresolved: D33:395
3. Table idiom and relocation for each unresolved jump: D33:396
4. Bytes only the sweep claims are padding or data: D33:397
5. CFG with recovered tables, back edges are loops: D33:398

## Instruction to IR (command-table)
- testl %edi, %edi: D34:152
- je 0xd: D34:153
- xorl %eax, %eax: D34:154
- cltd: D34:155
- movslq %edi, %rax: D34:157
- sarq $0x22, %rcx: D34:158
- pushq %rbp and frame moves produce nothing: D34:162
- retq returns rax: D34:163

## Failures and fixes (troubleshooting)
- percent_change at 0, st_value as offset: D32:416
- grade is 48 bytes, padding 66 90: D32:417
- table starts at 0x10, addend: D32:421
- Plausible listing over data: D33:517
- jmp rax and dead blocks: D33:519
- Third parameter, idivl writes %rdx: D34:575, D34:198-202

## The two projects (comparison)
- Builds: BI/README.md:3, MD/README.md:3
- Input: BI/README.md:5, MD/README.md:60
- Output: BI/README.md:5, MD/README.md:41
- Run: BI/README.md:27, BI/API.md:77, MD/README.md:24, MD/README.md:38
- Check: BI/README.md:5, MD/README.md:3
- Exit: BI/API.md:81, MD/README.md:41

## Project commands (command-table)
- --init, stage 1 fails on purpose: BI/README.md:15-18, MD/README.md:11-14
- --all --path --strict cumulative grader: BI/README.md:25, MD/README.md:21
- inspect with --truth and --html: BI/README.md:27, BI/API.md:77
- diff with --json, section growth: BI/README.md:28, BI/API.md:85
- decompile --ir --no-division-idioms: MD/solution/minidec/cli.py:102, MD/solution/minidec/cli.py:104
- verify --source --opt O1 --out: MD/README.md:38, MD/solution/minidec/cli.py:109-111

## Questions (qa)
- Oracle is a linear sweep: D33:117, D33:184
- Back edge target dominates source: D33:268
- do while when the header has the back edge: D34:303
- grade at -O1 every case returns a constant: D32:195
- Behaviour pass covers the declared grid on one host: MD/README.md:62
