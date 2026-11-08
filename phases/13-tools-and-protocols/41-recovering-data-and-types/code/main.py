"""Companion code for docs/en.md: recover struct layouts from memory accesses and check them against DWARF 5.
Layout rules: System V AMD64 psABI section 3.1.2 (alignment of members, size a multiple of alignment).
Addressing: Intel SDM Volume 1 section 3.7.5 (offset = base + index * scale + displacement).
Debug info: DWARF 5 sections 2.1 (DIEs), 5.7.6 (data member entries), 7.5.1.1 (unit header), 7.5.3 (abbreviations).
C++ objects: Itanium C++ ABI sections 2.5 (vtable layout), 2.9 (RTTI), 5.1 (mangling).
Run `python3 main.py` for the demo or `python3 -m unittest discover -s tests -v` for the suite.
"""

from __future__ import annotations

import ctypes
import json
import math
import re
import struct
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"

SHT_SYMTAB = 2
SHT_RELA = 4
SHT_NOBITS = 8
STT_OBJECT = 1
STT_FUNC = 2
STT_SECTION = 3
EM_X86_64 = 62
R_X86_64_64 = 1
R_X86_64_PC32 = 2
R_X86_64_PLT32 = 4
R_X86_64_32 = 10
R_X86_64_32S = 11


class ElfError(ValueError):
    pass


@dataclass(frozen=True)
class Section:
    index: int
    name: str
    type: int
    offset: int
    size: int
    link: int
    info: int
    data: bytes


@dataclass(frozen=True)
class Symbol:
    name: str
    value: int
    size: int
    type: int
    bind: int
    shndx: int
    section: str


@dataclass(frozen=True)
class Relocation:
    section: str
    offset: int
    type: int
    symbol: Symbol
    addend: int

    @property
    def symbol_name(self) -> str:
        return self.symbol.section if self.symbol.type == STT_SECTION else self.symbol.name


class ElfObject:
    """Sections, symbols, and RELA relocations of an ELF64 little-endian x86-64 relocatable object."""

    def __init__(self, data: bytes) -> None:
        if data[:4] != b"\x7fELF":
            raise ElfError("not an ELF file")
        if data[4] != 2 or data[5] != 1:
            raise ElfError("only ELF64 little-endian objects are supported")
        header = struct.unpack_from("<16sHHIQQQIHHHHHH", data, 0)
        if header[2] != EM_X86_64:
            raise ElfError(f"e_machine {header[2]} is not x86-64")
        shoff, shentsize, shnum, shstrndx = header[6], header[11], header[12], header[13]
        raw = [struct.unpack_from("<IIQQQQIIQQ", data, shoff + i * shentsize) for i in range(shnum)]
        names = raw[shstrndx]
        name_table = data[names[4] : names[4] + names[5]]
        self.sections: list[Section] = []
        for index, entry in enumerate(raw):
            sh_name, sh_type, _flags, _addr, sh_offset, sh_size, sh_link, sh_info, _align, _entsize = entry
            payload = b"" if sh_type == SHT_NOBITS else data[sh_offset : sh_offset + sh_size]
            self.sections.append(Section(index, _cstring(name_table, sh_name), sh_type, sh_offset, sh_size, sh_link, sh_info, payload))
        self.symbols = self._read_symbols()
        self.relocations = self._read_relocations()

    def _read_symbols(self) -> list[Symbol]:
        symbols: list[Symbol] = []
        for section in self.sections:
            if section.type != SHT_SYMTAB:
                continue
            strings = self.sections[section.link].data
            for offset in range(0, section.size, 24):
                st_name, st_info, _other, st_shndx, st_value, st_size = struct.unpack_from("<IBBHQQ", section.data, offset)
                section_name = self.sections[st_shndx].name if st_shndx < len(self.sections) else ""
                symbols.append(Symbol(_cstring(strings, st_name), st_value, st_size, st_info & 0xF, st_info >> 4, st_shndx, section_name))
        return symbols

    def _read_relocations(self) -> dict[str, list[Relocation]]:
        table: dict[str, list[Relocation]] = {}
        for section in self.sections:
            if section.type != SHT_RELA:
                continue
            target = self.sections[section.info].name
            for offset in range(0, section.size, 24):
                r_offset, r_info, r_addend = struct.unpack_from("<QQq", section.data, offset)
                symbol = self.symbols[r_info >> 32]
                table.setdefault(target, []).append(Relocation(target, r_offset, r_info & 0xFFFFFFFF, symbol, r_addend))
        return table

    def has_section(self, name: str) -> bool:
        return any(s.name == name for s in self.sections)

    def section(self, name: str) -> Section:
        for section in self.sections:
            if section.name == name:
                return section
        raise ElfError(f"no section named {name}")

    def symbol(self, name: str) -> Symbol:
        for symbol in self.symbols:
            if symbol.name == name:
                return symbol
        raise ElfError(f"no symbol named {name}")

    def symbol_names(self) -> list[str]:
        return sorted({s.name for s in self.symbols if s.name and s.type != STT_SECTION})

    def functions(self, section: str = ".text") -> list[Symbol]:
        return sorted([s for s in self.symbols if s.type == STT_FUNC and s.section == section], key=lambda s: s.value)

    def relocated(self, name: str) -> bytes:
        """The section bytes after R_X86_64_32, 32S, and 64 relocations are applied as S + A.
        Section symbols in a relocatable object have value 0, so the field receives the addend."""
        data = bytearray(self.section(name).data)
        for relocation in self.relocations.get(name, []):
            base = 0 if relocation.symbol.type == STT_SECTION else relocation.symbol.value
            value = base + relocation.addend
            if relocation.type in (R_X86_64_32, R_X86_64_32S):
                struct.pack_into("<I", data, relocation.offset, value & 0xFFFFFFFF)
            elif relocation.type == R_X86_64_64:
                struct.pack_into("<Q", data, relocation.offset, value & 0xFFFFFFFFFFFFFFFF)
        return bytes(data)


def _cstring(table: bytes, offset: int) -> str:
    end = table.find(b"\0", offset)
    return table[offset : end if end >= 0 else len(table)].decode("utf-8", "replace")


def load_object(name: str) -> ElfObject:
    return ElfObject((FIXTURES / name).read_bytes())


DW_TAG = {
    0x01: "array_type", 0x02: "class_type", 0x04: "enumeration_type", 0x05: "formal_parameter", 0x0B: "lexical_block",
    0x0D: "member", 0x0F: "pointer_type", 0x10: "reference_type", 0x11: "compile_unit", 0x13: "structure_type",
    0x15: "subroutine_type", 0x16: "typedef", 0x17: "union_type", 0x18: "unspecified_parameters", 0x1C: "inheritance",
    0x21: "subrange_type", 0x24: "base_type", 0x26: "const_type", 0x2E: "subprogram", 0x34: "variable",
    0x35: "volatile_type", 0x42: "rvalue_reference_type",
}
DW_AT = {
    0x01: "sibling", 0x02: "location", 0x03: "name", 0x0B: "byte_size", 0x10: "stmt_list", 0x11: "low_pc", 0x12: "high_pc",
    0x13: "language", 0x1B: "comp_dir", 0x1C: "const_value", 0x1D: "containing_type", 0x25: "producer", 0x27: "prototyped",
    0x2F: "upper_bound", 0x32: "accessibility", 0x34: "artificial", 0x36: "calling_convention", 0x37: "count",
    0x38: "data_member_location", 0x3A: "decl_file", 0x3B: "decl_line", 0x3C: "declaration", 0x3E: "encoding",
    0x3F: "external", 0x40: "frame_base", 0x47: "specification", 0x49: "type", 0x4C: "virtuality", 0x4D: "vtable_elem_location",
    0x63: "explicit", 0x64: "object_pointer", 0x6E: "linkage_name", 0x72: "str_offsets_base", 0x73: "addr_base",
    0x87: "noreturn", 0x88: "alignment", 0x8A: "deleted", 0x8B: "defaulted", 0x89: "export_symbols",
}
DW_FORM_NAMES = {
    0x01: "addr", 0x03: "block2", 0x04: "block4", 0x05: "data2", 0x06: "data4", 0x07: "data8", 0x08: "string", 0x09: "block",
    0x0A: "block1", 0x0B: "data1", 0x0C: "flag", 0x0D: "sdata", 0x0E: "strp", 0x0F: "udata", 0x10: "ref_addr", 0x11: "ref1",
    0x12: "ref2", 0x13: "ref4", 0x14: "ref8", 0x15: "ref_udata", 0x17: "sec_offset", 0x18: "exprloc", 0x19: "flag_present",
    0x1A: "strx", 0x1B: "addrx", 0x1E: "data16", 0x1F: "line_strp", 0x20: "ref_sig8", 0x21: "implicit_const", 0x22: "loclistx",
    0x23: "rnglistx", 0x25: "strx1", 0x26: "strx2", 0x27: "strx3", 0x28: "strx4", 0x29: "addrx1", 0x2A: "addrx2", 0x2B: "addrx3",
    0x2C: "addrx4",
}
DW_ATE = {0x01: "address", 0x02: "boolean", 0x04: "float", 0x05: "signed", 0x06: "signed_char", 0x07: "unsigned", 0x08: "unsigned_char", 0x10: "UTF"}
DW_UT = {0x01: "compile", 0x02: "type", 0x03: "partial", 0x04: "skeleton", 0x05: "split_compile", 0x06: "split_type"}
DW_OP_CONSTU = 0x10
DW_OP_FBREG = 0x91
DW_OP_ADDRX = 0xA1
DW_OP_REG0 = 0x50
DW_OP_REG_NAMES = ["RAX", "RDX", "RCX", "RBX", "RSI", "RDI", "RBP", "RSP"] + [f"R{i}" for i in range(8, 16)]
DW_VIRTUALITY = {1: "virtual", 2: "pure_virtual"}


class DwarfError(ValueError):
    pass


