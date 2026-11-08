# The Reverse Engineering Landscape: History, Tool Families, and How a Decompiler Is Built

> Five tools read the same object and give four addresses, three block counts, and two answers for one switch, and this lesson builds the harness that shows which is which.

**Type:** Build
**Languages:** Python, C, x86-64 assembly, Java (one Ghidra script)
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~150 minutes

## Learning Objectives

- Place the main tools of the field on a dated timeline from 1973 to 2026 and name the family each one belongs to.
- Name the eight stages of a decompiler and the term that Ghidra, Binary Ninja, Hex-Rays, radare2, rizin, and angr use for each stage.
- Lift one instruction into ESIL, RzIL, P-code, and VEX and explain which of them write flags eagerly and which store a thunk.
- Reduce the addresses of five tools to one `.text` offset and prove the reduction on one function.
- Build a comparison harness that reads captured tool outputs and reports agreement on instruction starts, blocks, edges, and function starts.
- Name, from captured evidence, where each tool invents code, misses code, or stops at an indirect jump.

## The Problem

You ask an agent to summarise what three reverse engineering tools say about `grade` in `ledger-x86_64-O1.o`. The agent runs each tool, reads three listings, and reports that the function sits at `0x08000050` in one tool, `0x400010` in another, and `0x100010` in the third. It concludes that the tools disagree about where the function is.

The tools agree. The object is relocatable and has no load address, so each tool chooses one. Subtract the address each tool gave `.text` and every answer is `0x10`. The agent compared raw addresses because nothing told it what the address meant in each tool.

Later the same agent reads `grade` in the `-O0` build and reports 3, 8, 8, and 9 basic blocks from four tools. All four numbers are real. One tool stopped at `jmp rax`. Two tools read the jump table through its relocations. One tool split a block at the jump to place a label. A block count without the reason behind it is a number without a claim.

This lesson is the map you need before you trust any of those numbers. Lessons 32 to 36 built one decoder, one lifter, one evidence record, and one rebuild. The second half of the track puts them next to the tools people use. To do that you need the history of the field, the families the tools fall into, the pipeline every decompiler runs, and a harness that compares what the tools say on objects you compiled yourself.

```figure
re-37-field-map
```

## Fifty-Three Years in Dated Steps

The field is older than most of its tools. Each date below has a primary source in Further Reading.

### 1973 to 1991: debuggers first, then disassemblers

The first decompilation theses are from 1973. Hollander at Stanford and Housel at Purdue wrote them, and both are known today through citations. The practical tools of the period were debuggers. Maranzano and Bourne wrote the `adb` tutorial at Bell Labs in 1977, and the debugger shipped with UNIX V7 in 1979. Tim Paterson's `DEBUG`, with an 8086 disassembler, shipped in PC-DOS 1.00 in August 1981. Richard Stallman's GDB entered distribution in 1986. SoftICE put a kernel debugger under DOS in 1987.

Batch disassemblers came next. Sourcer, from V Communications in 1988, ran multiple passes over a DOS program and wrote a commented listing. GNU binutils began with unnumbered snapshots in 1988, and `objdump` carries a 1990 copyright. Ilfak Guilfanov wrote the first line of IDA in January 1991 and released IDA 0.1 as shareware on 20 May 1991.

### 1991 to 2009: interactive disassemblers and the first decompilers

Cristina Cifuentes finished "Reverse Compilation Techniques" at QUT in July 1994. Her decompiler, `dcc`, took i80286 DOS programs to C, and her 1995 paper with Gough set the phases that every later decompiler kept. REC followed in 1997 and Boomerang in 2002, the first open-source decompiler, under a BSD licence.

IDA became a commercial product at DataRescue in 1996, gained a plugin SDK in 1999, and moved to Hex-Rays, founded in 2005. The Hex-Rays Decompiler 1.0 shipped on 17 September 2007. In the same year Mike Van Emmerik submitted "Static Single Assignment for Decompilation", the thesis that put SSA at the centre of decompiler data flow. Halvar Flake's "Structural Comparison of Executable Objects" (2004) started the diffing family, and BinDiff went on sale in August 2004.

radare started in February 2006 as a forensic hex editor with 64-bit offsets. radare2, the modular rewrite under LGPL-3.0, had its first release on 7 March 2009.

### 2009 to 2019: frameworks and intermediate representations

LLDB was announced as an LLVM subproject on 8 June 2010. BAP, the Binary Analysis Platform with its BIL intermediate language, appeared at CAV 2011. Google acquired zynamics, the makers of BinDiff, on 1 March 2011. Hopper appeared on the Mac App Store around the end of 2011. Matt Godbolt started Compiler Explorer in 2012 so that a C++ programmer could see the assembly a compiler produced.

angr received its first line of code in August 2013. The Phoenix paper (Schwartz, Lee, Woo, Brumley, USENIX Security 2013) showed semantics-preserving structuring with 40 `goto` statements across 8,676 functions. DREAM (Yakdan and others, NDSS 2015) removed the `goto` statements with pattern-independent structuring. Vector 35 was founded on 14 January 2015, and Binary Ninja went on sale on 23 July 2016 with its Low Level IL and a Python API. angr was released publicly in 2015 and placed third at the DARPA Cyber Grand Challenge in August 2016. BinDiff became free of charge in March 2016. Cutter 1.0 gave radare2 a Qt GUI in December 2017. In 2018 Guilfanov presented "Decompiler internals: microcode" at Recon, the first public description of the Hex-Rays IR.

### 2019 to 2026: open decompilers and the research turn

Ghidra 9.0 was released by the NSA at the RSA Conference on 5 March 2019 under Apache-2.0, with full source on GitHub a month later. angr 8.19.2.4 added a preliminary decompiler the same year. Binary Ninja 2.0 shipped its High Level IL decompiler on 20 May 2020. Rizin was announced as a fork of radare2 on 8 December 2020, and the Cutter team moved to it. IDA Freeware 7.6 added a cloud x64 decompiler in May 2021.

