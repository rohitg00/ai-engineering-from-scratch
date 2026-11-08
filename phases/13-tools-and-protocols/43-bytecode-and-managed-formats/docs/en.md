# Beyond Native Code: Python, JVM, .NET, and WebAssembly Bytecode

> A bytecode file is a program plus the compiler's notes about it, and this lesson builds the readers that show which notes each container keeps.

**Type:** Build
**Languages:** Python, Java, C#, WebAssembly text
**Prerequisites:** Phase 13 · 32 (ELF from scratch), 33 (disassembly and control flow)
**Time:** ~150 minutes

## Learning Objectives

- Read the 16-byte `.pyc` header from PEP 552 and unmarshal the code object without the `marshal` module, for files written by four interpreter versions.
- Parse a JVM class file from JVMS Chapter 4: constant pool, fields, methods, the `Code` attribute, and the tables that `javac -g` adds.
- Disassemble the JVM opcodes in `Ledger.class` and prove the listing against `javap -c` on four builds of the same source.
- Read a WebAssembly module section by section, decode every function body, and prove the result against `wasm-objdump -d`.
- Walk the ECMA-335 metadata of a .NET assembly from the PE data directory to the `MethodDef` rows and the CIL of each method, checked against the reader library that ILSpy uses.
- Measure, for one function in five containers, which names, types, and control structure each format keeps and which it loses.

## The Problem

You built `ledger.py` and found `ledger.cpython-314.pyc` in `__pycache__`. You asked an agent what the file contains. The agent ran a decompiler. The tool printed `Unsupported opcode` and a line that said `# WARNING: Decompyle incomplete`. The agent concluded that the file was obfuscated.

The file was not obfuscated. Its first two bytes are `2b 0e`, the little-endian word 3627. That is the number CPython 3.14 writes, and the decompiler's opcode tables stop at 3.13. The tool was out of date. The agent did not read the header, so it could not tell the difference.

Lesson 33 showed what native code loses: parameter names, types, and the `switch` that became a jump table. Bytecode containers lose less, and each one loses something different. A pyc keeps every variable name and no type. A class file keeps types and keeps local names only when you ask. A Wasm module keeps the control structure and drops names unless a custom section carries them. A .NET assembly keeps parameter names in a table and leaves local names to a separate file. You cannot judge a decompiler's output on any of them until you know which notes the container had to begin with.

This lesson builds four readers in the Python standard library. Each one reads the container from its first byte, lists one function, and is checked against the format's own tool on fixtures you built. The last section puts `grade` from `ledger` side by side in all five containers.

```figure
re-43-five-containers
```

## The pyc Header Is Four Words

PEP 552 defines the header as four 32-bit words. The first is the magic number. The second is a bit field. Bit 0 set means the file is hash-based. Bit 1 set means `check_source`: the interpreter hashes the source at import and compares. With bit 0 clear, words three and four are the source mtime and the source size. With bit 0 set, they hold a 64-bit SipHash of the source.

The magic number lives in `Include/internal/pycore_magic_number.h`. Its rule since 3.11 is that Python 3.n starts at 2900 + 50n, and each bytecode change inside a release cycle adds one. The stored token is the 16-bit number followed by `\r\n`, so a pyc opened in text mode gets a wrong magic. The final values are 3495 for 3.11, 3531 for 3.12, 3571 for 3.13, 3627 for 3.14, and 3666 for 3.15. Python 3.15.0 was released on 2026-10-09 and is not installed on the machine that built these fixtures, so its number comes from the header file and not from a file here.

The fixtures hold two pyc files per interpreter. `compile_pyc.py` wrote them with `py_compile.compile(..., dfile="ledger.py")` so that the stored filename is `ledger.py` and not the path of the build machine. The first 16 bytes of the 3.14 files:

```text
checked-hash   2b 0e 0d 0a  03 00 00 00  c7 16 c7 fc c5 1d 81 01
timestamp      2b 0e 0d 0a  00 00 00 00  8d 60 cf 6a  f1 01 00 00
```

Read the timestamp header word by word. `03 00 00 00` or `00 00 00 00` is the flag word. `8d 60 cf 6a` is 0x6acf608d = 1791975565, the mtime of `ledger.py` when the file was built. `f1 01 00 00` is 497, the source size. The checked-hash file carries flags 3 and eight hash bytes instead. The four interpreters agree on everything in the header except the magic word:

| Interpreter | Magic bytes | Word | File bytes | `grade.co_code` bytes | `grade` instructions |
|---|---|---|---|---|---|
| 3.11.14 | `a7 0d 0d 0a` | 3495 | 1054 | 80 | 31 |
| 3.12.12 | `cb 0d 0d 0a` | 3531 | 937 | 62 | 26 |
| 3.13.12 | `f3 0d 0d 0a` | 3571 | 943 | 70 | 26 |
| 3.14.6 | `2b 0e 0d 0a` | 3627 | 965 | 96 | 35 |

`read_pyc_header()` in `code/main.py` returns these fields and names the version from the word. `importlib.util.MAGIC_NUMBER` gives the same four bytes for the running interpreter. `python3 code/main.py compare` compiles the source with every `python3.11` to `python3.15` found on `PATH`. For each one it prints the header our reader sees next to the facts that interpreter reports about itself.

## Marshal Writes the Code Object Field by Field

Byte 16 of every fixture is `e3`. That is `0x80 | ord('c')`: the marshal type code for a code object with `FLAG_REF` set, which tells the reader to remember the object for later `r` references. The marshal documentation says the format is undocumented on purpose and that code objects are not compatible between versions. Both statements are true, and the format is still small enough to read. `Python/marshal.c` lists the type codes: `N` None, `i` a 32-bit int, `s` bytes, `z` and `Z` short ASCII strings, `(` and `)` tuples, `c` a code object, `r` a back reference. Containers reserve their reference slot before their children, so the reader does the same.

