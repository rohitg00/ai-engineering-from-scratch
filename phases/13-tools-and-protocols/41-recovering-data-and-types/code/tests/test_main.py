import json
import re
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
TOOLS = FIXTURES / "tools"
SITE_MODULE = Path(__file__).resolve().parents[5] / "site" / "figures-re-41.js"


def dwarfdump_text() -> str:
    return (FIXTURES / "account-x86_64-O0-g.dwarfdump.txt").read_text()


def tool_text(name: str) -> str | None:
    path = TOOLS / name
    return path.read_text(errors="replace") if path.exists() else None


class DwarfReaderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.dwarf = main.DwarfInfo(main.load_object("account-x86_64-O0-g.o"))

    def test_unit_header_matches_llvm_dwarfdump(self) -> None:
        header = self.dwarf.header()
        line = next(l for l in dwarfdump_text().splitlines() if "Compile Unit:" in l)
        self.assertEqual(header.length, int(re.search(r"length = (0x[0-9a-f]+)", line).group(1), 16))
        self.assertEqual(header.version, int(re.search(r"version = (0x[0-9a-f]+)", line).group(1), 16))
        self.assertIn("unit_type = DW_UT_compile", line)
        self.assertEqual(header.to_dict()["unitType"], "DW_UT_compile")
        self.assertEqual(header.address_size, 8)
        self.assertEqual(header.abbrev_offset, 0)

    def test_abbreviation_table_matches_llvm_dwarfdump(self) -> None:
        table = main.parse_abbreviations(self.dwarf.abbrev)
        text = (FIXTURES / "account-x86_64-O0-g.dwarfdump-tables.txt").read_text()
        expected = re.findall(r"^\[(\d+)\] DW_TAG_(\w+)\tDW_CHILDREN_(yes|no)$", text, re.M)
        self.assertEqual(len(expected), 14)
        for code, tag, children in expected:
            abbreviation = table[int(code)]
            self.assertEqual(main.DW_TAG[abbreviation.tag], tag)
            self.assertEqual(abbreviation.has_children, children == "yes")

    def test_account_struct_layout_matches_llvm_dwarfdump(self) -> None:
        layout = self.dwarf.struct("account")
        text = dwarfdump_text()
        block = text[text.index('DW_AT_name\t("account")') :]
        self.assertEqual(layout.size, int(re.search(r"DW_AT_byte_size\t\((0x[0-9a-f]+)\)", block).group(1), 16))
        locations = [int(v, 16) for v in re.findall(r"DW_AT_data_member_location\t\((0x[0-9a-f]+)\)", block)[:5]]
        self.assertEqual([m.offset for m in layout.members], locations)
        self.assertEqual([m.offset for m in layout.members], [0, 4, 8, 16, 24])
        self.assertEqual([m.name for m in layout.members], ["kind", "balance", "code", "rate", "label"])
        self.assertEqual([m.type for m in layout.members], ["char", "int", "short", "double", "const char *"])
        self.assertEqual([m.size for m in layout.members], [1, 4, 2, 8, 8])
        self.assertEqual([m.kind for m in layout.members], ["int", "int", "int", "float", "pointer"])
        self.assertEqual(layout.padding(), [1, 2, 3, 10, 11, 12, 13, 14, 15])
        self.assertEqual(layout.align, 8)

    def test_strings_come_through_the_relocated_str_offsets_table(self) -> None:
        root = self.dwarf.root()
        self.assertEqual(root.get("name"), "account.c")
        self.assertEqual(root.get("comp_dir"), ".")
        self.assertEqual(root.get("producer"), "Apple clang version 17.0.0 (clang-1700.6.3.2)")
        self.assertEqual(root.get("str_offsets_base"), 8)
        self.assertEqual(root.get("addr_base"), 8)
        relocations = self.dwarf.elf.relocations[".debug_str_offsets"]
        self.assertTrue(all(r.type == main.R_X86_64_32 and r.symbol_name == ".debug_str" for r in relocations))
        self.assertEqual(self.dwarf.type_name(self.dwarf.type_of(self.dwarf.find("variable")[0])), "char[5]")

    def test_functions_carry_ranges_frame_base_and_parameter_locations(self) -> None:
        functions = {f.name: f for f in self.dwarf.functions()}
        self.assertEqual(list(functions), ["bump", "sum_balances", "tag", "projected", "label_length", "main"])
        bump = functions["bump"]
        self.assertEqual((bump.low_pc, bump.high_pc), (0x0, 0x21))
        self.assertEqual(bump.frame_base, "DW_OP_reg6 RBP")
        self.assertEqual([(p.name, p.type, p.location) for p in bump.parameters], [("a", "account *", "DW_OP_fbreg -8"), ("by", "int", "DW_OP_fbreg -12")])
        self.assertEqual(functions["sum_balances"].parameters[0].type, "const account *")
        self.assertEqual((functions["main"].low_pc, functions["main"].high_pc), (0x120, 0x1FF))
        listing = main.load_listing("account-x86_64-O0-g.objdump.txt")
        self.assertEqual([f.low_pc for f in functions.values()], [listing[name][0].address for name in functions])

    def test_reader_refuses_objects_without_debug_info_and_decodes_leb128(self) -> None:
        with self.assertRaises(main.DwarfError):
            main.DwarfInfo(main.load_object("account-x86_64-O1.o"))
        self.assertEqual(main.read_uleb(b"\x80\x01", 0), (128, 2))
        self.assertEqual(main.read_uleb(b"\x7f", 0), (127, 1))
        self.assertEqual(main.read_sleb(b"\x78", 0), (-8, 1))
        self.assertEqual(main.read_sleb(b"\x80\x7f", 0), (-128, 2))
        self.assertEqual(main.decode_location(b"\x91\x78"), "DW_OP_fbreg -8")
        self.assertEqual(main.decode_location(b"\xa1\x02"), "DW_OP_addrx 0x2")
        self.assertEqual(main.decode_location(b"\x56"), "DW_OP_reg6 RBP")

    def test_pyelftools_and_lldb_captures_agree_with_the_reader(self) -> None:
        pyelftools = tool_text("pyelftools-account.txt")
        lldb = tool_text("lldb-account.txt")
        if pyelftools is None or lldb is None:
            self.skipTest("tool captures not present")
        rows = re.findall(r"^\s+\+(\d+) (.+) (\w+)$", pyelftools, re.M)
        self.assertEqual([(int(o), t, n) for o, t, n in rows], [(m.offset, m.type, m.name) for m in self.dwarf.struct("account").members])
        self.assertIn("byte-size = 32", lldb)
        for declaration in ("char kind;", "int balance;", "short code;", "double rate;", "const char *label;"):
            self.assertIn(declaration, lldb)


