"""Read the lesson fixtures with LIEF, pyelftools, and pefile and print what each library reports.
Run with an interpreter that has `pip install lief pyelftools pefile` (lief 1.0.0, pyelftools 0.33, pefile 2024.8.26).
The captured output lives in probe-libs.txt beside this script. The lesson itself needs none of these packages."""

from __future__ import annotations

import sys
from pathlib import Path

import lief
import pefile
from elftools.elf.descriptions import describe_reloc_type
from elftools.elf.dynamic import DynamicSection
from elftools.elf.elffile import ELFFile
from elftools.elf.relocation import RelocationSection

FIXTURES = Path(__file__).resolve().parent
lief.logging.disable()

print("lief", lief.__version__, "| pyelftools", __import__("elftools").__version__, "| pefile", pefile.__version__)

print("\n== pyelftools: tiny-dyn-x86_64")
with open(FIXTURES / "tiny-dyn-x86_64", "rb") as handle:
    elf = ELFFile(handle)
    print(" e_type", elf.header["e_type"], "| e_machine", elf.header["e_machine"], "| sections", elf.num_sections())
    for section in elf.iter_sections():
        if isinstance(section, DynamicSection):
            for tag in section.iter_tags():
                extra = f" {tag.needed}" if tag.entry.d_tag == "DT_NEEDED" else ""
                print(f"  {tag.entry.d_tag} {tag.entry.d_val:#x}{extra}")
        if isinstance(section, RelocationSection):
            symbols = elf.get_section(section["sh_link"])
            for relocation in section.iter_relocations():
                name = symbols.get_symbol(relocation["r_info_sym"]).name
                print(f"  {section.name} {relocation['r_offset']:#x} {describe_reloc_type(relocation['r_info_type'], elf)} {name}")

print("\n== pyelftools: main-x86_64-O1.o relocations")
with open(FIXTURES / "main-x86_64-O1.o", "rb") as handle:
    elf = ELFFile(handle)
    for section in elf.iter_sections():
        if isinstance(section, RelocationSection):
            symbols = elf.get_section(section["sh_link"])
            for relocation in section.iter_relocations():
                symbol = symbols.get_symbol(relocation["r_info_sym"])
                name = symbol.name or elf.get_section(symbol["st_shndx"]).name
                print(f"  {section.name} {relocation['r_offset']:#x} {describe_reloc_type(relocation['r_info_type'], elf)} {name}{relocation['r_addend']:+#x}")

print("\n== lief: main-x86_64.obj (COFF)")
coff = lief.parse(str(FIXTURES / "main-x86_64.obj"))
print(" type", type(coff).__name__, "| machine", coff.header.machine)
print(" sections", [section.name for section in coff.sections])
print(" relocations", [(hex(r.address), str(r.type).split(".")[-1], r.symbol.name if r.symbol else None) for r in coff.relocations])
print(" functions", [function.name for function in coff.functions])

print("\n== pefile: main-x86_64.obj (a COFF object is not an image)")
try:
    pefile.PE(str(FIXTURES / "main-x86_64.obj"))
    print(" parsed")
except pefile.PEFormatError as error:
    print(" PEFormatError:", error)

print("\n== pefile: tiny-x86_64.exe")
pe = pefile.PE(str(FIXTURES / "tiny-x86_64.exe"))
print(" Magic", hex(pe.OPTIONAL_HEADER.Magic), "| ImageBase", hex(pe.OPTIONAL_HEADER.ImageBase), "| EntryPoint", hex(pe.OPTIONAL_HEADER.AddressOfEntryPoint), "| DllCharacteristics", hex(pe.OPTIONAL_HEADER.DllCharacteristics))
print(" sections", [(s.Name.rstrip(b"\0").decode(), hex(s.VirtualAddress), s.SizeOfRawData) for s in pe.sections])
for entry in pe.DIRECTORY_ENTRY_IMPORT:
    print(" import", entry.dll.decode(), [(i.name.decode(), hex(i.address), i.hint) for i in entry.imports])
print(" exports", [(s.ordinal, hex(s.address), s.name.decode()) for s in pe.DIRECTORY_ENTRY_EXPORT.symbols])
print(" base relocations", [(hex(e.rva), e.type) for block in pe.DIRECTORY_ENTRY_BASERELOC for e in block.entries])
print(" warnings", pe.get_warnings())

print("\n== lief: ledger_main (Mach-O)")
macho = lief.MachO.parse(str(FIXTURES / "ledger_main")).at(0)
print(" flags", [str(f).split(".")[-1] for f in macho.header.flags_list])
print(" commands", [str(c.command).split(".")[-1] for c in macho.commands])
print(" libraries", [library.name for library in macho.libraries])
fixups = macho.dyld_chained_fixups
print(" chained fixups: version", fixups.fixups_version, "imports_count", fixups.imports_count, "imports_format", str(fixups.imports_format).split(".")[-1])
print(" starts", [(str(s.pointer_format).split(".")[-1], s.page_size, s.page_count) for s in fixups.chained_starts_in_segments if s.page_count])
print(" bindings", [(hex(b.address), b.symbol.name if b.symbol else None, b.library.name.split("/")[-1] if b.library else None) for b in macho.bindings])
print(" rebases", [(hex(r.address), str(r.type).split(".")[-1]) for r in macho.relocations])
print(" function_starts", [hex(f) for f in macho.function_starts.functions])
print(" imported_functions", [s.name for s in macho.imported_functions])
print(" stubs", [(s.name, s.segment_name, hex(s.virtual_address), s.size, s.reserved1, s.reserved2) for s in macho.sections if s.name == "__stubs"])

print("\n== lief: libledger.stripped.dylib exports trie")
dylib = lief.MachO.parse(str(FIXTURES / "libledger.stripped.dylib")).at(0)
print(" symbols", len(dylib.symbols), "| exports", [(e.symbol.name, hex(e.address)) for e in dylib.dyld_exports_trie.exports])
sys.exit(0)