def read_uleb(data: bytes, pos: int) -> tuple[int, int]:
    result = 0
    shift = 0
    while True:
        byte = data[pos]
        pos += 1
        result |= (byte & 0x7F) << shift
        shift += 7
        if not byte & 0x80:
            return result, pos


def read_sleb(data: bytes, pos: int) -> tuple[int, int]:
    result = 0
    shift = 0
    while True:
        byte = data[pos]
        pos += 1
        result |= (byte & 0x7F) << shift
        shift += 7
        if not byte & 0x80:
            if byte & 0x40:
                result -= 1 << shift
            return result, pos


@dataclass(frozen=True)
class Abbreviation:
    code: int
    tag: int
    has_children: bool
    attributes: tuple[tuple[int, int, int | None], ...]


def parse_abbreviations(data: bytes, offset: int = 0) -> dict[int, Abbreviation]:
    """DWARF 5 section 7.5.3: code, tag, children flag, then (attribute, form[, implicit const]) pairs until (0, 0)."""
    table: dict[int, Abbreviation] = {}
    pos = offset
    while pos < len(data):
        code, pos = read_uleb(data, pos)
        if code == 0:
            break
        tag, pos = read_uleb(data, pos)
        has_children = data[pos] == 1
        pos += 1
        attributes: list[tuple[int, int, int | None]] = []
        while True:
            attribute, pos = read_uleb(data, pos)
            form, pos = read_uleb(data, pos)
            implicit = None
            if form == 0x21:
                implicit, pos = read_sleb(data, pos)
            if attribute == 0 and form == 0:
                break
            attributes.append((attribute, form, implicit))
        table[code] = Abbreviation(code, tag, has_children, tuple(attributes))
    return table


@dataclass
class Die:
    offset: int
    tag: int
    attributes: dict[int, Any]
    forms: dict[int, int]
    children: list["Die"] = field(default_factory=list)
    parent: "Die | None" = None

    @property
    def tag_name(self) -> str:
        return DW_TAG.get(self.tag, f"tag_{self.tag:#x}")

    def get(self, name: str, default: Any = None) -> Any:
        for number, attribute_name in DW_AT.items():
            if attribute_name == name:
                return self.attributes.get(number, default)
        return default

    @property
    def name(self) -> str | None:
        return self.get("name")


@dataclass(frozen=True)
class UnitHeader:
    offset: int
    length: int
    version: int
    unit_type: int
    address_size: int
    abbrev_offset: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "unitLength": self.length,
            "version": self.version,
            "unitType": "DW_UT_" + DW_UT.get(self.unit_type, f"{self.unit_type:#x}"),
            "addressSize": self.address_size,
            "abbrevOffset": self.abbrev_offset,
        }


@dataclass(frozen=True)
class Member:
    name: str
    offset: int
    type: str
    size: int
    kind: str
    sign: str | None

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "offset": self.offset, "type": self.type, "size": self.size, "kind": self.kind, "sign": self.sign}


@dataclass(frozen=True)
class VirtualMethod:
    name: str
    linkage_name: str | None
    slot: int
    virtuality: str


@dataclass(frozen=True)
class StructLayout:
    name: str
    size: int
    members: tuple[Member, ...]
    bases: tuple[tuple[str, int], ...] = ()
    virtual_methods: tuple[VirtualMethod, ...] = ()
    decl_line: int | None = None

    @property
    def align(self) -> int:
        return max([natural_alignment(m.size) for m in self.members] + [8 for _b in self.bases], default=1)

    def padding(self) -> list[int]:
        covered = {b for m in self.members for b in range(m.offset, m.offset + m.size)}
        return [b for b in range(self.size) if b not in covered]

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "size": self.size,
            "align": self.align,
            "members": [m.to_dict() for m in self.members],
            "padding": self.padding(),
            "bases": [{"type": t, "offset": o} for t, o in self.bases],
            "virtualMethods": [{"name": v.name, "linkageName": v.linkage_name, "slot": v.slot, "virtuality": v.virtuality} for v in self.virtual_methods],
        }


def natural_alignment(size: int) -> int:
    return size if size in (1, 2, 4, 8, 16) else 8


@dataclass(frozen=True)
class Parameter:
    name: str
    type: str
    location: str


@dataclass(frozen=True)
class FunctionInfo:
    name: str
    low_pc: int
    high_pc: int
    frame_base: str
    parameters: tuple[Parameter, ...]
    return_type: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "range": f"{self.low_pc:#x}-{self.high_pc:#x}",
            "frameBase": self.frame_base,
            "returnType": self.return_type,
            "parameters": [{"name": p.name, "type": p.type, "location": p.location} for p in self.parameters],
        }