BinDiff 8 was open-sourced under Apache-2.0 on 25 September 2023. SAILR (Basque and others, USENIX Security 2024) became angr's default structurer and argued that only spurious `goto` statements should be removed, because Linux 6.1 has 3,754 of them in its source. Binary Ninja 4.0 added a Free edition in February 2024, and IDA 9.0 added `idalib` for headless use. The learned-decompiler papers run from SLaDe (2023) through LLM4Decompile (2024) to DecompileBench (2025) and two 2026 studies on agent-assisted readability and on decompilers that recompile more and preserve less.

The versions this lesson ran are the current ones on 14 October 2026: Ghidra 12.1.4 (21 September 2026), radare2 6.2.4 (5 October 2026), rizin 0.9.1 (29 June 2026), and angr 10.0.3 (10 October 2026). Binary Ninja 6.0 "Krypton" (3 September 2026) and IDA 9.4 (13 July 2026) are the current closed tools. This lesson did not run them.

## The Tool Families

A tool belongs to a family by what it produces. The families overlap in one program, and the overlap is where most confusion starts.

### Disassemblers

A linear sweep decodes from the first byte of a code section to the last. GNU `objdump -d` and `llvm-objdump -d` work this way, and neither builds a control-flow graph. GNU `objdump` treats symbols as instruction boundaries and sweeps between them. binutils 2.47 (26 July 2026) is GPL-3.0-or-later. LLVM 23.1.3 is Apache-2.0 with the LLVM exception. Apple's Command Line Tools ship `llvm-objdump` as "Apple LLVM version 17.0.0", and that is the copy this lesson captured.

An interactive disassembler runs recursive descent from known entries, adds heuristics for function starts, and keeps a database. IDA Pro (processor modules, autoanalysis queues, FLIRT signatures), Ghidra (`Disassembler` plus Auto Analysis analyzers), Binary Ninja (recursive descent, then linear sweep over unknown regions), Hopper, radare2 and rizin (`aa`, `aaa`, `af`), with Cutter and iaito as GUIs, are all in this family. Andriesse and others (USENIX Security 2016) measured nine of them on compiler-generated binaries. Instruction accuracy was close to 100 percent, and the hard primitive was function starts, with false negative rates of 20 percent or more.

### Decompilers

Commercial decompilers: the Hex-Rays Decompiler (twelve target families from x86 to RISC-V), Binary Ninja's HLIL with its Pseudo C rendering, and Hopper's pseudo-code view. Open decompilers: the Ghidra decompiler, a C++ engine under Apache-2.0 that r2ghidra and rz-ghidra reuse as a plugin and that pypcode reuses as a lifter; the angr decompiler on AIL with SAILR structuring under BSD-2-Clause; r2dec and jsdec in JavaScript; Boomerang and `dcc` as history. radare2 also has a built-in `pdc`, "pseudo disassembler output in C-like syntax". rizin has no built-in decompiler. The command `pdc` does not exist in rizin 0.9.1, and `pdg` needs the rz-ghidra plugin.

### Debuggers

GDB (1986) with the GEF and pwndbg front-ends, LLDB (2010), WinDbg with Time Travel Debugging (2017), OllyDbg (frozen in 2014), x64dbg (GPL-3.0, 2014), the Ghidra Debugger with its Python connectors, the Binary Ninja debugger, and the built-in debuggers of radare2 and rizin. Lesson 42 uses two of them on your own builds.

### Binary analysis frameworks

angr (VEX IR, symbolic execution, `CFGFast` and `CFGEmulated`, decompiler), BAP (BIL, OCaml), Dyninst, Jakstab, and ByteWeight are the frameworks that Andriesse named. Ghidra is a library through PyGhidra, Binary Ninja through `import binaryninja`, and IDA through `idalib`.

### Format and engine libraries

LIEF 1.0.0 (12 July 2026, Apache-2.0) parses ELF, PE, Mach-O, COFF, and the Android formats. CLE, "CLE Loads Everything", is angr's loader. Capstone 5.0.9 (28 May 2026, BSD-3-Clause) decodes; Keystone 0.9.2 (GPL-2.0) assembles; Unicorn 2.1.4 (GPL-2.0) emulates. radare2 6.2.4 bundles Capstone 5, and rizin 0.9.1 vendors Capstone, Zydis, and tree-sitter.

### Diffing tools and compiler-side viewers

BinDiff 8 (Apache-2.0) with its BinExport 12 plugin for IDA Pro, Binary Ninja, and Ghidra; Diaphora 3.4.3 (11 October 2026, AGPL-3.0) as an IDA plugin; `radiff2` and `rz-diff`. Compiler Explorer (BSD-2-Clause) shows the assembly a compiler emits for a source fragment, which is the forward direction of everything else in this list. Lesson 44 uses the diffing family.

### Versions, licences, and what this lesson ran

| Tool | Version read on 2026-10-14 | Licence | Headless entry | Ran here |
|---|---|---|---|---|
| Ghidra | 12.1.4 | Apache-2.0 | `analyzeHeadless`, `pyghidra.start()` | yes, on all four objects |
| radare2 | 6.2.4 | LGPL-3.0 | `r2 -qc '<cmds>' file`, `rabin2` | yes |
| rizin | 0.9.1 | LGPL-3.0 | `rizin -qc '<cmds>' file`, `rz-bin` | yes |
| angr | 10.0.3 | BSD-2-Clause | `angr.Project` in Python | yes |
| llvm-objdump | Apple LLVM 17.0.0 | Apache-2.0 with LLVM exception | `llvm-objdump -d -r` | yes |
| Binary Ninja | 6.0 "Krypton" | commercial; Free edition for non-commercial use | `binaryninja.load()` with a Commercial, Ultimate, or headless licence | no, documentation only |
| IDA Pro | 9.4 | commercial subscription; IDA Free for non-commercial x86 and x86-64 | `idat`, `ida -A -S`, `idalib` | no, documentation only |
| Hopper | 6.6.0 | commercial, perpetual | none documented | no, documentation only |
| Cutter | 2.5.0 | GPL-3.0 | GUI over rizin | no |

The Free edition of Binary Ninja decompiles x86, x86-64, ARMv7, and AArch64 only and has no API. IDA Free has no IDAPython, no SDK, and no `idalib`, and its decompiler runs in the cloud. Every statement about those two tools in this lesson comes from their documentation and release notes, and the figure marks them as not run.

## The Decompiler Pipeline, Stage by Stage