`w_complex_object()` writes a code object in a fixed order. For 3.11 to 3.15 it is `argcount`, `posonlyargcount`, `kwonlyargcount`, `stacksize`, `flags` as 32-bit ints, then `code`, `consts`, `names`, `localsplusnames`, `localspluskinds`, `filename`, `name`, `qualname` as objects, then `firstlineno`, then `linetable` and `exceptiontable`. Decode the module code object of the 3.14 file by hand from byte 17:

```text
00 00 00 00   argcount 0
00 00 00 00   posonlyargcount 0
00 00 00 00   kwonlyargcount 0
01 00 00 00   stacksize 1
00 00 00 00   flags 0
f3 22 00 00 00   type 's' with FLAG_REF, 34 bytes of co_code follow
80 00  52 06  74 00  52 01  17 00  74 01 ...
```

The code bytes are two per instruction: `80 00` is `RESUME 0`, `52 06` is `LOAD_CONST 6`, `74 00` is `STORE_NAME 0`, and `17 00` is `MAKE_FUNCTION`. The 3.14 listing in the fixtures prints the same five module-level statements. After `code` come the constants, which hold the four nested code objects, and after them `names`: `('LABELS', 'percent_change', 'grade', 'total', 'grade_label')`.

`Unmarshaller` in `code/main.py` reads this layout and the older one that 3.9 and 3.10 used, where `nlocals`, `varnames`, `freevars`, and `cellvars` were separate fields. It builds a `CodeObject` with the same attribute names the real object has. `varnames` filters `localsplusnames` by the `CO_FAST_LOCAL` bit of `localspluskinds`. For `grade` in every one of the four files it returns `('score', 'bucket')`, `firstlineno` 10, and a non-empty `linetable`. The test `test_unmarshaller_agrees_with_the_running_interpreter` compares every field with `marshal.loads()` on the file the running interpreter wrote. The other three files are readable by our code and unreadable by `marshal` under this interpreter.

## Four Interpreters, Four Bytecodes for grade

The dis documentation carries one warning on every version: bytecode is an implementation detail of CPython and no guarantee is made that it stays the same. The fixtures show what that means for eleven lines of Python. `python3.1N -m dis ledger.py` was captured for each interpreter.

In 3.11 `grade` starts like this:

```text
 11           2 LOAD_FAST                0 (score)
              4 LOAD_CONST               1 (10)
              6 BINARY_OP                2 (//)
             10 STORE_FAST               1 (bucket)
 12          12 LOAD_FAST                1 (bucket)
             14 LOAD_CONST               2 (9)
             16 COMPARE_OP               5 (>=)
             22 POP_JUMP_FORWARD_IF_FALSE     2 (to 28)
```

`BINARY_OP` sits at offset 6 and the next instruction at 10. The two bytes between them are an inline cache entry from PEP 659, the specializing adaptive interpreter. `COMPARE_OP` at 16 is followed by 22, so it owns two cache entries. The caches are hidden unless you pass `show_caches=True`. 3.12 replaces `LOAD_CONST` plus `RETURN_VALUE` with `RETURN_CONST`, renames the jump to `POP_JUMP_IF_FALSE`, and shrinks `grade` from 80 to 62 bytes. 3.13 prints labels `L1` to `L4` instead of offsets and gives the CLI `-C` for caches and `-O` for offsets. 3.14 removes `RETURN_CONST` again, adds `LOAD_SMALL_INT` and `LOAD_FAST_BORROW`, and inserts `NOT_TAKEN` after each conditional jump:

```text
 12         20       LOAD_FAST_BORROW         1 (bucket)
            22       LOAD_SMALL_INT           9
            24       COMPARE_OP             188 (bool(>=))
            26       CACHE                    0 (counter: 0)
            28       POP_JUMP_IF_FALSE        3 (to L1)
            30       CACHE                    0 (counter: 0)
            32       NOT_TAKEN
```

The `-C -O` listing shows 13 `CACHE` entries inside `grade`: five after `BINARY_OP`, one after each `COMPARE_OP`, one after each `POP_JUMP_IF_FALSE`. The adaptive fixture shows what the caches are for. After 200 calls, `dis.dis(grade, adaptive=True)` prints `RESUME_CHECK` and `COMPARE_OP_INT` where the plain listing had `RESUME` and `COMPARE_OP`, and `total` shows `FOR_ITER_LIST`, `BINARY_OP_ADD_INT`, and `JUMP_BACKWARD_NO_JIT`. The specialised forms live in the same `co_code` bytes. A pyc never contains them, because specialisation happens in memory.

This is why the decompilers have version ceilings. uncompyle6 3.9.3 states that it accepts bytecode from Python 1.0 to 3.8. decompyle3 3.9.3 reads 3.7 and 3.8. xdis 6.3.0, the cross-version disassembler behind both, reads up to 3.13. pycdc has opcode tables up to `python_3_13.cpp` in its build file, and on an unknown opcode prints `Unsupported opcode` and marks the output incomplete. PyLingual claims every released version since 3.6 and uses interpreters from 3.8 to 3.15 to recompile and check its own output. For a 3.14 file, the first three refuse or fail, and only the last two apply. Read the magic word before you pick a tool.

## The Class File Keeps a Dictionary of Itself

