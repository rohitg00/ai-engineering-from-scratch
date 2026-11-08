"""Build tiny-x86_64.exe: a PE32+ console image that calls puts and exit through its import address table.
Every field follows the Microsoft PE Format page: MS-DOS stub with e_lfanew, PE signature, COFF file header,
optional header, data directories, section table, import directory, hint/name table, export directory,
and a .reloc base relocation block. The file is not run on this machine. llvm-objdump reads it."""

from __future__ import annotations

import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "tiny-x86_64.exe"

IMAGE_BASE = 0x140000000
FILE_ALIGN = 0x200
SECTION_ALIGN = 0x1000
DLL = b"msvcrt.dll\0"
IMPORTS = ["puts", "exit"]
MESSAGE = b"linked by hand\0"
EXPORT_NAME = b"tiny_entry\0"
IMAGE_NAME = b"tiny-x86_64.exe\0"

IMAGE_FILE_MACHINE_AMD64 = 0x8664
IMAGE_FILE_EXECUTABLE_IMAGE = 0x0002
IMAGE_FILE_LARGE_ADDRESS_AWARE = 0x0020
PE32_PLUS = 0x20B
SUBSYSTEM_CUI = 3
DLL_HIGH_ENTROPY_VA, DLL_DYNAMIC_BASE, DLL_NX_COMPAT, DLL_TERMINAL_SERVER_AWARE = 0x0020, 0x0040, 0x0100, 0x8000
SCN_CODE, SCN_INITIALIZED_DATA = 0x00000020, 0x00000040
SCN_MEM_DISCARDABLE, SCN_MEM_EXECUTE, SCN_MEM_READ, SCN_MEM_WRITE = 0x02000000, 0x20000000, 0x40000000, 0x80000000
IMAGE_REL_BASED_DIR64 = 10
DIR_EXPORT, DIR_IMPORT, DIR_BASERELOC, DIR_IAT = 0, 1, 5, 12


def rel32(target_rva: int, next_rva: int) -> bytes:
    return struct.pack("<i", target_rva - next_rva)


def padded(blob: bytes, size: int) -> bytes:
    return blob + b"\0" * (size - len(blob))


