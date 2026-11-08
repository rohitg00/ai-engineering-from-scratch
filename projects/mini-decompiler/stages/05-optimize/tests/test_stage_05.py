
import unittest
from pathlib import Path

from minidec.cfg import build_cfg
from minidec.elf import load_object
from minidec.ir import Assign, Bin, Const, Flags, Index, IrPrinter, Phi, Return, Var, iter_nodes, lift_function, stmt_exprs
from minidec.passes import c_div, count_uses, division_identity_holds, magic_divisor, merge_congruent_phis, optimize, propagate_copies, remove_dead_code, truncate
from minidec.ssa import to_ssa

PROJECT = Path(__file__).resolve().parents[3]
FIXTURES = PROJECT / "fixtures"
O0 = FIXTURES / "samples-x86_64-O0.o"
O1 = FIXTURES / "samples-x86_64-O1.o"


def ssa_function(path, name):
    elf = load_object(path)
    fn = lift_function(elf, build_cfg(elf, name))
    to_ssa(fn)
    return fn


def expressions(fn):
    for stmt in fn.statements():
        for expr in stmt_exprs(stmt):
            yield from iter_nodes(expr)


class MagicDivisorTests(unittest.TestCase):
    def test_known_multipliers_and_shifts(self):
        self.assertEqual(magic_divisor(0x66666667, 34), 10)
        self.assertEqual(magic_divisor(0x66666667, 33), 5)
        self.assertEqual(magic_divisor(0x55555556, 32), 3)
        self.assertEqual(magic_divisor(0x92492493, 34), 7)
        self.assertEqual(magic_divisor(0x66666667, 35), 20)

    def test_wrong_shift_or_bad_bound_gives_none(self):
        self.assertIsNone(magic_divisor(0x66666667, 31))
        self.assertIsNone(magic_divisor(0x66666667, 64))
        self.assertIsNone(magic_divisor(0, 34))
        self.assertIsNone(magic_divisor(-5, 34))
        self.assertIsNone(magic_divisor(0x66666668, 34))

    def test_identity_holds_for_the_recovered_divisor_and_fails_for_a_neighbour(self):
        self.assertTrue(division_identity_holds(0x66666667, 34, 10))
        self.assertTrue(division_identity_holds(0x55555556, 32, 3))
        self.assertFalse(division_identity_holds(0x66666667, 34, 11))
        self.assertEqual(c_div(-9, 10), 0)
        self.assertEqual(c_div(-10, 10), -1)
        self.assertEqual(truncate(0x1_0000_0000 + 5, 32), 5)
        self.assertEqual(truncate(0xFFFFFFFF, 32), -1)


class FoldingTests(unittest.TestCase):
    def test_two_divisions_sharing_one_multiplier_fold_to_their_divisors(self):
        fn = ssa_function(O1, "tenths_and_fifths")
        report = optimize(fn)
        self.assertEqual(sorted((d["multiplier"], d["shift"], d["divisor"]) for d in report.divisions), [(0x66666667, 33, 5), (0x66666667, 34, 10)])
        ops = {node.op for node in expressions(fn) if isinstance(node, Bin)}
        self.assertIn("/", ops)
        self.assertNotIn("*", ops)
        self.assertNotIn(">>s", ops)
        self.assertEqual(len(fn.statements()), 1)
        self.assertIsInstance(fn.statements()[0], Return)

    def test_logical_shift_by_thirty_two_is_the_divide_by_three_idiom(self):
        fn = ssa_function(O1, "thirds")
        report = optimize(fn)
        self.assertEqual(report.divisions, [{"multiplier": 0x55555556, "shift": 32, "divisor": 3}])
        returned = fn.statements()[-1].value
        self.assertEqual(returned, Bin("/", Bin("+", Var("rdi", 32, 0), Var("rsi", 32, 0), 32), Const(3, 32), 32))

    def test_recognition_can_be_switched_off(self):
        fn = ssa_function(O1, "thirds")
        report = optimize(fn, recognize_division=False)
        self.assertEqual(report.divisions, [])
        ops = {node.op for node in expressions(fn) if isinstance(node, Bin)}
        self.assertIn("*", ops)
        self.assertIn(">>u", ops)

    def test_real_idiv_at_O0_reduces_the_dividend_pair_to_the_low_half(self):
        fn = ssa_function(O0, "tenths_and_fifths")
        optimize(fn)
        text = IrPrinter(fn, True).dump()
        self.assertNotIn("signfill", text)
        self.assertNotIn("dividend", text)
        self.assertIn("/ 10", text)
        self.assertIn("/ 5", text)


