
import json
import tempfile
import unittest
from pathlib import Path

from minidec.elf import load_object
from minidec.emit import decompile_all, translation_unit
from minidec.verify import (
    MEMORY_WORDS,
    Cell,
    VerifyError,
    aggregate,
    compare_function_bytes,
    differential_test,
    driver_source,
    find_clang,
    fixture_flags,
    input_grid,
    mask_relocations,
    recompile,
    verify,
)

PROJECT = Path(__file__).resolve().parents[3]
FIXTURES = PROJECT / "fixtures"
O0 = FIXTURES / "samples-x86_64-O0.o"
O1 = FIXTURES / "samples-x86_64-O1.o"
SOURCE = FIXTURES / "samples.c"
CANDIDATES = FIXTURES / "candidates"
HELDOUT = FIXTURES / "heldout"
NO_CLANG = "clang is not on PATH: the recompile leg cannot run; the committed-object legs still ran"


class MaskingTests(unittest.TestCase):
    def test_masking_zeroes_the_relocation_field_and_reports_the_range(self):
        band = load_object(O1).function("band")
        masked, ranges = mask_relocations(band.data, band.relocations)
        self.assertEqual(ranges, [(0xF, 4)])
        self.assertEqual(masked[0xF:0x13], b"\0\0\0\0")
        self.assertEqual(masked[:0xF], band.data[:0xF])
        self.assertEqual(len(masked), band.size)
        data = bytes(range(8))
        masked, ranges = mask_relocations(data, [])
        self.assertEqual((masked, ranges), (data, []))

    def test_an_object_compared_with_itself_passes_every_leg(self):
        elf = load_object(O1)
        comparison = compare_function_bytes(elf, elf, "band", {"lookup_0": {"section": ".rodata", "offset": 0, "width": 32, "values": [5, 8, 12, 20, 20, 35]}})
        self.assertEqual(comparison.status, "pass")
        self.assertEqual(comparison.reasons(), [])
        self.assertEqual(comparison.constants[0]["original"], [5, 8, 12, 20, 20, 35])
        self.assertTrue(comparison.relocations_match)

    def test_same_bytes_different_table_fails_only_the_constant_check(self):
        original = load_object(O1)
        candidate = load_object(CANDIDATES / "band_wrong_table-x86_64-O1.o")
        comparison = compare_function_bytes(original, candidate, "band", {"lookup_0": {"section": ".rodata", "offset": 0, "width": 32, "values": [5, 8, 12, 20, 20, 35]}})
        self.assertTrue(comparison.masked_equal)
        self.assertTrue(comparison.relocations_match)
        self.assertEqual(comparison.constants_equal, False)
        self.assertEqual(comparison.status, "differs")
        self.assertIn("referenced constants differ", comparison.reasons()[0])
        self.assertEqual(comparison.constants[0]["candidate"], [5, 8, 12, 20, 21, 35])

    def test_a_wider_accumulator_changes_the_size(self):
        comparison = compare_function_bytes(load_object(O1), load_object(CANDIDATES / "fold_wide-x86_64-O1.o"), "fold")
        self.assertEqual(comparison.status, "differs")
        self.assertEqual((comparison.original_size, comparison.candidate_size), (38, 45))
        self.assertEqual(comparison.reasons(), ["size 38 vs 45 bytes"])

    def test_a_missing_function_in_the_candidate_is_unknown_not_a_pass(self):
        comparison = compare_function_bytes(load_object(O1), load_object(CANDIDATES / "fold_wide-x86_64-O1.o"), "band")
        self.assertEqual(comparison.status, "unknown")
        self.assertIn("band", comparison.reasons()[0])