class DwarfInfo:
    """A DWARF 5 reader for one relocatable object: .debug_abbrev, .debug_info, .debug_str, .debug_str_offsets, .debug_addr."""

    def __init__(self, elf: ElfObject) -> None:
        self.elf = elf
        if not elf.has_section(".debug_info"):
            raise DwarfError("the object has no .debug_info section")
        self.info = elf.relocated(".debug_info")
        self.abbrev = elf.relocated(".debug_abbrev")
        self.strings = elf.section(".debug_str").data
        self.line_strings = elf.section(".debug_line_str").data if elf.has_section(".debug_line_str") else b""
        self.str_offsets = elf.relocated(".debug_str_offsets") if elf.has_section(".debug_str_offsets") else b""
        self.addrs = elf.relocated(".debug_addr") if elf.has_section(".debug_addr") else b""
        self.units: list[tuple[UnitHeader, Die]] = []
        self.dies: dict[int, Die] = {}
        pos = 0
        while pos < len(self.info):
            header, root, pos = self._parse_unit(pos)
            self.units.append((header, root))

    def _parse_unit(self, start: int) -> tuple[UnitHeader, Die, int]:
        """DWARF 5 section 7.5.1.1: unit_length, version, unit_type, address_size, debug_abbrev_offset."""
        length = struct.unpack_from("<I", self.info, start)[0]
        if length == 0xFFFFFFFF:
            raise DwarfError("64-bit DWARF is not supported by this reader")
        version, unit_type, address_size, abbrev_offset = struct.unpack_from("<HBBI", self.info, start + 4)
        if version != 5:
            raise DwarfError(f"DWARF version {version} is not 5")
        header = UnitHeader(start, length, version, unit_type, address_size, abbrev_offset)
        abbreviations = parse_abbreviations(self.abbrev, abbrev_offset)
        end = start + 4 + length
        pos = start + 12
        root: Die | None = None
        stack: list[Die] = []
        raw: list[Die] = []
        while pos < end:
            die_offset = pos
            code, pos = read_uleb(self.info, pos)
            if code == 0:
                if stack:
                    stack.pop()
                continue
            abbreviation = abbreviations[code]
            attributes: dict[int, Any] = {}
            forms: dict[int, int] = {}
            for attribute, form, implicit in abbreviation.attributes:
                value, pos = self._read_form(form, pos, address_size, start, implicit)
                attributes[attribute] = value
                forms[attribute] = form
            die = Die(die_offset, abbreviation.tag, attributes, forms, parent=stack[-1] if stack else None)
            if stack:
                stack[-1].children.append(die)
            raw.append(die)
            self.dies[die_offset] = die
            if root is None:
                root = die
            if abbreviation.has_children:
                stack.append(die)
        if root is None:
            raise DwarfError("empty compilation unit")
        str_base = root.attributes.get(0x72, 8)
        addr_base = root.attributes.get(0x73, 8)
        for die in raw:
            for attribute, form in die.forms.items():
                if form in (0x1A, 0x25, 0x26, 0x27, 0x28):
                    index = die.attributes[attribute]
                    offset = struct.unpack_from("<I", self.str_offsets, str_base + 4 * index)[0]
                    die.attributes[attribute] = _cstring(self.strings, offset)
                elif form in (0x1B, 0x29, 0x2A, 0x2B, 0x2C):
                    index = die.attributes[attribute]
                    die.attributes[attribute] = struct.unpack_from("<Q", self.addrs, addr_base + 8 * index)[0]
        return header, root, end

    def _read_form(self, form: int, pos: int, address_size: int, unit_start: int, implicit: int | None) -> tuple[Any, int]:
        data = self.info
        if form == 0x01:
            return struct.unpack_from("<Q" if address_size == 8 else "<I", data, pos)[0], pos + address_size
        if form in (0x0B, 0x11, 0x0C, 0x25, 0x29):
            return data[pos], pos + 1
        if form in (0x05, 0x12, 0x26, 0x2A):
            return struct.unpack_from("<H", data, pos)[0], pos + 2
        if form in (0x27, 0x2B):
            return int.from_bytes(data[pos : pos + 3], "little"), pos + 3
        if form in (0x06, 0x0E, 0x1F, 0x17, 0x28, 0x2C):
            return struct.unpack_from("<I", data, pos)[0], pos + 4
        if form == 0x13:
            return unit_start + struct.unpack_from("<I", data, pos)[0], pos + 4
        if form in (0x07, 0x14, 0x20):
            return struct.unpack_from("<Q", data, pos)[0], pos + 8
        if form == 0x1E:
            return data[pos : pos + 16], pos + 16
        if form == 0x08:
            end = data.index(b"\0", pos)
            return data[pos:end].decode("utf-8", "replace"), end + 1
        if form in (0x0F, 0x1A, 0x1B, 0x22, 0x23):
            return read_uleb(data, pos)
        if form == 0x15:
            value, pos = read_uleb(data, pos)
            return unit_start + value, pos
        if form == 0x0D:
            return read_sleb(data, pos)
        if form in (0x18, 0x09):
            length, pos = read_uleb(data, pos)
            return data[pos : pos + length], pos + length
        if form == 0x0A:
            length = data[pos]
            return data[pos + 1 : pos + 1 + length], pos + 1 + length
        if form == 0x03:
            length = struct.unpack_from("<H", data, pos)[0]
            return data[pos + 2 : pos + 2 + length], pos + 2 + length
        if form == 0x04:
            length = struct.unpack_from("<I", data, pos)[0]
            return data[pos + 4 : pos + 4 + length], pos + 4 + length
        if form == 0x19:
            return True, pos
        if form == 0x21:
            return implicit, pos
        if form == 0x10:
            return struct.unpack_from("<I", data, pos)[0], pos + 4
        raise DwarfError(f"form {DW_FORM_NAMES.get(form, hex(form))} is not supported by this reader")

    def root(self) -> Die:
        return self.units[0][1]

    def header(self) -> UnitHeader:
        return self.units[0][0]

    def walk(self, die: Die | None = None):
        start = die or self.root()
        yield start
        for child in start.children:
            yield from self.walk(child)

    def find(self, tag_name: str, name: str | None = None) -> list[Die]:
        return [d for d in self.walk() if d.tag_name == tag_name and (name is None or d.name == name)]

    def type_of(self, die: Die) -> Die | None:
        reference = die.get("type")
        return self.dies.get(reference) if reference is not None else None

    def type_name(self, die: Die | None) -> str:
        if die is None:
            return "void"
        tag = die.tag_name
        if tag in ("base_type", "structure_type", "class_type", "union_type", "enumeration_type", "typedef"):
            return die.name or f"anonymous {tag}"
        if tag == "pointer_type":
            inner = self.type_of(die)
            if inner is not None and inner.tag_name == "subroutine_type":
                return self._subroutine_name(inner, "*")
            if inner is not None and inner.tag_name == "pointer_type" and self.type_of(inner) is not None and self.type_of(inner).tag_name == "subroutine_type":
                return self._subroutine_name(self.type_of(inner), "**")
            return self.type_name(inner) + " *"
        if tag == "reference_type":
            return self.type_name(self.type_of(die)) + " &"
        if tag == "rvalue_reference_type":
            return self.type_name(self.type_of(die)) + " &&"
        if tag == "const_type":
            return "const " + self.type_name(self.type_of(die))
        if tag == "volatile_type":
            return "volatile " + self.type_name(self.type_of(die))
        if tag == "array_type":
            counts = [c.get("count") for c in die.children if c.tag_name == "subrange_type"]
            suffix = "".join(f"[{c}]" if c is not None else "[]" for c in counts)
            return self.type_name(self.type_of(die)) + suffix
        if tag == "subroutine_type":
            return self._subroutine_name(die, "")
        return tag

    def _subroutine_name(self, die: Die, stars: str) -> str:
        params = [self.type_name(self.type_of(c)) for c in die.children if c.tag_name == "formal_parameter"]
        inner = f"({stars})" if stars else ""
        return f"{self.type_name(self.type_of(die))} {inner}({', '.join(params)})"

    def type_size(self, die: Die | None) -> int:
        if die is None:
            return 0
        tag = die.tag_name
        if die.get("byte_size") is not None and tag not in ("pointer_type",):
            return int(die.get("byte_size"))
        if tag in ("pointer_type", "reference_type", "rvalue_reference_type"):
            return self.header().address_size
        if tag in ("const_type", "volatile_type", "typedef"):
            return self.type_size(self.type_of(die))
        if tag == "array_type":
            count = 1
            for child in die.children:
                if child.tag_name == "subrange_type":
                    count *= int(child.get("count") or (int(child.get("upper_bound")) + 1 if child.get("upper_bound") is not None else 0))
            return count * self.type_size(self.type_of(die))
        return 0

    def type_kind(self, die: Die | None) -> tuple[str, str | None]:
        """A coarse class for comparison with recovered fields: int, float, pointer, struct, or array, with sign for ints."""
        if die is None:
            return "void", None
        tag = die.tag_name
        if tag in ("const_type", "volatile_type", "typedef"):
            return self.type_kind(self.type_of(die))
        if tag in ("pointer_type", "reference_type", "rvalue_reference_type"):
            return "pointer", None
        if tag == "base_type":
            encoding = DW_ATE.get(int(die.get("encoding") or 0), "unknown")
            if encoding == "float":
                return "float", None
            if encoding in ("signed", "signed_char"):
                return "int", "signed"
            if encoding in ("unsigned", "unsigned_char", "boolean", "UTF"):
                return "int", "unsigned"
            return "int", None
        if tag in ("structure_type", "class_type", "union_type"):
            return "struct", None
        if tag == "array_type":
            return "array", None
        if tag == "enumeration_type":
            return "int", None
        return tag, None

    def struct_layouts(self) -> list[StructLayout]:
        layouts: list[StructLayout] = []
        for die in self.walk():
            if die.tag_name not in ("structure_type", "class_type") or die.get("declaration"):
                continue
            members: list[Member] = []
            bases: list[tuple[str, int]] = []
            methods: list[VirtualMethod] = []
            for child in die.children:
                if child.tag_name == "member":
                    kind, sign = self.type_kind(self.type_of(child))
                    members.append(Member(child.name or "", int(child.get("data_member_location") or 0), self.type_name(self.type_of(child)), self.type_size(self.type_of(child)), kind, sign))
                elif child.tag_name == "inheritance":
                    bases.append((self.type_name(self.type_of(child)), int(child.get("data_member_location") or 0)))
                elif child.tag_name == "subprogram" and child.get("vtable_elem_location") is not None:
                    methods.append(VirtualMethod(child.name or "", child.get("linkage_name"), decode_constu(child.get("vtable_elem_location")), DW_VIRTUALITY.get(int(child.get("virtuality") or 0), "none")))
            layouts.append(StructLayout(die.name or "", int(die.get("byte_size") or 0), tuple(members), tuple(bases), tuple(methods), die.get("decl_line")))
        return layouts

    def struct(self, name: str) -> StructLayout:
        for layout in self.struct_layouts():
            if layout.name == name:
                return layout
        raise DwarfError(f"no structure type named {name}")

    def functions(self) -> list[FunctionInfo]:
        found: list[FunctionInfo] = []
        for die in self.find("subprogram"):
            low = die.get("low_pc")
            if low is None:
                continue
            high_raw = die.get("high_pc")
            high = low + high_raw if die.forms.get(0x12) in (0x05, 0x06, 0x07, 0x0B, 0x0F) else high_raw
            params = tuple(
                Parameter(c.name or "", self.type_name(self.type_of(c)), decode_location(c.get("location") or b""))
                for c in die.children
                if c.tag_name == "formal_parameter"
            )
            specification = self.dies.get(die.get("specification")) if die.get("specification") is not None else None
            declared = specification or die
            found.append(FunctionInfo(declared.name or declared.get("linkage_name") or "", low, high, decode_location(die.get("frame_base") or b""), params, self.type_name(self.type_of(declared))))
        return sorted(found, key=lambda f: f.low_pc)


def decode_constu(expression: bytes) -> int:
    if not expression or expression[0] != DW_OP_CONSTU:
        raise DwarfError("vtable_elem_location is not DW_OP_constu")
    return read_uleb(expression, 1)[0]


def decode_location(expression: bytes) -> str:
    """The three expression forms clang emits for this lesson: DW_OP_fbreg N, DW_OP_addrx N, DW_OP_regN."""
    if not expression:
        return ""
    op = expression[0]
    if op == DW_OP_FBREG:
        return f"DW_OP_fbreg {read_sleb(expression, 1)[0]}"
    if op == DW_OP_ADDRX:
        return f"DW_OP_addrx {read_uleb(expression, 1)[0]:#x}"
    if DW_OP_REG0 <= op < DW_OP_REG0 + 16:
        return f"DW_OP_reg{op - DW_OP_REG0} {DW_OP_REG_NAMES[op - DW_OP_REG0]}"
    return "DW_OP_" + expression.hex()


REGISTER_PARENT: dict[str, str] = {}
for _n, _names in enumerate(zip(
    ["rax", "rcx", "rdx", "rbx", "rsp", "rbp", "rsi", "rdi"] + [f"r{i}" for i in range(8, 16)],
    ["eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi"] + [f"r{i}d" for i in range(8, 16)],
    ["ax", "cx", "dx", "bx", "sp", "bp", "si", "di"] + [f"r{i}w" for i in range(8, 16)],
    ["al", "cl", "dl", "bl", "spl", "bpl", "sil", "dil"] + [f"r{i}b" for i in range(8, 16)],
)):
    for _name in _names:
        REGISTER_PARENT[_name] = _names[0]
for _name in ("ah", "ch", "dh", "bh"):
    REGISTER_PARENT[_name] = "r" + _name[0] + "x"
ARGUMENT_REGISTERS = ["rdi", "rsi", "rdx", "rcx", "r8", "r9"]
CALLER_SAVED = {"rax", "rcx", "rdx", "rsi", "rdi", "r8", "r9", "r10", "r11"}
FRAME_REGISTERS = {"rbp", "rsp"}

FLOAT_SCALAR = {"movsd", "addsd", "subsd", "mulsd", "divsd", "ucomisd", "comisd", "sqrtsd", "minsd", "maxsd", "cvtsd2ss", "cvtsd2si"}
FLOAT_SCALAR32 = {"movss", "addss", "subss", "mulss", "divss", "ucomiss", "comiss", "sqrtss", "cvtss2sd", "cvtss2si"}
VECTOR16 = {"movaps", "movups", "movapd", "movupd", "movdqa", "movdqu", "paddd", "pxor", "pand", "por", "psubd"}
INDIRECT_FLOW = {"callq", "jmpq"}


@dataclass(frozen=True)
class MemoryOperand:
    displacement: int
    base: str | None
    index: str | None
    scale: int
    rip_relative: bool

    @property
    def is_frame_slot(self) -> bool:
        return self.base in FRAME_REGISTERS and self.index is None

    def render(self) -> str:
        if self.rip_relative:
            return f"{format_signed(self.displacement)}(%rip)" if self.displacement else "(%rip)"
        inner = "%" + self.base if self.base else ""
        if self.index:
            inner += ",%" + self.index + (f",{self.scale}" if self.scale != 1 else "")
        text = format_signed(self.displacement) if self.displacement or not self.base else ""
        return f"{text}({inner})"


