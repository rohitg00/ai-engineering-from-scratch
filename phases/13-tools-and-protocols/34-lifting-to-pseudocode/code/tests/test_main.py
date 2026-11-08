import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


FIXTURES = main.FIXTURES
CLANG = shutil.which("clang")
OBJDUMP = Path("/Library/Developer/CommandLineTools/usr/bin/llvm-objdump")
O1 = main.read_object(FIXTURES / "ledger-x86_64-O1.o")
O0 = main.read_object(FIXTURES / "ledger-x86_64-O0.o")
LIFTED_O1 = main.lift_all(O1)
LIFTED_O0 = main.lift_all(O0)
RAW_O1 = main.lift_all(O1, recognize_division=False)
MAGIC = 0x66666667

EXPECTED_PERCENT_CHANGE = """int percent_change(int param_1, int param_2)
{
  if (param_1 == 0) {
    return 0;
  }
  return (param_2 - param_1) * 100 / param_1;
}"""

EXPECTED_GRADE = """static const int lookup_14[5] = {1, 2, 3, 4, 4};
int grade(int param_1)
{
  int eax_1;
  int ecx_1;

  ecx_1 = param_1 / 10 - 6;
  eax_1 = 0;
  if ((unsigned int)ecx_1 <= 4) {
    eax_1 = lookup_14[(unsigned long)(unsigned int)ecx_1];
  }
  return eax_1;
}"""

EXPECTED_TOTAL = """int total(int *param_1, int param_2)
{
  int eax_1;
  int ecx_1;
  long rdx_1;

  if (param_2 <= 0) {
    return 0;
  }
  ecx_1 = param_2;
  rdx_1 = 0;
  eax_1 = 0;
  do {
    eax_1 = eax_1 + param_1[rdx_1];
    rdx_1 = rdx_1 + 1;
  } while ((unsigned long)(unsigned int)ecx_1 != rdx_1);
  return eax_1;
}"""

DRIVER = r"""#include <stdio.h>
int percent_change(int, int);
int grade(int);
int total(const int *, int);
int main(void) {
  static const int before[] = {-50, -7, -1, 0, 1, 3, 10, 250, 1000};
  static const int after[] = {-100, -7, 0, 1, 2, 10, 99, 250, 4000};
  static const int values[] = {5, -3, 12, 7, 100, -41, 0, 9};
  for (int b = 0; b < 9; b++)
    for (int a = 0; a < 9; a++)
      printf("percent_change %d %d %d\n", before[b], after[a], percent_change(before[b], after[a]));
  for (int s = -25; s <= 115; s++) printf("grade %d %d\n", s, grade(s));
  for (int n = -1; n <= 8; n++) printf("total %d %d\n", n, total(values, n));
  return 0;
}
"""


