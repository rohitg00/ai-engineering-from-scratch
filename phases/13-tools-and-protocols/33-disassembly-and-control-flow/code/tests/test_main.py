import json
import re
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
SITE_MODULE = Path(__file__).resolve().parents[5] / "site" / "figures-re-33.js"


def decode_bytes(hex_text: str, address: int = 0) -> main.Instruction:
    code = bytes.fromhex(hex_text.replace(" ", ""))
    return main.decode(b"\x90" * address + code, address)


class DecoderTests(unittest.TestCase):
    def test_decoder_agrees_with_llvm_objdump_on_every_fixture_instruction(self) -> None:
        compared = 0
        for name in main.FIXTURE_OBJECTS:
            elf = main.load_fixture(name)
            oracle = (FIXTURES / name.replace(".o", ".objdump.txt")).read_text()
            report = main.compare_with_oracle(elf, oracle)
            self.assertEqual(report["mismatches"], [], name)
            self.assertTrue(report["agree"], name)
            self.assertGreater(report["compared"], 0, name)
            compared += report["compared"]
        self.assertEqual(compared, 86 + 56 + 84 + 11)

    def test_rex_w_selects_64_bit_operands_and_rex_r_b_extend_registers(self) -> None:
        self.assertEqual(decode_bytes("48 89 e5").text, "movq\t%rsp, %rbp")
        self.assertEqual(decode_bytes("89 e5").text, "movl\t%esp, %ebp")
        self.assertEqual(decode_bytes("4c 89 c0").text, "movq\t%r8, %rax")
        self.assertEqual(decode_bytes("41 50").text, "pushq\t%r8")
        self.assertEqual(decode_bytes("66 89 e5").text, "movw\t%sp, %bp")

    def test_modrm_and_sib_forms_render_the_att_memory_operand(self) -> None:
        self.assertEqual(decode_bytes("8d 44 08 fa").text, "leal\t-0x6(%rax,%rcx), %eax")
        self.assertEqual(decode_bytes("48 63 04 81").text, "movslq\t(%rcx,%rax,4), %rax")
        self.assertEqual(decode_bytes("03 04 97").text, "addl\t(%rdi,%rdx,4), %eax")
        self.assertEqual(decode_bytes("f3 0f 6f 54 37 10").text, "movdqu\t0x10(%rdi,%rsi), %xmm2")
        self.assertEqual(decode_bytes("89 7d f8").text, "movl\t%edi, -0x8(%rbp)")

    def test_rip_relative_displacement_is_recorded_with_its_field_offset(self) -> None:
        instruction = decode_bytes("48 8d 0d 00 00 00 00")
        self.assertEqual(instruction.text, "leaq\t(%rip), %rcx")
        self.assertEqual(instruction.displacement_offset, 3)
        assert instruction.memory is not None
        self.assertTrue(instruction.memory.rip_relative)
        self.assertEqual(decode_bytes("48 8d 0d 06 00 00 00").text, "leaq\t0x6(%rip), %rcx")

    def test_repeated_legacy_prefixes_and_segment_override_decode_like_the_oracle(self) -> None:
        instruction = decode_bytes("66 66 66 66 66 2e 0f 1f 84 00 00 00 00 00")
        self.assertEqual(instruction.text, "nopw\t%cs:(%rax,%rax)")
        self.assertEqual(instruction.length, 14)
        self.assertEqual(decode_bytes("66 90").text, "nop")
        self.assertEqual(decode_bytes("0f 1f 40 00").text, "nopl\t(%rax)")

    def test_mandatory_66_prefix_selects_the_sse_opcode_and_keeps_32_bit_registers(self) -> None:
        self.assertEqual(decode_bytes("66 0f ef c0").text, "pxor\t%xmm0, %xmm0")
        self.assertEqual(decode_bytes("66 0f 7e c8").text, "movd\t%xmm1, %eax")
        self.assertEqual(decode_bytes("66 0f 70 c1 ee").text, "pshufd\t$0xee, %xmm1, %xmm0")

    def test_immediates_are_sign_extended_except_shift_counts_and_shuffle_selectors(self) -> None:
        self.assertEqual(decode_bytes("83 c1 fa").text, "addl\t$-0x6, %ecx")
        self.assertEqual(decode_bytes("48 c1 e8 3f").text, "shrq\t$0x3f, %rax")
        self.assertEqual(decode_bytes("48 69 c0 67 66 66 66").text, "imulq\t$0x66666667, %rax, %rax")
        self.assertEqual(decode_bytes("25 ff ff ff 0f").text, "andl\t$0xfffffff, %eax")

    def test_length_limit_truncation_and_unknown_opcodes_raise_decode_error(self) -> None:
        with self.assertRaises(main.DecodeError):
            main.decode(bytes([0x66] * 15 + [0x90]), 0)
        self.assertEqual(main.decode(bytes([0x66] * 14 + [0x90]), 0).length, 15)
        with self.assertRaises(main.DecodeError):
            main.decode(bytes.fromhex("48 8d 0d 00 00"), 0)
        with self.assertRaises(main.DecodeError):
            main.decode(bytes.fromhex("0f 0a"), 0)
        with self.assertRaises(main.DecodeError):
            main.decode(b"\x90", 1)

    def test_relative_branches_target_the_next_instruction_plus_displacement(self) -> None:
        self.assertEqual(decode_bytes("74 09", 2).target, 0xD)
        self.assertEqual(decode_bytes("eb dc", 0xEB).target, 0xC9)
        self.assertEqual(decode_bytes("ff e0").flow, "indirect-jump")
        self.assertEqual(decode_bytes("ff e0").text, "jmpq\t*%rax")
        self.assertEqual(decode_bytes("c3").flow, "return")
        self.assertEqual(decode_bytes("e8 00 00 00 00", 0x10E).target, 0x113)


