import math
from collections import Counter

from .formats import FormatError, load_commands, parse_header, unpack


ELF_SECTION_TYPES = {
    0: "NULL", 1: "PROGBITS", 2: "SYMTAB", 3: "STRTAB", 4: "RELA", 5: "HASH", 6: "DYNAMIC", 7: "NOTE",
    8: "NOBITS", 9: "REL", 11: "DYNSYM", 14: "INIT_ARRAY", 15: "FINI_ARRAY", 17: "GROUP",
    0x6FFF4C03: "LLVM_ADDRSIG", 0x6FFFFFF6: "GNU_HASH", 0x6FFFFFFE: "VERNEED", 0x6FFFFFFF: "VERSYM",
}
ELF_SEGMENT_TYPES = {
    0: "NULL", 1: "LOAD", 2: "DYNAMIC", 3: "INTERP", 4: "NOTE", 6: "PHDR", 7: "TLS",
    0x6474E550: "GNU_EH_FRAME", 0x6474E551: "GNU_STACK", 0x6474E552: "GNU_RELRO", 0x6474E553: "GNU_PROPERTY",
}
MACHO_SECTION_TYPES = {
    0: "regular", 1: "zerofill", 2: "cstring_literals", 6: "non_lazy_symbol_pointers",
    7: "lazy_symbol_pointers", 8: "symbol_stubs", 9: "mod_init_func_pointers", 0xC: "gb_zerofill",
    0x11: "thread_local_regular", 0x12: "thread_local_zerofill", 0x13: "thread_local_variables",
}
MACHO_ZEROFILL = {1, 0xC, 0x12}
MACHO_SEGMENT_PERMS = {"__TEXT": "r-x", "__DATA": "rw-", "__DATA_CONST": "rw-", "__LINKEDIT": "r--"}


def shannon_entropy(data):
    raise NotImplementedError("stage 2: implement shannon_entropy")


def sections(data):
    raise NotImplementedError("stage 2: implement sections")


def segments(data):
    raise NotImplementedError("stage 2: implement segments")


def section_at_offset(section_list, offset):
    raise NotImplementedError("stage 2: implement section_at_offset")


def section_at_address(section_list, address):
    raise NotImplementedError("stage 2: implement section_at_address")
