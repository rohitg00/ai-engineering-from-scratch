# Calling Conventions and Stack Frames: System V, Windows x64, and AArch64

> A disassembly shows which registers a function reads. Only the ABI says what those registers mean, and the ABI is chosen by the object header, so this lesson reads the header first and then checks every register against the rule that put it there.

**Type:** Build
**Languages:** Python, C, x86-64 and AArch64 assembly
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow)
**Time:** ~140 minutes

## Learning Objectives

- Pick the calling convention from the object header: ELF x86-64 is the System V psABI, COFF AMD64 is Microsoft x64, ELF AArch64 is AAPCS64, Mach-O arm64 is Apple's variant.
- Decode the prologue of one function byte by byte for each ABI and place every saved register, the return address, and the frame pointer at its offset from the entry stack pointer.
- Infer the parameter registers of a function from the registers it reads before it writes them, and the stack argument slots from the loads above the entry stack pointer.
- Tell the independent register sequences of System V from the positional slots of Microsoft x64, and both from the NGRN and NSRN counters of AAPCS64.
- Check every inference against the source signature, the rule in the specification, and the compiler's own unwind data in `.pdata`, `.xdata`, and `.eh_frame`.
- Compare how Ghidra, IDA, Binary Ninja, radare2, rizin, and angr name and recover the same facts, and record where their output disagrees with the source.

## The Problem

You compiled `convention.c` for Linux x86-64 at `-O2` and asked radare2 6.2.4 for the arguments of `eight_args`. It answered with seven: `rdi`, `rsi`, `rdx`, `r8`, `r9`, `rsp+0x8`, and `rsp+0x10`. The C source has eight parameters. The bytes read `%rcx` exactly once, in `leaq (%rdx,%rcx), %rax`, and the tool's variable recovery did not count a register that only appears inside an address.

You then opened the Windows build of the same file in rizin 0.9.1. It reported the convention as `amd64` and found `r8`, `rcx`, `rdx`, and three stack slots. The object is COFF, so the convention is Microsoft x64, the fourth register argument is `r9`, and there are four stack slots. The two tools miss different registers in the same source.

A listing is a sequence of instructions. A calling convention is a contract that lives outside the listing: which registers carry arguments, which the callee must preserve, where the return address and the stack arguments sit, and what the caller must leave above the stack pointer. Four documents define the contracts that matter here. The System V AMD64 psABI (Version 1.0, build dated 12 March 2025) sections 3.2.1 to 3.2.3. The Microsoft x64 calling convention, stack usage, and prolog and epilog pages (page dates from 2018-12-17 to 2025-03-19). The Arm AAPCS64 release 2025Q4 (23 January 2026) sections 6.1 to 6.9. Apple's arm64 platform notes. This lesson reads those rules, applies them to one C file compiled three ways, and builds the analyzer that turns a listing into a checked list of parameter locations, saved registers, and frame offsets.

```figure
re-38-three-frames
```

## One Header Picks the Rulebook

`convention.c` has twelve functions: `leaf_add`, `eight_args`, `mixed`, `by_value`, `big_ret`, `sum_varargs`, `keeps`, and five callers of `extern` functions with the same shapes. The structs use `long long`, because `long` is 4 bytes on the MSVC target and 8 bytes on the others, and a struct that changes size changes convention. Apple clang 17.0.0 compiled it seven times from this machine: `-target x86_64-unknown-linux-gnu`, `x86_64-pc-windows-msvc`, and `aarch64-unknown-linux-gnu` at `-O0` and `-O2`, and `arm64-apple-macos` at `-O2`. No Linux or Windows headers are installed, so the file declares what it needs and includes only clang's own `stdarg.h` and `stddef.h`.

`describe_object()` in `code/main.py` reads the 4-byte magic number and one machine field and names the contract:

| Header | Field | Value | Rulebook |
|---|---|---|---|
| `7f 45 4c 46` ELF | `e_machine` at offset 0x12 | 62 | System V AMD64 psABI |
| `64 86` COFF | `Machine` at offset 0 | 0x8664 | Microsoft x64 |
| `7f 45 4c 46` ELF | `e_machine` | 183 | AAPCS64 |
| `cf fa ed fe` Mach-O 64 | `cputype` at offset 4 | 0x0100000c | AAPCS64 with Apple differences |

The three contracts disagree on almost every row of the table that follows. Every value is quoted from the document named in the header row, and every one is checked by a test against the fixtures.

| Rule | System V psABI | Microsoft x64 | AAPCS64 |
|---|---|---|---|
| Integer arguments | `%rdi %rsi %rdx %rcx %r8 %r9`, next free register | `RCX RDX R8 R9`, by position | `x0` to `x7`, by NGRN |
| Floating-point arguments | `%xmm0` to `%xmm7`, next free register | `XMM0` to `XMM3`, by position | `v0` to `v7`, by NSRN |
| Integer result | `%rax`, then `%rdx` | `RAX` | `x0`, then `x1` |
| Floating-point result | `%xmm0`, then `%xmm1` | `XMM0` | `v0` |
| Result too large for registers | address passed in `%rdi` "as if it were the first argument", returned in `%rax` | pointer in `RCX`, arguments shifted right, returned in `RAX` | address in `x8`, `x0` to `x7` untouched |
| Callee-saved | `%rbp %rbx %r12` to `%r15` | `RBX RBP RDI RSI RSP R12` to `R15`, `XMM6` to `XMM15` | `r19` to `r29`, `SP`, low 64 bits of `v8` to `v15` |
| First stack argument on entry | `8(%rsp)` | `40(%rsp)`, above a 32-byte shadow store | `0(sp)` |
| Below the stack pointer | 128-byte red zone | "considered volatile" | no red zone (Apple: 128 bytes) |
| Alignment at the call | `(%rsp + 8)` multiple of 16 on entry | 16-byte aligned outside prolog and epilog | `SP mod 16 = 0` |
| Variadic marker | `%al` holds an upper bound on vector registers used | floats duplicated in the integer register | none in registers; Apple uses 8-byte stack slots |

## System V: Two Independent Register Sequences and a Red Zone

