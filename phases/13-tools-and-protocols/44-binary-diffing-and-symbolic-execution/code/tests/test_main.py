import json
import re
import struct
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import main

SITE_MODULE = Path(__file__).resolve().parents[5] / "site" / "figures-re-44.js"
O0, O1, O2 = main.LEVELS["O0"], main.LEVELS["O1"], main.LEVELS["O2"]


def records(name, loaded=False):
    return {r.name: r for r in main.fixture_records(name, loaded)}


class ElfAndListingTests(unittest.TestCase):
    def test_symbol_table_gives_four_functions_with_their_sizes(self):
        sizes = {level: [(s.name, s.size) for s in main.load_fixture(name).functions()] for level, name in main.LEVELS.items()}
        self.assertEqual(sizes["O0"], [("percent_change", 46), ("grade", 118), ("total", 66), ("grade_label", 39)])
        self.assertEqual(sizes["O1"], [("percent_change", 16), ("grade", 46), ("total", 31), ("grade_label", 63)])
        self.assertEqual(sizes["O2"], [("percent_change", 16), ("grade", 46), ("total", 140), ("grade_label", 63)])

    def test_text_relocations_describe_like_llvm_objdump(self):
        elf = main.load_fixture(O1)
        described = [(r.offset, r.describe(elf)) for r in elf.relocations[".text"]]
        self.assertEqual(described, [(0x36, "R_X86_64_PC32 .rodata+0x10"), (0x84, "R_X86_64_PC32 .rodata+0x24"), (0x93, "R_X86_64_PC32 .rodata-0x4")])

    def test_listing_instructions_fall_inside_the_symbol_extent_and_match_the_bytes(self):
        counts = {name: len(r.instructions) for name, r in records(O1).items()}
        self.assertEqual(counts, {"percent_change": 9, "grade": 14, "total": 13, "grade_label": 18})
        grade = records(O1)["grade"]
        self.assertEqual(grade.mnemonics, ["movslq", "imulq", "movq", "sarq", "shrq", "addl", "addl", "xorl", "cmpl", "ja", "movl", "leaq", "movl", "retq"])
        self.assertEqual(b"".join(i.raw for i in grade.instructions), grade.raw)

    def test_a_listing_whose_bytes_differ_from_the_object_is_rejected(self):
        elf = main.load_fixture(O1)
        listing = main.fixture_listing(O1)
        first = listing["grade"][0]
        listing["grade"][0] = main.Instruction(first.address, bytes([first.raw[0] ^ 1]) + first.raw[1:], first.mnemonic, first.operands)
        with self.assertRaises(main.ElfError):
            main.function_record(elf, listing, "grade")


class ControlFlowShapeTests(unittest.TestCase):
    def test_total_at_o1_has_five_blocks_five_edges_and_one_self_loop(self):
        total = records(O1)["total"]
        self.assertEqual([b.start for b in total.blocks], [0x40, 0x44, 0x50, 0x5B, 0x5C])
        self.assertEqual(len(total.edges), 5)
        self.assertIn(main.Edge(0x50, 0x50, "taken"), total.edges)
        self.assertEqual(total.cfg_shape(), "5b 5e [0/2,1/0,1/0,1/1,2/2]")

    def test_grade_at_o0_recovers_the_jump_table_from_rela_rodata(self):
        grade = records(O0)["grade"]
        self.assertEqual(grade.table_targets, [0x91, 0x88, 0x7F, 0x76, 0x76])
        self.assertEqual(len(grade.blocks), 8)
        self.assertEqual(len(grade.edges), 11)
        self.assertEqual(sum(1 for e in grade.edges if e.kind == "table"), 4)

    def test_without_the_table_grade_at_o0_reaches_82_bytes(self):
        grade = main.function_record(main.load_fixture(O0), main.fixture_listing(O0), "grade")
        blocks, edges = main.build_cfg(grade.instructions, grade.start, grade.end, [])
        self.assertEqual([b.start for b in blocks], [0x30, 0x62, 0x9A, 0xA1])
        grade.blocks = blocks
        self.assertEqual(len(grade.reachable_bytes()), 82)
        self.assertEqual(len(edges), 3)

    def test_percent_change_at_o0_and_grade_label_at_o1_share_the_diamond_shape(self):
        self.assertEqual(records(O0)["percent_change"].cfg_shape(), records(O1)["grade_label"].cfg_shape())
        self.assertEqual(records(O0)["percent_change"].cfg_shape(), "4b 4e [0/2,1/1,1/1,2/0]")


