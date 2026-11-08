import json
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


FAKE_SERVER = Path(__file__).resolve().parent / "fake_rea_server.py"
EXPECTED_LEG_TWO = {
    "percent_change_mul_first": "pass",
    "percent_change_split": "pass",
    "percent_change_wide": "fail",
    "percent_change_div_first": "fail",
    "grade_switch": "pass",
    "grade_table": "pass",
    "grade_thresholds": "fail",
    "grade_case10_wrong": "fail",
}
TABLE_BYTES_HEX = "0100000002000000030000000400000004000000"


def candidate(name: str) -> Path:
    return main.CANDIDATES / f"{name}.o"


class SemanticsTests(unittest.TestCase):
    def test_division_truncates_toward_zero(self) -> None:
        self.assertEqual(main.c_div(-9, 10), 0)
        self.assertEqual(main.c_div(-10, 10), -1)
        self.assertEqual(main.c_div(7, -3), -2)
        self.assertEqual(main.c_div(105 - 100, 100), 0)

    def test_wrap32_matches_two_s_complement(self) -> None:
        self.assertEqual(main.wrap32(2147483646 * 100), -200)
        self.assertEqual(main.wrap32(main.INT_MAX + 1), main.INT_MIN)
        self.assertEqual(main.wrap32(-5), -5)

    def test_percent_change_model_on_known_cells(self) -> None:
        self.assertEqual(main.percent_change_model(100, 105), 5)
        self.assertEqual(main.percent_change_model(0, 5), 0)
        self.assertEqual(main.percent_change_model(-3, 7), -333)
        self.assertEqual(main.percent_change_model(3, main.INT_MAX), -133)
        self.assertEqual(main.percent_change_model(-3, main.INT_MAX), -66)
        self.assertEqual(main.percent_change_model(main.INT_MAX, main.INT_MIN), 0)

    def test_trap_cell_depends_on_the_target_architecture(self) -> None:
        self.assertEqual(main.percent_change_model(-1, 536870911, "x86_64"), main.TRAP)
        self.assertEqual(main.percent_change_model(-1, 536870911, "aarch64"), main.INT_MIN)
        self.assertEqual(main.classify("percent_change", (-1, 536870911)), "trap")

    def test_grade_model_follows_the_switch_not_thresholds(self) -> None:
        self.assertEqual([main.grade_model(score) for score in (59, 60, 69, 70, 80, 90, 100, 109)], [0, 1, 1, 2, 3, 4, 4, 4])
        self.assertEqual(main.grade_model(110), 0)
        self.assertEqual(main.grade_model(main.INT_MAX), 0)
        self.assertEqual(main.grade_model(-9), 0)
        self.assertEqual(main.grade_model(main.INT_MIN), 0)

    def test_grid_covers_every_edge_class(self) -> None:
        cells = main.input_grid()
        kinds = {cell.kind for cell in cells}
        self.assertEqual(len(cells), 92)
        self.assertTrue(
            {"zero guard", "negative", "rounding", "overflow", "trap", "boundary", "negative truncation", "beyond the switch"} <= kinds,
            kinds,
        )
        self.assertIn(main.Cell("percent_change", (-1, 536870911), "trap"), cells)
        self.assertIn(main.Cell("grade", (110,), "beyond the switch"), cells)

    def test_naive_cases_avoid_every_hard_class(self) -> None:
        for cell in main.naive_cells():
            self.assertIn(main.classify(cell.function, cell.args), {"plain", "rounding", "zero guard", "boundary"})


class ElfReaderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.obj = main.ElfObject(main.ORIGINAL_OBJECT)

    def test_symbol_offsets_and_sizes(self) -> None:
        sizes = {name: (self.obj.function(name).start, self.obj.function(name).size) for name in ("percent_change", "grade", "total", "grade_label")}
        self.assertEqual(sizes, {"percent_change": (0x0, 16), "grade": (0x10, 46), "total": (0x40, 31), "grade_label": (0x60, 63)})

    def test_percent_change_has_sixteen_bytes_and_no_relocations(self) -> None:
        function = self.obj.function("percent_change")
        self.assertEqual(function.data.hex(), "85ff740929fe6bc66499f7ffc331c0c3")
        self.assertEqual(function.relocations, [])

    def test_grade_relocation_points_at_the_switch_table(self) -> None:
        function = self.obj.function("grade")
        self.assertEqual(len(function.relocations), 1)
        reloc = function.relocations[0]
        self.assertEqual((reloc.offset, reloc.type_name, reloc.symbol, reloc.addend), (0x26, "R_X86_64_PC32", ".rodata", 0x10))
        self.assertEqual(main.read_table(self.obj, reloc, 5, 4), [1, 2, 3, 4, 4])
        self.assertEqual(self.obj.read_target(reloc, 20).hex(), TABLE_BYTES_HEX)

    def test_relocation_field_bytes_are_zero_in_a_rela_object(self) -> None:
        function = self.obj.function("grade")
        self.assertEqual(function.data[0x26:0x2A], b"\0\0\0\0")
        masked, ranges = main.mask_relocations(function.data, function.relocations)
        self.assertEqual(ranges, [(0x26, 4)])
        self.assertEqual(masked, function.data)

    def test_rejects_a_file_that_is_not_an_object(self) -> None:
        with self.assertRaises(ValueError):
            main.ElfObject(main.ORIGINAL_SOURCE)


class LegTwoTests(unittest.TestCase):
    def test_committed_objects_reach_the_expected_verdicts(self) -> None:
        for name, expected in EXPECTED_LEG_TWO.items():
            function = "percent_change" if name.startswith("percent") else "grade"
            report = main.prove_bytes(function, candidate(name))
            self.assertEqual(report.status, expected, (name, report.reasons()))

    def test_textually_different_source_can_compile_to_identical_bytes(self) -> None:
        report = main.prove_bytes("percent_change", candidate("percent_change_split"))
        self.assertTrue(report.masked_equal)
        self.assertEqual(report.reasons(), [])

    def test_wide_intermediate_changes_the_size(self) -> None:
        report = main.prove_bytes("percent_change", candidate("percent_change_wide"))
        self.assertEqual((report.original_size, report.candidate_size), (16, 26))
        self.assertEqual(report.reasons(), ["size 16 vs 26 bytes"])

    def test_candidate_table_lives_at_another_offset_but_holds_the_same_values(self) -> None:
        report = main.prove_bytes("grade", candidate("grade_switch"))
        self.assertEqual(report.relocation_detail[0]["original_target"], ".rodata+0x10")
        self.assertEqual(report.relocation_detail[0]["candidate_target"], ".rodata-0x4")
        self.assertTrue(report.relocation_detail[0]["same_shape"])
        self.assertEqual((report.original_table, report.candidate_table), ([1, 2, 3, 4, 4], [1, 2, 3, 4, 4]))
        self.assertEqual(report.status, "pass")

    def test_wrong_constant_passes_masked_bytes_and_fails_the_constant_check(self) -> None:
        report = main.prove_bytes("grade", candidate("grade_case10_wrong"))
        self.assertTrue(report.masked_equal)
        self.assertTrue(report.relocations_match)
        self.assertIs(report.tables_equal, False)
        self.assertEqual(report.candidate_table, [1, 2, 3, 4, 3])
        self.assertEqual(report.status, "fail")
        self.assertIn("referenced constants differ", report.reasons()[0])

    def test_thresholds_differ_in_size_and_relocation_count(self) -> None:
        report = main.prove_bytes("grade", candidate("grade_thresholds"))
        self.assertEqual((report.original_size, report.candidate_size), (46, 39))
        self.assertFalse(report.relocations_match)