class RelocationTests(unittest.TestCase):
    def test_pc32_on_a_lea_points_four_bytes_past_the_addend(self) -> None:
        elf = main.load_fixture("ledger-x86_64-O0.o")
        lea = main.decode(elf.section(".text").data, 0x66)
        reference = main.resolve_reference(elf, lea)
        assert reference is not None
        self.assertEqual(reference.relocation.describe(), "R_X86_64_PC32 .rodata-0x4")
        self.assertEqual((reference.section, reference.offset), (".rodata", 0x0))
        o1 = main.load_fixture("ledger-x86_64-O1.o")
        reference_o1 = main.resolve_reference(o1, main.decode(o1.section(".text").data, 0x33))
        assert reference_o1 is not None
        self.assertEqual((reference_o1.section, reference_o1.offset), (".rodata", 0x14))

    def test_plt32_on_a_call_resolves_to_the_callee_symbol(self) -> None:
        elf = main.load_fixture("ledger-x86_64-O0.o")
        call = main.decode(elf.section(".text").data, 0x10E)
        self.assertEqual(call.target, 0x113)
        reference = main.resolve_reference(elf, call)
        assert reference is not None
        self.assertEqual(reference.relocation.symbol.name, "grade")
        self.assertEqual((reference.section, reference.offset), (".text", 0x30))
        self.assertEqual(reference.field, "immediate")

    def test_elf_reader_exposes_functions_sections_and_relocation_tables(self) -> None:
        elf = main.load_fixture("ledger-x86_64-O1.o")
        self.assertEqual([s.name for s in elf.functions()], ["percent_change", "grade", "total", "grade_label"])
        self.assertEqual(elf.section(".text").size, 0x9F)
        self.assertEqual(len(elf.relocations[".text"]), 3)
        self.assertEqual(len(elf.relocations[".rodata"]), 5)
        self.assertEqual(elf.symbolize(0x3D), "grade+0x2d")
        self.assertEqual(elf.symbolize(0x40), "total")
        self.assertEqual(elf.function_extent("grade"), (0x10, 0x3E, 0x40))


class SweepAndDescentTests(unittest.TestCase):
    def test_linear_sweep_decodes_the_trap_table_as_code_and_misses_the_jump_target(self) -> None:
        report = main.trap_report(main.load_fixture("sweep-trap.o"))
        self.assertEqual(report["dataBytes"]["hex"], "31 c0 90 48")
        self.assertEqual(report["linearSweep"]["claimedDataBytes"], 4)
        self.assertEqual(report["linearSweep"]["claimedPaddingBytes"], 8)
        self.assertEqual(report["linearSweep"]["atJumpTarget"]["starts"], "0x13")
        self.assertFalse(report["linearSweep"]["atJumpTarget"]["startsAtTarget"])
        self.assertEqual(report["linearSweep"]["atJumpTarget"]["text"], "addq\t$0x1, %rax")

    def test_recursive_descent_never_claims_the_trap_table_or_the_padding(self) -> None:
        report = main.trap_report(main.load_fixture("sweep-trap.o"))
        self.assertEqual(report["recursiveDescent"]["claimedDataBytes"], 0)
        self.assertEqual(report["recursiveDescent"]["claimedPaddingBytes"], 0)
        self.assertEqual(report["recursiveDescent"]["atJumpTarget"], "addl\t$0x1, %eax")
        self.assertEqual(report["recursiveDescent"]["instructions"], 6)

    def test_sweep_and_objdump_share_the_same_mistake(self) -> None:
        elf = main.load_fixture("sweep-trap.o")
        oracle = (FIXTURES / "sweep-trap.objdump.txt").read_text()
        rows = main.parse_objdump(oracle)
        self.assertIn((0x13, "48 83 c0 01", "addq $0x1, %rax"), rows)
        self.assertTrue(main.compare_with_oracle(elf, oracle)["agree"])

    def test_descent_records_a_conflict_when_an_entry_points_inside_an_instruction(self) -> None:
        code = bytes.fromhex("48 83 c0 01 c3")
        result = main.recursive_descent(code, [0, 3])
        self.assertEqual(sorted(result.instructions), [0, 4])
        self.assertEqual(result.conflicts, [(3, 0)])

    def test_descent_stops_at_an_unresolved_indirect_jump_and_records_it(self) -> None:
        elf = main.load_fixture("ledger-x86_64-O0.o")
        start, _end, gap_end = elf.function_extent("grade")
        result = main.recursive_descent(elf.section(".text").data, [start], gap_end)
        self.assertEqual([i.address for i in result.unresolved], [0x74])
        self.assertEqual(len(result.instructions), 25)
        self.assertNotIn(0x76, result.instructions)
        self.assertNotIn(0xA6, result.instructions)

    def test_linear_sweep_skips_one_byte_after_an_undecodable_opcode(self) -> None:
        result = main.linear_sweep(bytes.fromhex("90 0a 90"))
        self.assertEqual([i.address for i in result.instructions], [0, 2])
        self.assertEqual(result.undecodable, [(1, 0x0A)])


