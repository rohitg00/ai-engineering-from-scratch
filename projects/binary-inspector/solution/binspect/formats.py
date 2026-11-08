import struct


class FormatError(ValueError):
    pass


ELF_MACHINES = {3: "x86", 40: "arm", 62: "x86_64", 183: "arm64", 243: "riscv"}
ELF_KINDS = {1: "relocatable", 2: "executable", 3: "shared", 4: "core"}
COFF_MACHINES = {0x14C: "x86", 0x8664: "x86_64", 0xAA64: "arm64"}
MACHO_CPUS = {0x01000007: "x86_64", 0x0100000C: "arm64", 7: "x86", 12: "arm"}
MACHO_KINDS = {1: "relocatable", 2: "executable", 6: "shared", 8: "bundle", 10: "debug"}
MACHO_FLAGS = {
    0x1: "MH_NOUNDEFS",
    0x4: "MH_DYLDLINK",
    0x80: "MH_TWOLEVEL",
    0x2000: "MH_SUBSECTIONS_VIA_SYMBOLS",
    0x200000: "MH_PIE",
}
LOAD_COMMANDS = {
    0x2: "LC_SYMTAB",
    0xB: "LC_DYSYMTAB",
    0xC: "LC_LOAD_DYLIB",
    0xD: "LC_ID_DYLIB",
    0xE: "LC_LOAD_DYLINKER",
    0x19: "LC_SEGMENT_64",
    0x1B: "LC_UUID",
    0x1D: "LC_CODE_SIGNATURE",
    0x26: "LC_FUNCTION_STARTS",
    0x29: "LC_DATA_IN_CODE",
    0x2A: "LC_SOURCE_VERSION",
    0x32: "LC_BUILD_VERSION",
    0x22: "LC_DYLD_INFO",
    0x80000022: "LC_DYLD_INFO_ONLY",
    0x80000018: "LC_LOAD_WEAK_DYLIB",
    0x8000001C: "LC_RPATH",
    0x80000028: "LC_MAIN",
    0x80000033: "LC_DYLD_EXPORTS_TRIE",
    0x80000034: "LC_DYLD_CHAINED_FIXUPS",
}
PE_DIRECTORIES = [
    "export", "import", "resource", "exception", "security", "basereloc", "debug", "architecture",
    "globalptr", "tls", "load_config", "bound_import", "iat", "delay_import", "clr", "reserved",
]
DLL_CHARACTERISTICS = {
    0x0020: "HIGH_ENTROPY_VA",
    0x0040: "DYNAMIC_BASE",
    0x0100: "NX_COMPAT",
    0x8000: "TERMINAL_SERVER_AWARE",
}


def unpack(fmt, data, offset):
    size = struct.calcsize(fmt)
    if offset < 0 or offset + size > len(data):
        raise FormatError(f"truncated: need {size} bytes at offset {offset:#x}, file has {len(data)}")
    return struct.unpack_from(fmt, data, offset)


def detect_format(data):
    if len(data) < 4:
        raise FormatError("file too short to hold a magic number")
    if data[:4] == b"\x7fELF":
        if len(data) < 6 or data[4] != 2:
            raise FormatError("only ELF64 (EI_CLASS 2) is supported")
        if data[5] != 1:
            raise FormatError("only little-endian ELF (EI_DATA 1) is supported")
        return "elf64"
    if data[:2] == b"MZ":
        (lfanew,) = unpack("<I", data, 0x3C)
        if unpack("<4s", data, lfanew)[0] != b"PE\0\0":
            raise FormatError(f"MZ header points at {lfanew:#x}, which has no PE signature")
        return "pe"
    magic = int.from_bytes(data[:4], "little")
    if magic == 0xFEEDFACF:
        return "macho64"
    if magic == 0xFEEDFACE:
        raise FormatError("32-bit Mach-O is not supported")
    if data[:4] == b"\xca\xfe\xba\xbe":
        raise FormatError("universal (fat) Mach-O: extract one slice with lipo first")
    if len(data) >= 20:
        machine, count, _, _, _, optional, _ = unpack("<HHIIIHH", data, 0)
        if machine in COFF_MACHINES and optional == 0 and 0 < count <= 96:
            return "coff"
    raise FormatError(f"unknown format: first bytes {data[:4].hex()}")


def _elf_header(data):
    fields = unpack("<16sHHIQQQIHHHHHH", data, 0)
    _, e_type, machine, _, entry, phoff, shoff, flags, _, phentsize, phnum, shentsize, shnum, shstrndx = fields
    if shnum and shentsize != 64:
        raise FormatError(f"section header entry size {shentsize}, expected 64")
    if phnum and phentsize != 56:
        raise FormatError(f"program header entry size {phentsize}, expected 56")
    if shoff + shnum * 64 > len(data):
        raise FormatError("section header table runs past the end of the file")
    if phoff + phnum * 56 > len(data):
        raise FormatError("program header table runs past the end of the file")
    if shnum and shstrndx >= shnum:
        raise FormatError(f"e_shstrndx {shstrndx} is not below e_shnum {shnum}")
    kind = ELF_KINDS.get(e_type, f"type {e_type}")
    return {
        "format": "elf64",
        "arch": ELF_MACHINES.get(machine, f"machine {machine:#x}"),
        "bits": 64,
        "endian": "little",
        "kind": kind,
        "entry": entry if kind in ("executable", "shared") and entry else None,
        "fields": {
            "e_type": e_type, "e_machine": machine, "e_flags": flags,
            "e_phoff": phoff, "e_phnum": phnum, "e_shoff": shoff, "e_shnum": shnum, "e_shstrndx": shstrndx,
        },
    }