def build() -> bytes:
    text_rva, rdata_rva, data_rva, reloc_rva = 0x1000, 0x2000, 0x3000, 0x4000
    text_off, rdata_off, data_off, reloc_off = 0x200, 0x400, 0x600, 0x800

    descriptor_rva = rdata_rva
    ilt_rva = rdata_rva + 0x28
    iat_rva = rdata_rva + 0x40
    hint_rva = {IMPORTS[0]: rdata_rva + 0x58, IMPORTS[1]: rdata_rva + 0x60}
    dll_rva = rdata_rva + 0x68
    export_dir_rva = rdata_rva + 0x80
    eat_rva = export_dir_rva + 40
    enpt_rva = eat_rva + 4
    eot_rva = enpt_rva + 4
    image_name_rva = eot_rva + 2
    export_name_rva = image_name_rva + len(IMAGE_NAME)
    message_rva = export_name_rva + len(EXPORT_NAME)
    export_size = message_rva - export_dir_rva

    code = (
        b"\x48\x83\xec\x28"
        + b"\x48\x8d\x0d" + rel32(message_rva, text_rva + 11)
        + b"\xff\x15" + rel32(iat_rva, text_rva + 17)
        + b"\x31\xc9"
        + b"\xff\x15" + rel32(iat_rva + 8, text_rva + 25)
        + b"\xcc"
    )

    rdata = bytearray(0x200)
    struct.pack_into("<IIIII", rdata, 0, ilt_rva, 0, 0, dll_rva, iat_rva)
    thunks = struct.pack("<QQQ", hint_rva[IMPORTS[0]], hint_rva[IMPORTS[1]], 0)
    rdata[0x28:0x40] = thunks
    rdata[0x40:0x58] = thunks
    rdata[0x58:0x60] = padded(b"\0\0" + IMPORTS[0].encode() + b"\0", 8)
    rdata[0x60:0x68] = padded(b"\0\0" + IMPORTS[1].encode() + b"\0", 8)
    rdata[0x68 : 0x68 + len(DLL)] = DLL
    struct.pack_into("<IIHHIIIIIII", rdata, 0x80, 0, 0, 0, 0, image_name_rva, 1, 1, 1, eat_rva, enpt_rva, eot_rva)
    struct.pack_into("<I", rdata, eat_rva - rdata_rva, text_rva)
    struct.pack_into("<I", rdata, enpt_rva - rdata_rva, export_name_rva)
    struct.pack_into("<H", rdata, eot_rva - rdata_rva, 0)
    rdata[image_name_rva - rdata_rva : image_name_rva - rdata_rva + len(IMAGE_NAME)] = IMAGE_NAME
    rdata[export_name_rva - rdata_rva : export_name_rva - rdata_rva + len(EXPORT_NAME)] = EXPORT_NAME
    rdata[message_rva - rdata_rva : message_rva - rdata_rva + len(MESSAGE)] = MESSAGE
    rdata_used = message_rva - rdata_rva + len(MESSAGE)

    data = struct.pack("<Q", IMAGE_BASE + message_rva)
    reloc = struct.pack("<IIHH", data_rva, 12, (IMAGE_REL_BASED_DIR64 << 12) | 0, 0)

    sections = [
        (b".text", len(code), text_rva, text_off, SCN_CODE | SCN_MEM_EXECUTE | SCN_MEM_READ),
        (b".rdata", rdata_used, rdata_rva, rdata_off, SCN_INITIALIZED_DATA | SCN_MEM_READ),
        (b".data", len(data), data_rva, data_off, SCN_INITIALIZED_DATA | SCN_MEM_READ | SCN_MEM_WRITE),
        (b".reloc", len(reloc), reloc_rva, reloc_off, SCN_INITIALIZED_DATA | SCN_MEM_READ | SCN_MEM_DISCARDABLE),
    ]

    image = bytearray(reloc_off + FILE_ALIGN)
    image[0:2] = b"MZ"
    struct.pack_into("<I", image, 0x3C, 0x40)
    image[0x40:0x44] = b"PE\0\0"
    struct.pack_into(
        "<HHIIIHH", image, 0x44,
        IMAGE_FILE_MACHINE_AMD64, len(sections), 0, 0, 0, 240, IMAGE_FILE_EXECUTABLE_IMAGE | IMAGE_FILE_LARGE_ADDRESS_AWARE,
    )
    struct.pack_into(
        "<HBBIIIIIQIIHHHHHHIIIIHHQQQQII", image, 0x58,
        PE32_PLUS, 14, 0, FILE_ALIGN, 3 * FILE_ALIGN, 0, text_rva, text_rva, IMAGE_BASE, SECTION_ALIGN, FILE_ALIGN,
        6, 0, 0, 0, 6, 0, 0, 0x5000, 0x200, 0, SUBSYSTEM_CUI,
        DLL_HIGH_ENTROPY_VA | DLL_DYNAMIC_BASE | DLL_NX_COMPAT | DLL_TERMINAL_SERVER_AWARE,
        0x100000, 0x1000, 0x100000, 0x1000, 0, 16,
    )
    directories = 0x58 + 112
    struct.pack_into("<II", image, directories + 8 * DIR_EXPORT, export_dir_rva, export_size)
    struct.pack_into("<II", image, directories + 8 * DIR_IMPORT, descriptor_rva, 40)
    struct.pack_into("<II", image, directories + 8 * DIR_BASERELOC, reloc_rva, len(reloc))
    struct.pack_into("<II", image, directories + 8 * DIR_IAT, iat_rva, 24)
    table = directories + 16 * 8
    for index, (name, virtual_size, rva, offset, characteristics) in enumerate(sections):
        struct.pack_into("<8sIIIIIIHHI", image, table + 40 * index, name, virtual_size, rva, FILE_ALIGN, offset, 0, 0, 0, 0, characteristics)
    image[text_off : text_off + len(code)] = code
    image[rdata_off : rdata_off + len(rdata)] = rdata
    image[data_off : data_off + len(data)] = data
    image[reloc_off : reloc_off + len(reloc)] = reloc
    return bytes(image)


if __name__ == "__main__":
    OUT.write_bytes(build())
    print(f"wrote {OUT.name}: {OUT.stat().st_size} bytes")