class SignatureTests(unittest.TestCase):
    def test_masked_hash_equals_exact_hash_on_a_relocatable_object(self):
        for record in records(O1).values():
            signatures = record.signatures()
            self.assertEqual(signatures["exact-bytes"], signatures["masked-bytes"], record.name)

    def test_o1_and_o2_share_bytes_for_three_functions_and_not_for_total(self):
        left, right = records(O1), records(O2)
        for name in ("percent_change", "grade", "grade_label"):
            self.assertEqual(left[name].raw, right[name].raw, name)
        self.assertNotEqual(left["total"].raw, right["total"].raw)
        self.assertEqual((left["total"].size, right["total"].size), (31, 140))

    def test_o0_and_o1_share_no_byte_or_mnemonic_signature(self):
        left, right = records(O0), records(O1)
        for name in left:
            for stage in ("exact-bytes", "masked-bytes", "mnemonics"):
                self.assertNotEqual(left[name].signatures()[stage], right[name].signatures()[stage], f"{name} {stage}")

    def test_referenced_table_reads_five_entries_through_the_lea_relocation(self):
        self.assertEqual(struct.unpack("<5i", records(O1)["grade"].referenced_data), (1, 2, 3, 4, 4))
        self.assertEqual(struct.unpack("<5i", records("grade_case10_wrong.o")["grade"].referenced_data), (1, 2, 3, 4, 3))
        self.assertIsNone(records(O1)["percent_change"].referenced_data)


class LoaderTests(unittest.TestCase):
    def test_loader_places_sections_where_ghidra_places_them(self):
        ghidra = main.ghidra_fixture("ghidra-vt-O1-vs-O2.txt")
        if not ghidra["blocks"]:
            self.skipTest("Ghidra capture missing")
        for level, role in ((O1, "source"), (O2, "destination")):
            image = main.load_image(main.load_fixture(level))
            for section in (".text", ".rodata", ".rodata.str1.1"):
                self.assertEqual(image.addresses[section], ghidra["blocks"][role][section]["start"], f"{level} {section}")
        o0 = main.load_image(main.load_fixture(O0))
        self.assertEqual((o0.addresses[".rodata"], o0.addresses[".data"], o0.addresses[".rodata.str1.1"]), (0x100128, 0x100140, 0x100168))

    def test_pc32_is_written_as_s_plus_a_minus_p(self):
        image = main.load_image(main.load_fixture(O1))
        displacement = struct.unpack_from("<i", image.data[".text"], 0x36)[0]
        table = image.addresses[".rodata"] + 0x14
        end_of_lea = image.addresses[".text"] + 0x3A
        self.assertEqual(displacement, table - end_of_lea)
        self.assertEqual(displacement, 122)

    def test_grade_bytes_agree_in_the_objects_and_differ_by_the_rodata_shift_in_the_images(self):
        case = main.grade_relocation_case()
        self.assertTrue(case["objectBytesEqual"])
        self.assertFalse(case["imageBytesEqual"])
        self.assertTrue(case["maskedImageBytesEqual"])
        self.assertEqual(case["rodataShift"], 0x70)
        self.assertEqual(case["displacements"], {O1: 122, O2: 234})
        self.assertEqual(case["fieldOffset"], 0x36)

    def test_r_x86_64_64_entries_in_data_receive_string_addresses(self):
        image = main.load_image(main.load_fixture(O0))
        first = struct.unpack_from("<Q", image.data[".data"], 0)[0]
        third = struct.unpack_from("<Q", image.data[".data"], 16)[0]
        self.assertEqual(first, image.addresses[".rodata.str1.1"])
        self.assertEqual(third, image.addresses[".rodata.str1.1"] + 4)

    def test_relocations_to_undefined_and_absolute_symbols_are_left_unpatched(self):
        elf = main.load_fixture(O1)
        undefined = main.Symbol("external_call", 0, 0, 0, 1, 0)
        absolute = main.Symbol("absolute_value", 0x1234, 0, 0, 1, 0xFFF1)
        elf.relocations.setdefault(".text", []).extend(
            [
                main.Relocation(0, main.R_X86_64_PLT32, undefined, -4, ".text"),
                main.Relocation(4, main.R_X86_64_64, absolute, 0, ".text"),
            ]
        )
        image = main.load_image(elf)
        self.assertIsNone(image.address_of(undefined))
        self.assertIsNone(image.address_of(absolute))
        self.assertEqual(bytes(image.data[".text"][0:12]), elf.section(".text").data[0:12])
        self.assertEqual(struct.unpack_from("<i", image.data[".text"], 0x36)[0], 122)