class ControlFlowTests(unittest.TestCase):
    def test_basic_blocks_edges_and_back_edge_of_total_at_o1(self) -> None:
        analysis = main.analyze_function(main.load_fixture("ledger-x86_64-O1.o"), "total")
        cfg = analysis.cfg
        self.assertEqual(sorted(cfg.blocks), [0x40, 0x44, 0x50, 0x5B, 0x5C])
        self.assertEqual(
            sorted(cfg.edges),
            [(0x40, 0x44, "fallthrough"), (0x40, 0x5C, "taken"), (0x44, 0x50, "fallthrough"), (0x50, 0x50, "taken"), (0x50, 0x5B, "fallthrough")],
        )
        self.assertEqual(cfg.back_edges(), [(0x50, 0x50)])
        self.assertEqual(analysis.cfg_sweep.unreachable(), [0x5F])

    def test_dominators_follow_cooper_harvey_kennedy_on_the_total_loop(self) -> None:
        cfg = main.analyze_function(main.load_fixture("ledger-x86_64-O1.o"), "total").cfg
        self.assertEqual(cfg.dominators(), {0x40: 0x40, 0x44: 0x40, 0x50: 0x44, 0x5B: 0x50, 0x5C: 0x40})
        self.assertEqual(cfg.dominator_tree()[0x40], [0x44, 0x5C])
        self.assertTrue(cfg.dominates(0x44, 0x5B))
        self.assertFalse(cfg.dominates(0x5C, 0x5B))

    def test_dominators_on_a_hand_built_diamond_with_a_loop(self) -> None:
        code = bytes.fromhex("85 ff 74 04 31 c0 eb 02 31 d2 48 ff c2 75 fb c3")
        result = main.recursive_descent(code, [0])
        cfg = main.ControlFlowGraph(0, result.sorted_instructions())
        self.assertEqual(sorted(cfg.blocks), [0x0, 0x4, 0x8, 0xA, 0xF])
        self.assertEqual(cfg.dominators(), {0x0: 0x0, 0x4: 0x0, 0x8: 0x0, 0xA: 0x0, 0xF: 0xA})
        self.assertEqual(cfg.back_edges(), [(0xA, 0xA)])
        self.assertEqual(cfg.reverse_postorder()[0], 0x0)

    def test_vectorised_total_at_o2_has_two_loops(self) -> None:
        cfg = main.analyze_function(main.load_fixture("ledger-x86_64-O2.o"), "total").cfg
        self.assertEqual(sorted(cfg.back_edges()), [(0x80, 0x80), (0xC0, 0xC0)])
        self.assertEqual(cfg.unresolved, [])


