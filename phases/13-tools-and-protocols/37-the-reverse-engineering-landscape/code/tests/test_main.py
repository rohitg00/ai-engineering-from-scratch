import json
import re
import sys
import tempfile
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
SITE_MODULE = Path(__file__).resolve().parents[5] / "site" / "figures-re-37.js"
LEDGER = ("percent_change", "grade", "total", "grade_label")


class ElfTests(unittest.TestCase):
    def test_text_symbols_and_padding_gaps_of_the_o1_object(self) -> None:
        text = main.read_text_symbols(FIXTURES / "ledger-x86_64-O1.o")
        self.assertEqual(text.size, 0x9F)
        self.assertEqual([(s.name, s.start, s.size) for s in text.functions], [("percent_change", 0x0, 16), ("grade", 0x10, 46), ("total", 0x40, 31), ("grade_label", 0x60, 63)])
        self.assertEqual(text.gaps(), [(0x3E, 0x40), (0x5F, 0x60)])
        self.assertEqual(text.owner(0x2C).name, "grade")
        self.assertIsNone(text.owner(0x3E))

    def test_elf_reader_rejects_other_files(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".o") as handle:
            handle.write(b"MZ" + b"\0" * 62)
            handle.flush()
            with self.assertRaises(main.ElfError):
                main.read_text_symbols(Path(handle.name))


class ParserTests(unittest.TestCase):
    def test_objdump_parse_counts_every_instruction_and_label(self) -> None:
        counts = {}
        for name in main.FIXTURE_OBJECTS:
            view = main.load_view("llvm-objdump", name)
            assert view is not None
            counts[name] = (len(view.instructions), len(view.functions))
            self.assertIsNone(view.functions[next(iter(view.functions))].blocks)
        self.assertEqual(counts, {"ledger-x86_64-O0.o": (86, 4), "ledger-x86_64-O1.o": (56, 4), "ledger-x86_64-O2.o": (84, 4), "sweep-trap.o": (11, 2)})

    def test_radare2_view_is_normalised_to_text_offsets(self) -> None:
        view = main.load_view("radare2", "ledger-x86_64-O1.o")
        assert view is not None
        self.assertEqual(view.base, 0x8000040)
        self.assertTrue(view.version.startswith("radare2 6.2.4"))
        grade = view.functions["grade"]
        self.assertEqual((grade.start, grade.size, grade.from_symbol), (0x10, 46, True))
        self.assertEqual([b.start for b in grade.blocks], [0x10, 0x31, 0x3D])
        self.assertEqual(grade.edges, {(0x10, 0x31), (0x10, 0x3D), (0x31, 0x3D)})
        self.assertIn("0x66666667", grade.decompiled)

    def test_rizin_view_matches_radare2_on_the_o1_object(self) -> None:
        r2 = main.load_view("radare2", "ledger-x86_64-O1.o")
        rz = main.load_view("rizin", "ledger-x86_64-O1.o")
        assert r2 is not None and rz is not None
        self.assertTrue(rz.version.startswith("rizin 0.9.1"))
        self.assertEqual(r2.instructions, rz.instructions)
        for name in LEDGER:
            self.assertEqual([(b.start, b.size, b.instructions) for b in r2.functions[name].blocks], [(b.start, b.size, b.instructions) for b in rz.functions[name].blocks], name)
            self.assertEqual(r2.functions[name].edges, rz.functions[name].edges, name)
        self.assertIsNone(rz.functions["grade"].decompiled)

    def test_angr_view_marks_functions_without_a_symbol_as_invented(self) -> None:
        view = main.load_view("angr", "ledger-x86_64-O1.o")
        assert view is not None
        self.assertEqual((view.base, view.version), (0x400000, "10.0.3"))
        self.assertEqual(sorted(name for name, f in view.functions.items() if not f.from_symbol), ["sub_40003e", "sub_40005f"])
        self.assertEqual((view.functions["sub_40003e"].start, view.functions["sub_40003e"].size), (0x3E, 2))
        self.assertEqual(view.functions["total"].edges, {(0x40, 0x44), (0x40, 0x5C), (0x44, 0x50), (0x50, 0x50), (0x50, 0x5B)})

    def test_ghidra_view_reads_blocks_and_keeps_only_jump_and_fallthrough_flows(self) -> None:
        view = main.load_view("ghidra", "ledger-x86_64-O1.o")
        assert view is not None
        self.assertEqual((view.base, view.version), (0x100000, "12.1.4"))
        total = view.functions["total"]
        self.assertEqual([(b.start, b.size, b.instructions) for b in sorted(total.blocks, key=lambda b: b.start)], [(0x40, 4, 2), (0x44, 12, 4), (0x50, 11, 4), (0x5B, 1, 1), (0x5C, 3, 2)])
        self.assertEqual(total.edges, {(0x40, 0x44), (0x40, 0x5C), (0x44, 0x50), (0x50, 0x50), (0x50, 0x5B)})
        o0 = main.load_view("ghidra", "ledger-x86_64-O0.o")
        assert o0 is not None
        self.assertEqual(o0.functions["grade_label"].edges, set())
        self.assertIn("param_1 / 10 - 6", view.functions["grade"].decompiled)

    def test_every_tool_places_grade_at_offset_0x10_from_its_own_base(self) -> None:
        views = main.load_views("ledger-x86_64-O1.o")
        self.assertEqual(sorted(views), sorted(main.TOOLS))
        self.assertEqual({tool: view.base for tool, view in views.items()}, {"llvm-objdump": 0x0, "radare2": 0x8000040, "rizin": 0x8000040, "angr": 0x400000, "ghidra": 0x100000})
        for tool, view in views.items():
            self.assertEqual(view.functions["grade"].start, 0x10, tool)