psABI 3.2.3 classifies every eightbyte of every argument as INTEGER, SSE, or MEMORY and then assigns registers from two lists that do not interact. "INTEGER" takes "the next available register of the sequence %rdi, %rsi, %rdx, %rcx, %r8 and %r9". SSE takes `%xmm0` to `%xmm7`. "If there are no registers available for any eightbyte of an argument, the whole argument is passed on the stack", and memory arguments "are pushed on the stack in reversed (right-to-left) order".

`eight_args(a, b, c, d, e, f, g, h)` at `-O2` is 27 bytes:

```text
      10: 48 01 fe                     	addq	%rdi, %rsi
      13: 48 8d 04 0a                  	leaq	(%rdx,%rcx), %rax
      17: 48 01 f0                     	addq	%rsi, %rax
      1a: 4c 01 c0                     	addq	%r8, %rax
      1d: 4c 01 c8                     	addq	%r9, %rax
      20: 48 03 44 24 08               	addq	0x8(%rsp), %rax
      25: 48 03 44 24 10               	addq	0x10(%rsp), %rax
      2a: c3                           	retq
```

Six registers, then two loads at `8(%rsp)` and `16(%rsp)`. Figure 3.3 of the psABI puts "memory argument eightbyte 0" at `16(%rbp)` when `%rbp` is the frame base, which is `8(%rsp)` on entry before any push. `g` is at 8, `h` at 16.

`mixed(int i, double d, long long l, float f)` shows the two lists. The ints take `%edi` and `%rsi`, the first and second INTEGER registers. The double and the float take `%xmm0` and `%xmm1`, the first and second SSE registers. The first instruction is `cvtsi2sd %edi, %xmm2`, and `%xmm2` is a scratch register that the function writes before it reads. An analyzer that treats the destination of `cvtsi2sd` as a read invents a third floating-point argument. radare2 did exactly that and reported `mixed` as `(double arg1, double arg2, double arg3)` in `xmm0`, `xmm1`, `xmm2`.

`by_value(struct pair p)` passes a 16-byte struct as two INTEGER eightbytes in `%rdi` and `%rsi`, and returns it the same way: `leaq 0x1(%rdi), %rax; leaq -0x1(%rsi), %rdx; retq`. `big_ret(long long seed)` returns 32 bytes, which is class MEMORY, and the psABI says "the caller provides space for the return value and passes the address of this storage in %rdi as if it were the first argument". `seed` moves to `%rsi`, and the function starts with `movq %rdi, %rax` because "On return %rax will contain the address that has been passed in by the caller in %rdi".

The red zone is the other System V signature. psABI 3.2.2: "The 128-byte area beyond the location pointed to by %rsp is considered to be reserved and shall not be modified by signal or interrupt handlers." At `-O0`, `eight_args` is `pushq %rbp; movq %rsp, %rbp` and then six stores to `-0x8(%rbp)` through `-0x30(%rbp)` with no `subq`. The stores sit 48 bytes below the stack pointer. The `-O2` build of `sum_varargs` allocates 88 bytes with `subq $0x58, %rsp` and then writes the register save area at `-0x58(%rsp)` down to `-0x80(%rsp)`: 128 bytes below the stack pointer, the whole red zone. Build the same file with `-mno-red-zone` and `leaf_add` gains a `pushq %rax` and an `addq $0x8, %rsp` to hold its 8 bytes of locals above the stack pointer.

Variadic calls add one register. "%al is used as hidden argument to specify the number of vector registers used", an upper bound from 0 to 8. `call_varargs` sets it with `xorl %eax, %eax` at `-O2` and `movb $0x0, %al` at `-O0`. `sum_varargs` reads it first: `testb %al, %al; je` skips eight `movaps %xmmN` saves when no vector register was used.

## Microsoft x64: Positions, a Shadow Store, and No Red Zone

The Microsoft rules are positional. "Integer arguments are passed in registers RCX, RDX, R8, and R9. Floating point arguments are passed in XMM0L, XMM1L, XMM2L, and XMM3L." and "Any floating-point and double-precision arguments in the first four parameters are passed in XMM0 - XMM3, depending on position." The same `mixed` arrives as `%ecx`, `%xmm1`, `%r8`, `%xmm3`: slot 0 is an int, so `RCX`; slot 1 is a double, so `XMM1`; slot 3 is a float, so `XMM3`. `XMM0` and `XMM2` stay empty.

The caller must also leave room. "The caller must always allocate sufficient space to store four register parameters, even if the callee doesn't take that many parameters." The pages call it the shadow store or the home addresses, and the four slots are "effectively owned by the called function". On entry `0(%rsp)` is the return address, `8(%rsp)` to `39(%rsp)` are the four homes, and the first stack argument is at `40(%rsp)`. `eight_args` at `-O2` reads `0x28(%rsp)`, `0x30(%rsp)`, `0x38(%rsp)`, `0x40(%rsp)`: 40, 48, 56, 64.

The caller side shows the arithmetic. `call8` at `-O2` is `subq $0x48, %rsp` and then stores of 5, 6, 7, 8 at `0x20(%rsp)` to `0x38(%rsp)` before `movl $1, %ecx` and friends. 72 bytes is 32 for the shadow store, 32 for four stack arguments, and 8 so that the return address is on a 16-byte boundary. `call_varargs` has only register arguments and still allocates `subq $0x28, %rsp`: 32 for the shadow store and 8 for alignment. `keeps` pushes three nonvolatile registers (24 bytes) and then `subq $0x20, %rsp`, so that `ext` finds its 32-byte shadow store below the return address.

Structs follow their own rule. "Any argument that doesn't fit in 8 bytes, or isn't 1, 2, 4, or 8 bytes, must be passed by reference." and "16-byte arguments are passed by reference." `by_value` therefore receives a pointer to a copy in `%rdx`, after a hidden result pointer in `%rcx`: "the caller must allocate memory for the return value and pass a pointer to it as the first argument. The remaining arguments are then shifted one argument to the right." `call_pair` builds the copy at `0x20(%rsp)` with `movaps`, passes `leaq 0x20(%rsp), %rdx`, passes the result buffer with `leaq 0x38(%rsp), %rcx`, and reads `.b` back from `0x40(%rsp)`.

