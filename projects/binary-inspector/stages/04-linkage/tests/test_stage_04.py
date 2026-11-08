import os
import struct
import unittest
from pathlib import Path

from binspect.formats import FormatError, load_commands
from binspect.layout import sections
from binspect.linkage import chained_fixups, exports, imports, relocations, uleb128

ROOT = Path(os.environ.get("PROJECT_ROOT", Path(__file__).resolve().parents[3]))
FIXTURES = ROOT / "solution" / "fixtures"
HELDOUT = ROOT / "heldout"


def load(name, folder=FIXTURES):
    return (folder / name).read_bytes()


def linkedit(blob, name):
    command = next(item for item in load_commands(blob) if item["name"] == name)
    return struct.unpack_from("<II", blob, command["offset"] + 8)


class Uleb(unittest.TestCase):
    def test_values_and_next_offset(self):
        self.assertEqual(uleb128(b"\x00", 0), (0, 1))
        self.assertEqual(uleb128(b"\x7f", 0), (127, 1))
        self.assertEqual(uleb128(b"\x80\x0a", 0), (0x500, 2))
        self.assertEqual(uleb128(b"\xff\xe5\x80\x0a\x00", 2), (0x500, 4))

    def test_unterminated_and_too_long(self):
        with self.assertRaises(FormatError):
            uleb128(b"\x80\x80", 0)
        with self.assertRaises(FormatError):
            uleb128(b"\x80" * 11 + b"\x01", 0)


class Relocations(unittest.TestCase):
    def test_elf_rela_matches_objdump(self):
        found = relocations(load("tally-x86_64-O2.o"))
        self.assertEqual(len(found), 8)
        self.assertEqual(found[0], {"section": ".text", "offset": 0x15, "type": "R_X86_64_PC32", "symbol": "tally_counter", "addend": -4})
        self.assertEqual(found[4]["symbol"], ".rodata.str1.1")
        self.assertEqual(found[4]["addend"], 15)
        calls = [item for item in relocations(load("main-x86_64-O2.o")) if item["symbol"] == "puts"]
        self.assertEqual([(item["offset"], item["type"]) for item in calls], [(0x31, "R_X86_64_PLT32"), (0x10B, "R_X86_64_PLT32")])

    def test_coff_relocations_have_no_addend(self):
        found = relocations(load("tally-x86_64-O2.obj"))
        self.assertEqual([(item["section"], item["offset"], item["type"], item["symbol"]) for item in found[:4]], [
            (".text", 0x17, "IMAGE_REL_AMD64_REL32", "tally_counter"),
            (".text", 0x8E, "IMAGE_REL_AMD64_REL32", "tally_counter"),
            (".text", 0xF8, "IMAGE_REL_AMD64_REL32", "??_C@_0P@LILKFFBK@unknown?5bucket?$AA@"),
            (".text", 0x102, "IMAGE_REL_AMD64_REL32", "bucket_names"),
        ])
        self.assertTrue(all(item["addend"] is None for item in found))
        self.assertEqual({item["type"] for item in found[4:]}, {"IMAGE_REL_AMD64_ADDR64"})

    def test_macho_object_relocations(self):
        found = relocations(load("tally-arm64-O2.o"))
        self.assertIn({"section": "__text", "offset": 0xEC, "type": "ARM64_RELOC_GOT_LOAD_PAGE21", "symbol": "_tally_counter", "addend": None}, found)
        self.assertEqual(sum(1 for item in found if item["section"] == "__const"), 4)

    def test_pe_base_relocation(self):
        self.assertEqual(relocations(load("tiny-x86_64.exe")),
                         [{"section": ".data", "offset": 0x3000, "type": "IMAGE_REL_BASED_DIR64", "symbol": None, "addend": None}])

    def test_coff_relocation_with_missing_symbol(self):
        blob = bytearray(load("tally-x86_64-O2.obj"))
        pointer = struct.unpack_from("<I", blob, 20 + 24)[0]
        struct.pack_into("<I", blob, pointer + 4, 9999)
        with self.assertRaises(FormatError):
            relocations(bytes(blob))


