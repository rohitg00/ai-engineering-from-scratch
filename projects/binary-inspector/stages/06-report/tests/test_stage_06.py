import json
import os
import unittest
from pathlib import Path

from binspect.layout import sections, segments
from binspect.report import REPORT_SCHEMA, build_report, byte_map, diff_reports, render_html, validate_report

ROOT = Path(os.environ.get("PROJECT_ROOT", Path(__file__).resolve().parents[3]))
FIXTURES = ROOT / "solution" / "fixtures"
HELDOUT = ROOT / "heldout"


def load(name, folder=FIXTURES):
    return (folder / name).read_bytes()


class ByteMap(unittest.TestCase):
    def test_cells_cover_the_file_once(self):
        blob = load("tally-x86_64-O2.o")
        cells = byte_map(blob, sections(blob), segments(blob), 64)
        self.assertEqual(len(cells), 64)
        self.assertEqual(cells[0]["offset"], 0)
        self.assertEqual(sum(cell["length"] for cell in cells), len(blob))
        for before, after in zip(cells, cells[1:]):
            self.assertEqual(before["offset"] + before["length"], after["offset"])
        self.assertEqual(cells[0]["region"], "headers")
        self.assertIn(".text", {cell["region"] for cell in cells})

    def test_more_cells_than_bytes_and_bad_count(self):
        cells = byte_map(b"\x00\x01\x02", [], [], 128)
        self.assertEqual([cell["length"] for cell in cells], [1, 1, 1])
        with self.assertRaises(ValueError):
            byte_map(b"abc", [], [], 0)

    def test_padding_is_low_entropy_and_code_is_high(self):
        blob = load("tally-arm64-O2")
        cells = byte_map(blob, sections(blob), segments(blob), 256)
        text = [cell["entropy"] for cell in cells if cell["region"] == "__text"]
        padding = [cell["entropy"] for cell in cells if cell["region"] == "__DATA"]
        self.assertTrue(text and padding)
        self.assertGreater(max(text), 4.0)
        self.assertEqual(max(padding), 0.0)


class Report(unittest.TestCase):
    def test_report_is_valid_json_with_the_schema(self):
        report = build_report(load("tally-arm64-O2.stripped"), "tally-arm64-O2.stripped", load("tally-arm64-O2"))
        self.assertEqual(report["schema"], REPORT_SCHEMA)
        self.assertEqual(validate_report(report), [])
        self.assertEqual(json.loads(json.dumps(report))["file"]["size"], len(load("tally-arm64-O2.stripped")))
        self.assertEqual(report["summary"]["format"], "macho64")
        self.assertEqual(report["summary"]["fixups"], 8)
        scores = report["function_starts"]["scores"]
        self.assertEqual(scores["recovered"]["recall"], 1.0)
        self.assertEqual(scores["symbols"]["true_positives"], 0)

    def test_every_format_builds_a_valid_report(self):
        for name in ("tally-x86_64-O2.o", "tally-x86_64-O2.obj", "tiny-x86_64.exe", "tally-arm64-O2.o", "libtally.dylib"):
            report = build_report(load(name), name)
            self.assertEqual(validate_report(report), [], name)
            self.assertNotIn("scores", report["function_starts"])

    def test_validator_names_problems(self):
        report = build_report(load("tiny-x86_64.exe"), "tiny")
        del report["sections"]
        report["imports"][0].pop("library")
        report["strings"] = "nope"
        problems = validate_report(report)
        self.assertIn("missing key sections", problems)
        self.assertIn("imports[0] missing library", problems)
        self.assertIn("strings must be list", problems)
        self.assertEqual(validate_report([]), ["report must be an object"])

    def test_html_escapes_strings_from_the_binary(self):
        blob = bytearray(load("tally-arm64-O2"))
        at = blob.index(b"unknown bucket")
        blob[at:at + 14] = b"<script>x</b>&"
        page = render_html(build_report(bytes(blob), "patched<file>"))
        self.assertTrue(page.startswith("<!doctype html>"))
        self.assertNotIn("<script>", page)
        self.assertIn("&lt;script&gt;x&lt;/b&gt;&amp;", page)
        self.assertIn("patched&lt;file&gt;", page)
        self.assertNotIn("http://", page)
        self.assertNotIn("https://", page)
        self.assertEqual(page.count('class="cell"'), 128)


class Diff(unittest.TestCase):
    def test_two_optimization_levels(self):
        old = build_report(load("tally-arm64-O0"), "O0")
        new = build_report(load("tally-arm64-O2"), "O2")
        diff = diff_reports(old, new)
        self.assertFalse(diff["identical"])
        text = next(item for item in diff["sections"]["changed"] if item["name"] == "__TEXT,__text")
        self.assertEqual((text["old_size"], text["new_size"], text["delta"]), (848, 768, -80))
        moved = {item["name"]: (item["old"], item["new"]) for item in diff["symbols"]["moved"]}
        self.assertEqual(moved["_tally_sum"], (0x10000075C, 0x100000740))
        self.assertEqual(diff["symbols"]["added"], [])
        self.assertEqual(diff["imports"], {"added": [], "removed": []})

    def test_identical_and_stripped(self):
        report = build_report(load("tally-arm64-O2"), "a")
        same = diff_reports(report, build_report(load("tally-arm64-O2"), "b"))
        self.assertTrue(same["identical"])
        self.assertEqual(same["sections"]["changed"], [])
        stripped = diff_reports(report, build_report(load("tally-arm64-O2.stripped"), "s"))
        self.assertIn("_tally_sum", stripped["symbols"]["removed"])
        self.assertEqual(stripped["exports"]["removed"], ["_main", "_tally_bucket", "_tally_checksum", "_tally_counter",
                                                         "_tally_name", "_tally_scale", "_tally_sum", "_tally_version"])
        self.assertEqual(stripped["exports"]["added"], [])

    def test_invalid_report_is_refused(self):
        report = build_report(load("tiny-x86_64.exe"), "tiny")
        with self.assertRaises(ValueError):
            diff_reports(report, {"schema": REPORT_SCHEMA})


class HeldOut(unittest.TestCase):
    def test_second_program_report_and_diff(self):
        report = build_report(load("meter-arm64-O2.stripped", HELDOUT), "meter", load("meter-arm64-O2", HELDOUT))
        self.assertEqual(validate_report(report), [])
        self.assertEqual(report["function_starts"]["scores"]["function_starts_table"]["precision"], 1.0)
        diff = diff_reports(build_report(load("meter-x86_64-O2.o", HELDOUT), "meter"),
                            build_report(load("tally-x86_64-O2.o"), "tally"))
        self.assertIn("meter_hash", diff["symbols"]["removed"])
        self.assertIn("tally_checksum", diff["symbols"]["added"])


if __name__ == "__main__":
    unittest.main()
