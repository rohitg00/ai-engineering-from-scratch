from .formats import parse_header
from .layout import section_at_offset, sections, segments
from .linkage import linkedit_data, uleb128
from .symbols import symbols

PRINTABLE = set(range(0x20, 0x7F)) | {0x09}
STUB_SECTIONS = {"__stubs", "__auth_stubs", "__stub_helper", ".plt", ".plt.sec"}


def _region(section_list, segment_list, offset):
    section = section_at_offset(section_list, offset)
    if section:
        return section["name"], section["segment"]
    for segment in segment_list:
        if segment["file_size"] and segment["offset"] <= offset < segment["offset"] + segment["file_size"]:
            return None, segment["name"]
    return None, None


def extract_strings(data, section_list, segment_list=(), min_length=4):
    if min_length < 1:
        raise ValueError("min_length must be at least 1")
    found = []
    start = None
    for index in range(len(data) + 1):
        if index < len(data) and data[index] in PRINTABLE:
            if start is None:
                start = index
            continue
        if start is not None and index - start >= min_length:
            found.append((start, data[start:index].decode("ascii"), "ascii"))
        start = None
    index = 0
    while index + 1 < len(data):
        end = index
        while end + 1 < len(data) and data[end] in PRINTABLE and data[end + 1] == 0:
            end += 2
        if (end - index) // 2 >= min_length:
            found.append((index, data[index:end].decode("utf-16-le"), "utf-16le"))
            index = end
        else:
            index += 1
    result = []
    for offset, text, encoding in sorted(found):
        section, segment = _region(section_list, segment_list, offset)
        result.append({"offset": offset, "text": text, "encoding": encoding, "section": section, "segment": segment})
    return result


def _code_sections(section_list):
    return [section for section in section_list
            if section["code"] and section["file_size"] and section["name"] not in STUB_SECTIONS]


def lc_function_starts(data, header):
    if header["format"] != "macho64":
        return []
    found = linkedit_data(data, "LC_FUNCTION_STARTS")
    if not found:
        return []
    text = next((segment for segment in segments(data) if segment["name"] == "__TEXT"), None)
    address = text["addr"] if text else 0
    blob = data[found[0]:found[0] + found[1]]
    result, cursor = [], 0
    while cursor < len(blob):
        delta, cursor = uleb128(blob, cursor)
        if delta == 0:
            break
        address += delta
        result.append(address)
    return result


def prologue_scan(data, header, section_list):
    result = []
    for section in _code_sections(section_list):
        code = data[section["offset"]:section["offset"] + section["file_size"]]
        if header["arch"] == "arm64":
            for position in range(0, len(code) - 3, 4):
                word = int.from_bytes(code[position:position + 4], "little")
                if (word & 0xFF0003FF) == 0xD10003FF or (word & 0xFFC07FFF) == 0xA9807BFD:
                    result.append(section["addr"] + position)
        elif header["arch"] == "x86_64":
            for pattern in (b"\x55\x48\x89\xe5", b"\xf3\x0f\x1e\xfa"):
                position = code.find(pattern)
                while position >= 0:
                    result.append(section["addr"] + position)
                    position = code.find(pattern, position + 1)
    return sorted(set(result))


def call_targets(data, header, section_list):
    if header["kind"] == "relocatable":
        return []
    code_sections = _code_sections(section_list)

    def inside(address):
        return any(s["addr"] <= address < s["addr"] + s["size"] for s in code_sections)

    result = set()
    for section in code_sections:
        code = data[section["offset"]:section["offset"] + section["file_size"]]
        if header["arch"] == "arm64":
            for position in range(0, len(code) - 3, 4):
                word = int.from_bytes(code[position:position + 4], "little")
                if (word & 0xFC000000) == 0x94000000:
                    immediate = word & 0x3FFFFFF
                    if immediate & 0x2000000:
                        immediate -= 1 << 26
                    target = section["addr"] + position + immediate * 4
                    if inside(target):
                        result.add(target)
        elif header["arch"] == "x86_64":
            for position in range(len(code) - 4):
                if code[position] == 0xE8:
                    displacement = int.from_bytes(code[position + 1:position + 5], "little", signed=True)
                    target = section["addr"] + position + 5 + displacement
                    if inside(target):
                        result.add(target)
    return sorted(result)


def symbol_starts(data, section_list):
    code_sections = _code_sections(section_list)
    names = {section["name"] for section in code_sections}
    result = set()
    for symbol in symbols(data):
        if symbol["kind"] != "func" or not symbol["defined"] or symbol["section"] not in names:
            continue
        owner = [s for s in code_sections if s["name"] == symbol["section"]]
        if any(s["addr"] <= symbol["value"] < s["addr"] + s["size"] for s in owner):
            result.add(symbol["value"])
    return sorted(result)


def function_starts(data):
    header = parse_header(data)
    section_list = sections(data)
    methods = {
        "symbols": symbol_starts(data, section_list),
        "function_starts_table": lc_function_starts(data, header),
        "prologues": prologue_scan(data, header, section_list),
        "call_targets": call_targets(data, header, section_list),
        "entry": [header["entry"]] if header["entry"] else [],
    }
    methods["recovered"] = sorted(set(methods["function_starts_table"]) | set(methods["call_targets"]) | set(methods["entry"]))
    return methods


def score_starts(found, truth):
    found, truth = set(found), set(truth)
    hits = found & truth
    return {
        "found": len(found),
        "truth": len(truth),
        "true_positives": len(hits),
        "false_positives": sorted(found - truth),
        "missed": sorted(truth - found),
        "precision": round(len(hits) / len(found), 4) if found else 0.0,
        "recall": round(len(hits) / len(truth), 4) if truth else 1.0,
    }
