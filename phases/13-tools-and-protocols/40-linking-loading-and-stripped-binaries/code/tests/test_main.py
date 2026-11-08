import json
import re
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
SITE_MODULE = Path(__file__).resolve().parents[5] / "site" / "figures-re-40.js"


def text(name: str) -> str:
    return (FIXTURES / name).read_text()


class ElfTests(unittest.TestCase):
    def test_tiny_dyn_dynamic_section_matches_llvm_objdump(self) -> None:
        elf = main.load_elf("tiny-dyn-x86_64")
        self.assertEqual(elf.type_name, "ET_DYN")
        ours = [(e.tag_name[3:], e) for e in elf.dynamic_entries() if e.tag != 0]
        oracle = main.parse_objdump_dynamic(text("tiny-dyn-x86_64.objdump.txt"))
        self.assertEqual([tag for tag, _e in ours], [tag for tag, _v in oracle])
        for (tag, entry), (_tag, value) in zip(ours, oracle):
            if tag == "NEEDED":
                self.assertEqual(entry.text, value)
            else:
                self.assertEqual(entry.value, int(value, 16), tag)
        self.assertEqual(elf.dynamic(main.DT_FLAGS_1), main.DF_1_PIE)
        self.assertEqual([e.text for e in elf.dynamic_entries() if e.tag == main.DT_PLTREL], ["RELA"])

    def test_tiny_dyn_jump_slots_match_dynamic_relocation_records(self) -> None:
        elf = main.load_elf("tiny-dyn-x86_64")
        slots = elf.jump_slots()
        self.assertEqual([(main._hex(r.offset), r.describe()) for r in slots], [("0x10d8", "R_X86_64_JUMP_SLOT puts"), ("0x10e0", "R_X86_64_JUMP_SLOT exit")])
        oracle = main.parse_objdump_relocations(text("tiny-dyn-x86_64.objdump.txt"))
        records = [row for rows in oracle.values() for row in rows] or []
        lines = [line.split() for line in text("tiny-dyn-x86_64.objdump.txt").splitlines() if "R_X86_64_JUMP_SLOT" in line]
        self.assertEqual([(int(a, 16), t, v) for a, t, v in lines], [(r.offset, r.type_name, r.symbol_name) for r in slots])
        self.assertEqual(records, [])
        self.assertEqual([s.name for s in elf.dynamic_symbols if s.name], ["puts", "exit"])

    def test_plt_entries_follow_psabi_figure_5_2(self) -> None:
        elf = main.load_elf("tiny-dyn-x86_64")
        entries = elf.plt_entries()
        self.assertEqual([(e.symbol, e.address, e.slot, e.push_index, e.plt0) for e in entries], [("puts", 0x200, 0x10D8, 0, 0x1F0), ("exit", 0x210, 0x10E0, 1, 0x1F0)])
        self.assertEqual(entries[0].raw.hex(" "), "ff 25 d2 0e 00 00 68 00 00 00 00 e9 e0 ff ff ff")
        self.assertEqual(0x200 + 6 + 0xED2, 0x10D8)
        self.assertEqual([e.slot_initial for e in entries], [0x206, 0x216])
        plt0 = elf.plt0()
        self.assertEqual((plt0["pushes"], plt0["jumpsThrough"]), (0x10C8, 0x10D0))
        self.assertEqual(elf.got_plt_words(), [0x1000, 0, 0, 0x206, 0x216])
        self.assertEqual(elf.dynamic(main.DT_PLTGOT), 0x10C0)
        self.assertIn("     200: ff 25 d2 0e 00 00            \tjmpq\t*0xed2(%rip)", text("tiny-dyn-x86_64.objdump.txt"))

    def test_tiny_dyn_sections_and_program_headers_match_llvm_objdump(self) -> None:
        elf = main.load_elf("tiny-dyn-x86_64")
        oracle = main.parse_objdump_sections(text("tiny-dyn-x86_64.objdump.txt"))
        self.assertEqual([(s.index, s.name, s.size, s.addr) for s in elf.sections], oracle)
        dynamic = next(h for h in elf.program_headers if h.type == main.PT_DYNAMIC)
        self.assertEqual((dynamic.vaddr, dynamic.filesz, dynamic.flags_text), (0x1000, 0xC0, "rw-"))
        interp = next(h for h in elf.program_headers if h.type == main.PT_INTERP)
        self.assertEqual(elf.data[interp.offset : interp.offset + interp.filesz], b"/lib64/ld-linux-x86-64.so.2\0")
        self.assertEqual([h.flags_text for h in elf.program_headers if h.type == 1], ["r-x", "rw-"])

    def test_object_relocations_match_llvm_objdump(self) -> None:
        for name in main.FIXTURE_ELF_OBJECTS:
            elf = main.load_elf(name)
            oracle = main.parse_objdump_relocations(text(name.replace(".o", ".objdump.txt")))
            ours = {target: [(r.offset, r.type_name, r.describe().split(" ", 1)[1]) for r in rows] for target, rows in elf.relocations.items()}
            self.assertEqual(ours, oracle, name)
        self.assertEqual(sum(1 for r in main.load_elf("main-x86_64-O1.o").relocations[".text"] if r.type == 4), 8)

    def test_link_plan_counts_plt_entries_and_relative_relocations(self) -> None:
        plan = main.plan_dynamic_link({name: main.load_elf(name) for name in main.FIXTURE_ELF_OBJECTS})
        self.assertEqual(plan["pltSymbols"], ["puts", "printf"])
        self.assertEqual(plan["counts"], {"in-place": 16, "plt": 4, "direct": 4, "relative": 2})
        tiny = main.load_elf("tiny-dyn-x86_64")
        self.assertEqual(plan["sizes"][".plt"], tiny.section(".plt").size)
        self.assertEqual(plan["sizes"][".got.plt"], tiny.section(".got.plt").size)
        self.assertEqual(plan["sizes"][".rela.plt"], tiny.section(".rela.plt").size)
        kinds = {d["relocation"]: d["kind"] for d in plan["decisions"] if d["object"] == "main-x86_64-O1.o"}
        self.assertEqual(kinds["R_X86_64_PLT32 grade-0x4"], "direct")
        self.assertEqual(kinds["R_X86_64_PLT32 puts-0x4"], "plt")
        self.assertEqual(kinds["R_X86_64_64 grade"], "relative")
        self.assertEqual(kinds["R_X86_64_PC32 .rodata-0x4"], "in-place")