MEMORY_RE = re.compile(r"^(?:%[a-z]{2}:)?(?P<disp>-?0x[0-9a-f]+|-?\d+)?\((?P<base>%[a-z0-9]+)?(?:,(?P<index>%[a-z0-9]+)(?:,(?P<scale>[1248]))?)?\)$")


def format_signed(value: int) -> str:
    return f"-0x{-value:x}" if value < 0 else f"0x{value:x}"


def parse_memory(operand: str) -> MemoryOperand | None:
    match = MEMORY_RE.match(operand.strip())
    if match is None:
        return None
    disp = int(match.group("disp"), 0) if match.group("disp") else 0
    base = match.group("base")[1:] if match.group("base") else None
    index = match.group("index")[1:] if match.group("index") else None
    scale = int(match.group("scale") or 1)
    return MemoryOperand(disp, None if base == "rip" else base, index, scale, base == "rip")


@dataclass(frozen=True)
class Instruction:
    address: int
    raw: str
    mnemonic: str
    operands: tuple[str, ...]
    target: int | None
    callee: str | None
    relocation: str | None

    @property
    def text(self) -> str:
        return self.mnemonic + ("\t" + ", ".join(self.operands) if self.operands else "")

    @property
    def length(self) -> int:
        return len(self.raw.split())

    @property
    def flow(self) -> str:
        if self.mnemonic in ("retq", "ret"):
            return "return"
        if self.mnemonic in ("jmp", "jmpq") and self.target is not None:
            return "jump"
        if self.mnemonic.startswith("j") and self.target is not None:
            return "branch"
        if self.mnemonic in ("callq", "call") and self.target is not None:
            return "call"
        if self.operands and self.operands[0].startswith("*"):
            return "indirect-call" if self.mnemonic.startswith("call") else "indirect-jump"
        return "next"

    def memory_operands(self) -> list[tuple[int, MemoryOperand]]:
        found: list[tuple[int, MemoryOperand]] = []
        for position, operand in enumerate(self.operands):
            memory = parse_memory(operand[1:] if operand.startswith("*") else operand)
            if memory is not None:
                found.append((position, memory))
        return found


INSTRUCTION_RE = re.compile(r"^\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} ?)+)\s*\t(\S+)(?:\t(.*))?$")
HEADER_RE = re.compile(r"^([0-9a-f]{16}) <([^>]+)>:$")
RELOCATION_RE = re.compile(r"^\s+([0-9a-f]+):\s+(R_X86_64_\w+)\t(\S+)")
TARGET_RE = re.compile(r"^(0x[0-9a-f]+)(?: <[^>]*>)?$")


def split_operands(text: str) -> tuple[str, ...]:
    parts: list[str] = []
    depth = 0
    current = ""
    for char in text:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        if char == "," and depth == 0:
            parts.append(current.strip())
            current = ""
        else:
            current += char
    if current.strip():
        parts.append(current.strip())
    return tuple(parts)


def parse_listing(text: str) -> dict[str, list[Instruction]]:
    """Instructions per function from `llvm-objdump -d -r`. Relocation lines attach to the instruction above them."""
    functions: dict[str, list[Instruction]] = {}
    current: str | None = None
    for line in text.splitlines():
        header = HEADER_RE.match(line)
        if header:
            current = header.group(2)
            functions[current] = []
            continue
        relocation = RELOCATION_RE.match(line)
        if relocation and current and functions[current]:
            last = functions[current][-1]
            symbol = relocation.group(3).split("-")[0].split("+")[0]
            callee = symbol if last.flow == "call" and relocation.group(2) == "R_X86_64_PLT32" else last.callee
            functions[current][-1] = Instruction(last.address, last.raw, last.mnemonic, last.operands, last.target, callee, f"{relocation.group(2)} {relocation.group(3)}")
            continue
        match = INSTRUCTION_RE.match(line)
        if not match or current is None:
            continue
        address = int(match.group(1), 16)
        raw = " ".join(match.group(2).split())
        mnemonic = match.group(3)
        operand_text = (match.group(4) or "").split("#", 1)[0].strip()
        operands = split_operands(operand_text) if operand_text else ()
        target = None
        if operands and (mnemonic.startswith("j") or mnemonic.startswith("call")):
            found = TARGET_RE.match(operands[0])
            if found:
                target = int(found.group(1), 16)
                operands = (found.group(1),)
        functions[current].append(Instruction(address, raw, mnemonic, operands, target, None, None))
    return functions


def load_listing(name: str) -> dict[str, list[Instruction]]:
    return parse_listing((FIXTURES / name).read_text())


def access_width(mnemonic: str, operand_position: int, operand_count: int) -> tuple[int, str, str | None] | None:
    """(width in bytes, kind, sign) of the memory operand, or None when the instruction does not access memory."""
    if mnemonic.startswith("nop") or mnemonic in ("leaq", "leal", "lea"):
        return None
    if mnemonic in ("callq", "jmpq") and operand_count == 1:
        return 8, "code", None
    if mnemonic in FLOAT_SCALAR:
        return 8, "float", None
    if mnemonic in FLOAT_SCALAR32:
        return 4, "float", None
    if mnemonic in VECTOR16:
        return 16, "vector", None
    if mnemonic.startswith("cvtsi2sd") or mnemonic.startswith("cvtsi2ss"):
        return (8 if mnemonic.endswith("q") else 4), "int", "signed"
    if mnemonic in ("movd",):
        return 4, "int", None
    if mnemonic in ("movzbl", "movzbw", "movzbq", "movsbl", "movsbw", "movsbq"):
        return 1, "int", "unsigned" if mnemonic[3] == "z" else "signed"
    if mnemonic in ("movzwl", "movzwq", "movswl", "movswq"):
        return 2, "int", "unsigned" if mnemonic[3] == "z" else "signed"
    if mnemonic in ("movslq",):
        return 4, "int", "signed"
    if mnemonic in ("pushq", "popq"):
        return 8, "int", None
    suffix = mnemonic[-1]
    if suffix == "b":
        return 1, "int", None
    if suffix == "w":
        return 2, "int", None
    if suffix == "l":
        return 4, "int", None
    if suffix == "q":
        return 8, "int", None
    return None


@dataclass(frozen=True)
class Pointer:
    """base pointer plus a constant offset plus unknown multiples of each stride."""

    root: str
    offset: int
    strides: frozenset[int] = frozenset()
    origin: tuple[str, int] | None = None

    def shifted(self, delta: int) -> "Pointer":
        return Pointer(self.root, self.offset + delta, self.strides, self.origin)

    def describe(self) -> str:
        text = self.root + (format_signed(self.offset) if self.offset else "")
        if self.strides:
            text += " + k*" + "/".join(str(s) for s in sorted(self.strides))
        return text


@dataclass(frozen=True)
class Index:
    """an integer of unknown value that is a multiple of scale."""

    scale: int = 1


Unknown = None


@dataclass(frozen=True)
class Access:
    function: str
    address: int
    text: str
    root: str | None
    offset: int
    width: int
    kind: str
    sign: str | None
    store: bool
    base: str | None
    index: str | None
    strides: frozenset[int]

    def to_dict(self) -> dict[str, Any]:
        return {
            "function": self.function,
            "address": self.address,
            "text": " ".join(self.text.split()),
            "root": self.root,
            "offset": self.offset,
            "width": self.width,
            "kind": self.kind,
            "sign": self.sign,
            "store": self.store,
            "base": self.base,
            "index": self.index,
            "strides": sorted(self.strides),
        }


@dataclass(frozen=True)
class Increment:
    function: str
    address: int
    register: str
    delta: int


@dataclass(frozen=True)
class CallSite:
    function: str
    address: int
    callee: str
    arguments: tuple[str | None, ...]

    def to_dict(self) -> dict[str, Any]:
        return {"function": self.function, "address": self.address, "callee": self.callee, "arguments": list(self.arguments)}


@dataclass(frozen=True)
class PointerUse:
    function: str
    address: int
    text: str
    origin: tuple[str, int]


@dataclass
class FunctionTrace:
    name: str
    accesses: list[Access]
    increments: list[Increment]
    loops: list[tuple[int, int]]
    call_sites: list[CallSite]
    pointer_uses: list[PointerUse]
    unattributed: int

    def in_loop(self, first: int, second: int) -> bool:
        return any(start <= first <= end and start <= second <= end for start, end in self.loops)


def _register(operand: str) -> str | None:
    if operand.startswith("%") and operand[1:] in REGISTER_PARENT:
        return REGISTER_PARENT[operand[1:]]
    return None


def _is_64bit_register(operand: str) -> bool:
    return operand.startswith("%") and operand[1:] in REGISTER_PARENT and REGISTER_PARENT[operand[1:]] == operand[1:]


def _immediate(operand: str) -> int | None:
    if operand.startswith("$"):
        value = int(operand[1:], 0)
        return value - (1 << 32) if value >= 1 << 31 else value
    return None


def _slot_key(memory: MemoryOperand) -> str:
    return f"{memory.base}{format_signed(memory.displacement) if memory.displacement else ''}"