class LegOneReplayTests(unittest.TestCase):
    def load(self, label: str) -> dict:
        matches = sorted(main.RUNS.glob(f"leg-one-{label}-*.json"))
        self.assertTrue(matches, f"no recorded leg-one run for {label}")
        return json.loads(matches[0].read_text(encoding="utf-8"))

    def test_recorded_plausible_run_passes_naive_and_fails_overflow_cells(self) -> None:
        run = self.load("plausible")
        mismatches = main.compare_rows(run["rows"])
        self.assertTrue(run["naive_passed"])
        self.assertGreaterEqual(len(mismatches), 28)
        self.assertTrue({row["kind"] for row in mismatches} <= {"overflow", "beyond the switch", "trap"})
        self.assertIn([3, main.INT_MAX], [row["args"] for row in mismatches])
        self.assertIn([110], [row["args"] for row in mismatches])

    def test_recorded_equal_run_has_no_mismatches(self) -> None:
        run = self.load("equal")
        self.assertEqual(main.compare_rows(run["rows"]), [])
        self.assertEqual(len(run["rows"]), 92)

    def test_model_agrees_with_every_recorded_original_value(self) -> None:
        for label in ("plausible", "equal"):
            run = self.load(label)
            self.assertEqual(main.oracle_disagreements(run["rows"], run["arch"]), [])


@unittest.skipIf(main.host_compiler() is None, "no C compiler on this host")
class LegOneLiveTests(unittest.TestCase):
    def test_plausible_pair_passes_naive_cases_and_fails_the_grid(self) -> None:
        report = main.prove_behaviour(main.PLAUSIBLE)
        self.assertTrue(report.naive_passed)
        self.assertGreaterEqual(len(report.mismatches), 28)
        self.assertEqual(report.oracle_disagreements, [])
        self.assertIn([110], [row["args"] for row in report.mismatches])

    def test_equal_pair_matches_on_every_cell(self) -> None:
        report = main.prove_behaviour(main.EQUAL)
        self.assertTrue(report.naive_passed)
        self.assertEqual(report.mismatches, [])
        self.assertEqual(report.oracle_disagreements, [])
        trap = next(row for row in report.rows if row["kind"] == "trap")
        self.assertEqual(trap["original"], main.model("percent_change", (-1, 536870911), report.arch))

    def test_divide_first_rebuild_fails_even_the_naive_cases(self) -> None:
        report = main.prove_behaviour({"percent_change": main.CANDIDATES / "percent_change_div_first.c", "grade": main.CANDIDATES / "grade_table.c"})
        self.assertFalse(report.naive_passed)


class AgentRunFixtureTests(unittest.TestCase):
    def setUp(self) -> None:
        self.run = main.load_agent_run()

    def test_fixture_targets_the_committed_object(self) -> None:
        sha = main.file_sha256(main.ORIGINAL_OBJECT)
        self.assertEqual(self.run["target"]["sha256"], sha)
        for record in self.run["evidence"].values():
            self.assertEqual(record["subject"]["digest"]["sha256"], sha)
            self.assertEqual(record["provider"], {"id": "ghidra", "name": "Ghidra", "version": "12.1.4"})

    def test_steps_are_recorded_in_order_with_evidence_ids(self) -> None:
        tools = [step["tool"] for step in self.run["steps"]]
        self.assertEqual(tools, ["open_binary", "analyze_function", "analyze_function", "read_bytes", "get_evidence_bundle", "close_binary"])
        for step in self.run["steps"]:
            if step["tool"] in ("analyze_function", "read_bytes"):
                self.assertRegex(step["evidence_id"], r"^ev_[0-9a-f]{64}$")
                self.assertEqual((step["confidence"], step["authority"]), ("observed", "shipped-artifact"))
                self.assertIn(step["evidence_id"], self.run["evidence"])
        self.assertEqual(self.run["server"]["name"], "rea")
        self.assertEqual(self.run["server"]["protocolVersion"], "2025-11-25")

    def test_instruction_view_names_the_operations_the_rebuild_needs(self) -> None:
        pc = main.function_evidence(self.run, "percent_change")["normalized_result"]["assembly"]
        grade = main.function_evidence(self.run, "grade")["normalized_result"]["assembly"]
        self.assertIn("0x100006: IMUL EAX, ESI, 0x64", pc)
        self.assertIn("0x10000a: IDIV EDI", pc)
        self.assertIn("0x100033: LEA RCX, [0x1000b4]", grade)
        self.assertEqual(main.table_address(grade), "0x1000b4")

    def test_decompiler_text_disagrees_with_the_listing(self) -> None:
        text = main.pseudocode(self.run, "percent_change")
        self.assertIn("(long)", text)
        self.assertIn("[16]", text)

    def test_read_bytes_evidence_equals_the_table_in_the_object(self) -> None:
        read = next(step for step in self.run["steps"] if step["tool"] == "read_bytes")
        record = self.run["evidence"][read["evidence_id"]]["normalized_result"]
        self.assertEqual(record["bytes_hex"], TABLE_BYTES_HEX)
        obj = main.ElfObject(main.ORIGINAL_OBJECT)
        reloc = obj.function("grade").relocations[0]
        self.assertEqual(obj.read_target(reloc, 20).hex(), record["bytes_hex"])


