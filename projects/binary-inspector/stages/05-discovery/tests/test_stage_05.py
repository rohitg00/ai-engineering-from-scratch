import os
import struct
import unittest
from pathlib import Path

from binspect.discovery import extract_strings, function_starts, score_starts
from binspect.formats import FormatError, load_commands
from binspect.layout import sections, segments

ROOT = Path(os.environ.get("PROJECT_ROOT", Path(__file__).resolve().parents[3]))
FIXTURES = ROOT / "solution" / "fixtures"
HELDOUT = ROOT / "heldout"
O2_STARTS = [0x1000005E8, 0x100000740, 0x100000848, 0x100000868, 0x100000890, 0x1000008B4]
METER_STARTS = [0x1000005E8, 0x100000764, 0x100000778, 0x100000880, 0x1000008C0, 0x1000008E4]


def load(name, folder=FIXTURES):
    return (folder / name).read_bytes()


def strings_of(blob, minimum=4):
    return extract_strings(blob, sections(blob), segments(blob), minimum)


class Strings(unittest.TestCase):
    def test_strings_carry_their_section(self):
        found = {item["text"]: item for item in strings_of(load("tally-arm64-O2"))}
        self.assertEqual((found["tally report v3"]["section"], found["tally report v3"]["segment"]), ("__const", "__TEXT"))
        self.assertEqual(found["checksum=%08x version=%d"]["section"], "__cstring")
        self.assertEqual(found["/usr/lib/libSystem.B.dylib"]["section"], None)
        self.assertEqual(found["_puts"]["segment"], "__LINKEDIT")
        self.assertEqual(found["tally report v3"]["offset"], 2336)

    def test_minimum_length_is_a_boundary(self):
        blob = b"\0abc\0abcd\0xy\0"
        self.assertEqual([item["text"] for item in extract_strings(blob, [], [], 4)], ["abcd"])
        self.assertEqual([item["text"] for item in extract_strings(blob, [], [], 3)], ["abc", "abcd"])
        self.assertEqual(extract_strings(blob, [], [], 4)[0]["offset"], 5)
        self.assertEqual(extract_strings(b"tail", [], [], 4)[0]["text"], "tail")
        with self.assertRaises(ValueError):
            extract_strings(blob, [], [], 0)

    def test_utf16_strings(self):
        blob = b"\x01\x02" + "WriteConsole".encode("utf-16-le") + b"\0\0"
        found = extract_strings(blob, [], [], 4)
        self.assertEqual([(item["text"], item["encoding"], item["offset"]) for item in found], [("WriteConsole", "utf-16le", 2)])

    def test_elf_object_strings(self):
        found = strings_of(load("tally-x86_64-O2.o"))
        self.assertIn(("unknown bucket", ".rodata.str1.1"), [(item["text"], item["section"]) for item in found])


class FunctionStarts(unittest.TestCase):
    def test_methods_on_the_stripped_build(self):
        found = function_starts(load("tally-arm64-O2.stripped"))
        self.assertEqual(found["symbols"], [])
        self.assertEqual(found["function_starts_table"], O2_STARTS)
        self.assertEqual(found["entry"], [0x1000005E8])
        self.assertEqual(found["call_targets"], O2_STARTS[1:])
        self.assertEqual(found["prologues"], [0x1000005E8])
        self.assertEqual(found["recovered"], O2_STARTS)

    def test_unstripped_symbols_are_the_truth(self):
        self.assertEqual(function_starts(load("tally-arm64-O2"))["symbols"], O2_STARTS)
        self.assertEqual(function_starts(load("tally-x86_64-O2.o"))["symbols"], [0, 0xA0, 0xC0, 0xF0, 0x110])

    def test_frame_pointer_prologues_depend_on_optimization(self):
        self.assertEqual(function_starts(load("tally-x86_64-O0.o"))["prologues"], [0, 0x60, 0x80, 0xF0, 0x130])
        self.assertEqual(function_starts(load("tally-x86_64-O2.o"))["prologues"], [])
        self.assertEqual(len(function_starts(load("tally-arm64-O0"))["prologues"]), 6)

    def test_dylib_starts_survive_strip(self):
        self.assertEqual(function_starts(load("libtally.stripped.dylib"))["function_starts_table"], [0x4A8, 0x5B0, 0x5D0, 0x5F8, 0x61C])

    def test_injected_prologue_word_is_a_false_positive(self):
        blob = bytearray(load("tally-arm64-O2.stripped"))
        struct.pack_into("<I", blob, 0x5E8 + 0x40, 0xD10083FF)
        found = function_starts(bytes(blob))
        score = score_starts(found["prologues"], O2_STARTS)
        self.assertEqual(score["false_positives"], [0x100000628])
        self.assertEqual(score["precision"], 0.5)

    def test_prologue_bytes_outside_code_are_ignored(self):
        blob = bytearray(load("tally-arm64-O2.stripped"))
        struct.pack_into("<I", blob, 0x910, 0xD10083FF)
        self.assertEqual(function_starts(bytes(blob))["prologues"], [0x1000005E8])

    def test_truncated_function_starts_table(self):
        blob = bytearray(load("tally-arm64-O2.stripped"))
        command = next(item for item in load_commands(bytes(blob)) if item["name"] == "LC_FUNCTION_STARTS")
        dataoff, _ = struct.unpack_from("<II", blob, command["offset"] + 8)
        struct.pack_into("<I", blob, command["offset"] + 12, 1)
        blob[dataoff] = 0x80
        with self.assertRaises(FormatError):
            function_starts(bytes(blob))


class Scores(unittest.TestCase):
    def test_precision_and_recall(self):
        score = score_starts([1, 2, 3, 9], [1, 2, 3, 4, 5])
        self.assertEqual((score["found"], score["truth"], score["true_positives"]), (4, 5, 3))
        self.assertEqual(score["false_positives"], [9])
        self.assertEqual(score["missed"], [4, 5])
        self.assertEqual((score["precision"], score["recall"]), (0.75, 0.6))

    def test_empty_inputs(self):
        self.assertEqual((score_starts([], [1])["precision"], score_starts([], [1])["recall"]), (0.0, 0.0))
        self.assertEqual(score_starts([1], [])["recall"], 1.0)
        self.assertEqual(score_starts([2, 2, 2], [2])["found"], 1)


class HeldOut(unittest.TestCase):
    def test_second_program_scored_against_its_unstripped_build(self):
        truth = function_starts(load("meter-arm64-O2", HELDOUT))["symbols"]
        self.assertEqual(truth, METER_STARTS)
        found = function_starts(load("meter-arm64-O2.stripped", HELDOUT))
        self.assertEqual(score_starts(found["recovered"], truth)["recall"], 1.0)
        self.assertLess(score_starts(found["prologues"], truth)["recall"], 0.5)
        texts = {item["text"]: item["section"] for item in strings_of(load("meter-arm64-O2.stripped", HELDOUT))}
        self.assertEqual(texts["meter readout"], "__const")


if __name__ == "__main__":
    unittest.main()
