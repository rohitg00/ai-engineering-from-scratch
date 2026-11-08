# Sections, segments, permissions, and entropy

Stage 2 of 6. This stage uses the section header table from lesson [32](../../../../../phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md) and the segment and section tables of the three formats from lesson [40](../../../../../phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/docs/en.md).

## What you build

You write five functions in the `layout` module:

- `shannon_entropy(data)` returns bits per byte, rounded to 4 decimal places.
- `sections(data)` lists every section with a permission string and the entropy of its bytes.
- `segments(data)` lists ELF program headers and Mach-O segments.
- `section_at_offset(section_list, offset)` and `section_at_address(section_list, address)` find the owner of a file offset or a virtual address. Stages 4, 5, and 6 use them.

## Why it matters

Sections tell you what the link editor made. Segments tell you what the loader maps and with which permissions. A section that is writable and executable, or a data section with entropy near 8, is a fact a reviewer must see before a release. Entropy measures how evenly the byte values spread. The maximum is 8 bits per byte, when all 256 values occur equally often, and zero padding is 0. In the fixtures, the code sections measure from 5.5 to 5.9 and the string sections from 4.0 to 4.7. The padding between segments measures 0.0. Compressed or encrypted data comes close to 8.

Each format stores permissions in a different place:

| Format | Where | Bits |
|---|---|---|
| ELF section | `sh_flags` | `SHF_WRITE 0x1`, `SHF_ALLOC 0x2`, `SHF_EXECINSTR 0x4` |
| ELF segment | `p_flags` | `PF_X 0x1`, `PF_W 0x2`, `PF_R 0x4` |
| COFF and PE section | `Characteristics` | `MEM_EXECUTE 0x20000000`, `MEM_READ 0x40000000`, `MEM_WRITE 0x80000000` |
| Mach-O segment | `initprot`, `maxprot` | `VM_PROT_READ 1`, `VM_PROT_WRITE 2`, `VM_PROT_EXECUTE 4` |

An ELF section without `SHF_ALLOC` is not loaded, so its string is `"---"`. A Mach-O section has no permission bits of its own. It takes `initprot` of the segment with the same name. In a Mach-O object the only segment has an empty name, so use the instruction attributes (`0x80000400`) for `"r-x"` and the table `MACHO_SEGMENT_PERMS` for the rest.

## Work through one concrete case

The ELF object for the tally program has 13 section headers of 64 bytes at `e_shoff` 1320. Entry 2 is `.text`. Its `sh_flags` is `0x6`, so `SHF_ALLOC` and `SHF_EXECINSTR` are set and `SHF_WRITE` is clear: `"r-x"`. Its `sh_offset` is 64 and `sh_size` is `0x13c` (316). Entry 5 is `.bss` with type `SHT_NOBITS` (8). Its size is 4, but it holds no bytes in the file. So `file_size` is 0 and its entropy is 0.0.

Now compute entropy for the 15-byte string `tally report v3`. Count each byte value:

| Byte | Count | p | p log2(1/p) |
|---|---|---|---|
| `t`, `l`, `r`, space | 2 each | 2/15 | 0.3876 each |
| `a`, `y`, `e`, `p`, `o`, `v`, `3` | 1 each | 1/15 | 0.2605 each |

The sum is 4 × 0.3876 + 7 × 0.2605 = 3.3736 bits per byte. The bytes `aabb` give exactly 1.0, and the 256 values 0 to 255 once each give exactly 8.0.

On the arm64 executable, `__TEXT,__text` is 768 bytes with entropy 5.8595, `__TEXT,__cstring` is 4.6413, and `__DATA,__common` is zerofill with `file_size` 0. The `__PAGEZERO` segment maps 4 GiB with no file bytes and permission `"---"`.

```figure
pj-binary-inspector-2
```

Move the sliders to set how many distinct byte values a region holds and how often the most common one appears. The lab computes the entropy and the permission string from the flag bits you select.