def run(command: list[str], cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(command, cwd=cwd, capture_output=True, text=True)


def compile_unit(workdir: Path, name: str, source: str, extra: list[str]) -> subprocess.CompletedProcess:
    path = workdir / f"{name}.c"
    path.write_text(source, encoding="utf-8")
    return run([CLANG, "-std=c11", "-Wall", "-Werror", *extra, str(path)], workdir)


class DecoderTests(unittest.TestCase):
    def test_every_instruction_matches_the_objdump_fixture_at_o1(self) -> None:
        text = (FIXTURES / "ledger-x86_64-O1.objdump.txt").read_text(encoding="utf-8")
        self.assertEqual(main.compare_with_objdump(LIFTED_O1, text), [])
        self.assertEqual(sum(len(v.decoded) for v in LIFTED_O1.values()), 56)

    def test_every_instruction_matches_the_objdump_fixture_at_o0(self) -> None:
        text = (FIXTURES / "ledger-x86_64-O0.objdump.txt").read_text(encoding="utf-8")
        self.assertEqual(main.compare_with_objdump(LIFTED_O0, text), [])

    @unittest.skipUnless(OBJDUMP.exists(), "llvm-objdump is not installed at the pinned path")
    def test_every_instruction_matches_a_live_llvm_objdump(self) -> None:
        for path, lifted in ((FIXTURES / "ledger-x86_64-O1.o", LIFTED_O1), (FIXTURES / "ledger-x86_64-O0.o", LIFTED_O0)):
            result = run([str(OBJDUMP), "-d", "-r", str(path)], FIXTURES)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(main.compare_with_objdump(lifted, result.stdout), [])

    def test_rex_modrm_sib_and_relocation_fields(self) -> None:
        text = O1.section(".text").data
        lea = main.decode_one(text, 0x33)
        self.assertEqual(lea.att(), "leaq\t(%rip), %rcx")
        self.assertEqual(lea.operands[1].disp_offset, 3)
        self.assertEqual(O1.relocation_at(".text", 0x36).symbol, ".rodata")
        self.assertEqual(O1.relocation_at(".text", 0x36).addend, 0x10)
        load = main.decode_one(text, 0x3A)
        self.assertEqual((load.operands[1].base, load.operands[1].index, load.operands[1].scale), ("rcx", "rax", 4))
        imul = main.decode_one(text, 0x13)
        self.assertEqual((imul.width, imul.operands[2].value), (64, MAGIC))

    def test_an_opcode_outside_the_subset_fails_loudly(self) -> None:
        with self.assertRaises(main.DecodeError):
            main.decode_one(bytes([0x0F, 0x05]), 0)
        with self.assertRaises(main.DecodeError):
            main.decode_one(bytes([0xF7, 0xE0]), 0)


class ElfAndCfgTests(unittest.TestCase):
    def test_elf_reader_lists_the_four_functions_in_address_order(self) -> None:
        self.assertEqual([s.name for s in O1.functions()], ["percent_change", "grade", "total", "grade_label"])
        self.assertEqual([s.value for s in O1.functions()], [0x0, 0x10, 0x40, 0x60])
        self.assertEqual([(r.offset, r.symbol, r.addend) for r in O1.relocations[".text"]], [(0x36, ".rodata", 0x10), (0x84, ".rodata", 0x24), (0x93, ".rodata", -4)])

    def test_blocks_dominators_and_the_loop_header(self) -> None:
        fn = LIFTED_O1["total"].function
        self.assertEqual(sorted(fn.blocks), [0x40, 0x44, 0x50, 0x5B, 0x5C])
        self.assertEqual(fn.blocks[0x50].succs, [0x50, 0x5B])
        self.assertEqual(fn.idom[0x50], 0x44)
        self.assertEqual(main.natural_loops(fn), {0x50: {0x50}})
        self.assertEqual(fn.ipdom[0x40], main.EXIT)
        self.assertEqual(sorted(LIFTED_O1["percent_change"].function.blocks), [0x0, 0x4, 0xD])


class LifterTests(unittest.TestCase):
    def test_system_v_registers_become_parameters(self) -> None:
        self.assertEqual(LIFTED_O1["percent_change"].function.params, ["rdi", "rsi"])
        self.assertEqual(LIFTED_O1["grade"].function.params, ["rdi"])
        self.assertEqual(LIFTED_O1["total"].function.params, ["rdi", "rsi"])
        self.assertEqual(LIFTED_O1["total"].function.web_types["param_1"], "int *")
        self.assertEqual(LIFTED_O1["total"].function.web_types["param_2"], "int")
        self.assertEqual(LIFTED_O0["percent_change"].function.params, ["rdi", "rsi"])

    def test_flags_and_condition_codes_become_comparisons(self) -> None:
        self.assertIn("if (param_1 == 0) {", LIFTED_O1["percent_change"].pseudocode)
        self.assertIn("if (param_2 <= 0) {", LIFTED_O1["total"].pseudocode)
        self.assertIn("if ((unsigned int)ecx_1 <= 4) {", LIFTED_O1["grade"].pseudocode)
        self.assertIn("while (local_14 < local_c) {", LIFTED_O0["total"].pseudocode)
        self.assertNotIn("flags", LIFTED_O1["grade"].pseudocode)

    def test_ssa_places_phi_functions_at_the_loop_header_only(self) -> None:
        ssa = LIFTED_O1["total"].ssa_text
        self.assertIn("eax_2 = phi(0x44: eax_1, 0x50: eax_3)", ssa)
        self.assertIn("rdx_2 = phi(0x44: edx_1, 0x50: rdx_3)", ssa)
        self.assertNotIn("phi", LIFTED_O1["percent_change"].ssa_text)
        self.assertIn("dividend_1 = edx_1:eax_1", LIFTED_O1["percent_change"].ssa_text)

    def test_percent_change_pseudocode(self) -> None:
        self.assertEqual(LIFTED_O1["percent_change"].unit, EXPECTED_PERCENT_CHANGE)

    def test_grade_pseudocode_with_the_division_idiom_recognized(self) -> None:
        self.assertEqual(LIFTED_O1["grade"].unit, EXPECTED_GRADE)

    def test_grade_pseudocode_with_the_raw_multiply(self) -> None:
        text = RAW_O1["grade"].pseudocode
        self.assertIn("rax_1 = (long)param_1 * 0x66666667;", text)
        self.assertIn("ecx_1 = (int)(rax_1 >> 34) + (int)((unsigned long)rax_1 >> 63) - 6;", text)

    def test_total_pseudocode(self) -> None:
        self.assertEqual(LIFTED_O1["total"].unit, EXPECTED_TOTAL)

    def test_stack_slots_become_local_variables_at_o0(self) -> None:
        text = LIFTED_O0["percent_change"].pseudocode
        self.assertIn("local_8 = param_1;", text)
        self.assertIn("local_c = param_2;", text)
        self.assertIn("if (local_8 != 0) {", text)
        self.assertIn("} else {", text)
        self.assertIn("local_4 = (local_c - local_8) * 100 / local_8;", text)
        self.assertNotIn("rbp", text)
        self.assertIn("int *local_8;", LIFTED_O0["total"].pseudocode)
        self.assertIn("local_10 = local_8[(long)local_14] + local_10;", LIFTED_O0["total"].pseudocode)

    def test_lookup_table_is_read_from_rodata_through_the_relocation(self) -> None:
        self.assertEqual(LIFTED_O1["grade"].data_definitions, ["static const int lookup_14[5] = {1, 2, 3, 4, 4};"])
        self.assertEqual(main.table_values(O1, ".rodata", 0x28, 64), [1, 2, 3, 4, 4])

    def test_an_indirect_jump_is_reported_not_guessed(self) -> None:
        text = LIFTED_O0["grade"].pseudocode
        self.assertIn("0x76, 0x7f, 0x88, 0x91", text)
        self.assertIn("indirect jump", text)

    def test_calls_use_the_callee_signature(self) -> None:
        self.assertIn("eax_1 = grade(param_1);", LIFTED_O0["grade_label"].pseudocode)


class DivisionIdiomTests(unittest.TestCase):
    def test_magic_divisor_for_ten(self) -> None:
        self.assertEqual(main.magic_divisor(MAGIC, 34), 10)
        self.assertEqual(MAGIC, -(-(1 << 34) // 10))
        self.assertEqual(main.magic_divisor(MAGIC, 33), 5)
        self.assertIsNone(main.magic_divisor(MAGIC + 1, 34))
        self.assertIsNone(main.magic_divisor(MAGIC, 31))

    def test_multiply_and_shift_equals_truncating_division_on_a_grid(self) -> None:
        samples = list(range(-1200, 1200)) + [-(2**31), -(2**31) + 1, 2**31 - 1, 2**31 - 11, -999999999, 999999999]
        for x in samples:
            product = x * MAGIC
            quotient = (product >> 34) + ((product & ((1 << 64) - 1)) >> 63)
            self.assertEqual(quotient, main.c_div(x, 10), x)


class GhidraFixtureTests(unittest.TestCase):
    def test_the_fixture_records_the_decompiler_output_we_explain(self) -> None:
        percent_change = main.ghidra_pseudocode("percent_change")
        self.assertIn("undefined1  [16] percent_change(int param_1,int param_2,ulong param_3)", percent_change)
        self.assertIn("return auVar2 << 0x40;", percent_change)
        grade = main.ghidra_pseudocode("grade")
        self.assertIn("uVar2 = param_1 / 10 - 6;", grade)
        self.assertIn("uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);", grade)
        self.assertIn("&DAT_001000b4", grade)
        total = main.ghidra_pseudocode("total")
        self.assertIn("int total(long param_1,uint param_2)", total)
        self.assertIn("} while (param_2 != uVar2);", total)

    def test_the_verbatim_file_equals_the_json_records(self) -> None:
        verbatim = (FIXTURES / "ghidra" / "ledger-x86_64-O1.ghidra.c").read_text(encoding="utf-8")
        for name in ("percent_change", "grade", "total"):
            self.assertIn(main.ghidra_pseudocode(name), verbatim)


@unittest.skipUnless(CLANG, "clang is not installed")
class CompileTests(unittest.TestCase):
    def setUp(self) -> None:
        self.workdir = Path(tempfile.mkdtemp(prefix="lift-"))

    def tearDown(self) -> None:
        shutil.rmtree(self.workdir, ignore_errors=True)

    def test_emitted_pseudocode_compiles_for_x86_64_linux(self) -> None:
        units = [
            ("o1_percent_change", LIFTED_O1["percent_change"].unit),
            ("o1_grade", LIFTED_O1["grade"].unit),
            ("o1_grade_raw", RAW_O1["grade"].unit),
            ("o1_total", LIFTED_O1["total"].unit),
            ("o0_percent_change", LIFTED_O0["percent_change"].unit),
            ("o0_total", LIFTED_O0["total"].unit),
        ]
        for name, source in units:
            result = compile_unit(self.workdir, name, source, ["-target", "x86_64-unknown-linux-gnu", "-c"])
            self.assertEqual(result.returncode, 0, f"{name}: {result.stderr}")

    def test_lifted_functions_behave_like_the_source_on_an_input_grid(self) -> None:
        variants = {
            "reference": (FIXTURES / "ledger.c").read_text(encoding="utf-8"),
            "lifted_o1": "\n\n".join(LIFTED_O1[n].unit for n in ("percent_change", "grade", "total")),
            "lifted_o0": "\n\n".join([LIFTED_O0["percent_change"].unit, LIFTED_O0["total"].unit, "int grade(int score) { return score * 0; }"]),
            "ghidra_repaired": (FIXTURES / "ghidra" / "ledger-x86_64-O1.ghidra-repaired.c").read_text(encoding="utf-8"),
        }
        outputs = {}
        for name, source in variants.items():
            (self.workdir / "driver.c").write_text(DRIVER, encoding="utf-8")
            (self.workdir / f"{name}.c").write_text(source, encoding="utf-8")
            build = run([CLANG, "-std=c11", "-O0", "-Wall", "-o", name, "driver.c", f"{name}.c"], self.workdir)
            self.assertEqual(build.returncode, 0, f"{name}: {build.stderr}")
            result = run([str(self.workdir / name)], self.workdir)
            self.assertEqual(result.returncode, 0, f"{name}: {result.stderr}")
            outputs[name] = result.stdout
        self.assertEqual(outputs["lifted_o1"], outputs["reference"])
        self.assertEqual(outputs["ghidra_repaired"], outputs["reference"])
        reference_lines = [l for l in outputs["reference"].splitlines() if not l.startswith("grade")]
        o0_lines = [l for l in outputs["lifted_o0"].splitlines() if not l.startswith("grade")]
        self.assertEqual(o0_lines, reference_lines)
        self.assertEqual(outputs["reference"].count("\n"), 81 + 141 + 10)


class DemoTests(unittest.TestCase):
    def test_demo_runs_and_reports_zero_objdump_differences(self) -> None:
        result = run([sys.executable, str(Path(main.__file__))], FIXTURES.parent)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("56 instructions decoded, 0 differences from llvm-objdump", result.stdout)
        self.assertIn('"objdumpDifferences": 0', result.stdout)


if __name__ == "__main__":
    unittest.main()
