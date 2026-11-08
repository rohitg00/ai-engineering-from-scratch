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
    if not data:
        return 0.0
    total = len(data)
    value = -sum(count / total * math.log2(count / total) for count in Counter(data).values())
    return round(value + 0.0, 4)


def perms(read, write, execute):
    return ("r" if read else "-") + ("w" if write else "-") + ("x" if execute else "-")


def _entry(index, name, segment, kind, addr, offset, size, file_size, permissions, code, data):
    if file_size and offset + file_size > len(data):
        raise FormatError(f"section {name} runs past the end of the file")
    return {
        "index": index, "name": name, "segment": segment, "type": kind, "addr": addr, "offset": offset,
        "size": size, "file_size": file_size, "perms": permissions, "code": bool(code),
        "entropy": shannon_entropy(data[offset:offset + file_size]),
    }


def _elf_sections(data, header):
    fields = header["fields"]
    raw = [unpack("<IIQQQQIIQQ", data, fields["e_shoff"] + 64 * i) for i in range(fields["e_shnum"])]
    if not raw:
        return []
    names = raw[fields["e_shstrndx"]]
    result = []
    for index, (name, kind, flags, addr, offset, size, *_rest) in enumerate(raw):
        if index == 0:
            continue
        file_size = 0 if kind == 8 else size
        result.append(_entry(
            index, _cstring(data, names[4] + name, names[4] + names[5]), None,
            ELF_SECTION_TYPES.get(kind, f"{kind:#x}"), addr, offset, size, file_size,
            perms(flags & 2, flags & 1, flags & 4) if flags & 2 else "---", flags & 4, data,
        ))
    return result


def _cstring(data, start, end):
    end = min(end, len(data))
    stop = data.find(b"\0", start, end)
    if start < 0 or start >= end or stop < 0:
        raise FormatError(f"string at {start:#x} is not terminated inside its table")
    return data[start:stop].decode("utf-8", "replace")


def coff_string_table(data, fields):
    start = fields["pointer_to_symbol_table"] + 18 * fields["number_of_symbols"]
    if not fields["pointer_to_symbol_table"]:
        return start, start
    (size,) = unpack("<I", data, start)
    return start, start + size


def coff_section_name(data, raw, fields):
    text = raw.rstrip(b"\0").decode("utf-8", "replace")
    if text.startswith("/") and text[1:].isdigit():
        start, end = coff_string_table(data, fields)
        return _cstring(data, start + int(text[1:]), end)
    return text


def _coff_sections(data, header):
    fields = header["fields"]
    image = header["format"] == "pe"
    base = fields.get("image_base", 0)
    result = []
    for index in range(fields["number_of_sections"]):
        raw = unpack("<8sIIIIIIHHI", data, fields["section_table"] + 40 * index)
        name, vsize, vaddr, raw_size, raw_ptr, _, _, _, _, flags = raw
        uninitialized = bool(flags & 0x80)
        if image:
            size = vsize or raw_size
            file_size = 0 if uninitialized else min(raw_size, size)
            addr = base + vaddr
        else:
            size = raw_size
            file_size = 0 if uninitialized or not raw_ptr else raw_size
            addr = 0
        kind = "code" if flags & 0x20 else "initialized" if flags & 0x40 else "uninitialized" if uninitialized else "other"
        result.append(_entry(
            index + 1, coff_section_name(data, name, fields), None, kind, addr, raw_ptr if file_size else 0,
            size, file_size, perms(flags & 0x40000000, flags & 0x80000000, flags & 0x20000000), flags & 0x20000020, data,
        ))
    return result