Cifuentes named the phases in 1994: syntax analysis, semantic analysis, intermediate code generation, control-flow graph generation, data-flow analysis, control-flow analysis, and code generation. She split them into a machine-dependent front end, a machine- and language-independent middle, and a language-dependent back end. Every decompiler since keeps that shape and renames the parts. The table below gives the eight stages this lesson uses and the name each tool gives them. The figure shows the same table with the tool columns selectable.

| Stage | Ghidra | Binary Ninja | Hex-Rays / IDA | radare2 | rizin | angr |
|---|---|---|---|---|---|---|
| Loader | `ElfLoader`, `MachoLoader`, `PeLoader`; `.ldefs` picks the language | `BinaryView`, `BinaryViewType` | loader module (`LDSC`) | RBin (`rabin2`) | RzBin (`rz-bin`) | CLE (`cle.Loader`, `main_object`) |
| Disassembly | `Disassembler`; SLEIGH `.slaspec` compiled to `.sla`; analyzers "Disassemble Entry Points", "Function Start Search" | architecture plugin; Recursive Descent, then linear sweep phases | processor module (`ana.cpp`, `emu.cpp`, `out.cpp`); autoanalysis queues; FLIRT | RArch plugin to `RAnalOp`; `aa`, `aaa`, `af` | RzAnalysis plugin; `aa`, `aaa`, `af` | Capstone blocks; `CFGFast` function start search |
| CFG recovery | "Generate Basic Blocks and the CFG"; `BlockGraph`; "Decompiler Switch Analysis" | `Function`, `BasicBlock`; "Control Flow Graph (CFG) Analysis" phase | `mbl_graph_t`, ready at `MMAT_LOCOPT` | `afb`, `agf`, `aab` | `afb`, `agf`, `aab` (Nucleus) | `CFGFast`, `CFGEmulated`; `kb.functions`; IRSB |
| Lifting | "Generate Raw P-code"; Varnodes in `ram`, `register`, `const`, `unique` | Lifted IL, LLIL, Mapped MLIL, MLIL | microcode (`minsn_t`, `mop_t`); `MMAT_GENERATED` | ESIL (`asm.esil`, `ae`) | RzIL (`aoi`, `aez`) | VEX (`pyvex.lift`, IRSB), then AIL |
| SSA | `Heritage`, `ActionHeritage`; `MULTIEQUAL`, `INDIRECT` | LLIL SSA, MLIL SSA, HLIL SSA; `HLIL_VAR_PHI` | no named SSA; use-def data flow in `MMAT_GLBOPT1` to `3` | none; ESIL is built for emulation | none; RzIL is built for emulation | `_stage_transform_to_ssa_level0` and `level1`; `SeqNodeDephication` |
| Data flow and types | `ActionDeadCode`, `ActionInferTypes`, the `Rule` pool; prototype from `.cspec` | MLIL constant propagation, variables and types; `analyzeReturns` | "Transform microcode"; `MMAT_CALLS`, `MMAT_GLBOPT`, `MMAT_LVARS`; TIL | `afv`, `afc`, `aaft`; ESIL emulation | `afv`, `afc`, `aft` | `CallingConventionAnalysis`, `VariableRecoveryFast`, `Typehoon` |
| Structuring | `CollapseStructure`; `BlockIf`, `BlockWhileDo`, `BlockSwitch`, `BlockGoto` | `HLIL_IF`, `HLIL_WHILE`, `HLIL_SWITCH`; AST at `root` | "Generate ctree"; structural analysis; goto regions | `pdc`; `pdd` (r2dec); `pdg` (r2ghidra) | `pdg` (rz-ghidra); jsdec | `RegionIdentifier`; `RecursiveStructurer` with `SAILRStructurer` |
| Emission | "Emit Final C Tokens"; `PrintC`, `ActionNameVars`, `ActionSetCasts` | HLIL rendering; Pseudo C, Pseudo Rust, Pseudo Python | "Beautify ctree; Print ctree"; `cfunc_t` | text of `pdc`, `pdd`, `pdg` | `pdg` text | `CStructuredCodeGenerator`; `codegen.text` |

### Loader

The loader parses the container, maps sections, and reads symbols and relocations. In a relocatable object nothing has an address yet, so the loader picks one. radare2 and rizin map the file at `0x08000000`, which puts `.text` at `0x08000040` because the section starts at file offset `0x40`. CLE places `.text` at `0x400000`. Ghidra's `ElfLoader` places it at `0x100000`. `llvm-objdump` prints section offsets and no base at all.

The loaders also differ on relocations. Ghidra processes them on import, and CLE applies them. radare2 prints a hint when it opens the object: relocations were not applied, and `bin.relocs.apply=true` changes that. What a loader does with relocations decides what every later stage can see, and you will meet the effect in the `-O0` jump table below.

### Disassembly

Lesson 33 built both methods. Every tool in the table except `llvm-objdump` runs recursive descent and then adds a search for function starts. Binary Ninja's documentation names the phases in order: Recursive Descent, Call Target Analysis, CFG Analysis as "linear disassembly of the unknown regions", and Tail Call Analysis. Ghidra runs its analyzers by priority, with "Disassemble Entry Points" and "Function Start Search" early. IDA keeps autoanalysis queues, each with a priority, and FLIRT signatures for library code. angr's `CFGFast` documents four sources of function starts: symbols, a prologue scan, call targets, and a complete scan of the remaining bytes. That last source is where angr invents functions at padding.

### CFG recovery

Each tool cuts blocks the way lesson 33 did, with one difference you will measure. angr ends a block at a `call`, because its IRSB is a single-entry, multiple-exit block and a call is an exit. Ghidra, radare2, and rizin run through a call. On `grade_label` at `-O0`, which calls `grade`, angr reports 2 blocks and the other three report 1. The instructions are the same.

### Lifting

Binary Ninja defines lifting as "translating from a lower level language to an intermediate language considered higher". The IRs differ in what they are for. P-code and VEX were built for analysis and decompilation. ESIL and RzIL were built for emulation, and neither has an SSA stage. Hex-Rays microcode starts as RISC-like code with 72 opcodes and passes through maturity levels from `MMAT_GENERATED` to `MMAT_LVARS`. Binary Ninja lifts to Lifted IL, then folds flags into conditions in LLIL, and MLIL "translates registers and memory accesses into variables". The next section puts four of these IRs side by side on one instruction.

