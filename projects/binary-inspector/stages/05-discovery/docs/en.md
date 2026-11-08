# Strings with sections and recovered function starts

Stage 5 of 6. This stage implements the function start methods of lesson [40](../../../../../phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/docs/en.md). It scores them as that lesson does, against the symbol table of the unstripped build.

## What you build

You write three functions in the `discovery` module:

- `extract_strings(data, section_list, segment_list=(), min_length=4)` finds printable ASCII and UTF-16LE runs and names the section and segment that hold each one.
- `function_starts(data)` returns the start addresses that five separate methods find.
- `score_starts(found, truth)` compares one method with the ground truth.

## Why it matters

`strings` without section names mixes format strings from `__cstring`, symbol names from `__LINKEDIT`, and random runs inside machine code. With the section beside each string, you can tell which strings the program prints and which ones the loader reads.

After strip, a disassembler must decide where functions begin. Each method sees a different part of the truth, and each method fails in a known way. Score each method against a build where you know the answer. You get two numbers: precision (how many reported starts are real) and recall (how many real starts it reported).

| Method | Source | Fails when |
|---|---|---|
| symbols | defined function symbols inside code sections | strip removed them |
| function starts table | `LC_FUNCTION_STARTS` ULEB128 deltas | the format has no such table |
| prologues | `sub sp, sp, #imm` or `stp x29, x30, [sp, #-n]!` on arm64; `push rbp; mov rbp, rsp` or `endbr64` on x86-64 | the compiler emits no frame, for example a leaf function at `-O2` |
| call targets | arm64 `bl` and x86-64 `e8` targets inside code sections | nothing calls the function, for example `main` |
| entry | `e_entry`, `AddressOfEntryPoint`, `LC_MAIN` | only one function is the entry |

## Work through one concrete case

`LC_FUNCTION_STARTS` of the stripped arm64 build points at these bytes in `__LINKEDIT`:

```text
e8 0b  d8 02  88 02  20  28  24  00
```

Each value is a ULEB128 delta. The first delta is from the `__TEXT` address `0x100000000`:

| Bytes | Delta | Start |
|---|---|---|
| `e8 0b` | `0x5e8` | `0x1000005e8` |
| `d8 02` | `0x158` | `0x100000740` |
| `88 02` | `0x108` | `0x100000848` |
| `20` | `0x20` | `0x100000868` |
| `28` | `0x28` | `0x100000890` |
| `24` | `0x24` | `0x1000008b4` |
| `00` | end | |

The unstripped build has six function symbols at those addresses: `_main`, `_tally_sum`, `_tally_scale`, `_tally_bucket`, `_tally_name`, `_tally_checksum`. Precision 1.0, recall 1.0. `_banner` sits in `__TEXT,__const`, which holds no instructions, so it is not a function start.

Call targets. The word at `0x100000628` is `46 00 00 94`, read as `0x94000046`. The top six bits `100101` mean `bl`. The low 26 bits are 70, times 4 is `0x118`, so the target is `0x100000740`, the start of `_tally_sum`. The `bl` instructions that target `__stubs` (`printf`, `puts`) are dropped, because the stubs are not functions of this program. Five targets remain. Nothing calls `main`, so recall is 5/6 = 0.8333.

Prologues. The first word of `main` is `ff 83 01 d1`, `0xd10183ff`, which matches `(word & 0xff0003ff) == 0xd10003ff`: `sub sp, sp, #0x60`. The five tally functions at `-O2` are leaf functions with no stack frame, so the scan finds 1 of 6: recall 0.1667. At `-O0` it finds 6 of 6. On the x86-64 ELF objects, `push rbp; mov rbp, rsp` finds 5 of 5 at `-O0` and 0 of 5 at `-O2`.

The `recovered` list is the union of the function starts table, the call targets, and the entry. It leaves out prologues, because a prologue pattern is the only method here that can match bytes inside a function.

```figure
pj-binary-inspector-5
```

In the lab, choose a build and the methods to combine, and add false positives. The lab computes true positives, precision, and recall from the same six addresses.

## Implement the contract

`extract_strings(data, section_list, segment_list=(), min_length=4) -> list[dict]`

- Raise `ValueError` when `min_length` is below 1.
- ASCII: runs of bytes `0x20` to `0x7e` and tab, at least `min_length` long. A run at the end of the file counts.
- UTF-16LE: runs of a printable byte followed by `0x00`, at least `min_length` characters.
- Each item is `{"offset", "text", "encoding", "section", "segment"}`, sorted by offset. `section` comes from `section_at_offset`. `segment` is the section's segment, or the segment whose file range holds the offset, or `None`.

`function_starts(data) -> dict` with sorted, unique integer lists under these keys:

- `symbols`: values of defined `"func"` symbols whose section is a code section and whose value lies inside it. In a relocatable file these are section offsets.
- `function_starts_table`: decoded `LC_FUNCTION_STARTS`, `[]` for other formats.
- `prologues`: pattern matches inside code sections only. Scan arm64 at 4-byte steps.
- `call_targets`: `[]` for a relocatable file, because its call displacements are still zero. Otherwise targets inside code sections.
- `entry`: `[header["entry"]]` or `[]`.
- `recovered`: union of `function_starts_table`, `call_targets`, and `entry`.

A code section has `code` true, file bytes, and a name outside `__stubs`, `__auth_stubs`, `__stub_helper`, `.plt`, and `.plt.sec`.

`score_starts(found, truth) -> dict` returns `{"found", "truth", "true_positives", "false_positives", "missed", "precision", "recall"}`. Count unique addresses. `false_positives` and `missed` are sorted lists. Precision is 0.0 when nothing was found. Recall is 1.0 when the truth is empty. Round both to 4 places.

## Verify and inspect

```bash
python3 scripts/project_test.py binary-inspector --stage 5 --path learning-artifacts/binary-inspector --strict
```

The function start addresses in the tests match `nm -n` of the unstripped build and `dyld_info -function_starts` of the stripped build.

## Investigate the failure boundary

- Write `0xd10083ff` into the middle of `main`. The prologue scan reports a false positive at that address and its precision drops to 0.5. The score shows the cost of the method.
- Write the same word into `__TEXT,__const`. The scan must ignore it, because the section holds no instructions.
- Truncate `LC_FUNCTION_STARTS` to one byte `0x80`. The ULEB128 reader must raise.
- List the strings of the stripped executable in `__LINKEDIT`. The 160 bytes of `LC_DYLD_EXPORTS_TRIE` still hold the edges `hecksum`, `ounter`, `cale`, `bucket`, `main`, and `tally_`. Strip rewrote the root node so that only `__mh_execute_header` is reachable, and left the old nodes in place. The string scan finds them. The trie reader of stage 4 does not, because no reachable node points at them.

## Extensions

- Add a FLIRT-shaped signature, as lesson 40 shows. Mask the relocated bytes of each function in the object files, then match the result at each recovered start.
- Use the `.pdata` section of a linked PE image as one more method: each `RUNTIME_FUNCTION` entry names a function start.
- Report the gap between consecutive starts as an upper bound on each function size.

## References

- [Apple ld64 and dyld, LC_FUNCTION_STARTS in mach-o/loader.h](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h)
- [Arm A64 instruction set: BL, SUB (immediate), STP](https://developer.arm.com/documentation/ddi0602/latest/)
- [Andriesse, Slowinska, Bos, "Compiler-Agnostic Function Detection in Binaries", EuroS&P 2017](https://danielandriesse.com/papers/eurosp-2017.pdf)
- [Ghidra AARCH64 function start patterns](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/AARCH64/data/patterns/AARCH64_LE_patterns.xml)
