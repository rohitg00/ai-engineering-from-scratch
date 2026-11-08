"""Companion code for docs/en.md: read what the link editor made and what the loader will do.
ELF: gABI chapter 5 (dynamic section, program headers), x86-64 psABI section 5.2 (GOT, PLT, lazy binding) and Table 4.9.
PE/COFF: Microsoft PE Format (file header, section table, 18-byte symbols, 10-byte relocations, import and export directories, base relocations).
Mach-O: loader.h, nlist.h and fixup-chains.h (load commands, stubs, indirect symbols, chained fixups, exports trie, two-level namespace).
Function identification: LC_FUNCTION_STARTS, prologue patterns, call targets, and a FLIRT-shaped signature with wildcarded relocation bytes.
Run `python3 main.py` for the finite demo or `python3 tests/test_main.py` for the suite.
"""

from __future__ import annotations

import json
import struct
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"


class FormatError(ValueError):
    pass


def _cstring(table: bytes, offset: int) -> str:
    end = table.find(b"\0", offset)
    return table[offset : end if end >= 0 else len(table)].decode("utf-8", "replace")


def _hex(value: int) -> str:
    return f"0x{value:x}"


def read_uleb128(data: bytes, offset: int) -> tuple[int, int]:
    value = 0
    shift = 0
    while True:
        byte = data[offset]
        offset += 1
        value |= (byte & 0x7F) << shift
        shift += 7
        if not byte & 0x80:
            return value, offset


def crc16(data: bytes) -> int:
    """The CRC-16 that the public .pat parsers use: polynomial 0x8408 (reflected 0x1021), initial 0xFFFF, final complement and byte swap."""
    if not data:
        return 0
    crc = 0xFFFF
    for byte in data:
        for _ in range(8):
            if (crc ^ byte) & 1:
                crc = (crc >> 1) ^ 0x8408
            else:
                crc >>= 1
            byte >>= 1
    crc = ~crc & 0xFFFF
    return ((crc << 8) | (crc >> 8)) & 0xFFFF


def _hexbytes(data: bytes) -> str:
    return " ".join(f"{byte:02x}" for byte in data)


def _signed(value: int, bits: int) -> int:
    return value - (1 << bits) if value & (1 << (bits - 1)) else value


SHT_SYMTAB, SHT_STRTAB, SHT_RELA, SHT_NOBITS, SHT_DYNSYM = 2, 3, 4, 8, 11
STT_SECTION, STT_FUNC = 3, 2
SHN_UNDEF = 0
PT_DYNAMIC, PT_INTERP = 2, 3
ET_REL, ET_EXEC, ET_DYN = 1, 2, 3

ELF_RELOCATION_NAMES = {
    0: "R_X86_64_NONE", 1: "R_X86_64_64", 2: "R_X86_64_PC32", 3: "R_X86_64_GOT32", 4: "R_X86_64_PLT32", 5: "R_X86_64_COPY",
    6: "R_X86_64_GLOB_DAT", 7: "R_X86_64_JUMP_SLOT", 8: "R_X86_64_RELATIVE", 9: "R_X86_64_GOTPCREL", 10: "R_X86_64_32",
    11: "R_X86_64_32S", 24: "R_X86_64_PC64", 26: "R_X86_64_GOTPC32", 37: "R_X86_64_IRELATIVE", 41: "R_X86_64_GOTPCRELX",
    42: "R_X86_64_REX_GOTPCRELX",
}
ELF_RELOCATION_FORMULAS = {
    1: "S + A", 2: "S + A - P", 3: "G + A", 4: "L + A - P", 6: "S", 7: "S", 8: "B + A", 9: "G + GOT + A - P", 10: "S + A",
    11: "S + A", 24: "S + A - P", 26: "GOT + A - P", 37: "indirect (B + A)", 41: "G + GOT + A - P", 42: "G + GOT + A - P",
}
DYNAMIC_TAG_NAMES = {
    0: "DT_NULL", 1: "DT_NEEDED", 2: "DT_PLTRELSZ", 3: "DT_PLTGOT", 4: "DT_HASH", 5: "DT_STRTAB", 6: "DT_SYMTAB", 7: "DT_RELA",
    8: "DT_RELASZ", 9: "DT_RELAENT", 10: "DT_STRSZ", 11: "DT_SYMENT", 12: "DT_INIT", 13: "DT_FINI", 14: "DT_SONAME",
    15: "DT_RPATH", 16: "DT_SYMBOLIC", 17: "DT_REL", 18: "DT_RELSZ", 19: "DT_RELENT", 20: "DT_PLTREL", 21: "DT_DEBUG",
    22: "DT_TEXTREL", 23: "DT_JMPREL", 24: "DT_BIND_NOW", 25: "DT_INIT_ARRAY", 26: "DT_FINI_ARRAY", 27: "DT_INIT_ARRAYSZ",
    28: "DT_FINI_ARRAYSZ", 29: "DT_RUNPATH", 30: "DT_FLAGS", 32: "DT_PREINIT_ARRAY", 33: "DT_PREINIT_ARRAYSZ", 36: "DT_RELR",
    0x6FFFFEF5: "DT_GNU_HASH", 0x6FFFFFF0: "DT_VERSYM", 0x6FFFFFF9: "DT_RELACOUNT", 0x6FFFFFFB: "DT_FLAGS_1",
    0x6FFFFFFC: "DT_VERDEF", 0x6FFFFFFD: "DT_VERDEFNUM", 0x6FFFFFFE: "DT_VERNEED", 0x6FFFFFFF: "DT_VERNEEDNUM",
}
DT_NEEDED, DT_PLTRELSZ, DT_PLTGOT, DT_STRTAB, DT_SYMTAB, DT_STRSZ, DT_PLTREL, DT_JMPREL, DT_FLAGS_1 = 1, 2, 3, 5, 6, 10, 20, 23, 0x6FFFFFFB
DF_1_NOW, DF_1_PIE = 0x1, 0x08000000
PF_NAMES = [(4, "r"), (2, "w"), (1, "x")]
PT_NAMES = {1: "PT_LOAD", 2: "PT_DYNAMIC", 3: "PT_INTERP", 4: "PT_NOTE", 6: "PT_PHDR", 0x6474E550: "PT_GNU_EH_FRAME", 0x6474E551: "PT_GNU_STACK", 0x6474E552: "PT_GNU_RELRO"}


@dataclass(frozen=True)
class ElfSection:
    index: int
    name: str
    type: int
    flags: int
    addr: int
    offset: int
    size: int
    link: int
    info: int
    entsize: int
    data: bytes


@dataclass(frozen=True)
class ElfSymbol:
    name: str
    value: int
    size: int
    type: int
    bind: int
    shndx: int
    section: str

    @property
    def defined(self) -> bool:
        return self.shndx != SHN_UNDEF


@dataclass(frozen=True)
class ElfRelocation:
    section: str
    offset: int
    type: int
    symbol: ElfSymbol
    addend: int

    @property
    def type_name(self) -> str:
        return ELF_RELOCATION_NAMES.get(self.type, f"R_X86_64_{self.type}")

    @property
    def symbol_name(self) -> str:
        return self.symbol.section if self.symbol.type == STT_SECTION else self.symbol.name

    def describe(self) -> str:
        if self.addend == 0:
            return f"{self.type_name} {self.symbol_name}"
        sign = "+" if self.addend > 0 else "-"
        return f"{self.type_name} {self.symbol_name}{sign}0x{abs(self.addend):x}"


@dataclass(frozen=True)
class ProgramHeader:
    type: int
    flags: int
    offset: int
    vaddr: int
    filesz: int
    memsz: int
    align: int

    @property
    def type_name(self) -> str:
        return PT_NAMES.get(self.type, _hex(self.type))

    @property
    def flags_text(self) -> str:
        return "".join(letter if self.flags & bit else "-" for bit, letter in PF_NAMES)


@dataclass(frozen=True)
class DynamicEntry:
    tag: int
    value: int
    text: str

    @property
    def tag_name(self) -> str:
        return DYNAMIC_TAG_NAMES.get(self.tag, _hex(self.tag))


@dataclass(frozen=True)
class PltEntry:
    """One 16-byte entry of Figure 5.2: jmp *slot(%rip); pushq $index; jmp .PLT0."""

    index: int
    address: int
    raw: bytes
    slot: int
    push_index: int
    plt0: int
    slot_initial: int
    symbol: str

    def lines(self) -> list[str]:
        return [
            f"jmpq *{_hex(self.slot - (self.address + 6))}(%rip)   -> GOT slot {_hex(self.slot)}",
            f"pushq ${_hex(self.push_index)}   (index into DT_JMPREL)",
            f"jmp {_hex(self.plt0)} <.plt>   (PLT0, into the dynamic linker)",
        ]


