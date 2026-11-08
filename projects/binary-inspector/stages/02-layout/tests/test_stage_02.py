import os
import struct
import unittest
from pathlib import Path

from binspect.formats import FormatError
from binspect.layout import section_at_address, section_at_offset, sections, segments, shannon_entropy

ROOT = Path(os.environ.get("PROJECT_ROOT", Path(__file__).resolve().parents[3]))
FIXTURES = ROOT / "solution" / "fixtures"
HELDOUT = ROOT / "heldout"
KEYS = {"index", "name", "segment", "type", "addr", "offset", "size", "file_size", "perms", "code", "entropy"}


def load(name, folder=FIXTURES):
    return (folder / name).read_bytes()


def by_name(items, name, segment=None):
    return next(item for item in items if item["name"] == name and (segment is None or item.get("segment") == segment))


class Entropy(unittest.TestCase):
    def test_known_values(self):
        self.assertEqual(shannon_entropy(b""), 0.0)
        self.assertEqual(shannon_entropy(b"\0" * 4096), 0.0)
        self.assertEqual(shannon_entropy(b"aabb"), 1.0)
        self.assertEqual(shannon_entropy(bytes(range(256))), 8.0)
        self.assertEqual(shannon_entropy(b"tally report v3"), 3.3736)

    def test_order_does_not_matter(self):
        self.assertEqual(shannon_entropy(b"abcabcxyz"), shannon_entropy(b"zyxcbacba"))


class ElfLayout(unittest.TestCase):
    def test_sections_match_objdump(self):
        found = sections(load("tally-x86_64-O2.o"))
        self.assertEqual(len(found), 12)
        self.assertTrue(all(set(item) >= KEYS for item in found))
        text = by_name(found, ".text")
        self.assertEqual((text["index"], text["size"], text["offset"], text["perms"], text["code"]), (2, 0x13C, 64, "r-x", True))
        self.assertEqual(by_name(found, ".data")["perms"], "rw-")
        self.assertEqual(by_name(found, ".rodata.str1.1")["perms"], "r--")
        self.assertEqual(by_name(found, ".symtab")["perms"], "---")

    def test_nobits_has_no_file_bytes(self):
        bss = by_name(sections(load("tally-x86_64-O2.o")), ".bss")
        self.assertEqual((bss["type"], bss["size"], bss["file_size"], bss["entropy"]), ("NOBITS", 4, 0, 0.0))

    def test_relocatable_has_no_segments(self):
        self.assertEqual(segments(load("tally-x86_64-O2.o")), [])

    def test_section_past_end_is_rejected(self):
        blob = bytearray(load("tally-x86_64-O2.o"))
        shoff = struct.unpack_from("<Q", blob, 0x28)[0]
        struct.pack_into("<Q", blob, shoff + 64 * 2 + 24, len(blob) - 8)
        with self.assertRaises(FormatError):
            sections(bytes(blob))


class CoffLayout(unittest.TestCase):
    def test_object_sections(self):
        found = sections(load("tally-x86_64-O2.obj"))
        self.assertEqual([item["name"] for item in found],
                         [".text", ".data", ".bss", ".rdata", ".rdata", ".rdata", ".rdata", ".rdata", ".rdata", ".llvm_addrsig"])
        self.assertEqual(by_name(found, ".text")["size"], 0x13C)
        bss = by_name(found, ".bss")
        self.assertEqual((bss["type"], bss["file_size"], bss["perms"]), ("uninitialized", 0, "rw-"))
        self.assertEqual(segments(load("tally-x86_64-O2.obj")), [])

    def test_image_sections_use_image_addresses(self):
        found = sections(load("tiny-x86_64.exe"))
        self.assertEqual([(item["name"], item["addr"], item["offset"], item["perms"]) for item in found], [
            (".text", 0x140001000, 0x200, "r-x"),
            (".rdata", 0x140002000, 0x400, "r--"),
            (".data", 0x140003000, 0x600, "rw-"),
            (".reloc", 0x140004000, 0x800, "r--"),
        ])
        self.assertEqual(section_at_address(found, 0x140002010)["name"], ".rdata")
        self.assertIsNone(section_at_address(found, 0x140009000))


class MachOLayout(unittest.TestCase):
    def test_sections_and_segment_permissions(self):
        found = sections(load("tally-arm64-O2"))
        self.assertEqual([(item["segment"], item["name"]) for item in found], [
            ("__TEXT", "__text"), ("__TEXT", "__stubs"), ("__TEXT", "__const"), ("__TEXT", "__cstring"),
            ("__TEXT", "__unwind_info"), ("__DATA_CONST", "__got"), ("__DATA_CONST", "__const"),
            ("__DATA", "__data"), ("__DATA", "__common"),
        ])
        text = by_name(found, "__text")
        self.assertEqual((text["addr"], text["size"], text["perms"], text["code"]), (0x1000005E8, 0x300, "r-x", True))
        self.assertFalse(by_name(found, "__const", "__TEXT")["code"])
        common = by_name(found, "__common")
        self.assertEqual((common["type"], common["file_size"]), ("zerofill", 0))

    def test_segments(self):
        found = segments(load("tally-arm64-O2"))
        self.assertEqual([(item["name"], item["perms"]) for item in found], [
            ("__PAGEZERO", "---"), ("__TEXT", "r-x"), ("__DATA_CONST", "rw-"), ("__DATA", "rw-"), ("__LINKEDIT", "r--"),
        ])
        self.assertEqual(by_name(found, "__PAGEZERO")["file_size"], 0)
        self.assertGreater(by_name(found, "__LINKEDIT")["entropy"], by_name(found, "__DATA")["entropy"])

    def test_object_sections_take_permissions_from_segment_names(self):
        found = sections(load("tally-arm64-O2.o"))
        self.assertEqual(by_name(found, "__text")["perms"], "r-x")
        self.assertEqual(by_name(found, "__data")["perms"], "rw-")

    def test_offset_lookup_prefers_the_smallest_owner(self):
        found = sections(load("tally-arm64-O2"))
        self.assertEqual(section_at_offset(found, 2352)["name"], "__cstring")
        self.assertIsNone(section_at_offset(found, 8))

    def test_section_count_beyond_command_size(self):
        blob = bytearray(load("tally-arm64-O2"))
        offset = 32 + 72
        struct.pack_into("<I", blob, offset + 64, 40)
        with self.assertRaises(FormatError):
            sections(bytes(blob))


class HeldOut(unittest.TestCase):
    def test_second_program_layout(self):
        found = sections(load("meter-arm64-O2.stripped", HELDOUT))
        text = by_name(found, "__text")
        self.assertEqual(text["addr"], 0x1000005E8)
        self.assertTrue(text["code"])
        self.assertGreater(text["entropy"], 5.0)
        obj = sections(load("meter-x86_64-O2.obj", HELDOUT))
        self.assertEqual(sum(1 for item in obj if item["name"] == ".rdata"), 7)


if __name__ == "__main__":
    unittest.main()