There is no red zone. "All memory beyond the current address of RSP is considered volatile: The OS, or a debugger, may overwrite this memory during a user debug session, or an interrupt handler." The `-O0` `leaf_add` needs 8 bytes of locals and gets them with `pushq %rax` at entry and `popq %rcx` before `retq`, two single-byte instructions instead of a `subq` and an `addq`. The stack-usage page defines the leaf that may do this: "A leaf function is one that does not require a function table entry. It can't make changes to any nonvolatile registers, including RSP".

Variadic callees home their registers. "For vararg or unprototyped functions, any floating point values must be duplicated in the corresponding general-purpose register." `sum_varargs` at `-O2` stores `%rdx`, `%r8`, `%r9` to `0x18(%rsp)`, `0x20(%rsp)`, `0x28(%rsp)` after one `pushq %rax`, which is entry offsets 16, 24, 32: the homes of the second, third, and fourth register parameters. Its `va_list` is `leaq 0x18(%rsp), %rax`, the home of `%rdx`, the first unnamed argument.

## AAPCS64, and What Apple Changes

AAPCS64 6.8.2 walks a list of rules with two counters. C.9: an integral argument "is copied to the least significant bits in x[NGRN]" and NGRN increments. C.1 does the same for floating-point arguments with NSRN. C.12: a composite of at most `8 - NGRN` double-words is "copied into consecutive general-purpose registers". C.13 sets "The NGRN is set to 8" once an argument goes to the stack, so nothing returns to registers afterwards. `eight_args` uses `x0` to `x7` and never touches the stack. `mixed` is `w0`, `d0`, `x1`, `s1`. `by_value` is `x0` and `x1` in and out.

6.9 says a result that would be passed in registers "is returned in the same registers", otherwise "The address of the memory block shall be passed as an additional argument to the function in x8". `big_ret` writes `str x0, [x8]`, `stur q0, [x8, #0x8]`, `str x9, [x8, #0x18]` and never writes `x0`. `call_big` sets `mov x8, sp`, and `seed` stays in `x0`, because 6.9 adds "there is no requirement for the callee to preserve the value stored in x8" and `x8` is not one of the argument registers.

6.1.1: "A subroutine invocation must preserve the contents of the registers r19-r29 and SP." 6.4.5.2: at a public interface "SP mod 16 = 0". The stack is full-descending and "No thread is permitted to access (for reading or for writing) the inactive region" below it, so the Linux `-O0` `leaf_add` emits `sub sp, sp, #0x10` for 8 bytes of locals where System V used the red zone.

6.4.6 defines the frame record: "a frame record of two 64-bit values on the stack ... The lowest addressed double-word shall point to the previous frame record and the highest addressed double-word shall contain the value passed in LR on entry to the current function." and "The location of the frame record within a stack frame is not specified." clang shows both positions in this one file. `keeps` at `-O2` on Linux puts the record at the bottom with `stp x29, x30, [sp, #-0x30]!; mov x29, sp`. The same function at `-O0` puts it at the top with `sub sp, sp, #0x20; stp x29, x30, [sp, #0x10]; add x29, sp, #0x10`.

Apple's arm64 notes keep the registers and the alignment and change the frame, the red zone, and variadic calls. "The frame pointer register (x29) must always address a valid frame record. Some functions, such as leaf functions or tail calls, may opt not to create an entry in this list." The Apple build of `keeps` saves `x22, x21, x20, x19` first and puts the record on top: `stp x29, x30, [sp, #0x20]; add x29, sp, #0x20`. "The platforms reserve register x18. Don't use this register." "The ARM64 red zone consists of the 128 bytes immediately below the stack pointer", and clang still emitted `sub sp, sp, #0x10` for the `-O0` leaf, so the compiler does not use it by default. Variadic arguments are assigned "to the appropriate number of 8-byte stack slots" and "the type va_list is an alias for char*". `call_varargs` on Apple stores 10, 20, 30 to `[sp]`, `[sp, #8]`, `[sp, #0x10]` and passes only `w0`; the Linux build passes `w1`, `w2`, `w3` and tail-calls with `b extva`. The Apple `sum_varargs` reads `add x8, sp, #0x10`, the caller's stack pointer, as its `va_list`; the Linux `sum_varargs` saves `x1` to `x7` and `q0` to `q7` into a 224-byte frame and initialises the structure fields `__gr_offs` to -56 and `__vr_offs` to -128 with one `mov x8, #-0x38; movk x8, #0xff80, lsl #32`.

Symbols differ too. Mach-O prefixes every C symbol with `_`, so the listing shows `_keeps` and the first function appears under the private label `ltmp0`. The analyzer renames labels through the symbol table.

## Decode One Prologue by Hand, Three Times

`keeps(int n)` calls `ext(i)` in a loop and keeps `n`, `i`, and `acc` across the call, so every ABI must save registers. Read the first bytes of the `-O2` build for each target.

System V, 4 bytes:

1. `55` is `push r64` with the register in the low three bits: `50 + 5`, `%rbp`. Depth 8, `%rbp` saved at entry offset -8.
2. `41 56`: `41` is REX with `B` set, `56` is `50 + 6`. REX.B extends 6 to 14: `pushq %r14` at -16.
3. `53` is `50 + 3`: `pushq %rbx` at -24.

Three pushes are 24 bytes. The return address adds 8, and 32 is a multiple of 16, so the `callq ext` inside the loop is aligned without a `subq`. There is no `movq %rsp, %rbp`, so this build has no frame pointer. The body uses `%rbp` as the callee-saved register that holds `acc` (`xorl %ebp, %ebp`, `addl %eax, %ebp`). The epilogue is the mirror: `5b 41 5e 5d c3`.

Microsoft x64, 7 bytes:

1. `56` is `pushq %rsi` at -8. `57` is `pushq %rdi` at -16. `53` is `pushq %rbx` at -24. All three are nonvolatile here, and `RDI` and `RSI` were argument registers under System V.
2. `48 83 ec 20`: REX.W, opcode `83 /5` with an 8-bit immediate, ModRM `ec` is `11 101 100`: `subq $0x20, %rsp`. Depth 56.

56 plus the return address is 64, aligned. The 32 bytes are the shadow store that `ext` is owed. The epilog page allows only "an add RSP,constant or lea RSP,constant[FPReg], followed by a series of zero or more 8-byte register pops and a return or a jmp", and the bytes are `48 83 c4 20 5b 5f 5e c3`.

