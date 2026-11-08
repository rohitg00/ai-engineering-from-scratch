---
id: re-from-scratch-tools
title: Binary Analysis Tools from Scratch
code: BA
subtitle: Read ELF and Mach-O, decode x86-64, build the CFG, lift to C and prove it. Python stdlib only.
hue: 28
sources: phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch, phases/13-tools-and-protocols/33-disassembly-and-control-flow, phases/13-tools-and-protocols/34-lifting-to-pseudocode, projects/binary-inspector, projects/mini-decompiler
source_hash: 41d66339fce016da
---

## From bytes to checked C
type: architecture
from: phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md, phases/13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md, phases/13-tools-and-protocols/34-lifting-to-pseudocode/docs/en.md, projects/mini-decompiler/README.md

```arch
node | obj | 1,1 | Object file | ledger.c built by clang | store
node | elf | 2,1 | ELF reader | sections, symbols, rela | process
node | dec | 3,1 | Decoder | REX, ModRM, SIB | process
node | cfg | 4,1 | CFG | blocks, dominators | process
node | ir | 4,2 | Lifter | IR, flags variable | process
node | ssa | 3,2 | SSA | phi, rename | process
node | opt | 2,2 | Simplify | substitute, dead code | process
node | c | 1,2 | Structure | if, while, do while | model
edge | obj | elf | bytes
edge | elf | dec | function bytes
edge | dec | cfg | instructions
edge | cfg | ir |
edge | ir | ssa |
edge | ssa | opt |
edge | opt | c | C text
```

## Run the lessons
type: command-table
from: phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md, phases/13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md, phases/13-tools-and-protocols/34-lifting-to-pseudocode/docs/en.md

| Command | What it does |
|---|---|
| `python3 code/main.py` (32) | Header, sections, symbols, relocations, map |
| `python3 code/main.py <object>` (32) | Reads one file. Picks ELF or Mach-O |
| `python3 code/main.py` (33) | One JSON report for every fixture |
| `python3 code/main.py disasm <object>` | Listing with relocation targets |
| `python3 code/main.py cfg <object> <function>` | Analysis of one function |
| `python3 code/main.py` (34) | IR, SSA, pseudocode next to Ghidra |
| `python3 -m unittest discover -s code/tests -v` | Test suite of lessons 32 and 34 |
| `python3 code/tests/test_main.py` | Test suite of lesson 33 |

## ELF64 record formats
type: task-table
from: phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md

| Task | Code |
|---|---|
| Header after e_ident, offset 16 | `"<HHIQQQIHHHHHH"` |
| Section header, 64 bytes | `<IIQQQQIIQQ` |
| Symbol, 24 bytes | `<IBBHQQ` |
| Rela record, 24 bytes | `<QQq` |
| Program header, 56 bytes | `<IIQQQQQQ` |
| Symbol index of r_info | `ELF64_R_SYM(i)` is `i >> 32` |
| Type of r_info | `ELF64_R_TYPE(i)` is `i & 0xffffffff` |
| Mach-O symbol, 16 bytes | `nlist_64` has no size field |

## Address arithmetic
type: concepts
from: phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md, phases/13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md, phases/13-tools-and-protocols/34-lifting-to-pseudocode/docs/en.md

- **Function bytes**: file offset is `sh_offset + st_value - sh_addr`. Length is `st_size`.
- **R_X86_64_PC32**: the linker writes `S + A - P` into the field.
- **R_X86_64_64**: `S + A`. **R_X86_64_PLT32**: `L + A - P`.
- **RIP target**: addend plus 4. `.rodata+0x10` on a `lea` means `.rodata+0x14`.
- **PT_LOAD**: file offset is `p_offset + (address - p_vaddr)`.
- **Mach-O size**: next symbol in the same section minus this one.
- **Divide by 10**: `0x66666667` with shift 34. The error 6 is at most 8.

## Read an object in Python
type: annotated-code
lang: python
from: phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md, phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/code/main.py

```python
from main import ElfFile, MachOFile, FIXTURES
elf = ElfFile.from_path(FIXTURES / "ledger-x86_64-O1.o")
elf.header.e_shoff, elf.header.e_shnum      # 0x428 and 11 headers
elf.function_span("percent_change")         # 16 bytes at 0x40
elf.function_bytes("percent_change")        # 85 ff 74 09 ...
elf.relocations_for(".text")                # 3 R_X86_64_PC32 records
elf.file_offset_map()                       # 3 gaps of alignment
tiny = ElfFile.from_path(FIXTURES / "tiny-x86_64")
tiny.address_to_file_offset(0x4000b0)       # 0xb0 through PT_LOAD
macho = MachOFile.from_path(FIXTURES / "ledger-arm64-O1.o")
macho.function_span("_percent_change")      # 24 bytes at 648
```

## Sweep or descent: grade at -O0
type: comparison
from: phases/13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md

