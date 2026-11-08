
import struct
import unittest
from pathlib import Path

from minidec.elf import ElfError, ElfObject, Target, load_object, relocation_target

PROJECT = Path(__file__).resolve().parents[3]
FIXTURES = PROJECT / "fixtures"
O0 = FIXTURES / "samples-x86_64-O0.o"
O1 = FIXTURES / "samples-x86_64-O1.o"
HELDOUT = FIXTURES / "heldout" / "extra-x86_64-O0.o"


class SectionAndSymbolTests(unittest.TestCase):
    def setUp(self):
        self.elf = load_object(O1)

    def test_sections_are_read_in_header_order_with_their_bytes(self):
        names = [section.name for section in self.elf.sections]
        self.assertEqual(names[:5], ["", ".strtab", ".text", ".rela.text", ".rodata"])
        self.assertEqual(self.elf.section(".text").size, 0xB2)
        self.assertEqual(len(self.elf.section(".text").data), 0xB2)
        self.assertEqual(self.elf.section(".rodata").data[:8], bytes.fromhex("0500000008000000"))

    def test_function_symbols_come_back_in_address_order_with_sizes(self):
        functions = [(s.name, s.value, s.size) for s in self.elf.functions()]
        self.assertEqual(
            functions,
            [("tenths_and_fifths", 0x0, 0x23), ("thirds", 0x30, 0x1A), ("band", 0x50, 0x17), ("fold", 0x70, 0x26), ("record", 0xA0, 0x12)],
        )

    def test_function_bytes_relocations_and_padding(self):
        band = self.elf.function("band")
        self.assertEqual(band.start, 0x50)
        self.assertEqual(band.size, 0x17)
        self.assertEqual(band.data[:5], bytes.fromhex("b8ffffffff"))
        self.assertEqual(band.padding_end, 0x70)
        self.assertEqual(band.padding, 9)
        self.assertEqual(len(band.relocations), 1)
        relocation = band.relocations[0]
        self.assertEqual((relocation.offset, relocation.type_name, relocation.symbol_name, relocation.addend), (0xF, "R_X86_64_PC32", ".rodata", -4))
        self.assertEqual(self.elf.function("record").relocations, ())
        self.assertEqual(self.elf.function("record").padding, 0)

    def test_pc_relative_target_adds_the_distance_to_the_end_of_the_instruction(self):
        relocation = self.elf.relocation_at(".text", 0x5F)
        self.assertIsNotNone(relocation)
        self.assertEqual(relocation.describe(), "R_X86_64_PC32 .rodata-0x4")
        self.assertEqual(relocation_target(relocation, 0x63), Target(".rodata", 0))
        with self.assertRaises(ValueError):
            relocation_target(relocation)

    def test_jump_table_entries_resolve_to_text_offsets(self):
        elf = load_object(O0)
        entries = elf.relocations[".rodata"]
        self.assertEqual(len(entries), 6)
        targets = [relocation_target(entry, 0).offset for entry in entries]
        self.assertEqual(targets, [0x78, 0x81, 0x8A, 0x93, 0x9C, 0xA5])
        self.assertEqual(elf.symbolize(0x8A), "band+0x3a")
        self.assertEqual(elf.symbolize(0x70), "band+0x20")
        self.assertEqual(elf.symbolize(0xC0), "fold")

    def test_unknown_names_raise(self):
        with self.assertRaises(ElfError):
            self.elf.section(".nothing")
        with self.assertRaises(ElfError):
            self.elf.function("missing")
        self.assertIsNone(self.elf.relocation_at(".text", 0x60))


class MalformedInputTests(unittest.TestCase):
    def test_non_elf_bytes_are_rejected(self):
        with self.assertRaises(ElfError):
            ElfObject(b"MZ" + bytes(100))
        with self.assertRaises(ElfError):
            ElfObject(b"\x7fELF")

    def test_wrong_class_endianness_machine_and_type_are_rejected(self):
        data = bytearray(O1.read_bytes())
        for offset, value, reason in ((4, 1, "class"), (5, 2, "endianness"), (18, 3, "machine"), (16, 2, "type")):
            patched = bytearray(data)
            patched[offset] = value
            with self.subTest(reason=reason), self.assertRaises(ElfError):
                ElfObject(bytes(patched))

    def test_truncated_file_and_table_outside_the_file_are_rejected(self):
        data = O1.read_bytes()
        with self.assertRaises(ElfError):
            ElfObject(data[:200])
        patched = bytearray(data)
        struct.pack_into("<Q", patched, 40, len(data) + 64)
        with self.assertRaises(ElfError):
            ElfObject(bytes(patched))

    def test_adversarial_relocation_symbol_index_is_rejected(self):
        data = bytearray(O1.read_bytes())
        elf = ElfObject(bytes(data))
        rela = elf.section(".rela.text")
        struct.pack_into("<Q", data, rela.offset + 8, (0xFFFF << 32) | 2)
        with self.assertRaises(ElfError):
            ElfObject(bytes(data))


class HeldOutTests(unittest.TestCase):
    def test_second_object_loads_with_its_own_functions_and_tables(self):
        elf = load_object(HELDOUT)
        self.assertEqual([s.name for s in elf.functions()], ["fifths", "quarter_band", "weighted", "span_end"])
        self.assertEqual(len(elf.relocations[".rodata"]), 5)
        self.assertEqual(elf.function("quarter_band").relocations[0].offset, 0x1B)
        self.assertEqual(relocation_target(elf.relocations[".text"][0], 0x3F), Target(".rodata", 0))


if __name__ == "__main__":
    unittest.main()