class ComparisonTests(unittest.TestCase):
    def test_o1_every_tool_agrees_on_every_instruction_start(self) -> None:
        report = main.compare("ledger-x86_64-O1.o")
        for name in LEDGER:
            starts = report["functions"][name]["instructionStarts"]
            self.assertTrue(starts["allDescentToolsAgree"], name)
            self.assertEqual(starts["differences"], {}, name)
            self.assertEqual(len(set(starts["perTool"].values())), 1, name)
        self.assertEqual([report["functions"][n]["instructionStarts"]["agreed"] for n in LEDGER], [9, 14, 13, 18])

    def test_o1_blocks_and_edges_agree_three_three_five_four(self) -> None:
        report = main.compare("ledger-x86_64-O1.o")
        for tool in main.DESCENT_TOOLS:
            self.assertEqual([report["functions"][n]["blocks"][tool] for n in LEDGER], [3, 3, 5, 4], tool)
            self.assertEqual([report["functions"][n]["edges"][tool] for n in LEDGER], [2, 3, 5, 4], tool)
        for name in LEDGER:
            self.assertTrue(report["functions"][name]["blocksAgree"], name)
            self.assertTrue(report["functions"][name]["edgesAgree"], name)

    def test_o2_vectorised_total_has_ten_blocks_and_thirteen_edges_in_every_tool(self) -> None:
        report = main.compare("ledger-x86_64-O2.o")
        total = report["functions"]["total"]
        self.assertEqual(set(total["blocks"].values()), {10})
        self.assertEqual(set(total["edges"].values()), {13})
        self.assertTrue(total["instructionStarts"]["allDescentToolsAgree"])
        self.assertEqual(total["instructionStarts"]["agreed"], 41)

    def test_o0_jump_table_in_grade_splits_the_four_graph_builders(self) -> None:
        report = main.compare("ledger-x86_64-O0.o")
        grade = report["functions"]["grade"]
        self.assertEqual(grade["blocks"], {"radare2": 3, "rizin": 8, "angr": 8, "ghidra": 9})
        self.assertEqual(grade["edges"], {"radare2": 2, "rizin": 11, "angr": 7, "ghidra": 12})
        self.assertFalse(grade["instructionStarts"]["allDescentToolsAgree"])
        self.assertEqual(sorted(grade["instructionStarts"]["differences"]), ["radare2"])
        self.assertEqual(grade["instructionStarts"]["differences"]["radare2"]["missing"], ["0x76", "0x7d", "0x7f", "0x86", "0x88", "0x8f", "0x91", "0x98"])
        self.assertEqual(report["bytes"]["radare2"]["misses"], ["0x76-0x9a"])
        self.assertIn("grade: jump table resolved as switch_op with 5 cases", report["notes"]["rizin"])
        self.assertEqual(sorted(n for n in report["notes"]["ghidra"] if "computed jump" in n), sorted(f"grade: computed jump at block 0x74 resolved to {t}" for t in ("0x76", "0x7f", "0x88", "0x91")))
        self.assertIn("grade: transfer at 0x62 leads to an unresolvable target node", report["notes"]["angr"])
        self.assertEqual(grade["edgesMissingPerTool"]["ghidra"], ["0x62->0x76", "0x62->0x7f", "0x62->0x88", "0x62->0x91"])

    def test_o0_grade_label_is_one_block_except_in_angr_which_ends_a_block_at_a_call(self) -> None:
        report = main.compare("ledger-x86_64-O0.o")
        self.assertEqual(report["functions"]["grade_label"]["blocks"], {"radare2": 1, "rizin": 1, "angr": 2, "ghidra": 1})
        self.assertEqual(set(report["functions"]["grade_label"]["edges"].values()), {0})
        self.assertTrue(report["functions"]["grade_label"]["instructionStarts"]["allDescentToolsAgree"])

    def test_angr_invents_one_function_per_padding_gap_and_nobody_else_does(self) -> None:
        for name in main.FIXTURE_OBJECTS:
            report = main.compare(name)
            self.assertEqual(len(report["functionStarts"]["angr"]["invented"]), len(report["padding"]) + len(report["bytes"]["dataInsideSymbols"]), name)
            for tool in ("llvm-objdump", "radare2", "rizin", "ghidra"):
                self.assertEqual(report["functionStarts"][tool]["invented"], [], f"{name} {tool}")
                self.assertEqual(report["functionStarts"][tool]["missed"], [], f"{name} {tool}")
        o1 = main.compare("ledger-x86_64-O1.o")
        self.assertEqual(o1["functionStarts"]["angr"]["invented"], ["sub_40003e@0x3e", "sub_40005f@0x5f"])
        self.assertEqual(o1["bytes"]["angr"]["paddingBytesClaimed"], 3)
        self.assertEqual(o1["bytes"]["ghidra"]["paddingBytesClaimed"], 0)

    def test_linear_sweep_decodes_the_trap_table_and_has_no_instruction_at_the_jump_target(self) -> None:
        report = main.compare("sweep-trap.o")
        lookup = report["functions"]["lookup"]
        self.assertEqual(lookup["instructionStarts"]["perTool"], {"llvm-objdump": 8, "radare2": 6, "rizin": 6, "angr": 8, "ghidra": 6})
        self.assertEqual(lookup["instructionStarts"]["differences"]["llvm-objdump"], {"extra": ["0x10", "0x12", "0x13"], "missing": ["0x14"]})
        self.assertEqual(lookup["instructionStarts"]["differences"]["angr"], {"extra": ["0x10", "0x12"], "missing": []})
        self.assertEqual(report["bytes"]["llvm-objdump"]["invents"], ["0x10-0x14", "0x18-0x20"])
        self.assertEqual(report["bytes"]["angr"]["invents"], ["0x10-0x13", "0x18-0x20"])

    def test_no_graph_builder_decodes_the_trap_table_bytes(self) -> None:
        report = main.compare("sweep-trap.o")
        self.assertEqual(report["bytes"]["dataInsideSymbols"], ["0x10-0x14"])
        for tool in ("radare2", "rizin", "ghidra"):
            self.assertEqual(report["bytes"][tool]["symbolBytesUnclaimed"], ["0x10-0x14"], tool)
            self.assertEqual(report["bytes"][tool]["invents"], [], tool)
        self.assertEqual(set(report["functions"]["lookup"]["blocks"].values()), {2})
        self.assertEqual(set(report["functions"]["lookup"]["edges"].values()), {1})
        self.assertIn("no graph builder decodes 0x10-0x14; those bytes sit inside a function and are data", report["findings"])

    def test_findings_name_every_invented_or_missed_range(self) -> None:
        report = main.compare("ledger-x86_64-O0.o")
        self.assertIn("radare2 never reaches bytes 0x76-0x9a inside grade that the other graph builders decode", report["findings"])
        self.assertIn("angr invents a function sub_4000a6@0xa6 with no symbol", report["findings"])
        self.assertEqual(sum(1 for line in report["findings"] if line.startswith("llvm-objdump decodes")), 3)
        self.assertEqual(report["padding"], ["0x2e-0x30", "0xa6-0xb0", "0xf2-0x100"])
        self.assertEqual((report["bytes"]["paddingBytes"], report["bytes"]["symbolBytes"]), (26, 269))

    def test_majority_and_range_helpers(self) -> None:
        self.assertEqual(main.majority([{1, 2}, {2, 3}, {2}]), {2})
        self.assertEqual(main.majority([{1}, {2}]), set())
        self.assertEqual(main.ranges({1, 2, 3, 7}), [(1, 4), (7, 8)])
        self.assertEqual(main.hex_ranges({0x10, 0x11, 0x12, 0x13}), ["0x10-0x14"])

    def test_every_capture_names_its_tool_version_and_command(self) -> None:
        manifest = main.load_manifest()
        expected = {"llvm-objdump": "17.0.0", "radare2": "6.2.4", "rizin": "0.9.1", "angr": "10.0.3", "ghidra": "12.1.4"}
        for tool, fragment in expected.items():
            self.assertIn(fragment, manifest["tools"][tool]["version"], tool)
        self.assertEqual(len(manifest["files"]), 21)
        for entry in manifest["files"]:
            self.assertTrue((FIXTURES / entry["file"]).exists(), entry["file"])
            self.assertTrue(entry["command"], entry["file"])
        for name in main.FIXTURE_OBJECTS:
            for tool in main.TOOLS:
                self.assertTrue((FIXTURES / name.replace(".o", main.CAPTURE_SUFFIX[tool])).exists(), f"{name} {tool}")

    def test_three_tools_decompile_grade_and_two_of_them_leave_the_division_idiom(self) -> None:
        views = main.load_views("ledger-x86_64-O1.o")
        self.assertIn("param_1 / 10 - 6", views["ghidra"].functions["grade"].decompiled)
        self.assertIn("a0 * 1717986919", views["angr"].functions["grade"].decompiled)
        self.assertIn("rax = rax * 0x66666667", views["radare2"].functions["grade"].decompiled)
        self.assertIsNone(views["rizin"].functions["grade"].decompiled)
        o0 = main.load_views("ledger-x86_64-O0.o")
        self.assertIn("switch(param_1 / 10)", o0["ghidra"].functions["grade"].decompiled)
        self.assertIn("goto *", o0["angr"].functions["grade"].decompiled)


