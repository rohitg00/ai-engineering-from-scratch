
import unittest
from pathlib import Path

from minidec.cfg import build_cfg
from minidec.elf import load_object
from minidec.ir import Assign, Bin, Const, Function, IRBlock, Return, Var, lift_function
from minidec.passes import optimize
from minidec.ssa import to_ssa
from minidec.types import Signature, coalesce_webs, collect_params, infer_types, recover_signature, signedness_label

PROJECT = Path(__file__).resolve().parents[3]
FIXTURES = PROJECT / "fixtures"
O0 = FIXTURES / "samples-x86_64-O0.o"
O1 = FIXTURES / "samples-x86_64-O1.o"


def optimized(path, name, recognize_division=True):
    elf = load_object(path)
    fn = lift_function(elf, build_cfg(elf, name))
    to_ssa(fn)
    optimize(fn, recognize_division)
    return fn


def hand_built(stmts):
    block = IRBlock(0, [], stmts, [], [])
    fn = Function("hand", 0, {0: block})
    fn.idom = {0: 0}
    to_ssa(fn)
    return fn


class ParameterTests(unittest.TestCase):
    def test_two_int_arguments_and_an_int_result(self):
        signature = recover_signature(optimized(O1, "thirds"))
        self.assertEqual(signature.declaration(), "int thirds(int param_1, int param_2)")
        self.assertEqual([p.register for p in signature.params], ["rdi", "rsi"])
        self.assertEqual([p.width for p in signature.params], [32, 32])
        self.assertEqual(signature.return_width, 32)
        self.assertEqual(signature.undefined_reads, [])

    def test_scaled_element_access_makes_the_base_an_element_pointer(self):
        for path in (O0, O1):
            with self.subTest(path=path.name):
                signature = recover_signature(optimized(path, "fold"))
                self.assertEqual(signature.declaration(), "int fold(int *param_1, int param_2)")
                self.assertEqual(signature.params[0].signedness, "pointer")
                self.assertIn("base register of a scaled element access", signature.params[0].evidence)
                self.assertEqual(signature.params[1].signedness, "signed")

    def test_constant_offset_accesses_make_a_struct_with_one_field_per_offset(self):
        for path in (O0, O1):
            with self.subTest(path=path.name):
                fn = optimized(path, "record")
                signature = recover_signature(fn)
                self.assertEqual(signature.declaration(), "int record(struct record_param_1 *param_1, int param_2)")
                self.assertEqual(signature.structs, {"record_param_1": {0: 32, 4: 32}})
                self.assertIn("accessed through constant offsets 0x0, 0x4", signature.params[0].evidence)
        o0 = optimized(O0, "record")
        recover_signature(o0)
        self.assertEqual(o0.web_types, {"param_1": "struct record_param_1 *", "param_2": "int"})

    def test_a_second_register_read_fixes_the_count_even_when_the_first_is_unused(self):
        fn = hand_built([Assign(Var("rax", 32), Bin("+", Var("rsi", 32), Const(1, 32), 32)), Return(Var("rax", 0))])
        collect_params(fn)
        self.assertEqual(fn.params, ["rdi", "rsi"])
        coalesce_webs(fn)
        infer_types(fn)
        self.assertEqual(fn.web_names[("rsi", 0)], "param_2")
        self.assertEqual(fn.return_type, "int")

    def test_a_non_argument_register_read_before_write_is_an_undefined_read_not_a_parameter(self):
        fn = hand_built([Assign(Var("rax", 32), Var("r10", 32)), Return(Var("rax", 0))])
        signature = recover_signature(fn)
        self.assertEqual(signature.params, [])
        self.assertEqual(signature.undefined_reads, ["r10"])
        self.assertEqual(fn.web_names[("r10", 0)], "undefined_r10")

    def test_no_write_to_rax_before_return_is_a_void_result(self):
        fn = hand_built([Assign(Var("rcx", 32), Var("rdi", 32)), Return(Var("rax", 0))])
        signature = recover_signature(fn)
        self.assertEqual(signature.return_type, "void")
        self.assertEqual(signature.return_width, 0)
        self.assertEqual(signature.declaration(), "void hand(int param_1)")


class SignednessTests(unittest.TestCase):
    def test_signed_division_and_shifts_mark_a_value_signed(self):
        signature = recover_signature(optimized(O1, "tenths_and_fifths", recognize_division=False))
        self.assertEqual(signature.params[0].signedness, "signed")
        self.assertEqual(signature.params[0].ctype, "int")

    def test_a_lone_unsigned_compare_keeps_the_signed_type_and_records_the_idiom(self):
        signature = recover_signature(optimized(O1, "band"))
        self.assertEqual(signature.params[0].ctype, "int")
        self.assertEqual(signature.params[0].signedness, "unsigned-compare")
        self.assertEqual(signedness_label({"unsigned-compare"}), "unsigned-compare")
        self.assertEqual(signedness_label({"unsigned-arithmetic", "unsigned-compare"}), "unsigned")
        self.assertEqual(signedness_label({"signed", "unsigned-compare"}), "mixed")
        self.assertEqual(signedness_label(set()), "none")

    def test_unsigned_arithmetic_flips_the_type(self):
        fn = hand_built([Assign(Var("rax", 32), Bin(">>u", Var("rdi", 32), Const(3, 8), 32)), Return(Var("rax", 0))])
        signature = recover_signature(fn)
        self.assertEqual(signature.params[0].ctype, "unsigned int")
        self.assertEqual(signature.params[0].signedness, "unsigned")

    def test_signature_report_carries_the_instruction_evidence(self):
        signature = recover_signature(optimized(O1, "record"))
        report = signature.to_dict()
        self.assertEqual(report["declaration"], "int record(struct record_param_1 *param_1, int param_2)")
        self.assertTrue(any("cltd" in line and "idivl" in line for line in report["evidence"]))
        self.assertEqual(report["structs"], {"record_param_1": {"0x0": 32, "0x4": 32}})
        self.assertIsInstance(signature, Signature)


class HeldOutTests(unittest.TestCase):
    def test_held_out_signatures(self):
        elf = load_object(FIXTURES / "heldout" / "extra-x86_64-O1.o")
        expected = {
            "fifths": "int fifths(int param_1)",
            "quarter_band": "int quarter_band(int param_1)",
            "weighted": "int weighted(int *param_1, int param_2)",
            "span_end": "int span_end(struct span_end_param_1 *param_1, int param_2)",
        }
        for name, declaration in expected.items():
            with self.subTest(name=name):
                fn = lift_function(elf, build_cfg(elf, name))
                to_ssa(fn)
                optimize(fn)
                self.assertEqual(recover_signature(fn).declaration(), declaration)


if __name__ == "__main__":
    unittest.main()