class LayoutRuleTests(unittest.TestCase):
    def test_psabi_rules_reproduce_the_dwarf_layout(self) -> None:
        rules = main.sysv_layout(main.ACCOUNT_MEMBERS)
        self.assertEqual([m["offset"] for m in rules["members"]], [0, 4, 8, 16, 24])
        self.assertEqual([m["paddingBefore"] for m in rules["members"]], [0, 3, 0, 6, 0])
        self.assertEqual((rules["size"], rules["align"], rules["tailPadding"]), (32, 8, 0))

    def test_ctypes_agrees_with_the_rules_and_with_dwarf(self) -> None:
        oracles = main.layout_oracles()
        self.assertTrue(oracles["agree"])
        self.assertEqual(oracles["ctypes"]["size"], 32)
        self.assertEqual(oracles["ctypes"]["align"], 8)
        self.assertEqual([m["offset"] for m in oracles["ctypes"]["members"]], [0, 4, 8, 16, 24])

    def test_reordering_members_shrinks_the_struct_to_24_bytes(self) -> None:
        reordered = main.layout_oracles()["reordered"]
        self.assertEqual([m["offset"] for m in reordered["members"]], [0, 8, 16, 20, 22])
        self.assertEqual((reordered["size"], reordered["tailPadding"]), (24, 1))

    def test_native_run_prints_the_same_numbers(self) -> None:
        lines = (FIXTURES / "account-native.run.txt").read_text().splitlines()
        self.assertEqual(lines[0], "sizeof 32 align 8")
        self.assertEqual(lines[1], "kind 0 balance 4 code 8 rate 16 label 24")
        self.assertEqual(lines[2], "sum 315 tag -3 projected 318.75 label_length 7")