JVMS Java SE 25, section 4.1, gives the layout as one structure: `magic`, `minor_version`, `major_version`, `constant_pool_count`, the constant pool, `access_flags`, `this_class`, `super_class`, interfaces, fields, methods, attributes. The magic is `0xCAFEBABE`. A Java SE 25 virtual machine accepts major versions 45 through 69, and a minor of 65535 marks a preview-feature file. The first ten bytes of `Ledger-g.class` are `ca fe ba be 00 00 00 41 00 5e`: major 65 is Java 21, and `0x5e` = 94 is the constant pool count. `Ledger-jdk25.class`, built by javac 25.0.2 from the same source, starts `ca fe ba be 00 00 00 45`: major 69.

The constant pool is where the class file keeps its own dictionary. Entry `#13` in the `-g` build is a `Methodref` that points at class `#8` and name-and-type `#14`. Following the indexes gives `Ledger.grade:(I)I`, which is exactly what `javap -v` prints after `//`. The descriptor `(I)I` is one `int` parameter and an `int` result. `([I)I` on `total` says the parameter is an `int` array. Every method, field, and class the code touches has such an entry, and the verifier in section 4.10 refuses a file whose instructions disagree with them. The `ClassFile` class in `code/main.py` reads all 17 constant tags from table 4.4 and treats a `Long` or `Double` as two slots. It raises on an unknown tag and on bytes after the last attribute.

Attributes hang off the class, each field, each method, and the `Code` attribute itself. JVMS says the virtual machine must ignore attributes it does not know, which is why debug tables can be added or dropped without changing a method body. The javac manual says `-g` generates all debugging information including local variables, that the default generates line numbers and the source file only, and that `-g:none` generates nothing. The three builds measure that:

| Build | Bytes | Constant pool count | `LineNumberTable` | `LocalVariableTable` | `SourceFile` | `grade` code bytes |
|---|---|---|---|---|---|---|
| `javac -g` | 1832 | 94 | 7 methods | 6 methods | yes | 50 |
| `javac` | 1581 | 82 | 7 methods | none | yes | 50 |
| `javac -g:none` | 1404 | 79 | none | none | no | 50 |

The 50 code bytes of `grade` are identical in all three files, and the test checks it. What `-g` adds for `grade` is one `LocalVariableTable` row: start 0, length 50, slot 0, name `score`, descriptor `I`. Without it a decompiler sees slot 0 of type `int` and has to invent a name. `StackMapTable` stays in every build because the verifier needs it, and the `BootstrapMethods` attribute stays because `main` concatenates strings through `invokedynamic`.

## Decode tableswitch by Hand

Chapter 6 of JVMS defines each instruction as one opcode byte and the operands that opcode names. Branch offsets are 16-bit signed values relative to the address of the branch opcode, which differs from x86-64, where the displacement is relative to the next instruction. `tableswitch` and `lookupswitch` begin with zero to three padding bytes so that their 32-bit operands start at an address that is a multiple of four.

The bytes of `grade` from pc 4 in `Ledger-g.class`:

```text
aa                 tableswitch at pc 4
00 00 00           padding to pc 8
00 00 00 2c        default: 4 + 44 = 48
00 00 00 06        low 6
00 00 00 0a        high 10
00 00 00 2a        case 6:  4 + 42 = 46
00 00 00 28        case 7:  4 + 40 = 44
00 00 00 26        case 8:  4 + 38 = 42
00 00 00 24        case 9:  4 + 36 = 40
00 00 00 24        case 10: 4 + 36 = 40
```

Thirty-six bytes, one instruction, and the whole `switch (score / 10)` with its shared case for 9 and 10. The native build of the same `switch` in lesson 33 needed a bounds check, a `lea`, a `movslq`, an `add`, an indirect jump, and five relocations in another section. Here the targets are in the instruction, and so is the fact that they belong together.

`disassemble_jvm()` covers all 202 defined opcodes with their operand widths, follows the padding rule, and renders operands the way `javap` does. `compare_with_javap()` parses the captured `javap -c -p` text, including the multi-line `tableswitch` block, and checks offset, mnemonic, and operand for every instruction. All four builds agree on 108 of 108 instructions. The test `test_branch_offsets_are_relative_to_the_branch_instruction` checks `ifne` at pc 1 landing on 6, `if_icmpge` at 13 landing on 33, and `goto` at 30 landing back on 10.

radare2 6.2.4, built from source for these lessons, reads the same file. `rabin2 -I` reports `arch java`, `lang java 21`, `linenum true`, and `lsyms true`, which is its reading of the version and the two debug tables. `pd 14 @ sym.Ledger.grade` prints the `tableswitch` with arrows to its five targets. It also prints `Unable to parse code attribute: 2` on this file, which is a limitation the tool names itself and a reason to keep `javap` as the oracle. Decompilers for this format are mature by comparison with Python. CFR 0.152 is MIT licensed. Procyon 0.6.0 and Vineflower 1.12.0 are Apache-2.0, and Vineflower is a Fernflower fork with Java 21 support. Fernflower itself lives inside the IntelliJ Community repository. JADX 1.5.6 covers the Android DEX format, and JD-GUI had its last release in 2019. Harrand, Soto-Valero, Monperrus, and Baudry measured eight of them in 2020. The best produced syntactically correct output for 84 percent of classes and semantically equivalent output for 78 percent. Their meta-decompiler recovered 37.6 percent of the classes that no single tool handled. Types, names, and verified stacks make the format decompilable. They do not make any one decompiler complete.

## A Wasm Module Is a List of Sections

The core specification defines a module as the preamble `00 61 73 6d 01 00 00 00`, the string `\0asm` and version 1, followed by sections. Each section is one id byte, a `u32` size in LEB128, and its contents. Ids 1 to 13 are the known sections, each at most once and in order. Id 0 is a custom section with a name, allowed anywhere. All integers are LEB128, so `e4 00` is 100 and `80 08` is 1024. `wasm-objdump -h` on `ledger.wasm` lists seven sections, and `WasmModule` finds the same seven with the same payload offsets:

