"""Build tiny-dyn-x86_64: a position-independent ELF executable that calls puts and exit through a PLT.
Every byte follows the gABI chapter 5 (dynamic section, program headers) and the x86-64 psABI
section 5.2 (GOT reserved entries, PLT0 and PLTn in Figure 5.2, R_X86_64_JUMP_SLOT lazy binding).
The file is not run on this machine. llvm-objdump reads it, and the lesson reader is checked against that text."""

from __future__ import annotations

import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "tiny-dyn-x86_64"

PAGE = 0x1000
IMPORTS = ["puts", "exit"]
NEEDED = "libc.so.6"
INTERP = b"/lib64/ld-linux-x86-64.so.2\0"
MESSAGE = b"linked by hand\0"

PT_LOAD, PT_DYNAMIC, PT_INTERP = 1, 2, 3
PF_X, PF_W, PF_R = 1, 2, 4
SHT_PROGBITS, SHT_STRTAB, SHT_RELA, SHT_HASH, SHT_DYNAMIC, SHT_DYNSYM = 1, 3, 4, 5, 6, 11
SHF_WRITE, SHF_ALLOC, SHF_EXECINSTR, SHF_INFO_LINK = 0x1, 0x2, 0x4, 0x40
R_X86_64_JUMP_SLOT = 7
DT_NULL, DT_NEEDED, DT_PLTRELSZ, DT_PLTGOT, DT_HASH, DT_STRTAB, DT_SYMTAB = 0, 1, 2, 3, 4, 5, 6
DT_STRSZ, DT_SYMENT, DT_PLTREL, DT_JMPREL, DT_RELA = 10, 11, 20, 23, 7
DT_FLAGS_1, DF_1_PIE = 0x6FFFFFFB, 0x08000000


def align(value: int, boundary: int) -> int:
    return (value + boundary - 1) & ~(boundary - 1)


def sysv_hash(name: str) -> int:
    h = 0
    for c in name.encode():
        h = (h << 4) + c
        g = h & 0xF0000000
        if g:
            h ^= g >> 24
        h &= ~g & 0xFFFFFFFF
    return h


def rel32(target: int, next_instruction: int) -> bytes:
    return struct.pack("<i", target - next_instruction)


