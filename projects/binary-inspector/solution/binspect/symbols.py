from .formats import FormatError, load_commands, parse_header, unpack
from .layout import coff_string_table, sections

ELF_BINDINGS = {0: "local", 1: "global", 2: "weak", 10: "unique"}
ELF_KINDS = {0: "notype", 1: "object", 2: "func", 3: "section", 4: "file", 5: "common", 6: "tls"}
BUILTINS = {
    "v": "void", "b": "bool", "c": "char", "a": "signed char", "h": "unsigned char", "s": "short",
    "t": "unsigned short", "i": "int", "j": "unsigned int", "l": "long", "m": "unsigned long",
    "x": "long long", "y": "unsigned long long", "f": "float", "d": "double", "e": "long double",
    "w": "wchar_t", "z": "...",
}


def read_cstring(data, offset, end=None):
    end = len(data) if end is None else min(end, len(data))
    if offset < 0 or offset >= end:
        raise FormatError(f"string offset {offset:#x} is outside its table")
    stop = data.find(b"\0", offset, end)
    if stop < 0:
        raise FormatError(f"string at {offset:#x} has no terminating NUL inside its table")
    return data[offset:stop].decode("utf-8", "replace")


class _Demangler:
    def __init__(self, text):
        self.text = text
        self.pos = 0
        self.subs = []

    def peek(self, count=1):
        return self.text[self.pos:self.pos + count]

    def take(self, count=1):
        if self.pos + count > len(self.text):
            raise ValueError("unexpected end")
        value = self.text[self.pos:self.pos + count]
        self.pos += count
        return value

    def number(self):
        start = self.pos
        while self.peek().isdigit():
            self.pos += 1
        if start == self.pos:
            raise ValueError("expected a length")
        return int(self.text[start:self.pos])

    def source_name(self):
        length = self.number()
        if length == 0 or self.pos + length > len(self.text):
            raise ValueError("bad source name")
        return self.take(length)

    def substitution(self):
        self.take()
        if self.peek() == "t":
            self.take()
            return ["std"], False
        if self.peek() == "_":
            self.take()
            index = 0
        else:
            digits = ""
            while self.peek() and self.peek() != "_":
                digits += self.take()
            self.take()
            index = int(digits, 36) + 1
        if index >= len(self.subs):
            raise ValueError("substitution out of range")
        return self.subs[index], True

    def nested(self, is_function):
        self.take()
        const = False
        if self.peek() == "K":
            self.take()
            const = True
        parts = []
        while self.peek() != "E":
            if not self.peek():
                raise ValueError("unterminated nested name")
            if self.peek() == "S":
                value, _ = self.substitution()
                parts = list(value)
            elif self.peek().isdigit():
                parts.append(self.source_name())
            elif self.peek() in ("C", "D"):
                code = self.take(2)
                if code[1] not in "123" or not parts:
                    raise ValueError("unsupported constructor form")
                parts.append(("~" if code[0] == "D" else "") + parts[-1])
            else:
                raise ValueError("unsupported nested component")
            if self.peek() != "E" or not is_function:
                if list(parts) not in self.subs:
                    self.subs.append(list(parts))
        self.take()
        return parts, const

    def type(self):
        code = self.peek()
        if code in BUILTINS:
            self.take()
            return BUILTINS[code]
        if code in ("P", "R", "O", "K"):
            self.take()
            inner = self.type()
            text = {"P": inner + "*", "R": inner + "&", "O": inner + "&&", "K": inner + " const"}[code]
            self.subs.append([text])
            return text
        if code == "N":
            parts, _ = self.nested(False)
            return "::".join(parts)
        if code == "S":
            value, _ = self.substitution()
            if value == ["std"]:
                name = "std::" + self.source_name()
                self.subs.append([name])
                return name
            return "::".join(value)
        if code.isdigit():
            name = self.source_name()
            self.subs.append([name])
            return name
        raise ValueError(f"unsupported type code {code!r}")

    def encoding(self):
        const = False
        if self.peek() == "N":
            parts, const = self.nested(True)
        elif self.peek() == "S" and self.peek(2) == "St":
            self.take(2)
            parts = ["std", self.source_name()]
        elif self.peek().isdigit():
            parts = [self.source_name()]
        else:
            raise ValueError("unsupported name")
        if self.pos == len(self.text):
            return "::".join(parts)
        params = []
        while self.pos < len(self.text):
            params.append(self.type())
        if params == ["void"]:
            params = []
        return "::".join(parts) + "(" + ", ".join(params) + ")" + (" const" if const else "")


def demangle(name):
    if not isinstance(name, str):
        return None
    text = name[1:] if name.startswith("__Z") else name
    if not text.startswith("_Z"):
        return None
    try:
        return _Demangler(text[2:]).encoding()
    except (ValueError, IndexError):
        return None


def _symbol(index, name, value, size, kind, binding, section, table):
    return {
        "index": index, "name": name, "demangled": demangle(name), "value": value, "size": size, "kind": kind,
        "binding": binding, "section": section, "defined": section is not None, "table": table,
    }