class McpClientTests(unittest.TestCase):
    def test_client_drives_the_fake_server_and_records_the_same_evidence_ids(self) -> None:
        fixture = main.load_agent_run()
        with main.McpStdioClient([sys.executable, str(FAKE_SERVER)], timeout=30) as client:
            self.assertEqual(client.server_info["name"], "fake-rea")
            self.assertIn("analyze_function", client.list_tools())
            run = main.agent_loop(main.ORIGINAL_OBJECT, client)
        self.assertEqual([step["evidence_id"] for step in run["steps"]], [step["evidence_id"] for step in fixture["steps"]])
        self.assertEqual(run["server"]["protocolVersion"], "2025-11-25")
        self.assertEqual(set(run["evidence"]), set(fixture["evidence"]))

    def test_error_results_are_reported_not_hidden(self) -> None:
        with main.McpStdioClient([sys.executable, str(FAKE_SERVER)], timeout=30) as client:
            result = client.call_tool("analyze_function", {"procedure": "total"})
        self.assertTrue(result["isError"])


class ProofTests(unittest.TestCase):
    def setUp(self) -> None:
        self.run = main.load_agent_run()

    def test_aggregate_is_fail_closed(self) -> None:
        self.assertEqual(main.aggregate(["pass", "pass"]), "pass")
        self.assertEqual(main.aggregate(["pass", "unknown"]), "unknown")
        self.assertEqual(main.aggregate(["fail", "pass", "unknown"]), "fail")
        self.assertEqual(main.aggregate([]), "unknown")

    def test_missing_compiler_leaves_behaviour_unknown(self) -> None:
        proof = main.build_proof(None, [], self.run)
        self.assertEqual(proof["normalized_result"]["status"], "unknown")
        self.assertFalse(proof["normalized_result"]["passed"])

    def test_wrong_constant_fails_the_whole_proof(self) -> None:
        report = main.prove_bytes("grade", candidate("grade_case10_wrong"))
        proof = main.build_proof(None, [report], self.run)
        statuses = {entry["claim_id"]: entry["status"] for entry in proof["normalized_result"]["claims"]}
        self.assertEqual(statuses["grade.bytes"], "pass")
        self.assertEqual(statuses["grade.referenced-constants"], "fail")
        self.assertEqual(proof["normalized_result"]["status"], "fail")

    def test_proof_id_is_a_content_hash_linked_to_the_function_evidence(self) -> None:
        reports = [main.prove_bytes("percent_change", candidate("percent_change_mul_first")), main.prove_bytes("grade", candidate("grade_switch"))]
        proof = main.build_proof(None, reports, self.run)
        body = {key: value for key, value in proof.items() if key != "evidence_id"}
        self.assertEqual(proof["evidence_id"], "ev_" + main.digest(body))
        expected_links = sorted(step["evidence_id"] for step in self.run["steps"] if step["tool"] == "analyze_function")
        self.assertEqual(proof["evidence_links"], expected_links)
        self.assertEqual(proof["predicate_type"], "rea.reconstruction-proof")


if __name__ == "__main__":
    unittest.main()