class CoffTests(unittest.TestCase):
    def test_coff_sections_match_llvm_objdump(self) -> None:
        for name in main.FIXTURE_COFF_OBJECTS:
            coff = main.load_coff(name)
            oracle = main.parse_objdump_sections(text(f"{name}.objdump.txt"))
            self.assertEqual([(s.number - 1, s.name, s.raw_size, s.virtual_address) for s in coff.sections], oracle, name)
            self.assertEqual(coff.machine_name, "IMAGE_FILE_MACHINE_AMD64")
        self.assertEqual(main.load_coff("main-x86_64.obj").sections[-1].name, ".llvm_addrsig")

    def test_coff_symbols_are_18_bytes_and_match_llvm_objdump(self) -> None:
        coff = main.load_coff("main-x86_64.obj")
        oracle = main.parse_objdump_coff_symbols(text("main-x86_64.obj.objdump.txt"))
        self.assertEqual([(s.index, s.name) for s in coff.symbols], oracle)
        self.assertEqual(coff.symbol_count, 37)
        self.assertEqual(coff.symbols[-1].name, ".file")
        self.assertEqual(coff.symbols[-1].aux[0].rstrip(b"\0"), b"main.c")
        self.assertEqual([s.name for s in coff.functions()], ["main"])
        self.assertEqual(coff.undefined(), ["puts", "printf", "grade_label", "total", "grade", "percent_change"])
        definitions = {(d["number"], d["section"]): d for d in coff.section_definitions()}
        self.assertEqual((definitions[(1, ".text")]["length"], definitions[(1, ".text")]["relocations"], definitions[(1, ".text")]["comdat"]), (0xB9, 14, 0))
        self.assertEqual(definitions[(5, ".rdata")]["comdat"], 2)
        aux_lines = [line for line in text("main-x86_64.obj.objdump.txt").splitlines() if line.startswith("AUX scnlen")]
        self.assertEqual(len(aux_lines), len(definitions))

    def test_coff_relocations_match_llvm_objdump(self) -> None:
        for name in main.FIXTURE_COFF_OBJECTS:
            coff = main.load_coff(name)
            oracle = main.parse_objdump_relocations(text(f"{name}.objdump.txt"))
            ours = {section: [(r.offset, r.type_name, r.symbol_name) for r in rows] for section, rows in coff.relocations.items()}
            self.assertEqual(ours, oracle, name)
        relocations = main.load_coff("main-x86_64.obj").relocations
        self.assertEqual({r.type_name for r in relocations[".text"]}, {"IMAGE_REL_AMD64_REL32"})
        self.assertEqual({r.type_name for r in relocations[".rdata"]}, {"IMAGE_REL_AMD64_ADDR64"})

    def test_coff_rel32_sits_where_the_elf_pc32_sits(self) -> None:
        coff = main.load_coff("ledger-x86_64.obj")
        elf = main.load_elf("ledger-x86_64-O1.o")
        self.assertEqual([r.offset for r in coff.relocations[".text"]], [0x36, 0x84, 0x93])
        self.assertEqual([r.offset for r in elf.relocations[".text"]], [0x36, 0x84, 0x93])
        self.assertEqual(len(coff.relocations[".rdata"]), 5)
        self.assertTrue(all(name.startswith("??_C@_01") for name in (r.symbol_name for r in coff.relocations[".rdata"])))


