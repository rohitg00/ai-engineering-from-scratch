"""Companion code for docs/en.md: read four bytecode containers and measure what each one keeps.
CPython .pyc: PEP 552 header, marshal type codes from Python/marshal.c, code object field order.
JVM class files: JVMS Java SE 25, Chapter 4 (ClassFile, constant pool, attributes) and Chapter 6 (opcodes).
ECMA-335 assemblies: Partition II metadata tables and heaps, Partition III CIL instructions.
WebAssembly modules: core specification binary format and the name custom section.
Run `python3 main.py` for the demo or `python3 tests/test_main.py` for the suite.
"""

from __future__ import annotations

import dis
import json
import marshal
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"


class FormatError(ValueError):
    pass


class Reader:
    """A cursor over bytes. Every integer read names its width and byte order."""

    def __init__(self, data: bytes, position: int = 0, end: int | None = None) -> None:
        self.data = data
        self.position = position
        self.end = len(data) if end is None else end

    def at_end(self) -> bool:
        return self.position >= self.end

    def take(self, count: int) -> bytes:
        if self.position + count > self.end:
            raise FormatError(f"read of {count} bytes at offset {self.position} runs past {self.end}")
        chunk = self.data[self.position : self.position + count]
        self.position += count
        return chunk

    def u8(self) -> int:
        return self.take(1)[0]

    def u16le(self) -> int:
        return struct.unpack("<H", self.take(2))[0]

    def u32le(self) -> int:
        return struct.unpack("<I", self.take(4))[0]

    def i32le(self) -> int:
        return struct.unpack("<i", self.take(4))[0]

    def u64le(self) -> int:
        return struct.unpack("<Q", self.take(8))[0]

    def u16be(self) -> int:
        return struct.unpack(">H", self.take(2))[0]

    def u32be(self) -> int:
        return struct.unpack(">I", self.take(4))[0]

    def i32be(self) -> int:
        return struct.unpack(">i", self.take(4))[0]

    def uleb(self) -> int:
        result = 0
        shift = 0
        while True:
            byte = self.u8()
            result |= (byte & 0x7F) << shift
            shift += 7
            if not byte & 0x80:
                return result
            if shift > 70:
                raise FormatError("LEB128 value longer than 10 bytes")

    def sleb(self) -> int:
        result = 0
        shift = 0
        while True:
            byte = self.u8()
            result |= (byte & 0x7F) << shift
            shift += 7
            if not byte & 0x80:
                if byte & 0x40:
                    result -= 1 << shift
                return result
            if shift > 70:
                raise FormatError("LEB128 value longer than 10 bytes")


def hex_bytes(data: bytes) -> str:
    return " ".join(f"{byte:02x}" for byte in data)


PYC_MAGIC_WORDS = {3425: "3.9", 3439: "3.10", 3495: "3.11", 3531: "3.12", 3571: "3.13", 3627: "3.14", 3666: "3.15"}
PYC_HEADER_SIZE = 16
FLAG_REF = 0x80
CO_FAST_LOCAL = 0x20
CO_FAST_CELL = 0x40
CO_FAST_FREE = 0x80


@dataclass(frozen=True)
class PycHeader:
    """PEP 552: magic word, flags, then mtime and size or a 64-bit source hash."""

    magic: bytes
    magic_word: int
    version: str
    flags: int
    source_mtime: int | None
    source_size: int | None
    source_hash: bytes | None

    @property
    def hash_based(self) -> bool:
        return bool(self.flags & 1)

    @property
    def check_source(self) -> bool:
        return bool(self.flags & 2)

    def to_dict(self) -> dict[str, Any]:
        return {
            "magic": hex_bytes(self.magic),
            "magicWord": self.magic_word,
            "version": self.version,
            "flags": self.flags,
            "hashBased": self.hash_based,
            "checkSource": self.check_source,
            "sourceMtime": self.source_mtime,
            "sourceSize": self.source_size,
            "sourceHash": None if self.source_hash is None else hex_bytes(self.source_hash),
        }


def read_pyc_header(data: bytes) -> PycHeader:
    if len(data) < PYC_HEADER_SIZE:
        raise FormatError("pyc shorter than its 16-byte header")
    magic = data[:4]
    if magic[2:] != b"\r\n":
        raise FormatError("pyc magic does not end in CR LF")
    word = int.from_bytes(magic[:2], "little")
    version = PYC_MAGIC_WORDS.get(word, "unknown")
    flags = int.from_bytes(data[4:8], "little")
    if flags & 1:
        return PycHeader(magic, word, version, flags, None, None, data[8:16])
    mtime = int.from_bytes(data[8:12], "little")
    size = int.from_bytes(data[12:16], "little")
    return PycHeader(magic, word, version, flags, mtime, size, None)


@dataclass
class CodeObject:
    """The fields marshal writes for a code object, in the order of w_complex_object()."""

    argcount: int
    posonlyargcount: int
    kwonlyargcount: int
    stacksize: int
    flags: int
    code: bytes
    consts: tuple
    names: tuple
    localsplusnames: tuple
    localspluskinds: bytes
    filename: str
    name: str
    qualname: str
    firstlineno: int
    linetable: bytes
    exceptiontable: bytes

    @property
    def varnames(self) -> tuple[str, ...]:
        return tuple(name for name, kind in zip(self.localsplusnames, self.localspluskinds) if kind & CO_FAST_LOCAL)

    @property
    def freevars(self) -> tuple[str, ...]:
        return tuple(name for name, kind in zip(self.localsplusnames, self.localspluskinds) if kind & CO_FAST_FREE)

    @property
    def cellvars(self) -> tuple[str, ...]:
        return tuple(name for name, kind in zip(self.localsplusnames, self.localspluskinds) if kind & CO_FAST_CELL and not kind & CO_FAST_FREE)

    @property
    def argnames(self) -> tuple[str, ...]:
        return self.varnames[: self.argcount + self.kwonlyargcount]

    def nested(self) -> list["CodeObject"]:
        found = [const for const in self.consts if isinstance(const, CodeObject)]
        return found + [inner for const in found for inner in const.nested()]

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "qualname": self.qualname,
            "argcount": self.argcount,
            "argnames": list(self.argnames),
            "varnames": list(self.varnames),
            "names": list(self.names),
            "consts": [c.qualname if isinstance(c, CodeObject) else repr(c) for c in self.consts],
            "codeBytes": len(self.code),
            "stacksize": self.stacksize,
            "firstlineno": self.firstlineno,
            "filename": self.filename,
            "linetableBytes": len(self.linetable),
            "exceptiontableBytes": len(self.exceptiontable),
        }


class Unmarshaller:
    """A reader for the marshal format as Python/marshal.c writes code objects.
    Versions 3.11 to 3.15 share one code object layout. 3.9 and 3.10 use the older one."""

    def __init__(self, data: bytes, version: str) -> None:
        self.reader = Reader(data)
        self.version = version
        self.refs: list[Any] = []
        self.old_layout = version in ("3.9", "3.10")

    def load(self) -> Any:
        return self.read_object()

    def _reserve(self, flagged: bool) -> int | None:
        if not flagged:
            return None
        self.refs.append(None)
        return len(self.refs) - 1

    def _insert(self, slot: int | None, value: Any) -> Any:
        if slot is not None:
            self.refs[slot] = value
        return value

    def _ref(self, value: Any, flagged: bool) -> Any:
        if flagged:
            self.refs.append(value)
        return value

    def read_object(self) -> Any:
        reader = self.reader
        code = reader.u8()
        flagged = bool(code & FLAG_REF)
        kind = chr(code & ~FLAG_REF)
        if kind == "0":
            return None
        if kind == "N":
            return None
        if kind == "F":
            return False
        if kind == "T":
            return True
        if kind == ".":
            return Ellipsis
        if kind == "S":
            return StopIteration
        if kind == "i":
            return self._ref(reader.i32le(), flagged)
        if kind == "l":
            return self._ref(self._read_long(), flagged)
        if kind == "g":
            return self._ref(struct.unpack("<d", reader.take(8))[0], flagged)
        if kind == "y":
            real, imag = struct.unpack("<dd", reader.take(16))
            return self._ref(complex(real, imag), flagged)
        if kind == "s":
            return self._ref(reader.take(reader.u32le()), flagged)
        if kind in ("t", "u", "a", "A"):
            return self._ref(reader.take(reader.u32le()).decode("utf-8", "surrogatepass"), flagged)
        if kind in ("z", "Z"):
            return self._ref(reader.take(reader.u8()).decode("latin-1"), flagged)
        if kind in ("(", ")", "[", "<", ">"):
            count = reader.u8() if kind == ")" else reader.u32le()
            slot = self._reserve(flagged)
            items = [self.read_object() for _ in range(count)]
            if kind == "[":
                return self._insert(slot, items)
            if kind == "<":
                return self._insert(slot, set(items))
            if kind == ">":
                return self._insert(slot, frozenset(items))
            return self._insert(slot, tuple(items))
        if kind == "{":
            slot = self._reserve(flagged)
            result: dict[Any, Any] = {}
            while True:
                key = self.read_object()
                if key is None and reader.data[reader.position - 1] == ord("0"):
                    break
                result[key] = self.read_object()
            return self._insert(slot, result)
        if kind == "r":
            index = reader.u32le()
            if index >= len(self.refs):
                raise FormatError(f"marshal reference {index} points past {len(self.refs)} objects")
            return self.refs[index]
        if kind == "c":
            slot = self._reserve(flagged)
            return self._insert(slot, self._read_code())
        raise FormatError(f"marshal type code {kind!r} at offset {reader.position - 1} is not handled")

    def _read_long(self) -> int:
        count = self.reader.i32le()
        digits = [self.reader.u16le() for _ in range(abs(count))]
        value = 0
        for digit in reversed(digits):
            value = (value << 15) | digit
        return -value if count < 0 else value

    def _read_code(self) -> CodeObject:
        reader = self.reader
        argcount = reader.i32le()
        posonlyargcount = reader.i32le()
        kwonlyargcount = reader.i32le()
        if self.old_layout:
            reader.i32le()
        stacksize = reader.i32le()
        flags = reader.i32le()
        code = self.read_object()
        consts = self.read_object()
        names = self.read_object()
        if self.old_layout:
            varnames = self.read_object()
            freevars = self.read_object()
            cellvars = self.read_object()
            localsplusnames = tuple(varnames) + tuple(cellvars) + tuple(freevars)
            localspluskinds = bytes([CO_FAST_LOCAL] * len(varnames) + [CO_FAST_CELL] * len(cellvars) + [CO_FAST_FREE] * len(freevars))
            filename = self.read_object()
            name = self.read_object()
            qualname = name
            firstlineno = reader.i32le()
            linetable = self.read_object()
            exceptiontable = b""
        else:
            localsplusnames = self.read_object()
            localspluskinds = self.read_object()
            filename = self.read_object()
            name = self.read_object()
            qualname = self.read_object()
            firstlineno = reader.i32le()
            linetable = self.read_object()
            exceptiontable = self.read_object()
        return CodeObject(argcount, posonlyargcount, kwonlyargcount, stacksize, flags, code, tuple(consts), tuple(names), tuple(localsplusnames), bytes(localspluskinds), filename, name, qualname, firstlineno, bytes(linetable), bytes(exceptiontable))


class PycFile:
    """A compiled module: 16-byte header, then one marshalled code object."""

    def __init__(self, data: bytes) -> None:
        self.data = data
        self.header = read_pyc_header(data)
        self.module = Unmarshaller(data[PYC_HEADER_SIZE:], self.header.version).load()
        if not isinstance(self.module, CodeObject):
            raise FormatError("the object after the pyc header is not a code object")

    @property
    def body_size(self) -> int:
        return len(self.data) - PYC_HEADER_SIZE

    def functions(self) -> dict[str, CodeObject]:
        return {code.qualname: code for code in self.module.nested()}

    def matches_running_interpreter(self) -> bool:
        return self.header.version == f"{sys.version_info[0]}.{sys.version_info[1]}"

    def native_module(self) -> Any:
        """The real code object, available only when the running interpreter wrote this format."""
        if not self.matches_running_interpreter():
            return None
        return marshal.loads(self.data[PYC_HEADER_SIZE:])

    def native_function(self, name: str) -> Any:
        module = self.native_module()
        if module is None:
            return None
        for const in module.co_consts:
            if hasattr(const, "co_code") and const.co_qualname == name:
                return const
        return None

    def instructions(self, name: str) -> list[dict[str, Any]] | None:
        """dis for the running interpreter only: opcode numbers are not stable across versions."""
        code = self.native_function(name)
        if code is None:
            return None
        rows = []
        for instruction in dis.get_instructions(code):
            rows.append({"offset": instruction.offset, "opname": instruction.opname, "arg": instruction.arg, "argrepr": instruction.argrepr})
        return rows

    def to_dict(self) -> dict[str, Any]:
        return {
            "header": self.header.to_dict(),
            "fileBytes": len(self.data),
            "bodyBytes": self.body_size,
            "module": self.module.to_dict(),
            "functions": {name: code.to_dict() for name, code in self.functions().items()},
        }


def load_pyc(name: str) -> PycFile:
    return PycFile((FIXTURES / "python" / name).read_bytes())


DIS_HEADER = re.compile(r"^Disassembly of <code object (\S+) at 0x[0-9a-f]+, file \"([^\"]+)\", line (\d+)>:")
DIS_OPNAME = re.compile(r"^[A-Z][A-Z0-9_]+$")


def parse_dis_text(text: str) -> dict[str, list[dict[str, Any]]]:
    """Instruction rows per code object from `python -m dis` output in the 3.11 to 3.14 shapes:
    optional line number, optional `>>` or `Lnn:` label, optional offset, opname, oparg, argrepr.
    3.11 and 3.12 print an offset on every row. 3.13 and later print offsets only with -O, so a
    number before the opname is a line number unless every row of the code object has one."""
    listing: dict[str, list[dict[str, Any]]] = {"<module>": []}
    current = "<module>"
    for line in text.splitlines():
        header = DIS_HEADER.match(line)
        if header:
            current = header.group(1)
            listing[current] = []
            continue
        tokens = line.split()
        if not tokens:
            continue
        for position, token in enumerate(tokens):
            if DIS_OPNAME.match(token):
                before = tokens[position - 1] if position > 0 else ""
                rest = tokens[position + 1 :]
                arg = int(rest[0]) if rest and rest[0].isdigit() else None
                argrepr = " ".join(rest[1:]) if arg is not None else " ".join(rest)
                listing[current].append({"offset": int(before) if before.isdigit() else None, "opname": token, "arg": arg, "argrepr": argrepr})
                break
    for rows in listing.values():
        if rows and any(row["offset"] is None for row in rows):
            for row in rows:
                row["offset"] = None
    return listing


def dis_fixture_listing(version_tag: str, caches: bool = False) -> dict[str, list[dict[str, Any]]]:
    suffix = "dis-caches.txt" if caches else "dis.txt"
    return parse_dis_text((FIXTURES / "python" / f"ledger.{version_tag}.{suffix}").read_text())