def build() -> bytes:
    phnum = 4
    interp_off = 64 + 56 * phnum
    dynsym_off = align(interp_off + len(INTERP), 8)
    dynsym_size = 24 * (1 + len(IMPORTS))
    dynstr_off = dynsym_off + dynsym_size
    dynstr = b"\0"
    name_offset: dict[str, int] = {}
    for name in IMPORTS + [NEEDED]:
        name_offset[name] = len(dynstr)
        dynstr += name.encode() + b"\0"
    hash_off = align(dynstr_off + len(dynstr), 8)
    hash_size = 8 + 4 * 1 + 4 * (1 + len(IMPORTS))
    relaplt_off = align(hash_off + hash_size, 8)
    relaplt_size = 24 * len(IMPORTS)
    plt_off = align(relaplt_off + relaplt_size, 16)
    plt_size = 16 * (1 + len(IMPORTS))
    text_off = plt_off + plt_size
    code_size = 7 + 5 + 2 + 5 + 1
    rodata_off = align(text_off + code_size, 8)
    rx_end = rodata_off + len(MESSAGE)
    dynamic_off = PAGE
    dynamic_count = 12
    dynamic_size = 16 * dynamic_count
    gotplt_off = dynamic_off + dynamic_size
    gotplt_size = 8 * (3 + len(IMPORTS))
    rw_end = gotplt_off + gotplt_size
    section_names = [".interp", ".dynsym", ".dynstr", ".hash", ".rela.plt", ".plt", ".text", ".rodata", ".dynamic", ".got.plt", ".shstrtab"]
    shstrtab = b"\0"
    shname: dict[str, int] = {}
    for name in section_names:
        shname[name] = len(shstrtab)
        shstrtab += name.encode() + b"\0"
    shstrtab_off = rw_end
    shoff = align(shstrtab_off + len(shstrtab), 8)
    shnum = 1 + len(section_names)
    image = bytearray(shoff + 64 * shnum)

    def plt_entry(index: int) -> int:
        return plt_off + 16 * (index + 1)

    def got_slot(index: int) -> int:
        return gotplt_off + 24 + 8 * index

    image[0:64] = struct.pack(
        "<16sHHIQQQIHHHHHH",
        b"\x7fELF\x02\x01\x01\x00" + b"\0" * 8, 3, 62, 1, text_off, 64, shoff, 0, 64, 56, phnum, 64, shnum, shnum - 1,
    )
    phdrs = [
        (PT_INTERP, PF_R, interp_off, len(INTERP), 1),
        (PT_LOAD, PF_R | PF_X, 0, rx_end, PAGE),
        (PT_LOAD, PF_R | PF_W, PAGE, rw_end - PAGE, PAGE),
        (PT_DYNAMIC, PF_R | PF_W, dynamic_off, dynamic_size, 8),
    ]
    for index, (p_type, flags, offset, size, p_align) in enumerate(phdrs):
        struct.pack_into("<IIQQQQQQ", image, 64 + 56 * index, p_type, flags, offset, offset, offset, size, size, p_align)
    image[interp_off : interp_off + len(INTERP)] = INTERP
    for index, name in enumerate(IMPORTS, start=1):
        struct.pack_into("<IBBHQQ", image, dynsym_off + 24 * index, name_offset[name], 0x12, 0, 0, 0, 0)
    image[dynstr_off : dynstr_off + len(dynstr)] = dynstr
    nchain = 1 + len(IMPORTS)
    chain = [0] * nchain
    bucket = 0
    for index in range(1, nchain):
        chain[index] = bucket
        bucket = index
    struct.pack_into(f"<II{1}I{nchain}I", image, hash_off, 1, nchain, bucket, *chain)
    for index in range(len(IMPORTS)):
        struct.pack_into("<QQq", image, relaplt_off + 24 * index, got_slot(index), ((index + 1) << 32) | R_X86_64_JUMP_SLOT, 0)
    plt0 = b"\xff\x35" + rel32(gotplt_off + 8, plt_off + 6) + b"\xff\x25" + rel32(gotplt_off + 16, plt_off + 12) + b"\x0f\x1f\x40\x00"
    image[plt_off : plt_off + 16] = plt0
    for index in range(len(IMPORTS)):
        entry = plt_entry(index)
        body = b"\xff\x25" + rel32(got_slot(index), entry + 6) + b"\x68" + struct.pack("<I", index) + b"\xe9" + rel32(plt_off, entry + 16)
        image[entry : entry + 16] = body
    code = (
        b"\x48\x8d\x3d" + rel32(rodata_off, text_off + 7)
        + b"\xe8" + rel32(plt_entry(0), text_off + 12)
        + b"\x31\xff"
        + b"\xe8" + rel32(plt_entry(1), text_off + 19)
        + b"\xf4"
    )
    assert len(code) == code_size
    image[text_off : text_off + code_size] = code
    image[rodata_off : rodata_off + len(MESSAGE)] = MESSAGE
    dynamic = [
        (DT_NEEDED, name_offset[NEEDED]),
        (DT_HASH, hash_off),
        (DT_STRTAB, dynstr_off),
        (DT_SYMTAB, dynsym_off),
        (DT_STRSZ, len(dynstr)),
        (DT_SYMENT, 24),
        (DT_PLTGOT, gotplt_off),
        (DT_PLTRELSZ, relaplt_size),
        (DT_PLTREL, DT_RELA),
        (DT_JMPREL, relaplt_off),
        (DT_FLAGS_1, DF_1_PIE),
        (DT_NULL, 0),
    ]
    assert len(dynamic) == dynamic_count
    for index, (tag, value) in enumerate(dynamic):
        struct.pack_into("<qQ", image, dynamic_off + 16 * index, tag, value)
    got = [dynamic_off, 0, 0] + [plt_entry(index) + 6 for index in range(len(IMPORTS))]
    struct.pack_into(f"<{len(got)}Q", image, gotplt_off, *got)
    image[shstrtab_off : shstrtab_off + len(shstrtab)] = shstrtab
    dynsym_index = 2
    dynstr_index = 3
    gotplt_index = 10
    sections = [
        (".interp", SHT_PROGBITS, SHF_ALLOC, interp_off, len(INTERP), 0, 0, 1, 0),
        (".dynsym", SHT_DYNSYM, SHF_ALLOC, dynsym_off, dynsym_size, dynstr_index, 1, 8, 24),
        (".dynstr", SHT_STRTAB, SHF_ALLOC, dynstr_off, len(dynstr), 0, 0, 1, 0),
        (".hash", SHT_HASH, SHF_ALLOC, hash_off, hash_size, dynsym_index, 0, 8, 4),
        (".rela.plt", SHT_RELA, SHF_ALLOC | SHF_INFO_LINK, relaplt_off, relaplt_size, dynsym_index, gotplt_index, 8, 24),
        (".plt", SHT_PROGBITS, SHF_ALLOC | SHF_EXECINSTR, plt_off, plt_size, 0, 0, 16, 16),
        (".text", SHT_PROGBITS, SHF_ALLOC | SHF_EXECINSTR, text_off, code_size, 0, 0, 16, 0),
        (".rodata", SHT_PROGBITS, SHF_ALLOC, rodata_off, len(MESSAGE), 0, 0, 1, 0),
        (".dynamic", SHT_DYNAMIC, SHF_ALLOC | SHF_WRITE, dynamic_off, dynamic_size, dynstr_index, 0, 8, 16),
        (".got.plt", SHT_PROGBITS, SHF_ALLOC | SHF_WRITE, gotplt_off, gotplt_size, 0, 0, 8, 8),
        (".shstrtab", SHT_STRTAB, 0, shstrtab_off, len(shstrtab), 0, 0, 1, 0),
    ]
    for index, (name, sh_type, flags, offset, size, link, info, sh_align, entsize) in enumerate(sections, start=1):
        addr = 0 if flags == 0 else offset
        struct.pack_into("<IIQQQQIIQQ", image, shoff + 64 * index, shname[name], sh_type, flags, addr, offset, size, link, info, sh_align, entsize)
    return bytes(image)


if __name__ == "__main__":
    OUT.write_bytes(build())
    print(f"wrote {OUT.name}: {OUT.stat().st_size} bytes")