def trace_function(name: str, instructions: list[Instruction]) -> FunctionTrace:
    """One forward pass over the listing. Registers and frame slots hold a Pointer, an Index, or nothing.
    Every memory operand whose base is a Pointer becomes an Access with the pointer's root and offset."""
    env: dict[str, Any] = {register: Pointer(f"param{position}", 0) for position, register in enumerate(ARGUMENT_REGISTERS)}
    accesses: list[Access] = []
    increments: list[Increment] = []
    call_sites: list[CallSite] = []
    pointer_uses: list[PointerUse] = []
    unattributed = 0
    loops = [(i.target, i.address) for i in instructions if i.flow in ("jump", "branch") and i.target is not None and i.target <= i.address]

    def value_of(operand: str) -> Any:
        register = _register(operand)
        if register is not None:
            return env.get(register) if _is_64bit_register(operand) else Index(1)
        if _immediate(operand) is not None:
            return Index(1)
        memory = parse_memory(operand)
        if memory is not None and memory.is_frame_slot:
            return env.get(_slot_key(memory))
        return Unknown

    def address_of(memory: MemoryOperand) -> Any:
        if memory.rip_relative or memory.base is None:
            return Unknown
        if memory.base in FRAME_REGISTERS:
            return Pointer(f"frame({memory.base}{format_signed(memory.displacement) if memory.displacement else ''})", 0)
        base = env.get(memory.base)
        if not isinstance(base, Pointer):
            return Unknown
        strides = set(base.strides)
        if memory.index is not None:
            index_value = env.get(memory.index)
            strides.add((index_value.scale if isinstance(index_value, Index) else 1) * memory.scale)
        return Pointer(base.root, base.offset + memory.displacement, frozenset(strides), base.origin)

    def write(operand: str, value: Any) -> None:
        register = _register(operand)
        if register is not None:
            env[register] = value if _is_64bit_register(operand) else Index(1)
            return
        memory = parse_memory(operand)
        if memory is not None and memory.is_frame_slot:
            env[_slot_key(memory)] = value

    for instruction in instructions:
        mnemonic = instruction.mnemonic
        operands = instruction.operands
        loaded: dict[int, Any] = {}
        for position, memory in instruction.memory_operands():
            if memory.is_frame_slot and mnemonic not in INDIRECT_FLOW:
                continue
            spec = access_width(mnemonic, position, len(operands))
            if spec is None:
                continue
            width, kind, sign = spec
            pointer = address_of(memory)
            store = position == len(operands) - 1 and len(operands) > 1 and mnemonic not in INDIRECT_FLOW
            if isinstance(pointer, Pointer):
                if pointer.origin is not None:
                    pointer_uses.append(PointerUse(name, instruction.address, instruction.text, pointer.origin))
                accesses.append(Access(name, instruction.address, instruction.text, pointer.root, pointer.offset, width, kind, sign, store, memory.base, memory.index, pointer.strides))
                if not store and width == 8 and kind == "int":
                    loaded[position] = Pointer(f"{pointer.root}->{pointer.offset:#x}", 0, frozenset(), (pointer.root, pointer.offset))
            else:
                unattributed += 1
        if instruction.flow in ("call", "indirect-call"):
            arguments = tuple(env[r].describe() if isinstance(env.get(r), Pointer) else None for r in ARGUMENT_REGISTERS)
            if instruction.callee:
                call_sites.append(CallSite(name, instruction.address, instruction.callee, arguments))
            for register in CALLER_SAVED:
                env[register] = Unknown
            continue
        if not operands:
            continue
        destination = operands[-1]
        if mnemonic in ("leaq",):
            memory = parse_memory(operands[0])
            if memory is not None:
                value = address_of(memory)
                base = env.get(memory.base) if memory.base else None
                if isinstance(base, Pointer) and memory.index is None and _register(destination) == memory.base and memory.displacement:
                    increments.append(Increment(name, instruction.address, memory.base, memory.displacement))
                if isinstance(base, Pointer) and base.origin is not None:
                    pointer_uses.append(PointerUse(name, instruction.address, instruction.text, base.origin))
                write(destination, value)
            continue
        if mnemonic in ("movq", "movl", "movw", "movb", "movabsq", "movslq", "movzbl", "movsbl", "movzwl", "movswl", "movzbq", "movsbq", "movzwq", "movswq"):
            source_value = loaded.get(0, value_of(operands[0])) if mnemonic == "movq" and _is_64bit_register(destination) else (Index(1) if mnemonic != "movq" else value_of(operands[0]))
            if mnemonic == "movq" and _is_64bit_register(destination) and 0 in loaded:
                source_value = loaded[0]
            elif mnemonic == "movq" and parse_memory(operands[0]) is not None and not parse_memory(operands[0]).is_frame_slot:
                source_value = Unknown
            write(destination, source_value)
            continue
        if mnemonic in ("addq", "subq") and len(operands) == 2:
            current = env.get(_register(destination) or "")
            immediate = _immediate(operands[0])
            if immediate is not None:
                delta = immediate if mnemonic == "addq" else -immediate
                if isinstance(current, Pointer):
                    env[_register(destination)] = current.shifted(delta)
                if _register(destination) not in FRAME_REGISTERS:
                    increments.append(Increment(name, instruction.address, _register(destination) or destination, delta))
                continue
            other = value_of(operands[0])
            if mnemonic == "addq":
                env[_register(destination)] = _add(current, other)
            else:
                env[_register(destination)] = Index(1) if isinstance(current, Index) and isinstance(other, Index) else Unknown
            continue
        if mnemonic in ("incq", "decq"):
            current = env.get(_register(destination) or "")
            delta = 1 if mnemonic == "incq" else -1
            if isinstance(current, Pointer):
                env[_register(destination)] = current.shifted(delta)
            increments.append(Increment(name, instruction.address, _register(destination) or destination, delta))
            continue
        if mnemonic in ("shlq", "salq") and len(operands) == 2:
            current = env.get(_register(destination) or "")
            shift = _immediate(operands[0])
            env[_register(destination)] = Index((current.scale if isinstance(current, Index) else 1) << shift) if shift is not None and not isinstance(current, Pointer) else Unknown
            continue
        if mnemonic == "imulq" and len(operands) == 3 and _immediate(operands[0]) is not None:
            source = value_of(operands[1])
            env[_register(destination)] = Index((source.scale if isinstance(source, Index) else 1) * _immediate(operands[0]))
            continue
        if mnemonic in ("xorl", "xorq") and len(operands) == 2 and operands[0] == operands[1]:
            write(destination, Index(1))
            continue
        if _register(destination) is not None and mnemonic not in ("cmpq", "cmpl", "cmpw", "cmpb", "testq", "testl", "testb", "ucomisd", "comisd"):
            if instruction.flow != "next" or mnemonic.startswith("set"):
                continue
            write(destination, Index(1) if not _is_64bit_register(destination) or mnemonic.startswith("cmov") is False else Unknown)
    return FunctionTrace(name, accesses, increments, loops, call_sites, pointer_uses, unattributed)


def _add(first: Any, second: Any) -> Any:
    if isinstance(first, Pointer) and isinstance(second, Index):
        return Pointer(first.root, first.offset, first.strides | {second.scale}, first.origin)
    if isinstance(second, Pointer) and isinstance(first, Index):
        return Pointer(second.root, second.offset, second.strides | {first.scale}, second.origin)
    if isinstance(first, Index) and isinstance(second, Index):
        return Index(math.gcd(first.scale, second.scale))
    return Unknown


@dataclass
class Evidence:
    function: str
    address: int
    text: str
    note: str

    def to_dict(self) -> dict[str, Any]:
        return {"function": self.function, "address": self.address, "text": " ".join(self.text.split()), "note": self.note}


@dataclass
class InferredField:
    offset: int
    size: int
    kinds: set[str]
    signs: set[str]
    evidence: list[Evidence]
    pointer_proof: list[Evidence] = field(default_factory=list)

    @property
    def kind(self) -> str:
        if self.pointer_proof:
            return "pointer"
        if len(self.kinds) == 1:
            return next(iter(self.kinds))
        if self.kinds == {"int", "code"}:
            return "code"
        return "conflict"

    @property
    def sign(self) -> str | None:
        return next(iter(self.signs)) if len(self.signs) == 1 else None

    @property
    def label(self) -> str:
        if self.kind == "pointer":
            return "pointer"
        if self.kind == "float":
            return {4: "float32", 8: "float64"}.get(self.size, f"float{self.size * 8}")
        if self.kind == "int":
            prefix = {"signed": "i", "unsigned": "u"}.get(self.sign or "", "int")
            return f"{prefix}{self.size * 8}"
        return f"{self.kind}{self.size * 8}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "offset": self.offset,
            "size": self.size,
            "kind": self.kind,
            "sign": self.sign,
            "label": self.label,
            "evidence": [e.to_dict() for e in self.evidence],
            "pointerProof": [e.to_dict() for e in self.pointer_proof],
        }


@dataclass
class StrideEvidence:
    value: int
    kind: str
    function: str
    address: int
    text: str

    def to_dict(self) -> dict[str, Any]:
        return {"value": self.value, "kind": self.kind, "function": self.function, "address": self.address, "text": " ".join(self.text.split())}


@dataclass
class InferredLayout:
    root: str
    fields: list[InferredField]
    conflicts: list[dict[str, Any]]
    stride_evidence: list[StrideEvidence]
    aliases: dict[str, int]

    @property
    def stride(self) -> int | None:
        values = [e.value for e in self.stride_evidence]
        return math.gcd(*values) if values else None

    @property
    def size_lower_bound(self) -> int:
        return max((f.offset + f.size for f in self.fields), default=0)

    @property
    def size(self) -> int | None:
        stride = self.stride
        if stride is None:
            return None
        return stride if stride >= self.size_lower_bound else None

    def gaps(self) -> list[int]:
        size = self.size or self.size_lower_bound
        covered = {b for f in self.fields for b in range(f.offset, f.offset + f.size)}
        return [b for b in range(size) if b not in covered]

    def natural_alignment_ok(self) -> bool:
        return all(f.offset % natural_alignment(f.size) == 0 for f in self.fields)

    def to_dict(self) -> dict[str, Any]:
        return {
            "root": self.root,
            "fields": [f.to_dict() for f in sorted(self.fields, key=lambda f: f.offset)],
            "conflicts": self.conflicts,
            "stride": self.stride,
            "strideEvidence": [e.to_dict() for e in self.stride_evidence],
            "sizeLowerBound": self.size_lower_bound,
            "size": self.size,
            "gaps": self.gaps(),
            "naturalAlignment": self.natural_alignment_ok(),
            "aliases": self.aliases,
        }


