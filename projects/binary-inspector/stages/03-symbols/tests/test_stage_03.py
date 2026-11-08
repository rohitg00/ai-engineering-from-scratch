import os
import struct
import unittest
from pathlib import Path

from binspect.formats import FormatError
from binspect.layout import sections
from binspect.symbols import demangle, read_cstring, symbols

ROOT = Path(os.environ.get("PROJECT_ROOT", Path(__file__).resolve().parents[3]))
FIXTURES = ROOT / "solution" / "fixtures"
HELDOUT = ROOT / "heldout"
KEYS = {"index", "name", "demangled", "value", "size", "kind", "binding", "section", "defined", "table"}


def load(name, folder=FIXTURES):
    return (folder / name).read_bytes()


def named(items):
    return {item["name"]: item for item in items}


class CStrings(unittest.TestCase):
    def test_reads_up_to_nul(self):
        self.assertEqual(read_cstring(b"\0main\0puts\0", 1), "main")
        self.assertEqual(read_cstring(b"\0main\0puts\0", 6), "puts")
        self.assertEqual(read_cstring(b"\0main\0", 0), "")

    def test_missing_terminator_and_bad_offset(self):
        with self.assertRaises(FormatError):
            read_cstring(b"main", 0)
        with self.assertRaises(FormatError):
            read_cstring(b"main\0puts\0", 0, 3)
        with self.assertRaises(FormatError):
            read_cstring(b"main\0", 9)


class Demangle(unittest.TestCase):
    def test_fixture_names_match_cxxfilt(self):
        self.assertEqual(demangle("_ZN5tally7Counter3addEi"), "tally::Counter::add(int)")
        self.assertEqual(demangle("_ZNK5tally7Counter5totalEv"), "tally::Counter::total() const")
        self.assertEqual(demangle("_ZN5tally5scaleEdi"), "tally::scale(double, int)")
        self.assertEqual(demangle("_ZN5tally5resetEPNS_7CounterE"), "tally::reset(tally::Counter*)")
        self.assertEqual(demangle("_ZN5tally5clampElll"), "tally::clamp(long, long, long)")

    def test_mach_o_underscore_and_qualifiers(self):
        self.assertEqual(demangle("__ZN5tally5scaleEdi"), "tally::scale(double, int)")
        self.assertEqual(demangle("_Z1fPKc"), "f(char const*)")
        self.assertEqual(demangle("_Z1fRKiS_"), "f(int const&, int const)")
        self.assertEqual(demangle("_ZSt4moveRi"), "std::move(int&)")

    def test_not_mangled_or_outside_the_subset(self):
        for name in ("main", "tally_sum", "?x@@YAHXZ", "_Z", "_Z9", "_Z1fS_", "_Z3fooIiEvT_", "", None):
            self.assertIsNone(demangle(name), name)


class ElfSymbols(unittest.TestCase):
    def test_symtab_matches_objdump(self):
        found = symbols(load("tally-x86_64-O2.o"))
        self.assertTrue(all(set(item) >= KEYS for item in found))
        table = named(found)
        tally_sum = table["tally_sum"]
        self.assertEqual((tally_sum["value"], tally_sum["size"], tally_sum["kind"], tally_sum["binding"], tally_sum["section"]),
                         (0, 0x92, "func", "global", ".text"))
        self.assertEqual((table["tally_counter"]["kind"], table["tally_counter"]["section"]), ("object", ".bss"))
        self.assertEqual(table["tally.c"]["kind"], "file")
        self.assertEqual(table[".rodata"]["kind"], "section")
        self.assertEqual({item["table"] for item in found}, {"symtab"})

    def test_undefined_symbols_in_main(self):
        table = named(symbols(load("main-x86_64-O2.o")))
        self.assertFalse(table["puts"]["defined"])
        self.assertIsNone(table["puts"]["section"])
        self.assertTrue(table["main"]["defined"])

    def test_demangled_field(self):
        table = named(symbols(load("names-x86_64-O2.o")))
        self.assertEqual(table["_ZN5tally5clampElll"]["demangled"], "tally::clamp(long, long, long)")
        self.assertIsNone(table["names.cpp"]["demangled"])

    def test_name_offset_outside_string_table(self):
        blob = bytearray(load("tally-x86_64-O2.o"))
        symtab = next(item for item in sections(bytes(blob)) if item["type"] == "SYMTAB")
        struct.pack_into("<I", blob, symtab["offset"] + 24, 0x7FFFFFF0)
        with self.assertRaises(FormatError):
            symbols(bytes(blob))


class CoffSymbols(unittest.TestCase):
    def test_records_skip_auxiliary_entries(self):
        found = symbols(load("tally-x86_64-O2.obj"))
        self.assertEqual(len(found), 25)
        table = named(found)
        self.assertEqual((table["tally_scale"]["value"], table["tally_scale"]["kind"], table["tally_scale"]["index"]), (0xA0, "func", 28))
        self.assertEqual(table["bucket_names"]["binding"], "local")
        self.assertEqual(table["??_C@_03IMLOALHE@low?$AA@"]["section"], ".rdata")
        self.assertEqual(table[".file"]["kind"], "file")

    def test_pe_image_has_no_symbol_table(self):
        self.assertEqual(symbols(load("tiny-x86_64.exe")), [])


class MachOSymbols(unittest.TestCase):
    def test_nlist_of_linked_executable(self):
        table = named(symbols(load("tally-arm64-O2")))
        self.assertEqual(table["_tally_sum"]["value"], 0x100000740)
        self.assertEqual(table["_tally_sum"]["kind"], "func")
        self.assertEqual(table["_banner"]["binding"], "local")
        self.assertEqual(table["_banner"]["kind"], "object")
        self.assertFalse(table["_puts"]["defined"])

    def test_strip_keeps_only_dynamic_names(self):
        names = {item["name"] for item in symbols(load("tally-arm64-O2.stripped"))}
        self.assertEqual(names, {"___stack_chk_fail", "___stack_chk_guard", "__mh_execute_header", "_printf", "_puts"})
        self.assertEqual(symbols(load("libtally.stripped.dylib")), [])

    def test_object_common_symbol(self):
        table = named(symbols(load("tally-arm64-O2.o")))
        self.assertEqual(table["_tally_counter"]["section"], "*COMMON*")
        self.assertEqual(table["_tally_checksum"]["value"], 0x174)


class HeldOut(unittest.TestCase):
    def test_second_program_symbols(self):
        table = named(symbols(load("meter-x86_64-O2.o", HELDOUT)))
        self.assertEqual((table["meter_average"]["value"], table["meter_average"]["size"]), (0x10, 0x95))
        main = named(symbols(load("meter_main-x86_64-O2.o", HELDOUT)))
        self.assertEqual(sorted(name for name, item in main.items() if not item["defined"] and item["binding"] == "global"),
                         ["meter_average", "meter_hash", "meter_level", "meter_level_name", "meter_limit", "printf", "puts"])


if __name__ == "__main__":
    unittest.main()