| Factor | Linear sweep | Recursive descent | Descent with table |
|---|---|---|---|
| Instructions | 34 | 25 | 33 |
| Blocks | 9 | 3 | 8 |
| Edges | 7 | 2 | 11 |
| Failure | data decoded as code | stops at `jmpq *%rax` | nothing |
| Use it for | oracle agreement | which bytes run | the full CFG |

## Analyze a new object
type: flow
from: phases/13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md

1. **Oracle**: compare the decoder with `llvm-objdump -d` first.
2. **Descent**: walk from every function symbol. Read `unresolved`.
3. **Tables**: match the table idiom and its relocation for each indirect jump.
4. **Bytes**: bytes that only the sweep claims are padding or data.
5. **CFG**: build it with recovered tables. Each back edge is a loop.

## Instruction to IR
type: command-table
from: phases/13-tools-and-protocols/34-lifting-to-pseudocode/docs/en.md

| Command | What it does |
|---|---|
| `testl %edi, %edi` | `flags = test(edi, edi)` |
| `je 0xd` | `if je(flags) goto 0xd else goto 0x4` |
| `xorl %eax, %eax` | `eax = 0` |
| `cltd` | `edx = signfill(eax)` |
| `movslq %edi, %rax` | `rax = sext64(edi)` |
| `sarq $0x22, %rcx` | `rcx = rcx >>s 34` |
| `pushq %rbp` and frame moves | nothing, frame bookkeeping |
| `retq` | `return rax` |

## Failures and fixes
type: troubleshooting
span: 2
from: phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md, phases/13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md, phases/13-tools-and-protocols/34-lifting-to-pseudocode/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| "`percent_change` is at 0" | `st_value` used as a file offset | Use `sh_offset + st_value - sh_addr`, here `0x40` |
| "`grade` is 48 bytes" | Padding `66 90` counted as code | `st_size` is 46. Padding belongs to no symbol |
| "the table starts at `0x10`" | Addend read as the target offset | Add the 4 bytes to the instruction end: `0x14` |
| A plausible listing over a data table | Linear sweep decodes data as code | Descent from the symbol claims no data byte |
| "jmp rax" and dead blocks | Indirect jump with no table | Read targets from `.rela.rodata` and the bounds check |
| Decompiler reports a third parameter | `idivl` writes `%rdx` and the return width is a guess | Read before write on an argument register is a parameter |

## The two projects
type: comparison
span: 2
from: projects/binary-inspector/README.md, projects/binary-inspector/API.md, projects/mini-decompiler/README.md

| Factor | binary-inspector | mini-decompiler |
|---|---|---|
| Builds | Static inspector for ELF, PE/COFF, Mach-O | Decompiler for an x86-64 subset |
| Input | ELF64 object, COFF object, PE32+ image, Mach-O 64 | ELF64 `ET_REL` object built by clang |
| Output | JSON report, HTML byte map, build diff | Structured C and `report.json` |
| Run | `python3 cli.py inspect <file> --json report.json` | `python3 -m minidec verify <object> --source <source>` |
| Check | Function starts scored with precision and recall | Masked bytes and a behaviour grid |
| Exit | 2 with `error: <message>` on a bad file | 0 on `pass` or `behaviour-only`, else 1 |

## Project commands
type: command-table
span: 2
from: projects/binary-inspector/README.md, projects/binary-inspector/API.md, projects/mini-decompiler/README.md, projects/mini-decompiler/solution/minidec/cli.py

| Command | What it does |
|---|---|
| `python3 scripts/project_test.py <project> --init learning-artifacts/<project>` | Makes the workspace. Stage 1 fails on purpose |
| `python3 scripts/project_test.py <project> --all --path learning-artifacts/<project> --strict` | Runs the cumulative grader |
| `python3 cli.py inspect <stripped> --truth <unstripped> --html report.html` | Scores function starts against the unstripped build |
| `python3 cli.py diff <old> <new> --json diff.json` | Section growth, moved symbols, changed imports |
| `python3 -m minidec decompile <object> --ir --no-division-idioms` | Shows IR and SSA, keeps the magic multiply |
| `python3 -m minidec verify <object> --source <source> --opt O1 --out <dir>` | Recompiles, compares bytes, runs the grid |

## Questions
type: qa
from: phases/13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md, phases/13-tools-and-protocols/34-lifting-to-pseudocode/docs/en.md, phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md, projects/mini-decompiler/README.md

- **Why does the oracle agree with the sweep on the trap?** `llvm-objdump` is a linear sweep too.
- **When is an edge a back edge?** Its target dominates its source. It marks a loop.
- **Why `do while` in `total` at -O1?** The header is also the block with the back edge.
- **Why no jump table in `grade` at -O1?** Every case returns a constant. A value table replaced the jumps.
- **Does a behaviour pass prove equivalence?** No. It covers the declared grid on one host.