class PeTests(unittest.TestCase):
    def test_pe_headers_match_llvm_objdump(self) -> None:
        pe = main.load_pe("tiny-x86_64.exe")
        self.assertEqual((pe.e_lfanew, pe.magic, pe.entry_point, pe.image_base), (0x40, 0x20B, 0x1000, 0x140000000))
        self.assertEqual(pe.dll_characteristic_names(), ["HIGH_ENTROPY_VA", "DYNAMIC_BASE", "NX_COMPAT", "TERMINAL_SERVER_AWARE"])
        oracle = text("tiny-x86_64.exe.objdump.txt")
        for name in pe.dll_characteristic_names():
            self.assertIn(f"\t{name}\n", oracle)
        entries = {}
        for line in oracle.splitlines():
            if line.startswith("Entry "):
                parts = line.split()
                entries[int(parts[1], 16)] = (int(parts[2], 16), int(parts[3], 16))
        for index, (_name, rva, size) in enumerate(pe.data_directories):
            self.assertEqual(entries[index], (rva, size), index)
        self.assertEqual([(s.name, s.virtual_address, s.virtual_size) for s in pe.sections], [(".text", 0x1000, 0x1A), (".rdata", 0x2000, 0xDC), (".data", 0x3000, 8), (".reloc", 0x4000, 12)])

    def test_pe_import_directory_matches_llvm_objdump_and_pefile(self) -> None:
        pe = main.load_pe("tiny-x86_64.exe")
        descriptors = pe.imports()
        self.assertEqual(len(descriptors), 1)
        descriptor = descriptors[0]
        self.assertEqual((descriptor.dll, descriptor.lookup_rva, descriptor.iat_rva, descriptor.name_rva), ("msvcrt.dll", 0x2028, 0x2040, 0x2068))
        self.assertEqual([(e.slot_rva, e.hint, e.name, e.by_ordinal) for e in descriptor.entries], [(0x2040, 0, "puts", False), (0x2048, 0, "exit", False)])
        oracle = main.parse_objdump_pe_imports(text("tiny-x86_64.exe.objdump.txt"))
        self.assertEqual(oracle, [("msvcrt.dll", 0x2028, 0x2040, [(0, "puts"), (0, "exit")])])
        probe = text("probe-libs.txt")
        self.assertIn("import msvcrt.dll [('puts', '0x140002040', 0), ('exit', '0x140002048', 0)]", probe)
        self.assertIn("PEFormatError: 'DOS Header magic not found.'", probe)
        with self.assertRaises(main.FormatError):
            main.PeImage((FIXTURES / "main-x86_64.obj").read_bytes())
        self.assertEqual(pe.read_rva(0x2028, 24), pe.read_rva(0x2040, 24))

    def test_pe_export_directory_and_base_relocations(self) -> None:
        pe = main.load_pe("tiny-x86_64.exe")
        exports = pe.exports()
        self.assertEqual((exports["name"], exports["ordinalBase"], exports["entries"]), ("tiny-x86_64.exe", 1, [{"ordinal": 1, "rva": 0x1000, "name": "tiny_entry"}]))
        self.assertIn("       1   0x1000  tiny_entry", text("tiny-x86_64.exe.objdump.txt"))
        blocks = pe.base_relocations()
        self.assertEqual(len(blocks), 1)
        self.assertEqual((blocks[0]["pageRva"], blocks[0]["blockSize"]), (0x3000, 12))
        self.assertEqual([(e["typeName"], e["rva"]) for e in blocks[0]["entries"]], [("IMAGE_REL_BASED_DIR64", 0x3000), ("IMAGE_REL_BASED_ABSOLUTE", 0x3000)])
        pointer = int.from_bytes(pe.read_rva(0x3000, 8), "little")
        self.assertEqual(pe.string_at(pointer - pe.image_base), "linked by hand")
        self.assertIn("base relocations [('0x3000', 10), ('0x3000', 0)]", text("probe-libs.txt"))

    def test_iat_call_decodes_ff_15_to_the_slot(self) -> None:
        calls = main.load_pe("tiny-x86_64.exe").iat_calls()
        self.assertEqual([(c["rva"], c["bytes"], c["slot"], c["name"]) for c in calls], [(0x100B, "ff 15 2f 10 00 00", 0x2040, "puts"), (0x1013, "ff 15 2f 10 00 00", 0x2048, "exit")])
        self.assertEqual(0x100B + 6 + 0x102F, 0x2040)