class MatcherTests(unittest.TestCase):
    def test_o1_vs_o2_matches_three_functions_on_exact_bytes_and_total_on_its_name(self):
        report = main.diff_fixtures(O1, O2)
        stages = {m.left.name: m.stage for m in report.matches}
        self.assertEqual(stages, {"percent_change": "exact-bytes", "grade": "exact-bytes", "grade_label": "exact-bytes", "total": "name"})
        self.assertEqual(report.by_name("grade").agreeing, ["exact-bytes", "masked-bytes", "mnemonics", "cfg-shape", "name"])
        self.assertEqual((report.unmatched_left, report.unmatched_right), ([], []))

    def test_loaded_images_match_grade_only_after_masking(self):
        report = main.diff_fixtures(O1, O2, loaded=True)
        grade = report.by_name("grade")
        self.assertEqual(grade.stage, "masked-bytes")
        self.assertNotIn("exact-bytes", grade.agreeing)
        self.assertEqual(report.stage_of("percent_change"), "exact-bytes")
        self.assertEqual(report.stage_of("grade_label"), "exact-bytes")
        self.assertAlmostEqual(grade.similarity, 1 - 1 / 46, places=6)

    def test_structural_stages_first_produce_one_false_match_on_o0_vs_o1(self):
        report = main.diff_fixtures(O0, O1)
        false_match = report.by_name("percent_change")
        self.assertEqual((false_match.right.name, false_match.stage, false_match.quality), ("grade_label", "cfg-shape", "medium"))
        self.assertFalse(false_match.names_agree)
        self.assertEqual([f.name for f in report.unmatched_left], ["grade_label"])
        self.assertEqual([f.name for f in report.unmatched_right], ["percent_change"])

    def test_bindiff_order_matches_all_four_o0_vs_o1_functions_by_name(self):
        report = main.diff_fixtures(O0, O1, stages=main.BINDIFF_ORDER)
        self.assertEqual({m.left.name: (m.right.name, m.stage) for m in report.matches}, {name: (name, "name") for name in ("percent_change", "grade", "total", "grade_label")})
        self.assertTrue(all(m.names_agree for m in report.matches))

    def test_patch_candidate_matches_on_bytes_and_fails_on_the_referenced_table(self):
        report = main.diff_fixtures(O1, "grade_case10_wrong.o")
        grade = report.by_name("grade")
        self.assertEqual(grade.stage, "exact-bytes")
        self.assertIs(grade.data_equal, False)
        self.assertEqual([f.name for f in report.unmatched_left], ["percent_change", "total", "grade_label"])

    def test_levenshtein_ratio_reproduces_the_radiff2_numbers(self):
        ratios = main.radare2_ratio_check()
        self.assertEqual(ratios["percent_change O0 vs O1"], 0.130435)
        self.assertEqual(ratios["total O0 vs O1"], 0.106061)
        self.assertEqual(ratios["grade_label O0 vs O1"], 0.269841)
        self.assertEqual(ratios["total O1 vs O2"], 0.171429)
        self.assertEqual(ratios["grade O0 vs O1, 82 reachable bytes without the table"], 0.426829)
        self.assertEqual(ratios["fingerprintBytesWithoutTable"], 82)
        self.assertEqual(main.levenshtein(b"kitten", b"sitting"), 3)

    def test_relocated_bytes_give_the_ratio_radiff2_reports_with_relocations_applied(self):
        rows = {r["left"]: r for r in main.radiff2_fixture("radiff2-AC-relocs-O0-vs-O1.txt")}
        if not rows:
            self.skipTest("radiff2 capture missing")
        left, right = records(O0, loaded=True), records(O1, loaded=True)
        self.assertEqual(round(main.radare2_ratio(left["grade"].raw, right["grade"].raw), 6), rows["grade"]["ratio"])
        self.assertEqual(round(main.radare2_ratio(left["grade_label"].raw, right["grade_label"].raw), 6), rows["grade_label"]["ratio"])


