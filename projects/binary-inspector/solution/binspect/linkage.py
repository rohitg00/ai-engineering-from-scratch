from .formats import FormatError, load_commands, parse_header, unpack
from .layout import macho_segments_raw, macho_sections_raw, section_at_address, sections
from .symbols import coff_symbols, elf_symbol_table, read_cstring, symbols

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
    value = shift = 0
    for count in range(10):
        if offset + count >= len(data):
            raise FormatError(f"uleb128 at {offset:#x} runs past the end of its data")
        byte = data[offset + count]
        value |= (byte & 0x7F) << shift
        shift += 7
        if not byte & 0x80:
            return value, offset + count + 1
    raise FormatError(f"uleb128 at {offset:#x} is longer than 10 bytes")


def _relocation(section, offset, kind, symbol, addend):
    return {"section": section, "offset": offset, "type": kind, "symbol": symbol, "addend": addend}


def _elf_relocations(data, header):
    section_list = sections(data)
    by_index = {section["index"]: section for section in section_list}
    names = AARCH64_ELF if header["arch"] == "arm64" else X86_64_ELF
    prefix = "R_AARCH64_" if header["arch"] == "arm64" else "R_X86_64_"
    tables, result = {}, []
    for section in section_list:
        if section["type"] not in ("RELA", "REL"):
            continue
        link, info = unpack("<II", data, header["fields"]["e_shoff"] + 64 * section["index"] + 40)
        if link not in tables:
            tables[link] = {symbol["index"]: symbol["name"] for symbol in elf_symbol_table(data, section_list, link)} if link else {}
        target = by_index.get(info, {"name": None})["name"]
        size = 24 if section["type"] == "RELA" else 16
        if section["size"] % size:
            raise FormatError(f"{section['name']} size is not a multiple of {size}")
        for index in range(section["size"] // size):
            if size == 24:
                offset, word, addend = unpack("<QQq", data, section["offset"] + 24 * index)
            else:
                (offset, word), addend = unpack("<QQ", data, section["offset"] + 16 * index), None
            symbol_index, kind = word >> 32, word & 0xFFFFFFFF
            if symbol_index and symbol_index not in tables[link]:
                raise FormatError(f"relocation {index} in {section['name']} names missing symbol {symbol_index}")
            result.append(_relocation(target, offset, prefix + names.get(kind, str(kind)),
                                      tables[link].get(symbol_index), addend))
    return result


def _coff_relocations(data, header):
    names = ARM64_COFF if header["arch"] == "arm64" else AMD64_COFF
    prefix = "IMAGE_REL_ARM64_" if header["arch"] == "arm64" else "IMAGE_REL_AMD64_"
    table = {symbol["index"]: symbol["name"] for symbol in coff_symbols(data)}
    result = []
    for index, section in enumerate(sections(data)):
        raw = unpack("<8sIIIIIIHHI", data, header["fields"]["section_table"] + 40 * index)
        pointer, count = raw[5], raw[7]
        for item in range(count):
            offset, symbol_index, kind = unpack("<IIH", data, pointer + 10 * item)
            if symbol_index not in table:
                raise FormatError(f"relocation {item} in {section['name']} names missing symbol {symbol_index}")
            result.append(_relocation(section["name"], offset, prefix + names.get(kind, str(kind)), table[symbol_index], None))
    return result


def rva_to_offset(section_list, image_base, rva):
    for section in section_list:
        start = section["addr"] - image_base
        if section["file_size"] and start <= rva < start + section["file_size"]:
            return section["offset"] + rva - start
    raise FormatError(f"RVA {rva:#x} is not backed by any section")


def _pe_relocations(data, header):
    fields = header["fields"]
    directory = fields["data_directories"].get("basereloc")
    if not directory:
        return []
    section_list = sections(data)
    base = fields["image_base"]
    offset = rva_to_offset(section_list, base, directory["rva"])
    end = offset + directory["size"]
    result = []
    while offset < end:
        page, size = unpack("<II", data, offset)
        if size < 8 or offset + size > end:
            raise FormatError(f"base relocation block at {offset:#x} has invalid size {size}")
        for item in range((size - 8) // 2):
            (entry,) = unpack("<H", data, offset + 8 + 2 * item)
            kind = entry >> 12
            if kind == 0:
                continue
            rva = page + (entry & 0xFFF)
            owner = section_at_address(section_list, base + rva)
            result.append(_relocation(owner["name"] if owner else None, rva,
                                      "IMAGE_REL_BASED_" + BASE_RELOCATIONS.get(kind, str(kind)), None, None))
        offset += size
    return result


def _macho_relocations(data, header):
    names = ARM64_MACHO if header["arch"] == "arm64" else X86_64_MACHO
    prefix = "ARM64_RELOC_" if header["arch"] == "arm64" else "X86_64_RELOC_"
    table = {symbol["index"]: symbol["name"] for symbol in symbols(data)}
    raw_sections = macho_sections_raw(data)
    result = []
    for section in raw_sections:
        pending = None
        for item in range(section["nreloc"]):
            address, word = unpack("<iI", data, section["reloff"] + 8 * item)
            if address < 0:
                raise FormatError("scattered relocations are not supported")
            number, external, kind = word & 0xFFFFFF, (word >> 27) & 1, word >> 28
            if header["arch"] == "arm64" and kind == 10:
                pending = number - (1 << 24) if number & 0x800000 else number
                continue
            if external:
                if number not in table:
                    raise FormatError(f"relocation {item} in {section['sectname']} names missing symbol {number}")
                symbol = table[number]
            else:
                if not 1 <= number <= len(raw_sections):
                    raise FormatError(f"relocation {item} in {section['sectname']} names missing section {number}")
                symbol = raw_sections[number - 1]["sectname"]
            result.append(_relocation(section["sectname"], address, prefix + names.get(kind, str(kind)), symbol, pending))
            pending = None
    return result


def relocations(data):
    header = parse_header(data)
    if header["format"] == "elf64":
        return _elf_relocations(data, header)
    if header["format"] == "coff":
        return _coff_relocations(data, header)
    if header["format"] == "pe":
        return _pe_relocations(data, header)
    return _macho_relocations(data, header)


def dylibs(data):
    result = []
    for command in load_commands(data):
        if command["name"] in ("LC_LOAD_DYLIB", "LC_LOAD_WEAK_DYLIB"):
            (name_offset,) = unpack("<I", data, command["offset"] + 8)
            result.append(read_cstring(data, command["offset"] + name_offset, command["offset"] + command["size"]))
    return result


def library_name(libraries, ordinal):
    if ordinal == 0:
        return "self"
    if ordinal in (0xFF, -1):
        return "main-executable"
    if ordinal in (0xFE, -2):
        return "flat-lookup"
    if 1 <= ordinal <= len(libraries):
        return libraries[ordinal - 1]
    raise FormatError(f"library ordinal {ordinal} has no LC_LOAD_DYLIB")


def linkedit_data(data, name):
    for command in load_commands(data):
        if command["name"] == name:
            dataoff, datasize = unpack("<II", data, command["offset"] + 8)
            if dataoff + datasize > len(data):
                raise FormatError(f"{name} points past the end of the file")
            return dataoff, datasize
    return None


def chained_fixups(data):
    header = parse_header(data)
    empty = {"header": None, "imports": [], "fixups": []}
    if header["format"] != "macho64":
        return empty
    found = linkedit_data(data, "LC_DYLD_CHAINED_FIXUPS")
    if not found:
        return empty
    base, size = found
    blob = data[base:base + size]
    version, starts, imports_offset, symbols_offset, count, imports_format, symbols_format = unpack("<7I", blob, 0)
    if version != 0:
        raise FormatError(f"chained fixups version {version} is not supported")
    if symbols_format != 0:
        raise FormatError("compressed chained fixup symbol names are not supported")
    libraries = dylibs(data)
    width = {1: 4, 2: 8, 3: 16}.get(imports_format)
    if width is None:
        raise FormatError(f"chained imports format {imports_format} is not supported")
    imports = []
    for index in range(count):
        if imports_format == 3:
            word, addend = unpack("<QQ", blob, imports_offset + 16 * index)
            ordinal, weak, name_offset = word & 0xFFFF, (word >> 16) & 1, word >> 32
            ordinal = ordinal - 0x10000 if ordinal >= 0xFFF0 else ordinal
        else:
            (word,) = unpack("<I", blob, imports_offset + width * index)
            addend = unpack("<i", blob, imports_offset + width * index + 4)[0] if imports_format == 2 else 0
            ordinal, weak, name_offset = word & 0xFF, (word >> 8) & 1, word >> 9
            ordinal = ordinal - 0x100 if ordinal >= 0xF0 else ordinal
        imports.append({
            "index": index, "name": read_cstring(blob, symbols_offset + name_offset),
            "library": library_name(libraries, ordinal), "weak": bool(weak), "addend": addend,
        })
    segments = macho_segments_raw(data)
    image_base = next((segment["vmaddr"] for segment in segments if segment["name"] == "__TEXT"), 0)
    section_list = sections(data)
    (seg_count,) = unpack("<I", blob, starts)
    if seg_count > len(segments):
        raise FormatError(f"chained starts list {seg_count} segments, file has {len(segments)}")
    fixups = []
    for segment_index in range(seg_count):
        (start_offset,) = unpack("<I", blob, starts + 4 + 4 * segment_index)
        if not start_offset:
            continue
        where = starts + start_offset
        _, page_size, pointer_format, _, _, page_count = unpack("<IHHQIH", blob, where)
        if pointer_format not in POINTER_FORMATS:
            raise FormatError(f"chained pointer format {pointer_format} is not supported")
        segment = segments[segment_index]
        for page in range(page_count):
            (first,) = unpack("<H", blob, where + 22 + 2 * page)
            if first == 0xFFFF:
                continue
            if first & 0x8000:
                raise FormatError("multi-start chained pages are not supported")
            page_start = segment["fileoff"] + page * page_size
            offset = page_start + first
            for _ in range(page_size // 4 + 1):
                if offset + 8 > page_start + page_size:
                    raise FormatError(f"fixup chain leaves its page at {offset:#x}")
                (raw,) = unpack("<Q", data, offset)
                step = (raw >> 51) & 0xFFF
                address = segment["vmaddr"] + offset - segment["fileoff"]
                owner = section_at_address(section_list, address)
                fixup = {"offset": offset, "address": address, "section": owner["name"] if owner else None,
                         "raw": raw, "next": step}
                if raw >> 63:
                    ordinal = raw & 0xFFFFFF
                    if ordinal >= len(imports):
                        raise FormatError(f"bind at {offset:#x} uses import {ordinal}, table has {len(imports)}")
                    fixup.update(kind="bind", ordinal=ordinal, name=imports[ordinal]["name"],
                                 library=imports[ordinal]["library"], addend=(raw >> 24) & 0xFF)
                else:
                    target = raw & 0xFFFFFFFFF
                    high8 = (raw >> 36) & 0xFF
                    if pointer_format == 6:
                        target += image_base
                    fixup.update(kind="rebase", target=target | (high8 << 56))
                fixups.append(fixup)
                if not step:
                    break
                offset += step * 4
            else:
                raise FormatError("fixup chain does not terminate inside its page")
    return {
        "header": {"version": version, "imports_count": count, "imports_format": imports_format,
                   "pointer_formats": sorted({POINTER_FORMATS[f] for f in _formats(blob, starts, seg_count)})},
        "imports": imports,
        "fixups": fixups,
    }


def _formats(blob, starts, seg_count):
    result = []
    for index in range(seg_count):
        (start_offset,) = unpack("<I", blob, starts + 4 + 4 * index)
        if start_offset:
            result.append(unpack("<H", blob, starts + start_offset + 6)[0])
    return result


def _pe_imports(data, header):
    fields = header["fields"]
    directory = fields["data_directories"].get("import")
    if not directory:
        return []
    section_list = sections(data)
    base = fields["image_base"]
    offset = rva_to_offset(section_list, base, directory["rva"])
    result = []
    for _ in range(4096):
        ilt, _, _, name_rva, iat = unpack("<IIIII", data, offset)
        if not (ilt or name_rva or iat):
            return result
        library = read_cstring(data, rva_to_offset(section_list, base, name_rva))
        thunk = rva_to_offset(section_list, base, ilt or iat)
        for slot in range(65536):
            (entry,) = unpack("<Q", data, thunk + 8 * slot)
            if not entry:
                break
            item = {"name": None, "library": library, "slots": [base + iat + 8 * slot], "hint": None, "ordinal": None}
            if entry >> 63:
                item["ordinal"] = entry & 0xFFFF
                item["name"] = f"#{entry & 0xFFFF}"
            else:
                where = rva_to_offset(section_list, base, entry & 0x7FFFFFFF)
                (item["hint"],) = unpack("<H", data, where)
                item["name"] = read_cstring(data, where + 2)
            result.append(item)
        offset += 20
    raise FormatError("import directory has no terminating descriptor")


def imports(data):
    header = parse_header(data)
    if header["format"] == "pe":
        return _pe_imports(data, header)
    fixups = chained_fixups(data)
    if fixups["header"]:
        slots = {}
        for fixup in fixups["fixups"]:
            if fixup["kind"] == "bind":
                slots.setdefault(fixup["ordinal"], []).append(fixup["address"])
        return [{"name": item["name"], "library": item["library"], "slots": slots.get(item["index"], []),
                 "hint": None, "ordinal": item["index"]} for item in fixups["imports"]]
    libraries = dylibs(data) if header["format"] == "macho64" else []
    result, seen = [], set()
    for symbol in symbols(data):
        if symbol["defined"] or symbol["binding"] == "local" or symbol["kind"] in ("section", "file"):
            continue
        if symbol["name"] in seen or not symbol["name"]:
            continue
        seen.add(symbol["name"])
        library = None
        if libraries and symbol.get("library_ordinal") is not None:
            library = library_name(libraries, symbol["library_ordinal"])
        result.append({"name": symbol["name"], "library": library, "slots": [], "hint": None, "ordinal": None})
    return result


def exports_trie(blob, image_base):
    result, stack, visited = [], [(0, "")], set()
    while stack:
        node, prefix = stack.pop()
        if node in visited:
            raise FormatError(f"exports trie revisits node {node:#x}")
        visited.add(node)
        size, cursor = uleb128(blob, node)
        children_at = cursor + size
        if size:
            flags, cursor = uleb128(blob, cursor)
            if flags & 0x08:
                ordinal, cursor = uleb128(blob, cursor)
                result.append({"name": prefix, "address": None, "flags": flags, "reexport": ordinal})
            else:
                offset, cursor = uleb128(blob, cursor)
                result.append({"name": prefix, "address": image_base + offset, "flags": flags, "reexport": None})
        if children_at >= len(blob):
            raise FormatError(f"exports trie node {node:#x} runs past the end of the trie")
        count, cursor = blob[children_at], children_at + 1
        children = []
        for _ in range(count):
            stop = blob.find(b"\0", cursor)
            if stop < 0:
                raise FormatError("exports trie edge has no terminating NUL")
            edge = blob[cursor:stop].decode("utf-8", "replace")
            child, cursor = uleb128(blob, stop + 1)
            if not 0 < child < len(blob):
                raise FormatError(f"exports trie child offset {child:#x} is outside the trie")
            children.append((child, prefix + edge))
        stack.extend(reversed(children))
    return sorted(result, key=lambda item: item["name"])


def _pe_exports(data, header):
    fields = header["fields"]
    directory = fields["data_directories"].get("export")
    if not directory:
        return []
    section_list = sections(data)
    base = fields["image_base"]
    offset = rva_to_offset(section_list, base, directory["rva"])
    values = unpack("<IIHHIIIIIII", data, offset)
    ordinal_base, functions, names, eat, enpt, eot = values[5], values[6], values[7], values[8], values[9], values[10]
    if names > functions:
        raise FormatError("export directory has more names than addresses")
    result = []
    for index in range(names):
        (name_rva,) = unpack("<I", data, rva_to_offset(section_list, base, enpt + 4 * index))
        (slot,) = unpack("<H", data, rva_to_offset(section_list, base, eot + 2 * index))
        if slot >= functions:
            raise FormatError(f"export ordinal index {slot} is outside the address table")
        (target,) = unpack("<I", data, rva_to_offset(section_list, base, eat + 4 * slot))
        name = read_cstring(data, rva_to_offset(section_list, base, name_rva))
        forwarder = None
        if directory["rva"] <= target < directory["rva"] + directory["size"]:
            forwarder = read_cstring(data, rva_to_offset(section_list, base, target))
        result.append({"name": name, "address": None if forwarder else base + target,
                       "ordinal": ordinal_base + slot, "forwarder": forwarder})
    return result


def exports(data):
    header = parse_header(data)
    if header["format"] == "pe":
        return _pe_exports(data, header)
    if header["format"] == "macho64":
        trie = linkedit_data(data, "LC_DYLD_EXPORTS_TRIE")
        if trie and trie[1]:
            base = next((s["vmaddr"] for s in macho_segments_raw(data) if s["name"] == "__TEXT"), 0)
            return [{"name": item["name"], "address": item["address"], "ordinal": None,
                     "forwarder": None if item["reexport"] is None else f"dylib {item['reexport']}"}
                    for item in exports_trie(data[trie[0]:trie[0] + trie[1]], base)]
    pool = symbols(data)
    if any(symbol["table"] == "dynsym" for symbol in pool):
        pool = [symbol for symbol in pool if symbol["table"] == "dynsym"]
    result = []
    for symbol in pool:
        if symbol["defined"] and symbol["binding"] in ("global", "weak") and symbol["kind"] not in ("section", "file"):
            if symbol["section"] in ("*ABS*", "*DEBUG*"):
                continue
            result.append({"name": symbol["name"], "address": symbol["value"], "ordinal": None, "forwarder": None})
    return result
