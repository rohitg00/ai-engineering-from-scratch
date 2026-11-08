"""Compare the reader with llvm-objdump text captured into fixtures, so the tests need no tool."""

import importlib.util
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
REPO_ROOT = Path(__file__).resolve().parents[5]
ELF_FIXTURES = ["ledger-x86_64-O0.o", "ledger-x86_64-O1.o", "ledger-x86_64-O2.o", "tiny-x86_64"]

SYMBOL_LINE = re.compile(r"^([0-9a-f]{16}) (.{7}) +(\S+)\t([0-9a-f]{16}) (.*)$")
MACHO_SYMBOL_LINE = re.compile(r"^([0-9a-f]{16}) (.{7}) +(\S+) (.*)$")
RELOC_HEAD = re.compile(r"^RELOCATION RECORDS FOR \[(.+)\]:$")
RELOC_LINE = re.compile(r"^([0-9a-f]{16}) (\S+)\s+(\S+)$")
PHDR_LINE = re.compile(r"^\s+(\S+) off\s+0x([0-9a-f]+) vaddr 0x([0-9a-f]+) paddr 0x([0-9a-f]+) align 2\*\*(\d+)$")
PHDR_LINE_2 = re.compile(r"^\s+filesz 0x([0-9a-f]+) memsz 0x([0-9a-f]+) flags (\S+)$")
HEX8 = re.compile(r"^[0-9a-f]{8}$")
HEX16 = re.compile(r"^[0-9a-f]{16}$")
OBJDUMP_PHDR_NAMES = {"PT_LOAD": "LOAD", "PT_GNU_STACK": "STACK", "PT_PHDR": "PHDR", "PT_DYNAMIC": "DYNAMIC",
                      "PT_INTERP": "INTERP", "PT_NOTE": "NOTE", "PT_TLS": "TLS", "PT_GNU_EH_FRAME": "EH_FRAME",
                      "PT_GNU_RELRO": "RELRO"}


def oracle(name: str) -> str:
    """Captured tool text for a fixture: `ledger-x86_64-O1.o.objdump.txt` lives as `ledger-x86_64-O1.objdump.txt`."""
    if name.endswith(".o.objdump.txt"):
        name = name[: -len(".o.objdump.txt")] + ".objdump.txt"
    return (FIXTURES / name).read_text(encoding="utf-8")


def block(text: str, title: str) -> list[str]:
    """Lines after `title` up to the next blank line."""
    lines = text.splitlines()
    out = []
    for line in lines[lines.index(title) + 1 :]:
        if not line.strip():
            break
        out.append(line)
    return out


def parse_sections(text: str) -> list[tuple[int, str, int, int, str]]:
    rows = []
    for line in block(text, "Sections:")[1:]:
        tokens = line.split()
        if len(tokens) >= 4 and not (HEX8.match(tokens[1]) and HEX16.match(tokens[2])):
            idx, name, size, vma = tokens[0], tokens[1], tokens[2], tokens[3]
            kind = tokens[4] if len(tokens) > 4 else ""
        else:
            idx, name, size, vma = tokens[0], "", tokens[1], tokens[2]
            kind = tokens[3] if len(tokens) > 3 else ""
        rows.append((int(idx), name, int(size, 16), int(vma, 16), kind))
    return rows


def flags_to_bind_and_type(flags: str) -> tuple[str, str]:
    bind = {"l": "LOCAL", "g": "GLOBAL", "w": "WEAK"}[flags[0]]
    if "f" in flags:
        kind = "FILE"
    elif "F" in flags:
        kind = "FUNC"
    elif "O" in flags:
        kind = "OBJECT"
    elif "d" in flags:
        kind = "SECTION"
    else:
        kind = "NOTYPE"
    return bind, kind


def parse_symbols(text: str) -> set[tuple[int, str, str, str, int, str]]:
    rows = set()
    for line in block(text, "SYMBOL TABLE:"):
        match = SYMBOL_LINE.match(line)
        assert match, line
        value, flags, section, size, name = match.groups()
        bind, kind = flags_to_bind_and_type(flags)
        rows.add((int(value, 16), bind, kind, section, int(size, 16), name))
    return rows


def parse_macho_symbols(text: str) -> set[tuple[int, str, str, str, str]]:
    rows = set()
    for line in block(text, "SYMBOL TABLE:"):
        match = MACHO_SYMBOL_LINE.match(line)
        assert match, line
        value, flags, section, name = match.groups()
        bind, kind = flags_to_bind_and_type(flags)
        rows.add((int(value, 16), bind, kind, section, name))
    return rows


