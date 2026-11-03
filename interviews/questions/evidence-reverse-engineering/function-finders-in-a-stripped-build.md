---
id: function-finders-in-a-stripped-build
title: nm says one function, the file has five
card: evidence-reverse-engineering
kind: tradeoff
level: 2
roles: [applied-ai-engineer, agentic-ai-engineer]
rounds: [screen, system-design]
tags: [reverse-engineering, stripped-binary, function-starts, signatures, mach-o]
minutes: 8
lessons: [phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries]
manuals: []
practice: []
cheatsheet: [re-from-scratch-tools]
related: [evidence-reverse-engineering/sweep-trap-addq-at-0x13]
updated: 2026-11-03
---

A stripped arm64 executable holds five functions, and `nm` lists one name. Compare four ways to recover the function starts, score each against the unstripped twin at `-O0` and `-O2`, and say how you name the functions afterwards and where that naming collides.

## Short answer

The link editor's own table wins: `LC_FUNCTION_STARTS` is nine bytes of uleb128 deltas that list all five starts at both levels, and `strip` does not touch it. A prologue scan for the pre-indexed frame store finds 0 of 5, because the compiler emits `sub sp, sp, #N` first; a mask for that `sub` finds 5 of 5 at `-O0` and 1 of 5 at `-O2`, where four leaf functions have no frame at all. Call targets plus the entry point find 5 of 5, since a `bl` into the middle of a function is something a compiler does not emit for C. Names come from signatures built from your own objects, a 32-byte pattern with relocation bytes wildcarded and a CRC16 of the tail; at `-O2` two functions share their first 36 bytes because one inlined the other, and the tail byte at 44 and the lengths 60 against 72 split the collision.

## Full answer

### The four finders

| Method | What it reads | `-O0` | `-O2` | Why |
|---|---|---|---|---|
| `LC_FUNCTION_STARTS` | uleb128 deltas in `__LINKEDIT` | 5 of 5 | 5 of 5 | written for the unwinder and crash reporter; survives `strip` |
| frame-store prologue | `stp x29, x30, [sp, #-0x10]!` | 0 of 5 | 0 of 5 | the compiler stores the pair at a positive offset after `sub sp` |
| `sub sp` mask | `(word & 0xff0003ff) == 0xd10003ff` | 5 of 5 | 1 of 5 | leaf functions at `-O2` allocate no frame; one starts with `cbz` |
| call targets | every `bl` inside `__text`, plus the `LC_MAIN` entry | 5 of 5 | 5 of 5 | nothing calls `main`, so the entry is added by hand |

No false positives appeared here because the program is small. One-byte patterns such as the x86-64 `push rbp` byte hit inside other instructions, which is why real pattern files pair a start pattern with a byte that must end the previous function. Prefer the tables the link editor wrote, then call targets to fill gaps, and scan for bytes last.

### What strip leaves per format

The names the loader binds survive everywhere: imports and exports in the dynamic symbol table, the import and export directories of a PE image, the chained imports table and the exports trie of a Mach-O. Function starts survive as unwind data (`.eh_frame` unless built without unwind tables), as `.pdata` entries for non-leaf functions in a PE image, and as `LC_FUNCTION_STARTS`. The static symbol table and the debug sections go. A fully stripped library whose symbol table holds zero records still links, because the link editor reads the exports trie.

### Signatures and the collision

A signature is the first 32 bytes of a function with every relocated byte marked variant, a CRC16 over the bytes after the pattern up to the first variant byte, and the names the function references. Built from the unstripped objects and applied at every recovered start, the signatures name all five functions at both levels. At `-O2` the two colliding functions produce identical pattern and CRC lines; the report records both candidates and the byte that decided them. A collision that nothing separates stays an unknown. The premise is checked too: every non-variant byte of each object function equals the byte at the same offset in the linked file, so the link editor changed only the relocated words.

## Follow-ups

- **Level 2:** Why does the frame-store scan find nothing even at `-O0`? Expected: the compiler emits `sub sp` first and stores the frame record at a positive offset, so the pre-indexed form never occurs.
- **Level 3:** Why can `strip` not remove the function starts table? Expected: the unwinder and the crash reporter read it, the link editor writes it into `__LINKEDIT`, and only the symbol table is the debugger's.
- **Level 3:** Two signatures match at the same start. What do you record? Expected: both candidates, the tail byte and the lengths that split them, and an unknown when nothing does.
- **Level 4:** Which table plays this role in a PE image, and whom does it omit? Expected: `.pdata` with its `RUNTIME_FUNCTION` entries, which omit leaf functions that allocate no stack and call nothing.

## Wrong answers

- "`nm` shows one function, so there is one." It shows the symbol table; the link editor's starts table lists five.
- "Scan for the standard prologue." At `-O2` four of five functions have no frame; the scan reports what the compiler chose to emit.
- "A matching CRC proves the name." Two functions shared pattern and CRC; the tail byte and the lengths decided, and the record says so.

## Taught in

The [linking lesson](../../../phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/) scores the four finders against the unstripped twin and builds the signatures that collide at `-O2`.