class ListingTests(unittest.TestCase):
    def test_listing_parser_reads_functions_relocations_and_targets(self) -> None:
        listing = main.load_listing("account-x86_64-O0-g.objdump.txt")
        self.assertEqual(list(listing), ["bump", "sum_balances", "tag", "projected", "label_length", "main"])
        self.assertEqual(len(listing["bump"]), 13)
        self.assertEqual(listing["bump"][0].text, "pushq\t%rbp")
        call = next(i for i in listing["main"] if i.address == 0x194)
        self.assertEqual((call.flow, call.target, call.callee), ("call", 0x199, "bump"))
        self.assertEqual(call.relocation, "R_X86_64_PLT32 bump-0x4")
        branch = next(i for i in listing["sum_balances"] if i.address == 0x4F)
        self.assertEqual((branch.mnemonic, branch.target, branch.flow), ("jge", 0x74, "branch"))
        loop = next(i for i in listing["sum_balances"] if i.address == 0x72)
        self.assertEqual((loop.flow, loop.target), ("jump", 0x49))

    def test_memory_operand_parser_covers_the_att_forms(self) -> None:
        self.assertEqual(main.parse_memory("0x4(%rdi,%rdx)"), main.MemoryOperand(4, "rdi", "rdx", 1, False))
        self.assertEqual(main.parse_memory("-0x80(%rax)"), main.MemoryOperand(-128, "rax", None, 1, False))
        self.assertEqual(main.parse_memory("(%rcx,%rax,4)"), main.MemoryOperand(0, "rcx", "rax", 4, False))
        self.assertTrue(main.parse_memory("(%rip)").rip_relative)
        self.assertEqual(main.parse_memory("%cs:(%rax,%rax)").base, "rax")
        self.assertTrue(main.parse_memory("-0x8(%rbp)").is_frame_slot)
        self.assertIsNone(main.parse_memory("$0x5"))
        self.assertIsNone(main.parse_memory("%eax"))
        self.assertEqual(main.split_operands("0x4(%rdi,%rdx), %eax"), ("0x4(%rdi,%rdx)", "%eax"))

    def test_access_width_and_kind_follow_the_mnemonic(self) -> None:
        self.assertEqual(main.access_width("movl", 0, 2), (4, "int", None))
        self.assertEqual(main.access_width("movswl", 0, 2), (2, "int", "signed"))
        self.assertEqual(main.access_width("movsbl", 0, 2), (1, "int", "signed"))
        self.assertEqual(main.access_width("movzbl", 0, 2), (1, "int", "unsigned"))
        self.assertEqual(main.access_width("cmpb", 1, 2), (1, "int", None))
        self.assertEqual(main.access_width("movsd", 0, 2), (8, "float", None))
        self.assertEqual(main.access_width("mulsd", 0, 2), (8, "float", None))
        self.assertEqual(main.access_width("cvtsi2sdl", 0, 2), (4, "int", "signed"))
        self.assertEqual(main.access_width("movq", 0, 2), (8, "int", None))
        self.assertEqual(main.access_width("movd", 0, 2), (4, "int", None))
        self.assertEqual(main.access_width("movaps", 0, 2), (16, "vector", None))
        self.assertEqual(main.access_width("callq", 0, 1), (8, "code", None))
        self.assertIsNone(main.access_width("leaq", 0, 2))
        self.assertIsNone(main.access_width("nopw", 0, 1))


