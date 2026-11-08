---
name: bytecode-and-managed-formats
description: Read a .pyc, a JVM class file, a .NET assembly, or a WebAssembly module from its header to its instructions, check the reading against the format's own tool, and report which names, types, and control structure the container keeps.
version: 1.0.0
phase: 13
lesson: 43
tags: [reverse-engineering, bytecode, cpython, pyc, jvm, class-file, ecma-335, cil, webassembly, metadata]
---

Given a bytecode container that you built yourself, produce a header report, a listing of one function, and a table of what the container stores beside the instructions. Use this skill with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

## Required inputs

- The bytecode file and the exact compiler, interpreter, or assembler version and command that produced it.
- The source it was built from, kept beside it.
- A reference listing from the format's own tool captured from the same file: `python3.N -m dis` for a pyc, `javap -c -p` for a class file, `wasm-objdump -h -x -d` for a module, a System.Reflection.Metadata dump or `ilspycmd -il` for an assembly.
- The readers from lesson 43 (`code/main.py`) or equivalents that raise on an unknown type code, opcode, or table.
- The function to report on.

## Procedure

1. Identify the container from its first bytes: two bytes then `0d 0a` is a pyc, `ca fe ba be` is a class file, `00 61 73 6d` is a Wasm module, `4d 5a` with data directory 14 set is a .NET assembly. Stop if none match.
2. Read the header and write down the version facts: pyc magic word and flags, class major and minor version, Wasm binary version, CLI runtime version and metadata version string. Name the producer version that those facts allow.
3. Read the whole container with the reader. A pyc gives the module code object and its nested code objects. A class file gives the constant pool, fields, methods, and attributes. A module gives its sections, types, imports, exports, code bodies, data, and any name section. An assembly gives the streams, the table row counts, the TypeDef, MethodDef, Param, and Field rows, and the method bodies.
4. Disassemble the chosen function. For a pyc, use `dis` only when the running interpreter wrote the file, otherwise use the captured listing from the matching interpreter. For the other three, use the reader's disassembler.
5. Compare the listing with the reference by offset, bytes, and mnemonic. Stop and fix the reader on the first mismatch. Record the count that agreed.
6. Fill the facts table for the function: function name, parameter names, parameter types, return type, local names, line numbers, body size, and the control-flow shape (jumps, switch instruction, nested blocks).
7. Write down which facts the container lost and where they would have lived: the PDB for .NET local names, the name custom section for Wasm names, `javac -g` for JVM local names, DWARF for native code.
8. Before running any decompiler, check that its documented version ceiling covers the header version from step 2. Record the ceiling and the source of that claim.

## Required report

- container, producer version, build command, and reference listing command
- header facts with the raw bytes they came from
- reference agreement as agreed over compared rows
- the function listing with offsets, bytes, and text
- the facts table with kept or lost for each row and the evidence for each
- the decompilers considered, their version ceilings, and whether the file is inside them
- every byte range the reader could not interpret, with its offset

## Hard rejects

- Guessing the producer version from the file name instead of the header bytes.
- Listing pyc instructions with the `dis` module of a different interpreter version.
- Reading a class file branch target as relative to the next instruction. JVMS makes it relative to the branch opcode.
- Skipping the alignment padding before `tableswitch` and `lookupswitch`.
- Treating a Wasm export name as a local variable name, or a missing name section as a stripped binary.
- Reading a .NET token without checking its table byte, or sizing a table row without the HeapSizes bits and the row counts.
- Reporting a container as obfuscated because a decompiler printed an unsupported opcode.
- Comparing against a reference listing captured from a different build of the same source.

## Produce

Return these sections:

1. Container and Version: the header bytes and the producer they name.
2. Reference: rows compared, rows agreed, first mismatch if any.
3. Listing: the function with offsets, bytes, and text.
4. Facts: name, parameters, types, locals, lines, size, control-flow shape, each marked kept or lost with its evidence.
5. Decompiler Limits: the tools considered and their documented ceilings against the header version.
6. Unknowns: every offset the reader skipped or refused and why.

End with the first unknown. If there is none, state the reference agreement count and the number of facts the container kept out of six.