def infer_layout(traces: list[FunctionTrace], witnesses: list[tuple[str, str]], root_name: str = "struct", fold: bool = True) -> InferredLayout:
    """Merge the accesses of every (function, root) witness into one layout.
    Stride evidence: index scales, 64-bit increments inside a loop that contains the access, offset deltas of
    same-width accesses in one loop, and element offsets at call sites that pass one frame object to the witnesses."""
    by_name = {t.name: t for t in traces}
    fields: dict[tuple[int, int], InferredField] = {}
    stride_evidence: list[StrideEvidence] = []
    witness_set = set(witnesses)
    for function, root in witnesses:
        trace = by_name.get(function)
        if trace is None:
            continue
        mine, loop_evidence = fold_unrolled(trace, [a for a in trace.accesses if a.root == root], fold)
        stride_evidence.extend(loop_evidence)
        for access in mine:
            key = (access.offset, access.width)
            if key not in fields:
                fields[key] = InferredField(access.offset, access.width, set(), set(), [])
            field_entry = fields[key]
            field_entry.kinds.add(access.kind)
            if access.sign:
                field_entry.signs.add(access.sign)
            field_entry.evidence.append(Evidence(function, access.address, access.text, "store" if access.store else "load"))
            for stride in access.strides:
                if stride > 1:
                    stride_evidence.append(StrideEvidence(stride, "scale", function, access.address, access.text))
            for increment in trace.increments:
                if increment.register in (access.base, access.index) and trace.in_loop(increment.address, access.address) and increment.delta:
                    stride_evidence.append(StrideEvidence(abs(increment.delta), "loop-step", function, increment.address, f"{increment.register} += {increment.delta}"))
        for use in trace.pointer_uses:
            if use.origin[0] == root:
                for (offset, width), field_entry in fields.items():
                    if offset == use.origin[1] and width == 8:
                        field_entry.pointer_proof.append(Evidence(function, use.address, use.text, "value used as an address"))
    aliases: dict[str, int] = {}
    for trace in traces:
        for site in trace.call_sites:
            if (site.callee, "param0") in witness_set and site.arguments[0] and site.arguments[0].startswith("frame("):
                offset_text = site.arguments[0][site.arguments[0].index(")") + 1 :]
                aliases[f"{site.callee}@{site.address:#x}"] = int(offset_text, 16) if offset_text else 0
    element_offsets = sorted({o for o in aliases.values() if o})
    for offset in element_offsets:
        stride_evidence.append(StrideEvidence(offset, "call-site", "main", 0, f"argument = frame object + {offset:#x}"))
    conflicts: list[dict[str, Any]] = []
    ordered = sorted(fields.values(), key=lambda f: (f.offset, f.size))
    for first, second in zip(ordered, ordered[1:]):
        if second.offset < first.offset + first.size:
            conflicts.append({"first": {"offset": first.offset, "size": first.size}, "second": {"offset": second.offset, "size": second.size}, "reason": "overlapping accesses of different widths"})
    unique: list[StrideEvidence] = []
    seen: set[tuple[int, str, str, int]] = set()
    for item in stride_evidence:
        key = (item.value, item.kind, item.function, item.address)
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return InferredLayout(root_name, ordered, conflicts, unique, aliases)


def fold_unrolled(trace: FunctionTrace, accesses: list[Access], fold: bool = True) -> tuple[list[Access], list[StrideEvidence]]:
    """Same-width accesses through one base register inside one loop, d bytes apart, whose loop step is k*d with k
    distinct offsets, are k copies of one element access. They fold onto the lowest offset modulo d."""
    folded = list(accesses)
    evidence: list[StrideEvidence] = []
    for start, end in trace.loops:
        inside = [a for a in accesses if start <= a.address <= end]
        groups: dict[tuple[str | None, int, bool], list[Access]] = {}
        for access in inside:
            groups.setdefault((access.base, access.width, access.store), []).append(access)
        for (base, _width, _store), group in groups.items():
            offsets = sorted({a.offset for a in group})
            if len(offsets) < 2:
                continue
            delta = math.gcd(*[b - a for a, b in zip(offsets, offsets[1:])])
            evidence.append(StrideEvidence(delta, "offset-delta", trace.name, group[0].address, f"{len(offsets)} offsets {delta} apart in loop {start:#x}-{end:#x}"))
            steps = {abs(i.delta) for i in trace.increments if i.register == base and start <= i.address <= end}
            for step in steps:
                if step > delta and step % delta == 0 and step // delta == len(offsets):
                    evidence.append(StrideEvidence(delta, "unrolled", trace.name, group[0].address, f"loop step {step} = {len(offsets)} x {delta}"))
                    if not fold:
                        continue
                    lowest = offsets[0]
                    for position, access in enumerate(folded):
                        if access in group:
                            folded[position] = Access(access.function, access.address, access.text, access.root, lowest + (access.offset - lowest) % delta, access.width, access.kind, access.sign, access.store, access.base, access.index, access.strides)
    return folded, evidence


def compare_layouts(inferred: InferredLayout, truth: StructLayout) -> dict[str, Any]:
    """One row per DWARF member, one row per inferred field with no member, and a verdict on the size."""
    rows: list[dict[str, Any]] = []
    matched: set[tuple[int, int]] = set()
    for member in truth.members:
        candidates = [f for f in inferred.fields if f.offset == member.offset]
        if not candidates:
            rows.append({"member": member.name, "offset": member.offset, "truth": member.type, "inferred": None, "status": "no-evidence"})
            continue
        best = next((f for f in candidates if f.size == member.size), candidates[0])
        matched.add((best.offset, best.size))
        if best.size != member.size:
            status = "size-mismatch"
        elif best.kind == "conflict":
            status = "kind-conflict"
        elif member.kind == "pointer" and best.kind != "pointer":
            status = "pointer-unproven"
        elif member.kind != best.kind and not (member.kind == "int" and best.kind == "code"):
            status = "kind-mismatch"
        else:
            status = "match"
        rows.append({"member": member.name, "offset": member.offset, "truth": member.type, "inferred": best.label, "status": status, "evidence": len(best.evidence)})
    for field_entry in inferred.fields:
        if (field_entry.offset, field_entry.size) not in matched:
            inside = [m for m in truth.members if m.offset <= field_entry.offset < m.offset + m.size]
            rows.append({"member": inside[0].name if inside else None, "offset": field_entry.offset, "truth": inside[0].type if inside else "padding", "inferred": field_entry.label, "status": "unexpected"})
    if inferred.size is None:
        size_status = "unknown"
    elif inferred.size == truth.size:
        size_status = "match"
    else:
        size_status = "mismatch"
    gaps_ok = set(inferred.gaps()) <= set(truth.padding()) | {b for m in truth.members for b in range(m.offset, m.offset + m.size) if not any(f.offset == m.offset for f in inferred.fields)}
    return {
        "struct": truth.name,
        "rows": rows,
        "size": {"inferred": inferred.size, "lowerBound": inferred.size_lower_bound, "truth": truth.size, "status": size_status},
        "gapsConsistent": gaps_ok,
        "matches": sum(1 for r in rows if r["status"] == "match"),
        "members": len(truth.members),
    }


PSABI_SCALARS: dict[str, tuple[int, int]] = {
    "_Bool": (1, 1), "char": (1, 1), "signed char": (1, 1), "unsigned char": (1, 1), "short": (2, 2), "unsigned short": (2, 2),
    "int": (4, 4), "unsigned int": (4, 4), "enum": (4, 4), "long": (8, 8), "unsigned long": (8, 8), "long long": (8, 8),
    "unsigned long long": (8, 8), "__int128": (16, 16), "pointer": (8, 8), "float": (4, 4), "double": (8, 8), "long double": (16, 16),
}
ACCOUNT_MEMBERS = [("kind", "char"), ("balance", "int"), ("code", "short"), ("rate", "double"), ("label", "pointer")]


def sysv_layout(members: list[tuple[str, str]]) -> dict[str, Any]:
    """psABI 3.1.2: each member goes to the lowest offset with its alignment; the struct takes the strictest alignment;
    the size is rounded up to a multiple of that alignment."""
    offset = 0
    align = 1
    laid: list[dict[str, Any]] = []
    for name, type_name in members:
        size, member_align = PSABI_SCALARS[type_name]
        padding = (-offset) % member_align
        offset += padding
        laid.append({"name": name, "type": type_name, "offset": offset, "size": size, "align": member_align, "paddingBefore": padding})
        offset += size
        align = max(align, member_align)
    tail = (-offset) % align
    return {"members": laid, "size": offset + tail, "align": align, "tailPadding": tail}


class CtypesAccount(ctypes.Structure):
    _fields_ = [("kind", ctypes.c_char), ("balance", ctypes.c_int), ("code", ctypes.c_short), ("rate", ctypes.c_double), ("label", ctypes.c_char_p)]


def ctypes_layout() -> dict[str, Any]:
    fields = [(name, getattr(CtypesAccount, name).offset, getattr(CtypesAccount, name).size) for name, _t in CtypesAccount._fields_]
    return {"members": [{"name": n, "offset": o, "size": s} for n, o, s in fields], "size": ctypes.sizeof(CtypesAccount), "align": ctypes.alignment(CtypesAccount)}


BUILTIN_TYPES = {
    "v": "void", "b": "bool", "c": "char", "a": "signed char", "h": "unsigned char", "s": "short", "t": "unsigned short", "i": "int",
    "j": "unsigned int", "l": "long", "m": "unsigned long", "x": "long long", "y": "unsigned long long", "f": "float", "d": "double",
    "e": "long double", "z": "...", "w": "wchar_t", "n": "__int128", "o": "unsigned __int128",
}
SPECIAL_NAMES = {"TV": "vtable for ", "TI": "typeinfo for ", "TS": "typeinfo name for ", "TT": "VTT for "}
OPERATORS = {"nw": "operator new", "na": "operator new[]", "dl": "operator delete", "da": "operator delete[]", "pl": "operator+", "mi": "operator-", "ml": "operator*", "eq": "operator==", "aS": "operator=", "cl": "operator()", "ix": "operator[]"}


