---
id: sweep-trap-addq-at-0x13
title: Every byte decoded, and the jump lands inside an instruction
card: evidence-reverse-engineering
kind: debug
level: 2
roles: [applied-ai-engineer, agentic-ai-engineer]
rounds: [debugging, coding]
tags: [reverse-engineering, disassembly, linear-sweep, recursive-descent, oracle]
minutes: 8
lessons: [phases/13-tools-and-protocols/33-disassembly-and-control-flow, phases/13-tools-and-protocols/37-the-reverse-engineering-landscape]
manuals: []
practice: []
cheatsheet: [re-from-scratch-tools]
related: [evidence-reverse-engineering/addend-0x10-table-0x14]
updated: 2026-11-03
---

A 24-byte function keeps a four-byte table `31 c0 90 48` inside its body and jumps over it with `jmp 0x14`. `llvm-objdump -d` prints `xorl %eax, %eax`, `nop`, and `addq $0x1, %rax` at `0x13`; every byte decodes and a `retq` is present. Name the three ways this listing is wrong, say which method gets it right and why the reference tool shares the mistake, and say what agreement between your decoder and that tool does and does not prove.

## Short answer

The listing is wrong three times: the jump at `0xe` targets `0x14` and no instruction in the listing starts there; the instruction that runs at `0x14` is a 32-bit `addl $0x1, %eax`, while the listing shows a 64-bit `addq` one byte early because the table's last byte `48` was swallowed as a REX prefix; and the four table bytes appear as code. Recursive descent from the symbol follows the jump, decodes six instructions, reads `addl` at the target and claims no table or padding byte. `llvm-objdump` is itself a linear sweep, so it inherits the sweep's blind spot: agreement with it checks the decoder on instruction boundaries, and only the descent checks which instructions run.

## Full answer

### Two methods, opposite failures

A linear sweep starts at the first byte of the code section, decodes one instruction, continues at the byte after it, and stops at the end; data inside code gets decoded as instructions, and on x86 the decoder usually re-synchronises within a few bytes, which is why the error is hard to see and why the method is said to fail silently. Recursive descent starts at a known entry, follows direct jumps and both arms of a conditional, continues after a call, stops at a return, and keeps a visited set. Its failure is the opposite one: an indirect jump has no target in its bytes, so the walk stops there and every block reachable only through it stays unknown, which is what happens at `jmpq *%rax` in the unoptimized `grade`.

### The trap under five tools

The comparison harness reports the sweep with 8 instruction starts in the trap range, with extra starts at `0x10`, `0x12` and `0x13` and a missing start at `0x14`. Three graph builders report 6 starts, 2 blocks and 1 edge, and leave `0x10` to `0x14` unclaimed. One framework also invents a function on the table bytes, two instructions in a four-byte block, so the REX byte at `0x13` belongs to no instruction. The last finding is the useful one: no graph builder decodes `0x10` to `0x14`, so those bytes sit inside a function and are data.

### What the oracle is for

The decoder must agree with `llvm-objdump -d` on every instruction of every fixture, and it does, on 86, 56, 84 and 11 instructions, 237 in all. That agreement proves the decoder reads prefixes, opcodes, ModRM, SIB, displacements and immediates the way the manual says. It proves nothing about reachability, because the oracle never asked. A measurement of nine disassemblers on 981 compiler-generated binaries found inline data rarer than the literature assumed and function starts the hard primitive; the trap is rare in compiler output, and the indirect jump is common.

### Byte accounting

Compare the two methods byte by byte. Bytes that only the sweep claims are padding, data, code behind an indirect jump, or code of a function with no known entry. The sweep decodes the whole section, so these are the bytes to account for. Bytes the descent claims are the ones it reaches from that entry; that is reachability, not proof that they run.

## Follow-ups

- **Level 2:** Change the last table byte from `48` to `e8` and rebuild. What does the sweep print? Expected: a `callq` that swallows the `addl` and the `retq`, with a target outside the section; the function appears to have no return.
- **Level 3:** Why does the descent stop at `jmpq *%rax` in the unoptimized `grade`, and what fixes it? Expected: no target is in the bytes; the resolver reads the five relocations of the table and pushes four distinct targets.
- **Level 3:** What does "fail silently" mean in operational terms? Expected: the decoder re-synchronises within a few bytes and detects nothing unless it hits an invalid opcode, so a wrong listing looks complete.
- **Level 4:** How do you classify bytes that the descent does not claim? Expected: padding, data, code behind an indirect jump, or part of a function with no known entry; account for every byte as one of these or as reached by the descent.

## Wrong answers

- "The reference tool is right because it is the reference." It is a sweep; it is the oracle for decoding, not for reachability.
- "Use the descent alone." It stops at indirect jumps and leaves reachable code unknown until a table is recovered.
- "Every byte decoded, so the listing is complete." A listing says which bytes form which instruction, not which instructions run.

## Taught in

The [disassembly lesson](../../../phases/13-tools-and-protocols/33-disassembly-and-control-flow/) builds both methods and the trap fixture, and the [landscape lesson](../../../phases/13-tools-and-protocols/37-the-reverse-engineering-landscape/) runs five tools over it and accounts for every byte.
