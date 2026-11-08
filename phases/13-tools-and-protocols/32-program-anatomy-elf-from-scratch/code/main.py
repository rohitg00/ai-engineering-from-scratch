"""Companion code for docs/en.md: read ELF64 and Mach-O files with the standard library only.
ELF contract: System V gABI chapters 4 and 5, https://www.sco.com/developers/gabi/latest/contents.html
x86-64 relocation names: System V ABI, AMD64 Architecture Processor Supplement, Table 4.9
Mach-O contract: Apple XNU EXTERNAL_HEADERS/mach-o/loader.h, nlist.h, reloc.h
Run `python3 main.py` for the finite demo, `python3 main.py <file>` for one file,
or `python3 -m unittest discover -s tests`.
"""

from __future__ import annotations

import struct
import sys
from dataclasses import dataclass
from pathlib import Path

FIXTURES = Path(__file__).resolve().parent / "fixtures"


class FormatError(ValueError):
    """The bytes do not follow the format the reader expects."""


ELF_MAGIC = b"\x7fELF"
ELFCLASS64 = 2
ELFDATA2LSB = 1
EHDR_SIZE = 64
SHDR_SIZE = 64
PHDR_SIZE = 56
SYM_SIZE = 24
RELA_SIZE = 24

E_TYPE = {0: "ET_NONE", 1: "ET_REL", 2: "ET_EXEC", 3: "ET_DYN", 4: "ET_CORE"}
E_MACHINE = {0: "EM_NONE", 3: "EM_386", 40: "EM_ARM", 62: "EM_X86_64", 183: "EM_AARCH64", 243: "EM_RISCV"}
OSABI = {0: "SYSV", 3: "LINUX", 9: "FREEBSD"}

SHT = {
    0: "NULL", 1: "PROGBITS", 2: "SYMTAB", 3: "STRTAB", 4: "RELA", 5: "HASH", 6: "DYNAMIC", 7: "NOTE",
    8: "NOBITS", 9: "REL", 10: "SHLIB", 11: "DYNSYM", 14: "INIT_ARRAY", 15: "FINI_ARRAY",
    16: "PREINIT_ARRAY", 17: "GROUP", 18: "SYMTAB_SHNDX", 0x6FFF4C03: "LLVM_ADDRSIG",
}
SHT_NOBITS = 8
SHT_SYMTAB = 2
SHT_RELA = 4
SHF = [
    (0x1, "W"), (0x2, "A"), (0x4, "X"), (0x10, "M"), (0x20, "S"), (0x40, "I"),
    (0x80, "L"), (0x100, "O"), (0x200, "G"), (0x400, "T"), (0x80000000, "E"),
]
SHF_ALLOC, SHF_EXECINSTR = 0x2, 0x4

SHN_UNDEF = 0
SHN_LORESERVE = 0xFF00
SHN_ABS = 0xFFF1
SHN_COMMON = 0xFFF2

STB = {0: "LOCAL", 1: "GLOBAL", 2: "WEAK"}
STT = {0: "NOTYPE", 1: "OBJECT", 2: "FUNC", 3: "SECTION", 4: "FILE", 5: "COMMON", 6: "TLS"}
STV = {0: "DEFAULT", 1: "INTERNAL", 2: "HIDDEN", 3: "PROTECTED"}
STT_FUNC = 2
STT_SECTION = 3

PT = {
    0: "PT_NULL", 1: "PT_LOAD", 2: "PT_DYNAMIC", 3: "PT_INTERP", 4: "PT_NOTE", 5: "PT_SHLIB",
    6: "PT_PHDR", 7: "PT_TLS", 0x6474E550: "PT_GNU_EH_FRAME", 0x6474E551: "PT_GNU_STACK",
    0x6474E552: "PT_GNU_RELRO", 0x6474E553: "PT_GNU_PROPERTY",
}
PT_LOAD = 1

R_X86_64 = {
    0: "R_X86_64_NONE", 1: "R_X86_64_64", 2: "R_X86_64_PC32", 3: "R_X86_64_GOT32", 4: "R_X86_64_PLT32",
    5: "R_X86_64_COPY", 6: "R_X86_64_GLOB_DAT", 7: "R_X86_64_JUMP_SLOT", 8: "R_X86_64_RELATIVE",
    9: "R_X86_64_GOTPCREL", 10: "R_X86_64_32", 11: "R_X86_64_32S", 12: "R_X86_64_16", 13: "R_X86_64_PC16",
    14: "R_X86_64_8", 15: "R_X86_64_PC8", 16: "R_X86_64_DTPMOD64", 17: "R_X86_64_DTPOFF64",
    18: "R_X86_64_TPOFF64", 19: "R_X86_64_TLSGD", 20: "R_X86_64_TLSLD", 21: "R_X86_64_DTPOFF32",
    22: "R_X86_64_GOTTPOFF", 23: "R_X86_64_TPOFF32", 24: "R_X86_64_PC64", 25: "R_X86_64_GOTOFF64",
    26: "R_X86_64_GOTPC32", 32: "R_X86_64_SIZE32", 33: "R_X86_64_SIZE64", 34: "R_X86_64_GOTPC32_TLSDESC",
    35: "R_X86_64_TLSDESC_CALL", 36: "R_X86_64_TLSDESC", 37: "R_X86_64_IRELATIVE",
    41: "R_X86_64_GOTPCRELX", 42: "R_X86_64_REX_GOTPCRELX",
}
R_AARCH64 = {
    257: "R_AARCH64_ABS64", 275: "R_AARCH64_ADR_PREL_PG_HI21", 277: "R_AARCH64_ADD_ABS_LO12_NC",
    282: "R_AARCH64_JUMP26", 283: "R_AARCH64_CALL26", 299: "R_AARCH64_LDST128_ABS_LO12_NC",
    1025: "R_AARCH64_GLOB_DAT", 1026: "R_AARCH64_JUMP_SLOT", 1027: "R_AARCH64_RELATIVE", 1031: "R_AARCH64_TLSDESC",
}
RELOCATION_NAMES = {62: R_X86_64, 183: R_AARCH64}


