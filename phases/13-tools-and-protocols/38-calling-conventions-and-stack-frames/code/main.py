"""Companion code for docs/en.md: read the calling convention and the stack frame out of a disassembly and check each inference against the ABI rule it rests on.
Specs: System V AMD64 psABI 3.2.1 to 3.2.3 (registers, stack frame, parameter passing); Microsoft x64 calling convention, stack usage, prolog and epilog,
and exception handling pages; Arm AAPCS64 6.1, 6.4.5, 6.4.6, 6.8.2, 6.9; Apple arm64 platform notes.
Run `python3 main.py` for the demo or `python3 -m unittest discover -s tests -v` for the suite.
"""

from __future__ import annotations

import json
import re
import shutil
import struct
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"

SYSV = "sysv"
WIN64 = "win64"
AAPCS64 = "aapcs64"
APPLE_ARM64 = "apple-arm64"

ABI_NAMES = {
    SYSV: "System V AMD64 psABI",
    WIN64: "Microsoft x64",
    AAPCS64: "Arm AAPCS64",
    APPLE_ARM64: "Apple arm64 (AAPCS64 with Apple differences)",
}

X86_ABIS = (SYSV, WIN64)
ARM_ABIS = (AAPCS64, APPLE_ARM64)

INT_ARG_REGS = {
    SYSV: ["rdi", "rsi", "rdx", "rcx", "r8", "r9"],
    WIN64: ["rcx", "rdx", "r8", "r9"],
    AAPCS64: [f"x{n}" for n in range(8)],
    APPLE_ARM64: [f"x{n}" for n in range(8)],
}
FLOAT_ARG_REGS = {
    SYSV: [f"xmm{n}" for n in range(8)],
    WIN64: [f"xmm{n}" for n in range(4)],
    AAPCS64: [f"v{n}" for n in range(8)],
    APPLE_ARM64: [f"v{n}" for n in range(8)],
}
HIDDEN_RETURN_REG = {SYSV: "rdi", WIN64: "rcx", AAPCS64: "x8", APPLE_ARM64: "x8"}
INT_RETURN_REGS = {SYSV: ["rax", "rdx"], WIN64: ["rax"], AAPCS64: ["x0", "x1"], APPLE_ARM64: ["x0", "x1"]}
FLOAT_RETURN_REGS = {SYSV: ["xmm0", "xmm1"], WIN64: ["xmm0"], AAPCS64: ["v0"], APPLE_ARM64: ["v0"]}
CALLEE_SAVED = {
    SYSV: {"rbx", "rbp", "r12", "r13", "r14", "r15"},
    WIN64: {"rbx", "rbp", "rdi", "rsi", "r12", "r13", "r14", "r15"} | {f"xmm{n}" for n in range(6, 16)},
    AAPCS64: {f"x{n}" for n in range(19, 31)} | {f"v{n}" for n in range(8, 16)},
    APPLE_ARM64: {f"x{n}" for n in range(19, 31)} | {f"v{n}" for n in range(8, 16)},
}
CALLER_SAVED = {
    SYSV: {"rax", "rcx", "rdx", "rsi", "rdi", "r8", "r9", "r10", "r11"} | {f"xmm{n}" for n in range(16)},
    WIN64: {"rax", "rcx", "rdx", "r8", "r9", "r10", "r11"} | {f"xmm{n}" for n in range(6)},
    AAPCS64: {f"x{n}" for n in range(19)} | {"x30"} | {f"v{n}" for n in range(8)} | {f"v{n}" for n in range(16, 32)},
    APPLE_ARM64: {f"x{n}" for n in range(19)} | {"x30"} | {f"v{n}" for n in range(8)} | {f"v{n}" for n in range(16, 32)},
}
STACK_ARG_BASE = {SYSV: 8, WIN64: 40, AAPCS64: 0, APPLE_ARM64: 0}
RETURN_ADDRESS_BYTES = {SYSV: 8, WIN64: 8, AAPCS64: 0, APPLE_ARM64: 0}
RED_ZONE_BYTES = {SYSV: 128, WIN64: 0, AAPCS64: 0, APPLE_ARM64: 128}

RULES = {
    "int-regs": {
        SYSV: "psABI 3.2.3: INTEGER arguments take the next register of %rdi, %rsi, %rdx, %rcx, %r8, %r9",
        WIN64: "Microsoft x64: integer arguments are passed in RCX, RDX, R8, and R9 by position",
        AAPCS64: "AAPCS64 6.8.2 C.9: an integral argument is copied to x[NGRN], NGRN from 0 to 7",
        APPLE_ARM64: "AAPCS64 6.8.2 C.9: an integral argument is copied to x[NGRN], NGRN from 0 to 7",
    },
    "float-regs": {
        SYSV: "psABI 3.2.3: SSE arguments take the next register of %xmm0 to %xmm7, independently of the INTEGER sequence",
        WIN64: "Microsoft x64: floating-point arguments in the first four positions use XMM0 to XMM3 by position",
        AAPCS64: "AAPCS64 6.8.2 C.1: a floating-point argument is allocated to v[NSRN], independently of NGRN",
        APPLE_ARM64: "AAPCS64 6.8.2 C.1: a floating-point argument is allocated to v[NSRN], independently of NGRN",
    },
    "stack-args": {
        SYSV: "psABI 3.2.3 and Figure 3.3: arguments without a register go on the stack right to left, eightbyte n at 8(%rsp) + 8n on entry",
        WIN64: "Microsoft x64: remaining arguments are passed on the stack above the 32-byte shadow store, the first at 40(%rsp) on entry",
        AAPCS64: "AAPCS64 6.8.2 C.14 to C.17: arguments beyond x7 go to the stack at the NSAA",
        APPLE_ARM64: "Apple arm64: stack arguments are packed to natural alignment and padded to 8 bytes at the end",
    },
    "return": {
        SYSV: "psABI 3.2.3: INTEGER results return in %rax then %rdx, SSE in %xmm0 then %xmm1, MEMORY through the address passed in %rdi and returned in %rax",
        WIN64: "Microsoft x64: scalars that fit 64 bits return in RAX, floats in XMM0, larger types through a caller pointer in RCX that the callee returns in RAX",
        AAPCS64: "AAPCS64 6.9: a result that would be passed in registers returns in those registers, otherwise through the address in x8",
        APPLE_ARM64: "AAPCS64 6.9: a result that would be passed in registers returns in those registers, otherwise through the address in x8",
    },
    "callee-saved": {
        SYSV: "psABI 3.2.1: %rbp, %rbx and %r12 through %r15 belong to the calling function and the called function is required to preserve their values",
        WIN64: "Microsoft x64: RBX, RBP, RDI, RSI, RSP, R12 to R15 and XMM6 to XMM15 are nonvolatile; the first use of a nonvolatile register in the prolog must be to save it",
        AAPCS64: "AAPCS64 6.1.1: a subroutine invocation must preserve the contents of the registers r19-r29 and SP",
        APPLE_ARM64: "AAPCS64 6.1.1: a subroutine invocation must preserve the contents of the registers r19-r29 and SP",
    },
    "alignment": {
        SYSV: "psABI 3.2.2: the stack is 16-byte aligned immediately before the call instruction, so (%rsp + 8) is a multiple of 16 on entry",
        WIN64: "Microsoft x64: the stack pointer must remain 16-byte aligned outside the prolog, the epilog, and leaf functions",
        AAPCS64: "AAPCS64 6.4.5.2: at a public interface SP mod 16 = 0",
        APPLE_ARM64: "AAPCS64 6.4.5.2: at a public interface SP mod 16 = 0",
    },
    "shadow": {
        WIN64: "Microsoft x64: the caller must always allocate sufficient space to store four register parameters, even if the callee doesn't take that many parameters",
    },
    "red-zone": {
        SYSV: "psABI 3.2.2: the 128-byte area beyond the location pointed to by %rsp is reserved and may hold temporary data that is not needed across function calls",
        WIN64: "Microsoft x64 stack usage: all memory beyond the current address of RSP is considered volatile",
        AAPCS64: "AAPCS64 6.4.5: the stack is full-descending and no thread may access the inactive region below SP",
        APPLE_ARM64: "Apple arm64: the 128 bytes immediately below the stack pointer are not modified during exceptions",
    },
    "frame-pointer": {
        SYSV: "psABI 3.2.2 Figure 3.3: %rbp optionally holds the frame base, with the return address at 8(%rbp) and the previous %rbp at 0(%rbp)",
        WIN64: "Microsoft x64 prolog: a frame pointer is optional and is set after the fixed allocation",
        AAPCS64: "AAPCS64 6.4.6: a frame record is two 64-bit values, the previous frame record lower and the saved LR higher, pointed to by FP",
        APPLE_ARM64: "Apple arm64: the frame pointer register (x29) must always address a valid frame record; leaf functions may opt out",
    },
    "variadic": {
        SYSV: "psABI 3.2.3: %al holds an upper bound on the number of vector registers used, in the range 0 to 8",
        WIN64: "Microsoft x64: for vararg functions the callee stores the register arguments to their home slots at 8, 16, 24, 32 bytes above the return address",
        AAPCS64: "AAPCS64 6.8.1: a variadic callee saves the unnamed argument registers in a register save area and va_list is a structure",
        APPLE_ARM64: "Apple arm64: variadic arguments are assigned to 8-byte stack slots and va_list is a char*",
    },
    "epilogue": "The epilogue restores the registers the prologue saved and the stack pointer returns to its entry value",
}

TYPES = {
    "int": (4, "int"),
    "i64": (8, "int"),
    "double": (8, "float"),
    "float": (4, "float"),
    "pair": (16, "struct"),
    "big": (32, "struct"),
    "void": (0, "void"),
}