class TraceTests(unittest.TestCase):
    def trace(self, build: str, name: str) -> main.FunctionTrace:
        listing = main.load_listing(f"{main.ACCOUNT_BUILDS[build]}.objdump.txt")
        return main.trace_function(name, listing[name])

    def test_bump_at_o0_reads_the_struct_pointer_back_from_its_frame_slot(self) -> None:
        trace = self.trace("O0", "bump")
        self.assertEqual([(a.address, a.offset, a.width, a.store) for a in trace.accesses], [(0x12, 4, 4, False), (0x15, 4, 4, True), (0x1C, 4, 4, False)])
        self.assertTrue(all(a.root == "param0" and a.base == "rax" for a in trace.accesses))
        self.assertEqual(trace.unattributed, 0)
        self.assertEqual(trace.loops, [])

    def test_stride_evidence_differs_per_build(self) -> None:
        o0 = self.trace("O0", "sum_balances")
        self.assertEqual([a.strides for a in o0.accesses], [frozenset({32})])
        self.assertEqual(o0.loops, [(0x49, 0x72)])
        o1 = self.trace("O1", "sum_balances")
        self.assertEqual([(a.offset, a.index) for a in o1.accesses], [(4, "rdx")])
        self.assertIn(main.Increment("sum_balances", 0x24, "rdx", 32), o1.increments)
        o2 = self.trace("O2", "sum_balances")
        folded, evidence = main.fold_unrolled(o2, o2.accesses)
        self.assertEqual(sorted({a.offset for a in o2.accesses}), [4, 36, 68, 100, 132, 164, 196, 228])
        self.assertEqual({a.offset for a in folded}, {4})
        self.assertIn(("unrolled", 32), [(e.kind, e.value) for e in evidence])
        self.assertIn(main.Increment("sum_balances", 0xA0, "rax", 256), o2.increments)

    def test_label_length_proves_the_pointer_field_by_dereferencing_it(self) -> None:
        o0 = self.trace("O0", "label_length")
        self.assertEqual([(u.address, u.origin) for u in o0.pointer_uses], [(0xFB, ("param0", 24))])
        pointee = [a for a in o0.accesses if a.root == "param0->0x18"]
        self.assertEqual([(a.offset, a.width) for a in pointee], [(0, 1)])
        o1 = self.trace("O1", "label_length")
        self.assertEqual([u.address for u in o1.pointer_uses], [0x72, 0x75])
        self.assertIn(main.Increment("label_length", 0x75, "rcx", 1), o1.increments)

    def test_main_passes_one_frame_object_to_every_witness_at_o0_only(self) -> None:
        o0 = self.trace("O0", "main")
        sites = {c.callee: c.arguments[0] for c in o0.call_sites}
        self.assertEqual(sites["bump"], "frame(rbp-0x70)0x20")
        self.assertEqual(sites["sum_balances"], "frame(rbp-0x70)")
        self.assertEqual(sites["tag"], "frame(rbp-0x70)0x40")
        self.assertEqual(sites["projected"], "frame(rbp-0x70)0x20")
        self.assertEqual(sites["label_length"], "frame(rbp-0x70)0x20")
        self.assertEqual(sites["memcpy"], "frame(rbp-0x70)")
        o1 = self.trace("O1", "main")
        self.assertEqual([c.callee for c in o1.call_sites], ["printf", "printf", "printf"])
        self.assertFalse(any(a.root == "param0" for a in o1.accesses))