def _hex(value: int) -> str:
    return f"0x{value:x}"


@dataclass(frozen=True)
class ElfHeader:
    elf_class: int
    data: int
    ident_version: int
    osabi: int
    e_type: int
    e_machine: int
    e_version: int
    e_entry: int
    e_phoff: int
    e_shoff: int
    e_flags: int
    e_ehsize: int
    e_phentsize: int
    e_phnum: int
    e_shentsize: int
    e_shnum: int
    e_shstrndx: int

    @property
    def type_name(self) -> str:
        return E_TYPE.get(self.e_type, _hex(self.e_type))

    @property
    def machine_name(self) -> str:
        return E_MACHINE.get(self.e_machine, _hex(self.e_machine))


@dataclass(frozen=True)
class Section:
    index: int
    name: str
    sh_name: int
    sh_type: int
    sh_flags: int
    sh_addr: int
    sh_offset: int
    sh_size: int
    sh_link: int
    sh_info: int
    sh_addralign: int
    sh_entsize: int

    @property
    def type_name(self) -> str:
        return SHT.get(self.sh_type, _hex(self.sh_type))

    @property
    def flags_text(self) -> str:
        return "".join(letter for bit, letter in SHF if self.sh_flags & bit)

    @property
    def file_size(self) -> int:
        return 0 if self.sh_type == SHT_NOBITS else self.sh_size

    @property
    def objdump_kind(self) -> str:
        if self.sh_flags & SHF_EXECINSTR:
            return "TEXT"
        if self.sh_flags & SHF_ALLOC and self.sh_type == SHT_NOBITS:
            return "BSS"
        if self.sh_flags & SHF_ALLOC:
            return "DATA"
        return ""


@dataclass(frozen=True)
class Symbol:
    index: int
    name: str
    st_name: int
    st_info: int
    st_other: int
    st_shndx: int
    st_value: int
    st_size: int
    section_name: str

    @property
    def bind(self) -> str:
        return STB.get(self.st_info >> 4, str(self.st_info >> 4))

    @property
    def type(self) -> str:
        return STT.get(self.st_info & 0xF, str(self.st_info & 0xF))

    @property
    def visibility(self) -> str:
        return STV.get(self.st_other & 0x3, str(self.st_other & 0x3))

    @property
    def display_name(self) -> str:
        if self.st_info & 0xF == STT_SECTION and not self.name:
            return self.section_name
        return self.name


@dataclass(frozen=True)
class Relocation:
    table: str
    target_section: str
    r_offset: int
    r_type: int
    type_name: str
    sym_index: int
    symbol: str
    r_addend: int

    @property
    def value_text(self) -> str:
        if self.r_addend > 0:
            return f"{self.symbol}+{_hex(self.r_addend)}"
        if self.r_addend < 0:
            return f"{self.symbol}-{_hex(-self.r_addend)}"
        return self.symbol


@dataclass(frozen=True)
class ProgramHeader:
    index: int
    p_type: int
    p_flags: int
    p_offset: int
    p_vaddr: int
    p_paddr: int
    p_filesz: int
    p_memsz: int
    p_align: int

    @property
    def type_name(self) -> str:
        return PT.get(self.p_type, _hex(self.p_type))

    @property
    def flags_text(self) -> str:
        return ("r" if self.p_flags & 4 else "-") + ("w" if self.p_flags & 2 else "-") + ("x" if self.p_flags & 1 else "-")


@dataclass(frozen=True)
class Span:
    file_offset: int
    size: int
    container: str


@dataclass(frozen=True)
class Region:
    name: str
    kind: str
    offset: int
    size: int

    @property
    def end(self) -> int:
        return self.offset + self.size


