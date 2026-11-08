import json
import re
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
SITE_MODULE = Path(__file__).resolve().parents[5] / "site" / "figures-re-39.js"


def idioms_of(build: str, function: str, source_file: str = "idioms.c") -> list[main.Idiom]:
    listing = main.load_listing(build + ".objdump.txt")
    elf = main.load_elf(build + ".o")
    return main.analyze_function(listing, function, elf, main.load_source(source_file))


def only(build: str, function: str, kind: str, source_file: str = "idioms.c") -> main.Idiom:
    found = [i for i in idioms_of(build, function, source_file) if i.kind == kind]
    assert len(found) == 1, f"{build} {function} {kind}: {[(i.kind, i.source) for i in idioms_of(build, function, source_file)]}"
    return found[0]


def kinds(build: str, function: str, source_file: str = "idioms.c") -> list[str]:
    return [i.kind for i in idioms_of(build, function, source_file)]


class ParserTests(unittest.TestCase):
    def test_listing_parser_reads_functions_bytes_and_relocations(self) -> None:
        listing = main.load_listing("idioms-x86_64-O2.objdump.txt")
        self.assertEqual(listing.arch, "x86_64")
        self.assertEqual(len(listing.functions), 25)
        div10u = listing.functions["div10u"]
        self.assertEqual([i.text for i in div10u.instructions], ["movl %edi, %ecx", "movl $0xcccccccd, %eax", "imulq %rcx, %rax", "shrq $0x23, %rax", "retq"])
        self.assertEqual(div10u.instructions[1].raw, "b8 cd cc cc cc")
        lea = listing.functions["table_switch"].at(0xDC)
        self.assertEqual(lea.relocation, ("R_X86_64_PC32", ".rodata+0x24"))
        self.assertEqual((lea.relocation_symbol, lea.relocation_addend), (".rodata", 0x24))
        arm = main.load_listing("idioms-arm64-O2.objdump.txt")
        self.assertEqual(arm.arch, "arm64")
        self.assertEqual(arm.functions["div10u"].instructions[0].text, "mov w8, #0xcccd")
        self.assertEqual(arm.functions["table_switch"].at(0xCC).relocation, ("R_AARCH64_ADR_PREL_PG_HI21", ".rodata"))

    def test_operand_splitting_and_memory_forms(self) -> None:
        self.assertEqual(main.split_operands("(%rcx,%rax,4), %eax"), ("(%rcx,%rax,4)", "%eax"))
        self.assertEqual(main.split_operands("w0, [x8, w0, uxtw #2]"), ("w0", "[x8, w0, uxtw #2]"))
        memory = main.parse_x86_memory("-0x6(%rax,%rcx)")
        self.assertEqual((memory.base, memory.index, memory.scale, memory.displacement), ("%rax", "%rcx", 1, -6))
        arm = main.parse_arm_memory("[x8, w0, uxtw #2]")
        self.assertEqual((arm.base, arm.index, arm.scale), ("x8", "w0", 4))
        self.assertEqual(main.parse_immediate("$-0x8"), -8)
        self.assertEqual(main.parse_immediate("#0x7ffffff8"), 0x7FFFFFF8)
        self.assertEqual(main.x86_family("%r8d"), "r8")
        self.assertEqual(main.x86_family("%al"), "a")
        self.assertEqual(main.arm_family("x11"), "11")

    def test_elf_reader_reads_rodata_words_and_relocations(self) -> None:
        elf = main.load_elf("idioms-x86_64-O2.o")
        self.assertEqual(elf.words(".rodata", 0x28, 7), [10, 20, 30, 40, 50, 60, 71])
        self.assertEqual(len(elf.relocations[".rodata"]), 10)
        first = elf.relocation_at(".rodata", 0)
        self.assertEqual((first["symbol"], first["addend"]), (".text", 0x10C))
        arm = main.load_elf("dispatch-arm64-O2.o")
        self.assertEqual(arm.words(".rodata", 0, 4, size=1, signed=False), [0x00, 0x14, 0x0C, 0x10])