class GridAndDriverTests(unittest.TestCase):
    def setUp(self):
        self.results = decompile_all(load_object(O1))

    def test_grid_crosses_limits_zero_negatives_and_compare_constants(self):
        band = self.results["band"]
        cells = input_grid(band.signature, band.compare_constants)
        values = {cell.args[0] for cell in cells}
        self.assertTrue({0, -1, 2147483647, -2147483648, 4, 5, 6} <= values)
        kinds = {cell.kind for cell in cells}
        self.assertTrue({"limit", "zero", "negative", "compare-edge", "plain"} <= kinds)
        self.assertEqual(len(cells), len({cell.args for cell in cells}))

    def test_memory_parameters_get_patterns_and_scalars_stay_inside_the_buffer(self):
        fold = self.results["fold"]
        cells = input_grid(fold.signature, fold.compare_constants)
        patterns = {cell.args[0] for cell in cells}
        self.assertEqual(len(patterns), 5)
        self.assertTrue(all(len(pattern) == MEMORY_WORDS for pattern in patterns))
        counts = {cell.args[1] for cell in cells}
        self.assertTrue({0, 1, 8, -1} <= counts)
        self.assertLessEqual(max(counts), 100)
        self.assertEqual(Cell("fold", (patterns and (1, 2, 3, 4, 5, 6, 7, 8), 3), "plain").line(), "fold 1 2 3 4 5 6 7 8 3")

    def test_driver_declares_both_versions_and_handles_traps(self):
        source = driver_source({name: result.signature for name, result in self.results.items()})
        self.assertIn("int record(void *, int);", source)
        self.assertIn("int cand_record(void *, int);", source)
        self.assertIn("int fold(void *, int);", source)
        self.assertIn("sigsetjmp(trap_env, 1)", source)
        self.assertIn('printf(" | trap")', source)
        self.assertIn("sigaction(SIGFPE", source)
        self.assertEqual(source.count("static void run_"), 5)

    def test_aggregate_is_fail_closed(self):
        self.assertEqual(aggregate({"a": "pass"}, {"a": "pass"}), "pass")
        self.assertEqual(aggregate({"a": "pass"}, {"a": "differs"}), "behaviour-only")
        self.assertEqual(aggregate({"a": "pass", "b": "fail"}, {"a": "pass", "b": "pass"}), "fail")
        self.assertEqual(aggregate({"a": "unknown"}, {"a": "pass"}), "unknown")
        self.assertEqual(aggregate({}, {}), "unknown")
        self.assertEqual(fixture_flags("O1"), ["-target", "x86_64-unknown-linux-gnu", "-O1", "-fno-asynchronous-unwind-tables", "-c"])
        with self.assertRaises(ValueError):
            fixture_flags("O9")