| Section | Payload | Count | What it holds for ledger |
|---|---|---|---|
| Type | 10 to 26 | 3 | `(i32) -> nil`, `(i32, i32) -> i32`, `(i32) -> i32` |
| Import | 28 to 39 | 1 | `env.log` with type 0 |
| Function | 41 to 46 | 4 | type index for each defined function |
| Memory | 48 to 51 | 1 | one page, no maximum |
| Export | 53 to 110 | 5 | `memory` and the four function names |
| Code | 113 to 271 | 4 | bodies of 23, 63, 44, and 23 bytes |
| Data | 273 to 290 | 1 | `F\0D\0C\0B\0A\0` at offset 1024 |

The split between the Function and Code sections exists so a browser can start compiling before the whole file arrives. Each code entry is a size, a vector of local declarations, and an expression. For `grade` the locals vector is `01 7f`: one group of one `i32`. That is `bucket`, with its type and without its name.

Control flow is structured by construction. The specification says branches can only target enclosing `block`, `loop`, or `if` constructs. Labels are indexed by nesting depth. `br_table` performs an indirect branch through an operand that indexes a label list. Decode the switch of `grade` at file offset `0xa3`:

```text
0e                  br_table
0b                  11 labels follow
04 04 04 04 04 04   buckets 0 to 5: label 4, the outermost block, returns 0
03 02 01 00         buckets 6, 7, 8, 9: labels 3, 2, 1, 0
00                  bucket 10: label 0, shared with 9
04                  default label 4
```

Each label is a depth. Label 0 is the innermost `block`, and the code after its `end` is `i32.const 4` followed by `br 4` out of the result block. The six `block` instructions before the table, the eleven labels, and the five `br` instructions after it are the whole `switch`, and a validator rejects any branch that leaves the structure. `disassemble_wasm()` tracks the depth so the listing indents like `wasm-objdump`, covers every single-byte opcode from `unreachable` to `i64.extend32_s`, and matches the captured `wasm-objdump -d` on 77 of 77 instructions for both builds.

Names are the one thing a plain module drops. `wasm-objdump` still prints `<grade>` because the Export section maps that string to function index 2, and the reader does the same. Local names exist nowhere in the 290-byte file. `wat2wasm --debug-names` adds a custom section named `name` with subsections for the module name, function names, and local names. The file grows to 425 bytes. The reader finds `{0: 'score', 1: 'bucket'}` for function 2 and `{0: 'values', 1: 'count', 2: 'sum', 3: 'i'}` for function 3. `wasm-strip` removes the section again. The tool-conventions repository describes two more carriers. DWARF can be embedded as `.debug_*` custom sections. A `sourceMappingURL` custom section can point at a source map whose column numbers are byte offsets into the binary.

The tooling moved during 2026. wabt 1.0.42, released 2026-09-15, removed `wasm-decompile`, and the Homebrew build on this machine has exactly the eleven remaining tools. wasm-tools 1.261.0 provides `print`, `objdump`, and `demangle`. Binaryen version_133 provides `wasm-dis`. radare2 6.2.4 reads the module too. Its `rabin2 -I` says `arch wasm`. Its symbol for `grade` starts at `0x8e`, where the locals vector begins, while `wasm-objdump` labels the function at `0x8b`, where its size field begins. Its listing uses the older mnemonics `get_local`, `set_local`, and `brtable 11 4 4 ...` with the label count printed. The bytes are the same in all three tools and the spellings differ, so a comparison must name the tool it was captured with. The research for this lesson found no WebAssembly processor module in Ghidra's processor directory, and that listing was not read in full. The third-party ghidra-wasm-plugin v2.4.0 targets Ghidra 12.0. The specification itself is one living document. The W3C page for `wasm-core-2` is a Candidate Recommendation Draft of 13 October 2026 whose abstract describes release 3.0, and the editors' draft carries the same date.

## ECMA-335 Metadata Is the Program's Own Database

A .NET assembly is a PE file. `LedgerNet.dll` starts with `MZ`, has three sections named `.text`, `.rsrc`, and `.reloc`, and declares machine `0x14c` because the compiler emitted platform-neutral code. Data directory 14 of the optional header, the CLR Runtime Header, points at RVA `0x2008`. ECMA-335 II.25.3.3 defines the 72 bytes there:

```text
48 00 00 00   Cb 72
02 00 05 00   MajorRuntimeVersion 2, MinorRuntimeVersion 5
78 21 00 00   MetaData RVA 0x2178
84 07 00 00   MetaData size 1924
01 00 00 00   Flags: COMIMAGE_FLAGS_ILONLY
05 00 00 06   EntryPointToken 0x06000005, MethodDef row 5, which is Main
```

The metadata root at RVA `0x2178` begins with the signature `42 53 4a 42`, which reads `BSJB`, then version 1.1 and the string `v4.0.30319`. Five stream headers follow: `#~` at offset `0x6c`, then `#Strings`, `#US`, `#GUID`, and `#Blob`. II.24.2 says each kind of stream occurs at most once. The `#~` stream starts with a `HeapSizes` byte, zero here, so every string, GUID, and blob index is two bytes wide, and a 64-bit `Valid` mask that names the tables present. Fourteen bits are set:

| Table | Id | Rows | Row size | What the rows say |
|---|---|---|---|---|
| Module | 0x00 | 1 | 10 | the module name and its GUID |
| TypeRef | 0x01 | 21 | 6 | `System.Object`, `System.Console`, 19 more |
| TypeDef | 0x02 | 4 | 14 | `<Module>`, `Ledger`, and two compiler helpers |
| Field | 0x04 | 2 | 6 | `Labels` and a static array initialiser |
| MethodDef | 0x06 | 6 | 14 | the five methods and `.cctor` |
| Param | 0x08 | 5 | 6 | `before`, `after`, `score`, `values`, `score` |
| MemberRef | 0x0a | 16 | 6 | 12 attribute constructors and the 4 methods that `Main` calls |
| CustomAttribute | 0x0c | 12 | 6 | attributes the compiler and the SDK add |
| StandAloneSig | 0x11 | 3 | 2 | the three local variable signatures |
| Assembly, AssemblyRef, ClassLayout, FieldRva, NestedClass | | 1, 2, 1, 1, 1 | | identity, references, layout |

A row size is not stored anywhere. II.22 gives each column a kind, and II.24.2.6 gives the sizing rule. A heap index is two or four bytes by `HeapSizes`. A simple table index is two bytes while that table has fewer than 65536 rows. A coded index that can point into n tables with b tag bits is two bytes while every one of those tables has fewer than 2^(16-b) rows. `CliAssembly` computes the 14 row sizes from these rules and the row counts. The System.Reflection.Metadata dump in the fixtures reports the same sizes and the same table offsets, which is how the test proves the arithmetic.

III.1.9 defines the token: the high byte is the table, the low three bytes are the 1-based row. `0x06000002` is `MethodDef` row 2. That row has RVA `0x2060`, name `Grade`, and a signature blob `00 01 08 08`: default calling convention, one parameter, return `int32`, parameter `int32`. Its `ParamList` points at row 3 of `Param`, whose name is `score`. The Param table is why ILSpy can print `Grade(int score)` from a stripped release build. At RVA `0x2060` the method body begins with a fat header:

```text
13 30         flags 0x13: fat, init locals; size 3 dwords
02 00         MaxStack 2
2d 00 00 00   CodeSize 45
01 00 00 11   LocalVarSigTok 0x11000001
```

`StandAloneSig` row 1 holds `07 01 08`: `LOCAL_SIG`, one local, `int32`. The local has a type and no name. ECMA-335 keeps local names in the debug interchange format of Partition V, and the .NET SDK writes them to a PDB. This fixture was built with `DebugType` none, so no table and no file carries the name `bucket`. `PercentChange` has a tiny header instead: its first byte `3a` is `0x0e << 2 | 2`, a 14-byte body with no locals and a default stack of 8.

The 45 code bytes of `Grade` decode with the Partition III opcode table. `switch` is opcode `0x45` followed by a `u32` count and that many `int32` targets relative to the instruction after the table:

```text
IL_0000: 02           ldarg.0
IL_0001: 1f 0a        ldc.i4.s 10
IL_0003: 5b           div
IL_0004: 0a           stloc.0
IL_0005: 06           ldloc.0
IL_0006: 1c           ldc.i4.6
IL_0007: 59           sub
IL_0008: 45 05 00 00 00 08 00 00 00 06 00 00 00 04 00 00 00 02 00 00 00 02 00 00 00
                      switch (IL_0029, IL_0027, IL_0025, IL_0023, IL_0023)
IL_0021: 2b 08        br.s IL_002b
IL_0023: 1a 2a        ldc.i4.4, ret
```

The compiler subtracted 6 before the `switch`, so case 6 is the first target. `disassemble_cil()` renders tokens through the tables: `ldsfld Labels`, `call Grade`, `call System.Console::WriteLine`, and `ldstr ' '` from the `#US` heap. The oracle for all of this is `MetaDump`, a short C# program in the fixtures built on `System.Reflection.Metadata`, the library inside ILSpy. It prints every table's row count, size, and offset, every method's RVA, signature, parameter names, and IL bytes, and the 226 fields of `System.Reflection.Emit.OpCodes`. `compare_with_metadump()` agrees on all 246 checks. The runtime table has 218 opcodes plus eight `prefix` placeholders. The lesson's table has 219 entries because it includes `no.` from III.2.2, which the Emit table never had.

Tools for the format: ILSpy 11.0 (MIT, released 2026-08-12) runs on macOS through its Avalonia desktop build. `ilspycmd` 11.1.0.9782 prints IL with `-il` and selects a method by token with `-m 0x06000002`. dnSpyEx 6.6.0 continues dnSpy on Windows only. The IL disassembler `ildasm` ships as NuGet packages rather than inside the SDK. radare2 6.2.4 reads the metadata too: `rabin2 -I` says `arch cil` and `class PE32`, and `is` lists `Ledger.Grade(int:score):int` with the parameter name and both types taken from the Param and signature tables. It has no CIL disassembler in this build. This fixture was built with .NET SDK 8.0.205 because that is the SDK installed on the build machine. .NET 10 has been current since 2025-11-11 and writes the same ECMA-335 structures.

## What Each Container Keeps

Put `grade` from all five containers in one table. Every row comes from `python3 code/main.py keeps`, which runs the readers over the fixtures:

| Container | Body bytes | Function name | Parameter names | Parameter and return types | Local names | Line numbers | Control flow |
|---|---|---|---|---|---|---|---|
| ELF object, clang -O0 | 118 | `grade` in `.symtab` | none | none | none | none, no `.debug_*` sections | 5 jumps and 1 indirect jump through a relocation table |
| CPython 3.14 pyc | 96 | `co_qualname` | `score` | none | `bucket` | `co_linetable`, first line 10 | 4 compare and `POP_JUMP_IF_FALSE` pairs |
| JVM class, `javac -g` | 50 | constant pool | `score` in `LocalVariableTable` | `(I)I` | none beyond the parameter | `LineNumberTable`, 6 rows | 1 `tableswitch` |
| WebAssembly | 63 | Export section | only with a name section | `(i32) -> i32` | only with a name section | none | 6 nested blocks, 1 `br_table`, 4 `br` |
| .NET assembly | 45 | `MethodDef` | `score` in `Param` | `static int32(int32)` | none, types only in `StandAloneSig` | none without a PDB | 1 `switch`, 1 `br.s` |