class MagicNumberTests(unittest.TestCase):
    def test_magic_numbers_match_the_constants_clang_emitted(self) -> None:
        self.assertEqual((main.magic_numbers(10).multiplier, main.magic_numbers(10).shift), (0xCCCCCCCD, 35))
        self.assertEqual((main.magic_numbers(10, signed=True).multiplier, main.magic_numbers(10, signed=True).shift), (0x66666667, 34))
        seven = main.magic_numbers(7)
        self.assertEqual((seven.multiplier, seven.shift, seven.add), (0x124924925, 35, True))
        self.assertEqual((main.magic_numbers(3, signed=True).multiplier, main.magic_numbers(3, signed=True).shift), (0x55555556, 32))
        self.assertEqual((main.magic_numbers(3).multiplier, main.magic_numbers(3).shift), (0xAAAAAAAB, 33))
        self.assertEqual(main.magic_numbers(10, signed=True).error, 6)

    def test_identity_holds_on_edge_values_for_every_divisor_up_to_64(self) -> None:
        checked = 0
        for signed in (False, True):
            samples = main.edge_values(32, signed)
            for divisor in range(2, 65):
                if divisor & (divisor - 1) == 0:
                    with self.assertRaises(ValueError):
                        main.magic_numbers(divisor, 32, signed)
                    continue
                magic = main.magic_numbers(divisor, 32, signed)
                self.assertTrue(main.check_identity(magic, samples), f"d={divisor} signed={signed}")
                checked += 1
        self.assertEqual(checked, 2 * (63 - 6))

    def test_divisor_recovery_round_trips_and_rejects_wrong_pairs(self) -> None:
        self.assertEqual(main.divisor_from_magic(0xCCCCCCCD, 35), 10)
        self.assertEqual(main.divisor_from_magic(0x66666667, 34, signed=True), 10)
        self.assertEqual(main.divisor_from_magic(0x66666667, 33, signed=True), 5)
        self.assertEqual(main.divisor_from_magic(0x124924925, 35), 7)
        self.assertEqual(main.divisor_from_magic(0x55555556, 32, signed=True), 3)
        self.assertIsNone(main.divisor_from_magic(0x66666667, 31, signed=True))
        self.assertIsNone(main.divisor_from_magic(0x12345678, 35))

    def test_evaluate_division_follows_the_add_fixup_sequence(self) -> None:
        seven = main.magic_numbers(7)
        for n in (0, 6, 7, 13, 14, 100, 2**31, 2**32 - 1):
            high = (n * 0x24924925) >> 32
            expected = ((((n - high) & 0xFFFFFFFF) >> 1) + high) >> 2
            self.assertEqual(main.evaluate_division(n, seven), expected)
            self.assertEqual(expected, n // 7)


class DivisionTests(unittest.TestCase):
    def test_x86_o2_divisions_report_magic_shift_and_divisor(self) -> None:
        expected = {"div10u": (False, "0xcccccccd", 35, 10), "div10s": (True, "0x66666667", 34, 10), "div7u": (False, "0x24924925", 35, 7), "div3s": (True, "0x55555556", 32, 3)}
        for name, (signed, magic, shift, divisor) in expected.items():
            idiom = only("idioms-x86_64-O2", name, "division")
            self.assertEqual(idiom.source, f"x / {divisor}", name)
            self.assertEqual((idiom.detail["signed"], idiom.detail["magic"], idiom.detail["shift"]), (signed, magic, shift), name)
            self.assertTrue(idiom.detail["clangMatchesAlgorithm"], name)
            self.assertTrue(idiom.verified, name)
        self.assertEqual(only("idioms-x86_64-O2", "div7u", "division").detail["form"], "magic multiply with add fix-up")
        self.assertEqual(only("idioms-x86_64-O2", "div7u", "division").detail["effectiveMagic"], "0x124924925")

    def test_arm64_o2_divisions_decode_mov_movk_constants(self) -> None:
        for name, divisor in (("div10u", 10), ("div10s", 10), ("div7u", 7), ("div3s", 3)):
            idiom = only("idioms-arm64-O2", name, "division")
            self.assertEqual(idiom.source, f"x / {divisor}", name)
            self.assertTrue(idiom.detail["clangMatchesAlgorithm"], name)
        self.assertEqual(only("idioms-arm64-O2", "div10u", "division").detail["magic"], "0xcccccccd")
        self.assertEqual(only("idioms-arm64-O2", "div10u", "division").evidence, [0x0, 0x4, 0x8, 0xC])

    def test_o0_hardware_division_is_a_fastisel_choice(self) -> None:
        self.assertEqual(only("idioms-x86_64-O0", "div10u", "division").detail["form"], "hardware divl")
        self.assertEqual(only("idioms-x86_64-O0", "div10s", "division").detail["form"], "hardware idivl")
        self.assertEqual(only("idioms-x86_64-nofastisel-O0", "div10u", "division").detail["form"], "magic multiply")
        self.assertEqual(only("idioms-x86_64-nofastisel-O0", "div10u", "division").detail["magic"], "0xcccccccd")
        digest = idioms_of("idioms-x86_64-O0", "digest")
        self.assertEqual([(i.kind, i.detail["form"]) for i in digest if i.kind in ("division", "modulo")], [("division", "magic multiply"), ("modulo", "hardware idivl")])
        self.assertEqual(only("idioms-arm64-O0", "div10s", "division").detail["form"], "hardware sdiv")

    def test_modulo_forms_on_both_architectures(self) -> None:
        self.assertEqual(only("idioms-x86_64-O2", "mod10s", "modulo").detail["form"], "quotient multiplied back and subtracted")
        self.assertEqual(only("idioms-x86_64-O2", "mod10s", "modulo").source, "x % 10")
        self.assertEqual(kinds("idioms-x86_64-O2", "mod10s"), ["modulo"])
        self.assertEqual(only("idioms-arm64-O2", "mod10s", "modulo").detail["form"], "msub quotient * divisor from dividend")
        self.assertEqual(only("idioms-x86_64-O2", "mod8s", "modulo").detail["form"], "signed power-of-two modulo: bias by 2^k-1 when negative, mask, subtract")
        self.assertEqual(only("idioms-arm64-O2", "mod8s", "modulo").detail["form"], "signed power-of-two modulo: negate, mask both signs, csneg")
        self.assertEqual(only("idioms-arm64-O0", "mod10s", "modulo").detail["form"], "hardware sdiv + mul + subs")
        self.assertEqual(only("idioms-x86_64-O0", "mod10s", "modulo").detail["form"], "hardware idivl")

    def test_a_shared_quotient_keeps_division_and_modulo(self) -> None:
        for build in ("idioms-x86_64-O1", "idioms-arm64-O1"):
            found = [(i.kind, i.source) for i in idioms_of(build, "digest") if i.kind in ("division", "modulo")]
            self.assertEqual(found, [("division", "sum / 10"), ("modulo", "sum % 10")], build)


class SwitchTests(unittest.TestCase):
    def test_five_lowerings_at_o2_on_x86(self) -> None:
        linear = only("idioms-x86_64-O2", "linear_switch", "switch")
        self.assertEqual((linear.detail["lowering"], linear.detail["formula"], linear.detail["default"]), ("linear map", "10*k + 10", -1))
        table = only("idioms-x86_64-O2", "table_switch", "switch")
        self.assertEqual((table.detail["lowering"], table.detail["values"], table.detail["table"]), ("lookup table", [10, 20, 30, 40, 50, 60, 71], ".rodata+0x28"))
        jump = only("idioms-x86_64-O2", "call_switch", "switch")
        self.assertEqual((jump.detail["lowering"], jump.detail["entries"], jump.detail["distinctTargets"], jump.detail["entryEvidence"]), ("jump table", 5, 5, "relocation"))
        self.assertEqual(jump.detail["targets"], ["0x10c", "0x107", "0x10e", "0x110", "0x109"])
        tree = only("idioms-x86_64-O2", "sparse_switch", "switch")
        self.assertEqual((tree.detail["lowering"], tree.detail["pivots"], tree.detail["equalityTests"]), ("comparison tree", [9999], [1, 100, 10000, 1000000, 100000000]))
        chain = only("idioms-x86_64-O2", "two_cases", "switch")
        self.assertEqual((chain.detail["lowering"], chain.detail["expression"]), ("select chain", "k != 3 ? (k == 4)*9 : 7"))

    def test_the_same_switches_on_arm64(self) -> None:
        self.assertEqual(only("idioms-arm64-O2", "linear_switch", "switch").detail["expression"], "k < 7 ? 10*k + 10 : -1")
        self.assertEqual(only("idioms-arm64-O2", "table_switch", "switch").detail["values"], [10, 20, 30, 40, 50, 60, 71])
        self.assertEqual(only("idioms-arm64-O2", "call_switch", "switch").detail["lowering"], "comparison tree")
        self.assertEqual(only("idioms-arm64-O2", "sparse_switch", "switch").detail["pivots"], [9999])
        self.assertEqual(only("idioms-arm64-O2", "two_cases", "switch").detail["expression"], "k == 3 ? 7 : k == 4 ? 9 : 0")
        self.assertEqual(only("idioms-arm64-jt4-O2", "call_switch", "switch").detail["lowering"], "comparison tree")

    def test_o0_switches_are_jump_tables_on_x86_and_compare_chains_on_arm64(self) -> None:
        for name in ("linear_switch", "table_switch"):
            idiom = only("idioms-x86_64-O0", name, "switch")
            self.assertEqual((idiom.detail["lowering"], idiom.detail["entries"], idiom.detail["distinctTargets"]), ("jump table", 7, 7), name)
            arm = only("idioms-arm64-O0", name, "switch")
            self.assertEqual((arm.detail["lowering"], arm.detail["equalityTests"]), ("compare chain", [0, 1, 2, 3, 4, 5, 6]), name)
        self.assertEqual(only("idioms-x86_64-O0", "two_cases", "switch").detail["lowering"], "compare chain")

    def test_digest_switch_changes_lowering_with_the_level(self) -> None:
        self.assertEqual(only("idioms-x86_64-O0", "digest", "switch").detail["lowering"], "jump table")
        o1 = only("idioms-x86_64-O1", "digest", "switch")
        self.assertEqual((o1.detail["lowering"], o1.detail["values"], o1.detail["foldedFactor"], o1.detail["caseRange"]), ("lookup table", [16, 32, 64, 128, 128], 16, "cases 6..10"))
        o2 = only("idioms-x86_64-O2", "digest", "switch")
        self.assertEqual((o2.detail["lowering"], o2.detail["entries"], o2.detail["distinctTargets"], o2.source), ("jump table", 5, 4, "switch (sum / 10) as jump table"))
        self.assertEqual(only("idioms-arm64-O1", "digest", "switch").detail["lowering"], "lookup table")
        arm = only("idioms-arm64-O2", "digest", "switch")
        self.assertEqual((arm.detail["lowering"], arm.detail["equalityTests"], arm.detail["pivots"], arm.detail["rangeTests"]), ("comparison tree", [6, 7, 8], [8], [[9, 10]]))
        self.assertEqual(only("idioms-arm64-O0", "digest", "switch").detail["rangeTests"], [[9, 10]])

    def test_no_jump_tables_flag_turns_tables_into_comparison_trees(self) -> None:
        for name in ("table_switch", "call_switch", "digest"):
            self.assertEqual(only("idioms-x86_64-nojt-O2", name, "switch").detail["lowering"], "comparison tree", name)
        self.assertEqual(only("idioms-x86_64-nojt-O2", "table_switch", "switch").detail["pivots"], [2, 4])

    def test_jump_table_entries_from_relocations_on_x86_and_bytes_on_arm64(self) -> None:
        x86 = only("dispatch-x86_64-O2", "dispatch", "switch", "dispatch.c")
        self.assertEqual((x86.detail["entries"], x86.detail["entrySize"], x86.detail["distinctTargets"], x86.detail["entryEvidence"]), (16, 4, 16, "relocation"))
        arm = only("dispatch-arm64-O2", "dispatch", "switch", "dispatch.c")
        self.assertEqual((arm.detail["entries"], arm.detail["entrySize"], arm.detail["compressed"], arm.detail["distinctTargets"], arm.detail["entryEvidence"]), (16, 1, True, 16, "bytes"))
        self.assertEqual(arm.detail["targets"][:3], ["0x24", "0x74", "0x54"])
        tails = [i for i in idioms_of("dispatch-arm64-O2", "dispatch", "dispatch.c") if i.kind == "tail call"]
        self.assertEqual(len(tails), 16)
        self.assertTrue(all(i.verified for i in tails))


class LoopTests(unittest.TestCase):
    def test_vector_loop_reports_lanes_accumulators_mask_and_remainder(self) -> None:
        for build in ("idioms-x86_64-O2", "idioms-arm64-O2"):
            idiom = only(build, "sum_n", "vector loop")
            self.assertEqual((idiom.detail["lanes"], idiom.detail["accumulators"], idiom.detail["elementsPerIteration"]), (4, 2, 8), build)
            self.assertIn("0x7ffffff8", idiom.detail["tripCountMask"], build)
            self.assertIsNotNone(idiom.detail["scalarRemainderLoop"], build)
            self.assertIsNotNone(idiom.detail["minimumTripGuard"], build)
        self.assertEqual(only("idioms-x86_64-O2", "sum_n", "vector loop").detail["reduction"], ["paddd %xmm0, %xmm1", "pshufd $0xee, %xmm1, %xmm0", "paddd %xmm1, %xmm0", "pshufd $0x55, %xmm0, %xmm1", "paddd %xmm0, %xmm1", "movd %xmm1, %eax"])
        self.assertEqual(only("idioms-arm64-O2", "sum_n", "vector loop").detail["reduction"], ["addv s0, v0.4s", "fmov w8, s0"])

    def test_fixed_trip_loops_are_fully_vectorized_or_fully_unrolled(self) -> None:
        for build in ("idioms-x86_64-O2", "idioms-arm64-O2"):
            self.assertIsNone(only(build, "sum4", "vector loop").detail["loop"], build)
            poly = only(build, "poly8", "unrolled loop")
            self.assertEqual((poly.detail["copies"], poly.detail["loop"]), (8, None), build)
        novec = only("idioms-x86_64-novec-O2", "sum_n", "unrolled loop")
        self.assertEqual((novec.detail["copies"], novec.detail["stride"], novec.detail["indexStep"]), (8, 4, 8))
        self.assertIsNotNone(novec.detail["loop"])
        self.assertEqual(only("idioms-x86_64-novec-O2", "sum4", "unrolled loop").detail["copies"], 4)

    def test_o1_has_no_vectorization_and_o2_equals_o3(self) -> None:
        for build in ("idioms-x86_64-O1", "idioms-arm64-O1", "idioms-x86_64-O0"):
            self.assertEqual([k for k in kinds(build, "sum_n") if k in ("vector loop", "unrolled loop")], [], build)
        self.assertTrue(main.listing_identity("idioms-x86_64-O2.objdump.txt", "idioms-x86_64-O3.objdump.txt")["identical"])
        arm = main.listing_identity("idioms-arm64-O2.objdump.txt", "idioms-arm64-O3.objdump.txt")
        self.assertFalse(arm["identical"])
        self.assertEqual({d["function"] for d in arm["differences"]}, {"call_switch"})
        self.assertIn("instruction counts differ: 18 vs 17", [d.get("reason") for d in arm["differences"]])

    def test_without_builtins_the_store_loop_is_vectorized_instead_of_memset(self) -> None:
        fill = only("idioms-x86_64-nobuiltin-O2", "fill", "vector loop")
        self.assertEqual((fill.detail["stores"], fill.detail["bytesPerIteration"]), (2, 32))
        self.assertNotIn("memset", kinds("idioms-x86_64-nobuiltin-O2", "fill"))
        self.assertEqual(only("idioms-x86_64-nobuiltin-O2", "copy16", "memcpy").detail["form"], "library tail call")


class CallTests(unittest.TestCase):
    def test_tail_calls_and_memory_builtins(self) -> None:
        for build in ("idioms-x86_64-O2", "idioms-arm64-O2"):
            self.assertEqual(only(build, "tail_caller", "tail call").detail["callee"], "tail_target", build)
            self.assertEqual(only(build, "fill", "memset").source, "store loop recognized as memset(...)", build)
            self.assertEqual(kinds(build, "copy_n"), ["tail call", "memcpy"], build)
            self.assertEqual(only(build, "copy16", "memcpy").detail["bytes"], 16, build)
        self.assertEqual(kinds("idioms-x86_64-O0", "tail_caller"), [])
        self.assertEqual(only("idioms-x86_64-O0", "copy16", "memcpy").source, "memcpy(dst, src, 16) expanded inline as two 8-byte loads and stores")
        self.assertEqual(only("idioms-x86_64-O0", "copy_n", "memcpy").detail["form"], "library call")

    def test_inlined_callee_is_detected_from_o1_upward(self) -> None:
        for build in ("idioms-x86_64-O1", "idioms-x86_64-O2", "idioms-arm64-O1", "idioms-arm64-O2"):
            idiom = only(build, "twice_sum", "inlined call")
            self.assertEqual(idiom.detail["callee"], "leaf_add", build)
            self.assertEqual(len(idiom.detail["matchedInCaller"]), 1, build)
            self.assertTrue(idiom.verified, build)
        self.assertEqual(kinds("idioms-x86_64-O0", "twice_sum"), [])
        self.assertEqual(only("idioms-x86_64-O2", "twice_sum", "inlined call").detail["matchedInCaller"], ["leal (%rdi,%rsi), %eax"])


class SelectTests(unittest.TestCase):
    def test_branchless_selects_decode_to_source_forms(self) -> None:
        self.assertEqual(only("idioms-x86_64-O2", "clamp_max", "branchless select").source, "a > b ? a : b")
        self.assertEqual(only("idioms-arm64-O2", "clamp_max", "branchless select").source, "a > b ? a : b")
        self.assertEqual(only("idioms-x86_64-O2", "abs_int", "branchless select").source, "-x < 0 ? x : -x")
        self.assertEqual(only("idioms-arm64-O2", "abs_int", "branchless select").source, "x < 0 ? -x : x")
        self.assertEqual(only("idioms-x86_64-O2", "is_pos", "branchless flag").source, "(x > 0)")
        self.assertEqual(only("idioms-arm64-O2", "is_pos", "branchless flag").source, "(x > 0)")
        self.assertEqual(only("idioms-x86_64-O2", "digest", "branchless select").source, "sum % 10 < 5 ? sum % 10 : 5")
        self.assertEqual(kinds("idioms-x86_64-O0", "clamp_max"), [])
        self.assertEqual(only("idioms-x86_64-O2", "mul9", "strength reduction").detail["instruction"], "leal (%rdi,%rdi,8), %eax")
        self.assertEqual(only("idioms-arm64-O2", "mul9", "strength reduction").source, "x * 9")


class HardeningTests(unittest.TestCase):
    def test_stack_protector_and_cet_shapes(self) -> None:
        ssp = only("canary-x86_64-ssp-O2", "with_canary", "stack protector", "canary.c")
        self.assertEqual((ssp.detail["guard"], ssp.detail["slot"]), ("%fs:0x28 (tcbhead_t.stack_guard)", "0x40(%rsp)"))
        self.assertIn("__stack_chk_fail", ssp.detail["failCall"])
        self.assertEqual(ssp.evidence, [0x7, 0x26, 0x2F, 0x34, 0x3B])
        arm = only("canary-arm64-ssp-O2", "with_canary", "stack protector", "canary.c")
        self.assertEqual(arm.detail["guard"], "__stack_chk_guard through the GOT")
        self.assertEqual(kinds("canary-x86_64-ssp-O2", "plain_leaf", "canary.c"), [])
        for name in ("with_canary", "plain_leaf"):
            self.assertEqual(only("canary-x86_64-cet-O2", name, "cet landing pad", "canary.c").detail["bytes"], "f3 0f 1e fa")
        self.assertNotIn("stack protector", kinds("canary-x86_64-cet-O2", "with_canary", "canary.c"))


class SourceAndReportTests(unittest.TestCase):
    def test_source_parser_reads_params_cases_calls_and_accumulators(self) -> None:
        sources = main.load_source("idioms.c")
        self.assertEqual(sources["call_switch"].params, ["k", "f0", "f1", "f2", "f3", "f4"])
        self.assertEqual(sources["digest"].cases, {6: 1, 7: 2, 8: 4, 9: 8, 10: 8})
        self.assertEqual(sources["digest"].accumulator, "sum")
        self.assertEqual(sources["sum_n"].accumulator, "s")
        self.assertEqual(sources["twice_sum"].calls, ["leaf_add"])
        self.assertEqual((sources["mod10s"].modulos, sources["div7u"].divisions, sources["mul9"].multiplies), ([10], [7], [9]))
        self.assertEqual(main.load_source("dispatch.c")["dispatch"].params, ["k", "a"])
        self.assertTrue(main.load_source("canary.c")["with_canary"].has_array)

    def test_every_idiom_in_every_build_is_verified_against_the_source(self) -> None:
        report = main.analyze_all()
        self.assertEqual(main.unverified(report), [])
        matrix = main.kind_matrix(report)
        self.assertEqual(matrix["idioms-x86_64-O2"], {"branchless flag": 1, "branchless select": 3, "division": 5, "inlined call": 1, "memcpy": 2, "memset": 1, "modulo": 3, "strength reduction": 1, "switch": 6, "tail call": 2, "unrolled loop": 1, "vector loop": 3})
        self.assertEqual(matrix["idioms-x86_64-O0"], {"branchless flag": 1, "division": 5, "memcpy": 2, "modulo": 3, "switch": 6})
        self.assertEqual(matrix["idioms-arm64-O2"], matrix["idioms-x86_64-O2"])

    def test_figure_data_covers_both_architectures_at_four_levels(self) -> None:
        data = main.figure_data()
        self.assertEqual(sorted(data["arches"]), ["arm64", "x86_64"])
        for arch in data["arches"]:
            self.assertEqual(list(data["arches"][arch]), ["O0", "O1", "O2", "O3"])
        x86 = data["arches"]["x86_64"]
        self.assertEqual([s["k"] for s in x86["O0"]["spans"]], ["division", "modulo", "switch"])
        self.assertEqual([s["k"] for s in x86["O2"]["spans"]], ["division", "modulo", "switch", "vector loop", "branchless select"])
        self.assertEqual((x86["O0"]["count"], x86["O1"]["count"], x86["O2"]["count"]), (64, 33, 74))
        self.assertEqual(x86["O1"]["spans"][2]["d"]["values"], [16, 32, 64, 128, 128])
        self.assertEqual(x86["O2"], x86["O3"])

    def test_site_figure_module_embeds_the_same_data(self) -> None:
        if not SITE_MODULE.exists():
            self.skipTest("site module not present in this checkout")
        source = SITE_MODULE.read_text()
        match = re.search(r"var DATA = (\{.*?\});\n", source, re.S)
        assert match is not None, "figures-re-39.js must define var DATA = {...};"
        embedded = json.loads(match.group(1))
        expected = json.loads(json.dumps(main.figure_data()))
        self.assertEqual(embedded, expected)
        for forbidden in ("=>", "let ", "const ", "`"):
            self.assertNotIn(forbidden, source, f"ES5 only: found {forbidden!r}")


if __name__ == "__main__":
    unittest.main()