class DemangleError(ValueError):
    pass


class Demangler:
    """The subset of Itanium C++ ABI section 5.1 that the shapes fixture uses: nested names, CV qualifiers,
    constructors and destructors, builtin types, pointers and references, special names, and substitutions."""

    def __init__(self, text: str) -> None:
        self.text = text
        self.pos = 0
        self.substitutions: list[str] = []

    def peek(self, count: int = 1) -> str:
        return self.text[self.pos : self.pos + count]

    def take(self, count: int = 1) -> str:
        value = self.text[self.pos : self.pos + count]
        self.pos += count
        return value

    def number(self) -> int:
        start = self.pos
        while self.pos < len(self.text) and self.text[self.pos].isdigit():
            self.pos += 1
        if start == self.pos:
            raise DemangleError(f"expected a number at {start} in {self.text}")
        return int(self.text[start : self.pos])

    def source_name(self) -> str:
        length = self.number()
        return self.take(length)

    def unqualified_name(self, enclosing: str | None) -> str:
        if self.peek().isdigit():
            return self.source_name()
        if self.peek() == "C" and self.peek(2)[1:] in "123":
            self.take(2)
            return enclosing.split("::")[-1] if enclosing else "?"
        if self.peek() == "D" and self.peek(2)[1:] in "012":
            self.take(2)
            return "~" + (enclosing.split("::")[-1] if enclosing else "?")
        two = self.peek(2)
        if two in OPERATORS:
            self.take(2)
            return OPERATORS[two]
        raise DemangleError(f"unsupported name at {self.pos} in {self.text}")

    def nested_name(self) -> tuple[str, str]:
        self.take(1)
        qualifiers = ""
        while self.peek() in ("r", "V", "K"):
            qualifiers = {"K": " const", "V": " volatile", "r": " restrict"}[self.take()] + qualifiers
        parts: list[str] = []
        while self.peek() != "E":
            if self.peek() == "S" and self.peek(2) != "St":
                parts = [self.substitution()]
                continue
            if self.peek(2) == "St":
                self.take(2)
                parts.append("std")
                continue
            parts.append(self.unqualified_name("::".join(parts) if parts else None))
            if self.peek() != "E":
                self.substitutions.append("::".join(parts))
        self.take(1)
        return "::".join(parts), qualifiers

    def substitution(self) -> str:
        self.take(1)
        if self.peek() == "_":
            self.take(1)
            return self.substitutions[0]
        digits = ""
        while self.peek() != "_":
            digits += self.take()
        self.take(1)
        return self.substitutions[int(digits, 36) + 1]

    def name(self) -> tuple[str, str]:
        if self.peek() == "N":
            return self.nested_name()
        if self.peek() == "S" and self.peek(2) == "St":
            self.take(2)
            return "std::" + self.source_name(), ""
        return self.unqualified_name(None), ""

    def type(self) -> str:
        char = self.peek()
        if char in BUILTIN_TYPES:
            self.take()
            return BUILTIN_TYPES[char]
        if char == "P":
            self.take()
            result = self.type() + "*"
            self.substitutions.append(result)
            return result
        if char == "R":
            self.take()
            result = self.type() + "&"
            self.substitutions.append(result)
            return result
        if char == "O":
            self.take()
            result = self.type() + "&&"
            self.substitutions.append(result)
            return result
        if char in ("K", "V", "r"):
            self.take()
            result = self.type() + {"K": " const", "V": " volatile", "r": " restrict"}[char]
            self.substitutions.append(result)
            return result
        if char == "S":
            return self.substitution()
        if char == "N":
            result, qualifiers = self.nested_name()
            result += qualifiers
            self.substitutions.append(result)
            return result
        if char.isdigit():
            result = self.source_name()
            self.substitutions.append(result)
            return result
        raise DemangleError(f"unsupported type code {char!r} at {self.pos} in {self.text}")

    def parameters(self) -> str:
        params: list[str] = []
        while self.pos < len(self.text) and self.peek() not in ("E", "."):
            params.append(self.type())
        if params == ["void"]:
            params = []
        return "(" + ", ".join(params) + ")"

    def demangle(self) -> str:
        if not self.text.startswith("_Z"):
            raise DemangleError("not an Itanium mangled name")
        self.take(2)
        if self.peek() == "T" and self.peek(2) in SPECIAL_NAMES:
            prefix = SPECIAL_NAMES[self.take(2)]
            return prefix + self.type()
        base, qualifiers = self.name()
        if self.pos >= len(self.text):
            return base
        return base + self.parameters() + qualifiers


def demangle(name: str) -> str:
    return Demangler(name).demangle()


@dataclass(frozen=True)
class VTable:
    symbol: str
    class_name: str
    offset_to_top: int
    typeinfo: str | None
    functions: tuple[tuple[int, str, str], ...]
    address_point: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "class": self.class_name,
            "offsetToTop": self.offset_to_top,
            "typeinfo": self.typeinfo,
            "addressPoint": self.address_point,
            "slots": [{"slot": s, "symbol": n, "demangled": d} for s, n, d in self.functions],
        }