The table explains the decompiler results you will see. Lesson 34 compared `int total(const int *, int)` with the `int total(long param_1, uint param_2)` that Ghidra inferred from native code, because native code keeps none of these columns. A pyc keeps every name and no type, and its control flow is jumps whose shape changes every release, so Python decompilers break per version and recover names for free. A class file keeps types and verified stacks, keeps names when `-g` is on, and expresses the `switch` as one instruction. A Wasm module keeps the structure by construction, so `wasm2wat` is a lossless round trip and the only loss is names. A .NET assembly keeps the most complete description, because the metadata tables are normative, and still needs a PDB for the name of a local.

The table tells you what the decompiler had to work with, and which of its outputs copy a stored fact and which infer one. A parameter name in ILSpy output is a copy. A local name in the same output is an inference unless a PDB was present. Lesson 35 records that difference as the authority of each claim.

## Build It

Run the demo:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats
python3 code/main.py
```

The output is one JSON report. For each pyc it gives both headers, the file and `grade` sizes, the instruction count and opcode names from the captured listing, and whether the running interpreter can read it. For each class build it gives the version, sizes, debug table counts, and the `javap` agreement. For each Wasm build it gives sections, types, functions, name-section contents, and the `wasm-objdump` agreement. For the assembly it gives the CLI header, streams, table row counts, methods, and the System.Reflection.Metadata agreement. It ends with the keeps table and the list of interpreters found on `PATH`.

Read `code/main.py` in this order:

1. `Reader` holds the cursor and the integer widths. `uleb()` and `sleb()` are the LEB128 readers that Wasm and the .NET blob heap need.
2. `read_pyc_header()`, `Unmarshaller`, and `PycFile` read a pyc. `parse_dis_text()` reads the captured `dis` listings so the cross-version comparison does not need four interpreters at test time.
3. `ClassFile` reads the class file and `disassemble_jvm()` decodes its code. `parse_javap_code()` and `compare_with_javap()` are the oracle check.
4. `WasmModule` reads the sections and `disassemble_wasm()` decodes an expression with its depth. `compare_with_wasm_objdump()` is the oracle check.
5. `CliAssembly` walks PE, CLI header, metadata root, streams, and tables. `TABLE_SCHEMAS` and `CODED_INDEXES` are II.22 and II.24.2.6 as data. `disassemble_cil()` decodes a body and `compare_with_metadump()` checks it.
6. `NativeObject` reads enough ELF to list function symbols and takes the lesson 33 listing as its text. `what_each_keeps()` and `figure_data()` build the comparison.

Five more commands exist. `python3 code/main.py pyc FILE`, `class FILE`, `wasm FILE`, and `dll FILE` print the structure and a listing of every function in a file you give them. `python3 code/main.py compare` compiles `ledger.py` with every interpreter on `PATH` and prints what each one wrote.

## Use It

Use the readers in this order on a container you built.

1. Read the first bytes and name the format. Two bytes then `0d 0a` is a pyc, `ca fe ba be` a class file, `00 61 73 6d` a module, `4d 5a` with data directory 14 set an assembly.
2. Read the header and write down the producer version it names. For a pyc that is the magic word, for a class file the major version, for an assembly the runtime and metadata version strings.
3. Check every decompiler you plan to run against that version before you run it. Record the ceiling and where the tool documents it.
4. Run the reader and the format's own tool on the same file and compare them row by row. A mismatch is a bug in the reader or a change in the tool, and either one has to be understood before the listing is evidence.
5. Fill the keeps table for the function you care about. Mark each fact as kept or lost and name the table, attribute, or section it came from.
6. Only then read the decompiler output. Mark each name and type in it as a copy of a kept fact or as an inference.

Keep the oracle text files with the containers. When an interpreter, JDK, SDK, or wabt version changes, rebuild with `build_fixtures.sh` and re-capture, because a changed listing is a changed fixture.

## Interactive Lab

### Lab A: read the header, then the code object

From the `code` directory, open Python:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats/code
python3 -q
```

Run:

```python
from main import *
pyc = load_pyc("ledger.cpython-311.pyc")
pyc.header.to_dict()
pyc.module.names
pyc.functions()["grade"].varnames
len(pyc.functions()["grade"].code)
```

Write down the magic word before the first call. Then load `ledger.cpython-314.pyc` and compare the two `code` lengths. Then try `import marshal; marshal.loads(pyc.data[16:])` on the 3.11 file under your interpreter and read the error.

### Lab B: the constant pool chain

```python
cls = load_class("Ledger-g.class")
cls.constant(13)
cls.constant(14)
cls.describe_constant(13)
[row["text"] for row in jvm_listing(cls, "grade")]
```

Follow `#13` to `#8` and `#14`, then to the `Utf8` entries, by hand before you call `describe_constant`. Then load `Ledger-gnone.class` and call `cls.method("grade").attribute_names()` on both. The `Code` array is the same, the attributes are not.

### Lab C: depth and labels

```python
module = load_wasm("ledger.wasm")
[(row["depth"], row["text"]) for row in wasm_listing(module, "grade")]
module.function_name(2)
load_wasm("ledger-names.wasm").names["locals"][2]
```