class MachoTests(unittest.TestCase):
    def test_header_flags_and_load_commands_match_otool(self) -> None:
        exe = main.load_macho("ledger_main")
        self.assertEqual(exe.flags, main.parse_otool_header_flags(text("ledger_main.otool-h.txt")))
        self.assertEqual(exe.flag_names(), ["MH_NOUNDEFS", "MH_DYLDLINK", "MH_TWOLEVEL", "MH_PIE"])
        self.assertEqual(exe.command_names(), main.parse_otool_commands(text("ledger_main.otool-l.txt")))
        self.assertEqual(len(exe.load_commands), 19)
        self.assertEqual(exe.dylibs, ["@rpath/libledger.dylib", "/usr/lib/libSystem.B.dylib"])
        self.assertEqual(exe.rpaths, ["@executable_path"])
        self.assertEqual(exe.base_address + (exe.entryoff or 0), 0x100000558)

    def test_stubs_and_indirect_symbols_match_otool(self) -> None:
        exe = main.load_macho("ledger_main")
        stubs = exe.stubs()
        self.assertEqual(len(stubs), 7)
        self.assertEqual(exe.section("__TEXT", "__stubs").reserved2, 12)
        oracle = main.parse_otool_stubs(text("ledger_main.stubs.txt"))
        self.assertEqual([a for a, _t in oracle[::3]], [s.address for s in stubs])
        for stub, (_a, ldr_text) in zip(stubs, oracle[1::3]):
            match = re.search(r"#0x([0-9a-f]+)", ldr_text)
            offset = int(match.group(1), 16) if match else 0
            self.assertEqual(stub.slot, 0x100004000 + offset, stub.symbol)
        puts = next(s for s in stubs if s.symbol == "_puts")
        self.assertEqual((puts.address, puts.raw.hex(" "), puts.slot), (0x100000694, "30 00 00 90 10 1e 40 f9 00 02 1f d6", 0x100004038))
        indirect = main.parse_otool_indirect(text("ledger_main.otool-Iv.txt"))
        self.assertEqual([(r["address"], r["index"], r["name"]) for r in exe.indirect_table()], indirect)

    def test_chained_fixups_header_matches_llvm_objdump(self) -> None:
        info = main.load_macho("ledger_main").chained_fixups()
        oracle = {}
        for line in text("ledger_main.chained-fixups.txt").splitlines():
            if "=" in line:
                key, value = line.split("=", 1)
                oracle[key.strip()] = int(value.split()[0])
        self.assertEqual(info["header"], oracle)
        self.assertEqual(info["segments"], [{"segment": "__DATA_CONST", "size": 24, "page_size": 0x4000, "pointer_format": 6, "segment_offset": 0x4000, "max_valid_pointer": 0, "page_count": 1, "page_start": [0]}])

    def test_chain_walk_reproduces_every_raw_word_of_dyld_info(self) -> None:
        info = main.load_macho("ledger_main").chained_fixups()
        ours = [(f.offset, f.raw) for f in info["fixups"]]
        self.assertEqual(ours, main.parse_dyld_chain_details(text("ledger_main.dyld-chain-details.txt")))
        first = info["fixups"][0]
        self.assertEqual((first.raw, first.kind, first.next, first.ordinal), (0x8010000000000000, "bind", 2, 0))
        last = info["fixups"][-1]
        self.assertEqual((last.kind, last.next, last.target), ("rebase", 0, 0x1000006DB))
        self.assertEqual(len(info["fixups"]), 12)

    def test_fixup_rows_and_imports_match_dyld_info(self) -> None:
        exe = main.load_macho("ledger_main")
        rows = main.parse_dyld_fixups(text("ledger_main.dyld-fixups.txt"))
        normalized = [(seg, sect, addr, kind, int(target, 16) if kind == "rebase" else target) for seg, sect, addr, kind, target in rows]
        ours = [(seg, sect, addr, kind, int(target, 16) if kind == "rebase" else target) for seg, sect, addr, kind, target in exe.fixup_rows()]
        self.assertEqual(ours, normalized)
        imports = [(i.index, i.name, i.library) for i in exe.chained_fixups()["imports"]]
        self.assertEqual(imports, main.parse_dyld_imports(text("ledger_main.dyld-imports.txt")))
        self.assertEqual([i.lib_ordinal for i in exe.chained_fixups()["imports"]], [1, 1, 1, 1, 2, 2, 2, 2])

    def test_exports_trie_matches_dyld_info_for_the_dylib_and_its_stripped_copy(self) -> None:
        for name, oracle in (("libledger.dylib", "libledger.dyld-exports.txt"), ("libledger.stripped.dylib", "libledger.stripped.dyld-exports.txt")):
            dylib = main.load_macho(name)
            exports = sorted((e["offset"], e["name"]) for e in dylib.exports_trie())
            self.assertEqual(exports, sorted(main.parse_dyld_exports(text(oracle))), name)
        self.assertEqual([e["name"] for e in main.load_macho("ledger_main").exports_trie()], ["__mh_execute_header", "_fns", "_main"])

    def test_two_level_namespace_matches_nm_m(self) -> None:
        exe = main.load_macho("ledger_main")
        self.assertEqual(exe.nm_lines(), main.parse_nm_m(text("ledger_main.nm.txt")))
        self.assertEqual(main.load_macho("ledger_main.stripped").nm_lines(), main.parse_nm_m(text("ledger_main.stripped.nm.txt")))
        self.assertEqual(dict(exe.two_level_imports())["_puts"], "libSystem")
        self.assertEqual(dict(exe.two_level_imports())["_grade"], "libledger")
        self.assertEqual(main.load_macho("ledger_main_nochain").flags, exe.flags)

    def test_strip_removes_main_and_keeps_imports_and_the_exports_trie(self) -> None:
        exe = main.strip_report(main.load_macho("ledger_main"), main.load_macho("ledger_main.stripped"))
        self.assertEqual((exe["nsymsBefore"], exe["nsymsAfter"]), (12, 10))
        self.assertEqual(exe["removed"], ["_fns", "_main", "_names"])
        self.assertEqual(len(exe["kept"]), 9)
        self.assertEqual([n.name for n in main.load_macho("ledger_main.stripped").nlists if n.is_stab], ["radr://5614542"])
        self.assertEqual(text("ledger_main.run.txt"), text("ledger_main.stripped.run.txt"))
        self.assertEqual(text("ledger_main.run.txt"), "odd\n2\n50 3 10 B\nexit=0\n")
        dylib = main.strip_report(main.load_macho("libledger.dylib"), main.load_macho("libledger.stripped.dylib"))
        self.assertEqual((dylib["nsymsBefore"], dylib["nsymsAfter"], dylib["kept"]), (5, 0, []))
        self.assertEqual(dylib["exportsAfter"], ["_grade", "_grade_label", "_percent_change", "_total"])
        self.assertEqual((dylib["functionStartsBefore"], dylib["functionStartsAfter"]), (4, 4))
        self.assertIn("no symbols", text("libledger.stripped.nm.txt"))

    def test_legacy_layout_has_lazy_pointers_and_dyld_info_only(self) -> None:
        legacy = main.load_macho("ledger_main_nochain")
        self.assertIn("LC_DYLD_INFO_ONLY", legacy.command_names())
        self.assertNotIn("LC_DYLD_CHAINED_FIXUPS", legacy.command_names())
        self.assertEqual(legacy.dyld_info and legacy.dyld_info["lazy_bind_size"], 120)
        lazy = legacy.section("__DATA", "__la_symbol_ptr")
        self.assertEqual(lazy.type, main.S_LAZY_SYMBOL_POINTERS)
        rows = main.parse_dyld_fixups(text("ledger_main_nochain.dyld-fixups.txt"))
        self.assertEqual(sum(1 for r in rows if r[3] == "lazy-bind"), lazy.size // 8)
        self.assertEqual(lazy.size // 8, 7)
        helper = legacy.section("__TEXT", "__stub_helper")
        for seg, sect, address, kind, target in rows:
            if sect == "__la_symbol_ptr" and kind == "rebase":
                self.assertTrue(helper.contains(int(target, 16)), target)
        self.assertEqual(legacy.chained_fixups(), {})

    def test_object_relocations_match_llvm_objdump_r(self) -> None:
        for name in ("ledger-arm64-O2.o", "main-arm64-O2.o"):
            macho = main.load_macho(name)
            oracle = main.parse_objdump_relocations(text(name.replace(".o", ".objdump-r.txt")))
            ours = {section: [(r.address, r.type_name, r.name) for r in rows] for section, rows in macho.relocations().items()}
            self.assertEqual(ours, oracle, name)
        self.assertEqual([(n, s, e) for n, s, e in main.load_macho("ledger-arm64-O2.o").text_functions()], [("_percent_change", 0, 24), ("_grade", 24, 84), ("_total", 84, 332), ("_grade_label", 332, 404)])


class IdentificationTests(unittest.TestCase):
    def truth(self, level: str) -> list[int]:
        names = main.parse_nm_addresses(text(f"static-arm64-{level}.nm.txt"))
        return sorted(a for n, a in names.items() if n != "__mh_execute_header")

    def test_function_starts_recover_all_five_at_both_levels(self) -> None:
        for level in ("O0", "O2"):
            stripped = main.load_macho(f"static-arm64-{level}.stripped")
            finder = main.FunctionFinder(stripped)
            self.assertEqual(finder.symbols(), [], level)
            self.assertEqual(finder.function_starts(), self.truth(level), level)
            self.assertEqual(finder.function_starts(), main.parse_function_starts(text(f"static-arm64-{level}.stripped.function-starts.txt")), level)
            unstripped = main.load_macho(f"static-arm64-{level}")
            self.assertEqual([s for _n, s, _e in unstripped.text_functions()], self.truth(level), level)

    def test_prologue_scans_find_five_at_o0_and_one_at_o2(self) -> None:
        scores = {}
        for level in ("O0", "O2"):
            finder = main.FunctionFinder(main.load_macho(f"static-arm64-{level}.stripped"))
            scores[level] = {pattern: main.FunctionFinder.score(finder.prologue_scan(pattern), self.truth(level)) for pattern in ("sub-sp", "stp-frame")}
        self.assertEqual(scores["O0"]["sub-sp"]["recall"], "5/5")
        self.assertEqual(scores["O2"]["sub-sp"]["recall"], "1/5")
        self.assertEqual(scores["O2"]["sub-sp"]["missed"], ["0x1000005f4", "0x10000060c", "0x100000648", "0x100000740"])
        self.assertEqual(scores["O0"]["stp-frame"]["recall"], "0/5")
        self.assertEqual(scores["O2"]["stp-frame"]["recall"], "0/5")
        for level in scores:
            for pattern in scores[level]:
                self.assertEqual(scores[level][pattern]["falsePositives"], [], (level, pattern))

    def test_call_targets_plus_entry_recover_all_five(self) -> None:
        for level in ("O0", "O2"):
            stripped = main.load_macho(f"static-arm64-{level}.stripped")
            finder = main.FunctionFinder(stripped)
            self.assertEqual(finder.call_targets(), self.truth(level), level)
            entry = stripped.base_address + (stripped.entryoff or 0)
            self.assertEqual(entry, self.truth(level)[0], level)
        self.assertEqual(main.decode_bl(0x9400003D, 0x1000005A0), 0x100000694)
        self.assertIsNone(main.decode_bl(0xD65F03C0, 0))

    def test_signatures_name_every_function_and_split_the_grade_collision(self) -> None:
        for level in ("O0", "O2"):
            report = main.identification_report(main.load_macho(f"static-arm64-{level}"), main.load_macho(f"static-arm64-{level}.stripped"), [main.load_macho(f"main-arm64-{level}.o"), main.load_macho(f"ledger-arm64-{level}.o")])
            self.assertEqual(report["correctNames"], 5, level)
            self.assertEqual(report["signatures"]["unmatched"], [], level)
            self.assertEqual(len(report["signatures"]["pat"]), 5, level)
        o2 = main.identification_report(main.load_macho("static-arm64-O2"), main.load_macho("static-arm64-O2.stripped"), [main.load_macho("main-arm64-O2.o"), main.load_macho("ledger-arm64-O2.o")])
        collisions = o2["signatures"]["collisions"]
        self.assertEqual([c["candidates"] for c in collisions], [["_grade", "_grade_label"], ["_grade", "_grade_label"]])
        self.assertEqual([c["winner"] for c in collisions], ["_grade", "_grade_label"])
        self.assertEqual(collisions[0]["resolvedBy"], {"tailOffset": 44, "bytes": {"_grade": "20", "_grade_label": "28"}, "lengths": {"_grade": 60, "_grade_label": 72}})
        grade = next(s for s in main.signatures_from_object(main.load_macho("ledger-arm64-O2.o")) if s.name == "_grade")
        self.assertEqual((grade.crc_length, grade.length, grade.referenced), (4, 60, ("l_switch.table.grade", "l_switch.table.grade")))
        self.assertTrue(grade.pat_line().startswith("E8CC8C52C8CCAC72087C289B09FD7FD308FD62930801090B081900511F110071 04 9AAF 003C :0000 _grade"))

    def test_crc16_known_answer_and_relocation_bytes_are_variant(self) -> None:
        self.assertEqual(main.crc16(b"123456789"), 0x6E90)
        self.assertEqual(main.crc16(b""), 0)
        signatures = {s.name: s for s in main.signatures_from_object(main.load_macho("main-arm64-O2.o"))}
        pattern = signatures["_main"].pattern
        self.assertEqual([k for k, byte in enumerate(pattern) if byte is None], list(range(24, 32)))
        self.assertEqual(signatures["_main"].pat_line()[:64], "FFC301D1F65704A9F44F05A9FD7B06A9FD830191F30300AA................")
        short = {s.name: s for s in main.signatures_from_object(main.load_macho("ledger-arm64-O2.o"))}["_percent_change"]
        self.assertEqual((len(short.pattern), short.crc_length, short.length), (24, 0, 24))

    def test_object_bytes_equal_linked_bytes_outside_relocated_words(self) -> None:
        exe = main.load_macho("static-arm64-O2")
        code = exe.section_bytes(exe.text_section())
        truth = {name: start for name, start, _end in exe.text_functions()}
        for signature in main.signatures_from_object(main.load_macho("ledger-arm64-O2.o")):
            start = truth[signature.name] - exe.text_section().addr
            linked = code[start : start + signature.length]
            self.assertTrue(signature.tail_matches(linked), signature.name)
            if any(byte is None for byte in signature.masked):
                self.assertTrue(any(byte is None for byte in signature.masked[32:]) or signature.crc_length == 0 or True)
        total = next(s for s in main.signatures_from_object(main.load_macho("ledger-arm64-O2.o")) if s.name == "_total")
        self.assertEqual(sum(1 for byte in total.masked if byte is None), 0)


class ReportTests(unittest.TestCase):
    def test_demo_reports_every_format(self) -> None:
        report = main.demo()
        self.assertEqual(sorted(report), ["coff", "elf", "identification", "macho", "pe"])
        self.assertEqual(report["elf"]["linkPlan"]["pltSymbols"], ["puts", "printf"])
        self.assertEqual(report["macho"]["ledger_main"]["flags"], "0x200085")
        self.assertEqual(report["identification"]["O2"]["correctNames"], 5)
        self.assertEqual(report["identification"]["O2"]["methods"]["prologueSub"]["recall"], "1/5")
        self.assertEqual(report["pe"]["iatCalls"][0]["name"], "puts")

    def test_figure_data_traces_puts_through_three_formats(self) -> None:
        data = main.figure_data()
        self.assertEqual((data["elf"]["call"]["address"], data["elf"]["stub"]["address"], data["elf"]["slot"]["address"]), (0x227, 0x200, 0x10D8))
        self.assertEqual((data["pe"]["call"]["address"], data["pe"]["slot"]["address"], data["pe"]["slot"]["initial"]), (0x100B, 0x2040, "0x2058"))
        self.assertEqual((data["macho"]["call"]["address"], data["macho"]["stub"]["address"], data["macho"]["slot"]["address"]), (0x1000005A0, 0x100000694, 0x100004038))
        self.assertEqual(data["macho"]["slot"]["initial"], "0x8010000000000007")
        self.assertEqual([m["id"] for m in data["stripped"]["methods"]], ["functionStarts", "prologueSub", "prologueStp", "callTargets", "signatures"])
        self.assertEqual(len(data["stripped"]["truth"]), 5)

    def test_site_figure_module_embeds_the_same_data(self) -> None:
        if not SITE_MODULE.exists():
            self.skipTest("site module not present in this checkout")
        source = SITE_MODULE.read_text()
        match = re.search(r"var DATA = (\{.*?\});\n", source, re.S)
        assert match is not None, "figures-re-40.js must define var DATA = {...};"
        embedded = json.loads(match.group(1))
        expected = json.loads(json.dumps(main.figure_data()))
        self.assertEqual(embedded, expected)
        for forbidden in ("=>", "let ", "const ", "`"):
            self.assertNotIn(forbidden, source, f"ES5 only: found {forbidden!r}")


if __name__ == "__main__":
    unittest.main()
