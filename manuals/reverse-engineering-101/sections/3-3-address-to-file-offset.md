# address-to-file-offset

> address-to-file-offset maps one virtual address to the byte in the file that Ghidra loaded there, and the segment load command lets you check the answer by hand.

`inspect-macho` says `_grade` is exported at `0x100000518`. You want to open `ledger-arm64-O1` in a hex viewer and read those bytes, so you need the file offset of that address. One rea command answers that question, and the Mach-O load commands let you compute the same number without rea.

When you finish this section, you can turn an address into a file offset with `rea address-to-file-offset`. You can do the same arithmetic from the `LC_SEGMENT_64` fields, and say when the two can disagree.

## The command

```listing
title: the command and its exit
source: capture/out/00-commands.txt
lang: text
note: Two lines from the command index. The time in parentheses changes on every run and is cut.
---
$ rea address-to-file-offset fixtures/ledger-arm64-O1 0x100000518 --provider ghidra --format json
[exit 0] (…) -> 08-address-to-file-offset.json
```

The call took 7 to 9 s on the capture Mac. Every one-shot CLI call that needs Ghidra imports the target into a fresh headless project. [Section 4.1](#s-open-binary-and-the-headless-bridge) shows that cost in detail, and the same question costs under 100 ms inside an open MCP session.

```listing
title: the answer and the rule behind it
source: capture/out/08-address-to-file-offset.json
lang: json
note: Cut from the record. The subject, provider, and analysis_profile blocks and five of the six limitations are cut.
---
"operation": "address_to_file_offset",
"parameters": {
  "address": "0x100000518"
},
"raw_result": {
  "address": "0x100000518",
  "file_offset": 1304
},
"normalized_result": {
  "address": "0x100000518",
  "file_offset": 1304
},
"confidence": "observed",
"authority": "shipped-artifact",
…
"limitations": [
  …
  "Offsets come from Ghidra source-byte mappings, not virtual-address arithmetic. Uninitialized memory, missing mappings and ambiguous mappings fail explicitly.",
  …
],
```

The answer is 1304. The record is `observed`: Ghidra reported which file byte it loaded at that address, and rea passed the number through.

## The arithmetic from the load command

**File offset:** the position of a byte in the file, counted from zero. **Virtual address:** the position of the same byte in memory after the loader maps the segment that contains it. A segment maps `filesize` bytes starting at `fileoff` to `vmsize` bytes starting at `vmaddr`, so inside one segment the two positions differ by a constant.

From [the previous section](#s-inspect-binary-layout-and-the-load-image), `__TEXT` has `vmaddr` `0x100000000` and `fileoff` 0. The rule for any byte in that segment is `offset = address - vmaddr + fileoff`. For `_grade`, that is `0x100000518 - 0x100000000 + 0`, which is `0x518`, which is 1304.

The section gives a second check. `__text` has `address` `0x100000500` and `file_offset` 1280. The function starts `0x18` bytes, 24 bytes, after the section, so its offset is `1280 + 24`, again 1304. Open the fixture at byte 1304 and you find `e8 cc 8c 52`. That is the little-endian encoding of `mov w8, #0x6667`, the first instruction of `_grade` in [section 4.3](#s-procedure-assembly).

| Method | Inputs | Result |
|---|---|---|
| Segment rule | `vmaddr` `0x100000000`, `fileoff` 0 | `0x100000518 - 0x100000000 + 0` = 1304 |
| Section rule | `address` `0x100000500`, `file_offset` 1280 | `1280 + (0x518 - 0x500)` = 1304 |
| rea with Ghidra | the address | `file_offset: 1304` |

```figure
id: fig-3-4
kind: structure
title: from 0x100000518 to file offset 1304
claim: The segment rule, the section rule, and Ghidra's source mapping give the same byte, 1304, and that byte starts the first instruction of _grade.
caption: Read each row left to right. Green boxes are load command facts, grey boxes are your arithmetic, the violet box is Ghidra's answer. From capture/out/04-inspect-macho.json, 08-address-to-file-offset.json, and the fixture bytes.
```

The ELF rule has the same shape. For a loadable segment it is `offset = address - p_vaddr + p_offset`, and for a section it is `sh_offset`. [Lesson 32](phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch) does that arithmetic on `ledger-x86_64-O1.o`. A relocatable object has no program header table, so no segment places it in memory. When [section 3.4](#s-analyze-overview) shows `.text` of that object at `0x100000`, the number is a placement Ghidra chose, not a fact in the file.

## What Ghidra does instead

The bridge does not compute. `addressToFileOffset` asks Ghidra for the memory block at the address and requires an initialized block. Otherwise it fails with `invalid_request` and the message "Address has no initialized file-backed memory". It then walks the source mappings of the block. It keeps only a mapping whose `FileBytes` start at file offset 0 and whose original bytes have the SHA-256 of the admitted target. It requires exactly one such mapping, and it refuses an offset above 2^53 - 1.

The reply carries only `address` and `file_offset`. The output schema of rea also allows `provider_file_offset`, `image_base_file_offset`, and `source_path`, and the Ghidra provider at 6.7.0 leaves them out.

Three addresses show the three outcomes. The capture ran only the first row. The other two follow from the bridge code above.

| Address | Where it is | Outcome |
|---|---|---|
| `0x100000518` | `__text`, initialized, one `FileBytes` mapping | `file_offset` 1304 |
| `0x0` | `__PAGEZERO`, `filesize` 0, no file bytes | `invalid_request`, no initialized file-backed memory |
| `EXTERNAL:0x1` | Ghidra's external space for imported functions | `invalid_request`, no file bytes at all |

This is why the limitation says the offsets are not virtual-address arithmetic. Your arithmetic and Ghidra's mapping agree for every byte of `__TEXT`, `__DATA_CONST`, and the 1104 used bytes of `__LINKEDIT`. They disagree where your formula still produces a number and Ghidra refuses. Those places are the 4 GiB of `__PAGEZERO`, the padding after byte 33872, and the `EXTERNAL` block of [section 4.2](#s-list-procedures-and-function-bodies).

```takeaways
- Compute `address - vmaddr + fileoff` from the segment before you ask Ghidra, then compare.
- Use the section `file_offset` as a second check: `1280 + 0x18` is 1304.
- Expect `invalid_request` for `__PAGEZERO`, `EXTERNAL`, and any address with two mappings.
- Quote the file offset when you point another person at bytes in a hex viewer.
```

Sources: capture/out/00-commands.txt, capture/out/04-inspect-macho.json, capture/out/08-address-to-file-offset.json, capture/fixtures/ledger-arm64-O1; rea 6.7.0 at 27dc42d: bridge/ghidra/ReaGhidraBridge.java, src/contracts/toolOutputSchemaGroups.ts
