
from __future__ import annotations

import struct
from dataclasses import dataclass
from pathlib import Path

ELF_MAGIC = b"\x7fELF"
ELFCLASS64 = 2
ELFDATA2LSB = 1
ET_REL = 1
EM_X86_64 = 62
SHT_SYMTAB = 2
SHT_STRTAB = 3
SHT_RELA = 4
SHT_NOBITS = 8
STT_FUNC = 2
STT_SECTION = 3
HEADER_SIZE = 64
SECTION_HEADER_SIZE = 64
SYMBOL_SIZE = 24
RELA_SIZE = 24

RELOCATION_NAMES = {
    0: "R_X86_64_NONE",
    1: "R_X86_64_64",
    2: "R_X86_64_PC32",
    4: "R_X86_64_PLT32",
    10: "R_X86_64_32",
    11: "R_X86_64_32S",
}
RELOCATION_WIDTHS = {1: 8, 2: 4, 4: 4, 10: 4, 11: 4}
PC_RELATIVE_TYPES = {2, 4}


class ElfError(ValueError):
    pass


@dataclass(frozen=True)
class Section:
    index: int
    name: str
    type: int
    flags: int
    offset: int
    size: int
    link: int
    info: int
    entsize: int
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
    def type_name(self) -> str:
        return RELOCATION_NAMES.get(self.type, f"R_X86_64_{self.type}")

    @property
    def width(self) -> int:
        return RELOCATION_WIDTHS.get(self.type, 4)

    @property
    def symbol_name(self) -> str:
        return self.symbol.section if self.symbol.type == STT_SECTION else self.symbol.name

    @property
    def pc_relative(self) -> bool:
        return self.type in PC_RELATIVE_TYPES

    def describe(self) -> str:
        if self.addend == 0:
            return f"{self.type_name} {self.symbol_name}"
        sign = "+" if self.addend > 0 else "-"
        return f"{self.type_name} {self.symbol_name}{sign}0x{abs(self.addend):x}"


@dataclass(frozen=True)
class Target:
    section: str
    offset: int

    def describe(self) -> str:
        return f"{self.section}+0x{self.offset:x}"


@dataclass(frozen=True)
class FunctionBytes:
    name: str
    section: str
    start: int
    size: int
    data: bytes
    relocations: tuple[Relocation, ...]
    padding_end: int

    @property
    def end(self) -> int:
        return self.start + self.size

    @property
    def padding(self) -> int:
        return self.padding_end - self.end


def _cstring(table: bytes, offset: int) -> str:
    if offset < 0 or offset >= len(table):
        raise ElfError(f"string offset 0x{offset:x} is outside its string table")
    end = table.find(b"\0", offset)
    return table[offset : end if end >= 0 else len(table)].decode("ascii", "replace")