PYTHON_INTERPRETERS = ["python3.11", "python3.12", "python3.13", "python3.14", "python3.15"]


def available_interpreters() -> list[str]:
    return [name for name in PYTHON_INTERPRETERS if shutil.which(name)]


def compare_interpreters(source: Path | None = None) -> list[dict[str, Any]]:
    """Compile the same source with every installed interpreter and read each header with our reader.
    The instruction counts come from the dis module of the interpreter that wrote the file."""
    source = source or FIXTURES / "python" / "ledger.py"
    script = (
        "import sys, py_compile, dis, marshal, importlib.util, json\n"
        "path = sys.argv[1]\n"
        "target = sys.argv[2]\n"
        "py_compile.compile(path, cfile=target, dfile='ledger.py', doraise=True, invalidation_mode=py_compile.PycInvalidationMode.CHECKED_HASH)\n"
        "data = open(target, 'rb').read()\n"
        "module = marshal.loads(data[16:])\n"
        "grade = [c for c in module.co_consts if hasattr(c, 'co_code') and c.co_name == 'grade'][0]\n"
        "rows = list(dis.get_instructions(grade))\n"
        "print(json.dumps({'version': sys.version.split()[0], 'magic': importlib.util.MAGIC_NUMBER.hex(), 'marshalVersion': marshal.version, 'fileBytes': len(data), 'gradeCodeBytes': len(grade.co_code), 'gradeInstructions': len(rows), 'gradeOpnames': sorted(set(r.opname for r in rows))}))\n"
    )
    results = []
    for name in available_interpreters():
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "ledger.pyc"
            completed = subprocess.run([name, "-I", "-c", script, str(source), str(target)], capture_output=True, text=True, check=False)
            if completed.returncode != 0:
                results.append({"interpreter": name, "error": completed.stderr.strip()[-300:]})
                continue
            row = json.loads(completed.stdout)
            row["interpreter"] = name
            row["headerFromOurReader"] = read_pyc_header(target.read_bytes()).to_dict()
            results.append(row)
    return results


def python_structure(rows: list[dict[str, Any]]) -> dict[str, int]:
    jumps = sum(1 for row in rows if row["opname"].startswith(("POP_JUMP", "JUMP_")))
    compares = sum(1 for row in rows if row["opname"].startswith("COMPARE_OP"))
    returns = sum(1 for row in rows if row["opname"].startswith("RETURN"))
    caches = sum(1 for row in rows if row["opname"] == "CACHE")
    return {"instructions": len(rows) - caches, "jumps": jumps, "compares": compares, "returns": returns, "caches": caches, "structured": 0}


CLASS_MAGIC = 0xCAFEBABE
CONSTANT_TAGS = {
    1: "Utf8", 3: "Integer", 4: "Float", 5: "Long", 6: "Double", 7: "Class", 8: "String", 9: "Fieldref",
    10: "Methodref", 11: "InterfaceMethodref", 12: "NameAndType", 15: "MethodHandle", 16: "MethodType",
    17: "Dynamic", 18: "InvokeDynamic", 19: "Module", 20: "Package",
}
JAVA_MAJOR_VERSIONS = {45: "1.1", 49: "5", 52: "8", 55: "11", 61: "17", 65: "21", 69: "25"}
JVM_OPCODES = (
    "nop aconst_null iconst_m1 iconst_0 iconst_1 iconst_2 iconst_3 iconst_4 iconst_5 lconst_0 lconst_1 fconst_0 fconst_1 fconst_2 "
    "dconst_0 dconst_1 bipush sipush ldc ldc_w ldc2_w iload lload fload dload aload iload_0 iload_1 iload_2 iload_3 lload_0 lload_1 "
    "lload_2 lload_3 fload_0 fload_1 fload_2 fload_3 dload_0 dload_1 dload_2 dload_3 aload_0 aload_1 aload_2 aload_3 iaload laload "
    "faload daload aaload baload caload saload istore lstore fstore dstore astore istore_0 istore_1 istore_2 istore_3 lstore_0 "
    "lstore_1 lstore_2 lstore_3 fstore_0 fstore_1 fstore_2 fstore_3 dstore_0 dstore_1 dstore_2 dstore_3 astore_0 astore_1 astore_2 "
    "astore_3 iastore lastore fastore dastore aastore bastore castore sastore pop pop2 dup dup_x1 dup_x2 dup2 dup2_x1 dup2_x2 swap "
    "iadd ladd fadd dadd isub lsub fsub dsub imul lmul fmul dmul idiv ldiv fdiv ddiv irem lrem frem drem ineg lneg fneg dneg ishl "
    "lshl ishr lshr iushr lushr iand land ior lor ixor lxor iinc i2l i2f i2d l2i l2f l2d f2i f2l f2d d2i d2l d2f i2b i2c i2s lcmp "
    "fcmpl fcmpg dcmpl dcmpg ifeq ifne iflt ifge ifgt ifle if_icmpeq if_icmpne if_icmplt if_icmpge if_icmpgt if_icmple if_acmpeq "
    "if_acmpne goto jsr ret tableswitch lookupswitch ireturn lreturn freturn dreturn areturn return getstatic putstatic getfield "
    "putfield invokevirtual invokespecial invokestatic invokeinterface invokedynamic new newarray anewarray arraylength athrow "
    "checkcast instanceof monitorenter monitorexit wide multianewarray ifnull ifnonnull goto_w jsr_w"
).split()
JVM_OPERAND_BYTES = {16: 1, 17: 2, 18: 1, 19: 2, 20: 2, 132: 2, 169: 1, 185: 4, 186: 4, 187: 2, 188: 1, 189: 2, 192: 2, 193: 2, 197: 3, 200: 4, 201: 4}
JVM_OPERAND_BYTES.update({opcode: 1 for opcode in range(21, 26)})
JVM_OPERAND_BYTES.update({opcode: 1 for opcode in range(54, 59)})
JVM_OPERAND_BYTES.update({opcode: 2 for opcode in range(153, 169)})
JVM_OPERAND_BYTES.update({opcode: 2 for opcode in range(178, 185)})
JVM_OPERAND_BYTES.update({opcode: 2 for opcode in (198, 199)})
JVM_BRANCHES = set(range(153, 169)) | {198, 199}
JVM_WIDE_BRANCHES = {200, 201}
JVM_CONSTANT_REFS = {18, 19, 20, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 189, 192, 193, 197}
JVM_ARRAY_TYPES = {4: "boolean", 5: "char", 6: "float", 7: "double", 8: "byte", 9: "short", 10: "int", 11: "long"}


@dataclass(frozen=True)
class Constant:
    index: int
    tag: int
    value: Any

    @property
    def kind(self) -> str:
        return CONSTANT_TAGS.get(self.tag, f"tag{self.tag}")


@dataclass(frozen=True)
class JvmInstruction:
    offset: int
    opcode: int
    raw: bytes
    mnemonic: str
    operands: tuple[Any, ...]
    text: str
    targets: tuple[int, ...] = ()
    switch: dict[str, Any] | None = None

    @property
    def end(self) -> int:
        return self.offset + len(self.raw)


@dataclass
class CodeAttribute:
    max_stack: int
    max_locals: int
    code: bytes
    exception_table: list[tuple[int, int, int, int]]
    attributes: list["Attribute"]

    def attribute(self, name: str) -> "Attribute | None":
        return next((a for a in self.attributes if a.name == name), None)


@dataclass
class Attribute:
    name: str
    info: bytes
    parsed: Any = None


@dataclass
class Member:
    access_flags: int
    name: str
    descriptor: str
    attributes: list[Attribute]

    @property
    def code(self) -> CodeAttribute | None:
        for attribute in self.attributes:
            if attribute.name == "Code":
                return attribute.parsed
        return None

    def attribute_names(self) -> list[str]:
        names = [a.name for a in self.attributes]
        if self.code is not None:
            names += [a.name for a in self.code.attributes]
        return names