class TranslatorTests(unittest.TestCase):
    def test_sub_rsp_gets_eager_flags_in_one_style_and_a_thunk_in_the_other(self) -> None:
        result = main.translate("48 83 ec 10")
        self.assertEqual(result["text"], "subq $0x10, %rsp")
        self.assertEqual(result["flags"], {"pcodeLike": "eager", "vexLike": "thunk"})
        self.assertEqual([line.split(" ")[0] for line in result["pcodeLike"]], ["CF", "OF", "RSP", "SF", "ZF", "PF"])
        self.assertIn("PUT(cc_op) = 0x8", result["vexLike"])
        self.assertIn("PUT(rsp) = t1", result["vexLike"])
        self.assertFalse(any(flag in line for line in result["vexLike"] for flag in ("CF", "ZF", "SF", "OF", "PF")))

    def test_cmp_writes_flags_but_never_the_register(self) -> None:
        result = main.translate("83 f9 04")
        self.assertEqual(result["text"], "cmpl $0x4, %ecx")
        self.assertIn("tmp = ECX - 0x4", result["pcodeLike"])
        self.assertFalse(any(line.startswith("ECX =") for line in result["pcodeLike"]))
        self.assertIn("PUT(cc_op) = 0x7", result["vexLike"])
        self.assertFalse(any(line.startswith("PUT(ecx)") or line.startswith("PUT(rcx)") for line in result["vexLike"]))

    def test_movsxd_touches_no_flag_in_either_style(self) -> None:
        result = main.translate("48 63 c7")
        self.assertEqual(result["text"], "movslq %edi, %rax")
        self.assertEqual(result["pcodeLike"], ["RAX = sext(EDI)"])
        self.assertEqual(result["vexLike"], ["t0 = GET:I64(rdi)", "t1 = 64to32(t0)", "t2 = 32Sto64(t1)", "PUT(rax) = t2"])
        self.assertEqual(result["flags"], {"pcodeLike": "none", "vexLike": "none"})

    def test_translator_refuses_what_it_does_not_know(self) -> None:
        for code in ("48 83 2c 24 10", "48 01 c8", "4c 83 ec 10", "48 83 ec", "63 c7", "48 83 ec 10 90"):
            with self.assertRaises(main.TranslateError, msg=code):
                main.translate(code)

    def test_translator_cc_op_numbers_match_the_captured_vex(self) -> None:
        observed = {row["name"]: row for row in main.observed_ir()["instructions"]}
        self.assertEqual(observed["sub-rsp-16"]["vex"]["ccOp"], main.VEX_CC_OP_SUB[64])
        self.assertEqual(observed["cmp-ecx-4"]["vex"]["ccOp"], main.VEX_CC_OP_SUB[32])
        self.assertIsNone(observed["movsxd-rax-edi"]["vex"]["ccOp"])
        self.assertEqual(observed["sub-rsp-16"]["vex"]["statements"], main.translate("4883ec10")["statements"]["vexLike"])

    def test_captured_irs_split_into_eager_flag_writers_and_one_thunk(self) -> None:
        observed = {row["name"]: row for row in main.observed_ir()["instructions"]}
        for name in ("sub-rsp-16", "cmp-ecx-4"):
            row = observed[name]
            self.assertTrue(row["esil"]["writesFlags"] and row["rzil"]["writesFlags"] and row["pcode"]["writesFlags"], name)
            self.assertFalse(row["vex"]["computesFlags"], name)
        self.assertEqual([observed[n]["pcode"]["ops"] for n in ("sub-rsp-16", "movsxd-rax-edi", "cmp-ecx-4")], [9, 1, 10])
        self.assertEqual([observed[n]["vex"]["statements"] for n in ("sub-rsp-16", "movsxd-rax-edi", "cmp-ecx-4")], [7, 4, 7])
        self.assertEqual([observed[n]["esil"]["tokens"] for n in ("sub-rsp-16", "movsxd-rax-edi", "cmp-ecx-4")], [30, 5, 30])
        self.assertEqual([observed[n]["rzil"]["sets"] for n in ("sub-rsp-16", "movsxd-rax-edi", "cmp-ecx-4")], [14, 1, 13])
        movsxd = observed["movsxd-rax-edi"]
        self.assertFalse(movsxd["esil"]["writesFlags"] or movsxd["rzil"]["writesFlags"] or movsxd["pcode"]["writesFlags"])