class InferenceTests(unittest.TestCase):
    def test_every_build_recovers_all_five_members_and_the_size(self) -> None:
        truth = main.account_truth()
        for build in main.ACCOUNT_BUILDS:
            report = main.analyze_build(build)
            comparison = report["comparison"]
            self.assertEqual((comparison["matches"], comparison["members"]), (5, 5), build)
            self.assertEqual(comparison["size"], {"inferred": 32, "lowerBound": 32, "truth": 32, "status": "match"}, build)
            self.assertEqual(report["layout"]["stride"], 32, build)
            self.assertEqual(report["layout"]["gaps"], truth.padding(), build)
            self.assertTrue(report["layout"]["naturalAlignment"], build)
            self.assertEqual(report["layout"]["conflicts"], [], build)

    def test_kinds_and_signs_come_from_the_instructions(self) -> None:
        o0 = {f["offset"]: f for f in main.analyze_build("O0")["layout"]["fields"]}
        self.assertEqual([o0[o]["label"] for o in (0, 4, 8, 16, 24)], ["i8", "i32", "i16", "float64", "pointer"])
        self.assertEqual(o0[24]["pointerProof"][0]["address"], 0xFB)
        o1 = {f["offset"]: f for f in main.analyze_build("O1")["layout"]["fields"]}
        self.assertEqual(o1[0]["label"], "int8")
        self.assertEqual(o1[0]["sign"], None)
        self.assertEqual(len(o1[24]["pointerProof"]), 2)

    def test_evidence_grows_one_function_at_a_time(self) -> None:
        counts = []
        statuses = []
        for step in range(1, len(main.EVIDENCE_ORDER) + 1):
            report = main.analyze_build("O0", main.EVIDENCE_ORDER[:step])
            counts.append(len(report["layout"]["fields"]))
            statuses.append(report["comparison"]["size"]["status"])
        self.assertEqual(counts, [1, 1, 3, 4, 5, 5])
        self.assertEqual(statuses, ["unknown", "match", "match", "match", "match", "match"])
        first = main.analyze_build("O0", ["bump"])
        self.assertEqual([r["status"] for r in first["comparison"]["rows"]], ["no-evidence", "match", "no-evidence", "no-evidence", "no-evidence"])
        self.assertEqual(first["comparison"]["size"]["lowerBound"], 8)

    def test_without_folding_the_vectorised_loop_fakes_seven_fields(self) -> None:
        raw = main.analyze_build("O2", fold=False)
        unexpected = [r for r in raw["comparison"]["rows"] if r["status"] == "unexpected"]
        self.assertEqual([r["offset"] for r in unexpected], [36, 68, 100, 132, 164, 196, 228])
        self.assertEqual(raw["comparison"]["size"], {"inferred": None, "lowerBound": 232, "truth": 32, "status": "unknown"})
        self.assertEqual(raw["layout"]["stride"], 32)
        folded = main.analyze_build("O2")
        self.assertEqual([e["kind"] for e in folded["layout"]["strideEvidence"]], ["offset-delta", "unrolled", "loop-step", "scale", "loop-step"])
        self.assertEqual([e["value"] for e in folded["layout"]["strideEvidence"]], [32, 32, 256, 32, 32])

    def test_call_sites_alias_the_witnesses_at_o0_and_vanish_when_inlined(self) -> None:
        o0 = main.analyze_build("O0")["layout"]
        self.assertEqual(sorted(o0["aliases"].values()), [0, 0x20, 0x20, 0x20, 0x40])
        self.assertEqual([(e["kind"], e["value"]) for e in o0["strideEvidence"]], [("scale", 32), ("call-site", 32), ("call-site", 64)])
        o1 = main.analyze_build("O1")["layout"]
        self.assertEqual(o1["aliases"], {})
        self.assertEqual([(e["kind"], e["value"]) for e in o1["strideEvidence"]], [("loop-step", 32)])


