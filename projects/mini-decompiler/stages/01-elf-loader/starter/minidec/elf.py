
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
        raise NotImplementedError("Stage 1: implement ElfObject.__init__")

    def _slice(self, offset: int, size: int, what: str) -> bytes:
        if offset + size > len(self.data):
            raise ElfError(f"{what} at 0x{offset:x}+0x{size:x} lies outside the file")
        return self.data[offset : offset + size]

    def _read_symbols(self) -> list[Symbol]:
        raise NotImplementedError("Stage 1: implement ElfObject._read_symbols")

    def _read_relocations(self) -> dict[str, list[Relocation]]:
        raise NotImplementedError("Stage 1: implement ElfObject._read_relocations")

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
        raise NotImplementedError("Stage 1: implement ElfObject.function_extent")

    def function(self, name: str, section: str = ".text") -> FunctionBytes:
        raise NotImplementedError("Stage 1: implement ElfObject.function")

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
    raise NotImplementedError("Stage 1: implement relocation_target")


def load_object(path: str | Path) -> ElfObject:
    return ElfObject(Path(path).read_bytes())