### SSA

Van Emmerik's thesis lists what SSA buys a decompiler: expression propagation, parameter and return identification without an ABI assumption, preservation analysis, type analysis as a sparse data-flow problem, and the analysis of indirect jumps and calls. Ghidra calls its SSA construction `Heritage` and adds two operations that exist only in the graph, `MULTIEQUAL` for the phi and `INDIRECT` for side effects. Binary Ninja exposes an SSA form at every IL level. angr has two SSA stages inside `Clinic`. Hex-Rays does not name an SSA form and does use-def data flow in its global optimisation passes. ESIL and RzIL have none.

### Data flow and types

Ghidra's main simplification loop runs "Eliminate Dead Code", "Propagate Local Types", and "Perform Term Rewriting" until nothing changes, with the rewriting done by a pool of `Rule` objects. Hex-Rays transforms microcode, detects call arguments at `MMAT_CALLS`, and allocates local variables at `MMAT_LVARS`. angr runs `CallingConventionAnalysis`, `VariableRecoveryFast`, and `Typehoon`, an implementation of Noonan, Loginov, and Cok's polymorphic type inference. Lesson 41 is about this stage.

### Structuring

Ghidra's `CollapseStructure` searches for sub-graphs that match a structure, collapses them to one node, and when it gets stuck removes an edge and marks it unstructured. Hex-Rays reduces the CFG to `if`, `while`, `do`, and `switch` and leaves the rest as goto regions. angr identifies single-entry, single-exit regions and structures them with `SAILRStructurer` by default, with `PhoenixStructurer` and `DreamStructurer` as alternatives. Lesson 34 wrote one structurer by hand.

### Emission

Ghidra emits C tokens through `PrintC` with an Oppen pretty-printer after `ActionNameVars` and `ActionSetCasts`. Hex-Rays beautifies and prints the ctree. Binary Ninja renders HLIL as Pseudo C, Pseudo Rust, or Pseudo Python. angr returns `codegen.text`. radare2 prints `pdc`, `pdd`, or `pdg`.

## One Instruction in Four IRs

Take `48 83 ec 10`, `subq $0x10, %rsp`. Decode it on paper with the rules from lesson 33.

1. `48` is REX with `W = 1`. The operand is 64 bits.
2. `83` is the group-1 arithmetic opcode with an 8-bit immediate. The ModRM reg field picks the operation.
3. `ec` is ModRM `11 101 100`. `mod = 11` is the register form. `reg = 101` is `/5`, which is `sub`. `r/m = 100` is `%rsp`.
4. `10` is the immediate, 16.

Four lifters were given those four bytes. The fixtures hold the exact commands and the full text.

ESIL from radare2 6.2.4 is one comma-separated string of 30 tokens:

```text
16,0x8000000000000000,-,!,16,rsp,-=,63,$o,^,of,:=,63,$s,sf,:=,$z,zf,:=,$p,pf,:=,64,$b,cf,:=,4,$b,af,:=
```

It is a stack machine. `16,rsp,-=` subtracts in place. Every flag is then written with an internal operator: `$o` overflow, `$s` sign, `$z` zero, `$p` parity, `$b` borrow.

RzIL from rizin 0.9.1 is an S-expression with 14 `set` effects:

```text
(seq (set op1 (var rsp)) (set op2 (bv 64 0x10)) (set sub (- (var op1) (var op2))) (set rsp (var sub))
     (set _result (var sub)) (set pf (! (lsb (let _val (cast 8 false (var _result)) ...))))
     (set zf (is_zero (var _result))) (set sf (msb (var _result))) ... (set cf (|| ...)) (set of (|| ...)) (set af (|| ...)))
```

Every flag is a boolean expression over bitvectors. The parity flag alone is a four-level `let`.

P-code from the SLEIGH specification `x86:LE:64:default` through pypcode 4.0.1 is nine operations after the `IMARK`:

```text
CF = RSP < 0x10
OF = sborrow(RSP, 0x10)
RSP = RSP - 0x10
SF = RSP s< 0x0
ZF = RSP == 0x0
unique[58300:8] = RSP & 0xff
unique[58400:1] = popcount(unique[58300:8])
unique[58500:1] = unique[58400:1] & 0x1
PF = unique[58500:1] == 0x0
```

Register transfers with temporaries in the `unique` space. The flags are computed at the instruction, eagerly, and `CF` and `OF` are computed before the subtraction overwrites `RSP`.

VEX from pyvex 10.0.3 is seven statements after the `IMark`:

```text
t2 = GET:I64(offset=48)
t0 = Sub64(t2,0x0000000000000010)
PUT(offset=144) = 0x0000000000000008
PUT(offset=152) = t2
PUT(offset=160) = 0x0000000000000010
PUT(offset=168) = 0x0000000000000000
PUT(offset=48) = t0
```

No flag appears. VEX names registers by their offset in the guest state, and offset 48 is `rsp`. Offsets 144 to 168 are `cc_op`, `cc_dep1`, `cc_dep2`, and `cc_ndep`. The lifter stores the operation code 8, which is the 64-bit subtraction, and the two operands. A later branch that reads a flag computes it from the thunk. That is why `pcode.writesFlags` is true and `vex.computesFlags` is false in the harness report, and why VEX is the shortest of the four.

The same four lifters on `48 63 c7`, `movslq %edi, %rax`, the first instruction of `grade` at `-O1`, give 5 ESIL tokens (`32,edi,~,rax,=`), 1 RzIL `set`, 1 P-code operation (`RAX = sext(EDI)`), and 4 VEX statements. No lifter writes a flag, because the instruction has none. Ghidra's own listing of that instruction, captured through the headless script, prints the same operation as `(register, 0x0, 8) INT_SEXT (register, 0x38, 4)`: register offset 0 is `RAX`, offset `0x38` is `RDI`, and the sizes are 8 and 4 bytes.

`83 f9 04`, `cmpl $0x4, %ecx`, from the bounds check in `grade`, gives 30 ESIL tokens, 13 RzIL `set` effects, 10 P-code operations, and 7 VEX statements with `cc_op` 7, the 32-bit subtraction. Nothing writes `%ecx`. The two subtraction widths you will meet in VEX are 7 for 32 bits and 8 for 64 bits, and the translator you build carries that table.