AArch64, 16 bytes in four words, little-endian:

1. `a9bd7bfd` is `stp` with pre-index. Bits 31:30 `10` select 64-bit registers, bits 25:23 `011` select pre-index, bit 22 is 0 for store. imm7 at bits 21:15 is `1111010`, which is -6, scaled by 8: -48. Rt2 at 14:10 is 30, Rn at 9:5 is 31 (`sp`), Rt at 4:0 is 29. `stp x29, x30, [sp, #-0x30]!`: the stack pointer drops 48, `x29` goes to -48 and `x30` to -40.
2. `f9000bf5` is `str` with an unsigned 12-bit offset scaled by 8: imm12 at 21:10 is 2, Rn is `sp`, Rt is 21. `str x21, [sp, #0x10]`, entry offset -32.
3. `910003fd` is `add` immediate: imm12 is 0, Rn is `sp`, Rd is 29. `mov x29, sp`: the frame pointer points at the record at -48.
4. `a9024ff4` is `stp` with a signed offset: imm7 is 4, scaled to 32. Rt2 is 19, Rt is 20. `stp x20, x19, [sp, #0x20]`: `x20` at -16, `x19` at -8.

The frame is 48 bytes: `x29` at 0, `x30` at 8, `x21` at 16, 8 bytes of padding at 24, `x20` at 32, `x19` at 40. The lowest word of the record points to the previous record and the next word holds LR, as 6.4.6 requires. `cmp w0, #0x1` sits between the first and second store; the scheduler moved it into the prologue, and the analyzer tolerates a compare or an arithmetic instruction between stack operations.

## The Compiler Wrote the Same Facts Twice

A prologue parse is one derivation. The compiler emits a second one for the unwinder, and the two must agree.

On Windows the second derivation is `.pdata` and `.xdata`. Build the `-O2` object without `-fno-asynchronous-unwind-tables` and `llvm-objdump -h` shows `.xdata` of 0x34 bytes and `.pdata` of 0x48 bytes. 0x48 is 72, six `RUNTIME_FUNCTION` entries of 12 bytes with three `IMAGE_REL_AMD64_ADDR32NB` relocations each. The six are `sum_varargs`, `keeps`, `call8`, `call_varargs`, `call_pair`, and `call_big`. The other six functions are leaves, and the exception handling page says "If the search doesn't find a function table entry, the code is assumed to be part of a leaf function, and RSP directly addresses the return pointer."

The `.xdata` bytes for `keeps` are `01 07 04 00 07 32 03 30 02 70 01 60`. `UNWIND_INFO` starts with Version in 3 bits and Flags in 5 bits: version 1, no flags. SizeOfProlog is 7, CountOfCodes is 4, FrameRegister and FrameOffset are 0. Each `UNWIND_CODE` is an offset in the prolog and a byte of opcode and info. `07 32`: at offset 7, op 2 is `UWOP_ALLOC_SMALL`, info 3 means `3 * 8 + 8 = 32` bytes. `03 30`: op 0 is `UWOP_PUSH_NONVOL`, register 3 is `rbx`. `02 70`: `rdi`. `01 60`: `rsi`. The codes are stored in reverse order of execution, and they name the same three pushes and the same 32-byte allocation as the bytes `56 57 53 48 83 ec 20`. The `sum_varargs` entry is `01 01 01 00 01 02 00 00`: a 1-byte prolog with one code, `UWOP_ALLOC_SMALL` of 8 bytes. That is how the unwinder sees `pushq %rax`: an allocation, because `%rax` is volatile and nothing is being saved.

On Linux the second derivation is `.eh_frame`, which psABI 4.2.4 defines and DWARF 5 section 6.4 encodes. `llvm-dwarfdump --eh-frame` on the relocatable object prints one FDE per function and resolves the `R_X86_64_PC32` relocations, so the ranges are usable. For `keeps`:

```text
  DW_CFA_def_cfa_offset: +16
  DW_CFA_def_cfa_offset: +24
  DW_CFA_def_cfa_offset: +32
  DW_CFA_offset: RBX -32
  DW_CFA_offset: R14 -24
  DW_CFA_offset: RBP -16
```

The CFA is the stack pointer before the call, 8 above the entry stack pointer, so `RBP -16` is entry offset -8, `R14 -24` is -16, `RBX -32` is -24, and the deepest CFA offset of 32 is the 24-byte frame plus the return address. The AArch64 FDE for `keeps` says `DW_CFA_def_cfa: W29 +48` with `W29 -48`, `W30 -40`, `W21 -32`, `W20 -16`, `W19 -8`. There the CFA is the entry stack pointer itself, so the offsets are the frame offsets without conversion, and the CFA is defined from `x29` while the frame record is live. `eh_frame_cross_check()` runs this comparison for all 12 FDEs of both objects. One entry needed care: `call8` under System V pushes two outgoing arguments mid-body, so its deepest CFA offset is 32 while its prologue frame is 8, and the check compares the deepest stack pointer the body reaches, 24, plus 8.

## What the Tools Call This

Every tool in this field has a data structure for the calling convention and a pass that assigns one to a function. The names differ and the gaps differ. The closed tools are described from their documentation; the open ones were run on the fixtures and their output is captured beside the objects.

**Ghidra 12.1.4 (Apache-2.0).** The rules live in compiler specification files, `.cspec`, next to the SLEIGH language. `x86-64-gcc.cspec` declares a `<default_proto>` named `__stdcall`, "Derived from System V Application Binary Interface AMD64 Architecture Processor Supplement April 2016", with `<pentry>` lists for `XMM0_Qa` to `XMM7_Qa` and `RDI, RSI, RDX, RCX, R8, R9`, a stack entry at offset 8, a `join_dual_class` rule for types up to 16 bytes, outputs `XMM0_Qa, XMM1_Qa, RAX, RDX`, and `hidden_return` for the rest. `x86-64-win.cspec` declares `__fastcall` with four `<group>` elements that pair `XMM0_Qa` with `RCX`, `XMM1_Qa` with `RDX`, and so on, which is the positional rule, a stack entry at offset 40, `convert_to_ptr` for structs of 3, 5, 6, or 7 bytes with the comment "only structs of size 8,16,32,64 bits can be packed to register", `unaffected` listing `RBX RBP RDI RSI RSP R12` to `R15` and `XMM6` to `XMM15`, and a `localrange` of stack 8 to 39, which is the shadow store. `AARCH64.cspec` declares `__cdecl` whose first entry is `x8` with `storage="hiddenret"`, then `q0` to `q7` and `x0` to `x7`, `convert_to_ptr` for structs of 17 bytes or more, and `killedbycall` including `x8` with the comment "indirect result location register, which is not reflected in the pentry list". The decompiler's final stage is named "Establish Function's Prototype"; the analyzers are "Call Convention ID" and "Decompiler Parameter ID"; the program option "Prototype Evaluation" picks the default model.