def read_vtable(elf: ElfObject, symbol_name: str) -> VTable:
    """Itanium ABI 2.5.2: offset-to-top, typeinfo pointer, then the virtual function pointers.
    In a relocatable object every pointer slot is a relocation, so the slots are read from .rela.data.rel.ro.<symbol>."""
    symbol = elf.symbol(symbol_name)
    section = elf.section(symbol.section)
    relocations = {r.offset: r for r in elf.relocations.get(symbol.section, []) if symbol.value <= r.offset < symbol.value + symbol.size}
    offset_to_top = struct.unpack_from("<q", section.data, symbol.value)[0]
    typeinfo = relocations.get(symbol.value + 8)
    functions: list[tuple[int, str, str]] = []
    for position in range(symbol.value + 16, symbol.value + symbol.size, 8):
        relocation = relocations.get(position)
        name = relocation.symbol_name if relocation else "(null)"
        functions.append(((position - symbol.value - 16) // 8, name, demangle(name) if name.startswith("_Z") else name))
    return VTable(symbol_name, demangle(symbol_name).removeprefix("vtable for "), offset_to_top, typeinfo.symbol_name if typeinfo else None, tuple(functions), 16)


@dataclass(frozen=True)
class TypeInfo:
    symbol: str
    class_name: str
    kind: str
    name_string: str
    base: str | None

    def to_dict(self) -> dict[str, Any]:
        return {"symbol": self.symbol, "class": self.class_name, "kind": self.kind, "nameString": self.name_string, "base": self.base}


def read_typeinfo(elf: ElfObject, symbol_name: str) -> TypeInfo:
    """Itanium ABI 2.9.4: a vptr into the abi::__*_type_info vtable, the mangled type name, and for
    __si_class_type_info the single base."""
    symbol = elf.symbol(symbol_name)
    relocations = {r.offset: r for r in elf.relocations.get(symbol.section, [])}
    vptr = relocations.get(symbol.value)
    kind = demangle(vptr.symbol_name).removeprefix("vtable for __cxxabiv1::") if vptr else "unknown"
    name_relocation = relocations.get(symbol.value + 8)
    name_string = ""
    if name_relocation:
        name_symbol = elf.symbol(name_relocation.symbol_name)
        name_string = _cstring(elf.section(name_symbol.section).data, name_symbol.value)
    base = relocations.get(symbol.value + 16)
    return TypeInfo(symbol_name, demangle(symbol_name).removeprefix("typeinfo for "), kind, name_string, base.symbol_name if base else None)


@dataclass(frozen=True)
class VirtualCall:
    function: str
    address: int
    text: str
    slot: int
    candidates: dict[str, str]

    def to_dict(self) -> dict[str, Any]:
        return {"function": self.function, "address": self.address, "text": " ".join(self.text.split()), "slot": self.slot, "candidates": self.candidates}


def find_virtual_calls(listing: dict[str, list[Instruction]], vtables: list[VTable]) -> list[VirtualCall]:
    """The call pattern: load the vptr from offset 0 of the object, then call through slot k at 8k from the address point."""
    calls: list[VirtualCall] = []
    for name, instructions in listing.items():
        vptr_registers: set[str] = set()
        for instruction in instructions:
            if instruction.mnemonic == "movq" and len(instruction.operands) == 2:
                memory = parse_memory(instruction.operands[0])
                if memory and memory.displacement == 0 and memory.base not in FRAME_REGISTERS and memory.index is None:
                    vptr_registers.add(_register(instruction.operands[1]) or "")
                elif _register(instruction.operands[1]) in vptr_registers:
                    vptr_registers.discard(_register(instruction.operands[1]))
            if instruction.flow == "indirect-call":
                memory = parse_memory(instruction.operands[0][1:])
                if memory and memory.base in vptr_registers:
                    slot = memory.displacement // 8
                    candidates = {v.class_name: next((f[1] for f in v.functions if f[0] == slot), "(none)") for v in vtables}
                    calls.append(VirtualCall(name, instruction.address, instruction.text, slot, candidates))
    return calls


ACCOUNT_BUILDS = {"O0": "account-x86_64-O0-g", "O1": "account-x86_64-O1-g", "O2": "account-x86_64-O2-g"}
EVIDENCE_ORDER = ["bump", "sum_balances", "tag", "projected", "label_length", "main"]
WITNESSES = [(name, "param0") for name in EVIDENCE_ORDER if name != "main"]


def trace_listing(listing: dict[str, list[Instruction]]) -> dict[str, FunctionTrace]:
    return {name: trace_function(name, instructions) for name, instructions in listing.items()}


def account_truth() -> StructLayout:
    return DwarfInfo(load_object("account-x86_64-O0-g.o")).struct("account")


def analyze_build(build: str, functions: list[str] | None = None, fold: bool = True) -> dict[str, Any]:
    listing = load_listing(f"{ACCOUNT_BUILDS[build]}.objdump.txt")
    traces = trace_listing(listing)
    chosen = functions or EVIDENCE_ORDER
    witnesses = [(f, r) for f, r in WITNESSES if f in chosen]
    selected = [traces[name] for name in chosen if name in traces]
    layout = infer_layout(selected, witnesses, "account", fold)
    truth = account_truth()
    return {
        "object": f"{ACCOUNT_BUILDS[build]}.o",
        "functions": chosen,
        "accesses": [a.to_dict() for t in selected for a in t.accesses if a.root is not None and (a.root == "param0" or a.root.startswith("param0->"))],
        "unattributed": {t.name: t.unattributed for t in selected if t.unattributed},
        "callSites": [c.to_dict() for t in selected for c in t.call_sites],
        "layout": layout.to_dict(),
        "comparison": compare_layouts(layout, truth),
    }


def layout_oracles() -> dict[str, Any]:
    truth = account_truth()
    rules = sysv_layout(ACCOUNT_MEMBERS)
    reordered = sysv_layout([("rate", "double"), ("label", "pointer"), ("balance", "int"), ("code", "short"), ("kind", "char")])
    native = (FIXTURES / "account-native.run.txt").read_text().splitlines() if (FIXTURES / "account-native.run.txt").exists() else []
    return {
        "psabiRules": rules,
        "ctypes": ctypes_layout(),
        "dwarf": truth.to_dict(),
        "nativeRun": native,
        "agree": [m["offset"] for m in rules["members"]] == [m.offset for m in truth.members] == [m["offset"] for m in ctypes_layout()["members"]] and rules["size"] == truth.size == ctypes_layout()["size"],
        "reordered": reordered,
    }


def cxx_report() -> dict[str, Any]:
    elf = load_object("shapes-x86_64-O0-g.o")
    listing = load_listing("shapes-x86_64-O0-g.objdump.txt")
    dwarf = DwarfInfo(elf)
    vtables = [read_vtable(elf, name) for name in ("_ZTV5Shape", "_ZTV4Rect")]
    typeinfos = [read_typeinfo(elf, name) for name in ("_ZTI5Shape", "_ZTI4Rect")]
    calls = find_virtual_calls(listing, vtables)
    mangled = [n for n in elf.symbol_names() if n.startswith("_Z")]
    structs = {s.name: s.to_dict() for s in dwarf.struct_layouts() if s.name in ("Shape", "Rect")}
    dwarf_slots = {s.name: {v.slot: v.name for v in s.virtual_methods} for s in dwarf.struct_layouts() if s.name in ("Shape", "Rect")}
    optimized = load_object("shapes-x86_64-O1-g.o")
    return {
        "mangled": {name: demangle(name) for name in mangled},
        "vtables": [v.to_dict() for v in vtables],
        "typeinfo": [t.to_dict() for t in typeinfos],
        "virtualCalls": [c.to_dict() for c in calls],
        "dwarfVtableSlots": dwarf_slots,
        "dwarfStructs": structs,
        "optimizedObjectHasVtable": any(n.startswith("_ZTV") for n in optimized.symbol_names()),
        "optimizedDescribe": [" ".join(i.text.split()) for i in load_listing("shapes-x86_64-O1-g.objdump.txt").get("_Z8describeRK5Shapei", [])],
    }


def tool_captures() -> dict[str, Any]:
    tools = FIXTURES / "tools"
    report: dict[str, Any] = {}
    for path in sorted(tools.glob("*.txt")) if tools.exists() else []:
        text = path.read_text(errors="replace")
        report[path.name] = {"lines": len(text.splitlines()), "mentionsAccountStruct": "struct account" in text or "/DWARF/account.c/account" in text or 'name = "account"' in text}
    return report


def demo() -> dict[str, Any]:
    dwarf = DwarfInfo(load_object("account-x86_64-O0-g.o"))
    return {
        "dwarf": {
            "unit": dwarf.header().to_dict(),
            "structs": [s.to_dict() for s in dwarf.struct_layouts()],
            "functions": [f.to_dict() for f in dwarf.functions()],
        },
        "oracles": layout_oracles(),
        "builds": {build: analyze_build(build) for build in ACCOUNT_BUILDS},
        "cxx": cxx_report(),
        "tools": tool_captures(),
    }


def figure_data() -> dict[str, Any]:
    truth = account_truth()

    def summary(report: dict[str, Any]) -> dict[str, Any]:
        layout = report["layout"]
        return {
            "fields": [{"o": f["offset"], "s": f["size"], "k": f["kind"], "l": f["label"], "n": len(f["evidence"]), "p": len(f["pointerProof"])} for f in layout["fields"]],
            "stride": layout["stride"],
            "strideEvidence": [{"v": e["value"], "k": e["kind"], "f": e["function"], "a": e["address"]} for e in layout["strideEvidence"]],
            "size": layout["size"],
            "lowerBound": layout["sizeLowerBound"],
            "rows": [{"m": r["member"], "o": r["offset"], "t": r["truth"], "i": r["inferred"], "s": r["status"]} for r in report["comparison"]["rows"]],
            "sizeStatus": report["comparison"]["size"]["status"],
            "conflicts": len(layout["conflicts"]),
        }

    builds: dict[str, Any] = {}
    for build in ACCOUNT_BUILDS:
        steps = []
        for count in range(1, len(EVIDENCE_ORDER) + 1):
            report = analyze_build(build, EVIDENCE_ORDER[:count])
            raw = analyze_build(build, EVIDENCE_ORDER[:count], fold=False)
            step = {
                "function": EVIDENCE_ORDER[count - 1],
                "accesses": [{"f": a["function"], "a": a["address"], "t": a["text"], "o": a["offset"], "w": a["width"], "k": a["kind"], "r": a["root"]} for a in report["accesses"]],
                "callSites": [{"a": c["address"], "c": c["callee"], "arg": c["arguments"][0]} for c in report["callSites"] if c["arguments"][0]],
            }
            step.update(summary(report))
            raw_summary = summary(raw)
            if raw_summary["fields"] != step["fields"]:
                step["raw"] = raw_summary
            steps.append(step)
        builds[build] = {"object": f"{ACCOUNT_BUILDS[build]}.o", "steps": steps}
    return {
        "struct": truth.name,
        "truth": {"size": truth.size, "align": truth.align, "members": [{"n": m.name, "t": m.type, "o": m.offset, "s": m.size, "k": m.kind} for m in truth.members], "padding": truth.padding()},
        "order": EVIDENCE_ORDER,
        "builds": builds,
    }


def print_dwarf(path: str) -> str:
    dwarf = DwarfInfo(ElfObject(Path(path).read_bytes()))
    lines = [f"unit: {json.dumps(dwarf.header().to_dict())}"]
    for layout in dwarf.struct_layouts():
        lines.append(f"struct {layout.name} size {layout.size} align {layout.align}")
        for base, offset in layout.bases:
            lines.append(f"  : {base} at {offset}")
        for member in layout.members:
            lines.append(f"  +{member.offset:<3} {member.type:<14} {member.name} ({member.size} bytes, {member.kind})")
        for method in layout.virtual_methods:
            lines.append(f"  vtable slot {method.slot}: {method.name} [{method.virtuality}]")
    for function in dwarf.functions():
        params = ", ".join(f"{p.type} {p.name} @ {p.location}" for p in function.parameters)
        lines.append(f"{function.return_type} {function.name}({params}) at {function.low_pc:#x}-{function.high_pc:#x}, frame base {function.frame_base}")
    return "\n".join(lines)


def print_inference(listing_path: str, object_path: str | None) -> str:
    listing = parse_listing(Path(listing_path).read_text())
    traces = trace_listing(listing)
    witnesses = [(name, "param0") for name in listing if any(a.root == "param0" for a in traces[name].accesses)]
    layout = infer_layout(list(traces.values()), witnesses, "struct")
    lines = [f"witnesses: {', '.join(f for f, _ in witnesses)}"]
    for field_entry in layout.fields:
        lines.append(f"  +{field_entry.offset:<3} {field_entry.label:<8} {len(field_entry.evidence)} accesses" + (" pointer proven" if field_entry.pointer_proof else ""))
    lines.append(f"stride {layout.stride} from {[(e.kind, e.value) for e in layout.stride_evidence]}")
    lines.append(f"size {layout.size} (lower bound {layout.size_lower_bound}), gaps {layout.gaps()}, natural alignment {layout.natural_alignment_ok()}")
    if object_path:
        dwarf = DwarfInfo(ElfObject(Path(object_path).read_bytes()))
        for truth in dwarf.struct_layouts():
            comparison = compare_layouts(layout, truth)
            lines.append(f"against DWARF {truth.name}: {comparison['matches']}/{comparison['members']} members match, size {comparison['size']['status']}")
            for row in comparison["rows"]:
                lines.append(f"  {row['status']:<16} +{row['offset']:<3} {row['truth']:<14} {row['member'] or ''} <- {row['inferred']}")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    if not argv:
        print(json.dumps(demo(), indent=2))
        return 0
    command = argv[0]
    if command == "dwarf" and len(argv) == 2:
        print(print_dwarf(argv[1]))
        return 0
    if command == "infer" and len(argv) in (2, 3):
        print(print_inference(argv[1], argv[2] if len(argv) == 3 else None))
        return 0
    if command == "demangle" and len(argv) >= 2:
        for name in argv[1:]:
            print(f"{name} -> {demangle(name)}")
        return 0
    if command == "vtable" and len(argv) == 2:
        elf = ElfObject(Path(argv[1]).read_bytes())
        for name in elf.symbol_names():
            if name.startswith("_ZTV") and elf.symbol(name).type == STT_OBJECT:
                print(json.dumps(read_vtable(elf, name).to_dict(), indent=2))
        return 0
    if command == "figure-data":
        print(json.dumps(figure_data(), separators=(",", ":")))
        return 0
    print("usage: main.py [dwarf FILE.o | infer LISTING.txt [FILE.o] | demangle NAME... | vtable FILE.o | figure-data]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