class ToolAgreementTests(unittest.TestCase):
    def test_radiff2_verdicts_agree_with_the_exact_bytes_stage(self):
        rows = {r["left"]: r for r in main.radiff2_fixture("radiff2-AC-O1-vs-O2.txt")}
        if not rows:
            self.skipTest("radiff2 capture missing")
        report = main.diff_fixtures(O1, O2)
        for name, row in rows.items():
            mine = report.stage_of(name) == "exact-bytes"
            self.assertEqual(row["verdict"] == "MATCH", mine, name)
        self.assertEqual(rows["total"]["ratio"], round(report.by_name("total").similarity, 6))
        o0_rows = main.radiff2_fixture("radiff2-AC-O0-vs-O1.txt")
        self.assertEqual({r["verdict"] for r in o0_rows}, {"UNMATCH"})
        self.assertEqual([r["ratio"] for r in o0_rows], [0.130435, 0.426829, 0.106061, 0.269841])

    def test_ghidra_byte_and_instruction_correlators_equal_the_loaded_image_stages(self):
        ghidra = main.ghidra_fixture("ghidra-vt-O1-vs-O2.txt")
        if not ghidra["matches"]:
            self.skipTest("Ghidra capture missing")
        report = main.diff_fixtures(O1, O2, loaded=True)
        exact = sorted(m.left.name for m in report.matches if "exact-bytes" in m.agreeing)
        masked = sorted(m.left.name for m in report.matches if "masked-bytes" in m.agreeing)
        self.assertEqual(main.ghidra_functions_matched(ghidra, "Exact Function Bytes Match"), exact)
        self.assertEqual(main.ghidra_functions_matched(ghidra, "Exact Function Instructions Match"), masked)
        self.assertEqual(main.ghidra_functions_matched(ghidra, "Exact Function Mnemonics Match"), ["grade", "grade_label", "percent_change"])
        self.assertEqual(ghidra["correlators"]["Exact Symbol Name Match"], 9)

    def test_ghidra_o0_vs_o1_finds_only_names(self):
        ghidra = main.ghidra_fixture("ghidra-vt-O0-vs-O1.txt")
        if not ghidra["matches"]:
            self.skipTest("Ghidra capture missing")
        self.assertEqual(ghidra["correlators"], {"Exact Symbol Name Match": 4, "Exact Data Match": 0, "Exact Function Bytes Match": 0, "Exact Function Instructions Match": 0, "Exact Function Mnemonics Match": 0, "Duplicate Function Instructions Match": 0})
        self.assertEqual(ghidra["functions"]["source"]["grade"], {"entry": 0x100030, "size": 118})
        self.assertTrue(all(m["similarity"] == 1.0 and m["confidence"] == 10.0 for m in ghidra["matches"]))