**IDA Pro and IDA Free (Hex-Rays, commercial; current release 9.4, build 9.4.260714).** The function type is a C declaration set through SetType, and "IDA will use the type information to comment the disassembly with the information about function arguments." Locations that no standard convention produces are written in IDA's own convention: `int __usercall func@<ebx>(int x, int y@<esi>)` puts the result in `EBX` and `y` in `ESI`, and `@<^12.4>` names a stack location by offset and size. `__userpurge` is the same with callee stack cleanup. The same page lists `__spoils` for the clobbered set, `__hidden`, `__return_ptr`, and `__struct_ptr` for the implicit arguments this lesson recovers by hand. The decompiler's "Decompile as call" action accepts a `__usercall` prototype for one instruction. IDA Free supports x86 and x86-64 only.

**Binary Ninja 6.0 "Krypton" (Vector 35, commercial, with a Free edition that decompiles x86, x86_64, ARMv7, and AArch64).** A `Platform` "contains all information related to the execution environment of the binary, mainly the calling conventions used, the operating system, and the architecture", and the list includes `linux-x86_64`, `windows-x86_64`, `linux-aarch64`, and `mac-aarch64`, each with a `default_calling_convention`. A `CallingConvention` has `int_arg_regs`, `float_arg_regs`, `callee_saved_regs`, `caller_saved_regs`, `int_return_reg`, `high_int_return_reg`, `float_return_reg`, and two flags that encode the differences in this lesson directly: `arg_regs_share_index`, "When True, the Nth argument consumes the Nth slot of both the integer and float register lists regardless of its type", and `stack_reserved_for_arg_regs`, "the shadow/home space used by the Windows x64 calling convention". `eligible_for_heuristics`, `required_arg_regs`, and `required_clobbered_regs` drive its heuristic convention detection. Platform types are C headers under `types/platform/`, one per platform name.

**radare2 6.2.4 (LGPL-3.0, run here).** `afcl` lists the conventions the architecture plugin knows: `amd64 amd64syscall dlang golang golang_abi0 ms p9 reg swift` for x86-64 and `arm64 dlang golang p9 reg swift` for AArch64. `afc` reports the convention of the current function, `afcr` prints `cc.amd64.arg0: rdi` through `arg5: r9` and `ret0: rax`, and the profiles are SDB files named `cc-ARCH-BITS.sdb`. radare2 picked `amd64` for the ELF object and `ms` for the COFF object, which is the correct split. `afv` lists arguments and variables, and `afs` prints a signature. On the Linux `-O2` object `afv` found seven arguments for `eight_args` and dropped `rcx`; on the Windows object it found `rcx, rdx, r8` and four stack slots and dropped `r9`. Both missing registers appear only inside a `lea`. On `mixed` it reported `double arg1 @ xmm0, arg2 @ xmm1, arg3 @ xmm2` on Linux and no arguments at all on Windows. On AArch64 it found `x0` to `x7` for `eight_args`, and for `big_ret` it listed `x0` and `double arg2 @ d1` where the function reads `x8` and loads a constant into `q1`. Every `afs` signature starts with `void`, because the return type is not inferred. At `-O0`, where every argument is stored to the frame, `afv` found all eight arguments of `eight_args` with `rbp+0x10` and `rbp+0x18` for the stack pair.

**rizin 0.9.1 (LGPL-3.0, run here) and Cutter 2.5.0.** `afcl` lists `amd64 amd64syscall ms reg swift`. `afc` returned `amd64` for the COFF object, so the Microsoft profile exists and was not selected from the format. `afi` listed seven arguments for `eight_args` on Linux, again without `rcx`, and on Windows `r8, rcx, rdx` with three stack slots, without `r9` and without the slot at `0x40`. `afv` does not exist; the listing command is `afvl`. Cutter is the graphical front end over rizin.

**angr 10.0.3 (BSD-2, run here).** `CFGFast` followed by `CompleteCallingConventions(recover_variables=True)` sets `function.calling_convention` to `SimCCSystemVAMD64`, `SimCCMicrosoftAMD64`, or `SimCCAArch64`, by binary format, and `function.prototype` to a signature. It recovered all eight arguments of `eight_args` on all three targets, the hidden pointer of `big_ret` on x86-64 as `(BOT*, long long) -> BOT*`, the by-reference struct of the Windows `by_value` as `(BOT*, BOT*) -> BOT*`, and the System V variadic `sum_varargs` as `(long long, ...)`. Its gaps are different from radare2's: `mixed` came back as `(long long, long long, double, float)` on System V and AArch64, the right registers in the wrong order, because the integer list is printed before the float list; the AArch64 `big_ret` came back as `(long long) -> double`, so the `x8` convention was missed and the vector stores were read as a result; and the AArch64 `sum_varargs` came back with 16 parameters, the whole register save area.

**Others.** Hopper 6.6.0 is a commercial disassembler and decompiler for macOS and Linux; its convention handling was not run or documented for this lesson. lldb 1703 and gdb show the live frame with `frame info` and `register read`, which is lesson 42's dynamic view of the same offsets. Compiler Explorer shows the three listings side by side from source, which is the fastest way to confirm a rule before you look for it in bytes.