## Implement the contract

`shannon_entropy(data: bytes) -> float`: return 0.0 for empty input. Otherwise H = sum over byte values of p × log2(1/p), with p = count / length, rounded with `round(value, 4)`.

`sections(data: bytes) -> list[dict]`, one dictionary per section with exactly these keys:

| Key | ELF | COFF object | PE image | Mach-O |
|---|---|---|---|---|
| `index` | header index (skip index 0) | 1-based | 1-based | 1-based across all segments |
| `name` | from `.shstrtab` | 8-byte name, or `/n` into the string table | same | `sectname` |
| `segment` | `None` | `None` | `None` | `segname` |
| `type` | `ELF_SECTION_TYPES` name | `"code"`, `"initialized"`, `"uninitialized"`, `"other"` | same | `MACHO_SECTION_TYPES` name |
| `addr` | `sh_addr` | 0 | `ImageBase + VirtualAddress` | `addr` |
| `offset` | `sh_offset` | `PointerToRawData`, or 0 with no file bytes | same | `offset`, or 0 for zerofill |
| `size` | `sh_size` | `SizeOfRawData` | `VirtualSize` | `size` |
| `file_size` | 0 for `NOBITS`, else `sh_size` | 0 for uninitialized data | `min(SizeOfRawData, VirtualSize)` | 0 for zerofill types |
| `perms` | from `sh_flags` | from `Characteristics` | same | from the segment |
| `code` | `SHF_EXECINSTR` | `CNT_CODE 0x20` or `MEM_EXECUTE` | same | instruction attributes |
| `entropy` | of `data[offset:offset + file_size]` | same | same | same |

Raise `FormatError` when the file bytes of a section run past the end of the file. Also raise when a Mach-O `LC_SEGMENT_64` is too small for its `nsects` entries of 80 bytes.

`segments(data: bytes) -> list[dict]` returns `{"name", "addr", "size", "offset", "file_size", "perms", "max_perms", "entropy"}`. ELF names come from `ELF_SEGMENT_TYPES` and `max_perms` is `None`. Mach-O uses `segname`, `vmsize`, `initprot`, and `maxprot`. Relocatable ELF, COFF objects, and PE images return `[]`, because a PE image maps each section directly.

`section_at_offset(section_list, offset)` returns the section with the smallest `file_size` whose file range holds the offset, or `None`. `section_at_address(section_list, address)` returns the first section whose `[addr, addr + size)` holds the address, or `None`.

## Verify and inspect

```bash
python3 scripts/project_test.py binary-inspector --stage 2 --path learning-artifacts/binary-inspector --strict
```

The tests compare names, sizes, and offsets with `llvm-objdump -h` and `otool -l` output for the same files, and check the entropy values above.

## Investigate the failure boundary

- Set the `sh_offset` of `.text` near the end of the file. `sections` must raise before it computes entropy over a short slice.
- Raise `nsects` of the Mach-O `__PAGEZERO` command to 40. The command is 72 bytes, so the section entries would overlap the next command.
- Compare `.bss` and `__common`. A tool that reads `size` bytes for a zero-fill section reports entropy for bytes that belong to another region.
- Look at `__DATA_CONST`. Its `initprot` is `"rw-"` in the file. The `SG_READ_ONLY` flag tells dyld to make it read-only after it applies the fixups of stage 4.

## Extensions

- Flag every region that is both writable and executable.
- Add a sliding-window entropy profile of 256 bytes for the code section.
- Read the ELF `GNU_RELRO` program header and report which sections it covers.

## References

- [System V gABI, sections](https://www.sco.com/developers/gabi/latest/ch4.sheader.html) and [program header](https://www.sco.com/developers/gabi/latest/ch5.pheader.html)
- [Microsoft PE Format, section flags](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format#section-flags)
- [Apple mach-o/loader.h](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h)
- [Shannon, "A Mathematical Theory of Communication", 1948](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf)