class SymbolicExecutionTests(unittest.TestCase):
    def test_hand_lifted_ir_covers_every_listed_instruction_once(self):
        for function in (main.grade_ir_o0(), main.grade_ir_o1(), main.percent_change_ir_o1(), main.total_ir_o1(main.TOTAL_VALUES)):
            self.assertEqual(main.check_ir_against_listing(function), [], function.name)

    def test_evaluator_follows_c_semantics(self):
        self.assertEqual(main.c_divide(-7, 2), -3)
        self.assertEqual(main.c_divide(7, -2), -3)
        self.assertEqual(main.to_signed(0x80000000, 32), -2147483648)
        self.assertEqual(main.evaluate(main.Bin(">>u", main.Const(-1), main.Const(31)), {}, {}), 1)
        self.assertEqual(main.evaluate(main.Bin(">u", main.Const(-1), main.Const(4)), {}, {}), 1)
        self.assertEqual(main.evaluate(main.Bin("*", main.Const(2147483647), main.Const(100)), {}, {}), main.to_signed(2147483647 * 100, 32))
        with self.assertRaises(ZeroDivisionError):
            main.evaluate(main.Bin("/", main.Const(1), main.Const(0)), {}, {})

    def test_grade_at_o0_has_five_paths_with_the_switch_conditions(self):
        report = main.grade_paths("O0")
        self.assertEqual(report["pathCount"], 5)
        conditions = {p["returns"]: p["condition"] for p in report["paths"]}
        self.assertEqual(conditions["0"], "score / 10 - 6 >u 4")
        self.assertEqual(conditions["4"], "!(score / 10 - 6 >u 4) && (score / 10 - 6 == 3 || score / 10 - 6 == 4)")
        self.assertEqual(conditions["1"], "!(score / 10 - 6 >u 4) && score / 10 - 6 == 0")

    def test_grade_at_o1_has_two_paths_and_the_same_return_classes(self):
        report = main.grade_paths("O1")
        self.assertEqual(report["pathCount"], 2)
        self.assertEqual({p["returns"] for p in report["paths"]}, {"0", "lookup_14[score / 10 - 6]"})
        o0 = main.grade_paths("O0")["returns"]
        for value in "1234":
            self.assertEqual((report["returns"][value][0]["min"], report["returns"][value][0]["max"]), (o0[value][0]["min"], o0[value][0]["max"]))

    def test_bounded_search_classes_agree_with_angr_and_z3(self):
        angr = main.angr_fixture()
        z3 = main.z3_fixture()
        if not angr or not z3:
            self.skipTest("solver captures missing")
        mine = main.grade_paths("O0")["returns"]
        expected = {"1": (60, 69), "2": (70, 79), "3": (80, 89), "4": (90, 109)}
        for value, (low, high) in expected.items():
            self.assertEqual((mine[value][0]["min"], mine[value][0]["max"]), (low, high))
            for level in main.LEVELS.values():
                hit = angr["objects"][level]["grade"]["returns"][value][0]
                self.assertEqual((hit["min"], hit["max"]), (low, high), f"angr {level} {value}")
            self.assertEqual((z3["grade"]["returns"][value]["min"], z3["grade"]["returns"][value]["max"]), (low, high))
        self.assertEqual(angr["objects"][O0]["grade"]["deadended"], 5)
        self.assertEqual(angr["objects"][O1]["grade"]["deadended"], 2)
        self.assertEqual((angr["objects"][O0]["grade"]["explore"]["min"], angr["objects"][O0]["grade"]["explore"]["max"]), (90, 109))

    def test_cross_checks_have_no_model_in_the_bound_or_in_the_solvers(self):
        function = main.grade_ir_o0()
        solver = main.BoundedSearch({"score": main.SCORE_DOMAIN})
        paths = main.execute(function, solver)
        score = main.Var("score")
        for path in paths:
            if path.status != "returned":
                continue
            inside_zero = path.condition + [main.Bin(">=", score, main.Const(60)), main.Bin("<=", score, main.Const(109)), main.Bin("==", path.returned, main.Const(0))]
            above_nonzero = path.condition + [main.Bin(">=", score, main.Const(110)), main.Bin("!=", path.returned, main.Const(0))]
            self.assertFalse(solver.satisfiable(inside_zero))
            self.assertFalse(solver.satisfiable(above_nonzero))
        angr, z3 = main.angr_fixture(), main.z3_fixture()
        if angr and z3:
            self.assertEqual(angr["objects"][O0]["grade"]["crossChecks"], {"scoreIn60to109ReturnsZero": "unsat", "scoreAtLeast110ReturnsNonZero": "unsat"})
            self.assertEqual(z3["grade"]["crossChecks"], {"scoreIn60to109ReturnsZero": "unsat", "scoreAtLeast110ReturnsNonZero": "unsat"})
            self.assertEqual(z3["grade"]["listingDiffersFromSourceSwitch"]["verdict"], "unsat")
            self.assertEqual(z3["grade"]["listingDiffersFromThresholdsOn0to109"], "unsat")

    def test_every_solver_model_for_percent_change_evaluates_to_the_requested_value(self):
        report = main.percent_change_paths()
        self.assertEqual(report["pathCount"], 2)
        expression = main.Bin("/", main.Bin("*", main.Bin("-", main.Var("after"), main.Var("before")), main.Const(100)), main.Var("before"))
        models = [(report["returns50"], 50), (report["before3ReturnsMinus133"], -133)]
        angr, z3 = main.angr_fixture(), main.z3_fixture()
        if angr and z3:
            for level in main.LEVELS.values():
                for path in angr["objects"][level]["percent_change"]["paths"]:
                    if path["returns50"]:
                        models.append((path["returns50"], 50))
                        models.append(({"before": 3, "after": path["before3ReturnsMinus133"]}, -133))
            models.append(({"before": z3["percent_change"]["returns50"]["before"], "after": z3["percent_change"]["returns50"]["after"]}, 50))
            models.append(({"before": 3, "after": z3["percent_change"]["before3ReturnsMinus133"]["after"]}, -133))
        for model, value in models:
            self.assertEqual(main.evaluate(expression, model, {}), value, model)

    def test_total_paths_grow_one_per_iteration_bound(self):
        runs = main.explosion_report()
        self.assertEqual([(r["bound"], r["pathCount"], r["truncated"]) for r in runs["bounded"]], [(2, 3, 0), (4, 5, 0), (8, 9, 0)])
        self.assertEqual(runs["bounded"][2]["countSum"], [[c, c * (c + 1) // 2] for c in range(9)])
        angr = main.angr_fixture()
        if angr:
            for level in main.LEVELS.values():
                self.assertEqual([(r["bound"], r["deadended"]) for r in angr["objects"][level]["total"]], [(2, 3), (4, 5), (8, 9)])
                self.assertEqual(angr["objects"][level]["total"][2]["countSum"], runs["bounded"][2]["countSum"])

    def test_a_step_cap_truncates_paths_instead_of_running_forever(self):
        capped = main.explosion_report()["capped"]
        self.assertEqual((capped["bound"], capped["returned"], capped["truncated"]), (64, 22, 2))
        self.assertEqual(capped["countSum"][-1], [21, 231])


class ReportTests(unittest.TestCase):
    def test_figure_data_carries_both_views_and_the_path_tree(self):
        data = main.figure_data()
        self.assertEqual([f["name"] for f in data["left"]["functions"]], ["percent_change", "grade", "total", "grade_label"])
        self.assertEqual({m["left"]: m["stage"] for m in data["views"]["object"]["matches"]}["grade"], "exact-bytes")
        self.assertEqual({m["left"]: m["stage"] for m in data["views"]["image"]["matches"]}["grade"], "masked-bytes")
        self.assertEqual(data["relocation"], {"shift": 112, "displacements": {O1: 122, O2: 234}, "field": 54})
        self.assertEqual(data["tree"]["pathCount"], 5)
        self.assertEqual([leaf["returns"] for leaf in data["tree"]["leaves"]], [4, 3, 2, 1, 0])
        self.assertEqual(data["tree"]["leaves"][0]["bounded"], {"count": 20, "min": 90, "max": 109, "sample": 90})

    def test_site_figure_module_embeds_the_same_data(self):
        if not SITE_MODULE.exists():
            self.skipTest("site module not present in this checkout")
        source = SITE_MODULE.read_text()
        match = re.search(r"var DATA = (\{.*?\});\n", source, re.S)
        assert match is not None, "figures-re-44.js must define var DATA = {...};"
        embedded = json.loads(match.group(1))
        expected = json.loads(json.dumps(main.figure_data()))
        self.assertEqual(embedded, expected)


if __name__ == "__main__":
    unittest.main()