## Four Address Bases for One Function

Before the harness can compare anything it has to agree with itself about where a function is. Do the arithmetic once by hand for `grade` in `ledger-x86_64-O1.o`.

| Tool | Address of `.text` | Address of `grade` | Offset |
|---|---|---|---|
| `llvm-objdump` | `0x0` | `0x10` | `0x10 - 0x0 = 0x10` |
| radare2, rizin | `0x08000040` | `0x08000050` | `0x08000050 - 0x08000040 = 0x10` |
| angr | `0x400000` | `0x400010` | `0x400010 - 0x400000 = 0x10` |
| Ghidra | `0x100000` | `0x100010` | `0x100010 - 0x100000 = 0x10` |

The symbol table says `grade` is at `.text + 0x10` with size 46. Every tool agrees once the base is removed. The harness reads the base from each capture: `iSj` in radare2 and rizin, the `.text` section entry in the angr capture, the `.text` memory block in the Ghidra capture, and zero for the sweep. The test `test_every_tool_places_grade_at_offset_0x10_from_its_own_base` fixes that fact.

## Where the Tools Agree and Where They Split

The harness in `code/main.py` reads the captures, reduces every address, and compares. These are the numbers it reports, and the tests assert each of them.

### The agreement case: ledger at -O1

Four functions, 56 instructions in the sweep, 54 inside the symbols and 2 in padding. Every tool reports the same instruction starts in every function: 9, 14, 13, and 18. The four graph builders report 3, 3, 5, and 4 blocks and 2, 3, 5, and 4 edges, and the edge sets are identical, pair for pair, across radare2, rizin, angr, and Ghidra. The five blocks and five edges of `total` are the ones lesson 33 drew by hand.

The one difference is at the padding. The 3 bytes between functions (`66 90` after `grade`, `90` after `total`) are decoded by the sweep, which has no reason to stop, and by angr, which creates `sub_40003e` and `sub_40005f` with no symbol. radare2, rizin, and Ghidra claim none of them.

### The vectorised case: ledger at -O2

`total` is 41 instructions in 10 blocks with 13 edges, in every one of the four graph builders. The SSE2 loop and the scalar remainder loop from lesson 33 are cut the same way everywhere. angr again adds two functions at padding.

### The jump table: grade at -O0

Here the tools split, and the split is the lesson.

| Tool | Blocks | Edges | What the capture says |
|---|---|---|---|
| radare2 | 3 | 2 | the block at `0x62` has no successor; bytes `0x76` to `0x9a` are never reached; 8 instruction starts missing |
| rizin | 8 | 11 | the block at `0x62` carries a `switch_op` with 5 cases and 4 distinct targets |
| angr | 8 | 7 | the case blocks exist, and the transfer at `0x62` goes to an unresolvable target node |
| Ghidra | 9 | 12 | `switchD` label at `0x74` splits the block; four `COMPUTED_JUMP` flows to `0x76`, `0x7f`, `0x88`, `0x91` |

All four decoded the same 33 instructions when they reached them. radare2 stopped at `jmp rax` and left 36 bytes unclaimed, and the harness names that range as missed code. rizin and Ghidra found the four distinct targets that lesson 33 read from the five relocations in `.rela.rodata`. angr lists the case blocks inside `grade` and still has no edge from the jump block to them; its capture records the transfer at `0x62` as leading to an unresolvable target node, and its decompiler printed a computed `goto`. Ghidra has one block and one edge more than rizin for the same control flow because its switch analysis placed a label on the `jmp rax` and the block model starts a new block at a label.

The lesson-33 graph had 8 blocks and 11 edges. rizin matches it exactly. The point is to see that 9 and 11 and 7 and 2 are not four measurements of code found. They are four answers to how far a tool followed one indirect jump and where it chose to cut.

### Data in code: sweep-trap

`lookup` is 24 bytes with the 4 table bytes `31 c0 90 48` at `0x10`. The sweep reports 8 instruction starts in that range. The harness lists its differences from the majority: extra starts at `0x10`, `0x12`, and `0x13`, and a missing start at `0x14`. That is the `addq $0x1, %rax` from lesson 33 one byte early. radare2, rizin, and Ghidra report 6 starts, 2 blocks, 1 edge, and leave `0x10` to `0x14` unclaimed. angr reports the same 2 blocks and 1 edge for `lookup` and then invents `sub_400010` on the table bytes: 2 instructions in a 4-byte block that ends at `0x14`, where the second block of `lookup` starts, so the REX byte at `0x13` belongs to no instruction. The harness's last finding for this object is that no graph builder decodes `0x10` to `0x14`, so those bytes sit inside a function and are data.

### Invented and missed, by tool

Across the four objects the harness names 9 functions that angr invents with no symbol, every one at padding or at the trap table. It names one range that radare2 misses, the 36 case bytes of `grade` at `-O0`. It names 9 ranges that the linear sweep decodes and no graph builder treats as code: the eight padding gaps plus the trap table. It names no missed function in any tool.

## Three Decompilers on grade

Three of the captured tools emit C-like text for `grade` at `-O1`. The source is `switch (score / 10)` with five cases, compiled to a bounds check and a table of return values.

Ghidra 12.1.4:

```c
uint grade(int param_1)
{
  uint uVar1;
  uint uVar2;

  uVar2 = param_1 / 10 - 6;
  uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);
  if (uVar2 < 5) {
    uVar1 = *(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4);
  }
  return uVar1;
}
```

angr 10.0.3:

```c
extern unsigned int g_4000b4[4];

unsigned int grade(int a0)
{
    unsigned int v1;  // ecx
    unsigned int v2;  // eax

    v1 = (unsigned int)((long long)(a0 * 1717986919) >> 0x22) + (unsigned int)(a0 * 1717986919 >> 63) - 6;
    v2 = 0;
    if (v1 <= 4)
        v2 = g_4000b4[v1];
    return v2;
}
```

radare2 6.2.4, `pdc`:

```c
void sym.grade (int64_t arg1) {
    rax = edi
    rax = rax * 0x66666667
    rcx = rax
    rcx >>= 0x22
    rax >>>= 0x3f
    ecx += eax
    ecx += 0xfffffffa
    eax = 0
    v = ecx - 4
    if (((unsigned) v) <= 0) {
        eax = ecx
        rcx = rip
        eax = dword [rcx + rax*4]
    }
    return
}
```