class CxxTests(unittest.TestCase):
    def setUp(self) -> None:
        self.elf = main.load_object("shapes-x86_64-O0-g.o")

    def test_demangler_agrees_with_llvm_cxxfilt_on_every_fixture_symbol(self) -> None:
        mangled = (FIXTURES / "shapes-x86_64-O0-g.mangled.txt").read_text().split()
        expected = (FIXTURES / "shapes-x86_64-O0-g.cxxfilt.txt").read_text().splitlines()
        self.assertEqual(len(mangled), 19)
        self.assertEqual([main.demangle(n) for n in mangled], expected)
        with self.assertRaises(main.DemangleError):
            main.demangle("bump")

    def test_vtables_follow_the_itanium_layout(self) -> None:
        rect = main.read_vtable(self.elf, "_ZTV4Rect")
        self.assertEqual((rect.offset_to_top, rect.typeinfo, rect.address_point), (0, "_ZTI4Rect", 16))
        self.assertEqual([f[1] for f in rect.functions], ["_ZN4RectD2Ev", "_ZN4RectD0Ev", "_ZNK4Rect4areaEv", "_ZNK4Rect4nameEv"])
        self.assertEqual(self.elf.symbol("_ZTV4Rect").size, 0x30)
        shape = main.read_vtable(self.elf, "_ZTV5Shape")
        self.assertEqual(shape.functions[2], (2, "__cxa_pure_virtual", "__cxa_pure_virtual"))
        self.assertEqual(shape.functions[3][2], "Shape::name() const")

    def test_typeinfo_records_the_class_hierarchy(self) -> None:
        rect = main.read_typeinfo(self.elf, "_ZTI4Rect")
        self.assertEqual((rect.kind, rect.name_string, rect.base), ("__si_class_type_info", "4Rect", "_ZTI5Shape"))
        shape = main.read_typeinfo(self.elf, "_ZTI5Shape")
        self.assertEqual((shape.kind, shape.name_string, shape.base), ("__class_type_info", "5Shape", None))

    def test_the_virtual_call_in_describe_uses_slot_2_and_dwarf_names_it_area(self) -> None:
        listing = main.load_listing("shapes-x86_64-O0-g.objdump.txt")
        vtables = [main.read_vtable(self.elf, n) for n in ("_ZTV5Shape", "_ZTV4Rect")]
        calls = main.find_virtual_calls(listing, vtables)
        self.assertEqual(len(calls), 1)
        self.assertEqual((calls[0].function, calls[0].address, calls[0].slot), ("_Z8describeRK5Shapei", 0x16, 2))
        self.assertEqual(calls[0].candidates, {"Shape": "__cxa_pure_virtual", "Rect": "_ZNK4Rect4areaEv"})
        dwarf = main.DwarfInfo(self.elf)
        slots = {s.name: {v.name: v.slot for v in s.virtual_methods} for s in dwarf.struct_layouts()}
        self.assertEqual(slots["Rect"], {"area": 2, "name": 3, "~Rect": 0})
        self.assertEqual(slots["Shape"], {"~Shape": 0, "area": 2, "name": 3})
        self.assertEqual(next(v.virtuality for v in dwarf.struct("Shape").virtual_methods if v.name == "area"), "pure_virtual")

    def test_dwarf_describes_rect_as_shape_plus_two_ints(self) -> None:
        dwarf = main.DwarfInfo(self.elf)
        rect = dwarf.struct("Rect")
        self.assertEqual((rect.size, rect.bases), (16, (("Shape", 0),)))
        self.assertEqual([(m.name, m.offset, m.type) for m in rect.members], [("w", 8, "int"), ("h", 12, "int")])
        shape = dwarf.struct("Shape")
        self.assertEqual((shape.size, [(m.name, m.offset, m.type) for m in shape.members]), (8, [("_vptr$Shape", 0, "int (**)()")]))
        describe = next(f for f in dwarf.functions() if f.name == "describe")
        self.assertEqual([p.type for p in describe.parameters], ["const Shape &", "int"])

    def test_the_optimised_object_keeps_the_call_pattern_but_drops_the_vtables(self) -> None:
        report = main.cxx_report()
        self.assertFalse(report["optimizedObjectHasVtable"])
        self.assertIn("movq (%rdi), %rax", report["optimizedDescribe"])
        self.assertIn("callq *0x10(%rax)", report["optimizedDescribe"])
        self.assertEqual(report["virtualCalls"][0]["slot"], 2)


