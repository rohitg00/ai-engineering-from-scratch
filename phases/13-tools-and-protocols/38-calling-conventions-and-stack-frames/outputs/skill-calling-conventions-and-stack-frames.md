---
name: calling-conventions-and-stack-frames
description: Recover the calling convention and the stack frame of a function from its disassembly, name the ABI rule behind every inference, and check each one against the source signature and the compiler's own unwind data.
version: 1.0.0
phase: 13
lesson: 38
tags: [reverse-engineering, calling-conventions, abi, stack-frames, system-v, microsoft-x64, aapcs64, prologue, unwind]
---

Given an object file that you built yourself, its `llvm-objdump -d -r` listing, and the C signatures of its functions, produce the parameter locations, the frame layout, the return register, and a check of every inference against the ABI rule it rests on. Use this skill with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

## Required inputs

- The object file, the exact compiler command, and the compiler version.
- The listing from `llvm-objdump -d -r` of that object, stored beside it.
- The C signature of every function under study, with the byte size of every struct type.
- The ABI the object was built for. Read it from the header: ELF `e_machine` 62 is the System V AMD64 psABI, COFF Machine 0x8664 is Microsoft x64, ELF `e_machine` 183 is AAPCS64, Mach-O `cputype` 0x0100000c is Apple arm64.
- The analyzer from lesson 38 (`code/main.py`) or an equivalent that separates data reads from address reads.
- Optional: the object built without `-fno-asynchronous-unwind-tables`, for `.eh_frame` or `.pdata` and `.xdata`.

## Procedure

1. Identify the ABI from the object header, and write down which rulebook applies before reading any instruction.
2. Read the prologue: on x86-64 the pushes, the optional `mov %rsp, %rbp`, and the `sub $N, %rsp`; on AArch64 the `sub sp`, the `stp` and `str` of x19 to x30 with sp as base, and the `mov x29, sp` or `add x29, sp, #k`. Record each saved register with its offset from the stack pointer at entry, and the frame size as the deepest stack pointer the prologue reaches.
3. Walk the body once and record every argument-class register that is read before it is written. Count base and index registers of memory operands and of `lea` as reads. Treat the destination of `mov`, `lea`, `cvtsi2sd`, and the zero idiom `xor r, r` as a write only. After a call, mark the volatile set as written.
4. Record every load from above the entry stack pointer as a stack argument slot: 8(%rsp) and up under System V, 40(%rsp) and up under Microsoft x64 above the 32-byte shadow store, 0(sp) and up under AAPCS64. Convert `rbp` and `x29` based offsets through the frame pointer offset you recorded.
5. Find the return register: the result register whose last access before the exit is a write. A read as a data operand kills the candidate; a read as an address base does not. A hidden result pointer is the first argument register that is both stored through and copied to `rax`, or `x8` on AArch64.
6. Apply the ABI rules to the C signature: System V classes each eightbyte INTEGER, SSE, or MEMORY and takes registers from two independent lists; Microsoft x64 assigns slot k to RCX/RDX/R8/R9 or XMM0 to XMM3 and passes structs that are not 1, 2, 4, or 8 bytes by reference; AAPCS64 assigns x[NGRN] and v[NSRN] and uses x8 for results larger than 16 bytes. Compare the expected locations with the observed ones and record agreement per rule.
7. Check the frame rules: callee-saved registers written must appear in the saved set; `(rsp + 8) % 16 == 0` or `sp % 16 == 0` at every call; at least 32 bytes below the return address at every Microsoft x64 call; no access below the stack pointer under Microsoft x64 or AAPCS64, at most 128 bytes under System V; the epilogue restores what the prologue saved and the stack pointer is back at its entry value.
8. When unwind data exists, decode it and compare: `UWOP_PUSH_NONVOL` and `UWOP_ALLOC_*` codes against the pushes and the allocation, `DW_CFA_offset` rules against the saved-register offsets, the deepest CFA offset against the deepest stack pointer.
9. When another tool is available, capture its prototype or argument list for the same function with the exact command, and record where it agrees and where it disagrees with the source and with the bytes.

## Required report

For every function, report:

- object name, format, machine, ABI, compiler, build command, listing path
- prologue bytes and text, saved registers with entry offsets, frame bytes, frame pointer offset or none
- argument registers read before written, stack argument offsets, spilled argument registers with offsets, home stores under Microsoft x64
- return register or hidden pointer, with the instruction that set it
- call depths, shadow bytes, bytes used below the stack pointer
- every check as rule, expected, observed, agree
- unwind cross-check per function when available
- other tools' outputs with the command, and each disagreement as a finding

## Hard rejects

- Reading an x86-64 object as System V because it is x86-64. COFF means Microsoft x64.
- Counting the destination of `cvtsi2sd` or `xor r, r` as a read, which invents a floating-point or integer argument.
- Dropping a register that is read only as a `lea` base or index, which loses an argument.
- Treating a register that is written and then consumed as a return register.
- Treating `push rbp` as proof of a frame pointer. Only `mov %rsp, %rbp` after it makes one.
- Reporting a stack argument from a `lea`; `lea` computes an address and loads nothing.
- Measuring red zone use from the entry stack pointer instead of from the current one.
- Comparing the deepest CFA offset with the prologue frame when the body pushes outgoing arguments.
- Accepting a tool's prototype without the source signature or the bytes to check it against.
- Analysing a program you did not build or do not have permission to study.

## Produce

Return these sections:

1. ABI: format, machine, rulebook, with the header bytes that decided it.
2. Prologue and Frame: bytes, saved registers, frame size, frame pointer, red zone or shadow use.
3. Parameters: registers and stack slots observed, expected from the signature, agreement per rule.
4. Result: return register or hidden pointer and the instruction that set it.
5. Call Sites: depth, alignment, shadow bytes, outgoing registers and stores.
6. Unwind Cross-Check: unwind codes or CFI rules against the prologue parse.
7. Other Tools: command, output, and each disagreement as a finding.

End with the first disagreement. If there is none, state the number of checks that agreed and the number of functions covered.