SIGNATURES: dict[str, tuple[str, list[str]]] = {
    "leaf_add": ("int", ["int", "int"]),
    "eight_args": ("i64", ["i64"] * 8),
    "mixed": ("double", ["int", "double", "i64", "float"]),
    "by_value": ("pair", ["pair"]),
    "big_ret": ("big", ["i64"]),
    "sum_varargs": ("int", ["int", "..."]),
    "keeps": ("int", ["int"]),
    "call8": ("i64", []),
    "call_mixed": ("double", []),
    "call_varargs": ("int", []),
    "call_pair": ("i64", []),
    "call_big": ("i64", []),
}

PARAM_NAMES = {
    "leaf_add": ["a", "b"],
    "eight_args": ["a", "b", "c", "d", "e", "f", "g", "h"],
    "mixed": ["i", "d", "l", "f"],
    "by_value": ["p"],
    "big_ret": ["seed"],
    "sum_varargs": ["count", "..."],
    "keeps": ["n"],
}

CALLEE_SHAPES = {"call8": "eight_args", "call_mixed": "mixed", "call_varargs": "sum_varargs", "call_pair": "by_value", "call_big": "big_ret"}

FIXTURE_OBJECTS = {
    "convention-x86_64-linux-O0": SYSV,
    "convention-x86_64-linux-O2": SYSV,
    "convention-x86_64-windows-O0": WIN64,
    "convention-x86_64-windows-O2": WIN64,
    "convention-aarch64-linux-O0": AAPCS64,
    "convention-aarch64-linux-O2": AAPCS64,
    "convention-arm64-macos-O2": APPLE_ARM64,
}


class ObjectError(ValueError):
    pass


@dataclass(frozen=True)
class FunctionSymbol:
    name: str
    offset: int
    size: int


@dataclass
class ObjectInfo:
    path: str
    format: str
    machine: str
    abi: str
    functions: list[FunctionSymbol]
    sections: dict[str, bytes] = field(default_factory=dict)
    symbol_names: list[str] = field(default_factory=list)


def _cstr(data: bytes, offset: int) -> str:
    end = data.index(b"\x00", offset)
    return data[offset:end].decode("ascii", "replace")