def elf_symbol_table(data, section_list, table_index):
    by_index = {section["index"]: section for section in section_list}
    table = by_index.get(table_index)
    if table is None or table["type"] not in ("SYMTAB", "DYNSYM"):
        raise FormatError(f"section {table_index} is not a symbol table")
    header = parse_header(data)
    (link,) = unpack("<I", data, header["fields"]["e_shoff"] + 64 * table_index + 40)
    strtab = by_index.get(link)
    if strtab is None:
        raise FormatError(f"symbol table {table['name']} links to missing string table {link}")
    if table["size"] % 24:
        raise FormatError(f"symbol table {table['name']} size {table['size']} is not a multiple of 24")
    result = []
    for index in range(1, table["size"] // 24):
        name, info, _, shndx, value, size = unpack("<IBBHQQ", data, table["offset"] + 24 * index)
        text = read_cstring(data, strtab["offset"] + name, strtab["offset"] + strtab["size"])
        if shndx == 0:
            section = None
        elif shndx == 0xFFF1:
            section = "*ABS*"
        elif shndx == 0xFFF2:
            section = "*COMMON*"
        elif shndx in by_index:
            section = by_index[shndx]["name"]
        else:
            raise FormatError(f"symbol {index} names missing section {shndx}")
        kind = ELF_KINDS.get(info & 0xF, f"type {info & 0xF}")
        if kind == "section" and not text and section:
            text = section
        result.append(_symbol(index, text, value, size, kind, ELF_BINDINGS.get(info >> 4, f"binding {info >> 4}"),
                              section, "dynsym" if table["type"] == "DYNSYM" else "symtab"))
    return result


def _elf_symbols(data):
    section_list = sections(data)
    result = []
    for section in section_list:
        if section["type"] in ("SYMTAB", "DYNSYM"):
            result.extend(elf_symbol_table(data, section_list, section["index"]))
    return result


def coff_symbols(data):
    header = parse_header(data)
    fields = header["fields"]
    if not fields["pointer_to_symbol_table"]:
        return []
    names = [section["name"] for section in sections(data)]
    start, end = coff_string_table(data, fields)
    result, index = [], 0
    while index < fields["number_of_symbols"]:
        raw, value, number, kind, storage, aux = unpack("<8sIhHBB", data, fields["pointer_to_symbol_table"] + 18 * index)
        if raw[:4] == b"\0\0\0\0":
            name = read_cstring(data, start + int.from_bytes(raw[4:], "little"), end)
        else:
            name = raw.rstrip(b"\0").decode("utf-8", "replace")
        if number > 0:
            if number > len(names):
                raise FormatError(f"symbol {name} names missing section {number}")
            section = names[number - 1]
        elif number == -1:
            section = "*ABS*"
        elif number == -2:
            section = "*DEBUG*"
        elif storage == 2 and value:
            section = "*COMMON*"
        else:
            section = None
        if storage == 103:
            symbol_kind = "file"
        elif storage == 3 and aux and value == 0 and section == name:
            symbol_kind = "section"
        elif kind >> 4 == 2:
            symbol_kind = "func"
        elif number > 0:
            symbol_kind = "object"
        else:
            symbol_kind = "notype"
        binding = {2: "global", 105: "weak"}.get(storage, "local")
        result.append(_symbol(index, name, value, None, symbol_kind, binding, section, "coff"))
        index += 1 + aux
    if index != fields["number_of_symbols"]:
        raise FormatError("auxiliary records run past the end of the symbol table")
    return result


def macho_symtab(data):
    for command in load_commands(data):
        if command["name"] == "LC_SYMTAB":
            _, _, symoff, nsyms, stroff, strsize = unpack("<IIIIII", data, command["offset"])
            if symoff + 16 * nsyms > len(data) or stroff + strsize > len(data):
                raise FormatError("LC_SYMTAB points past the end of the file")
            return symoff, nsyms, stroff, strsize
    return None


def _macho_symbols(data):
    found = macho_symtab(data)
    if not found:
        return []
    symoff, nsyms, stroff, strsize = found
    section_list = sections(data)
    executable = {section["index"] for section in section_list if section["code"]}
    result = []
    for index in range(nsyms):
        strx, ntype, sect, desc, value = unpack("<IBBHQ", data, symoff + 16 * index)
        if ntype & 0xE0:
            continue
        name = read_cstring(data, stroff + strx, stroff + strsize) if strx else ""
        base = ntype & 0x0E
        if base == 0x0E:
            if not 1 <= sect <= len(section_list):
                raise FormatError(f"symbol {name} names missing section {sect}")
            section = section_list[sect - 1]["name"]
            kind = "func" if sect in executable else "object"
        elif base == 0x02:
            section, kind = "*ABS*", "notype"
        elif base == 0 and value and ntype & 1:
            section, kind = "*COMMON*", "object"
        else:
            section, kind = None, "notype"
        if desc & 0xC0:
            binding = "weak"
        elif ntype & 1:
            binding = "global"
        else:
            binding = "local"
        symbol = _symbol(index, name, value, None, kind, binding, section, "nlist")
        if section is None:
            symbol["library_ordinal"] = (desc >> 8) & 0xFF
        result.append(symbol)
    return result


def symbols(data):
    header = parse_header(data)
    if header["format"] == "elf64":
        return _elf_symbols(data)
    if header["format"] in ("coff", "pe"):
        return coff_symbols(data)
    return _macho_symbols(data)