class PropagationAndDeadCodeTests(unittest.TestCase):
    def test_flags_and_the_remainder_are_dead_and_disappear(self):
        fn = ssa_function(O1, "record")
        before = len(fn.statements())
        report = optimize(fn)
        self.assertGreater(report.removed, 0)
        self.assertLess(len(fn.statements()), before)
        for stmt in fn.statements():
            self.assertFalse(isinstance(stmt, Assign) and stmt.dst.name == "flags")
            self.assertFalse(isinstance(stmt, Assign) and isinstance(stmt.src, Bin) and stmt.src.op == "%")
        self.assertFalse(any(isinstance(node, Flags) for node in expressions(fn)))

    def test_copies_and_constants_propagate_into_uses_and_conditions_become_comparisons(self):
        fn = ssa_function(O1, "fold")
        copies = propagate_copies(fn)
        self.assertGreater(copies, 0)
        optimize(fn)
        text = IrPrinter(fn, True).dump()
        self.assertIn("if esi_0 <= 0 goto 0x93", text)
        self.assertIn("if zext64(esi_0) != rdx_3 goto 0x80", text)
        self.assertNotIn("ecx_1", text)
        self.assertTrue(any(isinstance(node, Index) for node in expressions(fn)))

    def test_dead_code_removal_keeps_statements_with_uses(self):
        fn = ssa_function(O1, "band")
        uses = count_uses(fn)
        removed = remove_dead_code(fn, uses)
        self.assertGreaterEqual(removed, 1)
        remaining = {s.dst.key for s in fn.statements() if isinstance(s, (Assign, Phi))}
        self.assertIn(("rax", 1), remaining)
        self.assertIn(("rax", 3), remaining)
        self.assertNotIn(("rcx", 2), remaining)

    def test_congruent_phis_merge_into_one_web(self):
        fn = ssa_function(O1, "fold")
        report = optimize(fn)
        self.assertEqual(report.merged_phis, 1)
        phis = [s for s in fn.blocks[0x80].stmts if isinstance(s, Phi)]
        self.assertEqual(len(phis), 2)
        self.assertEqual(merge_congruent_phis(fn), 0)

    def test_substitution_does_not_move_a_load_across_a_store(self):
        fn = ssa_function(O1, "record")
        optimize(fn)
        stmts = fn.statements()
        text = IrPrinter(fn, True).dump()
        self.assertIn("store32(rdi_0) = ecx_2", text)
        self.assertIn("ecx_2 = rdi_0->field_0 + 1", text)
        first_store = next(i for i, s in enumerate(stmts) if s.__class__.__name__ == "Store")
        definition = next(i for i, s in enumerate(stmts) if isinstance(s, Assign) and s.dst.key == ("rcx", 2))
        self.assertLess(definition, first_store)


class HeldOutTests(unittest.TestCase):
    def test_held_out_division_folds_and_the_offset_survives(self):
        elf = load_object(FIXTURES / "heldout" / "extra-x86_64-O1.o")
        fn = lift_function(elf, build_cfg(elf, "fifths"))
        to_ssa(fn)
        report = optimize(fn)
        self.assertEqual(report.divisions, [{"multiplier": 0x66666667, "shift": 33, "divisor": 5}])
        returned = fn.statements()[-1].value
        self.assertEqual(returned, Bin("-", Bin("/", Var("rdi", 32, 0), Const(5, 32), 32), Const(2, 32), 32))


if __name__ == "__main__":
    unittest.main()