def _read_elf(data: bytes, path: str) -> ObjectInfo:
    """ELF64 header, section headers, and .symtab; e_machine selects the ABI (62 is x86-64, 183 is AArch64)."""
    machine = struct.unpack_from("<H", data, 0x12)[0]
    shoff = struct.unpack_from("<Q", data, 0x28)[0]
    shentsize, shnum, shstrndx = struct.unpack_from("<HHH", data, 0x3A)
    headers = []
    for index in range(shnum):
        base = shoff + index * shentsize
        name, typ, _flags, _addr, offset, size, link, _info, _align, _entsize = struct.unpack_from("<IIQQQQIIQQ", data, base)
        headers.append((name, typ, offset, size, link))
    strtab_off = headers[shstrndx][2]
    names = [_cstr(data, strtab_off + h[0]) for h in headers]
    sections = {names[i]: data[h[2] : h[2] + h[3]] for i, h in enumerate(headers) if h[1] != 8}
    functions: list[FunctionSymbol] = []
    symbol_names: list[str] = []
    for h in headers:
        if h[1] != 2:
            continue
        strings = headers[h[4]]
        for k in range(h[3] // 24):
            st_name, st_info, _other, st_shndx, st_value, st_size = struct.unpack_from("<IBBHQQ", data, h[2] + 24 * k)
            name = _cstr(data, strings[2] + st_name) if st_name else ""
            if name:
                symbol_names.append(name)
            if st_info & 0xF == 2 and st_shndx != 0:
                functions.append(FunctionSymbol(name, st_value, st_size))
    functions.sort(key=lambda f: f.offset)
    if machine == 62:
        return ObjectInfo(path, "ELF64", "x86-64", SYSV, functions, sections, symbol_names)
    if machine == 183:
        return ObjectInfo(path, "ELF64", "AArch64", AAPCS64, functions, sections, symbol_names)
    raise ObjectError(f"unsupported ELF machine {machine}")


def _read_coff(data: bytes, path: str) -> ObjectInfo:
    """COFF file header, section table, and symbol table; Machine 0x8664 selects Microsoft x64."""
    machine, nsections, _stamp, symoff, nsyms, optsize, _chars = struct.unpack_from("<HHIIIHH", data, 0)
    if machine != 0x8664:
        raise ObjectError(f"unsupported COFF machine {machine:#x}")
    strtab = symoff + nsyms * 18
    sections: dict[str, bytes] = {}
    for index in range(nsections):
        base = 20 + optsize + 40 * index
        raw_name = data[base : base + 8]
        _vsize, _vaddr, size, offset = struct.unpack_from("<IIII", data, base + 8)
        if raw_name.startswith(b"/"):
            name = _cstr(data, strtab + int(raw_name[1:].rstrip(b"\x00")))
        else:
            name = raw_name.rstrip(b"\x00").decode("ascii")
        if name not in sections:
            sections[name] = data[offset : offset + size]
    functions: list[FunctionSymbol] = []
    symbol_names: list[str] = []
    k = 0
    while k < nsyms:
        base = symoff + 18 * k
        raw_name = data[base : base + 8]
        value, section, typ, _storage, naux = struct.unpack_from("<IhHBB", data, base + 8)
        if raw_name[:4] == b"\x00\x00\x00\x00":
            name = _cstr(data, strtab + struct.unpack_from("<I", raw_name, 4)[0])
        else:
            name = raw_name.rstrip(b"\x00").decode("ascii")
        symbol_names.append(name)
        if typ == 0x20 and section > 0:
            functions.append(FunctionSymbol(name, value, 0))
        k += 1 + naux
    functions.sort(key=lambda f: f.offset)
    return ObjectInfo(path, "COFF", "AMD64", WIN64, functions, sections, symbol_names)


def _read_macho(data: bytes, path: str) -> ObjectInfo:
    """Mach-O 64 header and LC_SYMTAB; cputype 0x0100000c is arm64, external N_SECT symbols in section 1 are the functions."""
    cputype, _subtype, _filetype, ncmds, _sizeofcmds = struct.unpack_from("<IIIII", data, 4)
    if cputype != 0x0100000C:
        raise ObjectError(f"unsupported Mach-O cputype {cputype:#x}")
    offset = 32
    functions: list[FunctionSymbol] = []
    symbol_names: list[str] = []
    for _ in range(ncmds):
        cmd, cmdsize = struct.unpack_from("<II", data, offset)
        if cmd == 2:
            symoff, nsyms, stroff, _strsize = struct.unpack_from("<IIII", data, offset + 8)
            for k in range(nsyms):
                n_strx, n_type, n_sect, _desc, n_value = struct.unpack_from("<IBBHQ", data, symoff + 16 * k)
                name = _cstr(data, stroff + n_strx)
                symbol_names.append(name)
                if n_type & 0x0E == 0x0E and n_sect == 1 and n_type & 0x01:
                    functions.append(FunctionSymbol(name[1:] if name.startswith("_") else name, n_value, 0))
        offset += cmdsize
    functions.sort(key=lambda f: f.offset)
    return ObjectInfo(path, "Mach-O 64", "arm64", APPLE_ARM64, functions, {}, symbol_names)


def describe_object(path: Path) -> ObjectInfo:
    """The header picks the rulebook: ELF x86-64 is the psABI, COFF AMD64 is Microsoft x64, ELF AArch64 is AAPCS64, Mach-O arm64 is Apple."""
    data = path.read_bytes()
    if data[:4] == b"\x7fELF":
        return _read_elf(data, str(path))
    if data[:2] == b"\x64\x86":
        return _read_coff(data, str(path))
    if data[:4] == b"\xcf\xfa\xed\xfe":
        return _read_macho(data, str(path))
    raise ObjectError(f"unknown object format in {path.name}")


@dataclass
class Instruction:
    address: int
    hex: str
    mnemonic: str
    operands: str
    relocation: str | None = None

    @property
    def text(self) -> str:
        return f"{self.mnemonic} {self.operands}".strip()

    @property
    def length(self) -> int:
        return len(self.hex.split()) if " " in self.hex or len(self.hex) == 2 else len(self.hex) // 2


LISTING_LINE = re.compile(r"^\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} )+|[0-9a-f]{8})\s*\t?\s*(\S+)\s*(.*)$")
FUNCTION_HEADER = re.compile(r"^([0-9a-f]{16}) <(\S+)>:$")
RELOCATION_LINE = re.compile(r"^\s+[0-9a-f]{16}:\s+(R_\S+|IMAGE_REL\S+|ARM64_RELOC\S+)\s+(\S+)$")
FORMAT_LINE = re.compile(r"file format (\S+)")


@dataclass
class Listing:
    arch: str
    functions: dict[str, list[Instruction]]


def parse_listing(text: str, functions: list[FunctionSymbol] | None = None) -> Listing:
    """Split an llvm-objdump -d -r listing into functions, keep the relocation target of each call, and rename private labels."""
    by_offset = {f.offset: f.name for f in functions or []}
    arch = "x86"
    result: dict[str, list[Instruction]] = {}
    current: str | None = None
    for raw in text.splitlines():
        line = raw.rstrip()
        fmt = FORMAT_LINE.search(line)
        if fmt:
            arch = "arm" if "aarch64" in line or "arm64" in line else "x86"
            continue
        header = FUNCTION_HEADER.match(line)
        if header:
            offset = int(header.group(1), 16)
            label = header.group(2)
            if label.startswith("_") and label[1:] in by_offset.values():
                label = label[1:]
            current = by_offset.get(offset, label)
            result.setdefault(current, [])
            continue
        if current is None:
            continue
        relocation = RELOCATION_LINE.match(line)
        if relocation:
            if result[current]:
                target = relocation.group(2)
                target = re.sub(r"[-+]0x[0-9a-f]+$", "", target)
                result[current][-1].relocation = target[1:] if arch == "arm" and target.startswith("_") and "RELOC" in relocation.group(1) else target
            continue
        match = LISTING_LINE.match(line)
        if not match:
            continue
        operands = match.group(4)
        markers = ("\t//", " //", "\t;", " ;") if arch == "arm" else ("\t#", " #")
        for marker in markers:
            cut = operands.find(marker)
            if cut >= 0:
                operands = operands[:cut]
        operands = re.sub(r"\s+", " ", operands).strip()
        operands = re.sub(r" <[^>]*>$", "", operands)
        result[current].append(Instruction(int(match.group(1), 16), match.group(2).strip(), match.group(3), operands))
    return Listing(arch, result)


X86_CANONICAL: dict[str, str] = {}
for _base in ("a", "b", "c", "d"):
    for _name in (f"r{_base}x", f"e{_base}x", f"{_base}x", f"{_base}l", f"{_base}h"):
        X86_CANONICAL[_name] = f"r{_base}x"
for _base in ("si", "di", "bp", "sp"):
    for _name in (f"r{_base}", f"e{_base}", _base, f"{_base}l"):
        X86_CANONICAL[_name] = f"r{_base}"
for _n in range(8, 16):
    for _suffix in ("", "d", "w", "b", "l"):
        X86_CANONICAL[f"r{_n}{_suffix}"] = f"r{_n}"
for _n in range(16):
    X86_CANONICAL[f"xmm{_n}"] = f"xmm{_n}"
X86_CANONICAL["rip"] = "rip"


def x86_register(token: str) -> str | None:
    return X86_CANONICAL.get(token.strip().lstrip("*").lstrip("%"))


@dataclass(frozen=True)
class Operand:
    kind: str
    register: str | None = None
    base: str | None = None
    index: str | None = None
    displacement: int = 0
    immediate: int | None = None
    pre_index: bool = False
    post_index: int | None = None
    width: int = 8

    def address_registers(self) -> list[str]:
        return [r for r in (self.base, self.index) if r and r != "rip"]


def _int(text: str) -> int:
    text = text.strip().replace("#", "")
    negative = text.startswith("-")
    text = text.lstrip("-")
    value = int(text, 16) if text.startswith("0x") else int(text, 10)
    return -value if negative else value


def split_operands_x86(text: str) -> list[str]:
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
    return parts


X86_MEMORY = re.compile(r"^(?:%\w+:)?(-?0x[0-9a-f]+|-?\d+)?\((%\w+)?(?:,(%\w+)(?:,(\d))?)?\)$")


def parse_operand_x86(text: str) -> Operand:
    text = text.strip()
    if text.startswith("$"):
        return Operand("imm", immediate=_int(text[1:]))
    memory = X86_MEMORY.match(text.lstrip("*"))
    if memory:
        disp = _int(memory.group(1)) if memory.group(1) else 0
        base = x86_register(memory.group(2)) if memory.group(2) else None
        index = x86_register(memory.group(3)) if memory.group(3) else None
        return Operand("mem", base=base, index=index, displacement=disp)
    register = x86_register(text)
    if register:
        return Operand("reg", register=register)
    return Operand("target")


ARM_MEMORY = re.compile(r"\[([^\]]*)\](!?)")
ARM_WIDTH = {"x": 8, "w": 4, "q": 16, "d": 8, "s": 4, "h": 2, "b": 1, "v": 16}


def arm_register(token: str) -> tuple[str | None, int]:
    name = token.strip().split(".")[0]
    if name in ("sp", "wsp"):
        return "sp", 8
    if name in ("xzr", "wzr"):
        return None, 8 if name == "xzr" else 4
    match = re.match(r"^([xw])(\d+)$", name)
    if match:
        return f"x{int(match.group(2))}", ARM_WIDTH[match.group(1)]
    match = re.match(r"^([vqdshb])(\d+)$", name)
    if match:
        return f"v{int(match.group(2))}", ARM_WIDTH[match.group(1)]
    if name == "fp":
        return "x29", 8
    if name == "lr":
        return "x30", 8
    return None, 0


def parse_operands_arm(text: str) -> list[Operand]:
    operands: list[Operand] = []
    memory = ARM_MEMORY.search(text)
    tail = text
    mem_operand: Operand | None = None
    if memory:
        inside = [p.strip() for p in memory.group(1).split(",")]
        base, _ = arm_register(inside[0])
        disp = _int(inside[1]) if len(inside) > 1 and inside[1].startswith("#") else 0
        after = text[memory.end() :].strip()
        post_index: int | None = None
        if after.startswith(","):
            after_imm = after[1:].strip()
            if after_imm.startswith("#"):
                post_index = _int(after_imm)
                after = ""
        tail = text[: memory.start()] + after
        mem_operand = Operand("mem", base=base, displacement=disp, pre_index=memory.group(2) == "!", post_index=post_index)
    for piece in [p.strip() for p in tail.split(",") if p.strip()]:
        if piece.startswith("#"):
            try:
                operands.append(Operand("imm", immediate=_int(piece)))
            except ValueError:
                operands.append(Operand("imm"))
            continue
        register, width = arm_register(piece)
        if register or piece in ("xzr", "wzr"):
            operands.append(Operand("reg", register=register, width=width))
        elif piece in ("lsl", "lsr", "asr", "uxtw", "sxtw", "uxtx", "sxtx"):
            continue
        else:
            operands.append(Operand("target"))
    if mem_operand:
        operands.append(mem_operand)
    return operands


@dataclass
class Effect:
    reads: list[str] = field(default_factory=list)
    address_reads: list[str] = field(default_factory=list)
    writes: list[str] = field(default_factory=list)
    loads: list[Operand] = field(default_factory=list)
    stores: list[tuple[Operand, str | None, int, int | None]] = field(default_factory=list)
    addresses: list[Operand] = field(default_factory=list)
    sp_delta: int = 0
    post_sp_delta: int = 0
    kind: str = "other"

    @property
    def all_reads(self) -> list[str]:
        return self.reads + self.address_reads


X86_WIDTHS = {"movaps": 16, "movups": 16, "movdqu": 16, "movsd": 8, "movss": 4, "movq": 8, "movl": 4, "movw": 2, "movb": 1, "movabsq": 8}


def _x86_root(mnemonic: str) -> str:
    for prefix in ("cvtsi2sd", "cvtss2sd", "cvtsd2ss", "cvttsd2si", "movabs", "movs", "movz", "mov", "lea", "set", "cmov", "test", "cmp", "push", "pop", "call", "ret", "jmp", "nop", "xor", "pxor", "paddd", "paddq", "pshufd", "add", "sub", "and", "or", "imul", "inc", "dec", "neg", "not", "shl", "shr", "sar", "movd"):
        if mnemonic.startswith(prefix):
            return prefix
    if mnemonic.startswith("j"):
        return "jmp"
    return mnemonic


def _x86_width(instruction: Instruction, destination: Operand) -> int:
    if instruction.mnemonic in X86_WIDTHS:
        return X86_WIDTHS[instruction.mnemonic]
    if instruction.mnemonic.endswith("q"):
        return 8
    if instruction.mnemonic.endswith("l"):
        return 4
    return destination.width


def effect_x86(instruction: Instruction, abi: str) -> Effect:
    """Reads and writes of one AT&T instruction: the last operand is the destination, memory operands read their address registers, lea reads only the address."""
    root = _x86_root(instruction.mnemonic)
    operands = [parse_operand_x86(p) for p in split_operands_x86(instruction.operands)] if instruction.operands else []
    eff = Effect()
    if root == "push":
        eff.kind = "push"
        eff.sp_delta = -8
        if operands and operands[0].kind == "reg":
            eff.reads.append(operands[0].register or "")
        return eff
    if root == "pop":
        eff.kind = "pop"
        eff.sp_delta = 8
        if operands and operands[0].kind == "reg":
            eff.writes.append(operands[0].register or "")
        return eff
    if root == "call":
        eff.kind = "call"
        for operand in operands:
            if operand.kind == "reg":
                eff.reads.append(operand.register or "")
            elif operand.kind == "mem":
                eff.address_reads.extend(operand.address_registers())
        eff.writes.extend(sorted(CALLER_SAVED[abi]))
        return eff
    if root == "ret":
        eff.kind = "ret"
        return eff
    if root == "jmp":
        eff.kind = "jump"
        for operand in operands:
            if operand.kind == "reg":
                eff.reads.append(operand.register or "")
        return eff
    if root == "nop" or not operands:
        eff.kind = "nop" if root == "nop" else "other"
        return eff
    destination = operands[-1]
    sources = operands[:-1]
    if (root in ("xor", "pxor") or instruction.mnemonic == "xorps") and len(operands) == 2 and operands[0] == operands[1] and destination.kind == "reg":
        eff.kind = "zero"
        eff.writes.append(destination.register or "")
        return eff
    write_only = root in ("mov", "movs", "movz", "movabs", "lea", "set", "cvtsi2sd", "cvtss2sd", "cvtsd2ss", "cvttsd2si", "movd", "pshufd") or (root == "imul" and len(operands) == 3)
    read_only = root in ("cmp", "test")
    for operand in sources:
        if operand.kind == "reg":
            eff.reads.append(operand.register or "")
        elif operand.kind == "mem":
            eff.address_reads.extend(operand.address_registers())
            if root == "lea":
                eff.addresses.append(operand)
            else:
                eff.loads.append(operand)
    if destination.kind == "reg":
        if read_only or not write_only:
            eff.reads.append(destination.register or "")
        if not read_only:
            eff.writes.append(destination.register or "")
    elif destination.kind == "mem":
        eff.address_reads.extend(destination.address_registers())
        if read_only or not write_only:
            eff.loads.append(destination)
        if not read_only:
            value = sources[0].register if sources and sources[0].kind == "reg" else None
            immediate = sources[0].immediate if sources and sources[0].kind == "imm" else None
            eff.stores.append((destination, value, _x86_width(instruction, destination), immediate))
    if root in ("add", "sub") and destination.kind == "reg" and destination.register == "rsp" and sources and sources[0].kind == "imm":
        amount = sources[0].immediate or 0
        eff.sp_delta = amount if root == "add" else -amount
        eff.kind = "sp-adjust"
    if destination.kind == "reg" and destination.register == "rbp" and sources and ((root == "mov" and sources[0].kind == "reg" and sources[0].register == "rsp") or (root == "lea" and sources[0].kind == "mem" and sources[0].base == "rsp")):
        eff.kind = "set-frame-pointer"
    return eff


ARM_STORES = {"str", "strb", "strh", "stur", "sturb", "sturh", "stp", "stnp"}
ARM_LOADS = {"ldr", "ldrb", "ldrh", "ldrsb", "ldrsh", "ldrsw", "ldur", "ldurb", "ldurh", "ldursw", "ldp", "ldnp"}
ARM_READ_ONLY = {"cmp", "cmn", "tst", "ccmp", "ccmn", "cbz", "cbnz", "tbz", "tbnz", "fcmp", "fcmpe"}


def effect_arm(instruction: Instruction, abi: str) -> Effect:
    """Reads and writes of one AArch64 instruction: the first operand is the destination except for stores, compares, and branches."""
    mnemonic = instruction.mnemonic
    operands = parse_operands_arm(instruction.operands) if instruction.operands else []
    eff = Effect()
    if mnemonic == "ret":
        eff.kind = "ret"
        eff.reads.append("x30")
        return eff
    if mnemonic in ("bl", "blr"):
        eff.kind = "call"
        for operand in operands:
            if operand.kind == "reg" and operand.register:
                eff.reads.append(operand.register)
        eff.writes.extend(sorted(CALLER_SAVED[abi]))
        return eff
    if mnemonic == "b" or mnemonic.startswith("b."):
        eff.kind = "jump"
        return eff
    mem = next((o for o in operands if o.kind == "mem"), None)
    regs = [o for o in operands if o.kind == "reg"]
    if mem is not None:
        if mem.base:
            eff.address_reads.append(mem.base)
        if mem.pre_index or mem.post_index is not None:
            eff.writes.append(mem.base or "")
            if mem.base == "sp":
                if mem.pre_index:
                    eff.sp_delta = mem.displacement
                else:
                    eff.post_sp_delta = mem.post_index or 0
                eff.kind = "sp-adjust"
        if mnemonic in ARM_STORES:
            offset = 0 if mem.pre_index else mem.displacement
            for slot, reg in enumerate(regs):
                if reg.register:
                    eff.reads.append(reg.register)
                eff.stores.append((Operand("mem", base=mem.base, displacement=offset + reg.width * slot), reg.register, reg.width, None))
            if eff.kind != "sp-adjust":
                eff.kind = "store"
        elif mnemonic in ARM_LOADS:
            for reg in regs:
                if reg.register:
                    eff.writes.append(reg.register)
            eff.loads.append(Operand("mem", base=mem.base, displacement=0 if mem.pre_index else mem.displacement))
            if eff.kind != "sp-adjust":
                eff.kind = "load"
        return eff
    if mnemonic in ARM_READ_ONLY:
        eff.kind = "compare"
        eff.reads.extend(r.register for r in regs if r.register)
        return eff
    if not regs:
        return eff
    destination = regs[0]
    for reg in regs[1:]:
        if reg.register:
            eff.reads.append(reg.register)
    if mnemonic in ("movk", "bfi", "bfxil", "ins") and destination.register:
        eff.reads.append(destination.register)
    if destination.register:
        eff.writes.append(destination.register)
    immediate = next((o for o in operands if o.kind == "imm"), None)
    if mnemonic in ("add", "sub") and destination.register == "sp" and len(regs) >= 2 and regs[1].register == "sp" and immediate and immediate.immediate is not None:
        eff.sp_delta = immediate.immediate if mnemonic == "add" else -immediate.immediate
        eff.kind = "sp-adjust"
    if destination.register == "x29" and len(regs) >= 2 and regs[1].register == "sp" and mnemonic in ("mov", "add"):
        eff.kind = "set-frame-pointer"
    if mnemonic in ("add", "mov") and len(regs) >= 2 and regs[1].register == "sp" and destination.register not in ("sp", "x29"):
        eff.addresses.append(Operand("mem", base="sp", displacement=immediate.immediate if immediate and immediate.immediate is not None else 0))
    return eff


def effect(instruction: Instruction, abi: str) -> Effect:
    return effect_x86(instruction, abi) if abi in X86_ABIS else effect_arm(instruction, abi)


@dataclass
class Check:
    rule: str
    expected: Any
    observed: Any
    agree: bool

    def to_dict(self) -> dict[str, Any]:
        return {"rule": self.rule, "expected": self.expected, "observed": self.observed, "agree": self.agree}


@dataclass
class FunctionAnalysis:
    name: str
    abi: str
    instructions: list[Instruction]
    prologue: list[Instruction] = field(default_factory=list)
    epilogue: list[Instruction] = field(default_factory=list)
    frame_size: int = 0
    saved: list[tuple[str, int]] = field(default_factory=list)
    frame_pointer: int | None = None
    param_registers: list[str] = field(default_factory=list)
    stack_slots: list[int] = field(default_factory=list)
    home_stores: list[tuple[str, int]] = field(default_factory=list)
    spills: list[tuple[str, int, int]] = field(default_factory=list)
    frame_addresses: list[int] = field(default_factory=list)
    return_registers: list[str] = field(default_factory=list)
    hidden_pointer: str | None = None
    below_sp: list[int] = field(default_factory=list)
    calls: list[tuple[str | None, int]] = field(default_factory=list)
    outgoing_registers: list[str] = field(default_factory=list)
    outgoing_stores: list[tuple[int, int | None]] = field(default_factory=list)
    outgoing_addresses: list[tuple[int, str]] = field(default_factory=list)
    al_zeroed: bool = False
    reads_al: bool = False
    callee_saved_written: list[str] = field(default_factory=list)
    depth_at_exit: int = 0
    max_depth: int = 0
    tail_call: str | None = None
    checks: list[Check] = field(default_factory=list)

    @property
    def epilogue_mirrors(self) -> bool:
        return self.depth_at_exit == 0 and _restores_match(self)

    def to_dict(self) -> dict[str, Any]:
        return {
            "function": self.name,
            "abi": self.abi,
            "instructions": len(self.instructions),
            "prologue": [f"{i.hex}  {i.text}" for i in self.prologue],
            "epilogue": [f"{i.hex}  {i.text}" for i in self.epilogue],
            "frameBytes": self.frame_size,
            "savedRegisters": [{"register": r, "entryOffset": o} for r, o in self.saved],
            "framePointerAt": self.frame_pointer,
            "parameterRegisters": self.param_registers,
            "stackArgumentOffsets": sorted(self.stack_slots),
            "homeStores": [{"register": r, "entryOffset": o} for r, o in self.home_stores],
            "spills": [{"register": r, "entryOffset": o, "bytes": n} for r, o, n in self.spills],
            "frameAddressesTaken": self.frame_addresses,
            "returnRegisters": self.return_registers,
            "hiddenPointer": self.hidden_pointer,
            "bytesBelowStackPointer": max(self.below_sp) if self.below_sp else 0,
            "calls": [{"callee": c, "depth": d} for c, d in self.calls],
            "tailCall": self.tail_call,
            "outgoingRegisters": self.outgoing_registers,
            "outgoingStores": [{"callOffset": o, "value": v} for o, v in sorted(self.outgoing_stores)],
            "outgoingAddresses": [{"callOffset": o, "register": r} for o, r in self.outgoing_addresses],
            "alZeroed": self.al_zeroed,
            "readsAl": self.reads_al,
            "calleeSavedWritten": self.callee_saved_written,
            "deepestStackBytes": self.max_depth,
            "epilogueMirrorsPrologue": self.epilogue_mirrors,
            "checks": [c.to_dict() for c in self.checks],
            "agree": sum(1 for c in self.checks if c.agree),
            "disagree": [c.rule for c in self.checks if not c.agree],
        }


def _restores_match(analysis: FunctionAnalysis) -> bool:
    saved = [r for r, _ in analysis.saved if r in CALLEE_SAVED[analysis.abi]]
    restored: list[str] = []
    for instruction in analysis.epilogue:
        eff = effect(instruction, analysis.abi)
        restored.extend(r for r in eff.writes if r in CALLEE_SAVED[analysis.abi])
    if analysis.abi in X86_ABIS:
        return restored == list(reversed(saved))
    return set(restored) >= set(saved)


def _is_prologue(eff: Effect, abi: str) -> bool:
    if eff.kind in ("push", "set-frame-pointer"):
        return True
    if eff.kind == "sp-adjust" and eff.sp_delta < 0:
        return True
    if abi in ARM_ABIS and eff.kind == "store":
        stored = {r for _, r, _, _ in eff.stores if r}
        return bool(eff.stores) and eff.stores[0][0].base == "sp" and stored <= CALLEE_SAVED[abi]
    return False


def body_end(instructions: list[Instruction], abi: str) -> tuple[int, str | None]:
    """Index of the first return, or of a tail jump to another symbol, and the tail-call target when there is one."""
    for position, instruction in enumerate(instructions):
        if instruction.mnemonic in ("retq", "ret"):
            return position, None
        if instruction.mnemonic in ("jmp", "b") and instruction.relocation and not instruction.relocation.startswith("."):
            return position, instruction.relocation
    return len(instructions) - 1, None


def analyze_function(name: str, instructions: list[Instruction], abi: str) -> FunctionAnalysis:
    """Walk the listing once up to the first exit: prologue and frame, reads before writes, stores into the frame, calls, and the return register."""
    analysis = FunctionAnalysis(name, abi, instructions)
    x86 = abi in X86_ABIS
    end, tail = body_end(instructions, abi)
    analysis.tail_call = tail
    depth = 0
    frame_depth = 0
    written: set[str] = set()
    arg_class = set(INT_ARG_REGS[abi]) | set(FLOAT_ARG_REGS[abi]) | {HIDDEN_RETURN_REG[abi]}
    callee_saved = CALLEE_SAVED[abi]
    prologue_open = True
    live_outgoing: dict[str, bool] = {}
    stores_entry: list[tuple[int, int | None]] = []
    addresses_entry: list[tuple[int, str]] = []
    for position, instruction in enumerate(instructions[: end + 1]):
        eff = effect(instruction, abi)
        in_prologue = prologue_open and position < 12 and _is_prologue(eff, abi)
        interleaved = not x86 and eff.kind in ("compare", "other") and position < 6 and not eff.loads and not eff.stores
        if prologue_open and not in_prologue and not interleaved:
            prologue_open = False
        if in_prologue:
            analysis.prologue.append(instruction)
        for register in eff.all_reads:
            if register in arg_class and register not in written and register not in analysis.param_registers:
                analysis.param_registers.append(register)
        for register in eff.reads:
            live_outgoing.pop(register, None)
        if x86 and instruction.mnemonic == "testb" and "%al" in instruction.operands and "rax" not in written:
            analysis.reads_al = True
        if eff.kind == "push":
            depth += 8
            if in_prologue:
                analysis.saved.append((eff.reads[0] if eff.reads else "imm", -depth))
            elif instruction.operands.startswith("$"):
                stores_entry.append((-depth, parse_operand_x86(instruction.operands).immediate))
        elif eff.kind == "pop":
            depth -= 8
        elif eff.kind == "sp-adjust":
            depth -= eff.sp_delta
        if eff.kind == "set-frame-pointer":
            immediate = [o for o in parse_operands_arm(instruction.operands) if o.kind == "imm"] if not x86 else []
            analysis.frame_pointer = -depth + ((immediate[0].immediate or 0) if immediate else 0)
        for operand, value, width, immediate in eff.stores:
            entry = _entry_offset(operand, depth, analysis.frame_pointer)
            if entry is None:
                continue
            if operand.base in ("rsp", "sp") and not in_prologue:
                stores_entry.append((entry, immediate))
            if value in callee_saved and in_prologue and not x86:
                analysis.saved.append((value, entry))
            elif value in arg_class and value not in written:
                if abi == WIN64 and 8 <= entry < 40:
                    analysis.home_stores.append((value, entry))
                else:
                    analysis.spills.append((value, entry, width))
        for operand in eff.loads + [s[0] for s in eff.stores]:
            entry = _entry_offset(operand, depth, analysis.frame_pointer)
            if entry is None:
                continue
            below = -(entry + depth)
            if below > 0:
                analysis.below_sp.append(below)
        for operand in eff.loads:
            entry = _entry_offset(operand, depth, analysis.frame_pointer)
            if entry is not None and entry >= STACK_ARG_BASE[abi] and entry not in analysis.stack_slots:
                analysis.stack_slots.append(entry)
        for operand in eff.addresses:
            entry = _entry_offset(operand, depth, analysis.frame_pointer)
            if entry is not None:
                analysis.frame_addresses.append(entry)
                if eff.writes:
                    addresses_entry.append((entry, eff.writes[0]))
        depth -= eff.post_sp_delta
        analysis.max_depth = max(analysis.max_depth, depth)
        if in_prologue:
            frame_depth = max(frame_depth, depth)
        if eff.kind == "call" or position == end and tail:
            analysis.calls.append((instruction.relocation, depth))
            address_registers = {r for _, r in addresses_entry}
            analysis.outgoing_registers = [r for r in live_outgoing if not (not x86 and r == "x8" and r not in address_registers)]
            analysis.outgoing_stores = [(o + depth, v) for o, v in stores_entry]
            analysis.outgoing_addresses = [(o + depth, r) for o, r in addresses_entry]
            stores_entry = []
            addresses_entry = []
            live_outgoing = {}
        for register in eff.writes:
            if register in arg_class and eff.kind != "call":
                live_outgoing[register] = True
            if register in callee_saved and register not in analysis.callee_saved_written and eff.kind not in ("call", "pop", "load", "sp-adjust"):
                analysis.callee_saved_written.append(register)
            written.add(register)
        if eff.kind == "zero" and x86 and eff.writes == ["rax"]:
            analysis.al_zeroed = True
        if x86 and instruction.mnemonic == "movb" and instruction.operands == "$0x0, %al":
            analysis.al_zeroed = True
            written.add("rax")
    analysis.depth_at_exit = depth
    analysis.frame_size = frame_depth
    analysis.hidden_pointer = _hidden_pointer(instructions[: end + 1], abi, analysis.param_registers)
    analysis.return_registers = _return_registers(instructions[: end + 1], abi, analysis.hidden_pointer, tail)
    analysis.epilogue = _epilogue(instructions, end, abi)
    analysis.checks = run_checks(analysis)
    return analysis


def _entry_offset(operand: Operand, depth: int, frame_pointer: int | None) -> int | None:
    if operand.base in ("rsp", "sp"):
        return operand.displacement - depth
    if operand.base in ("rbp", "x29") and frame_pointer is not None:
        return frame_pointer + operand.displacement
    return None


def _hidden_pointer(instructions: list[Instruction], abi: str, param_regs: list[str]) -> str | None:
    pointer = HIDDEN_RETURN_REG[abi]
    if pointer not in param_regs:
        return None
    aliases = {pointer}
    stores_through = 0
    copied_to_return = abi in ARM_ABIS
    for instruction in instructions:
        eff = effect(instruction, abi)
        for operand, _, _, _ in eff.stores:
            if operand.base in aliases:
                stores_through += 1
        if instruction.mnemonic in ("mov", "movq") and len(eff.reads) == 1 and eff.reads[0] in aliases and len(eff.writes) == 1:
            if eff.writes[0] in INT_RETURN_REGS[abi][:1]:
                copied_to_return = True
            elif abi in ARM_ABIS:
                aliases.add(eff.writes[0])
    return pointer if stores_through and copied_to_return else None


def _return_registers(instructions: list[Instruction], abi: str, hidden: str | None, tail: str | None) -> list[str]:
    """A register carries the result when its last access before the exit is a write; a call counts as a write of the volatile set."""
    candidates = INT_RETURN_REGS[abi] + FLOAT_RETURN_REGS[abi]
    last_write: dict[str, str] = {}
    for instruction in instructions:
        eff = effect(instruction, abi)
        for register in eff.reads:
            last_write.pop(register, None)
        for register in eff.writes:
            if register in candidates:
                last_write[register] = "callee" if eff.kind == "call" else instruction.text
    if tail:
        return [f"tail call to {tail}"]
    explicit = [r for r in candidates if last_write.get(r) not in (None, "callee")]
    if explicit:
        return explicit
    if hidden and abi in ARM_ABIS:
        return [f"{hidden} (indirect result)"]
    if any(last_write.get(r) == "callee" for r in candidates):
        return [f"{INT_RETURN_REGS[abi][0]} or {FLOAT_RETURN_REGS[abi][0]} (from callee)"]
    return []


def _epilogue(instructions: list[Instruction], end: int, abi: str) -> list[Instruction]:
    if instructions[end].mnemonic not in ("retq", "ret"):
        return []
    epilogue = [instructions[end]]
    k = end - 1
    while k >= 0:
        eff = effect(instructions[k], abi)
        restoring = eff.kind == "pop" or (eff.kind == "sp-adjust" and (eff.sp_delta > 0 or eff.post_sp_delta > 0)) or (eff.kind == "load" and abi in ARM_ABIS and eff.loads and eff.loads[0].base == "sp")
        if not restoring and not (abi in X86_ABIS and instructions[k].text == "movq %rbp, %rsp"):
            break
        epilogue.insert(0, instructions[k])
        k -= 1
    return epilogue


def classify(type_name: str) -> tuple[int, str]:
    return TYPES[type_name]


def expected_locations(abi: str, name: str) -> dict[str, Any]:
    """Apply the parameter-passing rules of one ABI to a C signature and return the register and stack locations."""
    return_type, params = SIGNATURES[name]
    names = PARAM_NAMES.get(name, [])
    ints = list(INT_ARG_REGS[abi])
    floats = list(FLOAT_ARG_REGS[abi])
    assignments: list[dict[str, Any]] = []
    hidden: str | None = None
    stack_offsets: list[int] = []
    ret_size, ret_kind = classify(return_type)
    if ret_kind == "struct" and (ret_size > 16 or (abi == WIN64 and ret_size not in (1, 2, 4, 8))):
        hidden = HIDDEN_RETURN_REG[abi]
        if abi in X86_ABIS:
            ints.pop(0)
        return_regs = [f"{hidden} (indirect result)"] if abi in ARM_ABIS else ["rax"]
    elif ret_kind == "struct":
        return_regs = INT_RETURN_REGS[abi][: ret_size // 8]
    elif ret_kind == "float":
        return_regs = [FLOAT_RETURN_REGS[abi][0]]
    else:
        return_regs = [INT_RETURN_REGS[abi][0]]
    position = 1 if hidden and abi == WIN64 else 0
    next_stack = STACK_ARG_BASE[abi]
    variadic = False
    for k, type_name in enumerate(params):
        label = names[k] if k < len(names) else f"p{k}"
        if type_name == "...":
            variadic = True
            break
        size, kind = classify(type_name)
        location: list[str] = []
        if abi == WIN64:
            if position < 4:
                if kind == "float":
                    location = [FLOAT_ARG_REGS[WIN64][position]]
                elif kind == "struct" and size not in (1, 2, 4, 8):
                    location = [f"{INT_ARG_REGS[WIN64][position]} (pointer to copy)"]
                else:
                    location = [INT_ARG_REGS[WIN64][position]]
            else:
                location = [f"stack+{40 + 8 * (position - 4)}"]
                stack_offsets.append(40 + 8 * (position - 4))
            position += 1
        else:
            if kind == "float" and floats:
                location = [floats.pop(0)]
            elif kind == "int" and ints:
                location = [ints.pop(0)]
            elif kind == "struct" and size <= 16 and len(ints) >= size // 8:
                location = [ints.pop(0) for _ in range(size // 8)]
            elif kind == "struct" and abi in ARM_ABIS and ints:
                location = [f"{ints.pop(0)} (pointer to copy)"]
            else:
                for _ in range(max(1, size // 8)):
                    location.append(f"stack+{next_stack}")
                    stack_offsets.append(next_stack)
                    next_stack += 8
        assignments.append({"name": label, "type": type_name, "location": location})
    registers = [loc.split(" ")[0] for a in assignments for loc in a["location"] if not loc.startswith("stack")]
    if hidden:
        registers.insert(0, hidden)
    save_area: list[str] = []
    if variadic:
        if abi == SYSV:
            save_area = ints + floats
        elif abi in (WIN64, AAPCS64):
            save_area = ints if abi == WIN64 else ints + floats
    return {
        "parameters": assignments,
        "hidden": hidden,
        "registers": registers,
        "variadicSaveArea": save_area,
        "stackOffsets": stack_offsets,
        "returnRegisters": return_regs,
        "variadic": variadic,
    }


def run_checks(analysis: FunctionAnalysis) -> list[Check]:
    """Compare every inference with the rule it rests on; each Check names the rule, the expected value, and what the bytes showed."""
    abi = analysis.abi
    checks: list[Check] = []
    if analysis.name in CALLEE_SHAPES:
        checks.extend(_caller_checks(analysis))
    elif analysis.name in SIGNATURES:
        checks.extend(_callee_checks(analysis))
    saved_set = {r for r, _ in analysis.saved if r in CALLEE_SAVED[abi]}
    written = set(analysis.callee_saved_written)
    checks.append(Check(RULES["callee-saved"][abi], sorted(written, key=_reg_sort), sorted(saved_set, key=_reg_sort), written <= saved_set))
    if analysis.calls:
        depths = [d for _, d in analysis.calls]
        if analysis.tail_call:
            checks.append(Check(RULES["alignment"][abi], "tail call with the stack pointer back at its entry value", [f"{d} bytes deep at the jump" for d in depths], all(d == 0 for d in depths)))
        elif abi in X86_ABIS:
            checks.append(Check(RULES["alignment"][abi], "(rsp + 8) % 16 == 0 at every call", [f"{d} bytes deep: ({d} + 8) % 16 = {(d + 8) % 16}" for d in depths], all((d + 8) % 16 == 0 for d in depths)))
        else:
            checks.append(Check(RULES["alignment"][abi], "sp % 16 == 0 at every bl", [f"{d} bytes deep" for d in depths], all(d % 16 == 0 for d in depths)))
        if abi == WIN64 and not analysis.tail_call:
            checks.append(Check(RULES["shadow"][abi], "at least 32 bytes between rsp and the return address at every call", depths, all(d >= 32 for d in depths)))
    if analysis.below_sp:
        extent = max(analysis.below_sp)
        checks.append(Check(RULES["red-zone"][abi], f"at most {RED_ZONE_BYTES[abi]} bytes below the stack pointer", f"{extent} bytes below the stack pointer", extent <= RED_ZONE_BYTES[abi]))
    elif abi in (WIN64, AAPCS64):
        checks.append(Check(RULES["red-zone"][abi], "no access below the stack pointer", "none", True))
    if analysis.frame_pointer is not None:
        record = dict(analysis.saved)
        if abi in X86_ABIS:
            checks.append(Check(RULES["frame-pointer"][abi], "rbp saved at entry offset -8, then rbp = rsp", f"rbp = entry offset {analysis.frame_pointer}, saved rbp at {record.get('rbp')}", record.get("rbp") == -8 and analysis.frame_pointer == -8))
        else:
            ok = record.get("x29") == analysis.frame_pointer and record.get("x30") == analysis.frame_pointer + 8
            checks.append(Check(RULES["frame-pointer"][abi], "x29 points at the saved x29, with the saved x30 eight bytes above", f"x29 = entry offset {analysis.frame_pointer}; saved x29 at {record.get('x29')}, x30 at {record.get('x30')}", ok))
    checks.append(Check(RULES["epilogue"], "mirror of the prologue, stack pointer back at entry", "mirror" if analysis.epilogue_mirrors else f"stack pointer {analysis.depth_at_exit} bytes off at exit or registers not restored", analysis.epilogue_mirrors))
    return checks


def _callee_checks(analysis: FunctionAnalysis) -> list[Check]:
    abi = analysis.abi
    checks: list[Check] = []
    expected = expected_locations(abi, analysis.name)
    exp_regs = set(expected["registers"]) | set(expected["variadicSaveArea"])
    obs_regs = set(analysis.param_registers)
    rule_key = "float-regs" if any(classify(t)[1] == "float" for t in SIGNATURES[analysis.name][1] if t != "...") else "int-regs"
    checks.append(Check(RULES[rule_key][abi], sorted(exp_regs, key=_reg_sort), sorted(obs_regs, key=_reg_sort), exp_regs == obs_regs))
    if expected["stackOffsets"] or analysis.stack_slots:
        checks.append(Check(RULES["stack-args"][abi], expected["stackOffsets"], sorted(analysis.stack_slots), set(expected["stackOffsets"]) == set(analysis.stack_slots)))
    if expected["variadic"]:
        if abi == SYSV:
            checks.append(Check(RULES["variadic"][abi], "callee reads %al before writing it", "reads %al" if analysis.reads_al else "does not read %al", analysis.reads_al))
        elif abi == WIN64:
            homes = sorted(o for _, o in analysis.home_stores)
            checks.append(Check(RULES["variadic"][abi], [16, 24, 32], homes, homes == [16, 24, 32]))
        elif abi == AAPCS64:
            spilled = {r for r, _, _ in analysis.spills}
            checks.append(Check(RULES["variadic"][abi], sorted(set(expected["variadicSaveArea"]), key=_reg_sort), sorted(spilled & set(expected["variadicSaveArea"]), key=_reg_sort), set(expected["variadicSaveArea"]) <= spilled))
        else:
            checks.append(Check(RULES["variadic"][abi], "va_list starts at the caller's stack pointer (entry offset 0)", analysis.frame_addresses, 0 in analysis.frame_addresses))
    observed = analysis.return_registers
    if expected["hidden"] and abi in X86_ABIS:
        checks.append(Check(RULES["return"][abi], f"{expected['hidden']} copied to rax, result stored through it", f"{analysis.hidden_pointer} copied to rax" if analysis.hidden_pointer else observed, analysis.hidden_pointer == expected["hidden"] and "rax" in observed))
    else:
        checks.append(Check(RULES["return"][abi], expected["returnRegisters"], observed, set(expected["returnRegisters"]) == set(observed)))
    return checks


def _caller_checks(analysis: FunctionAnalysis) -> list[Check]:
    abi = analysis.abi
    checks: list[Check] = []
    shape = CALLEE_SHAPES[analysis.name]
    expected = expected_locations(abi, shape)
    exp_regs = set(expected["registers"])
    if expected["variadic"]:
        exp_regs |= {"rsi", "rdx", "rcx"} if abi == SYSV else {"rdx", "r8", "r9"} if abi == WIN64 else {"x1", "x2", "x3"} if abi == AAPCS64 else set()
    obs_regs = set(analysis.outgoing_registers)
    rule_key = "float-regs" if any(classify(t)[1] == "float" for t in SIGNATURES[shape][1] if t != "...") else "int-regs"
    checks.append(Check(RULES[rule_key][abi], sorted(exp_regs, key=_reg_sort), sorted(obs_regs, key=_reg_sort), exp_regs == obs_regs))
    call_relative = [o - RETURN_ADDRESS_BYTES[abi] for o in expected["stackOffsets"]]
    observed_stack = sorted(o for o, v in analysis.outgoing_stores if v is not None or o in call_relative)
    if call_relative:
        checks.append(Check(RULES["stack-args"][abi], call_relative, observed_stack, set(call_relative) <= set(observed_stack)))
    if expected["variadic"]:
        if abi == SYSV:
            checks.append(Check(RULES["variadic"][abi], "%al set to 0 before the call (no vector registers used)", "al zeroed" if analysis.al_zeroed else "al not set", analysis.al_zeroed))
        elif abi == APPLE_ARM64:
            slots = sorted(o for o, _ in analysis.outgoing_stores)
            checks.append(Check(RULES["variadic"][abi], [0, 8, 16], slots, slots == [0, 8, 16]))
        elif abi == AAPCS64:
            checks.append(Check(RULES["variadic"][abi], "unnamed arguments stay in w1, w2, w3", sorted(obs_regs, key=_reg_sort), {"x1", "x2", "x3"} <= obs_regs))
    if expected["hidden"]:
        pointer = expected["hidden"]
        checks.append(Check(RULES["return"][abi], f"caller passes the address of its result buffer in {pointer}", [f"{pointer} = address of call offset {o}" for o, r in analysis.outgoing_addresses if r == pointer] or sorted(obs_regs), any(r == pointer for _, r in analysis.outgoing_addresses)))
    else:
        checks.append(Check(RULES["return"][abi], f"result of {shape} arrives in {expected['returnRegisters']}", analysis.return_registers, bool(analysis.return_registers)))
    return checks


def _reg_sort(name: str) -> tuple[int, int, str]:
    order = ["rdi", "rsi", "rdx", "rcx", "r8", "r9", "rax", "rbx", "rbp", "r10", "r11", "r12", "r13", "r14", "r15"]
    if name in order:
        return (0, order.index(name), name)
    match = re.match(r"^(x|v|xmm)(\d+)", name)
    if match:
        return ({"x": 1, "v": 2, "xmm": 3}[match.group(1)], int(match.group(2)), name)
    return (9, 0, name)


def load_fixture(stem: str) -> tuple[ObjectInfo, dict[str, list[Instruction]]]:
    info = describe_object(FIXTURES / f"{stem}.o")
    listing_path = FIXTURES / f"{stem}.objdump.txt"
    if not listing_path.exists():
        listing_path = FIXTURES / f"{stem.replace('-eh', '')}.objdump.txt"
    return info, parse_listing(listing_path.read_text(), info.functions).functions


def analyze_fixture(stem: str) -> dict[str, FunctionAnalysis]:
    info, listing = load_fixture(stem)
    return {name: analyze_function(name, instructions, info.abi) for name, instructions in listing.items() if name in SIGNATURES}


UWOP_NAMES = {0: "UWOP_PUSH_NONVOL", 1: "UWOP_ALLOC_LARGE", 2: "UWOP_ALLOC_SMALL", 3: "UWOP_SET_FPREG", 4: "UWOP_SAVE_NONVOL", 5: "UWOP_SAVE_NONVOL_FAR", 8: "UWOP_SAVE_XMM128", 9: "UWOP_SAVE_XMM128_FAR", 10: "UWOP_PUSH_MACHFRAME"}
SEH_REGISTERS = ["rax", "rcx", "rdx", "rbx", "rsp", "rbp", "rsi", "rdi", "r8", "r9", "r10", "r11", "r12", "r13", "r14", "r15"]


def decode_unwind_info(xdata: bytes, offset: int) -> dict[str, Any]:
    """UNWIND_INFO from the Microsoft x64 exception handling page: Version:3, Flags:5, SizeOfProlog, CountOfCodes, FrameRegister:4, FrameOffset:4, then UNWIND_CODE slots."""
    first, size_of_prolog, count, frame = xdata[offset], xdata[offset + 1], xdata[offset + 2], xdata[offset + 3]
    codes: list[dict[str, Any]] = []
    k = 0
    base = offset + 4
    while k < count:
        code_offset = xdata[base + 2 * k]
        op = xdata[base + 2 * k + 1] & 0x0F
        info = xdata[base + 2 * k + 1] >> 4
        entry: dict[str, Any] = {"prologOffset": code_offset, "op": UWOP_NAMES.get(op, str(op))}
        if op == 0:
            entry["register"] = SEH_REGISTERS[info]
            k += 1
        elif op == 2:
            entry["bytes"] = info * 8 + 8
            k += 1
        elif op == 1:
            if info == 0:
                entry["bytes"] = struct.unpack_from("<H", xdata, base + 2 * (k + 1))[0] * 8
                k += 2
            else:
                entry["bytes"] = struct.unpack_from("<I", xdata, base + 2 * (k + 1))[0]
                k += 3
        elif op in (4, 8):
            entry["register"] = SEH_REGISTERS[info] if op == 4 else f"xmm{info}"
            entry["offset"] = struct.unpack_from("<H", xdata, base + 2 * (k + 1))[0] * (8 if op == 4 else 16)
            k += 2
        elif op in (5, 9):
            entry["register"] = SEH_REGISTERS[info] if op == 5 else f"xmm{info}"
            entry["offset"] = struct.unpack_from("<I", xdata, base + 2 * (k + 1))[0]
            k += 3
        else:
            entry["info"] = info
            k += 1
        codes.append(entry)
    return {"version": first & 0x7, "flags": first >> 3, "sizeOfProlog": size_of_prolog, "countOfCodes": count, "frameRegister": SEH_REGISTERS[frame & 0xF] if frame & 0xF else None, "frameOffset": (frame >> 4) * 16, "codes": codes}


def seh_table(info: ObjectInfo) -> list[dict[str, Any]]:
    """RUNTIME_FUNCTION entries of .pdata; in a relocatable object the fields hold section offsets into .text and .xdata."""
    pdata = info.sections.get(".pdata")
    xdata = info.sections.get(".xdata")
    if not pdata or xdata is None:
        return []
    by_offset = {f.offset: f.name for f in info.functions}
    entries = []
    for k in range(len(pdata) // 12):
        begin, end, unwind = struct.unpack_from("<III", pdata, 12 * k)
        entries.append({"function": by_offset.get(begin, f"0x{begin:x}"), "begin": begin, "end": end, "unwindData": unwind, "unwind": decode_unwind_info(xdata, unwind)})
    return entries


def seh_cross_check(stem: str = "convention-x86_64-windows-O2-seh") -> list[dict[str, Any]]:
    """The compiler's own unwind codes name the pushes and the allocation; compare them with the prologue read from the bytes."""
    info, listing = load_fixture(stem)
    results = []
    for entry in seh_table(info):
        name = entry["function"]
        analysis = analyze_function(name, listing[name], WIN64)
        pushes = [c["register"] for c in entry["unwind"]["codes"] if c["op"] == "UWOP_PUSH_NONVOL"]
        allocs = sum(c.get("bytes", 0) for c in entry["unwind"]["codes"] if c["op"] in ("UWOP_ALLOC_SMALL", "UWOP_ALLOC_LARGE"))
        observed_pushes = [r for r, _ in analysis.saved if r in CALLEE_SAVED[WIN64]]
        observed_alloc = analysis.frame_size - 8 * len(observed_pushes)
        prologue_bytes = sum(i.length for i in analysis.prologue)
        agree = list(reversed(pushes)) == observed_pushes and allocs == observed_alloc and entry["unwind"]["sizeOfProlog"] == prologue_bytes
        results.append({"function": name, "sizeOfProlog": entry["unwind"]["sizeOfProlog"], "prologueBytes": prologue_bytes, "unwindPushes": pushes, "observedPushes": observed_pushes, "unwindAllocBytes": allocs, "observedAllocBytes": observed_alloc, "codes": entry["unwind"]["codes"], "agree": agree})
    return results


FDE_HEADER = re.compile(r"FDE cie=\S+ pc=([0-9a-f]+)\.\.\.([0-9a-f]+)")


def parse_eh_frame(text: str) -> list[dict[str, Any]]:
    """FDE records from llvm-dwarfdump --eh-frame: the CFA offsets and the DW_CFA_offset rules that name each saved register."""
    frames: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for line in text.splitlines():
        header = FDE_HEADER.search(line)
        if header:
            current = {"start": int(header.group(1), 16), "end": int(header.group(2), 16), "cfaOffsets": [], "savedAtCfa": {}, "cfaRegisters": []}
            frames.append(current)
            continue
        if current is None:
            continue
        match = re.search(r"DW_CFA_def_cfa_offset: \+(\d+)", line)
        if match:
            current["cfaOffsets"].append(int(match.group(1)))
        match = re.search(r"DW_CFA_def_cfa: (\w+) \+(\d+)", line)
        if match:
            current["cfaRegisters"].append(_dwarf_register(match.group(1)))
            current["cfaOffsets"].append(int(match.group(2)))
        match = re.search(r"DW_CFA_offset: (\w+) (-?\d+)", line)
        if match:
            current["savedAtCfa"][_dwarf_register(match.group(1))] = int(match.group(2))
    return frames


def _dwarf_register(name: str) -> str:
    match = re.match(r"^W(\d+)$", name)
    if match:
        return f"x{match.group(1)}"
    if name == "WSP":
        return "sp"
    return name.lower()


def eh_frame_cross_check(stem: str) -> list[dict[str, Any]]:
    """For every function with an FDE, the saved-register offsets and the deepest CFA offset must match the prologue parse."""
    info, listing = load_fixture(stem)
    frames = parse_eh_frame((FIXTURES / f"{stem}.eh-frame.txt").read_text())
    by_offset = {f.offset: f.name for f in info.functions}
    results = []
    return_address = RETURN_ADDRESS_BYTES[info.abi]
    for frame in frames:
        name = by_offset.get(frame["start"])
        if name is None or name not in listing:
            continue
        analysis = analyze_function(name, listing[name], info.abi)
        observed = {r: o - return_address for r, o in analysis.saved if r in CALLEE_SAVED[info.abi]}
        max_cfa = max(frame["cfaOffsets"]) if frame["cfaOffsets"] else return_address
        deepest = analysis.max_depth + return_address
        results.append({"function": name, "cfiSaved": frame["savedAtCfa"], "prologueSaved": observed, "cfiMaxOffset": max_cfa, "deepestStack": deepest, "cfaRegisters": frame["cfaRegisters"], "agree": frame["savedAtCfa"] == observed and max_cfa == deepest})
    return results


def tool_captures() -> dict[str, Any]:
    """Read the radare2, rizin, and angr captures in fixtures/tools and extract what each tool said about the same functions."""
    tools_dir = FIXTURES / "tools"
    report: dict[str, Any] = {}
    if not tools_dir.exists():
        return report
    for path in sorted(tools_dir.glob("*.txt")):
        if "version" in path.name:
            continue
        text = re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", path.read_text(errors="replace"))
        entry: dict[str, Any] = {}
        sections: dict[str, list[str]] = {}
        current: str | None = None
        for line in text.splitlines():
            marker = re.match(r"^\[([a-z]+)(?: (\w+))?\]$", line)
            if marker:
                current = f"{marker.group(1)} {marker.group(2)}" if marker.group(2) else marker.group(1)
                sections[current] = []
                continue
            if current:
                sections[current].append(line.rstrip())
        conventions = {k.split()[1]: v[0] for k, v in sections.items() if k.startswith("afc ") and v}
        if conventions:
            entry["conventions"] = conventions
        if "afcl" in sections:
            entry["available"] = [l for l in sections["afcl"] if l and not l.startswith(("WARNING", "INFO", "ERROR", "HINT"))]
        arguments = {}
        for key, lines in sections.items():
            if " " not in key:
                continue
            kind, name = key.split()
            if kind in ("afv", "afvl"):
                arguments[name] = [l.split("@")[-1].strip() for l in lines if l.startswith("arg ")]
            if kind == "prototype":
                arguments[name] = lines[:1]
        if arguments:
            entry["arguments"] = arguments
        cc = {k.split()[1]: v[0] for k, v in sections.items() if k.startswith("cc ") and v}
        if cc:
            entry["conventions"] = cc
        report[path.name] = entry
    return report


def run_tools(stem: str = "convention-x86_64-linux-O2") -> dict[str, Any]:
    """Run radare2 and rizin when they are on PATH; the lesson and its tests do not need them."""
    results: dict[str, Any] = {}
    path = FIXTURES / f"{stem}.o"
    for tool, command in (("radare2", "r2"), ("rizin", "rizin")):
        binary = shutil.which(command)
        if not binary:
            results[tool] = "absent"
            continue
        script = "afc @ sym.eight_args; " + ("afv @ sym.eight_args" if tool == "radare2" else "afvl @ sym.eight_args")
        try:
            out = subprocess.run([binary, "-A", "-q", "-e", "scr.color=0", "-c", script, str(path)], capture_output=True, text=True, timeout=120)
            results[tool] = [l for l in out.stdout.strip().splitlines() if not l.startswith(("INFO", "WARNING", "HINT"))][-12:]
        except (subprocess.SubprocessError, OSError) as exc:
            results[tool] = f"failed: {exc}"
    return results


@dataclass
class FrameCell:
    low: int
    high: int
    label: str
    kind: str

    def to_dict(self) -> dict[str, Any]:
        return {"lo": self.low, "hi": self.high, "label": self.label, "kind": self.kind}


def frame_cells(analysis: FunctionAnalysis) -> list[FrameCell]:
    """Entry-relative frame picture: caller area above offset 0, return address at 0 on x86, callee area below, highest address first."""
    abi = analysis.abi
    x86 = abi in X86_ABIS
    cells: list[FrameCell] = []
    expected = expected_locations(abi, analysis.name) if analysis.name in SIGNATURES else {"parameters": [], "hidden": None}
    by_location: dict[str, str] = {}
    for param in expected["parameters"]:
        for location in param["location"]:
            by_location[location.split(" ")[0]] = param["name"]
    if expected.get("hidden"):
        by_location[expected["hidden"]] = "result pointer"
    for offset in analysis.stack_slots:
        label = by_location.get(f"stack+{offset}", "stack argument")
        cells.append(FrameCell(offset, offset + 8, f"argument {label} (caller's frame)", "arg"))
    if abi == WIN64:
        for k, register in enumerate(INT_ARG_REGS[WIN64]):
            low = 8 + 8 * k
            used = any(o == low for _, o in analysis.home_stores)
            cells.append(FrameCell(low, low + 8, f"home of {register}" if used else f"shadow slot for {register}", "shadow"))
    if x86:
        cells.append(FrameCell(0, 8, "return address", "ret"))
    for register, offset in analysis.saved:
        if register == "imm":
            continue
        if register in CALLEE_SAVED[abi]:
            kind = "fp" if (register == "rbp" and analysis.frame_pointer == offset) or register in ("x29", "x30") else "save"
            label = {"x29": "frame record: saved x29", "x30": "frame record: saved x30 (LR)"}.get(register, f"saved {register}")
            cells.append(FrameCell(offset, offset + 8, label, kind))
        else:
            cells.append(FrameCell(offset, offset + 8, f"pushq %{register}: 8-byte alignment pad", "pad"))
    for register, offset, size in analysis.spills:
        label = by_location.get(register, register)
        cells.append(FrameCell(offset, offset + size, f"spill of {register} (argument {label})", "spill"))
    if abi == WIN64 and analysis.calls and analysis.frame_size >= 32:
        for low in range(-analysis.frame_size, -analysis.frame_size + 32, 8):
            cells.append(FrameCell(low, low + 8, "shadow space for the callees", "shadow"))
    covered = [(c.low, c.high) for c in cells]
    if analysis.below_sp:
        extent = max(analysis.below_sp)
        cells.append(FrameCell(-analysis.frame_size - extent, -analysis.frame_size, f"red zone, {extent} bytes used", "redzone"))
    for low in range(-analysis.frame_size, 0, 8):
        if not any(a < low + 8 and low < b for a, b in covered):
            cells.append(FrameCell(low, low + 8, "locals or alignment", "local"))
    cells.sort(key=lambda c: -c.low)
    return cells


def figure_data() -> dict[str, Any]:
    """Frames of eight_args and keeps under three ABIs at -O0 and -O2, from the same analysis the tests check."""
    abis = [
        {"id": SYSV, "label": "System V AMD64", "short": "SysV", "stems": {"O0": "convention-x86_64-linux-O0", "O2": "convention-x86_64-linux-O2"}},
        {"id": WIN64, "label": "Microsoft x64", "short": "Win64", "stems": {"O0": "convention-x86_64-windows-O0", "O2": "convention-x86_64-windows-O2"}},
        {"id": AAPCS64, "label": "AArch64 AAPCS64", "short": "AArch64", "stems": {"O0": "convention-aarch64-linux-O0", "O2": "convention-aarch64-linux-O2"}},
    ]
    frames: dict[str, Any] = {}
    for name in ("eight_args", "keeps"):
        frames[name] = {}
        for level in ("O0", "O2"):
            frames[name][level] = {}
            for abi in abis:
                info, listing = load_fixture(abi["stems"][level])
                analysis = analyze_function(name, listing[name], info.abi)
                expected = expected_locations(info.abi, name)
                regs = [{"p": p["name"], "r": loc.split(" ")[0]} for p in expected["parameters"] for loc in p["location"] if not loc.startswith("stack")]
                frames[name][level][abi["id"]] = {
                    "frame": analysis.frame_size,
                    "fp": analysis.frame_pointer,
                    "cells": [c.to_dict() for c in frame_cells(analysis)],
                    "regs": regs,
                    "ret": analysis.return_registers,
                    "prologue": [f"{i.hex}  {i.text}" for i in analysis.prologue],
                    "epilogue": [f"{i.hex}  {i.text}" for i in analysis.epilogue],
                    "calls": [d for _, d in analysis.calls],
                    "agree": sum(1 for c in analysis.checks if c.agree),
                    "checks": len(analysis.checks),
                }
    return {
        "functions": ["eight_args", "keeps"],
        "signatures": {n: f"{SIGNATURES[n][0]} {n}({', '.join(SIGNATURES[n][1])})" for n in ("eight_args", "keeps")},
        "abis": [{"id": a["id"], "label": a["label"], "short": a["short"]} for a in abis],
        "frames": frames,
    }


def demo() -> dict[str, Any]:
    report: dict[str, Any] = {"objects": {}}
    for stem in FIXTURE_OBJECTS:
        info, listing = load_fixture(stem)
        functions = {name: analyze_function(name, instructions, info.abi).to_dict() for name, instructions in listing.items() if name in SIGNATURES}
        agree = sum(f["agree"] for f in functions.values())
        total = sum(len(f["checks"]) for f in functions.values())
        report["objects"][stem] = {"format": info.format, "machine": info.machine, "abi": ABI_NAMES[info.abi], "checks": f"{agree}/{total} agree", "functions": functions}
    report["sehCrossCheck"] = seh_cross_check()
    report["ehFrameCrossCheck"] = {stem: eh_frame_cross_check(stem) for stem in ("convention-x86_64-linux-O2-eh", "convention-aarch64-linux-O2-eh")}
    report["toolCaptures"] = tool_captures()
    report["liveTools"] = run_tools()
    return report


def main(argv: list[str]) -> int:
    if not argv:
        print(json.dumps(demo(), indent=2))
        return 0
    command = argv[0]
    if command == "analyze" and len(argv) == 3:
        info, listing = load_fixture(argv[1])
        print(json.dumps(analyze_function(argv[2], listing[argv[2]], info.abi).to_dict(), indent=2))
        return 0
    if command == "object" and len(argv) == 2:
        info = describe_object(Path(argv[1]))
        print(json.dumps({"format": info.format, "machine": info.machine, "abi": ABI_NAMES[info.abi], "functions": [f.name for f in info.functions]}, indent=2))
        return 0
    if command == "seh":
        print(json.dumps(seh_cross_check(), indent=2))
        return 0
    if command == "eh-frame" and len(argv) == 2:
        print(json.dumps(eh_frame_cross_check(argv[1]), indent=2))
        return 0
    if command == "figure-data":
        print(json.dumps(figure_data(), separators=(",", ":")))
        return 0
    print("usage: main.py [analyze FIXTURE_STEM FUNCTION | object FILE | seh | eh-frame FIXTURE_STEM | figure-data]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
