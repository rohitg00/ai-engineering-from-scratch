
import unittest
from pathlib import Path

from minidec.decoder import DecodeError, Imm, Mem, Reg, compare_with_objdump, decode, disassemble, linear_sweep, parse_objdump
from minidec.elf import load_object

PROJECT = Path(__file__).resolve().parents[3]
FIXTURES = PROJECT / "fixtures"


def hexbytes(text):
    return bytes.fromhex(text.replace(" ", ""))


def at(text, address):
    return decode(bytes(address) + hexbytes(text), address)


class SingleInstructionTests(unittest.TestCase):
    def test_rex_w_imul_with_imm32(self):
        insn = decode(hexbytes("48 69 c0 67 66 66 66"), 0)
        self.assertEqual(insn.text, "imulq\t$0x66666667, %rax, %rax")
        self.assertEqual(insn.length, 7)
        self.assertEqual(insn.width, 64)
        self.assertEqual(insn.rex, 0x48)
        self.assertEqual(insn.immediate_offset, 3)
        self.assertEqual(insn.operands[0], Imm(0x66666667, 64))

    def test_removing_rex_w_changes_the_operand_size(self):
        self.assertEqual(decode(hexbytes("48 89 c1"), 0).text, "movq\t%rax, %rcx")
        self.assertEqual(decode(hexbytes("89 c1"), 0).text, "movl\t%eax, %ecx")

    def test_modrm_sib_and_signed_displacement(self):
        insn = at("03 04 97", 0x85)
        self.assertEqual(insn.text, "addl\t(%rdi,%rdx,4), %eax")
        memory = insn.memory
        self.assertEqual((memory.base, memory.index, memory.scale, memory.disp), ("rdi", "rdx", 4, 0))
        self.assertEqual(decode(hexbytes("89 7d f8"), 0).text, "movl\t%edi, -0x8(%rbp)")
        self.assertEqual(decode(hexbytes("48 63 04 81"), 0).text, "movslq\t(%rcx,%rax,4), %rax")

    def test_rip_relative_lea_records_the_displacement_field_offset(self):
        insn = at("48 8d 0d 00 00 00 00", 0x5C)
        self.assertEqual(insn.text, "leaq\t(%rip), %rcx")
        self.assertEqual(insn.displacement_offset, 3)
        self.assertTrue(insn.memory.rip)
        self.assertEqual(insn.end, 0x63)

    def test_prefixes_segment_override_and_sixteen_bit_nop(self):
        insn = decode(hexbytes("66 66 66 66 2e 0f 1f 84 00 00 00 00 00"), 0)
        self.assertEqual(insn.text, "nopw\t%cs:(%rax,%rax)")
        self.assertEqual(insn.length, 13)
        self.assertEqual(insn.prefixes, (0x66, 0x66, 0x66, 0x66, 0x2E))

    def test_immediates_are_signed_for_arithmetic_and_unsigned_for_mov_and_shifts(self):
        self.assertEqual(decode(hexbytes("83 c0 fe"), 0).text, "addl\t$-0x2, %eax")
        self.assertEqual(decode(hexbytes("b8 ff ff ff ff"), 0).text, "movl\t$0xffffffff, %eax")
        self.assertEqual(decode(hexbytes("48 c1 ea 3f"), 0).text, "shrq\t$0x3f, %rdx")
        self.assertEqual(decode(hexbytes("c7 45 fc ff ff ff ff"), 0).text, "movl\t$0xffffffff, -0x4(%rbp)")

    def test_branch_targets_are_relative_to_the_next_instruction(self):
        insn = at("77 0c", 0x58)
        self.assertEqual((insn.op, insn.cc, insn.flow, insn.target), ("jcc", "a", "branch", 0x66))
        self.assertEqual(insn.text, "ja\t0x66")
        back = at("75 ee", 0x90)
        self.assertEqual(back.target, 0x80)
        jump = at("ff e0", 0x76)
        self.assertEqual((jump.text, jump.flow), ("jmpq\t*%rax", "indirect-jump"))
        self.assertEqual(decode(hexbytes("c3"), 0).flow, "return")