@unittest.skipUnless(find_clang(), NO_CLANG)
class RecompileTests(unittest.TestCase):
    def test_emitted_unit_recompiles_and_matches_bytes_for_the_straight_line_functions(self):
        elf = load_object(O1)
        results = decompile_all(elf)
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "decompiled.c"
            source.write_text(translation_unit(results), encoding="utf-8")
            candidate = load_object(recompile(source, "O1", Path(tmp) / "recompiled.o"))
        for name in ("tenths_and_fifths", "thirds", "band", "record"):
            with self.subTest(name=name):
                comparison = compare_function_bytes(elf, candidate, name, results[name].tables)
                self.assertEqual(comparison.status, "pass", comparison.reasons())
        fold = compare_function_bytes(elf, candidate, "fold", results["fold"].tables)
        self.assertIn(fold.status, ("pass", "differs"))

    def test_broken_c_reports_the_compiler_text(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "broken.c"
            source.write_text("int f(int a) { return a +; }\n", encoding="utf-8")
            with self.assertRaises(VerifyError) as caught:
                recompile(source, "O1", Path(tmp) / "broken.o")
            self.assertIn("recompile failed", str(caught.exception))

    def test_differential_grid_passes_on_every_cell_for_both_optimization_levels(self):
        for path, opt in ((O1, "O1"), (O0, "O0")):
            results = decompile_all(load_object(path))
            with tempfile.TemporaryDirectory() as tmp:
                candidate = Path(tmp) / "decompiled.c"
                candidate.write_text(translation_unit(results), encoding="utf-8")
                reports, harness = differential_test(SOURCE, candidate, results, opt, Path(tmp) / "harness")
            with self.subTest(opt=opt):
                self.assertTrue(harness.binary.name)
                for name, report in reports.items():
                    self.assertEqual(report.status, "pass", (name, report.mismatches[:3]))
                    self.assertGreaterEqual(report.cells, 10)
                self.assertEqual(reports["thirds"].cells, 100)
                self.assertGreaterEqual(reports["record"].to_dict()["cells"], 30)

    def test_verify_writes_the_report_and_lists_every_unknown(self):
        with tempfile.TemporaryDirectory() as tmp:
            report = verify(O1, SOURCE, "O1", tmp)
            written = json.loads((Path(tmp) / "report.json").read_text(encoding="utf-8"))
            self.assertTrue((Path(tmp) / "decompiled.c").exists())
            self.assertTrue((Path(tmp) / "recompiled.o").exists())
        self.assertEqual(report["status"], written["status"])
        self.assertIn(report["status"], ("pass", "behaviour-only"))
        self.assertEqual({name: entry["behaviour"]["status"] for name, entry in report["functions"].items()}, {name: "pass" for name in report["functions"]})
        self.assertEqual(report["functions"]["band"]["bytes"]["status"], "pass")
        self.assertEqual(report["functions"]["band"]["bytes"]["constants"][0]["original"], [5, 8, 12, 20, 20, 35])
        self.assertTrue(any("lookup_0 length 6" in line for line in report["unknowns"]))
        self.assertEqual(Path(report["outputs"]["recompiled"]).name, "recompiled.o")
        self.assertEqual(written["functions"]["thirds"]["behaviour"]["mismatchCount"], 0)

    def test_without_the_source_the_behaviour_leg_is_unknown_and_the_aggregate_follows(self):
        with tempfile.TemporaryDirectory() as tmp:
            report = verify(O1, None, "O1", tmp, functions=["thirds"])
        self.assertEqual(report["status"], "unknown")
        self.assertEqual(report["functions"]["thirds"]["behaviour"]["status"], "unknown")
        self.assertEqual(report["functions"]["thirds"]["bytes"]["status"], "pass")
        self.assertTrue(any("was not compared" in line for line in report["unknowns"]))


class HeldOutCommittedObjectTests(unittest.TestCase):
    def test_held_out_grid_and_masks_without_a_compiler(self):
        elf = load_object(HELDOUT / "extra-x86_64-O1.o")
        results = decompile_all(elf)
        table = results["quarter_band"]
        cells = input_grid(table.signature, table.compare_constants)
        self.assertEqual(table.compare_constants, [4])
        self.assertTrue({3, 4, 5} <= {cell.args[0] for cell in cells})
        masked, ranges = mask_relocations(elf.function("quarter_band").data, elf.function("quarter_band").relocations)
        self.assertEqual(len(ranges), 1)
        self.assertEqual(masked[ranges[0][0] : ranges[0][0] + 4], bytes(4))
        self.assertEqual(compare_function_bytes(elf, elf, "weighted").status, "pass")
        weighted = results["weighted"]
        self.assertEqual(len(input_grid(weighted.signature, weighted.compare_constants)), 30)
        self.assertIn("int cand_span_end(void *, int);", driver_source({name: result.signature for name, result in results.items()}))


@unittest.skipUnless(find_clang(), NO_CLANG)
class HeldOutTests(unittest.TestCase):
    def test_held_out_object_passes_behaviour_at_both_levels(self):
        for opt in ("O1", "O0"):
            with tempfile.TemporaryDirectory() as tmp, self.subTest(opt=opt):
                report = verify(HELDOUT / f"extra-x86_64-{opt}.o", HELDOUT / "extra.c", opt, tmp)
                self.assertIn(report["status"], ("pass", "behaviour-only"))
                for name, entry in report["functions"].items():
                    self.assertEqual(entry["behaviour"]["status"], "pass", name)
                    self.assertEqual(entry["behaviour"]["mismatchCount"], 0, name)
                self.assertEqual(report["functions"]["fifths"]["bytes"]["status"], "pass")


if __name__ == "__main__":
    unittest.main()
