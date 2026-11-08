import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "tiny-x86_64.exe"

IMAGE_BASE = 0x140000000
FILE_ALIGN = 0x200
SECTION_ALIGN = 0x1000
DLL_NAME = b"kernel32.dll\0"
IMPORTS = [b"GetStdHandle", b"WriteConsoleA", b"ExitProcess"]
MESSAGE = b"tally tiny image\r\n"
EXPORT_NAME = b"tally_report\0"
IMAGE_NAME = b"tiny-x86_64.exe\0"

MACHINE_AMD64 = 0x8664
FILE_EXECUTABLE_IMAGE = 0x0002
FILE_LARGE_ADDRESS_AWARE = 0x0020
PE32_PLUS = 0x20B
SUBSYSTEM_CUI = 3
DLL_HIGH_ENTROPY_VA = 0x0020
DLL_DYNAMIC_BASE = 0x0040
DLL_NX_COMPAT = 0x0100
DLL_TERMINAL_SERVER_AWARE = 0x8000
SCN_CODE = 0x00000020
SCN_INITIALIZED_DATA = 0x00000040
SCN_MEM_DISCARDABLE = 0x02000000
SCN_MEM_EXECUTE = 0x20000000
SCN_MEM_READ = 0x40000000
SCN_MEM_WRITE = 0x80000000
REL_BASED_DIR64 = 10
DIR_EXPORT, DIR_IMPORT, DIR_BASERELOC, DIR_IAT = 0, 1, 5, 12


def rel32(target_rva, next_rva):
    return struct.pack("<i", target_rva - next_rva)


def build():
    text_rva, rdata_rva, data_rva, reloc_rva = 0x1000, 0x2000, 0x3000, 0x4000
    text_off, rdata_off, data_off, reloc_off = 0x200, 0x400, 0x600, 0x800

    rdata = bytearray()

    def place(blob, align=1):
        while len(rdata) % align:
            rdata.append(0)
        start = rdata_rva + len(rdata)
        rdata.extend(blob)
        return start

    descriptor_rva = place(bytes(40))
    ilt_rva = place(bytes(8 * (len(IMPORTS) + 1)), 8)
    iat_rva = place(bytes(8 * (len(IMPORTS) + 1)), 8)
    hint_rvas = [place(struct.pack("<H", index) + name + b"\0", 2) for index, name in enumerate(IMPORTS)]
    dll_rva = place(DLL_NAME)
    export_dir_rva = place(bytes(40), 4)
    eat_rva = place(bytes(4), 4)
    enpt_rva = place(bytes(4), 4)
    eot_rva = place(bytes(2), 2)
    image_name_rva = place(IMAGE_NAME)
    export_name_rva = place(EXPORT_NAME)
    message_rva = place(MESSAGE + b"\0")
    export_size = message_rva - export_dir_rva

    struct.pack_into("<IIIII", rdata, descriptor_rva - rdata_rva, ilt_rva, 0, 0, dll_rva, iat_rva)
    thunks = b"".join(struct.pack("<Q", rva) for rva in hint_rvas) + bytes(8)
    rdata[ilt_rva - rdata_rva:ilt_rva - rdata_rva + len(thunks)] = thunks
    rdata[iat_rva - rdata_rva:iat_rva - rdata_rva + len(thunks)] = thunks
    struct.pack_into("<IIHHIIIIIII", rdata, export_dir_rva - rdata_rva, 0, 0, 0, 0, image_name_rva, 1, 1, 1, eat_rva, enpt_rva, eot_rva)
    struct.pack_into("<I", rdata, eat_rva - rdata_rva, text_rva)
    struct.pack_into("<I", rdata, enpt_rva - rdata_rva, export_name_rva)
    struct.pack_into("<H", rdata, eot_rva - rdata_rva, 0)

    code = bytearray()
    code += b"\x48\x83\xec\x28"
    code += b"\xb9\xf5\xff\xff\xff"
    code += b"\xff\x15" + rel32(iat_rva, text_rva + len(code) + 6)
    code += b"\x48\x89\xc1"
    code += b"\x48\x8d\x15" + rel32(message_rva, text_rva + len(code) + 7)
    code += b"\x41\xb8" + struct.pack("<I", len(MESSAGE))
    code += b"\x4c\x8d\x4c\x24\x20"
    code += b"\x48\xc7\x44\x24\x20\x00\x00\x00\x00"
    code += b"\xff\x15" + rel32(iat_rva + 8, text_rva + len(code) + 6)
    code += b"\x31\xc9"
    code += b"\xff\x15" + rel32(iat_rva + 16, text_rva + len(code) + 6)
    code += b"\xcc"

    data = struct.pack("<Q", IMAGE_BASE + message_rva)
    reloc = struct.pack("<IIHH", data_rva, 12, (REL_BASED_DIR64 << 12) | 0, 0)

    sections = [
        (b".text", len(code), text_rva, text_off, SCN_CODE | SCN_MEM_EXECUTE | SCN_MEM_READ),
        (b".rdata", len(rdata), rdata_rva, rdata_off, SCN_INITIALIZED_DATA | SCN_MEM_READ),
        (b".data", len(data), data_rva, data_off, SCN_INITIALIZED_DATA | SCN_MEM_READ | SCN_MEM_WRITE),
        (b".reloc", len(reloc), reloc_rva, reloc_off, SCN_INITIALIZED_DATA | SCN_MEM_READ | SCN_MEM_DISCARDABLE),
    ]

    image = bytearray(reloc_off + FILE_ALIGN)
    image[0:2] = b"MZ"
    struct.pack_into("<I", image, 0x3C, 0x40)
    image[0x40:0x44] = b"PE\0\0"
    struct.pack_into("<HHIIIHH", image, 0x44, MACHINE_AMD64, len(sections), 0, 0, 0, 240,
                     FILE_EXECUTABLE_IMAGE | FILE_LARGE_ADDRESS_AWARE)
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
    struct.pack_into("<II", image, directories + 8 * DIR_IAT, iat_rva, len(thunks))
    table = directories + 16 * 8
    for index, (name, virtual_size, rva, offset, characteristics) in enumerate(sections):
        struct.pack_into("<8sIIIIIIHHI", image, table + 40 * index, name, virtual_size, rva, FILE_ALIGN, offset,
                         0, 0, 0, 0, characteristics)
    image[text_off:text_off + len(code)] = code
    image[rdata_off:rdata_off + len(rdata)] = rdata
    image[data_off:data_off + len(data)] = data
    image[reloc_off:reloc_off + len(reloc)] = reloc
    return bytes(image)


if __name__ == "__main__":
    OUTPUT.write_bytes(build())
    print(f"wrote {OUTPUT.name}: {OUTPUT.stat().st_size} bytes")