Read the three against the pipeline. Ghidra's term rewriting folded the multiply by `0x66666667` and the shift by 34 back into `param_1 / 10`, which is lesson 34's idiom. angr lifted the same bytes and left the arithmetic as `a0 * 1717986919 >> 0x22`. radare2's `pdc` is ESIL emulation plus pseudo syntax: register names, no variables, no types, and the bounds check printed as `<= 0` after an unsigned subtraction. Ghidra typed the table load through `DAT_001000b4`; angr declared `g_4000b4[4]`, four elements where the source has five. Neither Ghidra nor angr recovered the enumeration of cases, because at `-O1` there is no switch left in the bytes. At `-O0`, where the jump table exists, Ghidra printed `switch(param_1 / 10)` with cases 6 to 10 and a default, and angr printed a computed `goto`.

rizin has no decompiler of its own, and the capture records that `pdc` does not exist there. Binary Ninja's HLIL and the Hex-Rays ctree are the two outputs this lesson could not capture.

## Build It

Run the demo:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape
python3 code/main.py
```

The output is one JSON report. It opens with the tool versions recorded at capture time and with the tools present on your machine, which may all be absent. Then for each of the four objects it gives the symbol extents, the padding gaps, the base each tool used, the function starts each tool found or invented, and for each function the instruction-start agreement, block counts, edge counts, and the edges each tool lacks. It ends with byte accounting per tool, the tools' own notes, a list of findings in plain sentences, and the IR section: the translator's output for the three instructions next to the counts measured on the captured lifts.

Expected shape:

```json
{
  "captureTools": {"llvm-objdump": "Apple LLVM version 17.0.0", "radare2": "radare2 6.2.4 ...", "rizin": "rizin 0.9.1 ...", "angr": "10.0.3", "ghidra": "12.1.4"},
  "localTools": {"radare2": "absent", "...": "..."},
  "fixtures": {
    "ledger-x86_64-O0.o": {
      "bases": {"llvm-objdump": "0x0", "radare2": "0x8000040", "angr": "0x400000", "ghidra": "0x100000", "...": "..."},
      "functions": {"grade": {"blocks": {"radare2": 3, "rizin": 8, "angr": 8, "ghidra": 9}, "edges": {"radare2": 2, "rizin": 11, "angr": 7, "ghidra": 12}, "...": "..."}},
      "findings": ["radare2 never reaches bytes 0x76-0x9a inside grade that the other graph builders decode", "..."]
    }
  },
  "ir": {"translator": [{"text": "subq $0x10, %rsp", "flags": {"pcodeLike": "eager", "vexLike": "thunk"}, "...": "..."}], "observed": {"...": "..."}}
}
```

Read `code/main.py` in this order:

1. `read_text_symbols()` reads the section headers and the `STT_FUNC` symbols of `.text`. The symbol table is the only ground truth the harness has, and `TextSection.gaps()` derives the padding from it.
2. `parse_objdump()`, `parse_r2_family()`, `parse_angr()`, and `parse_ghidra()` each turn one capture into a `ToolView`: a base, the instructions as offset to length, and one `FunctionView` per function with blocks, edges, and any decompiled text. Each parser knows one tool's vocabulary and nothing else.
3. `majority()` and `ranges()` are the two helpers every comparison uses.
4. `function_report()` compares instruction starts against the majority of the graph builders, then block counts, then edge sets, and lists what each tool lacks.
5. `byte_report()` accounts for every byte as code inside a symbol, padding, unclaimed, invented, or missed, and names the bytes inside symbols that no graph builder decodes.
6. `findings()` turns those into sentences, and `compare()` assembles one report per object.
7. `decode_small()`, `to_pcode_like()`, and `to_vex_like()` are the translator: three encodings in register form, one eager style, one thunk style.
8. `observed_ir()` measures the captured lifts, and `figure_data()` assembles the timeline, the stage table, and the evidence the figure shows.

Three more commands exist. `python3 code/main.py compare FIXTURE.o` prints one object's report. `python3 code/main.py ir 4883ec10` prints the translator's two forms for one instruction. `python3 code/main.py figure-data` prints the data embedded in the figure.

The captures were made once by `code/fixtures/capture_tools.py`, which records every command and version in `captures.json`. The harness and the tests never start a tool. If you have the tools, run the capture script to refresh the files, and read the fixtures README for the environment it needs.

## Use It

Use the harness on a new object in this order.

1. Build the object yourself and keep the compiler command. Read its symbol table before you open any tool, so you know how many functions there are and where the padding is.
2. Capture each tool once in headless mode. Store the raw output and the exact command beside the object. A disagreement you cannot re-read is not a finding.
3. Check the base. Pick one function and confirm that every tool places it at the same offset after you subtract its `.text` address. If one does not, stop and find out what that tool loaded.
4. Compare instruction starts first. If the graph builders disagree here, the rest of the comparison is about decoding and not about analysis.
5. Compare blocks and edges, and read each tool's notes before you judge a count. A `switch_op`, a `COMPUTED_JUMP`, or an unresolvable target node explains most differences.
6. Account for bytes. Padding that a tool claims is a heuristic at work. Symbol bytes that a tool leaves are a stopped walk. Symbol bytes that no graph builder claims are data.
7. Write down which tools you did not run. A description from documentation is useful and is a different kind of evidence from a capture.

## Interactive Lab

### Lab A: one function, four bases

From the `code` directory, open Python:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape/code
python3 -q
```

Run:

```python
from main import *
views = load_views("ledger-x86_64-O1.o")
{tool: hex(view.base) for tool, view in views.items()}
{tool: hex(view.functions["grade"].start + view.base) for tool, view in views.items()}
```

Write the four raw addresses down before you run the second line and check them against the table in this lesson. Then replace `grade` with `grade_label` and compute by hand where it sits in Ghidra.

### Lab B: the jump table from four sides

```python
report = compare("ledger-x86_64-O0.o")
report["functions"]["grade"]["blocks"]
report["functions"]["grade"]["edgesMissingPerTool"]["radare2"]
report["notes"]["rizin"]
report["notes"]["ghidra"]
report["bytes"]["radare2"]["misses"]
```