class MalformedInputTests(unittest.TestCase):
    def test_unknown_opcode_names_the_address_and_the_byte(self):
        with self.assertRaises(DecodeError) as caught:
            decode(hexbytes("90 0f 0a"), 1)
        self.assertEqual(caught.exception.address, 1)
        self.assertIn("0f 0a", caught.exception.reason)

    def test_truncated_instruction_raises_instead_of_reading_past_the_end(self):
        with self.assertRaises(DecodeError):
            decode(hexbytes("48 69 c0 67 66"), 0)
        with self.assertRaises(DecodeError):
            decode(hexbytes("48"), 0)

    def test_instruction_longer_than_fifteen_bytes_is_refused(self):
        with self.assertRaises(DecodeError) as caught:
            decode(bytes([0x66] * 15) + hexbytes("90"), 0)
        self.assertIn("15", caught.exception.reason)
        with self.assertRaises(DecodeError):
            decode(hexbytes("90"), 5)

    def test_linear_sweep_records_undecodable_bytes_and_continues(self):
        result = linear_sweep(hexbytes("31 c0 0f 0a c3"))
        self.assertEqual([i.text for i in result.instructions], ["xorl\t%eax, %eax", "retq"])
        self.assertEqual(result.undecodable, [(2, 0x0F), (3, 0x0A)])


class OracleTests(unittest.TestCase):
    def check(self, stem):
        elf = load_object(FIXTURES / f"{stem}.o")
        oracle = (FIXTURES / f"{stem}.objdump.txt").read_text(encoding="utf-8")
        comparison = compare_with_objdump(elf, oracle)
        self.assertTrue(comparison.agree, comparison.mismatches[:5])
        return comparison

    def test_parse_objdump_drops_relocation_lines_comments_and_symbol_suffixes(self):
        rows = parse_objdump((FIXTURES / "samples-x86_64-O1.objdump.txt").read_text(encoding="utf-8"))
        by_address = {address: (raw, text) for address, raw, text in rows}
        self.assertEqual(by_address[0x5C], ("48 8d 0d 00 00 00 00", "leaq (%rip), %rcx"))
        self.assertEqual(by_address[0x58], ("77 0c", "ja 0x66"))
        self.assertNotIn(0x5F, by_address)

    def test_every_instruction_of_the_O0_object_agrees_with_llvm_objdump(self):
        self.assertEqual(self.check("samples-x86_64-O0").compared, 102)

    def test_every_instruction_of_the_O1_object_agrees_with_llvm_objdump(self):
        self.assertEqual(self.check("samples-x86_64-O1").compared, 56)

    def test_listing_names_the_relocation_target_after_the_lea(self):
        listing = disassemble(load_object(FIXTURES / "samples-x86_64-O1.o"))
        line = next(line for line in listing.splitlines() if line.strip().startswith("5c:"))
        self.assertIn("R_X86_64_PC32 .rodata-0x4 -> .rodata+0x0", line)
        self.assertIn("<band>:", listing)


class HeldOutTests(unittest.TestCase):
    def test_held_out_objects_agree_with_their_listings(self):
        for stem, count in (("heldout/extra-x86_64-O0", 76), ("heldout/extra-x86_64-O1", 38)):
            with self.subTest(stem=stem):
                elf = load_object(FIXTURES / f"{stem}.o")
                comparison = compare_with_objdump(elf, (FIXTURES / f"{stem}.objdump.txt").read_text(encoding="utf-8"))
                self.assertTrue(comparison.agree, comparison.mismatches[:5])
                self.assertEqual(comparison.compared, count)

    def test_memory_operand_imul_and_three_register_lea_from_the_held_out_object(self):
        self.assertEqual(decode(hexbytes("6b 0c 91 03"), 0).text, "imull\t$0x3, (%rcx,%rdx,4), %ecx")
        insn = decode(hexbytes("8d 34 76"), 0)
        self.assertEqual(insn.text, "leal\t(%rsi,%rsi,2), %esi")
        self.assertEqual(insn.operands[1], Reg("esi", 32))
        self.assertIsInstance(insn.operands[0], Mem)


if __name__ == "__main__":
    unittest.main()
