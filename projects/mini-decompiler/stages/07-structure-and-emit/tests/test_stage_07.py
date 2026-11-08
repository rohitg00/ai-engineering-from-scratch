
import unittest
from pathlib import Path

from minidec.elf import load_object
from minidec.emit import decompile, decompile_all, translation_unit

PROJECT = Path(__file__).resolve().parents[3]
FIXTURES = PROJECT / "fixtures"
O0 = FIXTURES / "samples-x86_64-O0.o"
O1 = FIXTURES / "samples-x86_64-O1.o"

BAND_O1 = """int band(int param_1)
{
  int eax_1;

  eax_1 = -1;
  if ((unsigned int)param_1 <= 5) {
    eax_1 = lookup_0[(unsigned long)(unsigned int)param_1];
  }
  return eax_1;
}"""

RECORD_O1 = """int record(struct record_param_1 *param_1, int param_2)
{
  int eax_1;
  int ecx_1;

  ecx_1 = param_1->field_0 + 1;
  param_1->field_0 = ecx_1;
  eax_1 = param_2 + param_1->field_4;
  param_1->field_4 = eax_1;
  return eax_1 / ecx_1;
}"""


def balanced(text):
    depth = 0
    for char in text:
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth < 0:
                return False
    return depth == 0


class ShapeTests(unittest.TestCase):
    def test_value_table_switch_becomes_an_if_and_a_table_read(self):
        result = decompile(load_object(O1), "band")
        self.assertEqual(result.pseudocode, BAND_O1)
        self.assertEqual(result.data_definitions, ["static const int lookup_0[6] = {5, 8, 12, 20, 20, 35};"])
        self.assertEqual(result.gotos, 0)
        self.assertEqual(result.compare_constants, [5])

    def test_jump_table_at_O0_becomes_a_switch_with_default_and_breaks(self):
        result = decompile(load_object(O0), "band")
        text = result.pseudocode
        self.assertIn("switch (local_10) {", text)
        for case, value in ((0, 5), (1, 8), (2, 12), (3, 20), (4, 20), (5, 35)):
            self.assertIn(f"case {case}:\n    local_4 = {value};\n    break;", text)
        self.assertIn("default:\n    local_4 = -1;\n    break;", text)
        self.assertNotIn("goto", text)
        self.assertEqual(result.data_definitions, [])
        self.assertTrue(balanced(text))

    def test_rotated_loop_is_a_do_while_and_the_O0_loop_is_a_while(self):
        rotated = decompile(load_object(O1), "fold").pseudocode
        self.assertIn("do {", rotated)
        self.assertIn("} while ((unsigned long)(unsigned int)param_2 != rdx_1);", rotated)
        self.assertIn("if (param_2 <= 0) {\n    return 0;\n  }", rotated)
        self.assertIn("param_1[rdx_1]", rotated)
        plain = decompile(load_object(O0), "fold").pseudocode
        self.assertIn("while (local_14 < param_2) {", plain)
        self.assertIn("local_10 = local_10 * 31 + param_1[(long)local_14];", plain)
        self.assertNotIn("do {", plain)

    def test_struct_fields_are_emitted_as_arrows_and_the_struct_is_defined(self):
        result = decompile(load_object(O1), "record")
        self.assertEqual(result.pseudocode, RECORD_O1)
        self.assertEqual(result.struct_definitions, ["struct record_param_1 {\n  int field_0;\n  int field_4;\n};"])
        self.assertIn("struct record_param_1 {", result.unit)

    def test_division_idioms_print_as_division_or_as_the_raw_multiply(self):
        elf = load_object(O1)
        folded = decompile(elf, "tenths_and_fifths").pseudocode
        self.assertIn("return param_1 / 10 + param_1 / 5;", folded)
        raw = decompile(elf, "tenths_and_fifths", recognize_division=False).pseudocode
        self.assertIn("0x66666667", raw)
        self.assertIn(">> 34", raw)
        self.assertIn(">> 63", raw)
        self.assertNotIn("/ 10", raw)
        self.assertEqual(decompile(elf, "thirds").pseudocode.splitlines()[-2], "  return (param_1 + param_2) / 3;")


class UnitTests(unittest.TestCase):
    def test_translation_unit_defines_each_struct_and_table_once_in_address_order(self):
        results = decompile_all(load_object(O1))
        unit = translation_unit(results)
        self.assertEqual(list(results), ["tenths_and_fifths", "thirds", "band", "fold", "record"])
        self.assertEqual(unit.count("struct record_param_1 {"), 1)
        self.assertEqual(unit.count("static const int lookup_0[6]"), 1)
        self.assertLess(unit.index("struct record_param_1 {"), unit.index("int tenths_and_fifths("))
        self.assertLess(unit.index("int band("), unit.index("int fold("))
        self.assertTrue(balanced(unit))
        self.assertTrue(unit.endswith("}\n"))

    def test_unknowns_list_the_table_length_heuristic_and_invisible_qualifiers(self):
        results = decompile_all(load_object(O1))
        self.assertTrue(any("lookup_0 length 6" in line for line in results["band"].unknowns))
        self.assertTrue(any("const" in line for line in results["fold"].unknowns))
        self.assertTrue(any("field names" in line for line in results["record"].unknowns))
        self.assertEqual(results["tenths_and_fifths"].unknowns, [])
        report = results["fold"].to_dict()
        self.assertEqual(report["phis"], 4)
        self.assertEqual(report["gotos"], 0)

    def test_function_filter_and_division_switch_reach_the_unit(self):
        results = decompile_all(load_object(O1), recognize_division=False, functions=["thirds"])
        self.assertEqual(list(results), ["thirds"])
        self.assertIn("0x55555556", translation_unit(results))

    def test_no_shape_emits_a_goto_on_the_fixtures(self):
        for path in (O0, O1):
            for result in decompile_all(load_object(path)).values():
                with self.subTest(path=path.name, function=result.name):
                    self.assertEqual(result.gotos, 0)
                    self.assertNotIn("goto", result.pseudocode)
                    self.assertTrue(balanced(result.pseudocode))


class HeldOutTests(unittest.TestCase):
    def test_held_out_functions_structure_without_gotos_at_both_levels(self):
        for stem in ("extra-x86_64-O0", "extra-x86_64-O1"):
            results = decompile_all(load_object(FIXTURES / "heldout" / f"{stem}.o"))
            with self.subTest(stem=stem):
                self.assertEqual(sorted(results), ["fifths", "quarter_band", "span_end", "weighted"])
                self.assertIn("return param_1 / 5 - 2;", results["fifths"].pseudocode)
                self.assertIn("param_1->field_4", results["span_end"].pseudocode)
                for result in results.values():
                    self.assertEqual(result.gotos, 0)
        o1 = decompile_all(load_object(FIXTURES / "heldout" / "extra-x86_64-O1.o"))
        self.assertEqual(o1["quarter_band"].data_definitions, ["static const int lookup_0[5] = {3, 1, 4, 1, 5};"])
        self.assertIn("do {", o1["weighted"].pseudocode)
        o0 = decompile_all(load_object(FIXTURES / "heldout" / "extra-x86_64-O0.o"))
        self.assertIn("switch (local_10) {", o0["quarter_band"].pseudocode)
        self.assertIn("while (local_14 < param_2) {", o0["weighted"].pseudocode)


if __name__ == "__main__":
    unittest.main()
