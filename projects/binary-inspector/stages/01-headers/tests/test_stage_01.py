import os
import struct
import unittest
from pathlib import Path

from binspect.formats import FormatError, detect_format, load_commands, parse_header

ROOT = Path(os.environ.get("PROJECT_ROOT", Path(__file__).resolve().parents[3]))
FIXTURES = ROOT / "solution" / "fixtures"
HELDOUT = ROOT / "heldout"


def load(name, folder=FIXTURES):
    return (folder / name).read_bytes()


class DetectFormat(unittest.TestCase):
    def test_each_fixture_family(self):
        self.assertEqual(detect_format(load("tally-x86_64-O2.o")), "elf64")
        self.assertEqual(detect_format(load("tally-x86_64-O2.obj")), "coff")
        self.assertEqual(detect_format(load("tiny-x86_64.exe")), "pe")
        self.assertEqual(detect_format(load("tally-arm64-O2")), "macho64")
        self.assertEqual(detect_format(load("libtally.dylib")), "macho64")

    def test_too_short_and_unknown(self):
        for blob in (b"", b"\x7fEL", b"int main(void) { return 0; }\n"):
            with self.assertRaises(FormatError):
                detect_format(blob)

    def test_unsupported_variants_name_the_reason(self):
        elf32 = b"\x7fELF\x01\x01\x01" + bytes(57)
        with self.assertRaisesRegex(FormatError, "ELF64"):
            detect_format(elf32)
        with self.assertRaisesRegex(FormatError, "big-endian|little-endian"):
            detect_format(b"\x7fELF\x02\x02\x01" + bytes(57))
        with self.assertRaisesRegex(FormatError, "32-bit"):
            detect_format(struct.pack("<I", 0xFEEDFACE) + bytes(28))
        with self.assertRaisesRegex(FormatError, "universal|fat"):
            detect_format(b"\xca\xfe\xba\xbe" + bytes(28))

    def test_format_error_is_a_value_error(self):
        self.assertTrue(issubclass(FormatError, ValueError))


class ElfHeader(unittest.TestCase):
    def test_relocatable_object(self):
        header = parse_header(load("tally-x86_64-O2.o"))
        self.assertEqual((header["format"], header["arch"], header["kind"]), ("elf64", "x86_64", "relocatable"))
        self.assertEqual((header["bits"], header["endian"]), (64, "little"))
        self.assertIsNone(header["entry"])
        self.assertEqual(header["fields"]["e_shnum"], 13)
        self.assertEqual(header["fields"]["e_shstrndx"], 1)
        self.assertEqual(header["fields"]["e_phnum"], 0)

    def test_section_table_past_end_is_rejected(self):
        blob = bytearray(load("tally-x86_64-O2.o"))
        struct.pack_into("<Q", blob, 0x28, len(blob) - 64)
        with self.assertRaises(FormatError):
            parse_header(bytes(blob))

    def test_truncated_header(self):
        with self.assertRaises(FormatError):
            parse_header(load("tally-x86_64-O2.o")[:40])