Find the `br_table` row and read its depth. Count the `end` rows after it and match each one to a label number in the table. Then open `ledger.wat` and find the `block $six` that label 3 names.

### Lab D: from token to bytes

```python
asm = load_assembly("LedgerNet.dll")
asm.method("Grade")
body = asm.method_body(asm.method("Grade")["RVA"])
body.fat, body.max_stack, body.code_size, hex(body.local_signature_token)
asm.token_text(0x11000001)
[row["text"] for row in cil_listing(asm, "GradeLabel")]
```

Compute the file offset of RVA `0x2060` from the `.text` section header by hand and compare with `asm.rva_to_offset(0x2060)`. Then look up `asm.row(0x08, 3)` and find where the name `score` lives.

## Practice Lab

Add a fifth source language to the comparison, or a sixth fact to the table.

Requirements:

- Write a function with a loop and a local variable in a language whose compiler you have, for example Kotlin to a class file or Rust to a Wasm module. Commit the output and the oracle listing with the exact command in `build_fixtures.sh`.
- Make the matching reader agree with the oracle on every instruction. Add opcodes only when the fixture needs them.
- Extend `what_each_keeps()` with the new container, and with one more fact for every container: whether the body carries an exception table or `try` region.
- Add the new container to `figure_data()` and regenerate `site/figures-re-43.js`.
- Write a test that fails when a reader reports a fact as kept without naming the table, attribute, or section that holds it.

Success means `python3 code/main.py keeps` shows the new row with evidence for every cell, and every oracle comparison still agrees.

## Lesson Artifact

This lesson includes `outputs/skill-bytecode-and-managed-formats.md`. Use it to turn a bytecode container into a header report, a checked listing of one function, and a facts table that marks each name, type, and structure as kept or lost. It requires the format's own tool as an oracle, a version check before any decompiler, and a statement of where each lost fact would have lived.

## Verify It

Run the demo and the deterministic suite:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

Verification should prove:

- the four pyc headers carry magic words 3495, 3531, 3571, and 3627, flags 3, and an 8-byte hash, and the timestamp files carry flags 0, mtime 1791975565, and size 497
- every magic word for 3.11 and later sits in the range the `2900 + 50n` rule gives its release
- the unmarshaller returns the same names, constants, code bytes, variable names, and line table as `marshal.loads()` on the file the running interpreter wrote
- all four files keep the module names, `('score', 'bucket')` for `grade`, first line 10, and `ledger.py` as the filename
- `grade.co_code` is 80, 62, 70, and 96 bytes across the four versions and the captured listings have 31, 26, 26, and 35 instructions
- the 3.11 listing has `POP_JUMP_FORWARD_IF_FALSE`, 3.12 and 3.13 have `RETURN_CONST`, and 3.14 has `LOAD_SMALL_INT`, `LOAD_FAST_BORROW`, and `NOT_TAKEN`
- the 3.14 `-C -O` listing shows 13 cache entries in `grade`, five of them after `BINARY_OP`, and the adaptive listing shows `COMPARE_OP_INT`
- a header without `0d 0a`, a truncated header, and a body that is not a code object raise `FormatError`
- an instruction listing exists only for the pyc written by the running interpreter and matches the captured `dis` output
- the class files have major 65 or 69, sizes 1581, 1832, 1404, and 1581, and constant pool counts 82, 94, 79, and 82
- constant `#13` resolves to `Method Ledger.grade:(I)I` and `#47` to `String F`
- the JVM disassembler agrees with `javap -c -p` on 108 of 108 instructions in all four builds
- `tableswitch` at pc 4 is 36 bytes with low 6, high 10, default 48, and targets 46, 44, 42, 40, 40
- the three debug levels change attribute counts and leave the 50 code bytes of `grade` identical
- `ifne`, `if_icmpge`, and `goto` targets are relative to the branch opcode
- a wrong magic, trailing bytes, and an undefined opcode raise `FormatError`
- the seven Wasm sections have the payload offsets `wasm-objdump -h` prints, and the names build adds a `name` custom section at 293 to 425
- types, the `env.log` import, the five exports, and the data segment at 1024 decode as written in `ledger.wat`
- the Wasm disassembler agrees with `wasm-objdump -d` on 77 of 77 instructions in both builds
- `grade` has 6 nested blocks, a `br_table` with labels `4 4 4 4 4 4 3 2 1 0 0` and default 4 at depth 6, and one `i32` local
- function names come from exports without a name section and local names only with it
- LEB128 `e4 00` is 100, `7f` is -1, `80 08` is 1024, and block types render like `wasm-objdump`
- a wrong preamble, version 2, and an unknown opcode raise `FormatError`
- the assembly is PE32 with machine `0x14c`, CLI header at RVA `0x2008`, runtime 2.5, `ILONLY`, and entry point `0x06000005`
- the metadata version is `v4.0.30319`, five streams exist, and the 14 tables have the row counts and row sizes the oracle reports
- the .NET reader agrees with System.Reflection.Metadata on 246 of 246 checks
- `Grade` has parameter `score`, signature `static int32(int32)`, a fat header with `MaxStack` 2 and 45 code bytes, and one `int32` local without a name
- CIL `switch` targets, `br.s`, `ldsfld`, `call`, and `ldstr` operands resolve through the tables and heaps
- the CIL opcode table covers every runtime opcode and adds only `no.`
- the keeps table reports the parameter name in four containers and in none for native code, and types in three
- every oracle line in the demo reads n of n
- the interactive figure embeds the same data `figure_data()` produces