class FigureTests(unittest.TestCase):
    def test_timeline_runs_from_1973_to_2026_in_order(self) -> None:
        data = main.figure_data()
        years = [entry["year"] for entry in data["timeline"]]
        self.assertEqual((years[0], years[-1]), (1973, 2026))
        self.assertEqual(years, sorted(years))
        tools = {tool["id"] for tool in data["tools"]}
        families = {"research", "debugger", "disassembler", "decompiler", "framework", "diffing", "compiler-side"}
        for entry in data["timeline"]:
            self.assertTrue(entry["label"])
            self.assertIn(entry["family"], families)
            self.assertTrue(entry["tool"] is None or entry["tool"] in tools, entry["label"])

    def test_pipeline_has_eight_stages_six_tools_and_a_term_in_every_cell(self) -> None:
        data = main.figure_data()
        self.assertEqual([stage["id"] for stage in data["stages"]], ["loader", "disassembly", "cfg", "lifting", "ssa", "dataflow", "structuring", "emission"])
        self.assertEqual([tool["id"] for tool in data["tools"]], ["ghidra", "binja", "ida", "radare2", "rizin", "angr"])
        for stage in data["stages"]:
            for tool in data["tools"]:
                self.assertTrue(data["terms"][stage["id"]][tool["id"]], f"{stage['id']} {tool['id']}")
        self.assertEqual({tool["id"]: tool["ran"] for tool in data["tools"]}, {"ghidra": True, "binja": False, "ida": False, "radare2": True, "rizin": True, "angr": True})
        for tool in main.DESCENT_TOOLS:
            self.assertEqual(data["evidence"][tool]["o1Blocks"], [3, 3, 5, 4], tool)
        self.assertEqual({tool: data["evidence"][tool]["o0GradeBlocks"] for tool in main.DESCENT_TOOLS}, {"radare2": 3, "rizin": 8, "angr": 8, "ghidra": 9})
        self.assertEqual(data["evidence"]["angr"]["inventedFunctions"], 9)
        self.assertEqual({tool: data["evidence"][tool]["inventedFunctions"] for tool in ("radare2", "rizin", "ghidra")}, {"radare2": 0, "rizin": 0, "ghidra": 0})

    def test_site_figure_module_embeds_the_same_data(self) -> None:
        if not SITE_MODULE.exists():
            self.skipTest("site module not present in this checkout")
        source = SITE_MODULE.read_text()
        match = re.search(r"var DATA = (\{.*?\});\n", source, re.S)
        assert match is not None, "figures-re-37.js must define var DATA = {...};"
        embedded = json.loads(match.group(1))
        expected = json.loads(json.dumps(main.figure_data()))
        self.assertEqual(embedded, expected)
        for forbidden in ("=>", "let ", "const ", "`"):
            self.assertNotIn(forbidden, source, f"ES5 only: found {forbidden!r}")


class ReportTests(unittest.TestCase):
    def test_demo_runs_from_captures_and_reports_which_tools_this_machine_has(self) -> None:
        report = main.demo()
        self.assertEqual(sorted(report["localTools"]), sorted(main.TOOLS))
        self.assertTrue(all(isinstance(where, str) and where for where in report["localTools"].values()))
        self.assertEqual(sorted(report["captureTools"]), sorted(main.TOOLS))
        self.assertEqual(sorted(report["fixtures"]), sorted(main.FIXTURE_OBJECTS))
        self.assertEqual([row["text"] for row in report["ir"]["translator"]], ["subq $0x10, %rsp", "movslq %edi, %rax", "cmpl $0x4, %ecx"])

    def test_closed_tools_are_described_and_marked_as_not_run(self) -> None:
        closed = [tool for tool in main.FIGURE_TOOLS if not tool["ran"]]
        self.assertEqual([tool["label"] for tool in closed], ["Binary Ninja", "IDA / Hex-Rays"])
        for tool in closed:
            self.assertIn("commercial", tool["licence"])
            self.assertTrue(all(main.TERMS[stage["id"]][tool["id"]] for stage in main.STAGES))


if __name__ == "__main__":
    unittest.main()