Count the edges radare2 lacks and match each one to a line of the `-O0` listing from lesson 33. Then read the Ghidra note and find the `switchD` label in the Ghidra capture.

### Lab C: eager flags against a thunk

```python
translate("48 83 ec 10")["pcodeLike"]
translate("48 83 ec 10")["vexLike"]
translate("83 f9 04")["vexLike"]
{row["name"]: (row["pcode"]["ops"], row["vex"]["statements"]) for row in observed_ir()["instructions"]}
```

Find the `cc_op` constant in both outputs and explain why one is 8 and the other 7. Then try `translate("48 01 c8")` and read the `TranslateError`.

### Lab D: the trap under five tools

```python
report = compare("sweep-trap.o")
report["functions"]["lookup"]["instructionStarts"]
report["bytes"]["dataInsideSymbols"]
report["functionStarts"]["angr"]
```

Decode the bytes `31 c0 90 48 83 c0 01` on paper as a sweep would, then as a descent would after the `jmp`. Match your two listings to the extra and missing starts the harness reports.

## Practice Lab

Add a fifth capture and extend the harness.

Requirements:

- Pick one tool this lesson did not capture and that you can run on your machine: GNU `objdump`, LIEF with Capstone, a Binary Ninja Free session exported by hand, or Ghidra with a different analyzer set. Capture its output on all four objects with the exact command and version in `captures.json`.
- Write one parser that turns the capture into a `ToolView` with the tool's base, instructions, functions, blocks where the tool has them, and edges where it has them.
- Add the tool to `TOOLS` and, if it builds a graph, to `DESCENT_TOOLS`. Run the demo and read what changed in the majority sets.
- Write a test that asserts the tool's block counts on `ledger-x86_64-O1.o` and a test that asserts what it does with the trap table.
- Write one paragraph for the lesson that says, in the tool's own words, what it calls the loader, the disassembler, and the CFG.

Success means `python3 code/main.py` reports the new tool in `captureTools`, every function in `ledger-x86_64-O1.o` keeps `allDescentToolsAgree` true, and the findings for `sweep-trap.o` say what the new tool did with bytes `0x10` to `0x14`.

## Lesson Artifact

This lesson includes `outputs/skill-the-reverse-engineering-landscape.md`. Use it to run several tools on one object you built, reduce their addresses to one base, and report, per function, where they agree on instruction starts, blocks, and edges, and which bytes each tool invents or misses. It requires captures with recorded commands and versions, a symbol table read from the file, and a statement of which tools were described from documentation only.

## Verify It

Run the demo and the deterministic suite:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

Verification should prove:

- the ELF reader finds four function symbols in `ledger-x86_64-O1.o` with sizes 16, 46, 31, and 63, and two padding gaps
- the sweep captures hold 86, 56, 84, and 11 instructions for the four objects
- radare2 and rizin report the same instructions, blocks, and edges on `ledger-x86_64-O1.o`, and only radare2 has `pdc` text
- angr marks `sub_40003e` and `sub_40005f` as functions with no symbol
- Ghidra's blocks for `total` are the five blocks of lesson 33 and its call flows are not graph edges
- every tool places `grade` at offset `0x10` after its base is removed
- every tool agrees on every instruction start in every function of `ledger-x86_64-O1.o`
- the four graph builders report 3, 3, 5, 4 blocks and 2, 3, 5, 4 edges there, with identical edge sets
- `total` at `-O2` has 10 blocks and 13 edges in every graph builder
- `grade` at `-O0` has 3, 8, 8, and 9 blocks and 2, 11, 7, and 12 edges in radare2, rizin, angr, and Ghidra, with the reasons in each tool's notes
- `grade_label` at `-O0` is one block everywhere except angr, which ends a block at the call
- angr invents one function per padding gap plus one on the trap table, and no other tool invents or misses a function
- the sweep gains starts `0x10`, `0x12`, `0x13` and loses `0x14` on the trap, and no graph builder decodes `0x10` to `0x14`
- the findings name the missed range in radare2 and every invented function in angr
- the manifest records a version and a command for all 21 capture files
- three tools decompile `grade`, and only Ghidra folds the division idiom
- the translator writes CF, OF, SF, ZF, PF eagerly in one style and a `cc_op` thunk in the other, writes no register for `cmp`, and no flag for `movslq`
- the translator refuses memory forms, other opcodes, extra REX bits, and wrong lengths
- the translator's `cc_op` numbers 8 and 7 equal the ones in the captured VEX
- the captured lifts give 9, 1, 10 P-code operations and 7, 4, 7 VEX statements for the three instructions
- the timeline runs from 1973 to 2026 in order, the pipeline has eight stages and six tools with a term in every cell, and the two closed tools are marked as not run
- the interactive figure embeds the same data the harness produces

## Production Failure Modes

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Raw addresses from different tools | "the tools disagree about where grade is" | one offset after each base is removed, checked on one function |
| Block count as a measure of code found | "Ghidra found the most code" | the same instruction starts, with the extra block explained by a label |
| One tool as the oracle | "objdump shows the table bytes are instructions" | the sweep is a linear sweep; three graph builders leave the bytes unclaimed |
| Padding functions counted as discoveries | "angr found seven more functions" | every one sits in a padding gap or on data, and none has a symbol |
| A stopped walk reported as dead code | "the four case blocks are unreachable" | 36 bytes missed by one tool and reached by three |
| Edge counts compared without the notes | "rizin and Ghidra disagree on grade" | the same four computed targets, one extra split at a label |
| A decompiler's arithmetic read as the program | "the function multiplies by 1717986919" | the idiom from lesson 34, folded by one tool and left by another |
| A closed tool described as if run | "Binary Ninja reports five blocks" | the figure and the table mark it as documentation only |
| Captures without commands | "we ran radare2" | the manifest with version, command, and date for every file |
| An IR with no flags read as a lossy lift | "VEX dropped the flags" | the thunk in `cc_op`, `cc_dep1`, `cc_dep2`, evaluated at the branch |

## Operational Rule

Capture every tool once with its command and version, reduce every address to one base, and compare instruction starts before blocks and blocks before edges. Account for every byte as claimed, padding, data, or missed. Read a tool's own note before you judge its count, and say which tools you only read about.