def coff_file_header(data, offset):
    machine, count, stamp, symtab, nsyms, optional, characteristics = unpack("<HHIIIHH", data, offset)
    if symtab and symtab + nsyms * 18 > len(data):
        raise FormatError("COFF symbol table runs past the end of the file")
    return {
        "machine": machine, "number_of_sections": count, "time_date_stamp": stamp,
        "pointer_to_symbol_table": symtab, "number_of_symbols": nsyms,
        "size_of_optional_header": optional, "characteristics": characteristics,
        "section_table": offset + 20 + optional,
    }


def _coff_header(data):
    fields = coff_file_header(data, 0)
    return {
        "format": "coff",
        "arch": COFF_MACHINES[fields["machine"]],
        "bits": 64 if fields["machine"] != 0x14C else 32,
        "endian": "little",
        "kind": "relocatable",
        "entry": None,
        "fields": fields,
    }


def _pe_header(data):
    (lfanew,) = unpack("<I", data, 0x3C)
    fields = coff_file_header(data, lfanew + 4)
    optional = lfanew + 24
    (magic,) = unpack("<H", data, optional)
    if magic != 0x20B:
        raise FormatError(f"optional header magic {magic:#x}: only PE32+ (0x20b) is supported")
    if fields["size_of_optional_header"] < 112:
        raise FormatError("optional header too small for PE32+")
    entry_rva, = unpack("<I", data, optional + 16)
    image_base, section_alignment, file_alignment = unpack("<QII", data, optional + 24)
    size_of_image, size_of_headers = unpack("<II", data, optional + 56)
    subsystem, dll = unpack("<HH", data, optional + 68)
    (count,) = unpack("<I", data, optional + 108)
    count = min(count, 16, (fields["size_of_optional_header"] - 112) // 8)
    directories = {}
    for index in range(count):
        rva, size = unpack("<II", data, optional + 112 + 8 * index)
        if rva or size:
            directories[PE_DIRECTORIES[index]] = {"rva": rva, "size": size}
    fields.update({
        "magic": magic, "entry_rva": entry_rva, "image_base": image_base,
        "section_alignment": section_alignment, "file_alignment": file_alignment,
        "size_of_image": size_of_image, "size_of_headers": size_of_headers, "subsystem": subsystem,
        "dll_characteristics": dll,
        "dll_flags": [name for bit, name in DLL_CHARACTERISTICS.items() if dll & bit],
        "data_directories": directories,
    })
    return {
        "format": "pe",
        "arch": COFF_MACHINES.get(fields["machine"], f"machine {fields['machine']:#x}"),
        "bits": 64,
        "endian": "little",
        "kind": "shared" if fields["characteristics"] & 0x2000 else "executable",
        "entry": image_base + entry_rva if entry_rva else None,
        "fields": fields,
    }


def load_commands(data):
    _, _, _, _, ncmds, sizeofcmds, _, _ = unpack("<IiiIIIII", data, 0)
    if 32 + sizeofcmds > len(data):
        raise FormatError("load commands run past the end of the file")
    commands, offset = [], 32
    for _ in range(ncmds):
        cmd, size = unpack("<II", data, offset)
        if size < 8 or size % 8 or offset + size > 32 + sizeofcmds:
            raise FormatError(f"load command at {offset:#x} has invalid size {size}")
        commands.append({"cmd": cmd, "name": LOAD_COMMANDS.get(cmd, f"LC_{cmd:#x}"), "offset": offset, "size": size})
        offset += size
    return commands


def _macho_header(data):
    _, cputype, _, filetype, ncmds, sizeofcmds, flags, _ = unpack("<IiiIIIII", data, 0)
    commands = load_commands(data)
    entry = None
    text_base = None
    for command in commands:
        if command["name"] == "LC_SEGMENT_64":
            name, vmaddr = unpack("<16sQ", data, command["offset"] + 8)
            if name.rstrip(b"\0") == b"__TEXT":
                text_base = vmaddr
    for command in commands:
        if command["name"] == "LC_MAIN" and text_base is not None:
            (entryoff,) = unpack("<Q", data, command["offset"] + 8)
            entry = text_base + entryoff
    return {
        "format": "macho64",
        "arch": MACHO_CPUS.get(cputype & 0xFFFFFFFF, f"cpu {cputype:#x}"),
        "bits": 64,
        "endian": "little",
        "kind": MACHO_KINDS.get(filetype, f"filetype {filetype}"),
        "entry": entry,
        "fields": {
            "cputype": cputype, "filetype": filetype, "ncmds": ncmds, "sizeofcmds": sizeofcmds, "flags": flags,
            "flag_names": [name for bit, name in MACHO_FLAGS.items() if flags & bit],
            "load_commands": [command["name"] for command in commands],
        },
    }


def parse_header(data):
    kind = detect_format(data)
    if kind == "elf64":
        return _elf_header(data)
    if kind == "pe":
        return _pe_header(data)
    if kind == "coff":
        return _coff_header(data)
    return _macho_header(data)