## Production Failure Modes

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Decompiler older than the interpreter | `Unsupported opcode`, output marked incomplete, or a claim of obfuscation | The magic word, the release it names, and the tool's documented ceiling |
| pyc read with the wrong interpreter | `marshal.loads` raises or returns garbage | Our unmarshaller reads names, constants, and sizes from any 3.9 to 3.15 file, and instructions come from the matching `dis` |
| Specialised opcodes mistaken for the file's content | `COMPARE_OP_INT` in a listing | A pyc holds the unspecialised form, specialisation happens in memory after warm-up |
| Local names reported for a default javac build | `var1`, `var2` presented as source names | `LocalVariableTable` is present only with `-g`, the 50 code bytes are identical either way |
| Branch target off by the instruction length | A JVM listing whose jumps land mid-instruction | Offsets relative to the branch opcode, checked against `javap` |
| Switch padding skipped | A `tableswitch` with a wrong default and shifted cases | Zero to three padding bytes to a 4-aligned pc, 36 bytes for five cases |
| Wasm names assumed stripped | "no symbols" | Exports name every exported function, locals need the `name` section, `wasm-strip` removes only that section |
| Three tools, three spellings | `get_local` versus `local.get`, a function at `0x8b` versus `0x8e` | Same bytes, and the listing that the comparison was captured with |
| Table row size guessed | Every row after the first table misread | Row sizes from `HeapSizes`, row counts, and coded index widths, equal to the oracle's |
| Local names expected in a release assembly | `V_0` presented as the source name | Locals have types in `StandAloneSig` and names only in a PDB that `DebugType` none did not write |
| Reader guesses an unknown opcode or type code | A plausible mnemonic | `FormatError` with the offset, and the oracle comparison stops there |
| Oracle captured from another build | Tests pass on stale text | `build_fixtures.sh` names every tool version and writes `versions.txt` and `sha256.txt` |

## Operational Rule

Read the header first and name the producer it points at. Read the container with a reader that refuses what it does not know, and check its listing against the format's own tool on the same file. Then say, for every name and type in a decompiler's output, whether the container stored it or the tool inferred it.

## Further Reading

- [PEP 552: Deterministic pycs](https://peps.python.org/pep-0552/)
- [CPython `Include/internal/pycore_magic_number.h`](https://github.com/python/cpython/blob/main/Include/internal/pycore_magic_number.h)
- [Python `marshal` module documentation](https://docs.python.org/3/library/marshal.html)
- [CPython `Python/marshal.c`](https://github.com/python/cpython/blob/main/Python/marshal.c)
- [Python 3.14 `dis` module documentation](https://docs.python.org/3.14/library/dis.html)
- [PEP 659: Specializing Adaptive Interpreter](https://peps.python.org/pep-0659/)
- [PEP 626: Precise line numbers for debugging and other tools](https://peps.python.org/pep-0626/)
- [PEP 790: Python 3.15 Release Schedule](https://peps.python.org/pep-0790/)
- [uncompyle6 on PyPI](https://pypi.org/project/uncompyle6/), [decompyle3 on PyPI](https://pypi.org/project/decompyle3/), [xdis on PyPI](https://pypi.org/project/xdis/), [pycdc on GitHub](https://github.com/zrax/pycdc), [PyLingual on GitHub](https://github.com/syssec-utd/pylingual)
- [The Java Virtual Machine Specification, Java SE 25, Chapter 4: The class File Format](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-4.html)
- [The Java Virtual Machine Specification, Java SE 25, Chapter 6: The Java Virtual Machine Instruction Set](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-6.html)
- [javac manual, Java SE 25](https://docs.oracle.com/en/java/javase/25/docs/specs/man/javac.html) and [javap manual](https://docs.oracle.com/en/java/javase/25/docs/specs/man/javap.html)
- [CFR](https://www.benf.org/other/cfr/), [Procyon](https://github.com/mstrobel/procyon), [Vineflower](https://github.com/Vineflower/vineflower), [Fernflower in intellij-community](https://github.com/JetBrains/intellij-community/tree/master/plugins/java-decompiler/engine), [JADX](https://github.com/skylot/jadx)
- [Harrand, Soto-Valero, Monperrus, Baudry, "Java Decompiler Diversity and its Application to Meta-decompilation" (JSS 2020)](https://arxiv.org/abs/2005.11315)
- [ECMA-335, Common Language Infrastructure, 6th edition (June 2012)](https://ecma-international.org/publications-and-standards/standards/ecma-335/)
- [PE Format, Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)
- [System.Reflection.Metadata.Ecma335.TableIndex](https://learn.microsoft.com/en-us/dotnet/api/system.reflection.metadata.ecma335.tableindex)
- [ILSpy on GitHub](https://github.com/icsharpcode/ILSpy), [ilspycmd on NuGet](https://www.nuget.org/packages/ilspycmd), [dnSpyEx on GitHub](https://github.com/dnSpyEx/dnSpy)
- [WebAssembly Core Specification: Binary Format, Modules](https://webassembly.github.io/spec/core/binary/modules.html) and [Values](https://webassembly.github.io/spec/core/binary/values.html)
- [WebAssembly Core Specification: Custom Sections (name section)](https://webassembly.github.io/spec/core/appendix/custom.html)
- [WebAssembly tool-conventions: Debugging](https://github.com/WebAssembly/tool-conventions/blob/main/Debugging.md)
- [wabt 1.0.42 release notes](https://github.com/WebAssembly/wabt/releases/tag/1.0.42), [wasm-tools](https://github.com/bytecodealliance/wasm-tools), [Binaryen](https://github.com/WebAssembly/binaryen), [ghidra-wasm-plugin](https://github.com/nneonneo/ghidra-wasm-plugin)
- [radare2 on GitHub](https://github.com/radareorg/radare2), version 6.2.4 built from source for this lesson