## Further Reading

- [Cifuentes, "Reverse Compilation Techniques", PhD thesis, QUT (1994)](https://eprints.qut.edu.au/36820/)
- [Cifuentes and Gough, "Decompilation of Binary Programs", Software: Practice and Experience (1995)](https://doi.org/10.1002/spe.4380250706)
- [Van Emmerik, "Static Single Assignment for Decompilation", PhD thesis, University of Queensland (2007)](https://espace.library.uq.edu.au/view/UQ:158682)
- [Schwartz, Lee, Woo, Brumley, "Native x86 Decompilation Using Semantics-Preserving Structural Analysis and Iterative Control-Flow Structuring" (USENIX Security 2013)](https://www.usenix.org/conference/usenixsecurity13/technical-sessions/presentation/schwartz)
- [Yakdan et al., "No More Gotos" (NDSS 2015)](https://www.ndss-symposium.org/ndss2015/ndss-2015-programme/no-more-gotos-decompilation-using-pattern-independent-control-flow-structuring-and-semantics/)
- [Basque et al., "Ahoy SAILR! There is No Need to DREAM of C" (USENIX Security 2024)](https://www.usenix.org/conference/usenixsecurity24/presentation/basque)
- [Andriesse et al., "An In-Depth Analysis of Disassembly on Full-Scale x86/x64 Binaries" (USENIX Security 2016)](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/andriesse)
- [Flake, "Structural Comparison of Executable Objects" (DIMVA 2004)](https://dl.gi.de/items/7f573931-cb51-49ef-a12c-0452a9fb0ea4)
- [Maranzano and Bourne, "A Tutorial Introduction to ADB", Bell Labs (1977)](http://squoze.net/UNIX/v7/files/doc/18_adb.pdf)
- [Stallman, KTH lecture on GDB entering distribution (30 October 1986)](https://www.gnu.org/philosophy/stallman-kth.html)
- [Hex-Rays, "IDA: celebrating 30 years of binary analysis innovation"](https://hex-rays.com/blog/ida-celebrating-30-years-of-binary-analysis-innovation)
- [Guilfanov, "Decompiler internals: microcode", Recon Brussels 2018 (slides)](https://www.recon.cx/2018/brussels/resources/slides/RECON-BRX-2018-Decompiler-internals-microcode.pdf)
- [Hex-Rays, microcode view and maturity levels](https://docs.hex-rays.com/core/decompiler/how-tos/microcode-view)
- [Hex-Rays, IDA 9.4 release notes](https://docs.hex-rays.com/release-notes/9_4)
- [Hex-Rays, IDA Free](https://hex-rays.com/ida-free)
- [Ghidra releases (12.1.4)](https://github.com/NationalSecurityAgency/ghidra/releases)
- [Ghidra P-code reference](https://github.com/NationalSecurityAgency/ghidra/blob/master/GhidraDocs/languages/html/pcoderef.html)
- [Ghidra decompiler source, main work flow and Action classes](https://github.com/NationalSecurityAgency/ghidra/tree/master/Ghidra/Features/Decompiler/src/decompile/cpp)
- [Ghidra analyzeHeadless README](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/RuntimeScripts/support/analyzeHeadlessREADME.md)
- [Binary Ninja, BNIL overview](https://docs.binary.ninja/dev/bnil-overview.html)
- [Binary Ninja, "Architecture Agnostic Function Detection in Binaries" (2017)](https://binary.ninja/2017/11/06/architecture-agnostic-function-detection-in-binaries.html)
- [Binary Ninja, batch processing and headless licences](https://docs.binary.ninja/dev/batch.html)
- [Binary Ninja 6.0 "Krypton" release post](https://binary.ninja/2026/09/03/binary-ninja-6.0-krypton.html)
- [Binary Ninja Free](https://binary.ninja/free/)
- [radare2 book, ESIL](https://book.rada.re/emulation/esil.html)
- [radare2 book, decompilers](https://book.rada.re/arch/decompile.html)
- [radare2 releases (6.2.4)](https://github.com/radareorg/radare2/releases)
- [rizin, RzIL design notes](https://github.com/rizinorg/rizin/blob/dev/doc/rzil.md)
- [rizin releases (0.9.1)](https://github.com/rizinorg/rizin/releases)
- [Announcing Rizin (8 December 2020)](https://rizin.re/posts/announcing-rizin/)
- [Cutter releases (2.5.0)](https://github.com/rizinorg/cutter/releases)
- [angr documentation, CFG recovery](https://docs.angr.io/en/latest/analyses/cfg.html)
- [angr documentation, the decompiler and its analysis passes](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [angr documentation, intermediate representation (VEX)](https://docs.angr.io/en/latest/advanced-topics/ir.html)
- [angr on PyPI (10.0.3)](https://pypi.org/project/angr/)
- [pypcode on PyPI](https://pypi.org/project/pypcode/)
- [llvm-objdump command guide](https://llvm.org/docs/CommandGuide/llvm-objdump.html)
- [GNU objdump manual](https://sourceware.org/binutils/docs/binutils/objdump.html)
- [LIEF documentation](https://lief.re/doc/stable/index.html)
- [Capstone releases](https://github.com/capstone-engine/capstone/releases)
- [BinDiff releases (v8, open source)](https://github.com/google/bindiff/releases/tag/v8)
- [Diaphora](https://github.com/joxeankoret/diaphora)
- [Hopper Disassembler downloads](https://www.hopperapp.com/download.html)
- [Compiler Explorer](https://github.com/compiler-explorer/compiler-explorer)
- [LLDB announced as an LLVM subproject (2010)](https://blog.llvm.org/2010/06/new-lldb-debugger.html)
- [Boomerang decompiler](https://boomerang.sourceforge.net/)
- [Tan et al., "LLM4Decompile" (EMNLP 2024)](https://aclanthology.org/2024.emnlp-main.203/)
- [Gao et al., "DecompileBench" (Findings of ACL 2025)](https://aclanthology.org/2025.findings-acl.1194/)
- [Liu, Raff, Micinski, "When LLM Decompilers Recompile More and Preserve Less" (2026)](https://arxiv.org/abs/2609.05370)