class ElfObject:

    def __init__(self, data: bytes) -> None:
        if len(data) < HEADER_SIZE or data[:4] != ELF_MAGIC:
            raise ElfError("not an ELF file: the first four bytes are not 7f 45 4c 46")
        if data[4] != ELFCLASS64:
            raise ElfError(f"ELF class {data[4]} is not ELFCLASS64")
        if data[5] != ELFDATA2LSB:
            raise ElfError(f"ELF data encoding {data[5]} is not little-endian")
        e_type, e_machine = struct.unpack_from("<HH", data, 16)
        if e_machine != EM_X86_64:
            raise ElfError(f"e_machine {e_machine} is not EM_X86_64 (62)")
        if e_type != ET_REL:
            raise ElfError(f"e_type {e_type} is not ET_REL (1); only relocatable objects are supported")
        shoff = struct.unpack_from("<Q", data, 40)[0]
        shentsize, shnum, shstrndx = struct.unpack_from("<HHH", data, 58)
        if shentsize != SECTION_HEADER_SIZE:
            raise ElfError(f"e_shentsize {shentsize} is not 64")
        if shnum == 0 or shoff + shnum * shentsize > len(data):
            raise ElfError("section header table lies outside the file")
        if shstrndx >= shnum:
            raise ElfError(f"e_shstrndx {shstrndx} is not a section index")
        self.data = data
        self.machine = e_machine
        raw_headers = [struct.unpack_from("<IIQQQQIIQQ", data, shoff + index * shentsize) for index in range(shnum)]
        names_header = raw_headers[shstrndx]
        name_table = self._slice(names_header[4], names_header[5], "section name table")
        self.sections: list[Section] = []
        for index, raw in enumerate(raw_headers):
            sh_name, sh_type, sh_flags, _addr, sh_offset, sh_size, sh_link, sh_info, _align, sh_entsize = raw
            payload = b"" if sh_type == SHT_NOBITS else self._slice(sh_offset, sh_size, f"section {index}")
            name = _cstring(name_table, sh_name) if sh_name < len(name_table) else ""
            self.sections.append(Section(index, name, sh_type, sh_flags, sh_offset, sh_size, sh_link, sh_info, sh_entsize, payload))
        self.symbols = self._read_symbols()
        self.relocations = self._read_relocations()

    def _slice(self, offset: int, size: int, what: str) -> bytes:
        if offset + size > len(self.data):
            raise ElfError(f"{what} at 0x{offset:x}+0x{size:x} lies outside the file")
        return self.data[offset : offset + size]

    def _read_symbols(self) -> list[Symbol]:
        symbols: list[Symbol] = []
        for section in self.sections:
            if section.type != SHT_SYMTAB:
                continue
            if section.link >= len(self.sections):
                raise ElfError(".symtab sh_link is not a section index")
            strings = self.sections[section.link].data
            for offset in range(0, section.size - section.size % SYMBOL_SIZE, SYMBOL_SIZE):
                st_name, st_info, _other, st_shndx, st_value, st_size = struct.unpack_from("<IBBHQQ", section.data, offset)
                section_name = self.sections[st_shndx].name if st_shndx < len(self.sections) else ""
                symbols.append(Symbol(_cstring(strings, st_name), st_value, st_size, st_info & 0xF, st_info >> 4, st_shndx, section_name))
        return symbols

    def _read_relocations(self) -> dict[str, list[Relocation]]:
        table: dict[str, list[Relocation]] = {}
        for section in self.sections:
            if section.type != SHT_RELA:
                continue
            if section.info >= len(self.sections):
                raise ElfError(f"{section.name} sh_info is not a section index")
            target = self.sections[section.info].name
            for offset in range(0, section.size - section.size % RELA_SIZE, RELA_SIZE):
                r_offset, r_info, r_addend = struct.unpack_from("<QQq", section.data, offset)
                index = r_info >> 32
                if index >= len(self.symbols):
                    raise ElfError(f"{section.name} names symbol {index}, which does not exist")
                table.setdefault(target, []).append(Relocation(target, r_offset, r_info & 0xFFFFFFFF, self.symbols[index], r_addend))
        for entries in table.values():
            entries.sort(key=lambda r: r.offset)
        return table

    def section(self, name: str) -> Section:
        for section in self.sections:
            if section.name == name:
                return section
        raise ElfError(f"no section named {name}")

    def has_section(self, name: str) -> bool:
        return any(section.name == name for section in self.sections)

    def functions(self, section: str = ".text") -> list[Symbol]:
        found = [s for s in self.symbols if s.type == STT_FUNC and s.section == section]
        return sorted(found, key=lambda s: s.value)

    def function_extent(self, name: str, section: str = ".text") -> tuple[int, int, int]:
        functions = self.functions(section)
        for position, symbol in enumerate(functions):
            if symbol.name == name:
                following = functions[position + 1].value if position + 1 < len(functions) else self.section(section).size
                return symbol.value, symbol.value + symbol.size, following
        raise ElfError(f"no function symbol named {name} in {section}")

    def function(self, name: str, section: str = ".text") -> FunctionBytes:
        start, end, padding_end = self.function_extent(name, section)
        code = self.section(section).data
        if end > len(code):
            raise ElfError(f"{name} ends at 0x{end:x}, past the end of {section}")
        inside = tuple(
            Relocation(r.section, r.offset - start, r.type, r.symbol, r.addend)
            for r in self.relocations.get(section, [])
            if start <= r.offset < end
        )
        return FunctionBytes(name, section, start, end - start, code[start:end], inside, padding_end)

    def relocation_at(self, section: str, offset: int) -> Relocation | None:
        for relocation in self.relocations.get(section, []):
            if relocation.offset == offset:
                return relocation
        return None

    def symbolize(self, address: int, section: str = ".text") -> str:
        best: Symbol | None = None
        for symbol in self.functions(section):
            if symbol.value <= address and (best is None or symbol.value >= best.value):
                best = symbol
        if best is None:
            return f"{section}+0x{address:x}"
        delta = address - best.value
        return best.name if delta == 0 else f"{best.name}+0x{delta:x}"


def symbol_base(symbol: Symbol) -> int:
    return 0 if symbol.type == STT_SECTION else symbol.value


def relocation_target(relocation: Relocation, field_end: int | None = None) -> Target:
    base = symbol_base(relocation.symbol) + relocation.addend
    if relocation.pc_relative:
        if field_end is None:
            raise ValueError("a PC-relative relocation needs the end of the field's instruction")
        base += field_end - relocation.offset
    return Target(relocation.symbol.section, base)


def load_object(path: str | Path) -> ElfObject:
    return ElfObject(Path(path).read_bytes())