def parse_relocations(text: str) -> set[tuple[str, int, str, str]]:
    rows = set()
    target = None
    for line in text.splitlines():
        head = RELOC_HEAD.match(line)
        if head:
            target = head.group(1)
            continue
        match = RELOC_LINE.match(line)
        if match and target is not None:
            offset, kind, value = match.groups()
            rows.add((target, int(offset, 16), kind, value))
    return rows


def parse_program_headers(text: str) -> list[tuple[str, int, int, int, int, int, str]]:
    lines = block(text, "Program Header:")
    rows = []
    for first, second in zip(lines[0::2], lines[1::2]):
        a = PHDR_LINE.match(first)
        b = PHDR_LINE_2.match(second)
        assert a and b, (first, second)
        kind, off, vaddr, _paddr, align = a.groups()
        filesz, memsz, flags = b.groups()
        rows.append((kind, int(off, 16), int(vaddr, 16), 2 ** int(align), int(filesz, 16), int(memsz, 16), flags))
    return rows


def parse_private_headers(text: str) -> dict:
    """Load commands and sections from `llvm-objdump --macho --private-headers`."""
    out = {"commands": [], "sections": [], "fields": {}}
    current = None
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("MH_MAGIC_64"):
            tokens = stripped.split()
            out["fields"]["ncmds"] = int(tokens[5])
            out["fields"]["sizeofcmds"] = int(tokens[6])
            continue
        if stripped.startswith("Load command "):
            current = {"index": int(stripped.split()[2])}
            out["commands"].append(current)
            continue
        if stripped == "Section":
            current = {}
            out["sections"].append(current)
            continue
        if current is not None and " " in stripped:
            key, value = stripped.split(None, 1)
            current[key] = value
        elif current is not None and stripped in ("segname", "sectname"):
            current[stripped] = ""
    return out


class ElfOracleTests(unittest.TestCase):
    def test_sections_match_objdump(self) -> None:
        for name in ELF_FIXTURES:
            with self.subTest(fixture=name):
                elf = main.ElfFile.from_path(FIXTURES / name)
                expected = parse_sections(oracle(name + ".objdump.txt"))
                observed = [(s.index, s.name, s.sh_size, s.sh_addr, s.objdump_kind) for s in elf.sections]
                self.assertEqual(observed, expected)

    def test_symbols_match_objdump(self) -> None:
        for name in ELF_FIXTURES:
            with self.subTest(fixture=name):
                elf = main.ElfFile.from_path(FIXTURES / name)
                expected = parse_symbols(oracle(name + ".objdump.txt"))
                observed = {
                    (s.st_value, s.bind, s.type, s.section_name, s.st_size, s.display_name)
                    for s in elf.symbols
                    if s.index != 0
                }
                self.assertEqual(observed, expected)

    def test_relocations_match_objdump(self) -> None:
        for name in ELF_FIXTURES:
            with self.subTest(fixture=name):
                elf = main.ElfFile.from_path(FIXTURES / name)
                expected = parse_relocations(oracle(name + ".objdump.txt"))
                observed = {(r.target_section, r.r_offset, r.type_name, r.value_text) for r in elf.relocations}
                self.assertEqual(observed, expected)

    def test_optimization_levels_change_the_relocation_mix(self) -> None:
        o0 = main.ElfFile.from_path(FIXTURES / "ledger-x86_64-O0.o")
        o1 = main.ElfFile.from_path(FIXTURES / "ledger-x86_64-O1.o")
        self.assertIn("R_X86_64_PLT32", {r.type_name for r in o0.relocations})
        self.assertIn("R_X86_64_64", {r.type_name for r in o0.relocations_for(".data")})
        self.assertEqual({r.type_name for r in o1.relocations}, {"R_X86_64_PC32"})
        self.assertEqual([r.target_section for r in o0.relocations_for(".rodata")], [".rodata"] * 5)
        self.assertTrue(all(r.symbol == ".text" for r in o0.relocations_for(".rodata")))

    def test_program_headers_match_objdump(self) -> None:
        tiny = main.ElfFile.from_path(FIXTURES / "tiny-x86_64")
        expected = parse_program_headers(oracle("tiny-x86_64.objdump.txt"))
        observed = [
            (OBJDUMP_PHDR_NAMES[p.type_name], p.p_offset, p.p_vaddr, p.p_align, p.p_filesz, p.p_memsz, p.flags_text)
            for p in tiny.program_headers
        ]
        self.assertEqual(observed, expected)
        self.assertEqual(main.ElfFile.from_path(FIXTURES / "ledger-x86_64-O1.o").program_headers, [])


class ElfReaderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.elf = main.ElfFile.from_path(FIXTURES / "ledger-x86_64-O1.o")

    def test_header_fields(self) -> None:
        h = self.elf.header
        self.assertEqual((h.type_name, h.machine_name, h.e_shnum, h.e_shstrndx, h.e_shoff), ("ET_REL", "EM_X86_64", 11, 1, 0x428))
        self.assertEqual((h.e_phnum, h.e_phoff, h.e_entry), (0, 0, 0))

    def test_string_tables(self) -> None:
        self.assertEqual(self.elf.sections[self.elf.header.e_shstrndx].name, ".strtab")
        symtab = self.elf.section(".symtab")
        self.assertEqual(self.elf.sections[symtab.sh_link].name, ".strtab")
        self.assertEqual(symtab.sh_info, 9)
        self.assertTrue(all(s.bind == "LOCAL" for s in self.elf.symbols[:9]))
        self.assertTrue(all(s.bind == "GLOBAL" for s in self.elf.symbols[9:]))

    def test_percent_change_bytes(self) -> None:
        span = self.elf.function_span("percent_change")
        self.assertEqual((span.file_offset, span.size, span.container), (0x40, 16, ".text"))
        self.assertEqual(self.elf.function_bytes("percent_change"), bytes.fromhex("85ff740929fe6bc66499f7ffc331c0c3"))

    def test_every_function_lies_inside_text(self) -> None:
        text = self.elf.section(".text")
        sizes = {}
        for name in ("percent_change", "grade", "total", "grade_label"):
            span = self.elf.function_span(name)
            self.assertGreaterEqual(span.file_offset, text.sh_offset)
            self.assertLessEqual(span.file_offset + span.size, text.sh_offset + text.sh_size)
            sizes[name] = span.size
        self.assertEqual(sizes, {"percent_change": 16, "grade": 46, "total": 31, "grade_label": 63})
        self.assertEqual(self.elf.function_bytes("grade")[:3], bytes.fromhex("4863c7"))
        self.assertEqual(self.elf.function_bytes("grade")[3:10], bytes.fromhex("4869c067666666"))

    def test_lookup_table_relocation_points_into_rodata(self) -> None:
        grade = self.elf.function_span("grade")
        inside = [r for r in self.elf.relocations_for(".text") if 0x10 <= r.r_offset < 0x10 + grade.size]
        self.assertEqual(len(inside), 1)
        self.assertEqual((inside[0].type_name, inside[0].symbol, inside[0].r_addend), ("R_X86_64_PC32", ".rodata", 0x10))
        rodata = self.elf.section_bytes(self.elf.section(".rodata"))
        table = rodata[0x14:0x28]
        self.assertEqual([int.from_bytes(table[i : i + 4], "little") for i in range(0, 20, 4)], [1, 2, 3, 4, 4])

    def test_function_span_rejects_non_functions(self) -> None:
        with self.assertRaises(KeyError):
            self.elf.function_span("labels.rel")
        with self.assertRaises(KeyError):
            self.elf.function_span("no_such_symbol")

    def test_file_offset_map_tiles_the_file(self) -> None:
        for name in ELF_FIXTURES:
            with self.subTest(fixture=name):
                elf = main.ElfFile.from_path(FIXTURES / name)
                regions = elf.file_offset_map()
                self.assertEqual(regions[0].offset, 0)
                for before, after in zip(regions, regions[1:]):
                    self.assertEqual(before.end, after.offset)
                self.assertEqual(regions[-1].end, len(elf.data))
                names = [r.name for r in regions if r.kind == "section"]
                self.assertEqual(names, sorted(names, key=lambda n: elf.section(n).sh_offset))

    def test_file_offset_map_for_ledger_o1(self) -> None:
        regions = [(r.offset, r.size, r.name) for r in self.elf.file_offset_map()]
        self.assertEqual(regions[0], (0, 64, "ELF header"))
        self.assertEqual(regions[1], (0x40, 159, ".text"))
        self.assertEqual(regions[2], (0xDF, 1, "inactive space"))
        self.assertEqual(regions[-1], (0x428, 704, "section header table"))

    def test_address_to_file_offset(self) -> None:
        tiny = main.ElfFile.from_path(FIXTURES / "tiny-x86_64")
        self.assertEqual(tiny.address_to_file_offset(tiny.header.e_entry), 0xB0)
        self.assertEqual(tiny.address_to_file_offset(0x4000D4), 0xD4)
        self.assertEqual(tiny.function_bytes("_start")[:5], bytes.fromhex("bf01000000"))
        self.assertEqual(tiny.data[tiny.address_to_file_offset(0x4000D4) : 0xD4 + 3], b"ok\n")
        with self.assertRaises(KeyError):
            tiny.address_to_file_offset(0x500000)
        with self.assertRaises(KeyError):
            self.elf.address_to_file_offset(0)

    def test_format_errors(self) -> None:
        data = bytearray(self.elf.data)
        with self.assertRaises(main.FormatError):
            main.ElfFile(b"MZ" + data[2:])
        wrong_class = bytearray(data)
        wrong_class[4] = 1
        with self.assertRaises(main.FormatError):
            main.ElfFile(bytes(wrong_class))
        big_endian = bytearray(data)
        big_endian[5] = 2
        with self.assertRaises(main.FormatError):
            main.ElfFile(bytes(big_endian))
        with self.assertRaises(main.FormatError):
            main.ElfFile(bytes(data[:0x500]))
        with self.assertRaises(main.FormatError):
            main.open_file(FIXTURES / "ledger.c")

    def test_tiny_elf_builder_is_deterministic(self) -> None:
        spec = importlib.util.spec_from_file_location("build_tiny_elf", FIXTURES / "build_tiny_elf.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertEqual(module.build(), (FIXTURES / "tiny-x86_64").read_bytes())


class MachOTests(unittest.TestCase):
    def setUp(self) -> None:
        self.macho = main.MachOFile.from_path(FIXTURES / "ledger-arm64-O1.o")
        self.private = parse_private_headers(oracle("ledger-arm64-O1.load-commands.txt"))

    def test_header_and_load_commands_match_private_headers(self) -> None:
        h = self.macho.header
        self.assertEqual((h.cputype_name, h.filetype_name), ("CPU_TYPE_ARM64", "MH_OBJECT"))
        self.assertEqual((h.ncmds, h.sizeofcmds), (self.private["fields"]["ncmds"], self.private["fields"]["sizeofcmds"]))
        self.assertEqual(h.flags_text, "MH_SUBSECTIONS_VIA_SYMBOLS")
        expected = [(c["index"], c["cmd"], int(c["cmdsize"])) for c in self.private["commands"]]
        observed = [(c.index, c.name, c.cmdsize) for c in self.macho.load_commands]
        self.assertEqual(observed, expected)

    def test_segment_and_sections_match_private_headers(self) -> None:
        segment_cmd = next(c for c in self.private["commands"] if c["cmd"] == "LC_SEGMENT_64")
        segment = self.macho.segments[0]
        self.assertEqual(len(self.macho.segments), 1)
        self.assertEqual(segment.segname, "")
        self.assertEqual(
            (segment.vmaddr, segment.vmsize, segment.fileoff, segment.filesize, segment.nsects),
            (int(segment_cmd["vmaddr"], 16), int(segment_cmd["vmsize"], 16), int(segment_cmd["fileoff"]),
             int(segment_cmd["filesize"]), int(segment_cmd["nsects"])),
        )
        expected = [
            (s["sectname"], s["segname"], int(s["addr"], 16), int(s["size"], 16), int(s["offset"]),
             int(s["reloff"]), int(s["nreloc"]))
            for s in self.private["sections"]
        ]
        observed = [(s.sectname, s.segname, s.addr, s.size, s.offset, s.reloff, s.nreloc) for s in self.macho.sections]
        self.assertEqual(observed, expected)

    def test_symtab_and_build_version_match_private_headers(self) -> None:
        symtab_cmd = next(c for c in self.private["commands"] if c["cmd"] == "LC_SYMTAB")
        cmd = self.macho.symtab_command
        self.assertEqual(
            (cmd.symoff, cmd.nsyms, cmd.stroff, cmd.strsize),
            tuple(int(symtab_cmd[k]) for k in ("symoff", "nsyms", "stroff", "strsize")),
        )
        build = next(c for c in self.private["commands"] if c["cmd"] == "LC_BUILD_VERSION")
        self.assertEqual(
            (self.macho.build_version.platform_name, self.macho.build_version.minos, self.macho.build_version.sdk),
            (build["platform"], build["minos"], build["sdk"]),
        )
        self.assertEqual(cmd.stroff + cmd.strsize, len(self.macho.data))

    def test_sections_and_symbols_match_objdump(self) -> None:
        text = oracle("ledger-arm64-O1.objdump.txt")
        expected_sections = [(idx, name, size, vma) for idx, name, size, vma, _ in parse_sections(text)]
        observed_sections = [(s.index - 1, s.sectname, s.size, s.addr) for s in self.macho.sections]
        self.assertEqual(observed_sections, expected_sections)
        observed_symbols = set()
        for s in self.macho.symbols:
            bind = "GLOBAL" if s.external else "LOCAL"
            section = self.macho.sections[s.n_sect - 1]
            kind = "FUNC" if section.sectname == "__text" else "OBJECT"
            observed_symbols.add((s.n_value, bind, kind, s.section_name, s.name))
        self.assertEqual(observed_symbols, parse_macho_symbols(text))

    def test_relocations_match_objdump(self) -> None:
        expected = parse_relocations(oracle("ledger-arm64-O1.objdump.txt"))
        observed = {(r.section.split(",")[1], r.r_address, r.type_name, r.symbol) for r in self.macho.relocations}
        self.assertEqual(observed, expected)
        page21 = [r for r in self.macho.relocations if r.type_name == "ARM64_RELOC_PAGE21"]
        self.assertTrue(all(r.r_pcrel and r.r_length == 2 and r.r_extern for r in page21))
        self.assertTrue(all(r.r_length == 3 for r in self.macho.relocations if r.type_name == "ARM64_RELOC_UNSIGNED"))

    def test_percent_change_bytes(self) -> None:
        span = self.macho.function_span("_percent_change")
        self.assertEqual((span.file_offset, span.size, span.container), (648, 24, "__TEXT,__text"))
        code = self.macho.function_bytes("_percent_change")
        self.assertEqual(code[:4], bytes.fromhex("a0000034"))
        self.assertEqual(code[-4:], bytes.fromhex("c0035fd6"))
        self.assertEqual(self.macho.function_span("_grade_label").size, 0xD0 - 0x88)
        with self.assertRaises(KeyError):
            self.macho.function_span("percent_change")

    def test_format_errors(self) -> None:
        with self.assertRaises(main.FormatError):
            main.MachOFile(b"\xca\xfe\xba\xbe" + self.macho.data[4:])
        with self.assertRaises(main.FormatError):
            main.MachOFile(b"\xce\xfa\xed\xfe" + self.macho.data[4:])
        with self.assertRaises(main.FormatError):
            main.MachOFile(self.macho.data[:100])


class ComparisonAndDemoTests(unittest.TestCase):
    def test_compare_formats_names_the_same_function_in_both_files(self) -> None:
        elf = main.ElfFile.from_path(FIXTURES / "ledger-x86_64-O1.o")
        macho = main.MachOFile.from_path(FIXTURES / "ledger-arm64-O1.o")
        rows = {concept: (elf_text, macho_text) for concept, elf_text, macho_text in main.compare_formats(elf, macho)}
        self.assertEqual(rows["function bytes"], ("percent_change: 16 bytes at file offset 0x40", "_percent_change: 24 bytes at file offset 0x288"))
        self.assertIn("e_machine 62", rows["machine"][0])
        self.assertIn("0x100000c", rows["machine"][1])
        self.assertIn("no size field", rows["symbol size"][1])

    def test_open_file_detects_both_formats(self) -> None:
        self.assertIsInstance(main.open_file(FIXTURES / "ledger-x86_64-O1.o"), main.ElfFile)
        self.assertIsInstance(main.open_file(FIXTURES / "ledger-arm64-O1.o"), main.MachOFile)

    def test_demo_runs_and_states_the_percent_change_line(self) -> None:
        text = main.demo()
        self.assertIn("percent_change: 16 bytes at file offset 0x40: 85 ff 74 09", text)
        self.assertIn("entry 0x4000b0 is file offset 0xb0 through PT_LOAD", text)

    def test_figure_module_embeds_the_fixture_bytes(self) -> None:
        module = REPO_ROOT / "site" / "figures-re-32.js"
        if not module.is_file():
            self.skipTest("site/figures-re-32.js is not beside this lesson")
        text = module.read_text(encoding="utf-8")
        start = text.index("var HEX = [")
        end = text.index("].join('')", start)
        embedded = "".join(re.findall(r"'([0-9a-f]+)'", text[start:end]))
        self.assertEqual(bytes.fromhex(embedded), (FIXTURES / "ledger-x86_64-O1.o").read_bytes())


if __name__ == "__main__":
    unittest.main()
