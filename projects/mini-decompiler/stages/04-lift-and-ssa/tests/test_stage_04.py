
import unittest
from pathlib import Path

from minidec.cfg import build_cfg
from minidec.decoder import decode
from minidec.elf import load_object
from minidec.ir import EXIT, Assign, Bin, Branch, Concat, Cond, Const, Flags, Function, IRBlock, IndirectJump, IrPrinter, LiftContext, LiftError, Load, Phi, Return, SignFill, Store, Symbolic, Var, lift_function, lift_instruction
from minidec.ssa import check_single_assignment, insert_phis, rename, to_ssa

PROJECT = Path(__file__).resolve().parents[3]
FIXTURES = PROJECT / "fixtures"
O0 = FIXTURES / "samples-x86_64-O0.o"
O1 = FIXTURES / "samples-x86_64-O1.o"


def hexbytes(text):
    return bytes.fromhex(text.replace(" ", ""))


def at(text, address):
    return decode(bytes(address) + hexbytes(text), address)


def shape(stmts):
    return [(type(stmt).__name__, vars(stmt)) for stmt in stmts]


def lifted(path, name):
    elf = load_object(path)
    return lift_function(elf, build_cfg(elf, name))


class LiftInstructionTests(unittest.TestCase):
    def setUp(self):
        self.ctx = LiftContext(load_object(O1))

    def test_sub_writes_flags_then_the_difference(self):
        stmts = lift_instruction(decode(hexbytes("29 fe"), 0), self.ctx)
        self.assertEqual(shape(stmts), shape([Assign(Var("flags", 0), Flags("cmp", Var("rsi", 32), Var("rdi", 32), 32)), Assign(Var("rsi", 32), Bin("-", Var("rsi", 32), Var("rdi", 32), 32))]))

    def test_xor_of_a_register_with_itself_is_zero_and_test_only_sets_flags(self):
        self.assertEqual(shape(lift_instruction(decode(hexbytes("31 c0"), 0), self.ctx)), shape([Assign(Var("rax", 32), Const(0, 32))]))
        self.assertEqual(shape(lift_instruction(decode(hexbytes("85 f6"), 0), self.ctx)), shape([Assign(Var("flags", 0), Flags("test", Var("rsi", 32), Var("rsi", 32), 32))]))
        branch = lift_instruction(at("7e 1f", 0x72), self.ctx)
        self.assertEqual(shape(branch), shape([Branch(Cond("le", Var("flags", 0)), 0x93, 0x74)]))

    def test_cltd_and_idiv_form_a_dividend_pair(self):
        cltd = lift_instruction(decode(hexbytes("99"), 0), self.ctx)
        self.assertEqual(shape(cltd), shape([Assign(Var("rdx", 32), SignFill(Var("rax", 32), 32))]))
        idiv = lift_instruction(decode(hexbytes("f7 f9"), 0), self.ctx)
        self.assertEqual(shape([idiv[0]]), shape([Assign(Var("dividend", 64), Concat(Var("rdx", 32), Var("rax", 32), 64))]))
        self.assertEqual(shape([idiv[1]]), shape([Assign(Var("rax", 32), Bin("/", Var("dividend", 64), Var("rcx", 32), 32))]))
        self.assertEqual(idiv[2].src.op, "%")
        self.assertIn("signed", self.ctx.signedness)

    def test_memory_operands_become_loads_and_stores_and_a_relocated_lea_a_section_address(self):
        load = lift_instruction(decode(hexbytes("03 47 04"), 0), self.ctx)
        self.assertEqual(shape([load[1]]), shape([Assign(Var("rax", 32), Bin("+", Var("rax", 32), Load(Bin("+", Var("rdi", 64), Const(4, 64), 64), 32), 32))]))
        store = lift_instruction(decode(hexbytes("89 47 04"), 0), self.ctx)
        self.assertEqual(shape(store), shape([Store(Bin("+", Var("rdi", 64), Const(4, 64), 64), Var("rax", 32), 32)]))
        lea = lift_instruction(at("48 8d 0d 00 00 00 00", 0x5C), self.ctx)
        self.assertEqual(shape(lea), shape([Assign(Var("rcx", 64), Symbolic(".rodata", 0))]))

    def test_frame_prologue_produces_nothing_and_turns_rbp_slots_into_locals(self):
        ctx = LiftContext(load_object(O0))
        self.assertEqual(shape(lift_instruction(decode(hexbytes("55"), 0), ctx)), shape([]))
        self.assertEqual(shape(lift_instruction(at("48 89 e5", 1), ctx)), shape([]))
        self.assertTrue(ctx.frame)
        self.assertEqual(shape(lift_instruction(at("89 7d f8", 4), ctx)), shape([Assign(Var("local_8", 32), Var("rdi", 32))]))
        self.assertEqual(shape(lift_instruction(at("8b 45 fc", 7), ctx)), shape([Assign(Var("rax", 32), Var("local_4", 32))]))
        self.assertEqual(shape(lift_instruction(decode(hexbytes("5d"), 0), ctx)), shape([]))
        self.assertEqual(shape(lift_instruction(decode(hexbytes("c3"), 0), ctx)), shape([Return(Var("rax", 0))]))

    def test_an_instruction_without_a_rule_raises_with_its_address(self):
        with self.assertRaises(LiftError) as caught:
            lift_instruction(at("0f 4f c1", 0x40), self.ctx)
        self.assertIn("0x40", str(caught.exception))