| Concept | Ghidra | IDA | Binary Ninja | radare2 / rizin | angr | this lesson |
|---|---|---|---|---|---|---|
| The convention object | `prototype` in a `.cspec` | calling convention keyword in the function type | `CallingConvention` on a `Platform` | `afc` name, `cc-ARCH-BITS.sdb` | `SimCC` subclass | `expected_locations(abi, name)` |
| Default per target | `<default_proto>` per cspec | compiler setting | `Platform.default_calling_convention` | `afc=`, `anal.cc` | by format | `describe_object()` |
| Argument registers | `<pentry>` list, `<group>` for positional | `@<reg>` in `__usercall` | `int_arg_regs`, `float_arg_regs`, `arg_regs_share_index` | `cc.NAME.argN` | `ARG_REGS`, `FP_ARG_REGS` | `INT_ARG_REGS`, `FLOAT_ARG_REGS` |
| Shadow store | `localrange` stack 8 to 39 | implicit | `stack_reserved_for_arg_regs` | `cc.ms.argn=stack` | `STACKARG_SP_DIFF` | `STACK_ARG_BASE[WIN64] = 40` |
| Hidden result pointer | `hidden_return`, `storage="hiddenret"` | `__return_ptr`, `__hidden` | return type too large for `int_return_reg` | not modelled | `BOT*` first argument | `HIDDEN_RETURN_REG` |
| Callee-saved | `<unaffected>` | `__spoils` lists the opposite | `callee_saved_regs` | profile | `CALLEE_CLEANUP` and arch | `CALLEE_SAVED` |
| Assigning one to a function | "Call Convention ID" analyzer, "Establish Function's Prototype" | user or type library | heuristic detection with `required_arg_regs` | `afc`, `afva`, `aaft` | `CallingConventionAnalysis` | read-before-write plus the rulebook |

## Build It

Run the demo:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames
python3 code/main.py
```

The output is one JSON report. For each of the seven objects it names the format, the machine, and the ABI, and for each of the twelve functions it gives the prologue bytes, the saved registers with entry offsets, the frame size, the frame pointer, the parameter registers, the stack argument offsets, the spills, the return register or hidden pointer, the call depths, and the outgoing registers and stores of the callers. Every function ends with its checks: the rule, the expected value from the signature, the observed value from the bytes, and whether they agree. The report ends with the two unwind cross-checks and the tool captures. Across the 84 function analyses, 489 checks run and all 489 agree.

Expected shape:

```json
{
  "objects": {
    "convention-x86_64-windows-O2": {
      "format": "COFF", "machine": "AMD64", "abi": "Microsoft x64", "checks": "73/73 agree",
      "functions": {
        "keeps": {
          "prologue": ["56  pushq %rsi", "57  pushq %rdi", "53  pushq %rbx", "48 83 ec 20  subq $0x20, %rsp"],
          "frameBytes": 56,
          "savedRegisters": [{"register": "rsi", "entryOffset": -8}, {"register": "rdi", "entryOffset": -16}, {"register": "rbx", "entryOffset": -24}],
          "parameterRegisters": ["rcx"],
          "returnRegisters": ["rax"],
          "calls": [{"callee": "ext", "depth": 56}],
          "checks": [{"rule": "Microsoft x64: the caller must always allocate ...", "expected": "at least 32 bytes ...", "observed": [56], "agree": true}, "..."]
        }
      }
    }
  },
  "sehCrossCheck": ["..."],
  "ehFrameCrossCheck": {"...": "..."}
}
```

Read `code/main.py` in this order:

1. `describe_object()` reads the ELF, COFF, or Mach-O header and the symbol table and returns the ABI and the function list.
2. `parse_listing()` splits the `llvm-objdump -d -r` text into functions, keeps the relocation target of every call and jump, and strips comments with the marker of the right syntax: `#` for AT&T, `//` and `;` for AArch64, where `#` introduces an immediate.
3. `effect_x86()` and `effect_arm()` turn one instruction into reads, address reads, writes, loads, stores, and a stack pointer delta. The last AT&T operand is the destination; the first AArch64 operand is the destination except in stores, compares, and branches. `lea` reads an address and loads nothing. The destination of `mov`, `cvtsi2sd`, `setcc`, and the zero idiom `xor r, r` is a write only. A call writes the whole volatile set. A pre-indexed store moves `sp` before the access and a post-indexed load moves it after.
4. `analyze_function()` walks the body once up to the first `ret` or tail jump. It tracks the depth of the stack pointer below its entry value, so a memory operand `disp(%rsp)` is at entry offset `disp - depth` and `disp(%rbp)` is at `frame_pointer + disp`. It records argument-class registers that are read before they are written, loads at or above the first stack argument offset of the ABI, stores of argument registers into the frame, accesses below the current stack pointer, and the depth at every call.
5. `_return_registers()` keeps a result register when its last access before the exit is a write. A read as a data operand kills the candidate; a read as an address base does not, which is what keeps `rax` alive in `big_ret` under Microsoft x64, where `movq %rcx, %rax` is followed by stores through `(%rax)`.
6. `expected_locations()` applies the three rulebooks to a C signature: the two System V lists with eightbyte classes, the Microsoft positional slots with by-reference structs, and the AAPCS64 counters with `x8` for results above 16 bytes.
7. `run_checks()` compares the two and adds the frame rules: callee-saved registers written must be saved, `(rsp + 8) % 16 == 0` or `sp % 16 == 0` at every call, 32 bytes of shadow at every Microsoft call, no access below the stack pointer under Microsoft and AAPCS64 and at most 128 bytes under System V, and an epilogue that mirrors the prologue with the stack pointer back at its entry value.
8. `seh_cross_check()` and `eh_frame_cross_check()` read the unwind data of the objects built without `-fno-asynchronous-unwind-tables` and compare it with the prologue parse.

Three more commands exist. `python3 code/main.py analyze convention-x86_64-windows-O2 keeps` prints one function. `python3 code/main.py object FILE` prints the header's verdict. `python3 code/main.py seh` prints the decoded `UNWIND_INFO` of every function that has one.

## Use It

Use the analyzer in this order on a new object you built.