class ImportsAndExports(unittest.TestCase):
    def test_pe_import_and_export_directories(self):
        blob = load("tiny-x86_64.exe")
        self.assertEqual([(item["library"], item["name"], item["hint"], item["slots"]) for item in imports(blob)], [
            ("kernel32.dll", "GetStdHandle", 0, [0x140002048]),
            ("kernel32.dll", "WriteConsoleA", 1, [0x140002050]),
            ("kernel32.dll", "ExitProcess", 2, [0x140002058]),
        ])
        self.assertEqual(exports(blob), [{"name": "tally_report", "address": 0x140001000, "ordinal": 1, "forwarder": None}])

    def test_macho_imports_come_from_chained_binds(self):
        found = imports(load("tally-arm64-O2.stripped"))
        self.assertEqual([(item["name"], item["slots"]) for item in found], [
            ("___stack_chk_fail", [0x100004000]), ("___stack_chk_guard", [0x100004008]),
            ("_printf", [0x100004010]), ("_puts", [0x100004018]),
        ])
        self.assertEqual({item["library"] for item in found}, {"/usr/lib/libSystem.B.dylib"})

    def test_exports_trie_survives_strip(self):
        expected = {"_tally_bucket": 0x5D0, "_tally_checksum": 0x61C, "_tally_counter": 0x8004, "_tally_name": 0x5F8,
                    "_tally_scale": 0x5B0, "_tally_sum": 0x4A8, "_tally_version": 0x8000}
        for name in ("libtally.dylib", "libtally.stripped.dylib"):
            self.assertEqual({item["name"]: item["address"] for item in exports(load(name))}, expected)

    def test_object_imports_are_undefined_globals(self):
        names = [item["name"] for item in imports(load("main-x86_64-O2.o"))]
        self.assertEqual(sorted(names), ["printf", "puts", "tally_bucket", "tally_checksum", "tally_name", "tally_scale", "tally_sum", "tally_version"])
        self.assertEqual([item["name"] for item in exports(load("main-x86_64-O2.o"))], ["main"])

    def test_exports_trie_cycle_is_rejected(self):
        blob = bytearray(load("libtally.dylib"))
        offset, size = linkedit(bytes(blob), "LC_DYLD_EXPORTS_TRIE")
        root_children = offset + 1
        edge_end = blob.index(b"\0", root_children + 1)
        blob[edge_end + 1] = 0
        with self.assertRaises(FormatError):
            exports(bytes(blob))


class ChainedFixups(unittest.TestCase):
    def test_chain_matches_dyld_info(self):
        result = chained_fixups(load("tally-arm64-O2"))
        self.assertEqual(result["header"]["imports_count"], 4)
        rows = [(item["address"], item["section"], item["kind"], item.get("name") or item.get("target")) for item in result["fixups"]]
        self.assertEqual(rows, [
            (0x100004000, "__got", "bind", "___stack_chk_fail"),
            (0x100004008, "__got", "bind", "___stack_chk_guard"),
            (0x100004010, "__got", "bind", "_printf"),
            (0x100004018, "__got", "bind", "_puts"),
            (0x100004020, "__const", "rebase", 0x10000098D),
            (0x100004028, "__const", "rebase", 0x100000991),
            (0x100004030, "__const", "rebase", 0x100000995),
            (0x100004038, "__const", "rebase", 0x10000099A),
        ])
        first = result["fixups"][0]
        self.assertEqual((first["offset"], first["raw"], first["next"], first["ordinal"]), (0x4000, 0x8010000000000000, 2, 0))
        self.assertEqual(result["fixups"][-1]["next"], 0)

    def test_no_fixups_outside_linked_macho(self):
        for name in ("tally-x86_64-O2.o", "tiny-x86_64.exe", "tally-arm64-O2.o"):
            self.assertEqual(chained_fixups(load(name)), {"header": None, "imports": [], "fixups": []})

    def test_chain_that_leaves_its_page(self):
        blob = bytearray(load("tally-arm64-O2"))
        struct.pack_into("<Q", blob, 0x4000, 0x8000000000000000 | (0xFFF << 51))
        with self.assertRaises(FormatError):
            chained_fixups(bytes(blob))

    def test_bind_ordinal_outside_import_table(self):
        blob = bytearray(load("tally-arm64-O2"))
        struct.pack_into("<Q", blob, 0x4000, 0x8010000000000032)
        with self.assertRaises(FormatError):
            chained_fixups(bytes(blob))


class HeldOut(unittest.TestCase):
    def test_second_program_linkage(self):
        result = chained_fixups(load("meter-arm64-O2.stripped", HELDOUT))
        self.assertEqual(sum(1 for item in result["fixups"] if item["kind"] == "rebase"), 5)
        self.assertEqual(result["fixups"][-1]["target"], 0x1000009BF)
        found = relocations(load("meter-x86_64-O2.obj", HELDOUT))
        self.assertEqual([item["symbol"] for item in found[:2]], ["meter_samples_seen", "meter_limit"])


if __name__ == "__main__":
    unittest.main()