class ToolCaptureTests(unittest.TestCase):
    def test_ghidra_names_the_struct_with_dwarf_and_prints_raw_offsets_without_it(self) -> None:
        with_dwarf = tool_text("ghidra-account-dwarf.txt")
        without = tool_text("ghidra-account-nodwarf.txt")
        if with_dwarf is None or without is None:
            self.skipTest("Ghidra captures not present")
        self.assertIn("STRUCT /DWARF/account.c/account size=32 align=8", with_dwarf)
        self.assertIn("  +4 int balance", with_dwarf)
        self.assertIn("a->balance = by + a->balance;", with_dwarf)
        self.assertIn("list[i].balance", with_dwarf)
        self.assertNotIn("/DWARF/", without)
        self.assertIn("*(int *)(param_1 + 4)", without)
        self.assertIn("lVar2 = lVar2 + 0x20;", without)
        self.assertIn("*(char **)(param_1 + 0x18)", without)

    def test_rizin_prints_the_struct_from_dwarf_and_radare2_does_not(self) -> None:
        rizin = tool_text("rizin-account.txt")
        rizin_plain = tool_text("rizin-account-nodwarf.txt")
        radare2 = tool_text("radare2-account.txt")
        if rizin is None or rizin_plain is None or radare2 is None:
            self.skipTest("radare2 or rizin captures not present")
        self.assertIn("struct account {", rizin)
        self.assertIn("const char *label;", rizin)
        self.assertNotIn("struct account", rizin_plain)
        self.assertIn("[ts]\n[tsc account]\n[afvd in bump]", radare2)
        self.assertNotIn("struct account", radare2)
        self.assertIn("mov dword [rax + 4], ecx", radare2)


class ReportTests(unittest.TestCase):
    def test_demo_report_has_every_section(self) -> None:
        report = main.demo()
        self.assertEqual(sorted(report), ["builds", "cxx", "dwarf", "oracles", "tools"])
        self.assertEqual(sorted(report["builds"]), ["O0", "O1", "O2"])
        self.assertTrue(report["oracles"]["agree"])
        self.assertEqual(report["dwarf"]["unit"]["version"], 5)

    def test_figure_data_is_derived_from_the_analysis(self) -> None:
        data = main.figure_data()
        self.assertEqual(data["order"], main.EVIDENCE_ORDER)
        self.assertEqual([m["o"] for m in data["truth"]["members"]], [0, 4, 8, 16, 24])
        self.assertEqual([len(s["fields"]) for s in data["builds"]["O0"]["steps"]], [1, 1, 3, 4, 5, 5])
        self.assertEqual(data["builds"]["O0"]["steps"][5]["callSites"][1]["arg"], "frame(rbp-0x70)0x20")
        self.assertIn("raw", data["builds"]["O2"]["steps"][1])
        self.assertNotIn("raw", data["builds"]["O1"]["steps"][1])
        self.assertEqual(data["builds"]["O2"]["steps"][1]["raw"]["lowerBound"], 232)

    def test_site_figure_module_embeds_the_same_data(self) -> None:
        if not SITE_MODULE.exists():
            self.skipTest("site module not present in this checkout")
        source = SITE_MODULE.read_text()
        match = re.search(r"var DATA = (\{.*?\});\n", source, re.S)
        assert match is not None, "figures-re-41.js must define var DATA = {...};"
        embedded = json.loads(match.group(1))
        expected = json.loads(json.dumps(main.figure_data()))
        self.assertEqual(embedded, expected)
        code_only = source.replace(match.group(0), "")
        for forbidden in ("=>", "let ", "const ", "`"):
            self.assertNotIn(forbidden, code_only, f"ES5 only: found {forbidden!r}")


if __name__ == "__main__":
    unittest.main()
