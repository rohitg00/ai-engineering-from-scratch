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
    raise NotImplementedError("stage 1: implement detect_format")


def load_commands(data):
    raise NotImplementedError("stage 1: implement load_commands")


def parse_header(data):
    raise NotImplementedError("stage 1: implement parse_header")