class SsaTests(unittest.TestCase):
    def test_loop_header_gets_phis_for_every_variable_defined_in_the_loop(self):
        fn = lifted(O1, "fold")
        self.assertEqual(sorted(fn.blocks), [0x70, 0x74, 0x80, 0x92, 0x93])
        placed = to_ssa(fn)
        self.assertEqual(placed, 4)
        phis = [s for s in fn.blocks[0x80].stmts if isinstance(s, Phi)]
        self.assertEqual(sorted(p.dst.name for p in phis), ["flags", "rax", "rdx", "rsi"])
        self.assertEqual(sorted(phis[0].sources), [0x74, 0x80])
        self.assertEqual(check_single_assignment(fn), [])

    def test_straight_line_code_has_no_phis_and_renames_every_write(self):
        fn = lifted(O1, "record")
        self.assertEqual(to_ssa(fn), 0)
        text = IrPrinter(fn, versions=True).dump()
        self.assertIn("ecx_1 = load32(rdi_0)", text)
        self.assertIn("ecx_2 = ecx_1 + 1", text)
        self.assertIn("eax_3 = dividend_1 / ecx_2", text)
        self.assertIn("return eax_3", text)
        self.assertEqual(check_single_assignment(fn), [])

    def test_entry_values_are_version_zero_and_narrow_definitions_get_casts_at_wide_uses(self):
        fn = lifted(O1, "fold")
        to_ssa(fn)
        text = IrPrinter(fn, versions=True).dump()
        self.assertIn("ecx_1 = esi_0", text)
        self.assertIn("cmp(zext64(ecx_1), rdx_3)", text)
        self.assertEqual(fn.def_width[("rsi", 0)], 32)
        self.assertEqual(fn.def_width[("rdi", 0)], 64)

    def test_phi_widths_grow_to_the_widest_source(self):
        fn = lifted(O1, "fold")
        to_ssa(fn)
        rdx_phi = next(s for s in fn.blocks[0x80].stmts if isinstance(s, Phi) and s.dst.name == "rdx")
        self.assertEqual(rdx_phi.dst.width, 64)
        self.assertEqual({v.width for v in rdx_phi.sources.values()}, {32, 64})

    def test_stack_slots_at_O0_are_variables_with_phis_at_the_loop_header(self):
        fn = lifted(O0, "fold")
        self.assertTrue(fn.frame_pointer)
        to_ssa(fn)
        phis = [s.dst.name for s in fn.blocks[0xD9].stmts if isinstance(s, Phi)]
        self.assertIn("local_10", phis)
        self.assertIn("local_14", phis)
        self.assertNotIn("rbp", IrPrinter(fn, versions=False).dump())

    def test_jump_table_block_carries_a_switch_with_its_index_variable(self):
        fn = lifted(O0, "band")
        switch = fn.blocks[0x64].stmts[-1]
        self.assertIsInstance(switch, IndirectJump)
        self.assertIsNotNone(switch.table)
        self.assertEqual(switch.index, Var("switch_index", 64))
        to_ssa(fn)
        self.assertEqual(fn.blocks[0x64].stmts[-1].index.version, 1)
        self.assertEqual(len(fn.blocks[0xB5].stmts[0].sources), 7)

    def test_a_loop_back_to_the_entry_gets_a_phi_with_the_entry_value(self):
        counter = Var("rdi", 32)
        entry = IRBlock(0, [], [Assign(counter, Bin("-", counter, Const(1, 32), 32)), Branch(Bin("!=", counter, Const(0, 32), 32), 0, 8)], [0, 8], [0])
        done = IRBlock(8, [], [Return(Var("rax", 0))], [], [0])
        fn = Function("countdown", 0, {0: entry, 8: done})
        fn.idom = {0: 0, 8: 0}
        self.assertEqual(to_ssa(fn), 1)
        phi = fn.blocks[0].stmts[0]
        self.assertIsInstance(phi, Phi)
        self.assertEqual(phi.sources[EXIT], Var("rdi", 32, 0))
        self.assertEqual(phi.sources[0], Var("rdi", 32, 2))
        self.assertEqual(phi.dst, Var("rdi", 32, 1))
        self.assertEqual(check_single_assignment(fn), [])

    def test_insert_then_rename_separately_match_the_combined_call(self):
        fn = lifted(O1, "band")
        self.assertEqual(insert_phis(fn), 2)
        rename(fn)
        self.assertEqual(check_single_assignment(fn), [])
        other = lifted(O1, "band")
        self.assertEqual(to_ssa(other), 2)
        self.assertEqual(IrPrinter(fn, True).dump(), IrPrinter(other, True).dump())


class HeldOutTests(unittest.TestCase):
    def test_held_out_loop_lifts_and_renames_cleanly(self):
        elf = load_object(FIXTURES / "heldout" / "extra-x86_64-O1.o")
        fn = lift_function(elf, build_cfg(elf, "weighted"))
        self.assertEqual(to_ssa(fn), 4)
        self.assertEqual(check_single_assignment(fn), [])
        text = IrPrinter(fn, True).dump()
        self.assertIn("phi(", text)
        self.assertIn("load32(rdi_0 + rdx_2 * 4)", text)
        struct_fn = lift_function(elf, build_cfg(elf, "span_end"))
        self.assertEqual(to_ssa(struct_fn), 0)
        stores = [s for s in struct_fn.statements() if isinstance(s, Store)]
        self.assertEqual(len(stores), 1)
        self.assertEqual(stores[0].addr, Bin("+", Var("rdi", 64, 0), Const(4, 64), 64))
        self.assertEqual(stores[0].value, Var("rax", 32, 2))
        self.assertIn("return eax_3", IrPrinter(struct_fn, True).dump())


if __name__ == "__main__":
    unittest.main()