class ElfFile:
    """ELF64 little-endian reader for relocatable objects and for linked images with a dynamic section."""

    def __init__(self, data: bytes) -> None:
        if data[:4] != b"\x7fELF":
            raise FormatError("not an ELF file")
        if data[4] != 2 or data[5] != 1:
            raise FormatError("only ELF64 little-endian files are supported")
        self.data = data
        header = struct.unpack_from("<16sHHIQQQIHHHHHH", data, 0)
        self.type = header[1]
        self.machine = header[2]
        self.entry = header[4]
        phoff, shoff = header[5], header[6]
        phentsize, phnum, shentsize, shnum, shstrndx = header[9], header[10], header[11], header[12], header[13]
        self.program_headers: list[ProgramHeader] = []
        for index in range(phnum):
            p_type, p_flags, p_offset, p_vaddr, _paddr, p_filesz, p_memsz, p_align = struct.unpack_from("<IIQQQQQQ", data, phoff + index * phentsize)
            self.program_headers.append(ProgramHeader(p_type, p_flags, p_offset, p_vaddr, p_filesz, p_memsz, p_align))
        raw_headers = [struct.unpack_from("<IIQQQQIIQQ", data, shoff + index * shentsize) for index in range(shnum)]
        names = raw_headers[shstrndx] if shnum else None
        name_table = data[names[4] : names[4] + names[5]] if names else b""
        self.sections: list[ElfSection] = []
        for index, raw in enumerate(raw_headers):
            sh_name, sh_type, sh_flags, sh_addr, sh_offset, sh_size, sh_link, sh_info, _align, sh_entsize = raw
            payload = b"" if sh_type == SHT_NOBITS else data[sh_offset : sh_offset + sh_size]
            self.sections.append(ElfSection(index, _cstring(name_table, sh_name), sh_type, sh_flags, sh_addr, sh_offset, sh_size, sh_link, sh_info, sh_entsize, payload))
        self.symbol_tables: dict[int, list[ElfSymbol]] = {s.index: self._read_symbols(s) for s in self.sections if s.type in (SHT_SYMTAB, SHT_DYNSYM)}
        self.relocations = self._read_relocations()

    @property
    def type_name(self) -> str:
        return {ET_REL: "ET_REL", ET_EXEC: "ET_EXEC", ET_DYN: "ET_DYN"}.get(self.type, _hex(self.type))

    def _read_symbols(self, section: ElfSection) -> list[ElfSymbol]:
        strings = self.sections[section.link].data
        symbols: list[ElfSymbol] = []
        for offset in range(0, section.size, 24):
            st_name, st_info, _other, st_shndx, st_value, st_size = struct.unpack_from("<IBBHQQ", section.data, offset)
            section_name = self.sections[st_shndx].name if st_shndx < len(self.sections) else ""
            symbols.append(ElfSymbol(_cstring(strings, st_name), st_value, st_size, st_info & 0xF, st_info >> 4, st_shndx, section_name))
        return symbols

    def _read_relocations(self) -> dict[str, list[ElfRelocation]]:
        table: dict[str, list[ElfRelocation]] = {}
        for section in self.sections:
            if section.type != SHT_RELA:
                continue
            target = self.sections[section.info].name if section.info < len(self.sections) else section.name
            symbols = self.symbol_tables.get(section.link, [])
            for offset in range(0, section.size, 24):
                r_offset, r_info, r_addend = struct.unpack_from("<QQq", section.data, offset)
                symbol = symbols[r_info >> 32]
                table.setdefault(section.name if self.type != ET_REL else target, []).append(ElfRelocation(target, r_offset, r_info & 0xFFFFFFFF, symbol, r_addend))
        return table

    @property
    def symbols(self) -> list[ElfSymbol]:
        for section in self.sections:
            if section.type == SHT_SYMTAB:
                return self.symbol_tables[section.index]
        return []

    @property
    def dynamic_symbols(self) -> list[ElfSymbol]:
        for section in self.sections:
            if section.type == SHT_DYNSYM:
                return self.symbol_tables[section.index]
        return []

    def section(self, name: str) -> ElfSection:
        for section in self.sections:
            if section.name == name:
                return section
        raise FormatError(f"no section named {name}")

    def vaddr_to_offset(self, address: int) -> int:
        for header in self.program_headers:
            if header.type == 1 and header.vaddr <= address < header.vaddr + header.filesz:
                return address - header.vaddr + header.offset
        raise FormatError(f"address {_hex(address)} is in no PT_LOAD segment")

    def read(self, address: int, size: int) -> bytes:
        offset = self.vaddr_to_offset(address)
        return self.data[offset : offset + size]

    def dynamic_entries(self) -> list[DynamicEntry]:
        """Elf64_Dyn pairs from PT_DYNAMIC (gABI Figure 5-10), with DT_NEEDED resolved through DT_STRTAB."""
        header = next((h for h in self.program_headers if h.type == PT_DYNAMIC), None)
        if header is None:
            return []
        raw: list[tuple[int, int]] = []
        for offset in range(header.offset, header.offset + header.filesz, 16):
            tag, value = struct.unpack_from("<qQ", self.data, offset)
            raw.append((tag, value))
            if tag == 0:
                break
        strtab = next((v for t, v in raw if t == DT_STRTAB), None)
        entries: list[DynamicEntry] = []
        for tag, value in raw:
            text = _hex(value)
            if tag == DT_NEEDED and strtab is not None:
                text = _cstring(self.data, self.vaddr_to_offset(strtab) + value)
            elif tag == DT_PLTREL:
                text = {7: "RELA", 17: "REL"}.get(value, _hex(value))
            elif tag == DT_FLAGS_1:
                names = [n for bit, n in ((DF_1_NOW, "DF_1_NOW"), (DF_1_PIE, "DF_1_PIE")) if value & bit]
                text = " ".join(names) or _hex(value)
            entries.append(DynamicEntry(tag, value, text))
        return entries

    def dynamic(self, tag: int) -> int | None:
        for entry in self.dynamic_entries():
            if entry.tag == tag:
                return entry.value
        return None

    def jump_slots(self) -> list[ElfRelocation]:
        """The relocations DT_JMPREL points at: one R_X86_64_JUMP_SLOT per PLT entry."""
        jmprel, size = self.dynamic(DT_JMPREL), self.dynamic(DT_PLTRELSZ)
        if jmprel is None or size is None:
            return []
        symbols = self.dynamic_symbols
        slots: list[ElfRelocation] = []
        base = self.vaddr_to_offset(jmprel)
        for offset in range(base, base + size, 24):
            r_offset, r_info, r_addend = struct.unpack_from("<QQq", self.data, offset)
            slots.append(ElfRelocation(".got.plt", r_offset, r_info & 0xFFFFFFFF, symbols[r_info >> 32], r_addend))
        return slots

    def plt_entries(self) -> list[PltEntry]:
        """Decode .plt with the psABI Figure 5.2 layout. PLT0 is 16 bytes, every entry after it is 16 bytes."""
        plt = self.section(".plt")
        slots = {r.offset: r.symbol_name for r in self.jump_slots()}
        entries: list[PltEntry] = []
        for index in range((plt.size // 16) - 1):
            address = plt.addr + 16 * (index + 1)
            raw = plt.data[16 * (index + 1) : 16 * (index + 2)]
            if raw[:2] != b"\xff\x25" or raw[6] != 0x68 or raw[11] != 0xE9:
                raise FormatError(f"PLT entry at {_hex(address)} does not match Figure 5.2")
            slot = address + 6 + struct.unpack_from("<i", raw, 2)[0]
            push_index = struct.unpack_from("<I", raw, 7)[0]
            plt0 = address + 16 + struct.unpack_from("<i", raw, 12)[0]
            initial = struct.unpack("<Q", self.read(slot, 8))[0]
            entries.append(PltEntry(index, address, raw, slot, push_index, plt0, initial, slots.get(slot, "?")))
        return entries

    def plt0(self) -> dict[str, Any]:
        plt = self.section(".plt")
        raw = plt.data[:16]
        if raw[:2] != b"\xff\x35" or raw[6:8] != b"\xff\x25":
            raise FormatError("PLT0 does not match Figure 5.2")
        got8 = plt.addr + 6 + struct.unpack_from("<i", raw, 2)[0]
        got16 = plt.addr + 12 + struct.unpack_from("<i", raw, 8)[0]
        return {"address": plt.addr, "bytes": _hexbytes(raw), "pushes": got8, "jumpsThrough": got16, "lines": [f"pushq {_hex(got8)}(%rip)   (GOT[1], the link_map)", f"jmpq *{_hex(got16)}(%rip)   (GOT[2], the resolver)", "nopl (%rax)"]}

    def got_plt_words(self) -> list[int]:
        got = self.section(".got.plt")
        return list(struct.unpack_from(f"<{got.size // 8}Q", got.data, 0))

    def functions(self, section: str = ".text") -> list[ElfSymbol]:
        return sorted((s for s in self.symbols if s.type == STT_FUNC and s.section == section), key=lambda s: s.value)


def load_elf(name: str) -> ElfFile:
    return ElfFile((FIXTURES / name).read_bytes())


@dataclass(frozen=True)
class LinkDecision:
    object: str
    relocation: ElfRelocation
    kind: str
    outcome: str

    def to_dict(self) -> dict[str, Any]:
        return {"object": self.object, "section": self.relocation.section, "offset": _hex(self.relocation.offset), "relocation": self.relocation.describe(), "kind": self.kind, "outcome": self.outcome}


def plan_dynamic_link(objects: dict[str, ElfFile]) -> dict[str, Any]:
    """What a PIE link of these objects creates, from psABI Table 4.9 and section 5.2. Nothing here is executed:
    the link editor is not on this machine, so this is the spec applied to our own relocation records."""
    defined: set[str] = set()
    for elf in objects.values():
        defined.update(s.name for s in elf.symbols if s.defined and s.name and s.type != STT_SECTION)
    decisions: list[LinkDecision] = []
    plt_symbols: list[str] = []
    for object_name, elf in objects.items():
        for target, relocations in elf.relocations.items():
            for relocation in relocations:
                name = relocation.symbol_name
                is_defined = relocation.symbol.defined or name in defined
                if relocation.type == 4:
                    if is_defined:
                        kind, outcome = "direct", "the link editor writes S + A - P into the call: no PLT entry (the PLT32 to PC32 reduction)"
                    else:
                        kind, outcome = "plt", "a 16-byte PLT entry, an 8-byte .got.plt slot, and one R_X86_64_JUMP_SLOT in .rela.plt"
                        if name not in plt_symbols:
                            plt_symbols.append(name)
                elif relocation.type == 2:
                    kind, outcome = ("in-place", "the link editor writes S + A - P: the distance is fixed inside the image") if is_defined else ("error", "a PC32 against an undefined symbol cannot be used in a PIE")
                elif relocation.type == 1:
                    kind, outcome = ("relative", "an 8-byte field that needs the load base: one R_X86_64_RELATIVE (B + A) in .rela.dyn") if is_defined else ("dynamic-64", "one R_X86_64_64 dynamic relocation against the symbol in .rela.dyn")
                elif relocation.type in (41, 42, 9):
                    kind, outcome = ("got", "an 8-byte .got slot and one R_X86_64_GLOB_DAT; relaxed to a direct lea or call when the symbol is local (psABI Appendix B)")
                elif relocation.type in (10, 11):
                    kind, outcome = ("error", "a 32-bit absolute field cannot hold a PIE address")
                else:
                    kind, outcome = ("other", ELF_RELOCATION_FORMULAS.get(relocation.type, "see Table 4.9"))
                decisions.append(LinkDecision(object_name, relocation, kind, outcome))
    counts: dict[str, int] = {}
    for decision in decisions:
        counts[decision.kind] = counts.get(decision.kind, 0) + 1
    n = len(plt_symbols)
    relatives = counts.get("relative", 0)
    return {
        "objects": list(objects),
        "decisions": [d.to_dict() for d in decisions],
        "counts": counts,
        "pltSymbols": plt_symbols,
        "sizes": {".plt": 16 * (n + 1), ".got.plt": 8 * (n + 3), ".rela.plt": 24 * n, ".rela.dyn": 24 * relatives},
        "dynamicTags": ["DT_NEEDED", "DT_STRTAB", "DT_SYMTAB", "DT_STRSZ", "DT_SYMENT", "DT_PLTGOT", "DT_PLTRELSZ", "DT_PLTREL", "DT_JMPREL"] + (["DT_RELA", "DT_RELASZ", "DT_RELAENT", "DT_RELACOUNT"] if relatives else []) + ["DT_FLAGS_1"],
        "jumpSlots": [f"R_X86_64_JUMP_SLOT {name}" for name in plt_symbols],
    }


IMAGE_FILE_MACHINE_NAMES = {0x8664: "IMAGE_FILE_MACHINE_AMD64", 0xAA64: "IMAGE_FILE_MACHINE_ARM64", 0x14C: "IMAGE_FILE_MACHINE_I386"}
COFF_RELOCATION_NAMES = {
    0: "IMAGE_REL_AMD64_ABSOLUTE", 1: "IMAGE_REL_AMD64_ADDR64", 2: "IMAGE_REL_AMD64_ADDR32", 3: "IMAGE_REL_AMD64_ADDR32NB",
    4: "IMAGE_REL_AMD64_REL32", 5: "IMAGE_REL_AMD64_REL32_1", 6: "IMAGE_REL_AMD64_REL32_2", 7: "IMAGE_REL_AMD64_REL32_3",
    8: "IMAGE_REL_AMD64_REL32_4", 9: "IMAGE_REL_AMD64_REL32_5", 10: "IMAGE_REL_AMD64_SECTION", 11: "IMAGE_REL_AMD64_SECREL",
}
IMAGE_SCN_FLAGS = [
    (0x00000020, "CNT_CODE"), (0x00000040, "CNT_INITIALIZED_DATA"), (0x00000080, "CNT_UNINITIALIZED_DATA"), (0x00000800, "LNK_REMOVE"),
    (0x00001000, "LNK_COMDAT"), (0x02000000, "MEM_DISCARDABLE"), (0x20000000, "MEM_EXECUTE"), (0x40000000, "MEM_READ"), (0x80000000, "MEM_WRITE"),
]
DLL_CHARACTERISTICS = [
    (0x0020, "HIGH_ENTROPY_VA"), (0x0040, "DYNAMIC_BASE"), (0x0080, "FORCE_INTEGRITY"), (0x0100, "NX_COMPAT"), (0x0200, "NO_ISOLATION"),
    (0x0400, "NO_SEH"), (0x0800, "NO_BIND"), (0x1000, "APPCONTAINER"), (0x2000, "WDM_DRIVER"), (0x4000, "GUARD_CF"), (0x8000, "TERMINAL_SERVER_AWARE"),
]
DATA_DIRECTORY_NAMES = ["Export", "Import", "Resource", "Exception", "Certificate", "Base Relocation", "Debug", "Architecture", "Global Ptr", "TLS", "Load Config", "Bound Import", "IAT", "Delay Import", "CLR Runtime Header", "Reserved"]
BASE_RELOCATION_NAMES = {0: "IMAGE_REL_BASED_ABSOLUTE", 3: "IMAGE_REL_BASED_HIGHLOW", 10: "IMAGE_REL_BASED_DIR64"}


@dataclass(frozen=True)
class CoffSymbol:
    index: int
    name: str
    value: int
    section_number: int
    type: int
    storage_class: int
    aux: tuple[bytes, ...]


@dataclass(frozen=True)
class CoffRelocation:
    section: str
    offset: int
    symbol_index: int
    type: int
    symbol_name: str

    @property
    def type_name(self) -> str:
        return COFF_RELOCATION_NAMES.get(self.type, _hex(self.type))


@dataclass(frozen=True)
class CoffSection:
    number: int
    name: str
    virtual_size: int
    virtual_address: int
    raw_size: int
    raw_offset: int
    reloc_offset: int
    reloc_count: int
    characteristics: int
    data: bytes

    def flag_names(self) -> list[str]:
        return [name for bit, name in IMAGE_SCN_FLAGS if self.characteristics & bit]


class CoffObject:
    """A COFF relocatable object: 20-byte file header, 40-byte section table entries, 18-byte symbols, 10-byte relocations."""

    def __init__(self, data: bytes) -> None:
        self.data = data
        machine, nsections, timestamp, symtab, nsymbols, optional_size, characteristics = struct.unpack_from("<HHIIIHH", data, 0)
        if machine not in IMAGE_FILE_MACHINE_NAMES or optional_size != 0:
            raise FormatError("not a COFF object this reader knows")
        self.machine, self.timestamp, self.characteristics = machine, timestamp, characteristics
        self.symtab_offset, self.symbol_count = symtab, nsymbols
        strings_offset = symtab + 18 * nsymbols
        strings_size = struct.unpack_from("<I", data, strings_offset)[0] if symtab else 4
        self.string_table = data[strings_offset : strings_offset + strings_size]
        self.sections: list[CoffSection] = []
        for index in range(nsections):
            base = 20 + optional_size + 40 * index
            raw_name, vsize, vaddr, raw_size, raw_offset, reloc_offset, _lines, nrelocs, _nlines, flags = struct.unpack_from("<8sIIIIIIHHI", data, base)
            name = raw_name.rstrip(b"\0").decode("ascii", "replace")
            if name.startswith("/") and name[1:].isdigit():
                name = _cstring(self.string_table, int(name[1:]))
            payload = data[raw_offset : raw_offset + raw_size] if raw_offset else b""
            self.sections.append(CoffSection(index + 1, name, vsize, vaddr, raw_size, raw_offset, reloc_offset, nrelocs, flags, payload))
        self.symbols = self._read_symbols()
        self.relocations = self._read_relocations()

    @property
    def machine_name(self) -> str:
        return IMAGE_FILE_MACHINE_NAMES[self.machine]

    def _symbol_name(self, raw: bytes) -> str:
        if raw[:4] == b"\0\0\0\0":
            return _cstring(self.string_table, struct.unpack_from("<I", raw, 4)[0])
        return raw.rstrip(b"\0").decode("ascii", "replace")

    def _read_symbols(self) -> list[CoffSymbol]:
        symbols: list[CoffSymbol] = []
        index = 0
        while index < self.symbol_count:
            base = self.symtab_offset + 18 * index
            raw_name, value, section_number, sym_type, storage_class, aux_count = struct.unpack_from("<8sIhHBB", self.data, base)
            aux = tuple(self.data[base + 18 * (k + 1) : base + 18 * (k + 2)] for k in range(aux_count))
            symbols.append(CoffSymbol(index, self._symbol_name(raw_name), value, section_number, sym_type, storage_class, aux))
            index += 1 + aux_count
        return symbols

    def symbol_at(self, index: int) -> CoffSymbol:
        for symbol in self.symbols:
            if symbol.index == index:
                return symbol
        raise FormatError(f"no symbol at index {index}")

    def _read_relocations(self) -> dict[str, list[CoffRelocation]]:
        table: dict[str, list[CoffRelocation]] = {}
        for section in self.sections:
            if section.reloc_count == 0:
                continue
            key = section.name
            for k in range(section.reloc_count):
                offset, symbol_index, rel_type = struct.unpack_from("<IIH", self.data, section.reloc_offset + 10 * k)
                table.setdefault(key, []).append(CoffRelocation(key, offset, symbol_index, rel_type, self.symbol_at(symbol_index).name))
        return table

    def section_definitions(self) -> list[dict[str, Any]]:
        """The auxiliary record of a section symbol: length, relocation count, checksum, COMDAT selection."""
        rows: list[dict[str, Any]] = []
        for symbol in self.symbols:
            if symbol.storage_class == 3 and symbol.aux and symbol.section_number > 0:
                length, nreloc, nlines, checksum, number, selection = struct.unpack_from("<IHHIHB", symbol.aux[0], 0)
                rows.append({"section": symbol.name, "number": symbol.section_number, "length": length, "relocations": nreloc, "checksum": checksum, "comdat": selection})
        return rows

    def functions(self) -> list[CoffSymbol]:
        return [s for s in self.symbols if s.type == 0x20 and s.section_number > 0]

    def undefined(self) -> list[str]:
        return [s.name for s in self.symbols if s.section_number == 0 and s.storage_class == 2]


def load_coff(name: str) -> CoffObject:
    return CoffObject((FIXTURES / name).read_bytes())


@dataclass(frozen=True)
class PeSection:
    name: str
    virtual_size: int
    virtual_address: int
    raw_size: int
    raw_offset: int
    characteristics: int


@dataclass(frozen=True)
class ImportEntry:
    index: int
    slot_rva: int
    lookup: int
    by_ordinal: bool
    ordinal: int | None
    hint: int | None
    name: str | None


@dataclass(frozen=True)
class ImportDescriptor:
    rva: int
    lookup_rva: int
    timestamp: int
    forwarder: int
    name_rva: int
    iat_rva: int
    dll: str
    entries: tuple[ImportEntry, ...]


class PeImage:
    """A PE32+ image: MS-DOS stub, PE signature, COFF file header, optional header, data directories, sections, and the tables they point at."""

    def __init__(self, data: bytes) -> None:
        if data[:2] != b"MZ":
            raise FormatError("DOS header magic not found")
        self.data = data
        self.e_lfanew = struct.unpack_from("<I", data, 0x3C)[0]
        if data[self.e_lfanew : self.e_lfanew + 4] != b"PE\0\0":
            raise FormatError("PE signature not found")
        coff = self.e_lfanew + 4
        self.machine, self.section_count, self.timestamp, self.symtab_offset, self.symbol_count, self.optional_size, self.characteristics = struct.unpack_from("<HHIIIHH", data, coff)
        optional = coff + 20
        self.magic = struct.unpack_from("<H", data, optional)[0]
        if self.magic != 0x20B:
            raise FormatError("only PE32+ (magic 0x20b) is supported")
        fields = struct.unpack_from("<HBBIIIIIQIIHHHHHHIIIIHHQQQQII", data, optional)
        (_magic, self.linker_major, self.linker_minor, self.size_of_code, self.size_of_initialized_data, self.size_of_uninitialized_data,
         self.entry_point, self.base_of_code, self.image_base, self.section_alignment, self.file_alignment, _osmaj, _osmin, _imaj, _imin,
         self.subsystem_major, self.subsystem_minor, _win32, self.size_of_image, self.size_of_headers, self.checksum, self.subsystem,
         self.dll_characteristics, self.stack_reserve, self.stack_commit, self.heap_reserve, self.heap_commit, _loader_flags, self.directory_count) = fields
        directories = optional + 112
        self.data_directories: list[tuple[str, int, int]] = []
        for index in range(self.directory_count):
            rva, size = struct.unpack_from("<II", data, directories + 8 * index)
            self.data_directories.append((DATA_DIRECTORY_NAMES[index] if index < 16 else str(index), rva, size))
        table = optional + self.optional_size
        self.sections: list[PeSection] = []
        for index in range(self.section_count):
            raw_name, vsize, vaddr, raw_size, raw_offset, _r, _l, _nr, _nl, flags = struct.unpack_from("<8sIIIIIIHHI", data, table + 40 * index)
            self.sections.append(PeSection(raw_name.rstrip(b"\0").decode("ascii", "replace"), vsize, vaddr, raw_size, raw_offset, flags))

    def directory(self, name: str) -> tuple[int, int]:
        for entry_name, rva, size in self.data_directories:
            if entry_name == name:
                return rva, size
        raise FormatError(f"no data directory named {name}")

    def dll_characteristic_names(self) -> list[str]:
        return [name for bit, name in DLL_CHARACTERISTICS if self.dll_characteristics & bit]

    def rva_to_offset(self, rva: int) -> int:
        for section in self.sections:
            if section.virtual_address <= rva < section.virtual_address + max(section.virtual_size, section.raw_size):
                return rva - section.virtual_address + section.raw_offset
        raise FormatError(f"RVA {_hex(rva)} is in no section")

    def section_of(self, rva: int) -> PeSection:
        for section in self.sections:
            if section.virtual_address <= rva < section.virtual_address + max(section.virtual_size, section.raw_size):
                return section
        raise FormatError(f"RVA {_hex(rva)} is in no section")

    def read_rva(self, rva: int, size: int) -> bytes:
        offset = self.rva_to_offset(rva)
        return self.data[offset : offset + size]

    def string_at(self, rva: int) -> str:
        return _cstring(self.data, self.rva_to_offset(rva))

    def imports(self) -> list[ImportDescriptor]:
        """Import directory: 20-byte descriptors ended by a zero descriptor; 64-bit lookup entries; hint/name pairs."""
        rva, _size = self.directory("Import")
        descriptors: list[ImportDescriptor] = []
        while True:
            lookup_rva, timestamp, forwarder, name_rva, iat_rva = struct.unpack_from("<IIIII", self.data, self.rva_to_offset(rva))
            if lookup_rva == 0 and name_rva == 0 and iat_rva == 0:
                break
            entries: list[ImportEntry] = []
            index = 0
            while True:
                value = struct.unpack_from("<Q", self.data, self.rva_to_offset(lookup_rva + 8 * index))[0]
                if value == 0:
                    break
                if value >> 63:
                    entries.append(ImportEntry(index, iat_rva + 8 * index, value, True, value & 0xFFFF, None, None))
                else:
                    hint_rva = value & 0x7FFFFFFF
                    hint = struct.unpack_from("<H", self.data, self.rva_to_offset(hint_rva))[0]
                    entries.append(ImportEntry(index, iat_rva + 8 * index, value, False, None, hint, self.string_at(hint_rva + 2)))
                index += 1
            descriptors.append(ImportDescriptor(rva, lookup_rva, timestamp, forwarder, name_rva, iat_rva, self.string_at(name_rva), tuple(entries)))
            rva += 20
        return descriptors

    def exports(self) -> dict[str, Any]:
        """Export directory: 40 bytes, then the address table, the name pointer table, and the ordinal table."""
        rva, _size = self.directory("Export")
        if rva == 0:
            return {}
        (_flags, timestamp, _maj, _min, name_rva, ordinal_base, address_count, name_count, eat_rva, enpt_rva, eot_rva) = struct.unpack_from("<IIHHIIIIIII", self.data, self.rva_to_offset(rva))
        addresses = [struct.unpack_from("<I", self.data, self.rva_to_offset(eat_rva + 4 * k))[0] for k in range(address_count)]
        names = [self.string_at(struct.unpack_from("<I", self.data, self.rva_to_offset(enpt_rva + 4 * k))[0]) for k in range(name_count)]
        ordinals = [struct.unpack_from("<H", self.data, self.rva_to_offset(eot_rva + 2 * k))[0] for k in range(name_count)]
        entries = [{"ordinal": ordinal_base + ordinals[k], "rva": addresses[ordinals[k]], "name": names[k]} for k in range(name_count)]
        return {"name": self.string_at(name_rva), "ordinalBase": ordinal_base, "addressCount": address_count, "nameCount": name_count, "tables": {"eat": eat_rva, "enpt": enpt_rva, "eot": eot_rva}, "entries": entries}

    def base_relocations(self) -> list[dict[str, Any]]:
        """.reloc blocks: page RVA, block size, then 16-bit entries of type:4 and offset:12."""
        rva, size = self.directory("Base Relocation")
        blocks: list[dict[str, Any]] = []
        end = rva + size
        while rva < end:
            page, block_size = struct.unpack_from("<II", self.data, self.rva_to_offset(rva))
            entries = []
            for k in range((block_size - 8) // 2):
                word = struct.unpack_from("<H", self.data, self.rva_to_offset(rva + 8 + 2 * k))[0]
                entries.append({"type": word >> 12, "typeName": BASE_RELOCATION_NAMES.get(word >> 12, _hex(word >> 12)), "offset": word & 0xFFF, "rva": page + (word & 0xFFF)})
            blocks.append({"pageRva": page, "blockSize": block_size, "entries": entries})
            rva += block_size
        return blocks

    def iat_calls(self) -> list[dict[str, Any]]:
        """Every `ff 15 disp32` in the code section: call qword ptr [rip + disp32], where rip is the next instruction."""
        code = self.section_of(self.entry_point)
        data = self.read_rva(code.virtual_address, code.virtual_size)
        slots: dict[int, tuple[str, str]] = {}
        for descriptor in self.imports():
            for entry in descriptor.entries:
                slots[entry.slot_rva] = (descriptor.dll, entry.name or f"#{entry.ordinal}")
        calls: list[dict[str, Any]] = []
        for position in range(len(data) - 5):
            if data[position : position + 2] != b"\xff\x15":
                continue
            rva = code.virtual_address + position
            displacement = struct.unpack_from("<i", data, position + 2)[0]
            slot = rva + 6 + displacement
            if slot in slots:
                dll, name = slots[slot]
                calls.append({"rva": rva, "bytes": _hexbytes(data[position : position + 6]), "text": f"call qword ptr [rip + {_hex(displacement)}]", "slot": slot, "dll": dll, "name": name})
        return calls


def load_pe(name: str) -> PeImage:
    return PeImage((FIXTURES / name).read_bytes())


MH_MAGIC_64 = 0xFEEDFACF
LC_REQ_DYLD = 0x80000000
LC_SEGMENT_64, LC_SYMTAB, LC_DYSYMTAB, LC_LOAD_DYLIB, LC_ID_DYLIB, LC_LOAD_DYLINKER = 0x19, 0x2, 0xB, 0xC, 0xD, 0xE
LC_LOAD_WEAK_DYLIB, LC_REEXPORT_DYLIB, LC_RPATH, LC_MAIN = 0x18 | LC_REQ_DYLD, 0x1F | LC_REQ_DYLD, 0x1C | LC_REQ_DYLD, 0x28 | LC_REQ_DYLD
LC_DYLD_INFO, LC_DYLD_INFO_ONLY, LC_FUNCTION_STARTS = 0x22, 0x22 | LC_REQ_DYLD, 0x26
LC_DYLD_EXPORTS_TRIE, LC_DYLD_CHAINED_FIXUPS = 0x33 | LC_REQ_DYLD, 0x34 | LC_REQ_DYLD
LC_NAMES = {
    0x1: "LC_SEGMENT", LC_SYMTAB: "LC_SYMTAB", 0x5: "LC_UNIXTHREAD", LC_DYSYMTAB: "LC_DYSYMTAB", LC_LOAD_DYLIB: "LC_LOAD_DYLIB",
    LC_ID_DYLIB: "LC_ID_DYLIB", LC_LOAD_DYLINKER: "LC_LOAD_DYLINKER", LC_LOAD_WEAK_DYLIB: "LC_LOAD_WEAK_DYLIB", LC_SEGMENT_64: "LC_SEGMENT_64",
    0x1B: "LC_UUID", LC_RPATH: "LC_RPATH", 0x1D: "LC_CODE_SIGNATURE", LC_REEXPORT_DYLIB: "LC_REEXPORT_DYLIB", LC_DYLD_INFO: "LC_DYLD_INFO",
    LC_DYLD_INFO_ONLY: "LC_DYLD_INFO_ONLY", LC_FUNCTION_STARTS: "LC_FUNCTION_STARTS", LC_MAIN: "LC_MAIN", 0x29: "LC_DATA_IN_CODE",
    0x2A: "LC_SOURCE_VERSION", 0x2E: "LC_LINKER_OPTIMIZATION_HINT", 0x32: "LC_BUILD_VERSION", LC_DYLD_EXPORTS_TRIE: "LC_DYLD_EXPORTS_TRIE",
    LC_DYLD_CHAINED_FIXUPS: "LC_DYLD_CHAINED_FIXUPS",
}
MH_FLAGS = [(0x1, "MH_NOUNDEFS"), (0x4, "MH_DYLDLINK"), (0x80, "MH_TWOLEVEL"), (0x2000, "MH_SUBSECTIONS_VIA_SYMBOLS"), (0x200000, "MH_PIE"), (0x800000, "MH_HAS_TLV_DESCRIPTORS")]
MH_FILETYPES = {0x1: "MH_OBJECT", 0x2: "MH_EXECUTE", 0x6: "MH_DYLIB", 0x7: "MH_DYLINKER", 0x8: "MH_BUNDLE", 0xA: "MH_DSYM"}
S_NON_LAZY_SYMBOL_POINTERS, S_LAZY_SYMBOL_POINTERS, S_SYMBOL_STUBS = 0x6, 0x7, 0x8
N_STAB, N_PEXT, N_TYPE, N_EXT = 0xE0, 0x10, 0x0E, 0x01
N_UNDF, N_ABS, N_SECT = 0x0, 0x2, 0xE
REFERENCED_DYNAMICALLY = 0x0010
DYLD_CHAINED_PTR_64, DYLD_CHAINED_PTR_64_OFFSET = 2, 6
DYLD_CHAINED_PTR_START_NONE = 0xFFFF
DYLD_CHAINED_IMPORT = 1
EXPORT_SYMBOL_FLAGS_REEXPORT, EXPORT_SYMBOL_FLAGS_STUB_AND_RESOLVER = 0x08, 0x10
ARM64_RELOCATION_NAMES = {0: "ARM64_RELOC_UNSIGNED", 1: "ARM64_RELOC_SUBTRACTOR", 2: "ARM64_RELOC_BRANCH26", 3: "ARM64_RELOC_PAGE21", 4: "ARM64_RELOC_PAGEOFF12", 5: "ARM64_RELOC_GOT_LOAD_PAGE21", 6: "ARM64_RELOC_GOT_LOAD_PAGEOFF12", 7: "ARM64_RELOC_POINTER_TO_GOT", 8: "ARM64_RELOC_TLVP_LOAD_PAGE21", 9: "ARM64_RELOC_TLVP_LOAD_PAGEOFF12", 10: "ARM64_RELOC_ADDEND"}


@dataclass(frozen=True)
class LoadCommand:
    index: int
    cmd: int
    offset: int
    size: int

    @property
    def name(self) -> str:
        return LC_NAMES.get(self.cmd, _hex(self.cmd))


@dataclass(frozen=True)
class MachSection:
    sectname: str
    segname: str
    addr: int
    size: int
    offset: int
    flags: int
    reserved1: int
    reserved2: int
    reloff: int
    nreloc: int

    @property
    def type(self) -> int:
        return self.flags & 0xFF

    def contains(self, address: int) -> bool:
        return self.addr <= address < self.addr + self.size


@dataclass(frozen=True)
class Segment:
    name: str
    vmaddr: int
    vmsize: int
    fileoff: int
    filesize: int
    initprot: int
    sections: tuple[MachSection, ...]

    def contains(self, address: int) -> bool:
        return self.vmaddr <= address < self.vmaddr + self.vmsize


@dataclass(frozen=True)
class Nlist:
    index: int
    name: str
    type: int
    sect: int
    desc: int
    value: int

    @property
    def is_stab(self) -> bool:
        return bool(self.type & N_STAB)

    @property
    def kind(self) -> int:
        return self.type & N_TYPE

    @property
    def external(self) -> bool:
        return bool(self.type & N_EXT)

    @property
    def library_ordinal(self) -> int:
        return (self.desc >> 8) & 0xFF


@dataclass(frozen=True)
class MachRelocation:
    address: int
    symbolnum: int
    pcrel: bool
    length: int
    extern: bool
    type: int
    name: str

    @property
    def size(self) -> int:
        return 1 << self.length

    @property
    def type_name(self) -> str:
        return ARM64_RELOCATION_NAMES.get(self.type, _hex(self.type))


@dataclass(frozen=True)
class Fixup:
    offset: int
    address: int
    segment: str
    section: str
    raw: int
    kind: str
    next: int
    ordinal: int | None
    addend: int | None
    target: int | None

    def to_dict(self) -> dict[str, Any]:
        row: dict[str, Any] = {"offset": _hex(self.offset), "address": _hex(self.address), "segment": self.segment, "section": self.section, "raw": f"0x{self.raw:016x}", "kind": self.kind, "next": self.next}
        if self.kind == "bind":
            row.update({"ordinal": self.ordinal, "addend": self.addend})
        else:
            row["target"] = _hex(self.target or 0)
        return row


@dataclass(frozen=True)
class ChainedImport:
    index: int
    lib_ordinal: int
    weak: bool
    name: str
    library: str


@dataclass(frozen=True)
class Stub:
    index: int
    address: int
    raw: bytes
    page: int
    slot: int
    symbol: str

    def lines(self) -> list[str]:
        return [f"adrp x16, {_hex(self.page)}", f"ldr x16, [x16, #{_hex(self.slot - self.page)}]   -> slot {_hex(self.slot)}", "br x16"]


def short_library_name(path: str) -> str:
    return path.rsplit("/", 1)[-1].split(".", 1)[0]


class MachoFile:
    """A 64-bit Mach-O object, executable, or dylib."""

    def __init__(self, data: bytes) -> None:
        if len(data) < 32 or struct.unpack_from("<I", data, 0)[0] != MH_MAGIC_64:
            raise FormatError("not a 64-bit little-endian Mach-O file")
        self.data = data
        _magic, self.cputype, self.cpusubtype, self.filetype, self.ncmds, self.sizeofcmds, self.flags, _reserved = struct.unpack_from("<IiiIIIII", data, 0)
        self.load_commands: list[LoadCommand] = []
        self.segments: list[Segment] = []
        self.dylibs: list[str] = []
        self.rpaths: list[str] = []
        self.symtab: tuple[int, int, int, int] | None = None
        self.indirect_symbols: list[int] = []
        self.entryoff: int | None = None
        self.linkedit: dict[str, tuple[int, int]] = {}
        self.dyld_info: dict[str, int] | None = None
        offset = 32
        for index in range(self.ncmds):
            cmd, cmdsize = struct.unpack_from("<II", data, offset)
            self.load_commands.append(LoadCommand(index, cmd, offset, cmdsize))
            if cmd == LC_SEGMENT_64:
                segname, vmaddr, vmsize, fileoff, filesize, _maxprot, initprot, nsects, _flags = struct.unpack_from("<16sQQQQiiII", data, offset + 8)
                sections = []
                for k in range(nsects):
                    base = offset + 72 + 80 * k
                    sectname, seg, addr, size, sect_offset, _align, reloff, nreloc, flags, reserved1, reserved2, _reserved3 = struct.unpack_from("<16s16sQQIIIIIIII", data, base)
                    sections.append(MachSection(sectname.rstrip(b"\0").decode(), seg.rstrip(b"\0").decode(), addr, size, sect_offset, flags, reserved1, reserved2, reloff, nreloc))
                self.segments.append(Segment(segname.rstrip(b"\0").decode(), vmaddr, vmsize, fileoff, filesize, initprot, tuple(sections)))
            elif cmd == LC_SYMTAB:
                self.symtab = struct.unpack_from("<IIII", data, offset + 8)
            elif cmd == LC_DYSYMTAB:
                fields = struct.unpack_from("<18I", data, offset + 8)
                indirectsymoff, nindirect = fields[12], fields[13]
                self.indirect_symbols = list(struct.unpack_from(f"<{nindirect}I", data, indirectsymoff))
            elif cmd in (LC_LOAD_DYLIB, LC_LOAD_WEAK_DYLIB, LC_REEXPORT_DYLIB):
                name_offset = struct.unpack_from("<I", data, offset + 8)[0]
                self.dylibs.append(_cstring(data, offset + name_offset))
            elif cmd == LC_RPATH:
                self.rpaths.append(_cstring(data, offset + struct.unpack_from("<I", data, offset + 8)[0]))
            elif cmd == LC_MAIN:
                self.entryoff = struct.unpack_from("<Q", data, offset + 8)[0]
            elif cmd in (LC_FUNCTION_STARTS, LC_DYLD_EXPORTS_TRIE, LC_DYLD_CHAINED_FIXUPS, 0x29, 0x1D):
                self.linkedit[LC_NAMES[cmd]] = struct.unpack_from("<II", data, offset + 8)
            elif cmd in (LC_DYLD_INFO, LC_DYLD_INFO_ONLY):
                values = struct.unpack_from("<10I", data, offset + 8)
                keys = ["rebase_off", "rebase_size", "bind_off", "bind_size", "weak_bind_off", "weak_bind_size", "lazy_bind_off", "lazy_bind_size", "export_off", "export_size"]
                self.dyld_info = dict(zip(keys, values))
            offset += cmdsize
        self.nlists = self._read_nlists()

    @property
    def filetype_name(self) -> str:
        return MH_FILETYPES.get(self.filetype, _hex(self.filetype))

    def flag_names(self) -> list[str]:
        return [name for bit, name in MH_FLAGS if self.flags & bit]

    def command_names(self) -> list[str]:
        return [command.name for command in self.load_commands]

    def _read_nlists(self) -> list[Nlist]:
        if self.symtab is None:
            return []
        symoff, nsyms, stroff, strsize = self.symtab
        strings = self.data[stroff : stroff + strsize]
        rows: list[Nlist] = []
        for index in range(nsyms):
            n_strx, n_type, n_sect, n_desc, n_value = struct.unpack_from("<IBBHQ", self.data, symoff + 16 * index)
            rows.append(Nlist(index, _cstring(strings, n_strx), n_type, n_sect, n_desc, n_value))
        return rows

    @property
    def base_address(self) -> int:
        for segment in self.segments:
            if segment.name == "__TEXT":
                return segment.vmaddr
        return self.segments[0].vmaddr if self.segments else 0

    def segment(self, name: str) -> Segment:
        for segment in self.segments:
            if segment.name == name:
                return segment
        raise FormatError(f"no segment named {name}")

    def section(self, segname: str, sectname: str) -> MachSection:
        for segment in self.segments:
            for section in segment.sections:
                if section.segname == segname and section.sectname == sectname:
                    return section
        raise FormatError(f"no section {segname},{sectname}")

    def sections(self) -> list[MachSection]:
        return [section for segment in self.segments for section in segment.sections]

    def section_bytes(self, section: MachSection) -> bytes:
        return self.data[section.offset : section.offset + section.size]

    def locate(self, address: int) -> tuple[str, str]:
        for segment in self.segments:
            for section in segment.sections:
                if section.contains(address):
                    return segment.name, section.sectname
            if segment.contains(address):
                return segment.name, ""
        raise FormatError(f"address {_hex(address)} is in no segment")

    def address_to_offset(self, address: int) -> int:
        for segment in self.segments:
            if segment.contains(address) and segment.filesize:
                return address - segment.vmaddr + segment.fileoff
        raise FormatError(f"address {_hex(address)} is not in the file")

    def read(self, address: int, size: int) -> bytes:
        offset = self.address_to_offset(address)
        return self.data[offset : offset + size]

    def word(self, address: int) -> int:
        return struct.unpack("<I", self.read(address, 4))[0]

    def library_name(self, ordinal: int) -> str:
        if 1 <= ordinal <= len(self.dylibs):
            return short_library_name(self.dylibs[ordinal - 1])
        return {0: "self", 0xFE: "dynamic-lookup", 0xFF: "executable"}.get(ordinal, _hex(ordinal))

    def two_level_imports(self) -> list[tuple[str, str]]:
        """Undefined external symbols with the library ordinal that nlist.n_desc carries (nlist.h GET_LIBRARY_ORDINAL)."""
        rows = [(n.name, self.library_name(n.library_ordinal)) for n in self.nlists if not n.is_stab and n.kind == N_UNDF and n.external]
        return sorted(rows)

    def nm_lines(self) -> list[str]:
        """The shape of `nm -m`: address, section or (undefined), reference flags, external or non-external, name, (from library)."""
        lines: list[str] = []
        for n in sorted(self.nlists, key=lambda n: n.name):
            if n.is_stab:
                continue
            visibility = "external" if n.external else "non-external"
            if n.kind == N_UNDF:
                lines.append(f"(undefined) {visibility} {n.name} (from {self.library_name(n.library_ordinal)})")
                continue
            sections = self.sections()
            where = "(absolute)"
            if n.kind == N_SECT and 0 < n.sect <= len(sections):
                where = f"({sections[n.sect - 1].segname},{sections[n.sect - 1].sectname})"
            flags = " [referenced dynamically]" if n.desc & REFERENCED_DYNAMICALLY else ""
            lines.append(f"{n.value:016x} {where}{flags} {visibility} {n.name}")
        return lines

    def function_starts(self) -> list[int]:
        """LC_FUNCTION_STARTS: uleb128 deltas, the first from the __TEXT address, a zero delta ends the list."""
        if "LC_FUNCTION_STARTS" not in self.linkedit:
            return []
        dataoff, datasize = self.linkedit["LC_FUNCTION_STARTS"]
        blob = self.data[dataoff : dataoff + datasize]
        starts: list[int] = []
        address = self.base_address
        position = 0
        while position < len(blob):
            delta, position = read_uleb128(blob, position)
            if delta == 0 and starts:
                break
            address += delta
            starts.append(address)
        return starts

    def stubs(self) -> list[Stub]:
        """__stubs entries of reserved2 bytes each: adrp x16, page; ldr x16, [x16, #off]; br x16. The indirect symbol table names each one."""
        stubs: list[Stub] = []
        for section in self.sections():
            if section.type != S_SYMBOL_STUBS:
                continue
            size = section.reserved2 or 12
            data = self.section_bytes(section)
            for index in range(section.size // size):
                address = section.addr + index * size
                raw = data[index * size : (index + 1) * size]
                page, slot = self._decode_arm64_stub(address, raw)
                indirect = self.indirect_symbols[section.reserved1 + index] if self.indirect_symbols else None
                name = self.nlists[indirect].name if indirect is not None and indirect < len(self.nlists) else "?"
                stubs.append(Stub(index, address, raw, page, slot, name))
        return stubs

    @staticmethod
    def _decode_arm64_stub(address: int, raw: bytes) -> tuple[int, int]:
        adrp, ldr, br = struct.unpack("<III", raw[:12])
        if (adrp & 0x9F000000) != 0x90000000 or (ldr & 0xFFC00000) != 0xF9400000 or (br & 0xFFFFFC1F) != 0xD61F0000:
            raise FormatError(f"stub at {_hex(address)} is not adrp/ldr/br")
        immlo = (adrp >> 29) & 0x3
        immhi = (adrp >> 5) & 0x7FFFF
        page_delta = _signed((immhi << 2) | immlo, 21) << 12
        page = (address & ~0xFFF) + page_delta
        slot = page + (((ldr >> 10) & 0xFFF) << 3)
        return page, slot

    def indirect_table(self) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for section in self.sections():
            if section.type not in (S_SYMBOL_STUBS, S_NON_LAZY_SYMBOL_POINTERS, S_LAZY_SYMBOL_POINTERS):
                continue
            stride = section.reserved2 if section.type == S_SYMBOL_STUBS else 8
            for index in range(section.size // stride):
                symbol = self.indirect_symbols[section.reserved1 + index]
                rows.append({"section": f"{section.segname},{section.sectname}", "address": section.addr + index * stride, "index": symbol, "name": self.nlists[symbol].name if symbol < len(self.nlists) else _hex(symbol)})
        return rows

    def chained_fixups(self) -> dict[str, Any]:
        """LC_DYLD_CHAINED_FIXUPS (fixup-chains.h): header, starts per segment, one chain per page, imports table."""
        if "LC_DYLD_CHAINED_FIXUPS" not in self.linkedit:
            return {}
        dataoff, datasize = self.linkedit["LC_DYLD_CHAINED_FIXUPS"]
        version, starts_offset, imports_offset, symbols_offset, imports_count, imports_format, symbols_format = struct.unpack_from("<7I", self.data, dataoff)
        header = {"fixups_version": version, "starts_offset": starts_offset, "imports_offset": imports_offset, "symbols_offset": symbols_offset, "imports_count": imports_count, "imports_format": imports_format, "symbols_format": symbols_format}
        if imports_format != DYLD_CHAINED_IMPORT:
            raise FormatError(f"imports_format {imports_format} is not DYLD_CHAINED_IMPORT")
        imports: list[ChainedImport] = []
        symbols = dataoff + symbols_offset
        for index in range(imports_count):
            packed = struct.unpack_from("<I", self.data, dataoff + imports_offset + 4 * index)[0]
            lib_ordinal, weak, name_offset = packed & 0xFF, bool((packed >> 8) & 1), packed >> 9
            imports.append(ChainedImport(index, lib_ordinal, weak, _cstring(self.data, symbols + name_offset), self.library_name(lib_ordinal)))
        starts = dataoff + starts_offset
        seg_count = struct.unpack_from("<I", self.data, starts)[0]
        seg_info = struct.unpack_from(f"<{seg_count}I", self.data, starts + 4)
        segments_out: list[dict[str, Any]] = []
        fixups: list[Fixup] = []
        for seg_index, info_offset in enumerate(seg_info):
            if info_offset == 0:
                continue
            base = starts + info_offset
            size, page_size, pointer_format, segment_offset, max_valid, page_count = struct.unpack_from("<IHHQIH", self.data, base)
            page_starts = list(struct.unpack_from(f"<{page_count}H", self.data, base + 22))
            segment = self.segments[seg_index]
            segments_out.append({"segment": segment.name, "size": size, "page_size": page_size, "pointer_format": pointer_format, "segment_offset": segment_offset, "max_valid_pointer": max_valid, "page_count": page_count, "page_start": page_starts})
            if pointer_format not in (DYLD_CHAINED_PTR_64, DYLD_CHAINED_PTR_64_OFFSET):
                raise FormatError(f"pointer_format {pointer_format} is not a 64-bit chain")
            for page_index, page_start in enumerate(page_starts):
                if page_start == DYLD_CHAINED_PTR_START_NONE:
                    continue
                offset = segment.fileoff + page_index * page_size + page_start
                hops = 0
                while True:
                    raw = struct.unpack_from("<Q", self.data, offset)[0]
                    address = segment.vmaddr + (offset - segment.fileoff)
                    seg_name, sect_name = self.locate(address)
                    nxt = (raw >> 51) & 0xFFF
                    if raw >> 63:
                        fixups.append(Fixup(offset, address, seg_name, sect_name, raw, "bind", nxt, raw & 0xFFFFFF, (raw >> 24) & 0xFF, None))
                    else:
                        target = raw & ((1 << 36) - 1)
                        if pointer_format == DYLD_CHAINED_PTR_64_OFFSET:
                            target += self.base_address
                        fixups.append(Fixup(offset, address, seg_name, sect_name, raw, "rebase", nxt, None, None, target))
                    hops += 1
                    if nxt == 0 or hops > 100000:
                        break
                    offset += nxt * 4
        return {"dataoff": dataoff, "datasize": datasize, "header": header, "segments": segments_out, "fixups": fixups, "imports": imports}

    def fixup_rows(self) -> list[tuple[str, str, int, str, str]]:
        """The rows `dyld_info -fixups` prints: segment, section, address, type, target."""
        info = self.chained_fixups()
        if not info:
            return []
        imports: list[ChainedImport] = info["imports"]
        rows: list[tuple[str, str, int, str, str]] = []
        for fixup in info["fixups"]:
            if fixup.kind == "bind":
                entry = imports[fixup.ordinal or 0]
                target = f"{entry.library}/{entry.name}" + (f"+{_hex(fixup.addend)}" if fixup.addend else "")
            else:
                target = _hex(fixup.target or 0)
            rows.append((fixup.segment, fixup.section, fixup.address, fixup.kind, target))
        return rows

    def exports_trie(self) -> list[dict[str, Any]]:
        """LC_DYLD_EXPORTS_TRIE: a prefix tree. Each node is a uleb128 terminal size, optional terminal info, a child count, and edges."""
        if "LC_DYLD_EXPORTS_TRIE" not in self.linkedit:
            return []
        dataoff, datasize = self.linkedit["LC_DYLD_EXPORTS_TRIE"]
        blob = self.data[dataoff : dataoff + datasize]
        exports: list[dict[str, Any]] = []

        def visit(offset: int, prefix: str) -> None:
            terminal_size, position = read_uleb128(blob, offset)
            if terminal_size:
                flags, cursor = read_uleb128(blob, position)
                entry: dict[str, Any] = {"name": prefix, "flags": flags}
                if flags & EXPORT_SYMBOL_FLAGS_REEXPORT:
                    ordinal, cursor = read_uleb128(blob, cursor)
                    entry.update({"reexport": ordinal, "importName": _cstring(blob, cursor)})
                else:
                    address, cursor = read_uleb128(blob, cursor)
                    entry["offset"] = address
                    if flags & EXPORT_SYMBOL_FLAGS_STUB_AND_RESOLVER:
                        entry["resolver"], cursor = read_uleb128(blob, cursor)
                exports.append(entry)
            children = position + terminal_size
            count = blob[children]
            cursor = children + 1
            for _ in range(count):
                edge = _cstring(blob, cursor)
                cursor += len(edge.encode()) + 1
                child, cursor = read_uleb128(blob, cursor)
                visit(child, prefix + edge)

        if blob:
            visit(0, "")
        return sorted(exports, key=lambda e: e["name"])

    def relocations(self) -> dict[str, list[MachRelocation]]:
        """relocation_info records of an MH_OBJECT: r_address, then symbolnum:24 pcrel:1 length:2 extern:1 type:4."""
        table: dict[str, list[MachRelocation]] = {}
        for section in self.sections():
            for index in range(section.nreloc):
                r_address, packed = struct.unpack_from("<iI", self.data, section.reloff + 8 * index)
                symbolnum, pcrel, length, extern, r_type = packed & 0xFFFFFF, bool((packed >> 24) & 1), (packed >> 25) & 3, bool((packed >> 27) & 1), (packed >> 28) & 0xF
                if extern:
                    name = self.nlists[symbolnum].name
                else:
                    sections = self.sections()
                    name = sections[symbolnum - 1].sectname if 0 < symbolnum <= len(sections) else _hex(symbolnum)
                table.setdefault(section.sectname, []).append(MachRelocation(r_address, symbolnum, pcrel, length, extern, r_type, name))
        return table

    def text_section(self) -> MachSection:
        return self.section("__TEXT", "__text")

    def text_functions(self) -> list[tuple[str, int, int]]:
        """(name, start, end) for every N_SECT symbol inside __text, ends from the next symbol or the section end."""
        text = self.text_section()
        starts: dict[int, str] = {}
        for n in self.nlists:
            if n.is_stab or n.kind != N_SECT or not text.contains(n.value) or n.name.startswith("ltmp"):
                continue
            if n.value not in starts or n.external:
                starts[n.value] = n.name
        ordered = sorted(starts)
        rows: list[tuple[str, int, int]] = []
        for position, start in enumerate(ordered):
            end = ordered[position + 1] if position + 1 < len(ordered) else text.addr + text.size
            rows.append((starts[start], start, end))
        return rows


def load_macho(name: str) -> MachoFile:
    return MachoFile((FIXTURES / name).read_bytes())


STP_FRAME_WORD = 0xA9BF7BFD
PROLOGUE_PATTERNS = {
    "stp-frame": ("stp x29, x30, [sp, #-0x10]!", lambda w: w == STP_FRAME_WORD),
    "sub-sp": ("sub sp, sp, #imm", lambda w: (w & 0xFF0003FF) == 0xD10003FF),
}


def decode_bl(word: int, address: int) -> int | None:
    if (word & 0xFC000000) != 0x94000000:
        return None
    return address + (_signed(word & 0x03FFFFFF, 26) << 2)


class FunctionFinder:
    """Four ways to find function starts in an arm64 Mach-O, each scored against the symbol table of the unstripped twin."""

    def __init__(self, macho: MachoFile) -> None:
        self.macho = macho
        self.text = macho.text_section()
        self.code = macho.section_bytes(self.text)
        self.words = [struct.unpack_from("<I", self.code, k)[0] for k in range(0, len(self.code) - 3, 4)]

    def symbols(self) -> list[int]:
        return [start for _name, start, _end in self.macho.text_functions()]

    def function_starts(self) -> list[int]:
        return [a for a in self.macho.function_starts() if self.text.contains(a)]

    def prologue_scan(self, pattern: str) -> list[int]:
        _label, matches = PROLOGUE_PATTERNS[pattern]
        return [self.text.addr + 4 * k for k, word in enumerate(self.words) if matches(word)]

    def call_targets(self) -> list[int]:
        """Targets of every bl inside __text, plus the LC_MAIN entry. Stubs live in another section and are left out."""
        targets: set[int] = set()
        for k, word in enumerate(self.words):
            target = decode_bl(word, self.text.addr + 4 * k)
            if target is not None and self.text.contains(target):
                targets.add(target)
        if self.macho.entryoff is not None:
            targets.add(self.macho.base_address + self.macho.entryoff)
        return sorted(targets)

    @staticmethod
    def score(found: list[int], truth: list[int]) -> dict[str, Any]:
        truth_set = set(truth)
        true_positives = [a for a in found if a in truth_set]
        return {
            "hits": len(found),
            "truePositives": len(true_positives),
            "falsePositives": [_hex(a) for a in found if a not in truth_set],
            "missed": [_hex(a) for a in truth if a not in set(found)],
            "recall": f"{len(true_positives)}/{len(truth)}",
        }

    def methods(self) -> dict[str, list[int]]:
        return {
            "functionStarts": self.function_starts(),
            "prologueSub": self.prologue_scan("sub-sp"),
            "prologueStp": self.prologue_scan("stp-frame"),
            "callTargets": self.call_targets(),
        }


PATTERN_LENGTH = 32


@dataclass(frozen=True)
class Signature:
    name: str
    pattern: tuple[int | None, ...]
    crc_length: int
    crc: int
    length: int
    masked: tuple[int | None, ...]
    referenced: tuple[str, ...]

    def pat_line(self) -> str:
        """The .pat line layout the public parsers document: pattern, CRC length, CRC16, function length, :offset name, ^offset refname."""
        pattern = "".join(".." if byte is None else f"{byte:02X}" for byte in self.pattern)
        refs = "".join(f" ^{position:04X} {name}" for position, name in enumerate(self.referenced))
        return f"{pattern} {self.crc_length:02X} {self.crc:04X} {self.length:04X} :0000 {self.name}{refs}"

    def matches(self, data: bytes) -> bool:
        if len(data) < len(self.pattern):
            return False
        for byte, expected in zip(data, self.pattern):
            if expected is not None and byte != expected:
                return False
        if self.crc_length and crc16(data[PATTERN_LENGTH : PATTERN_LENGTH + self.crc_length]) != self.crc:
            return False
        return True

    def tail_matches(self, data: bytes) -> bool:
        if len(data) < self.length:
            return False
        return all(expected is None or data[k] == expected for k, expected in enumerate(self.masked))


def signatures_from_object(macho: MachoFile) -> list[Signature]:
    """One signature per __text function of an MH_OBJECT. Bytes under a relocation are variant, like FLIRT's fixup bytes."""
    text = macho.text_section()
    code = macho.section_bytes(text)
    relocations = macho.relocations().get("__text", [])
    variant: set[int] = set()
    referenced_at: dict[int, str] = {}
    for relocation in relocations:
        variant.update(range(relocation.address, relocation.address + relocation.size))
        if relocation.extern:
            referenced_at[relocation.address] = relocation.name
    signatures: list[Signature] = []
    for name, start, end in macho.text_functions():
        body = code[start - text.addr : end - text.addr]
        masked = tuple(None if (start - text.addr + k) in variant else byte for k, byte in enumerate(body))
        pattern = masked[:PATTERN_LENGTH]
        crc_length = 0
        for k in range(PATTERN_LENGTH, len(masked)):
            if masked[k] is None:
                break
            crc_length += 1
        crc = crc16(bytes(masked[PATTERN_LENGTH : PATTERN_LENGTH + crc_length])) if crc_length else 0
        referenced = tuple(referenced_at[a] for a in sorted(referenced_at) if start - text.addr <= a < end - text.addr)
        signatures.append(Signature(name, pattern, crc_length, crc, len(body), masked, referenced))
    return signatures


def match_signatures(signatures: list[Signature], macho: MachoFile, candidates: list[int]) -> dict[str, Any]:
    """Try every signature at every candidate start. Pattern and CRC first; a collision is split by the tail bytes."""
    text = macho.text_section()
    code = macho.section_bytes(text)
    names: dict[int, str] = {}
    collisions: list[dict[str, Any]] = []
    unmatched: list[int] = []
    for address in candidates:
        window = code[address - text.addr :]
        hits = [s for s in signatures if s.matches(window)]
        if not hits:
            unmatched.append(address)
            continue
        if len(hits) > 1:
            tail = [s for s in hits if s.tail_matches(window)]
            split = _first_tail_difference(hits)
            collisions.append({"address": _hex(address), "candidates": [s.name for s in hits], "resolvedBy": split, "winner": tail[0].name if len(tail) == 1 else None})
            hits = tail if len(tail) == 1 else hits[:1]
        names[address] = hits[0].name
    return {"names": {_hex(a): n for a, n in sorted(names.items())}, "collisions": collisions, "unmatched": [_hex(a) for a in unmatched]}


def _first_tail_difference(signatures: list[Signature]) -> dict[str, Any]:
    first, second = signatures[0], signatures[1]
    limit = min(len(first.masked), len(second.masked))
    for k in range(PATTERN_LENGTH, limit):
        a, b = first.masked[k], second.masked[k]
        if a is not None and b is not None and a != b:
            return {"tailOffset": k, "bytes": {first.name: f"{a:02x}", second.name: f"{b:02x}"}, "lengths": {first.name: first.length, second.name: second.length}}
    return {"tailOffset": None, "lengths": {first.name: first.length, second.name: second.length}}


def parse_objdump_sections(text: str) -> list[tuple[int, str, int, int]]:
    rows: list[tuple[int, str, int, int]] = []
    active = False
    for line in text.splitlines():
        if line.startswith("Sections:"):
            active = True
            continue
        if active:
            if not line.strip() or line.startswith("Idx"):
                if line.startswith("Idx"):
                    continue
                if rows:
                    active = False
                continue
            parts = line.split()
            if parts[0].isdigit():
                if len(parts) >= 4 and all(c in "0123456789abcdef" for c in parts[2]):
                    rows.append((int(parts[0]), parts[1], int(parts[2], 16), int(parts[3], 16)))
                elif len(parts) >= 3:
                    rows.append((int(parts[0]), "", int(parts[1], 16), int(parts[2], 16)))
    return rows


def parse_objdump_relocations(text: str) -> dict[str, list[tuple[int, str, str]]]:
    table: dict[str, list[tuple[int, str, str]]] = {}
    current: str | None = None
    for line in text.splitlines():
        if line.startswith("RELOCATION RECORDS FOR ["):
            current = line[len("RELOCATION RECORDS FOR [") : line.index("]")]
            table[current] = []
            continue
        if current is None or line.startswith("OFFSET") or not line.strip():
            if not line.strip():
                current = None
            continue
        offset, rel_type, value = line.split(None, 2)
        table[current].append((int(offset, 16), rel_type, value.strip()))
    return table


def parse_objdump_coff_symbols(text: str) -> list[tuple[int, str]]:
    rows: list[tuple[int, str]] = []
    for line in text.splitlines():
        if line.startswith("[") and "]" in line:
            index = int(line[1 : line.index("]")])
            rows.append((index, line.split()[-1]))
    return rows


def parse_objdump_dynamic(text: str) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    active = False
    for line in text.splitlines():
        if line.startswith("Dynamic Section:"):
            active = True
            continue
        if active:
            if not line.strip():
                break
            tag, value = line.split(None, 1)
            rows.append((tag, value.strip()))
    return rows


def parse_objdump_pe_imports(text: str) -> list[tuple[str, int, int, list[tuple[int, str]]]]:
    rows: list[tuple[str, int, int, list[tuple[int, str]]]] = []
    lookup = iat = 0
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("lookup "):
            parts = stripped.split()
            lookup, iat = int(parts[1], 16), int(parts[9], 16)
        elif stripped.startswith("DLL Name:"):
            rows.append((stripped.split(":", 1)[1].strip(), lookup, iat, []))
        elif rows and stripped and stripped[0].isdigit() and len(stripped.split()) == 2:
            hint, name = stripped.split()
            rows[-1][3].append((int(hint), name))
    return rows


def parse_dyld_fixups(text: str) -> list[tuple[str, str, int, str, str]]:
    rows: list[tuple[str, str, int, str, str]] = []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) == 5 and parts[2].startswith("0x"):
            rows.append((parts[0], parts[1], int(parts[2], 16), parts[3], parts[4]))
    return rows


def parse_dyld_chain_details(text: str) -> list[tuple[int, int]]:
    rows: list[tuple[int, int]] = []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) >= 3 and parts[0].endswith(":") and parts[1] == "raw:":
            rows.append((int(parts[0][:-1], 16), int(parts[2], 16)))
    return rows


def parse_dyld_imports(text: str) -> list[tuple[int, str, str]]:
    rows: list[tuple[int, str, str]] = []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) >= 4 and parts[0].startswith("0x") and parts[2] == "(from":
            rows.append((int(parts[0], 16), parts[1], parts[3].rstrip(")")))
    return rows


def parse_dyld_exports(text: str) -> list[tuple[int, str]]:
    rows: list[tuple[int, str]] = []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[0].startswith("0x"):
            rows.append((int(parts[0], 16), parts[1]))
    return rows


def parse_function_starts(text: str) -> list[int]:
    return [int(line.split()[0], 16) for line in text.splitlines() if line.strip().startswith("0x")]


def parse_nm_addresses(text: str) -> dict[str, int]:
    rows: dict[str, int] = {}
    for line in text.splitlines():
        parts = line.split()
        if len(parts) == 3 and parts[1] in ("T", "t"):
            rows[parts[2]] = int(parts[0], 16)
    return rows


def parse_nm_m(text: str) -> list[str]:
    return [" ".join(line.split()) for line in text.splitlines() if line.strip()]


def parse_otool_stubs(text: str) -> list[tuple[int, str]]:
    rows: list[tuple[int, str]] = []
    for line in text.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2 and parts[0].strip().startswith("0000"):
            rows.append((int(parts[0], 16), "\t".join(p.strip() for p in parts[1:])))
    return rows


def parse_otool_indirect(text: str) -> list[tuple[int, int, str]]:
    rows: list[tuple[int, int, str]] = []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) == 3 and parts[0].startswith("0x"):
            rows.append((int(parts[0], 16), int(parts[1]), parts[2]))
    return rows


def parse_otool_header_flags(text: str) -> int:
    for line in text.splitlines():
        parts = line.split()
        if parts and parts[0] == "0xfeedfacf":
            return int(parts[-1], 16)
    raise FormatError("no Mach header line")


def parse_otool_commands(text: str) -> list[str]:
    return [line.split()[1] for line in text.splitlines() if line.strip().startswith("cmd ")]


def fixture_text(name: str) -> str:
    return (FIXTURES / name).read_text()


def elf_report(elf: ElfFile) -> dict[str, Any]:
    report: dict[str, Any] = {"type": elf.type_name, "entry": _hex(elf.entry), "sections": [{"name": s.name, "size": s.size, "addr": _hex(s.addr)} for s in elf.sections if s.name]}
    if elf.program_headers:
        report["programHeaders"] = [{"type": h.type_name, "offset": _hex(h.offset), "vaddr": _hex(h.vaddr), "filesz": _hex(h.filesz), "flags": h.flags_text} for h in elf.program_headers]
    if elf.type != ET_REL:
        report["dynamic"] = [{"tag": e.tag_name, "value": e.text} for e in elf.dynamic_entries()]
        report["dynamicSymbols"] = [s.name for s in elf.dynamic_symbols if s.name]
        report["jumpSlots"] = [{"slot": _hex(r.offset), "relocation": r.describe()} for r in elf.jump_slots()]
        report["plt0"] = elf.plt0()
        report["plt"] = [{"symbol": e.symbol, "address": _hex(e.address), "bytes": _hexbytes(e.raw), "slot": _hex(e.slot), "pushIndex": e.push_index, "slotInitial": _hex(e.slot_initial), "lines": e.lines()} for e in elf.plt_entries()]
        report["gotPlt"] = [_hex(w) for w in elf.got_plt_words()]
    else:
        report["relocations"] = {target: [{"offset": _hex(r.offset), "relocation": r.describe(), "formula": ELF_RELOCATION_FORMULAS.get(r.type, "")} for r in rows] for target, rows in elf.relocations.items()}
        report["functions"] = [s.name for s in elf.functions()]
        report["undefined"] = [s.name for s in elf.symbols if not s.defined and s.name]
    return report


def coff_report(coff: CoffObject) -> dict[str, Any]:
    return {
        "machine": coff.machine_name,
        "sections": [{"number": s.number, "name": s.name, "size": s.raw_size, "relocations": s.reloc_count, "flags": s.flag_names()} for s in coff.sections],
        "symbols": [{"index": s.index, "name": s.name, "section": s.section_number, "value": _hex(s.value), "storageClass": s.storage_class, "type": _hex(s.type), "aux": len(s.aux)} for s in coff.symbols],
        "sectionDefinitions": coff.section_definitions(),
        "relocations": {name: [{"offset": _hex(r.offset), "type": r.type_name, "symbol": r.symbol_name} for r in rows] for name, rows in coff.relocations.items()},
        "functions": [s.name for s in coff.functions()],
        "undefined": coff.undefined(),
    }


def pe_report(pe: PeImage) -> dict[str, Any]:
    return {
        "e_lfanew": _hex(pe.e_lfanew),
        "machine": IMAGE_FILE_MACHINE_NAMES.get(pe.machine, _hex(pe.machine)),
        "magic": _hex(pe.magic),
        "entryPoint": _hex(pe.entry_point),
        "imageBase": _hex(pe.image_base),
        "sectionAlignment": _hex(pe.section_alignment),
        "fileAlignment": _hex(pe.file_alignment),
        "sizeOfImage": _hex(pe.size_of_image),
        "subsystem": pe.subsystem,
        "dllCharacteristics": pe.dll_characteristic_names(),
        "dataDirectories": [{"name": n, "rva": _hex(r), "size": s} for n, r, s in pe.data_directories if r or s],
        "sections": [{"name": s.name, "rva": _hex(s.virtual_address), "virtualSize": s.virtual_size, "rawSize": s.raw_size, "rawOffset": _hex(s.raw_offset)} for s in pe.sections],
        "imports": [{"dll": d.dll, "descriptor": _hex(d.rva), "lookupTable": _hex(d.lookup_rva), "iat": _hex(d.iat_rva), "entries": [{"slot": _hex(e.slot_rva), "hint": e.hint, "name": e.name, "lookup": _hex(e.lookup)} for e in d.entries]} for d in pe.imports()],
        "exports": pe.exports(),
        "baseRelocations": pe.base_relocations(),
        "iatCalls": [{**c, "rva": _hex(c["rva"]), "slot": _hex(c["slot"])} for c in pe.iat_calls()],
    }


def macho_report(macho: MachoFile) -> dict[str, Any]:
    report: dict[str, Any] = {
        "filetype": macho.filetype_name,
        "flags": _hex(macho.flags),
        "flagNames": macho.flag_names(),
        "loadCommands": macho.command_names(),
        "libraries": macho.dylibs,
        "rpaths": macho.rpaths,
        "entry": None if macho.entryoff is None else _hex(macho.base_address + macho.entryoff),
        "symtab": None if macho.symtab is None else {"nsyms": macho.symtab[1], "strsize": macho.symtab[3]},
        "functionStarts": [_hex(a) for a in macho.function_starts()],
        "twoLevelImports": [f"{name} (from {library})" for name, library in macho.two_level_imports()],
    }
    if macho.filetype == 0x1:
        report["relocations"] = {s: [{"address": _hex(r.address), "type": r.type_name, "symbol": r.name, "size": r.size} for r in rows] for s, rows in macho.relocations().items()}
        report["functions"] = [{"name": n, "start": _hex(s), "end": _hex(e)} for n, s, e in macho.text_functions()]
        return report
    if any(s.type == S_SYMBOL_STUBS for s in macho.sections()):
        report["stubs"] = [{"symbol": s.symbol, "address": _hex(s.address), "bytes": _hexbytes(s.raw), "slot": _hex(s.slot), "lines": s.lines()} for s in macho.stubs()]
    info = macho.chained_fixups()
    if info:
        report["chainedFixups"] = {"dataoff": info["dataoff"], "datasize": info["datasize"], "header": info["header"], "segments": info["segments"], "fixups": [f.to_dict() for f in info["fixups"]], "imports": [{"index": i.index, "libOrdinal": i.lib_ordinal, "weak": i.weak, "name": i.name, "library": i.library} for i in info["imports"]]}
        report["fixupRows"] = [f"{seg} {sect} {_hex(addr)} {kind} {target}" for seg, sect, addr, kind, target in macho.fixup_rows()]
    if macho.dyld_info:
        report["dyldInfo"] = macho.dyld_info
        report["legacySections"] = [f"{s.segname},{s.sectname}" for s in macho.sections() if s.sectname in ("__stub_helper", "__la_symbol_ptr", "__nl_symbol_ptr", "__got")]
    exports = macho.exports_trie()
    if exports:
        report["exports"] = [{"name": e["name"], "offset": _hex(e.get("offset", 0)), "flags": e["flags"]} for e in exports]
    return report


def strip_report(before: MachoFile, after: MachoFile) -> dict[str, Any]:
    names_before = sorted(n.name for n in before.nlists if not n.is_stab)
    names_after = sorted(n.name for n in after.nlists if not n.is_stab)
    return {
        "nsymsBefore": before.symtab[1] if before.symtab else 0,
        "nsymsAfter": after.symtab[1] if after.symtab else 0,
        "removed": [n for n in names_before if n not in names_after],
        "kept": names_after,
        "functionStartsBefore": len(before.function_starts()),
        "functionStartsAfter": len(after.function_starts()),
        "exportsBefore": [e["name"] for e in before.exports_trie()],
        "exportsAfter": [e["name"] for e in after.exports_trie()],
    }


def identification_report(unstripped: MachoFile, stripped: MachoFile, objects: list[MachoFile]) -> dict[str, Any]:
    truth = unstripped.text_functions()
    truth_starts = [start for _n, start, _e in truth]
    finder = FunctionFinder(stripped)
    methods = finder.methods()
    signatures = [s for macho in objects for s in signatures_from_object(macho)]
    matched = match_signatures(signatures, stripped, methods["functionStarts"])
    return {
        "truth": [{"name": n, "start": _hex(s), "size": e - s} for n, s, e in truth],
        "strippedSymbolsInText": [_hex(a) for a in finder.symbols()],
        "methods": {name: {"found": [_hex(a) for a in found], **FunctionFinder.score(found, truth_starts)} for name, found in methods.items()},
        "signatures": {"pat": [s.pat_line() for s in signatures], **matched},
        "correctNames": sum(1 for n, s, _e in truth if matched["names"].get(_hex(s)) == n),
    }


FIXTURE_ELF_OBJECTS = ["main-x86_64-O1.o", "ledger-x86_64-O1.o"]
FIXTURE_COFF_OBJECTS = ["main-x86_64.obj", "ledger-x86_64.obj"]


def demo() -> dict[str, Any]:
    objects = {name: load_elf(name) for name in FIXTURE_ELF_OBJECTS}
    tiny = load_elf("tiny-dyn-x86_64")
    exe = load_macho("ledger_main")
    stripped_exe = load_macho("ledger_main.stripped")
    dylib = load_macho("libledger.dylib")
    stripped_dylib = load_macho("libledger.stripped.dylib")
    return {
        "elf": {
            "objects": {name: {"relocations": {t: len(r) for t, r in elf.relocations.items()}, "functions": [s.name for s in elf.functions()], "undefined": [s.name for s in elf.symbols if not s.defined and s.name]} for name, elf in objects.items()},
            "linkPlan": {k: v for k, v in plan_dynamic_link(objects).items() if k != "decisions"},
            "tiny-dyn-x86_64": elf_report(tiny),
        },
        "coff": {name: {k: v for k, v in coff_report(load_coff(name)).items() if k in ("machine", "sections", "relocations", "functions", "undefined")} for name in FIXTURE_COFF_OBJECTS},
        "pe": pe_report(load_pe("tiny-x86_64.exe")),
        "macho": {
            "ledger_main": macho_report(exe),
            "ledger_main_nochain": {k: v for k, v in macho_report(load_macho("ledger_main_nochain")).items() if k in ("flags", "flagNames", "loadCommands", "dyldInfo", "legacySections")},
            "libledger.dylib": {k: v for k, v in macho_report(dylib).items() if k in ("filetype", "flagNames", "exports", "functionStarts", "symtab")},
            "strip": {"ledger_main": strip_report(exe, stripped_exe), "libledger.dylib": strip_report(dylib, stripped_dylib)},
        },
        "identification": {
            level: identification_report(load_macho(f"static-arm64-{level}"), load_macho(f"static-arm64-{level}.stripped"), [load_macho(f"main-arm64-{level}.o"), load_macho(f"ledger-arm64-{level}.o")])
            for level in ("O0", "O2")
        },
    }


def figure_data() -> dict[str, Any]:
    """One call to puts traced through three formats, plus the stripped-binary panel. All from the fixtures."""
    tiny = load_elf("tiny-dyn-x86_64")
    entry = next(e for e in tiny.plt_entries() if e.symbol == "puts")
    text = tiny.section(".text")
    call_at = None
    for position in range(text.size - 4):
        if text.data[position] == 0xE8 and text.addr + position + 5 + struct.unpack_from("<i", text.data, position + 1)[0] == entry.address:
            call_at = text.addr + position
            break
    assert call_at is not None
    plt0 = tiny.plt0()
    jump_slot = next(r for r in tiny.jump_slots() if r.offset == entry.slot)
    elf = {
        "file": "tiny-dyn-x86_64",
        "symbol": "puts",
        "call": {"address": call_at, "bytes": _hexbytes(tiny.read(call_at, 5)), "text": f"callq {_hex(entry.address)} <puts@plt>", "target": entry.address},
        "stub": {"label": "puts@plt", "address": entry.address, "bytes": _hexbytes(entry.raw), "lines": entry.lines(), "slot": entry.slot},
        "plt0": {"address": plt0["address"], "bytes": plt0["bytes"], "lines": plt0["lines"]},
        "slot": {"label": ".got.plt", "address": entry.slot, "initial": _hex(entry.slot_initial), "initialMeaning": f"{_hex(entry.slot_initial)} = the pushq inside puts@plt, so the first call falls into PLT0", "relocation": jump_slot.describe(), "after": "ld.so writes the address of puts from libc.so.6 here on the first call, or at startup with DF_BIND_NOW"},
        "dynamic": [[e.tag_name, e.text] for e in tiny.dynamic_entries() if e.tag in (DT_NEEDED, DT_PLTGOT, DT_JMPREL, DT_PLTRELSZ, DT_PLTREL, DT_FLAGS_1)],
    }
    pe = load_pe("tiny-x86_64.exe")
    call = next(c for c in pe.iat_calls() if c["name"] == "puts")
    descriptor = pe.imports()[0]
    import_entry = next(e for e in descriptor.entries if e.name == "puts")
    pe_data = {
        "file": "tiny-x86_64.exe",
        "symbol": "puts",
        "call": {"address": call["rva"], "bytes": call["bytes"], "text": call["text"], "target": call["slot"]},
        "slot": {"label": "IAT", "address": import_entry.slot_rva, "initial": _hex(import_entry.lookup), "initialMeaning": f"{_hex(import_entry.lookup)} = RVA of the hint/name entry: hint {import_entry.hint}, name puts", "relocation": f"import descriptor at {_hex(descriptor.rva)}: {descriptor.dll}", "after": "the Windows loader writes the address of puts from msvcrt.dll here before the entry point runs"},
        "descriptor": {"address": descriptor.rva, "lookup": descriptor.lookup_rva, "name": descriptor.name_rva, "iat": descriptor.iat_rva, "dll": descriptor.dll},
    }
    exe = load_macho("ledger_main")
    stub = next(s for s in exe.stubs() if s.symbol == "_puts")
    main_start = exe.base_address + (exe.entryoff or 0)
    text_section = exe.text_section()
    code = exe.section_bytes(text_section)
    bl_at = None
    for k in range(0, len(code) - 3, 4):
        address = text_section.addr + k
        if address >= main_start and decode_bl(struct.unpack_from("<I", code, k)[0], address) == stub.address:
            bl_at = address
            break
    assert bl_at is not None
    info = exe.chained_fixups()
    fixup = next(f for f in info["fixups"] if f.address == stub.slot)
    chained_import = info["imports"][fixup.ordinal or 0]
    macho = {
        "file": "ledger_main",
        "symbol": "_puts",
        "call": {"address": bl_at, "bytes": _hexbytes(exe.read(bl_at, 4)), "text": f"bl {_hex(stub.address)}", "target": stub.address},
        "stub": {"label": "__stubs", "address": stub.address, "bytes": _hexbytes(stub.raw), "lines": stub.lines(), "slot": stub.slot},
        "slot": {"label": "__got", "address": stub.slot, "initial": f"0x{fixup.raw:016x}", "initialMeaning": f"0x{fixup.raw:016x} is not an address: bit 63 = bind, next = {fixup.next} (x4 bytes), ordinal = {fixup.ordinal}", "relocation": f"chained import {fixup.ordinal}: {chained_import.name} (from {chained_import.library})", "after": "dyld writes the address of _puts from libSystem here while it walks the chain, before main runs"},
        "imports": [[i.index, i.name, i.library] for i in info["imports"]],
    }
    unstripped = load_macho("static-arm64-O2")
    stripped = load_macho("static-arm64-O2.stripped")
    truth = unstripped.text_functions()
    finder = FunctionFinder(stripped)
    methods = finder.methods()
    signatures = [s for name in ("main-arm64-O2.o", "ledger-arm64-O2.o") for s in signatures_from_object(load_macho(name))]
    matched = match_signatures(signatures, stripped, methods["functionStarts"])
    labels = {"functionStarts": "LC_FUNCTION_STARTS", "prologueSub": "prologue scan: sub sp, sp, #imm", "prologueStp": "prologue scan: stp x29, x30, [sp, #-0x10]!", "callTargets": "bl targets + LC_MAIN entry", "signatures": "signatures from our objects"}
    method_rows = [{"id": name, "label": labels[name], "found": found} for name, found in methods.items()]
    method_rows.append({"id": "signatures", "label": labels["signatures"], "found": [int(a, 16) for a in matched["names"]], "names": matched["names"]})
    return {
        "elf": elf,
        "pe": pe_data,
        "macho": macho,
        "stripped": {
            "file": "static-arm64-O2.stripped",
            "textStart": stripped.text_section().addr,
            "textEnd": stripped.text_section().addr + stripped.text_section().size,
            "truth": [{"name": n, "start": s, "end": e} for n, s, e in truth],
            "methods": method_rows,
            "collisions": matched["collisions"],
        },
    }


def main(argv: list[str]) -> int:
    if not argv:
        print(json.dumps(demo(), indent=2))
        return 0
    command = argv[0]
    if command == "figure-data":
        print(json.dumps(figure_data(), separators=(",", ":")))
        return 0
    if len(argv) == 2 and command in ("elf", "coff", "pe", "macho"):
        data = Path(argv[1]).read_bytes()
        readers = {"elf": lambda d: elf_report(ElfFile(d)), "coff": lambda d: coff_report(CoffObject(d)), "pe": lambda d: pe_report(PeImage(d)), "macho": lambda d: macho_report(MachoFile(d))}
        print(json.dumps(readers[command](data), indent=2))
        return 0
    if command == "plan" and len(argv) >= 2:
        print(json.dumps(plan_dynamic_link({Path(p).name: ElfFile(Path(p).read_bytes()) for p in argv[1:]}), indent=2))
        return 0
    if command == "functions" and len(argv) in (3, 4, 5):
        stripped = MachoFile(Path(argv[1]).read_bytes())
        unstripped = MachoFile(Path(argv[2]).read_bytes())
        objects = [MachoFile(Path(p).read_bytes()) for p in argv[3:]]
        print(json.dumps(identification_report(unstripped, stripped, objects), indent=2))
        return 0
    print("usage: main.py [elf FILE | coff FILE | pe FILE | macho FILE | plan OBJECT... | functions STRIPPED UNSTRIPPED [OBJECT...] | figure-data]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