def macho_segments_raw(data):
    segments = []
    for command in load_commands(data):
        if command["name"] != "LC_SEGMENT_64":
            continue
        fields = unpack("<II16sQQQQiiII", data, command["offset"])
        _, _, name, vmaddr, vmsize, fileoff, filesize, maxprot, initprot, nsects, _ = fields
        if command["size"] < 72 + 80 * nsects:
            raise FormatError("LC_SEGMENT_64 is too small for its sections")
        sections = []
        for index in range(nsects):
            sect = unpack("<16s16sQQIIIIIIII", data, command["offset"] + 72 + 80 * index)
            sections.append({
                "sectname": sect[0].rstrip(b"\0").decode(), "segname": sect[1].rstrip(b"\0").decode(),
                "addr": sect[2], "size": sect[3], "offset": sect[4], "reloff": sect[6], "nreloc": sect[7],
                "flags": sect[8], "reserved1": sect[9], "reserved2": sect[10],
            })
        segments.append({
            "name": name.rstrip(b"\0").decode(), "vmaddr": vmaddr, "vmsize": vmsize, "fileoff": fileoff,
            "filesize": filesize, "maxprot": maxprot, "initprot": initprot, "sections": sections,
        })
    return segments


def _prot(value):
    return perms(value & 1, value & 2, value & 4)


def macho_sections_raw(data):
    return [section for segment in macho_segments_raw(data) for section in segment["sections"]]


def _macho_sections(data):
    named = {segment["name"]: segment for segment in macho_segments_raw(data) if segment["name"]}
    result = []
    for index, section in enumerate(macho_sections_raw(data), 1):
        kind = section["flags"] & 0xFF
        file_size = 0 if kind in MACHO_ZEROFILL else section["size"]
        segment = named.get(section["segname"])
        if segment:
            permissions = _prot(segment["initprot"])
        elif section["flags"] & 0x80000400:
            permissions = "r-x"
        else:
            permissions = MACHO_SEGMENT_PERMS.get(section["segname"], "r--")
        result.append(_entry(
            index, section["sectname"], section["segname"], MACHO_SECTION_TYPES.get(kind, f"{kind:#x}"),
            section["addr"], section["offset"] if file_size else 0, section["size"], file_size, permissions,
            section["flags"] & 0x80000400, data,
        ))
    return result


def sections(data):
    header = parse_header(data)
    if header["format"] == "elf64":
        return _elf_sections(data, header)
    if header["format"] in ("pe", "coff"):
        return _coff_sections(data, header)
    return _macho_sections(data)


def segments(data):
    header = parse_header(data)
    result = []
    if header["format"] == "elf64":
        fields = header["fields"]
        for index in range(fields["e_phnum"]):
            kind, flags, offset, vaddr, _, filesz, memsz, _ = unpack("<IIQQQQQQ", data, fields["e_phoff"] + 56 * index)
            if offset + filesz > len(data):
                raise FormatError(f"program header {index} runs past the end of the file")
            result.append({
                "name": ELF_SEGMENT_TYPES.get(kind, f"{kind:#x}"), "addr": vaddr, "size": memsz, "offset": offset,
                "file_size": filesz, "perms": perms(flags & 4, flags & 2, flags & 1), "max_perms": None,
                "entropy": shannon_entropy(data[offset:offset + filesz]),
            })
    elif header["format"] == "macho64":
        for segment in macho_segments_raw(data):
            if segment["fileoff"] + segment["filesize"] > len(data):
                raise FormatError(f"segment {segment['name']} runs past the end of the file")
            result.append({
                "name": segment["name"], "addr": segment["vmaddr"], "size": segment["vmsize"],
                "offset": segment["fileoff"], "file_size": segment["filesize"],
                "perms": _prot(segment["initprot"]), "max_perms": _prot(segment["maxprot"]),
                "entropy": shannon_entropy(data[segment["fileoff"]:segment["fileoff"] + segment["filesize"]]),
            })
    return result


def section_at_offset(section_list, offset):
    best = None
    for section in section_list:
        if section["file_size"] and section["offset"] <= offset < section["offset"] + section["file_size"]:
            if best is None or section["file_size"] < best["file_size"]:
                best = section
    return best


def section_at_address(section_list, address):
    for section in section_list:
        if section["size"] and section["addr"] <= address < section["addr"] + section["size"]:
            return section
    return None