class ClassFile:
    """JVMS 4.1: magic, versions, constant pool, flags, this and super, interfaces, fields, methods, attributes."""

    def __init__(self, data: bytes) -> None:
        self.data = data
        reader = Reader(data)
        self.magic = reader.u32be()
        if self.magic != CLASS_MAGIC:
            raise FormatError(f"class magic is 0x{self.magic:08x}, not 0xCAFEBABE")
        self.minor_version = reader.u16be()
        self.major_version = reader.u16be()
        self.constant_pool = self._read_constant_pool(reader)
        self.access_flags = reader.u16be()
        self.this_class = reader.u16be()
        self.super_class = reader.u16be()
        self.interfaces = [reader.u16be() for _ in range(reader.u16be())]
        self.fields = [self._read_member(reader) for _ in range(reader.u16be())]
        self.methods = [self._read_member(reader) for _ in range(reader.u16be())]
        self.attributes = self._read_attributes(reader)
        if not reader.at_end():
            raise FormatError(f"{reader.end - reader.position} bytes follow the class file attributes")

    def _read_constant_pool(self, reader: Reader) -> list[Constant | None]:
        count = reader.u16be()
        pool: list[Constant | None] = [None] * count
        index = 1
        while index < count:
            tag = reader.u8()
            if tag == 1:
                value: Any = reader.take(reader.u16be()).decode("utf-8", "replace")
            elif tag == 3:
                value = reader.i32be()
            elif tag == 4:
                value = struct.unpack(">f", reader.take(4))[0]
            elif tag == 5:
                value = struct.unpack(">q", reader.take(8))[0]
            elif tag == 6:
                value = struct.unpack(">d", reader.take(8))[0]
            elif tag in (7, 8, 16, 19, 20):
                value = reader.u16be()
            elif tag in (9, 10, 11, 12, 17, 18):
                value = (reader.u16be(), reader.u16be())
            elif tag == 15:
                value = (reader.u8(), reader.u16be())
            else:
                raise FormatError(f"constant pool tag {tag} at entry {index} is not in JVMS 4.4")
            pool[index] = Constant(index, tag, value)
            index += 2 if tag in (5, 6) else 1
        return pool

    def constant(self, index: int) -> Constant:
        if index <= 0 or index >= len(self.constant_pool) or self.constant_pool[index] is None:
            raise FormatError(f"constant pool index {index} is empty or out of range")
        return self.constant_pool[index]

    def utf8(self, index: int) -> str:
        constant = self.constant(index)
        if constant.tag != 1:
            raise FormatError(f"constant #{index} is {constant.kind}, not Utf8")
        return constant.value

    def class_name(self, index: int) -> str:
        return self.utf8(self.constant(index).value)

    def describe_constant(self, index: int) -> str:
        """The text javap prints after `//` for a constant pool reference."""
        constant = self.constant(index)
        if constant.tag == 1:
            return constant.value
        if constant.tag in (3, 4, 5, 6):
            return str(constant.value)
        if constant.tag == 7:
            return "class " + self.class_name(index)
        if constant.tag == 8:
            return "String " + self.utf8(constant.value)
        if constant.tag in (9, 10, 11):
            owner = self.class_name(constant.value[0])
            name, descriptor = self.name_and_type(constant.value[1])
            label = {9: "Field", 10: "Method", 11: "InterfaceMethod"}[constant.tag]
            return f"{label} {owner}.{name}:{descriptor}"
        if constant.tag == 12:
            name, descriptor = self.name_and_type(index)
            return f"{name}:{descriptor}"
        if constant.tag in (17, 18):
            name, descriptor = self.name_and_type(constant.value[1])
            return f"InvokeDynamic #{constant.value[0]}:{name}:{descriptor}"
        return constant.kind

    def name_and_type(self, index: int) -> tuple[str, str]:
        constant = self.constant(index)
        if constant.tag != 12:
            raise FormatError(f"constant #{index} is {constant.kind}, not NameAndType")
        return self.utf8(constant.value[0]), self.utf8(constant.value[1])

    def _read_attributes(self, reader: Reader) -> list[Attribute]:
        attributes = []
        for _ in range(reader.u16be()):
            name = self.utf8(reader.u16be())
            info = reader.take(reader.u32be())
            attributes.append(Attribute(name, info, self._parse_attribute(name, info)))
        return attributes

    def _parse_attribute(self, name: str, info: bytes) -> Any:
        reader = Reader(info)
        if name == "Code":
            max_stack = reader.u16be()
            max_locals = reader.u16be()
            code = reader.take(reader.u32be())
            exceptions = [(reader.u16be(), reader.u16be(), reader.u16be(), reader.u16be()) for _ in range(reader.u16be())]
            return CodeAttribute(max_stack, max_locals, code, exceptions, self._read_attributes(reader))
        if name == "LineNumberTable":
            return [(reader.u16be(), reader.u16be()) for _ in range(reader.u16be())]
        if name == "LocalVariableTable":
            rows = []
            for _ in range(reader.u16be()):
                start, length, name_index, descriptor_index, slot = (reader.u16be() for _ in range(5))
                rows.append({"start": start, "length": length, "slot": slot, "name": self.utf8(name_index), "descriptor": self.utf8(descriptor_index)})
            return rows
        if name == "SourceFile":
            return self.utf8(reader.u16be())
        if name == "StackMapTable":
            return {"entries": reader.u16be()}
        if name == "BootstrapMethods":
            return {"count": reader.u16be()}
        return None

    def _read_member(self, reader: Reader) -> Member:
        access_flags = reader.u16be()
        name = self.utf8(reader.u16be())
        descriptor = self.utf8(reader.u16be())
        return Member(access_flags, name, descriptor, self._read_attributes(reader))

    @property
    def name(self) -> str:
        return self.class_name(self.this_class)

    def method(self, name: str) -> Member:
        for member in self.methods:
            if member.name == name:
                return member
        raise FormatError(f"no method named {name}")

    def source_file(self) -> str | None:
        return next((a.parsed for a in self.attributes if a.name == "SourceFile"), None)

    def constant_pool_summary(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for constant in self.constant_pool:
            if constant is not None:
                counts[constant.kind] = counts.get(constant.kind, 0) + 1
        return dict(sorted(counts.items()))

    def to_dict(self) -> dict[str, Any]:
        return {
            "magic": f"0x{self.magic:08x}",
            "minorVersion": self.minor_version,
            "majorVersion": self.major_version,
            "javaRelease": JAVA_MAJOR_VERSIONS.get(self.major_version, "unknown"),
            "constantPoolCount": len(self.constant_pool),
            "constantPool": self.constant_pool_summary(),
            "accessFlags": f"0x{self.access_flags:04x}",
            "thisClass": self.name,
            "superClass": self.class_name(self.super_class) if self.super_class else None,
            "sourceFile": self.source_file(),
            "fields": [{"name": f.name, "descriptor": f.descriptor} for f in self.fields],
            "methods": [
                {
                    "name": m.name,
                    "descriptor": m.descriptor,
                    "codeBytes": None if m.code is None else len(m.code.code),
                    "maxStack": None if m.code is None else m.code.max_stack,
                    "maxLocals": None if m.code is None else m.code.max_locals,
                    "attributes": m.attribute_names(),
                    "instructions": None if m.code is None else len(disassemble_jvm(self, m.code.code)),
                }
                for m in self.methods
            ],
            "classAttributes": [a.name for a in self.attributes],
            "fileBytes": len(self.data),
        }


def load_class(name: str) -> ClassFile:
    return ClassFile((FIXTURES / "java" / name).read_bytes())


def disassemble_jvm(class_file: ClassFile, code: bytes) -> list[JvmInstruction]:
    """JVMS Chapter 6: one opcode byte, then the operand bytes that opcode defines.
    Branch offsets are signed and relative to the branch instruction (not the next one)."""
    reader = Reader(code)
    instructions: list[JvmInstruction] = []
    while not reader.at_end():
        start = reader.position
        opcode = reader.u8()
        if opcode >= len(JVM_OPCODES):
            raise FormatError(f"opcode {opcode} at pc {start} is reserved or undefined")
        mnemonic = JVM_OPCODES[opcode]
        operands: tuple[Any, ...] = ()
        text = mnemonic
        targets: tuple[int, ...] = ()
        switch = None
        if opcode in (170, 171):
            while reader.position % 4:
                reader.u8()
            default = start + reader.i32be()
            if opcode == 170:
                low = reader.i32be()
                high = reader.i32be()
                table = [start + reader.i32be() for _ in range(high - low + 1)]
                switch = {"low": low, "high": high, "default": default, "targets": {low + i: t for i, t in enumerate(table)}}
                text = f"tableswitch {{ {low} to {high}, default {default} }}"
                targets = tuple(table) + (default,)
            else:
                pairs = [(reader.i32be(), start + reader.i32be()) for _ in range(reader.i32be())]
                switch = {"default": default, "targets": dict(pairs)}
                text = f"lookupswitch {{ {len(pairs)} keys, default {default} }}"
                targets = tuple(t for _k, t in pairs) + (default,)
        elif opcode == 196:
            wide_opcode = reader.u8()
            index = reader.u16be()
            operands = (wide_opcode, index)
            text = f"wide {JVM_OPCODES[wide_opcode]} {index}"
            if wide_opcode == 132:
                operands += (struct.unpack(">h", reader.take(2))[0],)
                text += f", {operands[2]}"
        else:
            size = JVM_OPERAND_BYTES.get(opcode, 0)
            raw_operand = reader.take(size)
            if opcode in JVM_BRANCHES:
                target = start + struct.unpack(">h", raw_operand)[0]
                operands = (target,)
                targets = (target,)
                text = f"{mnemonic} {target}"
            elif opcode in JVM_WIDE_BRANCHES:
                target = start + struct.unpack(">i", raw_operand)[0]
                operands = (target,)
                targets = (target,)
                text = f"{mnemonic} {target}"
            elif opcode in JVM_CONSTANT_REFS:
                index = raw_operand[0] if size == 1 else struct.unpack(">H", raw_operand[:2])[0]
                operands = (index,) + tuple(raw_operand[2:])
                text = f"{mnemonic} #{index}"
                if opcode == 186:
                    text += ", 0"
                elif opcode == 185:
                    text += f", {raw_operand[2]}"
                elif opcode == 197:
                    text += f", {raw_operand[2]}"
            elif opcode == 16:
                operands = (struct.unpack(">b", raw_operand)[0],)
                text = f"{mnemonic} {operands[0]}"
            elif opcode == 17:
                operands = (struct.unpack(">h", raw_operand)[0],)
                text = f"{mnemonic} {operands[0]}"
            elif opcode == 132:
                operands = (raw_operand[0], struct.unpack(">b", raw_operand[1:])[0])
                text = f"{mnemonic} {operands[0]}, {operands[1]}"
            elif opcode == 188:
                operands = (raw_operand[0],)
                text = f"{mnemonic} {JVM_ARRAY_TYPES.get(raw_operand[0], str(raw_operand[0]))}"
            elif size:
                operands = (int.from_bytes(raw_operand, 'big'),)
                text = f"{mnemonic} {operands[0]}"
        instructions.append(JvmInstruction(start, opcode, bytes(code[start : reader.position]), mnemonic, operands, text, targets, switch))
    return instructions


def jvm_listing(class_file: ClassFile, method_name: str) -> list[dict[str, Any]]:
    member = class_file.method(method_name)
    assert member.code is not None
    rows = []
    for instruction in disassemble_jvm(class_file, member.code.code):
        row = {"offset": instruction.offset, "bytes": hex_bytes(instruction.raw), "text": instruction.text}
        if instruction.opcode in JVM_CONSTANT_REFS:
            row["comment"] = class_file.describe_constant(instruction.operands[0])
        rows.append(row)
    return rows


JAVAP_METHOD = re.compile(r"^  (?:public |private |protected |static |final |synchronized |native |abstract )*[\w$.\[\]<>]+(?: [\w$<>]+)?\(.*\);$|^  static \{\};$|^  (?:public |private |protected )?[\w$]+\(.*\);$")
JAVAP_INSTRUCTION = re.compile(r"^\s+(\d+): (\w+)\s*(.*?)\s*(?://.*)?$")
JAVAP_SWITCH_ROW = re.compile(r"^\s+(-?\d+|default): (\d+)$")


def parse_javap_code(text: str) -> list[dict[str, Any]]:
    """Methods in class file order from `javap -c -p`, each with (offset, mnemonic, operand text) rows."""
    methods: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    in_switch: dict[str, Any] | None = None
    for line in text.splitlines():
        if JAVAP_METHOD.match(line):
            current = {"header": line.strip(), "instructions": []}
            methods.append(current)
            continue
        if current is None:
            continue
        if in_switch is not None:
            row = JAVAP_SWITCH_ROW.match(line)
            if row:
                key = row.group(1)
                in_switch["cases"][key] = int(row.group(2))
                continue
            if line.strip() == "}":
                in_switch = None
                continue
        match = JAVAP_INSTRUCTION.match(line)
        if not match:
            continue
        offset, mnemonic, operand = int(match.group(1)), match.group(2), match.group(3)
        entry: dict[str, Any] = {"offset": offset, "mnemonic": mnemonic, "operand": operand.replace("  ", " ").strip()}
        if mnemonic in ("tableswitch", "lookupswitch"):
            entry["cases"] = {}
            in_switch = entry
            entry["operand"] = ""
        current["instructions"].append(entry)
    return methods


def compare_with_javap(class_file: ClassFile, javap_text: str) -> dict[str, Any]:
    """Our offsets, mnemonics, and operands against javap -c -p for every method with code."""
    expected_methods = parse_javap_code(javap_text)
    with_code = [m for m in class_file.methods if m.code is not None]
    mismatches: list[dict[str, Any]] = []
    compared = 0
    if len(expected_methods) != len(with_code):
        mismatches.append({"method": "*", "expected": f"{len(expected_methods)} methods", "got": f"{len(with_code)} methods"})
    for member, expected in zip(with_code, expected_methods):
        ours = disassemble_jvm(class_file, member.code.code)
        if len(ours) != len(expected["instructions"]):
            mismatches.append({"method": member.name, "expected": f"{len(expected['instructions'])} instructions", "got": f"{len(ours)} instructions"})
        for instruction, row in zip(ours, expected["instructions"]):
            compared += 1
            if instruction.offset != row["offset"] or instruction.mnemonic != row["mnemonic"]:
                mismatches.append({"method": member.name, "expected": f"{row['offset']}: {row['mnemonic']}", "got": f"{instruction.offset}: {instruction.mnemonic}"})
                continue
            if instruction.switch is not None:
                expected_cases = {("default" if k == "default" else int(k)): v for k, v in row["cases"].items()}
                got_cases = dict(instruction.switch["targets"])
                got_cases["default"] = instruction.switch["default"]
                if expected_cases != got_cases:
                    mismatches.append({"method": member.name, "expected": str(expected_cases), "got": str(got_cases)})
                continue
            ours_operand = instruction.text[len(instruction.mnemonic) :].strip()
            theirs = row["operand"]
            if theirs.startswith("#"):
                theirs = theirs.split(",")[0].strip()
                ours_operand = ours_operand.split(",")[0].strip()
            if ours_operand != theirs:
                mismatches.append({"method": member.name, "expected": f"{row['offset']}: {row['mnemonic']} {theirs}", "got": f"{instruction.offset}: {instruction.text}"})
    return {"compared": compared, "mismatches": mismatches, "agree": not mismatches}


def jvm_structure(instructions: list[JvmInstruction]) -> dict[str, int]:
    jumps = sum(1 for i in instructions if i.opcode in JVM_BRANCHES or i.opcode in JVM_WIDE_BRANCHES)
    switches = sum(1 for i in instructions if i.switch is not None)
    returns = sum(1 for i in instructions if 172 <= i.opcode <= 177)
    return {"instructions": len(instructions), "jumps": jumps, "switches": switches, "returns": returns, "structured": 0}


WASM_MAGIC = b"\x00asm"
WASM_SECTION_NAMES = {0: "Custom", 1: "Type", 2: "Import", 3: "Function", 4: "Table", 5: "Memory", 6: "Global", 7: "Export", 8: "Start", 9: "Elem", 10: "Code", 11: "Data", 12: "DataCount", 13: "Tag"}
WASM_SECTION_ORDER = (1, 2, 3, 4, 5, 13, 6, 7, 8, 9, 12, 10, 11)
WASM_VALTYPES = {0x7F: "i32", 0x7E: "i64", 0x7D: "f32", 0x7C: "f64", 0x7B: "v128", 0x70: "funcref", 0x6F: "externref"}
WASM_EXPORT_KINDS = {0: "func", 1: "table", 2: "memory", 3: "global", 4: "tag"}
WASM_CONTROL = {0x00: "unreachable", 0x01: "nop", 0x02: "block", 0x03: "loop", 0x04: "if", 0x05: "else", 0x0B: "end", 0x0C: "br", 0x0D: "br_if", 0x0E: "br_table", 0x0F: "return", 0x10: "call", 0x11: "call_indirect"}
WASM_PARAMETRIC = {0x1A: "drop", 0x1B: "select", 0x1C: "select"}
WASM_VARIABLE = {0x20: "local.get", 0x21: "local.set", 0x22: "local.tee", 0x23: "global.get", 0x24: "global.set", 0x25: "table.get", 0x26: "table.set"}
WASM_MEMORY = {
    0x28: "i32.load", 0x29: "i64.load", 0x2A: "f32.load", 0x2B: "f64.load", 0x2C: "i32.load8_s", 0x2D: "i32.load8_u", 0x2E: "i32.load16_s",
    0x2F: "i32.load16_u", 0x30: "i64.load8_s", 0x31: "i64.load8_u", 0x32: "i64.load16_s", 0x33: "i64.load16_u", 0x34: "i64.load32_s",
    0x35: "i64.load32_u", 0x36: "i32.store", 0x37: "i64.store", 0x38: "f32.store", 0x39: "f64.store", 0x3A: "i32.store8", 0x3B: "i32.store16",
    0x3C: "i64.store8", 0x3D: "i64.store16", 0x3E: "i64.store32",
}
WASM_CONSTANTS = {0x41: "i32.const", 0x42: "i64.const", 0x43: "f32.const", 0x44: "f64.const"}
WASM_NUMERIC = dict(enumerate((
    "i32.eqz i32.eq i32.ne i32.lt_s i32.lt_u i32.gt_s i32.gt_u i32.le_s i32.le_u i32.ge_s i32.ge_u "
    "i64.eqz i64.eq i64.ne i64.lt_s i64.lt_u i64.gt_s i64.gt_u i64.le_s i64.le_u i64.ge_s i64.ge_u "
    "f32.eq f32.ne f32.lt f32.gt f32.le f32.ge f64.eq f64.ne f64.lt f64.gt f64.le f64.ge "
    "i32.clz i32.ctz i32.popcnt i32.add i32.sub i32.mul i32.div_s i32.div_u i32.rem_s i32.rem_u i32.and i32.or i32.xor i32.shl i32.shr_s i32.shr_u i32.rotl i32.rotr "
    "i64.clz i64.ctz i64.popcnt i64.add i64.sub i64.mul i64.div_s i64.div_u i64.rem_s i64.rem_u i64.and i64.or i64.xor i64.shl i64.shr_s i64.shr_u i64.rotl i64.rotr "
    "f32.abs f32.neg f32.ceil f32.floor f32.trunc f32.nearest f32.sqrt f32.add f32.sub f32.mul f32.div f32.min f32.max f32.copysign "
    "f64.abs f64.neg f64.ceil f64.floor f64.trunc f64.nearest f64.sqrt f64.add f64.sub f64.mul f64.div f64.min f64.max f64.copysign "
    "i32.wrap_i64 i32.trunc_f32_s i32.trunc_f32_u i32.trunc_f64_s i32.trunc_f64_u i64.extend_i32_s i64.extend_i32_u i64.trunc_f32_s i64.trunc_f32_u "
    "i64.trunc_f64_s i64.trunc_f64_u f32.convert_i32_s f32.convert_i32_u f32.convert_i64_s f32.convert_i64_u f32.demote_f64 f64.convert_i32_s "
    "f64.convert_i32_u f64.convert_i64_s f64.convert_i64_u f64.promote_f32 i32.reinterpret_f32 i64.reinterpret_f64 f32.reinterpret_i32 f64.reinterpret_i64 "
    "i32.extend8_s i32.extend16_s i64.extend8_s i64.extend16_s i64.extend32_s"
).split(), start=0x45))
WASM_REFERENCE = {0xD0: "ref.null", 0xD1: "ref.is_null", 0xD2: "ref.func"}


@dataclass(frozen=True)
class WasmSection:
    id: int
    name: str
    start: int
    end: int
    payload_start: int
    custom_name: str | None = None

    @property
    def size(self) -> int:
        return self.end - self.payload_start


@dataclass(frozen=True)
class FuncType:
    params: tuple[str, ...]
    results: tuple[str, ...]

    def render(self) -> str:
        params = ", ".join(self.params)
        results = ", ".join(self.results) if self.results else "nil"
        return f"({params}) -> {results}"


@dataclass(frozen=True)
class WasmInstruction:
    offset: int
    raw: bytes
    mnemonic: str
    operands: tuple[Any, ...]
    text: str
    depth: int


@dataclass
class WasmFunction:
    index: int
    type_index: int
    body_start: int
    body_end: int
    locals: list[tuple[int, str]]
    code_start: int
    instructions: list[WasmInstruction]

    @property
    def body_size(self) -> int:
        return self.body_end - self.body_start


class WasmModule:
    """Binary format, module section of the core specification: preamble, then id-size-content sections."""

    def __init__(self, data: bytes) -> None:
        self.data = data
        if data[:4] != WASM_MAGIC:
            raise FormatError("module does not start with \\0asm")
        self.version = int.from_bytes(data[4:8], "little")
        if self.version != 1:
            raise FormatError(f"binary version {self.version} is not 1")
        self.sections: list[WasmSection] = []
        self.types: list[FuncType] = []
        self.imports: list[dict[str, Any]] = []
        self.function_types: list[int] = []
        self.memories: list[dict[str, Any]] = []
        self.exports: list[dict[str, Any]] = []
        self.functions: list[WasmFunction] = []
        self.data_segments: list[dict[str, Any]] = []
        self.names: dict[str, Any] = {}
        self.start_function: int | None = None
        self._read_sections()

    def _read_sections(self) -> None:
        reader = Reader(self.data, 8)
        last_position = -1
        while not reader.at_end():
            start = reader.position
            section_id = reader.u8()
            size = reader.uleb()
            payload_start = reader.position
            end = payload_start + size
            if end > len(self.data):
                raise FormatError(f"section {section_id} claims {size} bytes past the end of the file")
            custom_name = None
            if section_id == 0:
                name_reader = Reader(self.data, payload_start, end)
                custom_name = name_reader.take(name_reader.uleb()).decode("utf-8")
                self._read_custom(custom_name, Reader(self.data, name_reader.position, end))
            else:
                if section_id not in WASM_SECTION_ORDER:
                    raise FormatError(f"section id {section_id} is not known")
                position = WASM_SECTION_ORDER.index(section_id)
                if position <= last_position:
                    raise FormatError(f"section id {section_id} out of order after {WASM_SECTION_ORDER[last_position]}")
                last_position = position
                self._read_known(section_id, Reader(self.data, payload_start, end))
            self.sections.append(WasmSection(section_id, WASM_SECTION_NAMES.get(section_id, f"id{section_id}"), start, end, payload_start, custom_name))
            reader.position = end

    def _valtype(self, reader: Reader) -> str:
        byte = reader.u8()
        if byte not in WASM_VALTYPES:
            raise FormatError(f"value type byte 0x{byte:02x} is not known")
        return WASM_VALTYPES[byte]

    def _limits(self, reader: Reader) -> dict[str, Any]:
        flag = reader.u8()
        minimum = reader.uleb()
        maximum = reader.uleb() if flag & 1 else None
        return {"min": minimum, "max": maximum}

    def _read_known(self, section_id: int, reader: Reader) -> None:
        if section_id == 1:
            for _ in range(reader.uleb()):
                if reader.u8() != 0x60:
                    raise FormatError("function type does not start with 0x60")
                params = tuple(self._valtype(reader) for _ in range(reader.uleb()))
                results = tuple(self._valtype(reader) for _ in range(reader.uleb()))
                self.types.append(FuncType(params, results))
        elif section_id == 2:
            for _ in range(reader.uleb()):
                module = reader.take(reader.uleb()).decode("utf-8")
                name = reader.take(reader.uleb()).decode("utf-8")
                kind = reader.u8()
                entry: dict[str, Any] = {"module": module, "name": name, "kind": WASM_EXPORT_KINDS.get(kind, str(kind))}
                if kind == 0:
                    entry["type"] = reader.uleb()
                elif kind == 1:
                    entry["reftype"] = self._valtype(reader)
                    entry["limits"] = self._limits(reader)
                elif kind == 2:
                    entry["limits"] = self._limits(reader)
                elif kind == 3:
                    entry["valtype"] = self._valtype(reader)
                    entry["mutable"] = bool(reader.u8())
                self.imports.append(entry)
        elif section_id == 3:
            self.function_types = [reader.uleb() for _ in range(reader.uleb())]
        elif section_id == 5:
            self.memories = [self._limits(reader) for _ in range(reader.uleb())]
        elif section_id == 7:
            for _ in range(reader.uleb()):
                name = reader.take(reader.uleb()).decode("utf-8")
                kind = reader.u8()
                self.exports.append({"name": name, "kind": WASM_EXPORT_KINDS.get(kind, str(kind)), "index": reader.uleb()})
        elif section_id == 8:
            self.start_function = reader.uleb()
        elif section_id == 10:
            imported = sum(1 for i in self.imports if i["kind"] == "func")
            for position in range(reader.uleb()):
                size = reader.uleb()
                body_start = reader.position
                body_end = body_start + size
                body = Reader(self.data, body_start, body_end)
                locals_: list[tuple[int, str]] = []
                for _ in range(body.uleb()):
                    count = body.uleb()
                    locals_.append((count, self._valtype(body)))
                code_start = body.position
                instructions = disassemble_wasm(self.data, code_start, body_end)
                self.functions.append(WasmFunction(imported + position, self.function_types[position], body_start, body_end, locals_, code_start, instructions))
                reader.position = body_end
        elif section_id == 11:
            for _ in range(reader.uleb()):
                flag = reader.uleb()
                memory_index = reader.uleb() if flag == 2 else 0
                offset = None
                if flag in (0, 2):
                    offset_instructions = disassemble_wasm(self.data, reader.position, reader.end)
                    if not offset_instructions or offset_instructions[-1].mnemonic != "end":
                        raise FormatError("data segment offset expression has no end")
                    if offset_instructions[0].mnemonic == "i32.const":
                        offset = offset_instructions[0].operands[0]
                    reader.position = offset_instructions[-1].offset + 1
                payload = reader.take(reader.uleb())
                self.data_segments.append({"memory": memory_index, "passive": flag == 1, "offset": offset, "bytes": payload})
        elif section_id in (4, 6, 9, 12, 13):
            reader.position = reader.end

    def _read_custom(self, name: str, reader: Reader) -> None:
        if name != "name":
            self.names.setdefault("other", []).append(name)
            return
        while not reader.at_end():
            subsection = reader.u8()
            size = reader.uleb()
            sub = Reader(self.data, reader.position, reader.position + size)
            if subsection == 0:
                self.names["module"] = sub.take(sub.uleb()).decode("utf-8")
            elif subsection == 1:
                self.names["functions"] = {sub.uleb(): sub.take(sub.uleb()).decode("utf-8") for _ in range(sub.uleb())}
            elif subsection == 2:
                locals_map: dict[int, dict[int, str]] = {}
                for _ in range(sub.uleb()):
                    function_index = sub.uleb()
                    locals_map[function_index] = {sub.uleb(): sub.take(sub.uleb()).decode("utf-8") for _ in range(sub.uleb())}
                self.names["locals"] = locals_map
            else:
                self.names.setdefault("otherSubsections", []).append(subsection)
            reader.position = sub.end

    def function_name(self, index: int) -> str | None:
        if "functions" in self.names and index in self.names["functions"]:
            return self.names["functions"][index]
        for export in self.exports:
            if export["kind"] == "func" and export["index"] == index:
                return export["name"]
        imported = [i for i in self.imports if i["kind"] == "func"]
        if index < len(imported):
            return f"{imported[index]['module']}.{imported[index]['name']}"
        return None

    def function(self, name: str) -> WasmFunction:
        for function in self.functions:
            if self.function_name(function.index) == name:
                return function
        raise FormatError(f"no function exported or named {name}")

    def signature(self, function: WasmFunction) -> FuncType:
        return self.types[function.type_index]

    def has_name_section(self) -> bool:
        return any(s.id == 0 and s.custom_name == "name" for s in self.sections)

    def to_dict(self) -> dict[str, Any]:
        return {
            "fileBytes": len(self.data),
            "version": self.version,
            "sections": [{"id": s.id, "name": s.name if s.custom_name is None else f"Custom \"{s.custom_name}\"", "start": s.start, "payloadStart": s.payload_start, "end": s.end, "size": s.size} for s in self.sections],
            "types": [t.render() for t in self.types],
            "imports": [{k: v for k, v in i.items()} for i in self.imports],
            "exports": self.exports,
            "memories": self.memories,
            "functions": [
                {
                    "index": f.index,
                    "name": self.function_name(f.index),
                    "type": self.signature(f).render(),
                    "locals": [{"count": c, "type": t} for c, t in f.locals],
                    "bodyBytes": f.body_size,
                    "instructions": len(f.instructions),
                }
                for f in self.functions
            ],
            "data": [{"memory": d["memory"], "offset": d["offset"], "bytes": d["bytes"].hex(" "), "size": len(d["bytes"])} for d in self.data_segments],
            "nameSection": self.has_name_section(),
            "names": {k: (v if not isinstance(v, dict) else {str(a): b for a, b in v.items()}) for k, v in self.names.items()},
        }


def load_wasm(name: str) -> WasmModule:
    return WasmModule((FIXTURES / "wasm" / name).read_bytes())


def _blocktype(reader: Reader) -> str:
    byte = reader.data[reader.position]
    if byte == 0x40:
        reader.u8()
        return ""
    if byte in WASM_VALTYPES:
        return WASM_VALTYPES[reader.u8()]
    return f"type[{reader.sleb()}]"


def disassemble_wasm(data: bytes, start: int, end: int) -> list[WasmInstruction]:
    """Instructions of one expression. `block`, `loop`, and `if` raise the nesting depth, `end` lowers it.
    The expression ends at the `end` that closes depth 0, or at `end` of the byte range."""
    reader = Reader(data, start, end)
    instructions: list[WasmInstruction] = []
    depth = 0
    while not reader.at_end():
        offset = reader.position
        opcode = reader.u8()
        operands: tuple[Any, ...] = ()
        shown_depth = depth
        if opcode in WASM_CONTROL:
            mnemonic = WASM_CONTROL[opcode]
            if opcode in (0x02, 0x03, 0x04):
                operands = (_blocktype(reader),)
                depth += 1
            elif opcode == 0x05:
                shown_depth = depth - 1
            elif opcode == 0x0B:
                depth -= 1
                shown_depth = max(depth, 0)
            elif opcode in (0x0C, 0x0D, 0x10):
                operands = (reader.uleb(),)
            elif opcode == 0x0E:
                labels = tuple(reader.uleb() for _ in range(reader.uleb()))
                operands = labels + (reader.uleb(),)
            elif opcode == 0x11:
                operands = (reader.uleb(), reader.uleb())
        elif opcode in WASM_PARAMETRIC:
            mnemonic = WASM_PARAMETRIC[opcode]
            if opcode == 0x1C:
                operands = tuple(WASM_VALTYPES.get(reader.u8(), "?") for _ in range(reader.uleb()))
        elif opcode in WASM_VARIABLE:
            mnemonic = WASM_VARIABLE[opcode]
            operands = (reader.uleb(),)
        elif opcode in WASM_MEMORY:
            mnemonic = WASM_MEMORY[opcode]
            operands = (reader.uleb(), reader.uleb())
        elif opcode in (0x3F, 0x40):
            mnemonic = "memory.size" if opcode == 0x3F else "memory.grow"
            operands = (reader.u8(),)
        elif opcode in WASM_CONSTANTS:
            mnemonic = WASM_CONSTANTS[opcode]
            if opcode == 0x41:
                operands = (reader.sleb(),)
            elif opcode == 0x42:
                operands = (reader.sleb(),)
            elif opcode == 0x43:
                operands = (struct.unpack("<f", reader.take(4))[0],)
            else:
                operands = (struct.unpack("<d", reader.take(8))[0],)
        elif opcode in WASM_NUMERIC:
            mnemonic = WASM_NUMERIC[opcode]
        elif opcode in WASM_REFERENCE:
            mnemonic = WASM_REFERENCE[opcode]
            if opcode != 0xD1:
                operands = (reader.uleb(),)
        else:
            raise FormatError(f"opcode 0x{opcode:02x} at offset {offset} is not in the single-byte table")
        text = mnemonic + ("".join(f" {o}" for o in operands if o != "") if operands else "")
        instructions.append(WasmInstruction(offset, bytes(data[offset : reader.position]), mnemonic, operands, text, shown_depth))
        if opcode == 0x0B and depth < 0:
            break
    return instructions


def wasm_listing(module: WasmModule, name: str) -> list[dict[str, Any]]:
    function = module.function(name)
    rows = []
    for instruction in function.instructions:
        row = {"offset": instruction.offset, "bytes": hex_bytes(instruction.raw), "text": instruction.text, "depth": instruction.depth}
        if instruction.mnemonic == "call":
            row["comment"] = module.function_name(instruction.operands[0])
        rows.append(row)
    return rows


OBJDUMP_CODE_LINE = re.compile(r"^ ([0-9a-f]{6}): ((?:[0-9a-f]{2} )+)\s*\| ?(.*)$")
OBJDUMP_FUNCTION = re.compile(r"^([0-9a-f]{6}) func\[(\d+)\](?: <([^>]+)>)?:$")
OBJDUMP_SECTION = re.compile(r"^\s*(\w+) start=0x([0-9a-f]+) end=0x([0-9a-f]+) \(size=0x([0-9a-f]+)\)(?: count: (\d+))?(?: \"[^\"]*\")?$")


def parse_wasm_objdump(text: str) -> dict[str, Any]:
    """Section table and per-function code rows from `wasm-objdump -h -x -d`.
    A row whose text is empty continues the bytes of the previous row (long br_table operands)."""
    sections = []
    functions: dict[int, dict[str, Any]] = {}
    current: dict[str, Any] | None = None
    for line in text.splitlines():
        section = OBJDUMP_SECTION.match(line)
        if section:
            sections.append({"name": section.group(1), "start": int(section.group(2), 16), "end": int(section.group(3), 16), "size": int(section.group(4), 16), "count": None if section.group(5) is None else int(section.group(5))})
            continue
        header = OBJDUMP_FUNCTION.match(line)
        if header:
            current = {"offset": int(header.group(1), 16), "name": header.group(3), "rows": []}
            functions[int(header.group(2))] = current
            continue
        row = OBJDUMP_CODE_LINE.match(line)
        if row and current is not None:
            text_part = row.group(3).strip()
            byte_text = row.group(2).strip()
            if not text_part and current["rows"]:
                current["rows"][-1]["bytes"] += " " + byte_text
                continue
            if text_part.startswith("local["):
                continue
            text_part = re.sub(r" <[^>]*>$", "", text_part)
            current["rows"].append({"offset": int(row.group(1), 16), "bytes": byte_text, "text": text_part})
    return {"sections": sections, "functions": functions}


def compare_with_wasm_objdump(module: WasmModule, objdump_text: str) -> dict[str, Any]:
    expected = parse_wasm_objdump(objdump_text)
    mismatches: list[dict[str, Any]] = []
    compared = 0
    ours_sections = [(s.name, s.payload_start, s.end) for s in module.sections]
    theirs_sections = [(s["name"], s["start"], s["end"]) for s in expected["sections"]]
    if ours_sections != theirs_sections:
        mismatches.append({"where": "sections", "expected": theirs_sections, "got": ours_sections})
    for function in module.functions:
        rows = expected["functions"].get(function.index)
        if rows is None:
            mismatches.append({"where": f"func[{function.index}]", "expected": "a listing", "got": "none"})
            continue
        if len(rows["rows"]) != len(function.instructions):
            mismatches.append({"where": f"func[{function.index}]", "expected": f"{len(rows['rows'])} instructions", "got": f"{len(function.instructions)}"})
        for instruction, row in zip(function.instructions, rows["rows"]):
            compared += 1
            ours = (instruction.offset, hex_bytes(instruction.raw), instruction.text)
            theirs = (row["offset"], row["bytes"], row["text"])
            if ours != theirs:
                mismatches.append({"where": f"func[{function.index}]", "expected": theirs, "got": ours})
    return {"compared": compared, "mismatches": mismatches, "agree": not mismatches}


def wasm_structure(instructions: list[WasmInstruction]) -> dict[str, int]:
    structured = sum(1 for i in instructions if i.mnemonic in ("block", "loop", "if"))
    branches = sum(1 for i in instructions if i.mnemonic in ("br", "br_if", "br_table"))
    tables = sum(1 for i in instructions if i.mnemonic == "br_table")
    return {"instructions": len(instructions), "structured": structured, "branches": branches, "tables": tables, "jumps": 0}


METADATA_SIGNATURE = 0x424A5342
CLI_HEADER_DIRECTORY = 14
TABLE_NAMES = {
    0x00: "Module", 0x01: "TypeRef", 0x02: "TypeDef", 0x03: "FieldPtr", 0x04: "Field", 0x05: "MethodPtr", 0x06: "MethodDef", 0x07: "ParamPtr",
    0x08: "Param", 0x09: "InterfaceImpl", 0x0A: "MemberRef", 0x0B: "Constant", 0x0C: "CustomAttribute", 0x0D: "FieldMarshal", 0x0E: "DeclSecurity",
    0x0F: "ClassLayout", 0x10: "FieldLayout", 0x11: "StandAloneSig", 0x12: "EventMap", 0x13: "EventPtr", 0x14: "Event", 0x15: "PropertyMap",
    0x16: "PropertyPtr", 0x17: "Property", 0x18: "MethodSemantics", 0x19: "MethodImpl", 0x1A: "ModuleRef", 0x1B: "TypeSpec", 0x1C: "ImplMap",
    0x1D: "FieldRva", 0x1E: "EncLog", 0x1F: "EncMap", 0x20: "Assembly", 0x21: "AssemblyProcessor", 0x22: "AssemblyOS", 0x23: "AssemblyRef",
    0x24: "AssemblyRefProcessor", 0x25: "AssemblyRefOS", 0x26: "File", 0x27: "ExportedType", 0x28: "ManifestResource", 0x29: "NestedClass",
    0x2A: "GenericParam", 0x2B: "MethodSpec", 0x2C: "GenericParamConstraint",
}
CODED_INDEXES = {
    "TypeDefOrRef": (2, [0x02, 0x01, 0x1B]),
    "HasConstant": (2, [0x04, 0x08, 0x17]),
    "HasCustomAttribute": (5, [0x06, 0x04, 0x01, 0x02, 0x08, 0x09, 0x0A, 0x00, 0x0E, 0x17, 0x14, 0x11, 0x1A, 0x1B, 0x20, 0x23, 0x26, 0x27, 0x28, 0x2A, 0x2C, 0x2B]),
    "HasFieldMarshal": (1, [0x04, 0x08]),
    "HasDeclSecurity": (2, [0x02, 0x06, 0x20]),
    "MemberRefParent": (3, [0x02, 0x01, 0x1A, 0x06, 0x1B]),
    "HasSemantics": (1, [0x14, 0x17]),
    "MethodDefOrRef": (1, [0x06, 0x0A]),
    "MemberForwarded": (1, [0x04, 0x06]),
    "Implementation": (2, [0x26, 0x23, 0x27]),
    "CustomAttributeType": (3, [None, None, 0x06, 0x0A, None]),
    "ResolutionScope": (2, [0x00, 0x1A, 0x23, 0x01]),
    "TypeOrMethodDef": (1, [0x02, 0x06]),
}
TABLE_SCHEMAS: dict[int, list[tuple[str, str]]] = {
    0x00: [("Generation", "u2"), ("Name", "S"), ("Mvid", "G"), ("EncId", "G"), ("EncBaseId", "G")],
    0x01: [("ResolutionScope", "C:ResolutionScope"), ("TypeName", "S"), ("TypeNamespace", "S")],
    0x02: [("Flags", "u4"), ("TypeName", "S"), ("TypeNamespace", "S"), ("Extends", "C:TypeDefOrRef"), ("FieldList", "T:04"), ("MethodList", "T:06")],
    0x03: [("Field", "T:04")],
    0x04: [("Flags", "u2"), ("Name", "S"), ("Signature", "B")],
    0x05: [("Method", "T:06")],
    0x06: [("RVA", "u4"), ("ImplFlags", "u2"), ("Flags", "u2"), ("Name", "S"), ("Signature", "B"), ("ParamList", "T:08")],
    0x07: [("Param", "T:08")],
    0x08: [("Flags", "u2"), ("Sequence", "u2"), ("Name", "S")],
    0x09: [("Class", "T:02"), ("Interface", "C:TypeDefOrRef")],
    0x0A: [("Class", "C:MemberRefParent"), ("Name", "S"), ("Signature", "B")],
    0x0B: [("Type", "u2"), ("Parent", "C:HasConstant"), ("Value", "B")],
    0x0C: [("Parent", "C:HasCustomAttribute"), ("Type", "C:CustomAttributeType"), ("Value", "B")],
    0x0D: [("Parent", "C:HasFieldMarshal"), ("NativeType", "B")],
    0x0E: [("Action", "u2"), ("Parent", "C:HasDeclSecurity"), ("PermissionSet", "B")],
    0x0F: [("PackingSize", "u2"), ("ClassSize", "u4"), ("Parent", "T:02")],
    0x10: [("Offset", "u4"), ("Field", "T:04")],
    0x11: [("Signature", "B")],
    0x12: [("Parent", "T:02"), ("EventList", "T:14")],
    0x13: [("Event", "T:14")],
    0x14: [("EventFlags", "u2"), ("Name", "S"), ("EventType", "C:TypeDefOrRef")],
    0x15: [("Parent", "T:02"), ("PropertyList", "T:17")],
    0x16: [("Property", "T:17")],
    0x17: [("Flags", "u2"), ("Name", "S"), ("Type", "B")],
    0x18: [("Semantics", "u2"), ("Method", "T:06"), ("Association", "C:HasSemantics")],
    0x19: [("Class", "T:02"), ("MethodBody", "C:MethodDefOrRef"), ("MethodDeclaration", "C:MethodDefOrRef")],
    0x1A: [("Name", "S")],
    0x1B: [("Signature", "B")],
    0x1C: [("MappingFlags", "u2"), ("MemberForwarded", "C:MemberForwarded"), ("ImportName", "S"), ("ImportScope", "T:1A")],
    0x1D: [("RVA", "u4"), ("Field", "T:04")],
    0x1E: [("Token", "u4"), ("FuncCode", "u4")],
    0x1F: [("Token", "u4")],
    0x20: [("HashAlgId", "u4"), ("MajorVersion", "u2"), ("MinorVersion", "u2"), ("BuildNumber", "u2"), ("RevisionNumber", "u2"), ("Flags", "u4"), ("PublicKey", "B"), ("Name", "S"), ("Culture", "S")],
    0x21: [("Processor", "u4")],
    0x22: [("OSPlatformId", "u4"), ("OSMajorVersion", "u4"), ("OSMinorVersion", "u4")],
    0x23: [("MajorVersion", "u2"), ("MinorVersion", "u2"), ("BuildNumber", "u2"), ("RevisionNumber", "u2"), ("Flags", "u4"), ("PublicKeyOrToken", "B"), ("Name", "S"), ("Culture", "S"), ("HashValue", "B")],
    0x24: [("Processor", "u4"), ("AssemblyRef", "T:23")],
    0x25: [("OSPlatformId", "u4"), ("OSMajorVersion", "u4"), ("OSMinorVersion", "u4"), ("AssemblyRef", "T:23")],
    0x26: [("Flags", "u4"), ("Name", "S"), ("HashValue", "B")],
    0x27: [("Flags", "u4"), ("TypeDefId", "u4"), ("TypeName", "S"), ("TypeNamespace", "S"), ("Implementation", "C:Implementation")],
    0x28: [("Offset", "u4"), ("Flags", "u4"), ("Name", "S"), ("Implementation", "C:Implementation")],
    0x29: [("NestedClass", "T:02"), ("EnclosingClass", "T:02")],
    0x2A: [("Number", "u2"), ("Flags", "u2"), ("Owner", "C:TypeOrMethodDef"), ("Name", "S")],
    0x2B: [("Method", "C:MethodDefOrRef"), ("Instantiation", "B")],
    0x2C: [("Owner", "T:2A"), ("Constraint", "C:TypeDefOrRef")],
}
CIL_ONE_BYTE = {
    0x00: ("nop", ""), 0x01: ("break", ""), 0x02: ("ldarg.0", ""), 0x03: ("ldarg.1", ""), 0x04: ("ldarg.2", ""), 0x05: ("ldarg.3", ""),
    0x06: ("ldloc.0", ""), 0x07: ("ldloc.1", ""), 0x08: ("ldloc.2", ""), 0x09: ("ldloc.3", ""), 0x0A: ("stloc.0", ""), 0x0B: ("stloc.1", ""),
    0x0C: ("stloc.2", ""), 0x0D: ("stloc.3", ""), 0x0E: ("ldarg.s", "u8"), 0x0F: ("ldarga.s", "u8"), 0x10: ("starg.s", "u8"), 0x11: ("ldloc.s", "u8"),
    0x12: ("ldloca.s", "u8"), 0x13: ("stloc.s", "u8"), 0x14: ("ldnull", ""), 0x15: ("ldc.i4.m1", ""), 0x16: ("ldc.i4.0", ""), 0x17: ("ldc.i4.1", ""),
    0x18: ("ldc.i4.2", ""), 0x19: ("ldc.i4.3", ""), 0x1A: ("ldc.i4.4", ""), 0x1B: ("ldc.i4.5", ""), 0x1C: ("ldc.i4.6", ""), 0x1D: ("ldc.i4.7", ""),
    0x1E: ("ldc.i4.8", ""), 0x1F: ("ldc.i4.s", "i8"), 0x20: ("ldc.i4", "i32"), 0x21: ("ldc.i8", "i64"), 0x22: ("ldc.r4", "f32"), 0x23: ("ldc.r8", "f64"),
    0x25: ("dup", ""), 0x26: ("pop", ""), 0x27: ("jmp", "tok"), 0x28: ("call", "tok"), 0x29: ("calli", "tok"), 0x2A: ("ret", ""),
    0x2B: ("br.s", "br8"), 0x2C: ("brfalse.s", "br8"), 0x2D: ("brtrue.s", "br8"), 0x2E: ("beq.s", "br8"), 0x2F: ("bge.s", "br8"), 0x30: ("bgt.s", "br8"),
    0x31: ("ble.s", "br8"), 0x32: ("blt.s", "br8"), 0x33: ("bne.un.s", "br8"), 0x34: ("bge.un.s", "br8"), 0x35: ("bgt.un.s", "br8"), 0x36: ("ble.un.s", "br8"),
    0x37: ("blt.un.s", "br8"), 0x38: ("br", "br32"), 0x39: ("brfalse", "br32"), 0x3A: ("brtrue", "br32"), 0x3B: ("beq", "br32"), 0x3C: ("bge", "br32"),
    0x3D: ("bgt", "br32"), 0x3E: ("ble", "br32"), 0x3F: ("blt", "br32"), 0x40: ("bne.un", "br32"), 0x41: ("bge.un", "br32"), 0x42: ("bgt.un", "br32"),
    0x43: ("ble.un", "br32"), 0x44: ("blt.un", "br32"), 0x45: ("switch", "switch"), 0x46: ("ldind.i1", ""), 0x47: ("ldind.u1", ""), 0x48: ("ldind.i2", ""),
    0x49: ("ldind.u2", ""), 0x4A: ("ldind.i4", ""), 0x4B: ("ldind.u4", ""), 0x4C: ("ldind.i8", ""), 0x4D: ("ldind.i", ""), 0x4E: ("ldind.r4", ""),
    0x4F: ("ldind.r8", ""), 0x50: ("ldind.ref", ""), 0x51: ("stind.ref", ""), 0x52: ("stind.i1", ""), 0x53: ("stind.i2", ""), 0x54: ("stind.i4", ""),
    0x55: ("stind.i8", ""), 0x56: ("stind.r4", ""), 0x57: ("stind.r8", ""), 0x58: ("add", ""), 0x59: ("sub", ""), 0x5A: ("mul", ""), 0x5B: ("div", ""),
    0x5C: ("div.un", ""), 0x5D: ("rem", ""), 0x5E: ("rem.un", ""), 0x5F: ("and", ""), 0x60: ("or", ""), 0x61: ("xor", ""), 0x62: ("shl", ""), 0x63: ("shr", ""),
    0x64: ("shr.un", ""), 0x65: ("neg", ""), 0x66: ("not", ""), 0x67: ("conv.i1", ""), 0x68: ("conv.i2", ""), 0x69: ("conv.i4", ""), 0x6A: ("conv.i8", ""),
    0x6B: ("conv.r4", ""), 0x6C: ("conv.r8", ""), 0x6D: ("conv.u4", ""), 0x6E: ("conv.u8", ""), 0x6F: ("callvirt", "tok"), 0x70: ("cpobj", "tok"),
    0x71: ("ldobj", "tok"), 0x72: ("ldstr", "tok"), 0x73: ("newobj", "tok"), 0x74: ("castclass", "tok"), 0x75: ("isinst", "tok"), 0x76: ("conv.r.un", ""),
    0x79: ("unbox", "tok"), 0x7A: ("throw", ""), 0x7B: ("ldfld", "tok"), 0x7C: ("ldflda", "tok"), 0x7D: ("stfld", "tok"), 0x7E: ("ldsfld", "tok"),
    0x7F: ("ldsflda", "tok"), 0x80: ("stsfld", "tok"), 0x81: ("stobj", "tok"), 0x82: ("conv.ovf.i1.un", ""), 0x83: ("conv.ovf.i2.un", ""),
    0x84: ("conv.ovf.i4.un", ""), 0x85: ("conv.ovf.i8.un", ""), 0x86: ("conv.ovf.u1.un", ""), 0x87: ("conv.ovf.u2.un", ""), 0x88: ("conv.ovf.u4.un", ""),
    0x89: ("conv.ovf.u8.un", ""), 0x8A: ("conv.ovf.i.un", ""), 0x8B: ("conv.ovf.u.un", ""), 0x8C: ("box", "tok"), 0x8D: ("newarr", "tok"), 0x8E: ("ldlen", ""),
    0x8F: ("ldelema", "tok"), 0x90: ("ldelem.i1", ""), 0x91: ("ldelem.u1", ""), 0x92: ("ldelem.i2", ""), 0x93: ("ldelem.u2", ""), 0x94: ("ldelem.i4", ""),
    0x95: ("ldelem.u4", ""), 0x96: ("ldelem.i8", ""), 0x97: ("ldelem.i", ""), 0x98: ("ldelem.r4", ""), 0x99: ("ldelem.r8", ""), 0x9A: ("ldelem.ref", ""),
    0x9B: ("stelem.i", ""), 0x9C: ("stelem.i1", ""), 0x9D: ("stelem.i2", ""), 0x9E: ("stelem.i4", ""), 0x9F: ("stelem.i8", ""), 0xA0: ("stelem.r4", ""),
    0xA1: ("stelem.r8", ""), 0xA2: ("stelem.ref", ""), 0xA3: ("ldelem", "tok"), 0xA4: ("stelem", "tok"), 0xA5: ("unbox.any", "tok"), 0xB3: ("conv.ovf.i1", ""),
    0xB4: ("conv.ovf.u1", ""), 0xB5: ("conv.ovf.i2", ""), 0xB6: ("conv.ovf.u2", ""), 0xB7: ("conv.ovf.i4", ""), 0xB8: ("conv.ovf.u4", ""), 0xB9: ("conv.ovf.i8", ""),
    0xBA: ("conv.ovf.u8", ""), 0xC2: ("refanyval", "tok"), 0xC3: ("ckfinite", ""), 0xC6: ("mkrefany", "tok"), 0xD0: ("ldtoken", "tok"), 0xD1: ("conv.u2", ""),
    0xD2: ("conv.u1", ""), 0xD3: ("conv.i", ""), 0xD4: ("conv.ovf.i", ""), 0xD5: ("conv.ovf.u", ""), 0xD6: ("add.ovf", ""), 0xD7: ("add.ovf.un", ""),
    0xD8: ("mul.ovf", ""), 0xD9: ("mul.ovf.un", ""), 0xDA: ("sub.ovf", ""), 0xDB: ("sub.ovf.un", ""), 0xDC: ("endfinally", ""), 0xDD: ("leave", "br32"),
    0xDE: ("leave.s", "br8"), 0xDF: ("stind.i", ""), 0xE0: ("conv.u", ""),
}
CIL_TWO_BYTE = {
    0x00: ("arglist", ""), 0x01: ("ceq", ""), 0x02: ("cgt", ""), 0x03: ("cgt.un", ""), 0x04: ("clt", ""), 0x05: ("clt.un", ""), 0x06: ("ldftn", "tok"),
    0x07: ("ldvirtftn", "tok"), 0x09: ("ldarg", "u16"), 0x0A: ("ldarga", "u16"), 0x0B: ("starg", "u16"), 0x0C: ("ldloc", "u16"), 0x0D: ("ldloca", "u16"),
    0x0E: ("stloc", "u16"), 0x0F: ("localloc", ""), 0x11: ("endfilter", ""), 0x12: ("unaligned.", "i8"), 0x13: ("volatile.", ""), 0x14: ("tail.", ""),
    0x15: ("initobj", "tok"), 0x16: ("constrained.", "tok"), 0x17: ("cpblk", ""), 0x18: ("initblk", ""), 0x19: ("no.", "i8"), 0x1A: ("rethrow", ""),
    0x1C: ("sizeof", "tok"), 0x1D: ("refanytype", ""), 0x1E: ("readonly.", ""),
}
CIL_OPERAND_TYPE_NAMES = {"": "InlineNone", "i8": "ShortInlineI", "u8": "ShortInlineVar", "br8": "ShortInlineBrTarget", "i32": "InlineI", "i64": "InlineI8", "f32": "ShortInlineR", "f64": "InlineR", "br32": "InlineBrTarget", "switch": "InlineSwitch", "u16": "InlineVar"}
CIL_TOKEN_OPERAND_TYPES = {"InlineMethod", "InlineField", "InlineType", "InlineTok", "InlineString", "InlineSig"}
ELEMENT_TYPES = {0x01: "void", 0x02: "bool", 0x03: "char", 0x04: "int8", 0x05: "uint8", 0x06: "int16", 0x07: "uint16", 0x08: "int32", 0x09: "uint32", 0x0A: "int64", 0x0B: "uint64", 0x0C: "float32", 0x0D: "float64", 0x0E: "string", 0x1C: "object", 0x18: "native int", 0x19: "native uint"}


@dataclass(frozen=True)
class PeSection:
    name: str
    virtual_size: int
    virtual_address: int
    raw_size: int
    raw_pointer: int

    def contains(self, rva: int) -> bool:
        return self.virtual_address <= rva < self.virtual_address + max(self.virtual_size, self.raw_size)


@dataclass(frozen=True)
class CilInstruction:
    offset: int
    raw: bytes
    mnemonic: str
    kind: str
    operand: Any
    text: str
    targets: tuple[int, ...] = ()


@dataclass
class MethodBody:
    rva: int
    file_offset: int
    fat: bool
    flags: int
    max_stack: int
    code_size: int
    local_signature_token: int
    code: bytes

    @property
    def header_size(self) -> int:
        return 12 if self.fat else 1

    @property
    def size(self) -> int:
        return self.header_size + self.code_size

    @property
    def init_locals(self) -> bool:
        return bool(self.flags & 0x10)


class CliAssembly:
    """ECMA-335 II.25: a PE file whose data directory 14 points at the CLI header, whose MetaData entry points at
    the metadata root (II.24.2), whose #~ stream holds the tables (II.22) sized by the heap and row counts."""

    def __init__(self, data: bytes) -> None:
        self.data = data
        if data[:2] != b"MZ":
            raise FormatError("file does not start with MZ")
        pe_offset = struct.unpack_from("<I", data, 0x3C)[0]
        if data[pe_offset : pe_offset + 4] != b"PE\0\0":
            raise FormatError("PE signature missing")
        coff = Reader(data, pe_offset + 4)
        self.machine = coff.u16le()
        section_count = coff.u16le()
        coff.take(12)
        optional_size = coff.u16le()
        coff.u16le()
        optional_start = coff.position
        optional = Reader(data, optional_start)
        magic = optional.u16le()
        self.pe32plus = magic == 0x20B
        if magic not in (0x10B, 0x20B):
            raise FormatError(f"optional header magic 0x{magic:04x} is not PE32 or PE32+")
        directories_offset = optional_start + (112 if self.pe32plus else 96)
        cli_directory = Reader(data, directories_offset + 8 * CLI_HEADER_DIRECTORY)
        self.cli_header_rva = cli_directory.u32le()
        self.cli_header_size = cli_directory.u32le()
        sections_reader = Reader(data, optional_start + optional_size)
        self.sections: list[PeSection] = []
        for _ in range(section_count):
            name = sections_reader.take(8).rstrip(b"\0").decode("ascii", "replace")
            virtual_size, virtual_address, raw_size, raw_pointer = struct.unpack("<IIII", sections_reader.take(16))
            sections_reader.take(16)
            self.sections.append(PeSection(name, virtual_size, virtual_address, raw_size, raw_pointer))
        if self.cli_header_rva == 0:
            raise FormatError("data directory 14 is empty, so this PE file carries no CLI header")
        self._read_cli_header()
        self._read_metadata()

    def rva_to_offset(self, rva: int) -> int:
        for section in self.sections:
            if section.contains(rva):
                return rva - section.virtual_address + section.raw_pointer
        raise FormatError(f"RVA 0x{rva:x} is in no section")

    def _read_cli_header(self) -> None:
        reader = Reader(self.data, self.rva_to_offset(self.cli_header_rva))
        self.cli_header_cb = reader.u32le()
        self.runtime_major = reader.u16le()
        self.runtime_minor = reader.u16le()
        self.metadata_rva = reader.u32le()
        self.metadata_size = reader.u32le()
        self.cli_flags = reader.u32le()
        self.entry_point_token = reader.u32le()

    def _read_metadata(self) -> None:
        self.metadata_offset = self.rva_to_offset(self.metadata_rva)
        reader = Reader(self.data, self.metadata_offset)
        if reader.u32le() != METADATA_SIGNATURE:
            raise FormatError("metadata root signature is not BSJB")
        self.metadata_major = reader.u16le()
        self.metadata_minor = reader.u16le()
        reader.u32le()
        version_length = reader.u32le()
        self.metadata_version = reader.take(version_length).rstrip(b"\0").decode("utf-8")
        reader.u16le()
        stream_count = reader.u16le()
        self.streams: dict[str, tuple[int, int]] = {}
        for _ in range(stream_count):
            offset = reader.u32le()
            size = reader.u32le()
            name_start = reader.position
            while self.data[reader.position] != 0:
                reader.position += 1
            name = self.data[name_start : reader.position].decode("ascii")
            reader.position += 1
            while (reader.position - name_start) % 4:
                reader.position += 1
            self.streams[name] = (offset, size)
        self.strings_heap = self._stream_bytes("#Strings")
        self.user_strings_heap = self._stream_bytes("#US")
        self.blob_heap = self._stream_bytes("#Blob")
        self.guid_heap = self._stream_bytes("#GUID")
        self._read_tables()

    def _stream_bytes(self, name: str) -> bytes:
        if name not in self.streams:
            return b""
        offset, size = self.streams[name]
        start = self.metadata_offset + offset
        return self.data[start : start + size]

    def _read_tables(self) -> None:
        offset, _size = self.streams["#~"]
        reader = Reader(self.data, self.metadata_offset + offset)
        reader.u32le()
        self.tables_major = reader.u8()
        self.tables_minor = reader.u8()
        self.heap_sizes = reader.u8()
        reader.u8()
        valid = reader.u64le()
        self.sorted_mask = reader.u64le()
        self.row_counts: dict[int, int] = {}
        for table in range(64):
            if valid & (1 << table):
                self.row_counts[table] = reader.u32le()
        self.row_sizes: dict[int, int] = {}
        self.table_offsets: dict[int, int] = {}
        self.column_layouts: dict[int, list[tuple[str, str, int]]] = {}
        for table in sorted(self.row_counts):
            if table not in TABLE_SCHEMAS:
                raise FormatError(f"table 0x{table:02x} is present but has no schema here")
            layout = [(name, kind, self._column_size(kind)) for name, kind in TABLE_SCHEMAS[table]]
            self.column_layouts[table] = layout
            self.row_sizes[table] = sum(size for _n, _k, size in layout)
            self.table_offsets[table] = reader.position - self.metadata_offset
            reader.position += self.row_sizes[table] * self.row_counts[table]

    def _column_size(self, kind: str) -> int:
        if kind == "u2":
            return 2
        if kind == "u4":
            return 4
        if kind == "S":
            return 4 if self.heap_sizes & 1 else 2
        if kind == "G":
            return 4 if self.heap_sizes & 2 else 2
        if kind == "B":
            return 4 if self.heap_sizes & 4 else 2
        if kind.startswith("T:"):
            return 4 if self.row_counts.get(int(kind[2:], 16), 0) >= 1 << 16 else 2
        if kind.startswith("C:"):
            bits, tables = CODED_INDEXES[kind[2:]]
            largest = max(self.row_counts.get(t, 0) for t in tables if t is not None)
            return 4 if largest >= 1 << (16 - bits) else 2
        raise FormatError(f"column kind {kind} is not known")

    def row(self, table: int, number: int) -> dict[str, Any]:
        """Row `number` (1-based, as tokens count) of a table, decoded with the layout for this module."""
        if number < 1 or number > self.row_counts.get(table, 0):
            raise FormatError(f"row {number} of table 0x{table:02x} does not exist")
        start = self.metadata_offset + self.table_offsets[table] + (number - 1) * self.row_sizes[table]
        reader = Reader(self.data, start)
        values: dict[str, Any] = {}
        for name, kind, size in self.column_layouts[table]:
            raw = reader.u16le() if size == 2 else reader.u32le()
            if kind == "S":
                values[name] = self.string(raw)
            elif kind == "B":
                values[name] = self.blob(raw)
            elif kind.startswith("C:"):
                bits, tables = CODED_INDEXES[kind[2:]]
                tag = raw & ((1 << bits) - 1)
                values[name] = (tables[tag] if tag < len(tables) else None, raw >> bits)
            else:
                values[name] = raw
        return values

    def rows(self, table: int) -> list[dict[str, Any]]:
        return [self.row(table, number) for number in range(1, self.row_counts.get(table, 0) + 1)]

    def string(self, index: int) -> str:
        end = self.strings_heap.find(b"\0", index)
        return self.strings_heap[index : end if end >= 0 else len(self.strings_heap)].decode("utf-8", "replace")

    def blob(self, index: int) -> bytes:
        reader = Reader(self.blob_heap, index)
        first = reader.u8()
        if first & 0x80 == 0:
            length = first
        elif first & 0xC0 == 0x80:
            length = ((first & 0x3F) << 8) | reader.u8()
        else:
            length = ((first & 0x1F) << 24) | (reader.u8() << 16) | (reader.u8() << 8) | reader.u8()
        return reader.take(length)

    def user_string(self, index: int) -> str:
        reader = Reader(self.user_strings_heap, index)
        first = reader.u8()
        if first & 0x80 == 0:
            length = first
        elif first & 0xC0 == 0x80:
            length = ((first & 0x3F) << 8) | reader.u8()
        else:
            length = ((first & 0x1F) << 24) | (reader.u8() << 16) | (reader.u8() << 8) | reader.u8()
        return reader.take(length)[: length - 1 if length % 2 else length].decode("utf-16-le", "replace")

    def type_defs(self) -> list[dict[str, Any]]:
        return self.rows(0x02)

    def method_defs(self) -> list[dict[str, Any]]:
        methods = self.rows(0x06)
        params = self.rows(0x08)
        for number, method in enumerate(methods, start=1):
            method["token"] = 0x06000000 | number
            next_first = methods[number]["ParamList"] if number < len(methods) else len(params) + 1
            method["params"] = [p["Name"] for p in params[method["ParamList"] - 1 : next_first - 1]]
            method["signatureText"] = describe_method_signature(method["Signature"])
        return methods

    def method(self, name: str) -> dict[str, Any]:
        for method in self.method_defs():
            if method["Name"] == name:
                return method
        raise FormatError(f"no MethodDef named {name}")

    def method_body(self, rva: int) -> MethodBody:
        """II.25.4: a tiny header is one byte with the size in its top six bits; a fat header is 12 bytes."""
        offset = self.rva_to_offset(rva)
        first = self.data[offset]
        if first & 3 == 2:
            size = first >> 2
            return MethodBody(rva, offset, False, 0, 8, size, 0, self.data[offset + 1 : offset + 1 + size])
        if first & 3 != 3:
            raise FormatError(f"method header byte 0x{first:02x} is neither tiny nor fat")
        reader = Reader(self.data, offset)
        flags_and_size = reader.u16le()
        flags = flags_and_size & 0xFFF
        header_dwords = flags_and_size >> 12
        max_stack = reader.u16le()
        code_size = reader.u32le()
        local_token = reader.u32le()
        start = offset + header_dwords * 4
        return MethodBody(rva, offset, True, flags, max_stack, code_size, local_token, self.data[start : start + code_size])

    def token_text(self, token: int) -> str:
        table = token >> 24
        index = token & 0xFFFFFF
        if table == 0x70:
            return repr(self.user_string(index))
        if table == 0x06:
            return self.row(0x06, index)["Name"]
        if table == 0x04:
            return self.row(0x04, index)["Name"]
        if table == 0x0A:
            member = self.row(0x0A, index)
            parent_table, parent_index = member["Class"]
            owner = ""
            if parent_table == 0x01:
                type_ref = self.row(0x01, parent_index)
                owner = f"{type_ref['TypeNamespace']}.{type_ref['TypeName']}"
            elif parent_table == 0x02:
                owner = self.row(0x02, parent_index)["TypeName"]
            return f"{owner}::{member['Name']}"
        if table == 0x01:
            type_ref = self.row(0x01, index)
            return f"{type_ref['TypeNamespace']}.{type_ref['TypeName']}"
        if table == 0x02:
            return self.row(0x02, index)["TypeName"]
        if table == 0x11:
            return "locals " + describe_locals_signature(self.row(0x11, index)["Signature"])
        return f"0x{token:08x}"

    def to_dict(self) -> dict[str, Any]:
        methods = []
        for method in self.method_defs():
            body = self.method_body(method["RVA"]) if method["RVA"] else None
            methods.append({
                "token": f"0x{method['token']:08x}",
                "name": method["Name"],
                "signature": method["signatureText"],
                "params": method["params"],
                "rva": f"0x{method['RVA']:x}",
                "fatHeader": None if body is None else body.fat,
                "maxStack": None if body is None else body.max_stack,
                "codeBytes": None if body is None else body.code_size,
                "initLocals": None if body is None else body.init_locals,
                "locals": None if body is None or not body.local_signature_token else describe_locals_signature(self.row(0x11, body.local_signature_token & 0xFFFFFF)["Signature"]),
                "instructions": None if body is None else len(disassemble_cil(body.code)),
            })
        return {
            "fileBytes": len(self.data),
            "machine": f"0x{self.machine:04x}",
            "pe32plus": self.pe32plus,
            "sections": [{"name": s.name, "virtualAddress": f"0x{s.virtual_address:x}", "virtualSize": f"0x{s.virtual_size:x}", "rawPointer": f"0x{s.raw_pointer:x}", "rawSize": f"0x{s.raw_size:x}"} for s in self.sections],
            "cliHeader": {"rva": f"0x{self.cli_header_rva:x}", "size": self.cli_header_size, "runtime": f"{self.runtime_major}.{self.runtime_minor}", "flags": f"0x{self.cli_flags:x}", "entryPoint": f"0x{self.entry_point_token:08x}"},
            "metadata": {"rva": f"0x{self.metadata_rva:x}", "size": self.metadata_size, "version": self.metadata_version, "streams": {name: {"offset": f"0x{offset:x}", "size": size} for name, (offset, size) in self.streams.items()}, "heapSizes": self.heap_sizes},
            "tables": {TABLE_NAMES[t]: {"id": f"0x{t:02x}", "rows": self.row_counts[t], "rowSize": self.row_sizes[t], "offset": f"0x{self.table_offsets[t]:x}"} for t in sorted(self.row_counts)},
            "typeDefs": [{"name": t["TypeName"], "namespace": t["TypeNamespace"], "flags": f"0x{t['Flags']:x}"} for t in self.type_defs()],
            "fields": [{"name": f["Name"], "signature": hex_bytes(f["Signature"])} for f in self.rows(0x04)],
            "methods": methods,
            "userStrings": [self.user_string(i) for i in self.user_string_offsets()],
        }

    def user_string_offsets(self) -> list[int]:
        offsets = []
        position = 1
        while position < len(self.user_strings_heap):
            first = self.user_strings_heap[position]
            if first & 0x80 == 0:
                length, header = first, 1
            elif first & 0xC0 == 0x80:
                length, header = ((first & 0x3F) << 8) | self.user_strings_heap[position + 1], 2
            else:
                length, header = int.from_bytes(self.user_strings_heap[position : position + 4], "big") & 0x1FFFFFFF, 4
            if length > 1:
                offsets.append(position)
            position += header + length
        return offsets


def load_assembly(name: str) -> CliAssembly:
    return CliAssembly((FIXTURES / "dotnet" / name).read_bytes())


def _element_type(reader: Reader) -> str:
    byte = reader.u8()
    if byte in ELEMENT_TYPES:
        return ELEMENT_TYPES[byte]
    if byte == 0x1D:
        return _element_type(reader) + "[]"
    if byte in (0x12, 0x11):
        return ("class" if byte == 0x12 else "valuetype") + f" 0x{reader.uleb():x}"
    return f"type0x{byte:02x}"


def describe_method_signature(blob: bytes) -> str:
    """II.23.2.1 MethodDefSig: calling convention, parameter count, return type, parameter types."""
    reader = Reader(blob)
    convention = reader.u8()
    count = reader.u8()
    returns = _element_type(reader)
    params = [_element_type(reader) for _ in range(count)]
    prefix = "static " if not convention & 0x20 else "instance "
    return f"{prefix}{returns}({', '.join(params)})"


def describe_locals_signature(blob: bytes) -> str:
    reader = Reader(blob)
    if reader.u8() != 0x07:
        raise FormatError("local signature does not start with LOCAL_SIG 0x07")
    count = reader.u8()
    return "(" + ", ".join(_element_type(reader) for _ in range(count)) + ")"


def disassemble_cil(code: bytes, assembly: CliAssembly | None = None) -> list[CilInstruction]:
    """Partition III: one opcode byte, or 0xFE and a second byte, then the operand the opcode names.
    Branch targets are relative to the next instruction. `switch` holds a count and that many targets."""
    reader = Reader(code)
    instructions: list[CilInstruction] = []
    while not reader.at_end():
        offset = reader.position
        first = reader.u8()
        if first == 0xFE:
            second = reader.u8()
            if second not in CIL_TWO_BYTE:
                raise FormatError(f"opcode fe {second:02x} at IL_{offset:04x} is not defined")
            mnemonic, kind = CIL_TWO_BYTE[second]
        else:
            if first not in CIL_ONE_BYTE:
                raise FormatError(f"opcode {first:02x} at IL_{offset:04x} is not defined")
            mnemonic, kind = CIL_ONE_BYTE[first]
        operand: Any = None
        targets: tuple[int, ...] = ()
        if kind == "i8":
            operand = struct.unpack("<b", reader.take(1))[0]
        elif kind == "u8":
            operand = reader.u8()
        elif kind == "u16":
            operand = reader.u16le()
        elif kind == "i32":
            operand = reader.i32le()
        elif kind == "i64":
            operand = struct.unpack("<q", reader.take(8))[0]
        elif kind == "f32":
            operand = struct.unpack("<f", reader.take(4))[0]
        elif kind == "f64":
            operand = struct.unpack("<d", reader.take(8))[0]
        elif kind == "br8":
            operand = reader.position + 1 + struct.unpack("<b", reader.take(1))[0]
            targets = (operand,)
        elif kind == "br32":
            operand = reader.position + 4 + reader.i32le()
            targets = (operand,)
        elif kind == "tok":
            operand = reader.u32le()
        elif kind == "switch":
            count = reader.u32le()
            base = reader.position + 4 * count
            operand = tuple(base + reader.i32le() for _ in range(count))
            targets = operand
        if kind in ("br8", "br32"):
            text = f"{mnemonic} IL_{operand:04x}"
        elif kind == "switch":
            text = f"{mnemonic} ({', '.join(f'IL_{t:04x}' for t in operand)})"
        elif kind == "tok":
            text = f"{mnemonic} {assembly.token_text(operand) if assembly else f'0x{operand:08x}'}"
        elif kind:
            text = f"{mnemonic} {operand}"
        else:
            text = mnemonic
        instructions.append(CilInstruction(offset, bytes(code[offset : reader.position]), mnemonic, kind, operand, text, targets))
    return instructions


def cil_listing(assembly: CliAssembly, method_name: str) -> list[dict[str, Any]]:
    method = assembly.method(method_name)
    body = assembly.method_body(method["RVA"])
    return [{"offset": i.offset, "bytes": hex_bytes(i.raw), "text": i.text} for i in disassemble_cil(body.code, assembly)]


def parse_metadump(text: str) -> dict[str, Any]:
    """The System.Reflection.Metadata dump captured into fixtures: tables, methods, bodies, IL bytes, opcodes."""
    result: dict[str, Any] = {"tables": {}, "methods": {}, "bodies": {}, "il": {}, "opcodes": {}, "heaps": {}, "typedefs": [], "params": {}}
    for line in text.splitlines():
        parts = line.split()
        if not parts:
            continue
        if parts[0] == "table":
            fields = dict(p.split("=", 1) for p in parts[2:])
            result["tables"][parts[1]] = {"id": int(fields["id"], 16), "rows": int(fields["rows"]), "rowsize": int(fields["rowsize"]), "offset": int(fields["offset"], 16)}
        elif parts[0] == "heap":
            fields = dict(p.split("=", 1) for p in parts[2:])
            result["heaps"][parts[1]] = {"size": int(fields["size"]), "offset": int(fields["offset"], 16)}
        elif parts[0] == "method":
            fields = dict(p.split("=", 1) for p in parts[3:] if "=" in p and not p.startswith("sig"))
            sig = line.split("sig=")[1].split(" params=")[0]
            params = line.split("params=[")[1].rstrip("]")
            result["methods"][parts[2]] = {"token": int(parts[1], 16), "rva": int(fields["rva"], 16), "sig": sig, "params": [p.split(":", 1)[1] for p in params.split(",") if p]}
        elif parts[0] == "body":
            fields = dict(p.split("=", 1) for p in parts[2:] if "=" in p)
            result["bodies"][int(parts[1], 16)] = {"size": int(fields["size"]), "maxstack": int(fields["maxstack"]), "codesize": int(fields["codesize"]), "localsinit": fields["localsinit"] == "True", "localsig": int(fields["localsig"], 16), "locals": line.split("locals=[")[1].split("]")[0]}
        elif parts[0] == "il":
            result["il"][int(parts[1], 16)] = " ".join(parts[2:])
        elif parts[0] == "opcode":
            result["opcodes"][int(parts[1], 16)] = {"name": parts[2], "operandType": parts[3], "size": int(parts[4].split("=")[1])}
        elif parts[0] == "typedef":
            result["typedefs"].append(parts[2])
        elif parts[0] in ("version", "entrypoint", "metadata", "runtime", "flags"):
            result[parts[0]] = " ".join(parts[1:])
    return result


def compare_with_metadump(assembly: CliAssembly, dump_text: str) -> dict[str, Any]:
    expected = parse_metadump(dump_text)
    mismatches: list[dict[str, Any]] = []
    for name, table in expected["tables"].items():
        ours = {"id": table["id"], "rows": assembly.row_counts.get(table["id"]), "rowsize": assembly.row_sizes.get(table["id"]), "offset": assembly.table_offsets.get(table["id"])}
        if ours != table:
            mismatches.append({"where": f"table {name}", "expected": table, "got": ours})
    for name, method in expected["methods"].items():
        ours_method = assembly.method(name)
        if ours_method["RVA"] != method["rva"] or ours_method["token"] != method["token"] or ours_method["params"] != method["params"] or hex_bytes(ours_method["Signature"]) != method["sig"]:
            mismatches.append({"where": f"method {name}", "expected": method, "got": {"rva": ours_method["RVA"], "token": ours_method["token"], "params": ours_method["params"], "sig": hex_bytes(ours_method["Signature"])}})
            continue
        body = assembly.method_body(ours_method["RVA"])
        expected_body = expected["bodies"][method["token"]]
        ours_body = {"size": body.size, "maxstack": body.max_stack, "codesize": body.code_size, "localsinit": body.init_locals, "localsig": body.local_signature_token}
        if any(ours_body[k] != expected_body[k] for k in ours_body):
            mismatches.append({"where": f"body {name}", "expected": expected_body, "got": ours_body})
        if hex_bytes(body.code) != expected["il"][method["token"]]:
            mismatches.append({"where": f"il {name}", "expected": expected["il"][method["token"]], "got": hex_bytes(body.code)})
    for value, row in expected["opcodes"].items():
        if row["name"].startswith("prefix"):
            continue
        if value > 0xFF:
            ours_entry = CIL_TWO_BYTE.get(value & 0xFF)
        else:
            ours_entry = CIL_ONE_BYTE.get(value)
        if ours_entry is None:
            mismatches.append({"where": f"opcode 0x{value:04x}", "expected": row["name"], "got": None})
            continue
        operand_ok = row["operandType"] in CIL_TOKEN_OPERAND_TYPES if ours_entry[1] == "tok" else CIL_OPERAND_TYPE_NAMES[ours_entry[1]] == row["operandType"]
        if ours_entry[0] != row["name"] or not operand_ok:
            mismatches.append({"where": f"opcode 0x{value:04x}", "expected": row, "got": ours_entry})
    compared = len(expected["tables"]) + len(expected["methods"]) + len(expected["opcodes"])
    return {"compared": compared, "mismatches": mismatches, "agree": not mismatches}


def cil_structure(instructions: list[CilInstruction]) -> dict[str, int]:
    jumps = sum(1 for i in instructions if i.kind in ("br8", "br32"))
    switches = sum(1 for i in instructions if i.kind == "switch")
    returns = sum(1 for i in instructions if i.mnemonic == "ret")
    return {"instructions": len(instructions), "jumps": jumps, "switches": switches, "returns": returns, "structured": 0}


class NativeObject:
    """Enough ELF64 to list section names and function symbols, so the native column can be measured too.
    The listing comes from the llvm-objdump text captured for lesson 33, not from a decoder in this lesson."""

    def __init__(self, data: bytes, listing: str) -> None:
        if data[:4] != b"\x7fELF":
            raise FormatError("not an ELF file")
        shoff, shentsize, shnum, shstrndx = struct.unpack_from("<Q", data, 0x28)[0], struct.unpack_from("<H", data, 0x3A)[0], struct.unpack_from("<H", data, 0x3C)[0], struct.unpack_from("<H", data, 0x3E)[0]
        headers = [struct.unpack_from("<IIQQQQIIQQ", data, shoff + i * shentsize) for i in range(shnum)]
        names_header = headers[shstrndx]
        name_table = data[names_header[4] : names_header[4] + names_header[5]]
        self.section_names = [_cstring(name_table, h[0]) for h in headers]
        self.functions: list[tuple[str, int, int]] = []
        for header in headers:
            if header[1] != 2:
                continue
            strings_header = headers[header[6]]
            strings = data[strings_header[4] : strings_header[4] + strings_header[5]]
            for offset in range(0, header[5], 24):
                st_name, st_info, _other, _shndx, st_value, st_size = struct.unpack_from("<IBBHQQ", data, header[4] + offset)
                if st_info & 0xF == 2:
                    self.functions.append((_cstring(strings, st_name), st_value, st_size))
        self.listing = listing
        self.file_size = len(data)

    def function_rows(self, name: str) -> list[dict[str, Any]]:
        start, size = next((v, s) for n, v, s in self.functions if n == name)
        rows = []
        for line in self.listing.splitlines():
            if ":" not in line or "\t" not in line:
                continue
            head, _tab, rest = line.partition("\t")
            address_text, _colon, byte_text = head.strip().partition(":")
            if not address_text or not all(c in "0123456789abcdef" for c in address_text):
                continue
            address = int(address_text, 16)
            if start <= address < start + size:
                rows.append({"offset": address, "bytes": " ".join(byte_text.split()), "text": " ".join(rest.split("#", 1)[0].split())})
        return rows

    def has_debug_info(self) -> bool:
        return any(name.startswith(".debug_") for name in self.section_names)


def _cstring(table: bytes, offset: int) -> str:
    end = table.find(b"\0", offset)
    return table[offset : end if end >= 0 else len(table)].decode("ascii", "replace")


def load_native() -> NativeObject:
    folder = FIXTURES / "native"
    return NativeObject((folder / "ledger-x86_64-O0.o").read_bytes(), (folder / "ledger-x86_64-O0.objdump.txt").read_text())


def native_structure(rows: list[dict[str, Any]]) -> dict[str, int]:
    mnemonics = [row["text"].split()[0] for row in rows if row["text"]]
    jumps = sum(1 for m in mnemonics if m.startswith("j") and m != "jmpq")
    indirect = sum(1 for m in mnemonics if m == "jmpq")
    return {"instructions": len(rows), "jumps": jumps, "indirectJumps": indirect, "returns": sum(1 for m in mnemonics if m == "retq"), "structured": 0}


PYC_FIGURE_TAG = "cpython-314"


def what_each_keeps() -> dict[str, Any]:
    """One row per container for the grade function: the names, types, structure, and line facts each one stores."""
    native = load_native()
    native_rows = native.function_rows("grade")
    pyc = load_pyc(f"ledger.{PYC_FIGURE_TAG}.pyc")
    grade_code = pyc.functions()["grade"]
    pyc_rows = dis_fixture_listing(PYC_FIGURE_TAG, caches=True)["grade"]
    class_file = load_class("Ledger-g.class")
    grade_method = class_file.method("grade")
    jvm_rows = disassemble_jvm(class_file, grade_method.code.code)
    local_table = grade_method.code.attribute("LocalVariableTable")
    line_table = grade_method.code.attribute("LineNumberTable")
    plain = load_wasm("ledger.wasm")
    named = load_wasm("ledger-names.wasm")
    wasm_grade = plain.function("grade")
    assembly = load_assembly("LedgerNet.dll")
    cil_method = assembly.method("Grade")
    cil_body = assembly.method_body(cil_method["RVA"])
    cil_rows = disassemble_cil(cil_body.code, assembly)
    return {
        "native": {
            "container": "ELF relocatable object, x86-64, clang -O0",
            "functionName": "grade",
            "functionNames": [n for n, _v, _s in native.functions],
            "parameterNames": [],
            "parameterTypes": None,
            "returnType": None,
            "localNames": [],
            "lineNumbers": native.has_debug_info(),
            "bodyBytes": next(s for n, _v, s in native.functions if n == "grade"),
            "structure": native_structure(native_rows),
        },
        "python": {
            "container": f"CPython {pyc.header.version} pyc, magic {pyc.header.magic_word}",
            "functionName": grade_code.qualname,
            "functionNames": sorted(pyc.functions()),
            "parameterNames": list(grade_code.argnames),
            "parameterTypes": None,
            "returnType": None,
            "localNames": list(grade_code.varnames[grade_code.argcount :]),
            "lineNumbers": len(grade_code.linetable) > 0,
            "firstLine": grade_code.firstlineno,
            "bodyBytes": len(grade_code.code),
            "structure": python_structure(pyc_rows),
        },
        "jvm": {
            "container": f"JVM class file, major {class_file.major_version}, javac -g",
            "functionName": grade_method.name,
            "functionNames": [m.name for m in class_file.methods],
            "parameterNames": [] if local_table is None else [row["name"] for row in local_table.parsed if row["start"] == 0],
            "parameterTypes": grade_method.descriptor[1 : grade_method.descriptor.index(")")],
            "returnType": grade_method.descriptor[grade_method.descriptor.index(")") + 1 :],
            "localNames": [] if local_table is None else [row["name"] for row in local_table.parsed if row["start"] != 0],
            "lineNumbers": line_table is not None,
            "bodyBytes": len(grade_method.code.code),
            "structure": jvm_structure(jvm_rows),
        },
        "wasm": {
            "container": "WebAssembly binary version 1, wat2wasm",
            "functionName": plain.function_name(wasm_grade.index),
            "functionNames": [plain.function_name(f.index) for f in plain.functions],
            "parameterNames": list((named.names.get("locals", {}).get(wasm_grade.index, {})).values())[: len(plain.signature(wasm_grade).params)],
            "parameterNamesWithoutNameSection": [],
            "parameterTypes": ", ".join(plain.signature(wasm_grade).params),
            "returnType": ", ".join(plain.signature(wasm_grade).results),
            "localNames": list((named.names.get("locals", {}).get(wasm_grade.index, {})).values())[len(plain.signature(wasm_grade).params) :],
            "lineNumbers": False,
            "bodyBytes": wasm_grade.body_size,
            "structure": wasm_structure(wasm_grade.instructions),
        },
        "dotnet": {
            "container": f"ECMA-335 assembly, runtime {assembly.runtime_major}.{assembly.runtime_minor}, {assembly.metadata_version}",
            "functionName": cil_method["Name"],
            "functionNames": [m["Name"] for m in assembly.method_defs()],
            "parameterNames": cil_method["params"],
            "parameterTypes": cil_method["signatureText"],
            "returnType": cil_method["signatureText"].split()[1].split("(")[0],
            "localNames": [],
            "localTypes": describe_locals_signature(assembly.row(0x11, cil_body.local_signature_token & 0xFFFFFF)["Signature"]),
            "lineNumbers": False,
            "bodyBytes": cil_body.code_size,
            "structure": cil_structure(cil_rows),
        },
    }


def figure_data() -> dict[str, Any]:
    """The grade function in five containers, with the facts the figure marks on each row."""
    keeps = what_each_keeps()
    native = load_native()
    pyc = load_pyc(f"ledger.{PYC_FIGURE_TAG}.pyc")
    grade_code = pyc.functions()["grade"]
    class_file = load_class("Ledger-g.class")
    module = load_wasm("ledger.wasm")
    assembly = load_assembly("LedgerNet.dll")
    python_rows = []
    for row in dis_fixture_listing(PYC_FIGURE_TAG, caches=True)["grade"]:
        if row["opname"] == "CACHE":
            continue
        offset = row["offset"]
        python_rows.append({"o": offset, "b": hex_bytes(grade_code.code[offset : offset + 2]), "t": (row["opname"] + (" " + str(row["arg"]) if row["arg"] is not None else "") + (" " + row["argrepr"] if row["argrepr"] else "")).strip(), "k": "jump" if row["opname"].startswith("POP_JUMP") else ("name" if "(score)" in row["argrepr"] or "(bucket)" in row["argrepr"] else "")})
    jvm_rows = [{"o": r["offset"], "b": r["bytes"], "t": r["text"], "k": "switch" if r["text"].startswith("tableswitch") else ""} for r in jvm_listing(class_file, "grade")]
    wasm_rows = [{"o": r["offset"], "b": r["bytes"], "t": r["text"], "k": "structure" if r["text"].split()[0] in ("block", "loop", "if", "end", "br_table") else "", "d": r["depth"]} for r in wasm_listing(module, "grade")]
    native_rows = [{"o": r["offset"], "b": r["bytes"], "t": r["text"], "k": "jump" if r["text"].startswith(("j", "ja")) else ""} for r in native.function_rows("grade")]
    cil_rows = [{"o": r["offset"], "b": r["bytes"], "t": r["text"], "k": "switch" if r["text"].startswith("switch") else ("jump" if r["text"].startswith(("br", "blt", "beq", "bge")) else "")} for r in cil_listing(assembly, "Grade")]
    panels = []
    for key, label, rows in (("native", "x86-64 object", native_rows), ("python", "CPython 3.14 pyc", python_rows), ("jvm", "JVM class", jvm_rows), ("wasm", "WebAssembly", wasm_rows), ("dotnet", ".NET assembly", cil_rows)):
        facts = keeps[key]
        panels.append({
            "id": key,
            "label": label,
            "container": facts["container"],
            "name": facts["functionName"],
            "params": facts["parameterNames"],
            "paramTypes": facts["parameterTypes"],
            "returnType": facts["returnType"],
            "locals": facts["localNames"],
            "lines": facts["lineNumbers"],
            "bodyBytes": facts["bodyBytes"],
            "structure": facts["structure"],
            "rows": rows,
        })
    return {"function": "grade", "panels": panels}


def demo() -> dict[str, Any]:
    report: dict[str, Any] = {}
    pyc_entries = {}
    for tag in ("cpython-311", "cpython-312", "cpython-313", "cpython-314"):
        pyc = load_pyc(f"ledger.{tag}.pyc")
        timestamp = load_pyc(f"ledger.{tag}.timestamp.pyc")
        listing = dis_fixture_listing(tag)
        grade = pyc.functions()["grade"]
        pyc_entries[tag] = {
            "header": pyc.header.to_dict(),
            "timestampHeader": timestamp.header.to_dict(),
            "fileBytes": len(pyc.data),
            "gradeCodeBytes": len(grade.code),
            "gradeInstructions": len(listing["grade"]),
            "gradeOpnames": sorted({row["opname"] for row in listing["grade"]}),
            "names": list(pyc.module.names),
            "gradeVarnames": list(grade.varnames),
            "readableHere": pyc.matches_running_interpreter(),
        }
    report["python"] = pyc_entries
    jvm_entries = {}
    for variant in ("Ledger", "Ledger-g", "Ledger-gnone", "Ledger-jdk25"):
        class_file = load_class(f"{variant}.class")
        oracle = (FIXTURES / "java" / f"{variant}.javap-c.txt").read_text()
        comparison = compare_with_javap(class_file, oracle)
        summary = class_file.to_dict()
        jvm_entries[variant] = {
            "majorVersion": summary["majorVersion"],
            "javaRelease": summary["javaRelease"],
            "fileBytes": summary["fileBytes"],
            "constantPoolCount": summary["constantPoolCount"],
            "sourceFile": summary["sourceFile"],
            "lineNumberTables": sum(1 for m in class_file.methods if "LineNumberTable" in m.attribute_names()),
            "localVariableTables": sum(1 for m in class_file.methods if "LocalVariableTable" in m.attribute_names()),
            "oracle": f"{comparison['compared'] - len(comparison['mismatches'])}/{comparison['compared']} instructions agree with javap -c",
        }
    report["jvm"] = jvm_entries
    wasm_entries = {}
    for variant in ("ledger", "ledger-names"):
        module = load_wasm(f"{variant}.wasm")
        comparison = compare_with_wasm_objdump(module, (FIXTURES / "wasm" / f"{variant}.objdump.txt").read_text())
        summary = module.to_dict()
        wasm_entries[variant] = {
            "fileBytes": summary["fileBytes"],
            "sections": [s["name"] for s in summary["sections"]],
            "types": summary["types"],
            "functions": [{"name": f["name"], "type": f["type"], "bodyBytes": f["bodyBytes"], "instructions": f["instructions"]} for f in summary["functions"]],
            "nameSection": summary["nameSection"],
            "localNames": summary["names"].get("locals", {}),
            "oracle": f"{comparison['compared'] - len(comparison['mismatches'])}/{comparison['compared']} instructions agree with wasm-objdump -d",
        }
    report["wasm"] = wasm_entries
    assembly = load_assembly("LedgerNet.dll")
    comparison = compare_with_metadump(assembly, (FIXTURES / "dotnet" / "LedgerNet.metadump.txt").read_text())
    summary = assembly.to_dict()
    report["dotnet"] = {
        "fileBytes": summary["fileBytes"],
        "cliHeader": summary["cliHeader"],
        "metadataVersion": summary["metadata"]["version"],
        "streams": list(summary["metadata"]["streams"]),
        "tables": {name: t["rows"] for name, t in summary["tables"].items()},
        "methods": [{"name": m["name"], "signature": m["signature"], "params": m["params"], "codeBytes": m["codeBytes"], "locals": m["locals"], "instructions": m["instructions"]} for m in summary["methods"]],
        "oracle": f"{comparison['compared'] - len(comparison['mismatches'])}/{comparison['compared']} checks agree with System.Reflection.Metadata",
    }
    report["keeps"] = what_each_keeps()
    report["interpretersInstalled"] = available_interpreters()
    return report


def main(argv: list[str]) -> int:
    if not argv:
        print(json.dumps(demo(), indent=2))
        return 0
    command = argv[0]
    if command == "pyc" and len(argv) == 2:
        pyc = PycFile(Path(argv[1]).read_bytes())
        print(json.dumps(pyc.to_dict(), indent=2))
        if pyc.matches_running_interpreter():
            for name in pyc.functions():
                print(f"\n{name}:")
                for row in pyc.instructions(name) or []:
                    print(f"  {row['offset']:4d} {row['opname']:<28} {'' if row['arg'] is None else row['arg']} {row['argrepr']}")
        else:
            print(f"\ninstruction listing needs Python {pyc.header.version}, this is {sys.version.split()[0]}", file=sys.stderr)
        return 0
    if command == "class" and len(argv) == 2:
        class_file = ClassFile(Path(argv[1]).read_bytes())
        print(json.dumps(class_file.to_dict(), indent=2))
        for member in class_file.methods:
            if member.code is None:
                continue
            print(f"\n{member.name}{member.descriptor}:")
            for row in jvm_listing(class_file, member.name):
                print(f"  {row['offset']:4d}: {row['bytes']:<20} {row['text']}" + (f"  // {row['comment']}" if "comment" in row else ""))
        return 0
    if command == "wasm" and len(argv) == 2:
        module = WasmModule(Path(argv[1]).read_bytes())
        print(json.dumps(module.to_dict(), indent=2))
        for function in module.functions:
            print(f"\nfunc[{function.index}] {module.function_name(function.index)} {module.signature(function).render()}:")
            for row in wasm_listing(module, module.function_name(function.index) or ""):
                print(f"  {row['offset']:06x}: {row['bytes']:<28} {'  ' * row['depth']}{row['text']}")
        return 0
    if command == "dll" and len(argv) == 2:
        assembly = CliAssembly(Path(argv[1]).read_bytes())
        print(json.dumps(assembly.to_dict(), indent=2))
        for method in assembly.method_defs():
            if not method["RVA"]:
                continue
            print(f"\n{method['Name']} {method['signatureText']}:")
            for row in cil_listing(assembly, method["Name"]):
                print(f"  IL_{row['offset']:04x}: {row['bytes']:<24} {row['text']}")
        return 0
    if command == "compare":
        print(json.dumps(compare_interpreters(), indent=2))
        return 0
    if command == "keeps":
        print(json.dumps(what_each_keeps(), indent=2))
        return 0
    if command == "figure-data":
        print(json.dumps(figure_data(), separators=(",", ":")))
        return 0
    print("usage: main.py [pyc FILE | class FILE | wasm FILE | dll FILE | compare | keeps | figure-data]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
