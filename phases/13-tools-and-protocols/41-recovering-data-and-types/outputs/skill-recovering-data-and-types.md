---
name: recovering-data-and-types
description: Turn a disassembly listing and an optional debug build into a struct layout with evidence per field, a stride with its sources, a comparison against DWARF, and a list of what stayed unknown.
version: 1.0.0
phase: 13
lesson: 41
tags: [reverse-engineering, x86-64, types, structs, dwarf, system-v-abi, itanium-abi, vtables]
---

Given an x86-64 object that you built yourself, its `llvm-objdump -d -r` listing, and the functions that receive a pointer to the type under study, produce the field layout the instructions prove, the stride the loops prove, the comparison with the DWARF layout when a `-g` build exists, and the names and qualifiers that no instruction can supply. Use this skill with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

## Required inputs

- The object file, the exact compiler and command that produced it, and the `llvm-objdump -d -r` text captured from the same object.
- The names of the functions whose first parameter points at the type, or the call sites that pass one object to them.
- When available, a `-g` build of the same source and its `llvm-dwarfdump --debug-info` text.
- For a C++ object, the symbol table and the relocation records of the `.data.rel.ro.*` sections that hold the vtables.
- The pass and the reader from lesson 41 (`code/main.py`) or an equivalent that records the instruction behind every field.

## Procedure

1. Parse the listing into functions. Attach each relocation line to the instruction above it, so that calls carry their callee name.
2. Run the forward trace over each function with the System V argument registers seeded as pointers. Record every memory operand whose base holds a pointer as an access with root, offset, width, kind, sign, and store flag. Record 64-bit increments, backward branches as loops, and the argument values at each call.
3. For each loop, group same-width accesses through one base register. If the offsets are `d` apart and the loop step is `k * d` with `k` distinct offsets, fold them onto one offset and record `unrolled`. Do not trust any offset past the stride before this step.
4. Collect stride evidence of every kind: index scales from shifts and multiplies, loop steps, offset deltas, and call-site element offsets. The stride is the greatest common divisor of all of them. Name the kind of each value.
5. Build the fields. Merge accesses at one offset and width. Mark a field as a pointer only when a value loaded from it was later used as a base or advanced with `lea`. Record overlapping accesses of different widths as conflicts.
6. If a `-g` build exists, read its DWARF 5 through the abbreviation table and the relocated `.debug_str_offsets` and `.debug_addr` tables. Check the unit header, the member offsets, and the byte size against `llvm-dwarfdump`. Compare field by field and label every row `match`, `no-evidence`, `size-mismatch`, `pointer-unproven`, `kind-mismatch`, or `unexpected`.
7. Check the recovered layout against the System V rules: every field at a multiple of its own size, size a multiple of the strictest alignment, gaps where the rules require padding. A violation means a packed struct, a bit-field, or a wrong field.
8. For a C++ object, read each `_ZTV` symbol from its relocations: offset to top, typeinfo, then slots from the address point 16 bytes in. Read each `_ZTI` for its kind, name string, and base. Resolve every `call *disp(%reg)` whose register was loaded from offset 0 of an object to `disp / 8` and list the candidate functions per class. Demangle every `_Z` name and check against `llvm-cxxfilt --no-strip-underscore`.
9. Write every name, qualifier, pointee type, and alias assumption as unknown or inferred. The instructions supply none of them.

## Required report

For the type, report:

- object name, compiler, build command, and listing path
- witness functions and the evidence that they share one type (call sites or an analyst assertion)
- field table with offset, size, kind, sign, access count, and the address of each access
- pointer proofs with the dereferencing instruction
- stride table with every value and its kind, the folded loops, and the resulting stride and size
- comparison rows against DWARF when a `-g` build exists, and the unit header values that were checked
- alignment check against the System V rules
- for C++: vtables with slots and symbols, typeinfo kind and base, virtual calls with slot and candidates, demangled names
- every unknown: members with no evidence, unproven pointers, names, qualifiers, pointee types

## Hard rejects

- Reporting an offset past the stride without checking the loop for unrolling.
- Taking a single loop increment as the element size.
- Calling an 8-byte field a pointer without a dereference.
- Calling a 1-byte compare a signed or unsigned char.
- Merging the accesses of several functions into one struct without call-site evidence or a recorded assertion.
- Reading `.debug_str` by raw index, or `.debug_addr` without its relocations, in a relocatable object.
- Parsing a DWARF 4 header with the DWARF 5 layout.
- Reading vtable slots from the symbol start instead of the address point.
- Treating a missing vtable in one object as proof that the class has none.
- Copying a decompiler's type name into the report as evidence.
- Inventing a member name.

## Produce

Return these sections:

1. Witnesses: the functions, the roots, and the alias evidence.
2. Accesses: the full access table with addresses.
3. Layout: fields, pointer proofs, conflicts, gaps, and the alignment check.
4. Stride: every value with its kind, the folds applied, the stride, and the size.
5. DWARF: the unit header check and the comparison rows, or the statement that no debug build exists.
6. C++: vtables, typeinfo, virtual calls, and demangled names, or the statement that the object has none.
7. Unknowns: every member, kind, name, and qualifier the evidence does not reach.

End with the first unknown. If there is none, state the number of members matched against DWARF and the number of stride sources that agreed.
