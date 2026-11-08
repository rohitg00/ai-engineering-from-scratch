from .formats import FormatError, load_commands, parse_header, unpack
from .layout import section_at_address, sections, segments
from .symbols import read_cstring, symbols


X86_64_ELF = {
    0: "NONE", 1: "64", 2: "PC32", 3: "GOT32", 4: "PLT32", 6: "GLOB_DAT", 7: "JUMP_SLOT", 8: "RELATIVE",
    9: "GOTPCREL", 10: "32", 11: "32S", 24: "PC64", 41: "GOTPCRELX", 42: "REX_GOTPCRELX",
}
AARCH64_ELF = {
    257: "ABS64", 258: "ABS32", 261: "PREL32", 275: "ADR_PREL_PG_HI21", 277: "ADD_ABS_LO12_NC",
    278: "LDST8_ABS_LO12_NC", 282: "JUMP26", 283: "CALL26", 284: "LDST16_ABS_LO12_NC",
    285: "LDST32_ABS_LO12_NC", 286: "LDST64_ABS_LO12_NC", 311: "ADR_GOT_PAGE", 312: "LD64_GOT_LO12_NC",
    1025: "GLOB_DAT", 1026: "JUMP_SLOT", 1027: "RELATIVE",
}
AMD64_COFF = {
    0: "ABSOLUTE", 1: "ADDR64", 2: "ADDR32", 3: "ADDR32NB", 4: "REL32", 5: "REL32_1", 6: "REL32_2",
    7: "REL32_3", 8: "REL32_4", 9: "REL32_5", 10: "SECTION", 11: "SECREL",
}
ARM64_COFF = {1: "ADDR32", 2: "ADDR32NB", 3: "BRANCH26", 4: "PAGEBASE_REL21", 6: "PAGEOFFSET_12A", 7: "PAGEOFFSET_12L", 14: "ADDR64"}
ARM64_MACHO = {
    0: "UNSIGNED", 1: "SUBTRACTOR", 2: "BRANCH26", 3: "PAGE21", 4: "PAGEOFF12", 5: "GOT_LOAD_PAGE21",
    6: "GOT_LOAD_PAGEOFF12", 7: "POINTER_TO_GOT", 8: "TLVP_LOAD_PAGE21", 9: "TLVP_LOAD_PAGEOFF12", 10: "ADDEND",
}
X86_64_MACHO = {
    0: "UNSIGNED", 1: "SIGNED", 2: "BRANCH", 3: "GOT_LOAD", 4: "GOT", 5: "SUBTRACTOR", 6: "SIGNED_1",
    7: "SIGNED_2", 8: "SIGNED_4", 9: "TLV",
}
BASE_RELOCATIONS = {0: "ABSOLUTE", 3: "HIGHLOW", 10: "DIR64"}
POINTER_FORMATS = {2: "DYLD_CHAINED_PTR_64", 6: "DYLD_CHAINED_PTR_64_OFFSET"}


def uleb128(data, offset):
    raise NotImplementedError("stage 4: implement uleb128")


def relocations(data):
    raise NotImplementedError("stage 4: implement relocations")


def chained_fixups(data):
    raise NotImplementedError("stage 4: implement chained_fixups")


def imports(data):
    raise NotImplementedError("stage 4: implement imports")


def exports(data):
    raise NotImplementedError("stage 4: implement exports")