class ElfFile:
    """An ELF64 little-endian file: relocatable object, executable, or shared object."""

    def __init__(self, data: bytes):
        self.data = bytes(data)
        self.header = self._read_header()
        self.sections = self._read_sections()
        self.program_headers = self._read_program_headers()
        self.symbols = self._read_symbols()
        self.relocations = self._read_relocations()

    @classmethod
    def from_path(cls, path: str | Path) -> "ElfFile":
        return cls(Path(path).read_bytes())

    def _read_header(self) -> ElfHeader:
        data = self.data
        if len(data) < EHDR_SIZE:
            raise FormatError(f"file is {len(data)} bytes, shorter than the 64-byte ELF header")
        if data[:4] != ELF_MAGIC:
            raise FormatError(f"magic is {data[:4]!r}, expected {ELF_MAGIC!r}")
        if data[4] != ELFCLASS64:
            raise FormatError(f"EI_CLASS is {data[4]}, this reader handles ELFCLASS64 (2) only")
        if data[5] != ELFDATA2LSB:
            raise FormatError(f"EI_DATA is {data[5]}, this reader handles ELFDATA2LSB (1) only")
        fields = struct.unpack_from("<HHIQQQIHHHHHH", data, 16)
        header = ElfHeader(data[4], data[5], data[6], data[7], *fields)
        if header.e_shnum and header.e_shentsize != SHDR_SIZE:
            raise FormatError(f"e_shentsize is {header.e_shentsize}, expected {SHDR_SIZE}")
        if header.e_phnum and header.e_phentsize != PHDR_SIZE:
            raise FormatError(f"e_phentsize is {header.e_phentsize}, expected {PHDR_SIZE}")
        return header

    def _table(self, offset: int, count: int, entry_size: int, what: str) -> bytes:
        end = offset + count * entry_size
        if end > len(self.data):
            raise FormatError(f"{what} ends at {_hex(end)}, past the {len(self.data)}-byte file")
        return self.data[offset:end]

    def _read_sections(self) -> list[Section]:
        h = self.header
        if h.e_shoff == 0 or h.e_shnum == 0:
            return []
        raw = self._table(h.e_shoff, h.e_shnum, SHDR_SIZE, "section header table")
        rows = [struct.unpack_from("<IIQQQQIIQQ", raw, i * SHDR_SIZE) for i in range(h.e_shnum)]
        if h.e_shstrndx >= h.e_shnum:
            raise FormatError(f"e_shstrndx {h.e_shstrndx} is outside the {h.e_shnum} section headers")
        shstr = rows[h.e_shstrndx]
        strtab = self.data[shstr[4] : shstr[4] + shstr[5]]
        return [Section(index, read_cstring(strtab, row[0]), *row) for index, row in enumerate(rows)]

    def section(self, name: str) -> Section:
        for section in self.sections:
            if section.name == name:
                return section
        raise KeyError(f"no section named {name!r}")

    def section_bytes(self, section: Section) -> bytes:
        if section.sh_type == SHT_NOBITS:
            return b""
        return self.data[section.sh_offset : section.sh_offset + section.sh_size]

    def string(self, strtab_index: int, offset: int) -> str:
        return read_cstring(self.section_bytes(self.sections[strtab_index]), offset)

    def section_name_for_index(self, shndx: int) -> str:
        if shndx == SHN_UNDEF:
            return "*UND*"
        if shndx == SHN_ABS:
            return "*ABS*"
        if shndx == SHN_COMMON:
            return "*COM*"
        if shndx >= SHN_LORESERVE or shndx >= len(self.sections):
            return _hex(shndx)
        return self.sections[shndx].name

    def _read_program_headers(self) -> list[ProgramHeader]:
        h = self.header
        if h.e_phoff == 0 or h.e_phnum == 0:
            return []
        raw = self._table(h.e_phoff, h.e_phnum, PHDR_SIZE, "program header table")
        return [ProgramHeader(i, *struct.unpack_from("<IIQQQQQQ", raw, i * PHDR_SIZE)) for i in range(h.e_phnum)]

    def _read_symbols(self) -> list[Symbol]:
        symtabs = [s for s in self.sections if s.sh_type == SHT_SYMTAB]
        if not symtabs:
            return []
        symtab = symtabs[0]
        if symtab.sh_entsize not in (0, SYM_SIZE):
            raise FormatError(f".symtab sh_entsize is {symtab.sh_entsize}, expected {SYM_SIZE}")
        raw = self.section_bytes(symtab)
        count = len(raw) // SYM_SIZE
        symbols = []
        for index in range(count):
            st_name, st_info, st_other, st_shndx, st_value, st_size = struct.unpack_from("<IBBHQQ", raw, index * SYM_SIZE)
            name = self.string(symtab.sh_link, st_name)
            section_name = self.section_name_for_index(st_shndx)
            symbols.append(Symbol(index, name, st_name, st_info, st_other, st_shndx, st_value, st_size, section_name))
        return symbols

    def symbol(self, name: str) -> Symbol:
        for symbol in self.symbols:
            if symbol.name == name:
                return symbol
        raise KeyError(f"no symbol named {name!r}")

    def _read_relocations(self) -> list[Relocation]:
        names = RELOCATION_NAMES.get(self.header.e_machine, {})
        out = []
        for section in self.sections:
            if section.sh_type != SHT_RELA:
                continue
            if section.sh_entsize not in (0, RELA_SIZE):
                raise FormatError(f"{section.name} sh_entsize is {section.sh_entsize}, expected {RELA_SIZE}")
            target = self.section_name_for_index(section.sh_info)
            raw = self.section_bytes(section)
            for i in range(len(raw) // RELA_SIZE):
                r_offset, r_info, r_addend = struct.unpack_from("<QQq", raw, i * RELA_SIZE)
                sym_index = r_info >> 32
                r_type = r_info & 0xFFFFFFFF
                symbol = self.symbols[sym_index].display_name if sym_index < len(self.symbols) else _hex(sym_index)
                type_name = names.get(r_type, f"R_{r_type}")
                out.append(Relocation(section.name, target, r_offset, r_type, type_name, sym_index, symbol, r_addend))
        return out

    def relocations_for(self, target_section: str) -> list[Relocation]:
        return [r for r in self.relocations if r.target_section == target_section]

    def function_span(self, name: str) -> Span:
        symbol = self.symbol(name)
        if symbol.st_info & 0xF != STT_FUNC:
            raise KeyError(f"{name!r} is a {symbol.type} symbol, not a FUNC")
        if symbol.st_shndx == SHN_UNDEF or symbol.st_shndx >= SHN_LORESERVE:
            raise KeyError(f"{name!r} has no section in this file (st_shndx {_hex(symbol.st_shndx)})")
        section = self.sections[symbol.st_shndx]
        file_offset = section.sh_offset + (symbol.st_value - section.sh_addr)
        if symbol.st_value - section.sh_addr + symbol.st_size > section.sh_size:
            raise FormatError(f"{name!r} runs past the end of {section.name}")
        return Span(file_offset, symbol.st_size, section.name)

    def function_bytes(self, name: str) -> bytes:
        span = self.function_span(name)
        return self.data[span.file_offset : span.file_offset + span.size]

    def address_to_file_offset(self, address: int) -> int:
        """Map a virtual address to a file offset through PT_LOAD, then through allocated sections."""
        if self.header.e_type == 1:
            raise KeyError("relocatable object: every address is relative to its section, use function_span")
        for ph in self.program_headers:
            if ph.p_type == PT_LOAD and ph.p_vaddr <= address < ph.p_vaddr + ph.p_filesz:
                return ph.p_offset + (address - ph.p_vaddr)
        for section in self.sections:
            if not section.sh_flags & SHF_ALLOC or section.sh_type == SHT_NOBITS:
                continue
            if section.sh_addr <= address < section.sh_addr + section.sh_size:
                return section.sh_offset + (address - section.sh_addr)
        raise KeyError(f"address {_hex(address)} is in no PT_LOAD segment and no allocated section")

    def file_offset_map(self) -> list[Region]:
        """Every byte range in the file with the structure that owns it, gaps included."""
        h = self.header
        regions = [Region("ELF header", "header", 0, EHDR_SIZE)]
        if h.e_phnum:
            regions.append(Region("program header table", "table", h.e_phoff, h.e_phnum * PHDR_SIZE))
        for section in self.sections:
            if section.index == 0 or section.file_size == 0:
                continue
            regions.append(Region(section.name, "section", section.sh_offset, section.file_size))
        if h.e_shnum:
            regions.append(Region("section header table", "table", h.e_shoff, h.e_shnum * SHDR_SIZE))
        regions.sort(key=lambda r: (r.offset, r.size))
        filled: list[Region] = []
        cursor = 0
        for region in regions:
            if region.offset < cursor:
                raise FormatError(f"{region.name} at {_hex(region.offset)} overlaps the region before it")
            if region.offset > cursor:
                filled.append(Region("inactive space", "gap", cursor, region.offset - cursor))
            filled.append(region)
            cursor = region.end
        if cursor < len(self.data):
            filled.append(Region("inactive space", "gap", cursor, len(self.data) - cursor))
        if cursor > len(self.data):
            raise FormatError(f"structures end at {_hex(cursor)}, past the {len(self.data)}-byte file")
        return filled


def fixed_name(raw: bytes) -> str:
    return raw.rstrip(b"\0").decode("ascii", errors="replace")


def read_cstring(table: bytes, offset: int) -> str:
    if offset >= len(table):
        raise FormatError(f"string offset {_hex(offset)} is outside a {len(table)}-byte string table")
    end = table.find(b"\0", offset)
    if end < 0:
        raise FormatError(f"string at {_hex(offset)} has no terminating zero byte")
    return table[offset:end].decode("utf-8", errors="replace")


MH_MAGIC_64 = 0xFEEDFACF
MH_CIGAM_64 = 0xCFFAEDFE
MH_MAGIC_32 = 0xFEEDFACE
FAT_MAGIC = 0xCAFEBABE
MACH_HEADER_64_SIZE = 32
LC_REQ_DYLD = 0x80000000

CPU_TYPE = {0x01000007: "CPU_TYPE_X86_64", 0x0100000C: "CPU_TYPE_ARM64", 7: "CPU_TYPE_X86", 12: "CPU_TYPE_ARM"}
MH_FILETYPE = {
    0x1: "MH_OBJECT", 0x2: "MH_EXECUTE", 0x3: "MH_FVMLIB", 0x4: "MH_CORE", 0x5: "MH_PRELOAD", 0x6: "MH_DYLIB",
    0x7: "MH_DYLINKER", 0x8: "MH_BUNDLE", 0x9: "MH_DYLIB_STUB", 0xA: "MH_DSYM", 0xB: "MH_KEXT_BUNDLE", 0xC: "MH_FILESET",
}
MH_FLAGS = [
    (0x1, "MH_NOUNDEFS"), (0x4, "MH_DYLDLINK"), (0x80, "MH_TWOLEVEL"), (0x2000, "MH_SUBSECTIONS_VIA_SYMBOLS"),
    (0x200000, "MH_PIE"), (0x800000, "MH_HAS_TLV_DESCRIPTORS"),
]
LC = {
    0x1: "LC_SEGMENT", 0x2: "LC_SYMTAB", 0x5: "LC_UNIXTHREAD", 0xB: "LC_DYSYMTAB", 0xC: "LC_LOAD_DYLIB",
    0xD: "LC_ID_DYLIB", 0xE: "LC_LOAD_DYLINKER", 0x19: "LC_SEGMENT_64", 0x1B: "LC_UUID",
    0x1C | LC_REQ_DYLD: "LC_RPATH", 0x1D: "LC_CODE_SIGNATURE", 0x22: "LC_DYLD_INFO",
    0x22 | LC_REQ_DYLD: "LC_DYLD_INFO_ONLY", 0x26: "LC_FUNCTION_STARTS", 0x28 | LC_REQ_DYLD: "LC_MAIN",
    0x29: "LC_DATA_IN_CODE", 0x2A: "LC_SOURCE_VERSION", 0x2E: "LC_LINKER_OPTIMIZATION_HINT",
    0x32: "LC_BUILD_VERSION", 0x33 | LC_REQ_DYLD: "LC_DYLD_EXPORTS_TRIE", 0x34 | LC_REQ_DYLD: "LC_DYLD_CHAINED_FIXUPS",
}
LC_SEGMENT_64 = 0x19
LC_SYMTAB = 0x2
LC_BUILD_VERSION = 0x32
PLATFORM = {1: "macos", 2: "ios", 3: "tvos", 4: "watchos", 5: "bridgeos", 6: "maccatalyst", 7: "iossimulator"}
SECTION_TYPE = {0x0: "S_REGULAR", 0x1: "S_ZEROFILL", 0x2: "S_CSTRING_LITERALS", 0x6: "S_NON_LAZY_SYMBOL_POINTERS",
                0x7: "S_LAZY_SYMBOL_POINTERS", 0x8: "S_SYMBOL_STUBS", 0x9: "S_MOD_INIT_FUNC_POINTERS",
                0x16: "S_INIT_FUNC_OFFSETS"}
N_STAB, N_PEXT, N_TYPE, N_EXT = 0xE0, 0x10, 0x0E, 0x01
N_TYPE_NAMES = {0x0: "N_UNDF", 0x2: "N_ABS", 0xA: "N_INDR", 0xC: "N_PBUD", 0xE: "N_SECT"}
N_SECT = 0xE
ARM64_RELOC = {
    0: "ARM64_RELOC_UNSIGNED", 1: "ARM64_RELOC_SUBTRACTOR", 2: "ARM64_RELOC_BRANCH26", 3: "ARM64_RELOC_PAGE21",
    4: "ARM64_RELOC_PAGEOFF12", 5: "ARM64_RELOC_GOT_LOAD_PAGE21", 6: "ARM64_RELOC_GOT_LOAD_PAGEOFF12",
    7: "ARM64_RELOC_POINTER_TO_GOT", 8: "ARM64_RELOC_TLVP_LOAD_PAGE21", 9: "ARM64_RELOC_TLVP_LOAD_PAGEOFF12",
    10: "ARM64_RELOC_ADDEND", 11: "ARM64_RELOC_AUTHENTICATED_POINTER",
}


@dataclass(frozen=True)
class MachHeader:
    magic: int
    cputype: int
    cpusubtype: int
    filetype: int
    ncmds: int
    sizeofcmds: int
    flags: int
    reserved: int

    @property
    def cputype_name(self) -> str:
        return CPU_TYPE.get(self.cputype, _hex(self.cputype))

    @property
    def filetype_name(self) -> str:
        return MH_FILETYPE.get(self.filetype, _hex(self.filetype))

    @property
    def flags_text(self) -> str:
        return " ".join(name for bit, name in MH_FLAGS if self.flags & bit)


@dataclass(frozen=True)
class LoadCommand:
    index: int
    cmd: int
    cmdsize: int
    offset: int

    @property
    def name(self) -> str:
        return LC.get(self.cmd, _hex(self.cmd))


@dataclass(frozen=True)
class MachSection:
    index: int
    sectname: str
    segname: str
    addr: int
    size: int
    offset: int
    align: int
    reloff: int
    nreloc: int
    flags: int

    @property
    def type_name(self) -> str:
        return SECTION_TYPE.get(self.flags & 0xFF, _hex(self.flags & 0xFF))

    @property
    def qualified_name(self) -> str:
        return f"{self.segname},{self.sectname}"


@dataclass(frozen=True)
class Segment:
    segname: str
    vmaddr: int
    vmsize: int
    fileoff: int
    filesize: int
    maxprot: int
    initprot: int
    nsects: int
    flags: int
    sections: tuple[MachSection, ...]


@dataclass(frozen=True)
class SymtabCommand:
    symoff: int
    nsyms: int
    stroff: int
    strsize: int


@dataclass(frozen=True)
class BuildVersion:
    platform: int
    minos: str
    sdk: str

    @property
    def platform_name(self) -> str:
        return PLATFORM.get(self.platform, str(self.platform))


@dataclass(frozen=True)
class Nlist:
    index: int
    name: str
    n_strx: int
    n_type: int
    n_sect: int
    n_desc: int
    n_value: int
    section_name: str

    @property
    def external(self) -> bool:
        return bool(self.n_type & N_EXT)

    @property
    def type_name(self) -> str:
        if self.n_type & N_STAB:
            return "N_STAB"
        return N_TYPE_NAMES.get(self.n_type & N_TYPE, _hex(self.n_type & N_TYPE))


@dataclass(frozen=True)
class MachRelocation:
    section: str
    r_address: int
    r_symbolnum: int
    r_pcrel: bool
    r_length: int
    r_extern: bool
    r_type: int
    type_name: str
    symbol: str


def version_text(packed: int) -> str:
    """Decode the XXXX.YY.ZZ packing of build_version_command; otool omits a zero patch level."""
    major, minor, patch = packed >> 16, (packed >> 8) & 0xFF, packed & 0xFF
    return f"{major}.{minor}" if patch == 0 else f"{major}.{minor}.{patch}"


class MachOFile:
    """A thin 64-bit little-endian Mach-O file."""

    def __init__(self, data: bytes):
        self.data = bytes(data)
        self.header = self._read_header()
        self.load_commands = self._read_load_commands()
        self.segments = self._read_segments()
        self.sections = tuple(s for seg in self.segments for s in seg.sections)
        self.symtab_command = self._read_symtab_command()
        self.build_version = self._read_build_version()
        self.symbols = self._read_symbols()
        self.relocations = self._read_relocations()

    @classmethod
    def from_path(cls, path: str | Path) -> "MachOFile":
        return cls(Path(path).read_bytes())

    def _read_header(self) -> MachHeader:
        if len(self.data) < MACH_HEADER_64_SIZE:
            raise FormatError(f"file is {len(self.data)} bytes, shorter than the 32-byte mach_header_64")
        magic = struct.unpack_from("<I", self.data, 0)[0]
        if magic == FAT_MAGIC or magic == 0xBEBAFECA:
            raise FormatError("universal (fat) Mach-O: extract one slice first")
        if magic == MH_MAGIC_32:
            raise FormatError("32-bit Mach-O: this reader handles MH_MAGIC_64 only")
        if magic == MH_CIGAM_64:
            raise FormatError("big-endian Mach-O: this reader handles little-endian files only")
        if magic != MH_MAGIC_64:
            raise FormatError(f"magic is {_hex(magic)}, expected {_hex(MH_MAGIC_64)}")
        return MachHeader(*struct.unpack_from("<IIIIIIII", self.data, 0))

    def _read_load_commands(self) -> list[LoadCommand]:
        commands = []
        offset = MACH_HEADER_64_SIZE
        end = MACH_HEADER_64_SIZE + self.header.sizeofcmds
        if end > len(self.data):
            raise FormatError(f"load commands end at {_hex(end)}, past the {len(self.data)}-byte file")
        for index in range(self.header.ncmds):
            if offset + 8 > end:
                raise FormatError(f"load command {index} starts past sizeofcmds")
            cmd, cmdsize = struct.unpack_from("<II", self.data, offset)
            if cmdsize < 8 or offset + cmdsize > end:
                raise FormatError(f"load command {index} has cmdsize {cmdsize}")
            commands.append(LoadCommand(index, cmd, cmdsize, offset))
            offset += cmdsize
        return commands

    def _read_segments(self) -> list[Segment]:
        segments = []
        section_index = 1
        for command in self.load_commands:
            if command.cmd != LC_SEGMENT_64:
                continue
            fields = struct.unpack_from("<16sQQQQiiII", self.data, command.offset + 8)
            sections = []
            cursor = command.offset + 72
            for _ in range(fields[7]):
                row = struct.unpack_from("<16s16sQQIIIIIIII", self.data, cursor)
                sections.append(MachSection(section_index, fixed_name(row[0]), fixed_name(row[1]), *row[2:9]))
                section_index += 1
                cursor += 80
            segments.append(Segment(fixed_name(fields[0]), *fields[1:9], tuple(sections)))
        return segments

    def _read_symtab_command(self) -> SymtabCommand | None:
        for command in self.load_commands:
            if command.cmd == LC_SYMTAB:
                return SymtabCommand(*struct.unpack_from("<IIII", self.data, command.offset + 8))
        return None

    def _read_build_version(self) -> BuildVersion | None:
        for command in self.load_commands:
            if command.cmd == LC_BUILD_VERSION:
                platform, minos, sdk = struct.unpack_from("<III", self.data, command.offset + 8)
                return BuildVersion(platform, version_text(minos), version_text(sdk))
        return None

    def section_name_for_ordinal(self, n_sect: int) -> str:
        if n_sect == 0 or n_sect > len(self.sections):
            return "*UND*"
        return self.sections[n_sect - 1].qualified_name

    def _read_symbols(self) -> list[Nlist]:
        cmd = self.symtab_command
        if cmd is None:
            return []
        strtab = self.data[cmd.stroff : cmd.stroff + cmd.strsize]
        symbols = []
        for index in range(cmd.nsyms):
            n_strx, n_type, n_sect, n_desc, n_value = struct.unpack_from("<IBBHQ", self.data, cmd.symoff + index * 16)
            name = read_cstring(strtab, n_strx) if n_strx else ""
            symbols.append(Nlist(index, name, n_strx, n_type, n_sect, n_desc, n_value, self.section_name_for_ordinal(n_sect)))
        return symbols

    def _read_relocations(self) -> list[MachRelocation]:
        out = []
        for section in self.sections:
            for i in range(section.nreloc):
                r_address, bits = struct.unpack_from("<iI", self.data, section.reloff + i * 8)
                symnum = bits & 0xFFFFFF
                pcrel = bool(bits >> 24 & 1)
                length = bits >> 25 & 3
                extern = bool(bits >> 27 & 1)
                r_type = bits >> 28 & 0xF
                if extern:
                    symbol = self.symbols[symnum].name if symnum < len(self.symbols) else _hex(symnum)
                else:
                    symbol = self.sections[symnum - 1].sectname if 0 < symnum <= len(self.sections) else _hex(symnum)
                out.append(MachRelocation(section.qualified_name, r_address, symnum, pcrel, length, extern, r_type,
                                          ARM64_RELOC.get(r_type, f"R_{r_type}"), symbol))
        return out

    def symbol(self, name: str) -> Nlist:
        for symbol in self.symbols:
            if symbol.name == name:
                return symbol
        raise KeyError(f"no symbol named {name!r}")

    def function_span(self, name: str) -> Span:
        """nlist_64 has no size field, so the span ends at the next symbol in the same section."""
        symbol = self.symbol(name)
        if symbol.n_type & N_TYPE != N_SECT:
            raise KeyError(f"{name!r} is {symbol.type_name}, not defined in a section")
        section = self.sections[symbol.n_sect - 1]
        later = [s.n_value for s in self.symbols if s.n_sect == symbol.n_sect and s.n_value > symbol.n_value]
        end = min(later) if later else section.addr + section.size
        file_offset = section.offset + (symbol.n_value - section.addr)
        return Span(file_offset, end - symbol.n_value, section.qualified_name)

    def function_bytes(self, name: str) -> bytes:
        span = self.function_span(name)
        return self.data[span.file_offset : span.file_offset + span.size]


def render_elf(elf: ElfFile) -> str:
    h = elf.header
    lines = [
        f"ELF header: {h.type_name} {h.machine_name} osabi={OSABI.get(h.osabi, h.osabi)} entry={_hex(h.e_entry)}",
        f"  program headers: {h.e_phnum} x {h.e_phentsize} bytes at {_hex(h.e_phoff)}",
        f"  section headers: {h.e_shnum} x {h.e_shentsize} bytes at {_hex(h.e_shoff)}, names in section {h.e_shstrndx}",
        "",
        "Sections:",
        f"{'Idx':>3} {'Name':<16} {'Type':<12} {'Flags':<5} {'Offset':>8} {'Size':>8} {'Addr':>10} {'Link':>4} {'Info':>4} {'Align':>5}",
    ]
    for s in elf.sections:
        lines.append(
            f"{s.index:>3} {s.name:<16} {s.type_name:<12} {s.flags_text:<5} {_hex(s.sh_offset):>8} {_hex(s.sh_size):>8} "
            f"{_hex(s.sh_addr):>10} {s.sh_link:>4} {s.sh_info:>4} {s.sh_addralign:>5}"
        )
    if elf.program_headers:
        lines += ["", "Program headers:"]
        for p in elf.program_headers:
            lines.append(
                f"  {p.type_name:<16} {p.flags_text} offset={_hex(p.p_offset)} vaddr={_hex(p.p_vaddr)} "
                f"filesz={_hex(p.p_filesz)} memsz={_hex(p.p_memsz)} align={_hex(p.p_align)}"
            )
    lines += ["", "Symbols:", f"{'Idx':>3} {'Value':>16} {'Size':>6} {'Bind':<6} {'Type':<7} {'Section':<16} Name"]
    for sym in elf.symbols:
        lines.append(
            f"{sym.index:>3} {_hex(sym.st_value):>16} {sym.st_size:>6} {sym.bind:<6} {sym.type:<7} {sym.section_name:<16} {sym.display_name}"
        )
    if elf.relocations:
        lines += ["", "Relocations:"]
        for r in elf.relocations:
            lines.append(f"  {r.table:<14} {_hex(r.r_offset):>6} {r.type_name:<22} {r.value_text}")
    lines += ["", "File offset map:"]
    for region in elf.file_offset_map():
        lines.append(f"  {_hex(region.offset):>6} +{region.size:<5} {region.kind:<8} {region.name}")
    return "\n".join(lines)


def render_macho(macho: MachOFile) -> str:
    h = macho.header
    lines = [
        f"mach_header_64: {h.cputype_name} {h.filetype_name} ncmds={h.ncmds} sizeofcmds={h.sizeofcmds} flags={h.flags_text}",
        "",
        "Load commands:",
    ]
    for command in macho.load_commands:
        lines.append(f"  {command.index} {command.name:<28} cmdsize={command.cmdsize} at {_hex(command.offset)}")
    for segment in macho.segments:
        lines += [
            "",
            f"LC_SEGMENT_64 {segment.segname!r}: vmaddr={_hex(segment.vmaddr)} vmsize={_hex(segment.vmsize)} "
            f"fileoff={segment.fileoff} filesize={segment.filesize} nsects={segment.nsects}",
            f"  {'Idx':>3} {'Section':<24} {'Addr':>6} {'Size':>6} {'Offset':>6} {'Reloff':>6} {'Nreloc':>6} Type",
        ]
        for s in segment.sections:
            lines.append(
                f"  {s.index:>3} {s.qualified_name:<24} {_hex(s.addr):>6} {_hex(s.size):>6} {s.offset:>6} {s.reloff:>6} {s.nreloc:>6} {s.type_name}"
            )
    if macho.build_version:
        b = macho.build_version
        lines += ["", f"LC_BUILD_VERSION: platform={b.platform_name} minos={b.minos} sdk={b.sdk}"]
    if macho.symtab_command:
        c = macho.symtab_command
        lines += ["", f"LC_SYMTAB: symoff={c.symoff} nsyms={c.nsyms} stroff={c.stroff} strsize={c.strsize}",
                  f"  {'Idx':>3} {'Value':>6} {'Ext':<3} {'Type':<6} {'Section':<24} Name"]
        for sym in macho.symbols:
            lines.append(
                f"  {sym.index:>3} {_hex(sym.n_value):>6} {'ext' if sym.external else 'loc':<3} {sym.type_name:<6} {sym.section_name:<24} {sym.name}"
            )
    if macho.relocations:
        lines += ["", "Relocations:"]
        for r in macho.relocations:
            lines.append(f"  {r.section:<18} {_hex(r.r_address):>6} {r.type_name:<28} pcrel={int(r.r_pcrel)} len={r.r_length} {r.symbol}")
    return "\n".join(lines)


def compare_formats(elf: ElfFile, macho: MachOFile, function: str = "percent_change") -> list[tuple[str, str, str]]:
    """The same ideas, named by the two formats, with the values from the two files."""
    text = elf.section(".text")
    symtab = next(s for s in elf.sections if s.sh_type == SHT_SYMTAB)
    strtab = elf.sections[symtab.sh_link]
    rela_text = elf.relocations_for(".text")
    mtext = next(s for s in macho.sections if s.sectname == "__text")
    mcmd = macho.symtab_command
    espan = elf.function_span(function)
    mspan = macho.function_span("_" + function)
    segment = macho.segments[0]
    return [
        ("file identity", f"e_ident {ELF_MAGIC!r} class 64 data LSB", f"magic {_hex(macho.header.magic)} (MH_MAGIC_64)"),
        ("machine", f"e_machine {elf.header.e_machine} ({elf.header.machine_name})", f"cputype {_hex(macho.header.cputype)} ({macho.header.cputype_name})"),
        ("file kind", f"e_type {elf.header.e_type} ({elf.header.type_name})", f"filetype {macho.header.filetype} ({macho.header.filetype_name})"),
        ("where the tables are", f"e_shoff {_hex(elf.header.e_shoff)}, {elf.header.e_shnum} section headers", f"{macho.header.ncmds} load commands, {macho.header.sizeofcmds} bytes after the header"),
        ("the code", f"section .text: offset {_hex(text.sh_offset)}, size {_hex(text.sh_size)}, flags {text.flags_text}", f"section {mtext.qualified_name}: offset {mtext.offset}, size {_hex(mtext.size)}, in segment {segment.segname!r}"),
        ("symbol names", f".symtab (section {symtab.index}) with names in {strtab.name} (sh_link {symtab.sh_link})", f"LC_SYMTAB symoff {mcmd.symoff} nsyms {mcmd.nsyms}, names at stroff {mcmd.stroff}"),
        ("symbol size", f"st_size: {function} = {espan.size} bytes", f"no size field in nlist_64: next symbol minus this one = {mspan.size} bytes"),
        ("relocations", f".rela.text: {len(rela_text)} Elf64_Rela, types {sorted({r.type_name for r in rela_text})}", f"__text reloff {mtext.reloff} nreloc {mtext.nreloc}, types {sorted({r.type_name for r in macho.relocations if r.section == mtext.qualified_name})}"),
        ("function bytes", f"{function}: {espan.size} bytes at file offset {_hex(espan.file_offset)}", f"_{function}: {mspan.size} bytes at file offset {_hex(mspan.file_offset)}"),
    ]


def render_comparison(rows: list[tuple[str, str, str]]) -> str:
    width = max(len(row[0]) for row in rows)
    lines = []
    for concept, elf_text, macho_text in rows:
        lines.append(f"{concept:<{width}}  ELF    {elf_text}")
        lines.append(f"{'':<{width}}  Mach-O {macho_text}")
    return "\n".join(lines)


def open_file(path: str | Path) -> ElfFile | MachOFile:
    data = Path(path).read_bytes()
    if data[:4] == ELF_MAGIC:
        return ElfFile(data)
    if len(data) >= 4 and struct.unpack_from("<I", data, 0)[0] in (MH_MAGIC_64, MH_CIGAM_64, MH_MAGIC_32, FAT_MAGIC):
        return MachOFile(data)
    raise FormatError(f"{path}: not an ELF or Mach-O file (first bytes {data[:4].hex()})")


def demo() -> str:
    elf = ElfFile.from_path(FIXTURES / "ledger-x86_64-O1.o")
    macho = MachOFile.from_path(FIXTURES / "ledger-arm64-O1.o")
    tiny = ElfFile.from_path(FIXTURES / "tiny-x86_64")
    out = ["== ledger-x86_64-O1.o ==", render_elf(elf), ""]
    for name in ("percent_change", "grade", "total", "grade_label"):
        span = elf.function_span(name)
        out.append(f"{name}: {span.size} bytes at file offset {_hex(span.file_offset)}: {elf.function_bytes(name).hex(' ')}")
    out += ["", "== ledger-arm64-O1.o ==", render_macho(macho), ""]
    out += ["== the same ideas in two formats ==", render_comparison(compare_formats(elf, macho)), ""]
    out += ["== tiny-x86_64 (an executable with program headers) ==", render_elf(tiny), ""]
    entry = tiny.header.e_entry
    out.append(f"entry {_hex(entry)} is file offset {_hex(tiny.address_to_file_offset(entry))} through PT_LOAD")
    return "\n".join(out)


def main(argv: list[str]) -> int:
    if not argv:
        print(demo())
        return 0
    for arg in argv:
        parsed = open_file(arg)
        print(f"== {arg} ==")
        print(render_elf(parsed) if isinstance(parsed, ElfFile) else render_macho(parsed))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