class CoffAndPe(unittest.TestCase):
    def test_coff_object(self):
        header = parse_header(load("tally-x86_64-O2.obj"))
        self.assertEqual((header["format"], header["arch"], header["kind"]), ("coff", "x86_64", "relocatable"))
        self.assertEqual(header["fields"]["machine"], 0x8664)
        self.assertEqual(header["fields"]["number_of_sections"], 10)
        self.assertEqual(header["fields"]["number_of_symbols"], 36)
        self.assertIsNone(header["entry"])

    def test_pe32_plus_image(self):
        header = parse_header(load("tiny-x86_64.exe"))
        fields = header["fields"]
        self.assertEqual((header["format"], header["kind"]), ("pe", "executable"))
        self.assertEqual(fields["magic"], 0x20B)
        self.assertEqual(fields["image_base"], 0x140000000)
        self.assertEqual(header["entry"], 0x140001000)
        self.assertEqual(fields["subsystem"], 3)
        self.assertEqual(fields["dll_characteristics"], 0x8160)
        self.assertEqual(set(fields["dll_flags"]), {"HIGH_ENTROPY_VA", "DYNAMIC_BASE", "NX_COMPAT", "TERMINAL_SERVER_AWARE"})
        self.assertEqual(set(fields["data_directories"]), {"export", "import", "basereloc", "iat"})

    def test_pe_signature_offset_past_end(self):
        blob = bytearray(load("tiny-x86_64.exe"))
        struct.pack_into("<I", blob, 0x3C, len(blob) + 16)
        with self.assertRaises(FormatError):
            parse_header(bytes(blob))

    def test_pe32_magic_is_refused(self):
        blob = bytearray(load("tiny-x86_64.exe"))
        struct.pack_into("<H", blob, 0x58, 0x10B)
        with self.assertRaisesRegex(FormatError, "PE32"):
            parse_header(bytes(blob))


class MachO(unittest.TestCase):
    def test_linked_executable(self):
        header = parse_header(load("tally-arm64-O2"))
        self.assertEqual((header["format"], header["arch"], header["kind"]), ("macho64", "arm64", "executable"))
        self.assertEqual(header["entry"], 0x1000005E8)
        self.assertEqual(header["fields"]["ncmds"], 18)
        self.assertEqual(set(header["fields"]["flag_names"]), {"MH_NOUNDEFS", "MH_DYLDLINK", "MH_TWOLEVEL", "MH_PIE"})

    def test_load_command_order_matches_otool(self):
        names = [command["name"] for command in load_commands(load("tally-arm64-O2"))]
        self.assertEqual(names, [
            "LC_SEGMENT_64", "LC_SEGMENT_64", "LC_SEGMENT_64", "LC_SEGMENT_64", "LC_SEGMENT_64",
            "LC_DYLD_CHAINED_FIXUPS", "LC_DYLD_EXPORTS_TRIE", "LC_SYMTAB", "LC_DYSYMTAB", "LC_LOAD_DYLINKER",
            "LC_UUID", "LC_BUILD_VERSION", "LC_SOURCE_VERSION", "LC_MAIN", "LC_LOAD_DYLIB",
            "LC_FUNCTION_STARTS", "LC_DATA_IN_CODE", "LC_CODE_SIGNATURE",
        ])
        commands = load_commands(load("tally-arm64-O2"))
        self.assertEqual(commands[0]["offset"], 32)
        for before, after in zip(commands, commands[1:]):
            self.assertEqual(before["offset"] + before["size"], after["offset"])

    def test_object_and_dylib_kinds(self):
        self.assertEqual(parse_header(load("tally-arm64-O2.o"))["kind"], "relocatable")
        self.assertEqual(parse_header(load("libtally.dylib"))["kind"], "shared")
        self.assertIsNone(parse_header(load("libtally.dylib"))["entry"])

    def test_zero_size_load_command(self):
        blob = bytearray(load("tally-arm64-O2"))
        struct.pack_into("<I", blob, 32 + 4, 0)
        with self.assertRaisesRegex(FormatError, "load command"):
            parse_header(bytes(blob))

    def test_sizeofcmds_past_end(self):
        blob = bytearray(load("tally-arm64-O2")[:4096])
        struct.pack_into("<I", blob, 20, 1 << 20)
        with self.assertRaises(FormatError):
            load_commands(bytes(blob))


class HeldOut(unittest.TestCase):
    def test_second_program(self):
        stripped = parse_header(load("meter-arm64-O2.stripped", HELDOUT))
        self.assertEqual(stripped["entry"], 0x1000005E8)
        self.assertEqual(parse_header(load("meter-x86_64-O2.obj", HELDOUT))["fields"]["number_of_sections"], 11)
        self.assertEqual(parse_header(load("meter_main-x86_64-O2.o", HELDOUT))["kind"], "relocatable")


if __name__ == "__main__":
    unittest.main()