class JumpTableTests(unittest.TestCase):
    def test_grade_at_o0_jump_table_is_recovered_from_rela_rodata(self) -> None:
        analysis = main.analyze_function(main.load_fixture("ledger-x86_64-O0.o"), "grade")
        table = analysis.descent.resolved_tables[0x74]
        self.assertEqual(table.to_dict(), {
            "kind": "jump-table",
            "table": ".rodata+0x0",
            "entrySize": 4,
            "count": 5,
            "entries": ["0x91", "0x88", "0x7f", "0x76", "0x76"],
            "evidence": "relocation",
            "boundsCheck": "0x5d",
            "lea": "0x66",
            "load": "0x6d",
            "jump": "0x74",
        })
        self.assertEqual(len(analysis.cfg.blocks), 8)
        self.assertEqual(len(analysis.cfg.edges), 11)
        self.assertEqual(sum(1 for _s, _t, k in analysis.cfg.edges if k == "table"), 4)
        self.assertEqual(analysis.cfg.unresolved, [])
        self.assertEqual(analysis.cfg.dominators()[0x76], 0x62)
        self.assertEqual(analysis.cfg.dominators()[0xA1], 0x30)

    def test_without_table_recovery_grade_at_o0_loses_four_case_blocks(self) -> None:
        analysis = main.analyze_function(main.load_fixture("ledger-x86_64-O0.o"), "grade")
        self.assertEqual(len(analysis.cfg_plain.blocks), 3)
        self.assertEqual(analysis.cfg_plain.unresolved, [0x74])
        self.assertEqual(len(analysis.cfg_sweep.blocks), 9)
        self.assertEqual(analysis.cfg_sweep.unreachable(), [0x76, 0x7F, 0x88, 0x91, 0xA6])
        self.assertEqual(analysis.gap_end - analysis.end, 10)

    def test_grade_at_o1_and_o2_is_a_value_table_not_a_jump_table(self) -> None:
        for name in ("ledger-x86_64-O1.o", "ledger-x86_64-O2.o"):
            analysis = main.analyze_function(main.load_fixture(name), "grade")
            self.assertEqual(analysis.descent.resolved_tables, {}, name)
            self.assertEqual(analysis.cfg.unresolved, [], name)
            self.assertEqual([t.to_dict()["kind"] for t in analysis.value_tables], ["value-table"], name)
            table = analysis.value_tables[0]
            self.assertEqual((table.section, table.offset, table.entry_size, table.targets), (".rodata", 0x14, 4, (1, 2, 3, 4, 4)), name)
            self.assertEqual(table.evidence, "bytes")

    def test_grade_label_at_o2_reads_the_string_offset_table_through_relocations(self) -> None:
        analysis = main.analyze_function(main.load_fixture("ledger-x86_64-O2.o"), "grade_label")
        tables = {t.offset: t for t in analysis.value_tables}
        self.assertEqual(tables[0x28].targets, (1, 2, 3, 4, 4))
        self.assertEqual(tables[0x0].targets, (0, 2, 4, 6, 8))
        self.assertEqual(tables[0x0].evidence, "relocation")
        strings = main.load_fixture("ledger-x86_64-O2.o").section(".rodata.str1.1").data
        self.assertEqual([strings[o : o + 1] for o in tables[0x0].targets], [b"F", b"D", b"C", b"B", b"A"])


class ReportTests(unittest.TestCase):
    def test_demo_reports_oracle_agreement_for_every_fixture(self) -> None:
        report = main.demo()
        self.assertEqual(sorted(report["fixtures"]), sorted(main.FIXTURE_OBJECTS))
        for name, entry in report["fixtures"].items():
            compared = entry["oracle"].split("/")[0]
            self.assertEqual(entry["oracle"], f"{compared}/{compared} instructions agree with llvm-objdump", name)
        self.assertEqual(report["fixtures"]["ledger-x86_64-O0.o"]["functions"]["grade"]["tables"][0]["kind"], "jump-table")
        self.assertFalse(report["sweepTrap"]["linearSweep"]["atJumpTarget"]["startsAtTarget"])

    def test_figure_data_is_derived_from_the_o0_grade_analysis(self) -> None:
        data = main.figure_data(main.load_fixture("ledger-x86_64-O0.o"), "grade")
        self.assertEqual((data["start"], data["end"], data["gapEnd"]), (0x30, 0xA6, 0xB0))
        self.assertEqual(len(data["methods"]["linear"]["order"]), 34)
        self.assertEqual(len(data["methods"]["descent"]["order"]), 25)
        self.assertEqual(len(data["methods"]["table"]["order"]), 33)
        self.assertEqual(data["table"]["targets"], [0x76, 0x7F, 0x88, 0x91])
        self.assertEqual(len(data["methods"]["table"]["edges"]), 11)

    def test_site_figure_module_embeds_the_same_data(self) -> None:
        if not SITE_MODULE.exists():
            self.skipTest("site module not present in this checkout")
        source = SITE_MODULE.read_text()
        match = re.search(r"var DATA = (\{.*?\});\n", source, re.S)
        assert match is not None, "figures-re-33.js must define var DATA = {...};"
        embedded = json.loads(match.group(1))
        expected = json.loads(json.dumps(main.figure_data(main.load_fixture("ledger-x86_64-O0.o"), "grade")))
        self.assertEqual(embedded, expected)
        for forbidden in ("=>", "let ", "const ", "`"):
            self.assertNotIn(forbidden, source, f"ES5 only: found {forbidden!r}")


if __name__ == "__main__":
    unittest.main()
