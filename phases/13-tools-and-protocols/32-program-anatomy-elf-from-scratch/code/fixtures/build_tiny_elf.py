"""Write tiny-x86_64, a 736-byte ELF executable, from the standard library alone.

The program writes "ok\n" to file descriptor 1 and exits with status 42 on Linux x86-64.
Layout: ELF header, two program headers, .text, .rodata, .symtab, .strtab, .shstrtab,
then the section header table. One PT_LOAD maps the whole file read-and-execute.
Field layouts: System V gABI, Figures 4-3 (Elf64_Ehdr), 4-8 (Elf64_Shdr), 4-18 (Elf64_Sym), 5-1 (Elf64_Phdr).
Run `python3 build_tiny_elf.py` in this directory. The output is deterministic.
"""

from __future__ import annotations

import struct
from pathlib import Path

BASE = 0x400000
PAGE = 0x1000
EHDR_SIZE = 64
PHDR_SIZE = 56
SHDR_SIZE = 64
SYM_SIZE = 24

PT_LOAD = 1
PT_GNU_STACK = 0x6474E551
PF_X, PF_W, PF_R = 1, 2, 4

SHT_PROGBITS, SHT_SYMTAB, SHT_STRTAB = 1, 2, 3
SHF_WRITE, SHF_ALLOC, SHF_EXECINSTR = 1, 2, 4

STB_LOCAL, STB_GLOBAL = 0, 1
STT_OBJECT, STT_FUNC = 1, 2


def string_table(names: list[str]) -> tuple[bytes, dict[str, int]]:
    table = bytearray(b"\0")
    offsets = {"": 0}
    for name in names:
        offsets[name] = len(table)
        table += name.encode("ascii") + b"\0"
    return bytes(table), offsets


def align(value: int, boundary: int) -> int:
    return (value + boundary - 1) // boundary * boundary


def build() -> bytes:
    phdr_off = EHDR_SIZE
    text_off = phdr_off + 2 * PHDR_SIZE
    message = b"ok\n"
    code_without_lea = 5 + 7 + 5 + 5 + 2 + 5 + 5 + 2
    rodata_off = text_off + code_without_lea
    lea_end = text_off + 5 + 7
    disp = rodata_off - lea_end
    code = b"".join(
        [
            b"\xbf\x01\x00\x00\x00",
            b"\x48\x8d\x35" + struct.pack("<i", disp),
            b"\xba" + struct.pack("<I", len(message)),
            b"\xb8\x01\x00\x00\x00",
            b"\x0f\x05",
            b"\xbf\x2a\x00\x00\x00",
            b"\xb8\x3c\x00\x00\x00",
            b"\x0f\x05",
        ]
    )
    assert len(code) == code_without_lea
    strtab, str_off = string_table(["message", "_start"])
    shstrtab, sh_off = string_table([".text", ".rodata", ".symtab", ".strtab", ".shstrtab"])

    symtab_off = align(rodata_off + len(message), 8)
    symbols = [
        struct.pack("<IBBHQQ", 0, 0, 0, 0, 0, 0),
        struct.pack("<IBBHQQ", str_off["message"], (STB_LOCAL << 4) | STT_OBJECT, 0, 2, BASE + rodata_off, len(message)),
        struct.pack("<IBBHQQ", str_off["_start"], (STB_GLOBAL << 4) | STT_FUNC, 0, 1, BASE + text_off, len(code)),
    ]
    symtab = b"".join(symbols)
    strtab_off = symtab_off + len(symtab)
    shstrtab_off = strtab_off + len(strtab)
    shdr_off = align(shstrtab_off + len(shstrtab), 8)
    file_size = shdr_off + 6 * SHDR_SIZE

    def shdr(name, sh_type, flags, addr, offset, size, link=0, info=0, addralign=1, entsize=0):
        return struct.pack("<IIQQQQIIQQ", sh_off[name], sh_type, flags, addr, offset, size, link, info, addralign, entsize)

    section_headers = b"".join(
        [
            struct.pack("<IIQQQQIIQQ", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
            shdr(".text", SHT_PROGBITS, SHF_ALLOC | SHF_EXECINSTR, BASE + text_off, text_off, len(code), addralign=16),
            shdr(".rodata", SHT_PROGBITS, SHF_ALLOC, BASE + rodata_off, rodata_off, len(message)),
            shdr(".symtab", SHT_SYMTAB, 0, 0, symtab_off, len(symtab), link=4, info=2, addralign=8, entsize=SYM_SIZE),
            shdr(".strtab", SHT_STRTAB, 0, 0, strtab_off, len(strtab)),
            shdr(".shstrtab", SHT_STRTAB, 0, 0, shstrtab_off, len(shstrtab)),
        ]
    )
    ident = b"\x7fELF" + bytes([2, 1, 1, 0]) + bytes(8)
    ehdr = ident + struct.pack(
        "<HHIQQQIHHHHHH", 2, 62, 1, BASE + text_off, phdr_off, shdr_off, 0, EHDR_SIZE, PHDR_SIZE, 2, SHDR_SIZE, 6, 5
    )
    load = struct.pack("<IIQQQQQQ", PT_LOAD, PF_R | PF_X, 0, BASE, BASE, file_size, file_size, PAGE)
    stack = struct.pack("<IIQQQQQQ", PT_GNU_STACK, PF_R | PF_W, 0, 0, 0, 0, 0, 16)

    out = bytearray(file_size)
    out[0:EHDR_SIZE] = ehdr
    out[phdr_off : phdr_off + 2 * PHDR_SIZE] = load + stack
    out[text_off : text_off + len(code)] = code
    out[rodata_off : rodata_off + len(message)] = message
    out[symtab_off : symtab_off + len(symtab)] = symtab
    out[strtab_off : strtab_off + len(strtab)] = strtab
    out[shstrtab_off : shstrtab_off + len(shstrtab)] = shstrtab
    out[shdr_off:file_size] = section_headers
    return bytes(out)


if __name__ == "__main__":
    target = Path(__file__).with_name("tiny-x86_64")
    data = build()
    target.write_bytes(data)
    print(f"wrote {target.name}: {len(data)} bytes, entry 0x{BASE + EHDR_SIZE + 2 * PHDR_SIZE:x}")