1. Run `python3 code/main.py object FILE.o` and write down the ABI it names. If the header and your build command disagree, stop; one of them is wrong.
2. Capture `llvm-objdump -d -r FILE.o` next to the object and run the analysis. Read the prologue bytes and the saved registers before anything else, and compare the frame size with the pushes and the `sub`.
3. Read the parameter registers and the stack offsets against your source signature. A register that the signature does not explain is a hidden pointer, a variadic marker, or a scratch register that the analyzer mistook for an argument. The last case is a bug in the effect table. Fix it with a general rule for that instruction.
4. Read the checks that disagree, if any. Each names the rule it rests on, so the first thing to check is the rule, then the bytes, then the analyzer.
5. When the object has unwind data, run the cross-check. Two derivations that agree are the strongest evidence this lesson produces.
6. When another tool is installed, capture its output with the exact command and compare. Where it agrees you have three derivations. Where it differs you have a specific register and a specific instruction to look at, and that is a finding for lesson 35.

## Interactive Lab

### Lab A: one instruction, three effects

From the `code` directory, open Python:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames/code
python3 -q
```

Run:

```python
from main import *
effect(Instruction(0, "48 8d 04 0a", "leaq", "(%rdx,%rcx), %rax"), SYSV)
effect(Instruction(0, "f2 0f 2a d7", "cvtsi2sd", "%edi, %xmm2"), SYSV)
effect(Instruction(0, "a9bd7bfd", "stp", "x29, x30, [sp, #-0x30]!"), AAPCS64)
```

Write down the reads, the address reads, the writes, and the stack delta you expect before each call. Then change `[sp, #-0x30]!` to `[sp], #0x30` with `ldp` and watch the delta move from `sp_delta` to `post_sp_delta`.

### Lab B: the frame of keeps

```python
info, listing = load_fixture("convention-aarch64-linux-O2")
keeps = analyze_function("keeps", listing["keeps"], info.abi)
keeps.saved
keeps.frame_pointer
[c.to_dict() for c in frame_cells(keeps)]
```

Compare the offsets with the hand decode above. Then load `convention-arm64-macos-O2` and run the same three lines; the record moves to -16 and four registers sit below it. Then load `convention-x86_64-linux-O2-fp` and read `saved` for `keeps`: the frame pointer is back, and so is a `pushq %rax` whose only job is to make `(rsp + 8)` a multiple of 16 at the call.

### Lab C: read-before-write on mixed

```python
info, listing = load_fixture("convention-x86_64-linux-O2")
mixed = analyze_function("mixed", listing["mixed"], info.abi)
mixed.param_registers
mixed.return_registers
expected_locations(SYSV, "mixed")["parameters"]
expected_locations(WIN64, "mixed")["parameters"]
```

The System V list is `rdi, xmm0, rsi, xmm1` and the Microsoft list is `rcx, xmm1, r8, xmm3`. Now load the Windows object and run the first three lines again. Then open the radare2 capture for the Linux object and find `[afv mixed]`: three doubles. Find the instruction that explains the third one.

### Lab D: the unwinder's second opinion

```python
for row in seh_cross_check():
    print(row["function"], row["sizeOfProlog"], row["unwindPushes"], row["unwindAllocBytes"], row["agree"])
for row in eh_frame_cross_check("convention-x86_64-linux-O2-eh"):
    print(row["function"], row["cfiSaved"], row["cfiMaxOffset"], row["deepestStack"], row["agree"])
```

Find the `pushq %rax` of `sum_varargs` in the SEH table and explain why the unwind code records it as an allocation. Then find `call8` in the `.eh_frame` table and explain the 32.

## Practice Lab

Add a fourth target and a fourth rulebook.

Requirements:

- Compile `convention.c` with `-target x86_64-apple-macos -O2` and capture its listing. Extend `describe_object()` to read the Mach-O `cputype` 0x01000007 and map it to the System V psABI, which Apple follows on x86-64, with the `_` symbol prefix.
- Check that every function agrees with the System V checks. Record the one difference you find in the prologues: Darwin keeps the frame pointer at every optimization level.
- Add a `-fstack-protector-strong` build of the Linux x86-64 object. Extend the prologue scan so the canary load from `%fs:0x28` and the store below the locals are recorded as a `canary` cell, and the compare before `ret` as the check that guards the epilogue.
- Add a test that fails when a canary store is counted as a spilled argument.
- Write the frame of `with_canary`-style code by hand before you run the analyzer, and keep the drawing beside the test.

Success means `python3 code/main.py` reports the new object with every check agreeing, and the frame cells of the protected function show the canary between the locals and the saved registers.

## Lesson Artifact

This lesson includes `outputs/skill-calling-conventions-and-stack-frames.md`. Use it to turn an object you built, its listing, and the C signatures into parameter locations, a frame layout, a return register, and a check of every inference against the rule it rests on and against the compiler's unwind data. It requires the header's ABI verdict first, forbids reading `cvtsi2sd` or `xor r, r` destinations as reads, and ends with the first disagreement.

## Verify It

Run the demo and the deterministic suite:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

Verification should prove:

- the ELF, COFF, and Mach-O headers of the seven objects name System V, Microsoft x64, AAPCS64, and Apple arm64
- every object's symbol table lists the same twelve functions, with the Mach-O `_` prefix and the `ltmp0` label resolved
- the listing parser keeps `ext` as the call target and keeps AArch64 immediates such as `#-0x30` intact
- `leaq (%rdx,%rcx), %rax` reads two address registers and loads nothing; `xorl %eax, %eax` and `cvtsi2sd` are write-only; a pre-indexed `stp` moves `sp` before the store and a post-indexed `ldp` after the load
- `keeps` at `-O2` is `55 41 56 53` on System V with a 24-byte frame and no frame pointer, `56 57 53 48 83 ec 20` on Microsoft x64 with a 56-byte frame, and `a9bd7bfd` first on AArch64 with the record at -48
- the Apple build puts the record at -16 above four saved registers
- every function has a frame pointer at `-O0` on Linux and none at `-O2`, and `-fno-omit-frame-pointer` brings it back with an alignment push
- the `-O0` leaf uses 8 bytes of red zone under System V, `pushq %rax` under Microsoft x64, and `sub sp, sp, #0x10` under AAPCS64; `-mno-red-zone` removes the red zone use
- every epilogue mirrors its prologue and the stack pointer is back at entry
- `eight_args` reads six registers and slots 8 and 16, four registers and slots 40 to 64, or `x0` to `x7`, at both optimization levels
- `mixed` is `rdi, xmm0, rsi, xmm1` under System V and `rcx, xmm1, r8, xmm3` under Microsoft x64, with `xmm0` as the result on both
- the 16-byte struct travels in two registers under System V and AAPCS64 and by reference behind a hidden pointer under Microsoft x64
- the 32-byte struct returns through `rdi`, `rcx`, or `x8`
- the variadic callee reads `%al`, homes `rdx, r8, r9` at 16, 24, 32, saves `x1` to `x7` and `q0` to `q7`, or reads the caller's stack pointer on Apple
- the callers set the expected registers, store 7 and 8 at 0 and 8 or 5 to 8 at 32 to 56, zero `%al` for the variadic call, and pass the result buffer address in `rdi`, `rcx`, or `x8`
- all 489 checks agree with their rules
- the six `UNWIND_INFO` entries match the prologue parse and the leaves have none
- the 24 FDEs match the saved-register offsets and the deepest stack pointer
- the tool captures record radare2's `amd64` and `ms`, rizin's `amd64` on the COFF object, the missing `rcx`, the three doubles, and angr's prototypes
- the figure data embedded in the site module equals the analyzer's output

## Production Failure Modes

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| COFF object read as System V | `rdi` and `rsi` as arguments that the function never reads | The header says 0x8664; the convention is Microsoft x64 |
| Register read only inside a `lea` | Seven arguments for an eight-argument function | Base and index registers are reads |
| `cvtsi2sd` destination counted as a read | A third double argument in `xmm2` | The first write to `xmm2` is a write; `mixed` has two SSE arguments |
| Positional slots read as sequences | `xmm0` named as the double argument on Windows | Slot 1 is `XMM1`, slot 3 is `XMM3` |
| `push rbp` taken as a frame pointer | A frame pointer in an `-O2` function that uses `rbp` as an accumulator | Only `mov %rsp, %rbp` after the push creates one |
| Red zone measured from the entry stack pointer | 216 bytes "below the stack pointer" | 128 bytes below the current stack pointer after an 88-byte `sub` |
| Shadow store treated as locals | Stack arguments at 8 to 32 | Microsoft stack arguments start at 40 |
| `lea` treated as a load | A stack argument at `0x60(%rsp)` in a variadic callee | `lea` computes `overflow_arg_area`; it loads nothing |
| Hidden pointer read as a normal argument | `big_ret(void *, long long)` | The pointer is stored through and copied to `rax`, `rax`, or stays in `x8` |
| Deepest CFA compared with the prologue frame | A mismatch on a caller that pushes outgoing arguments | Compare with the deepest stack pointer the body reaches |
| Convention asserted from the ISA | `amd64` for a COFF object | The format picks the rulebook, then the ISA picks the registers |
| Prototype trusted from one tool | Three doubles, or sixteen variadic parameters | The source signature or a second derivation must agree |

## Operational Rule

Read the header before the first instruction, and name the rulebook. Place every saved register and every argument at an offset from the entry stack pointer, and check it against the rule that put it there and against the unwind data the compiler wrote for the same frame. Treat a tool's prototype as a claim until the bytes or the source confirm it.

## Further Reading

- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, Version 1.0 (sections 3.2.1 to 3.2.3, 4.2.4)](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Microsoft x64 calling convention](https://learn.microsoft.com/en-us/cpp/build/x64-calling-convention)
- [Microsoft x64 stack usage](https://learn.microsoft.com/en-us/cpp/build/stack-usage)
- [Microsoft x64 prolog and epilog](https://learn.microsoft.com/en-us/cpp/build/prolog-and-epilog)
- [Microsoft x64 exception handling: RUNTIME_FUNCTION, UNWIND_INFO, UNWIND_CODE](https://learn.microsoft.com/en-us/cpp/build/exception-handling-x64)
- [Arm Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64), release 2025Q4](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [Apple: Writing ARM64 code for Apple platforms](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms)
- [DWARF Debugging Information Format Version 5, section 6.4 Call Frame Information](https://dwarfstd.org/doc/DWARF5.pdf)
- [Clang driver frame-pointer defaults, `useFramePointerForTargetByDefault` in `CommonArgs.cpp`](https://github.com/llvm/llvm-project/blob/main/clang/lib/Driver/ToolChains/CommonArgs.cpp)
- [Clang command line reference: `-fomit-frame-pointer`, `-momit-leaf-frame-pointer`](https://clang.llvm.org/docs/ClangCommandLineReference.html)
- [Fedora 38 change: frame pointers by default](https://fedoraproject.org/wiki/Changes/fno-omit-frame-pointer)
- [Ubuntu 24.04: performance engineering with frame pointers by default](https://ubuntu.com/blog/ubuntu-performance-engineering-with-frame-pointers-by-default)
- [Ghidra compiler specification: `x86-64-gcc.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/x86/data/languages/x86-64-gcc.cspec)
- [Ghidra compiler specification: `x86-64-win.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/x86/data/languages/x86-64-win.cspec)
- [Ghidra compiler specification: `AARCH64.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/AARCH64/data/languages/AARCH64.cspec)
- [Hex-Rays: SetType and the `__usercall` convention](https://docs.hex-rays.com/ida-actions/settype)
- [Hex-Rays: Decompile as call](https://docs.hex-rays.com/ida-actions/hx_userdefinedcall)
- [Binary Ninja API 6.0: `callingconvention` module](https://api.binary.ninja/binaryninja.callingconvention-module.html)
- [Binary Ninja API 6.0: `platform` module](https://api.binary.ninja/binaryninja.platform-module.html)
- [Binary Ninja user documentation: platform types](https://docs.binary.ninja/guide/types/platformtypes.html)
- [The Official Radare2 Book: calling conventions](https://book.rada.re/analysis/calling_conventions.html)
- [The Official Radare2 Book: code analysis](https://book.rada.re/analysis/code_analysis.html)
- [angr documentation: decompiler analysis passes, including calling convention recovery](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [radare2 6.2.4 release](https://github.com/radareorg/radare2/releases/tag/6.2.4)
- [rizin 0.9.1 release](https://github.com/rizinorg/rizin/releases/tag/v0.9.1)
