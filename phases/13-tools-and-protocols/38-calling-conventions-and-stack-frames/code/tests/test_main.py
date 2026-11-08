import contextlib
import io
import json
import re
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
SITE_MODULE = Path(__file__).resolve().parents[5] / "site" / "figures-re-38.js"


def analysis(stem: str, name: str) -> main.FunctionAnalysis:
    info, listing = main.load_fixture(stem)
    return main.analyze_function(name, listing[name], info.abi)


def x86(text: str, abi: str = main.SYSV) -> main.Effect:
    mnemonic, _, operands = text.partition(" ")
    return main.effect(main.Instruction(0, "90", mnemonic, operands), abi)


def arm(text: str) -> main.Effect:
    mnemonic, _, operands = text.partition(" ")
    return main.effect(main.Instruction(0, "d503201f", mnemonic, operands), main.AAPCS64)


class ObjectTests(unittest.TestCase):
    def test_object_headers_pick_the_abi(self) -> None:
        expected = {
            "convention-x86_64-linux-O2": ("ELF64", "x86-64", main.SYSV),
            "convention-x86_64-windows-O2": ("COFF", "AMD64", main.WIN64),
            "convention-aarch64-linux-O2": ("ELF64", "AArch64", main.AAPCS64),
            "convention-arm64-macos-O2": ("Mach-O 64", "arm64", main.APPLE_ARM64),
        }
        for stem, (fmt, machine, abi) in expected.items():
            info = main.describe_object(FIXTURES / f"{stem}.o")
            self.assertEqual((info.format, info.machine, info.abi), (fmt, machine, abi), stem)

    def test_symbol_tables_list_the_same_twelve_functions(self) -> None:
        names = sorted(main.SIGNATURES)
        for stem in main.FIXTURE_OBJECTS:
            info = main.describe_object(FIXTURES / f"{stem}.o")
            self.assertEqual(sorted(f.name for f in info.functions), names, stem)

    def test_listing_parser_keeps_relocation_targets_and_arm_immediates(self) -> None:
        info, listing = main.load_fixture("convention-x86_64-linux-O2")
        call = next(i for i in listing["keeps"] if i.mnemonic == "callq")
        self.assertEqual(call.relocation, "ext")
        info, listing = main.load_fixture("convention-aarch64-linux-O2")
        self.assertEqual(listing["keeps"][0].text, "stp x29, x30, [sp, #-0x30]!")
        self.assertEqual(next(i for i in listing["keeps"] if i.mnemonic == "bl").relocation, "ext")
        info, listing = main.load_fixture("convention-arm64-macos-O2")
        self.assertIn("leaf_add", listing)
        self.assertEqual(listing["leaf_add"][0].text, "add w0, w1, w0")
        self.assertEqual(next(i for i in listing["keeps"] if i.mnemonic == "bl").relocation, "ext")


class EffectTests(unittest.TestCase):
    def test_x86_register_aliases_canonicalize_to_the_full_register(self) -> None:
        self.assertEqual(main.x86_register("%edi"), "rdi")
        self.assertEqual(main.x86_register("%r8d"), "r8")
        self.assertEqual(main.x86_register("%al"), "rax")
        self.assertEqual(main.x86_register("%xmm3"), "xmm3")
        self.assertEqual(main.x86_register("%sil"), "rsi")

    def test_lea_reads_address_registers_without_loading(self) -> None:
        eff = x86("leaq (%rdx,%rcx), %rax")
        self.assertEqual(eff.address_reads, ["rdx", "rcx"])
        self.assertEqual(eff.writes, ["rax"])
        self.assertEqual(eff.loads, [])
        self.assertEqual(len(eff.addresses), 1)

    def test_zero_idiom_and_conversions_are_write_only(self) -> None:
        zero = x86("xorl %eax, %eax")
        self.assertEqual((zero.reads, zero.writes, zero.kind), ([], ["rax"], "zero"))
        convert = x86("cvtsi2sd %edi, %xmm2")
        self.assertEqual((convert.reads, convert.writes), (["rdi"], ["xmm2"]))
        store = x86("movq %rdi, -0x8(%rbp)")
        self.assertEqual(store.reads, ["rdi"])
        self.assertEqual(store.address_reads, ["rbp"])
        self.assertEqual(store.stores[0][2], 8)

    def test_arm_pre_and_post_index_move_the_stack_pointer_at_the_right_time(self) -> None:
        pre = arm("stp x29, x30, [sp, #-0x30]!")
        self.assertEqual((pre.sp_delta, pre.post_sp_delta, pre.kind), (-48, 0, "sp-adjust"))
        self.assertEqual([(s[0].displacement, s[1]) for s in pre.stores], [(0, "x29"), (8, "x30")])
        post = arm("ldp x29, x30, [sp], #0x30")
        self.assertEqual((post.sp_delta, post.post_sp_delta), (0, 48))
        self.assertEqual(post.loads[0].displacement, 0)
        self.assertEqual(post.writes, ["sp", "x29", "x30"])
        store = arm("str w0, [sp, #0xc]")
        self.assertEqual((store.reads, store.address_reads, store.stores[0][2]), (["x0"], ["sp"], 4))


class PrologueTests(unittest.TestCase):
    def test_sysv_keeps_prologue_is_three_pushes_and_no_frame_pointer(self) -> None:
        keeps = analysis("convention-x86_64-linux-O2", "keeps")
        self.assertEqual([i.hex for i in keeps.prologue], ["55", "41 56", "53"])
        self.assertEqual(keeps.saved, [("rbp", -8), ("r14", -16), ("rbx", -24)])
        self.assertEqual(keeps.frame_size, 24)
        self.assertIsNone(keeps.frame_pointer)
        self.assertIn("rbp", keeps.callee_saved_written)
        self.assertEqual(keeps.calls, [("ext", 24)])
        self.assertEqual([i.hex for i in keeps.epilogue], ["5b", "41 5e", "5d", "c3"])

    def test_win64_keeps_prologue_pushes_then_allocates_the_shadow_space(self) -> None:
        keeps = analysis("convention-x86_64-windows-O2", "keeps")
        self.assertEqual([i.hex for i in keeps.prologue], ["56", "57", "53", "48 83 ec 20"])
        self.assertEqual(keeps.saved, [("rsi", -8), ("rdi", -16), ("rbx", -24)])
        self.assertEqual(keeps.frame_size, 56)
        self.assertEqual(keeps.calls, [("ext", 56)])
        self.assertEqual(keeps.epilogue[0].text, "addq $0x20, %rsp")

    def test_aarch64_keeps_frame_record_sits_at_the_bottom_of_the_frame(self) -> None:
        keeps = analysis("convention-aarch64-linux-O2", "keeps")
        self.assertEqual(keeps.prologue[0].hex, "a9bd7bfd")
        self.assertEqual(dict(keeps.saved), {"x29": -48, "x30": -40, "x21": -32, "x20": -16, "x19": -8})
        self.assertEqual((keeps.frame_size, keeps.frame_pointer), (48, -48))
        self.assertEqual(keeps.epilogue[-2].hex, "a8c37bfd")
        self.assertEqual(keeps.calls, [("ext", 48)])

    def test_apple_keeps_puts_the_frame_record_at_the_top_of_the_frame(self) -> None:
        keeps = analysis("convention-arm64-macos-O2", "keeps")
        self.assertEqual(dict(keeps.saved), {"x22": -48, "x21": -40, "x20": -32, "x19": -24, "x29": -16, "x30": -8})
        self.assertEqual((keeps.frame_size, keeps.frame_pointer), (48, -16))
        self.assertEqual(keeps.prologue[-1].text, "add x29, sp, #0x20")

    def test_frame_pointer_present_at_o0_and_omitted_at_o2_on_linux(self) -> None:
        for name in main.SIGNATURES:
            self.assertEqual(analysis("convention-x86_64-linux-O0", name).frame_pointer, -8, name)
            self.assertIsNone(analysis("convention-x86_64-linux-O2", name).frame_pointer, name)
        kept = analysis("convention-x86_64-linux-O2-fp", "keeps")
        self.assertEqual(kept.frame_pointer, -8)
        self.assertEqual([r for r, _ in kept.saved], ["rbp", "r15", "r14", "rbx", "rax"])

    def test_leaf_functions_at_o0_use_the_red_zone_only_under_sysv(self) -> None:
        self.assertEqual(analysis("convention-x86_64-linux-O0", "leaf_add").frame_size, 8)
        self.assertEqual(max(analysis("convention-x86_64-linux-O0", "leaf_add").below_sp), 8)
        self.assertEqual(max(analysis("convention-x86_64-linux-O0", "eight_args").below_sp), 48)
        self.assertEqual(max(analysis("convention-x86_64-linux-O2", "sum_varargs").below_sp), 128)
        windows_leaf = analysis("convention-x86_64-windows-O0", "leaf_add")
        self.assertEqual([i.text for i in windows_leaf.prologue], ["pushq %rax"])
        self.assertEqual(windows_leaf.below_sp, [])
        self.assertEqual(analysis("convention-aarch64-linux-O0", "leaf_add").prologue[0].text, "sub sp, sp, #0x10")
        no_red_zone = analysis("convention-x86_64-linux-O0-noredzone", "leaf_add")
        self.assertEqual([i.text for i in no_red_zone.prologue], ["pushq %rbp", "movq %rsp, %rbp", "pushq %rax"])
        self.assertEqual(no_red_zone.below_sp, [])

    def test_epilogues_mirror_prologues_in_every_fixture(self) -> None:
        for stem in main.FIXTURE_OBJECTS:
            for name, result in main.analyze_fixture(stem).items():
                self.assertTrue(result.epilogue_mirrors, f"{stem} {name}")
                self.assertEqual(result.depth_at_exit, 0, f"{stem} {name}")


class ParameterTests(unittest.TestCase):
    def test_eight_args_registers_and_stack_slots_per_abi(self) -> None:
        for level in ("O0", "O2"):
            sysv = analysis(f"convention-x86_64-linux-{level}", "eight_args")
            self.assertEqual(sorted(sysv.param_registers, key=main._reg_sort), ["rdi", "rsi", "rdx", "rcx", "r8", "r9"])
            self.assertEqual(sorted(sysv.stack_slots), [8, 16])
            win = analysis(f"convention-x86_64-windows-{level}", "eight_args")
            self.assertEqual(sorted(win.param_registers, key=main._reg_sort), ["rdx", "rcx", "r8", "r9"])
            self.assertEqual(sorted(win.stack_slots), [40, 48, 56, 64])
            arm64 = analysis(f"convention-aarch64-linux-{level}", "eight_args")
            self.assertEqual(sorted(arm64.param_registers, key=main._reg_sort), [f"x{n}" for n in range(8)])
            self.assertEqual(arm64.stack_slots, [])

    def test_mixed_shows_independent_sequences_versus_positional_slots(self) -> None:
        self.assertEqual(set(analysis("convention-x86_64-linux-O2", "mixed").param_registers), {"rdi", "xmm0", "rsi", "xmm1"})
        self.assertEqual(set(analysis("convention-x86_64-windows-O2", "mixed").param_registers), {"rcx", "xmm1", "r8", "xmm3"})
        self.assertEqual(set(analysis("convention-aarch64-linux-O2", "mixed").param_registers), {"x0", "v0", "x1", "v1"})
        for stem in ("convention-x86_64-linux-O2", "convention-x86_64-windows-O2"):
            self.assertEqual(analysis(stem, "mixed").return_registers, ["xmm0"], stem)
        self.assertEqual(analysis("convention-aarch64-linux-O2", "mixed").return_registers, ["v0"])

    def test_sixteen_byte_struct_in_two_registers_or_by_reference(self) -> None:
        sysv = analysis("convention-x86_64-linux-O2", "by_value")
        self.assertEqual((set(sysv.param_registers), sysv.return_registers, sysv.hidden_pointer), ({"rdi", "rsi"}, ["rax", "rdx"], None))
        win = analysis("convention-x86_64-windows-O2", "by_value")
        self.assertEqual((set(win.param_registers), win.return_registers, win.hidden_pointer), ({"rcx", "rdx"}, ["rax"], "rcx"))
        self.assertEqual(main.expected_locations(main.WIN64, "by_value")["parameters"][0]["location"], ["rdx (pointer to copy)"])
        arm64 = analysis("convention-aarch64-linux-O2", "by_value")
        self.assertEqual((set(arm64.param_registers), arm64.return_registers), ({"x0", "x1"}, ["x0", "x1"]))

    def test_thirty_two_byte_struct_returns_through_a_hidden_pointer(self) -> None:
        sysv = analysis("convention-x86_64-linux-O2", "big_ret")
        self.assertEqual((sysv.hidden_pointer, sysv.return_registers, set(sysv.param_registers)), ("rdi", ["rax"], {"rdi", "rsi"}))
        win = analysis("convention-x86_64-windows-O2", "big_ret")
        self.assertEqual((win.hidden_pointer, win.return_registers, set(win.param_registers)), ("rcx", ["rax"], {"rcx", "rdx"}))
        arm64 = analysis("convention-aarch64-linux-O2", "big_ret")
        self.assertEqual((arm64.hidden_pointer, arm64.return_registers), ("x8", ["x8 (indirect result)"]))
        self.assertEqual(main.expected_locations(main.SYSV, "big_ret")["parameters"][0]["location"], ["rsi"])

    def test_varargs_callee_reads_al_homes_registers_or_saves_them(self) -> None:
        sysv = analysis("convention-x86_64-linux-O0", "sum_varargs")
        self.assertTrue(sysv.reads_al)
        self.assertEqual(len(sysv.param_registers), 14)
        self.assertEqual(sysv.frame_size, 136)
        win = analysis("convention-x86_64-windows-O2", "sum_varargs")
        self.assertEqual(sorted(o for _, o in win.home_stores), [16, 24, 32])
        self.assertIn(16, win.frame_addresses)
        linux_arm = analysis("convention-aarch64-linux-O2", "sum_varargs")
        self.assertTrue({f"x{n}" for n in range(1, 8)} | {f"v{n}" for n in range(8)} <= {r for r, _, _ in linux_arm.spills})
        self.assertEqual(linux_arm.frame_size, 224)
        apple = analysis("convention-arm64-macos-O2", "sum_varargs")
        self.assertEqual((apple.param_registers, apple.spills, apple.frame_addresses), (["x0"], [], [0]))

    def test_caller_side_setup_per_abi(self) -> None:
        sysv = analysis("convention-x86_64-linux-O2", "call8")
        self.assertEqual(sysv.outgoing_registers, ["rdi", "rsi", "rdx", "rcx", "r8", "r9"])
        self.assertEqual(sorted(sysv.outgoing_stores), [(0, 7), (8, 8)])
        self.assertEqual(sysv.calls, [("ext8", 24)])
        win = analysis("convention-x86_64-windows-O2", "call8")
        self.assertEqual(sorted(win.outgoing_stores), [(32, 5), (40, 6), (48, 7), (56, 8)])
        self.assertEqual((win.frame_size, win.calls), (72, [("ext8", 72)]))
        arm64 = analysis("convention-aarch64-linux-O2", "call8")
        self.assertEqual((arm64.outgoing_registers, arm64.tail_call), ([f"x{n}" for n in range(8)], "ext8"))
        self.assertTrue(analysis("convention-x86_64-linux-O2", "call_varargs").al_zeroed)
        self.assertTrue(analysis("convention-x86_64-linux-O0", "call_varargs").al_zeroed)
        self.assertEqual(analysis("convention-x86_64-windows-O2", "call_varargs").calls, [("extva", 40)])
        apple = analysis("convention-arm64-macos-O2", "call_varargs")
        self.assertEqual(sorted(o for o, _ in apple.outgoing_stores), [0, 8, 16])
        self.assertEqual(analysis("convention-aarch64-linux-O2", "call_varargs").outgoing_registers, ["x0", "x1", "x2", "x3"])

    def test_caller_passes_the_result_buffer_address_for_big_structs(self) -> None:
        self.assertEqual(analysis("convention-x86_64-linux-O2", "call_big").outgoing_addresses, [(8, "rdi")])
        self.assertEqual(analysis("convention-x86_64-windows-O2", "call_big").outgoing_addresses, [(40, "rcx")])
        self.assertEqual(analysis("convention-aarch64-linux-O2", "call_big").outgoing_addresses, [(0, "x8")])
        win_pair = analysis("convention-x86_64-windows-O2", "call_pair")
        self.assertEqual(sorted(win_pair.outgoing_addresses), [(32, "rdx"), (56, "rcx")])
        self.assertEqual(analysis("convention-x86_64-linux-O2", "call_pair").return_registers, ["rax"])

    def test_every_inference_agrees_with_its_rule(self) -> None:
        total = 0
        for stem in main.FIXTURE_OBJECTS:
            for name, result in main.analyze_fixture(stem).items():
                for check in result.checks:
                    self.assertTrue(check.agree, f"{stem} {name}: {check.rule} expected {check.expected} observed {check.observed}")
                    total += 1
        self.assertEqual(total, 489)


class UnwindTests(unittest.TestCase):
    def test_seh_unwind_codes_match_the_prologue_parse(self) -> None:
        results = main.seh_cross_check()
        self.assertEqual([r["function"] for r in results], ["sum_varargs", "keeps", "call8", "call_varargs", "call_pair", "call_big"])
        self.assertTrue(all(r["agree"] for r in results))
        keeps = next(r for r in results if r["function"] == "keeps")
        self.assertEqual(keeps["sizeOfProlog"], 7)
        self.assertEqual([(c["prologOffset"], c["op"], c.get("register", c.get("bytes"))) for c in keeps["codes"]], [(7, "UWOP_ALLOC_SMALL", 32), (3, "UWOP_PUSH_NONVOL", "rbx"), (2, "UWOP_PUSH_NONVOL", "rdi"), (1, "UWOP_PUSH_NONVOL", "rsi")])
        varargs = next(r for r in results if r["function"] == "sum_varargs")
        self.assertEqual(varargs["codes"], [{"prologOffset": 1, "op": "UWOP_ALLOC_SMALL", "bytes": 8}])

    def test_unwind_info_decoder_reads_the_header_fields(self) -> None:
        info = main.describe_object(FIXTURES / "convention-x86_64-windows-O2-seh.o")
        self.assertEqual(info.sections[".xdata"][:12].hex(" "), "01 01 01 00 01 02 00 00 01 07 04 00")
        decoded = main.decode_unwind_info(info.sections[".xdata"], 8)
        self.assertEqual((decoded["version"], decoded["flags"], decoded["sizeOfProlog"], decoded["countOfCodes"], decoded["frameRegister"]), (1, 0, 7, 4, None))
        self.assertEqual(len(info.sections[".pdata"]), 6 * 12)

    def test_eh_frame_cfi_matches_saved_registers_and_depth(self) -> None:
        for stem in ("convention-x86_64-linux-O2-eh", "convention-aarch64-linux-O2-eh"):
            results = main.eh_frame_cross_check(stem)
            self.assertEqual(len(results), 12, stem)
            for result in results:
                self.assertTrue(result["agree"], f"{stem} {result}")
        x86_keeps = next(r for r in main.eh_frame_cross_check("convention-x86_64-linux-O2-eh") if r["function"] == "keeps")
        self.assertEqual(x86_keeps["cfiSaved"], {"rbx": -32, "r14": -24, "rbp": -16})
        self.assertEqual(x86_keeps["cfiMaxOffset"], 32)
        arm_keeps = next(r for r in main.eh_frame_cross_check("convention-aarch64-linux-O2-eh") if r["function"] == "keeps")
        self.assertEqual(arm_keeps["cfiSaved"], {"x19": -8, "x20": -16, "x21": -32, "x30": -40, "x29": -48})
        self.assertEqual(arm_keeps["cfaRegisters"], ["x29", "sp"])


class ToolTests(unittest.TestCase):
    def test_tool_captures_record_what_each_tool_said(self) -> None:
        captures = main.tool_captures()
        r2 = captures["radare2-convention-x86_64-linux-O2.txt"]
        self.assertEqual(r2["conventions"]["eight_args"], "amd64")
        self.assertEqual(r2["arguments"]["eight_args"], ["rdi", "rsi", "rdx", "r8", "r9", "rsp+0x8", "rsp+0x10"])
        self.assertEqual(r2["arguments"]["mixed"], ["xmm0", "xmm1", "xmm2"])
        self.assertEqual(r2["arguments"]["leaf_add"], ["rdi"])
        self.assertEqual(captures["radare2-convention-x86_64-windows-O2.txt"]["conventions"]["eight_args"], "ms")
        self.assertEqual(captures["rizin-convention-x86_64-windows-O2.txt"]["conventions"]["eight_args"], "amd64")
        self.assertIn("ms", captures["rizin-convention-x86_64-windows-O2.txt"]["available"])
        angr = captures["angr-convention-x86_64-linux-O2.txt"]
        self.assertEqual(angr["conventions"]["eight_args"], "SimCCSystemVAMD64")
        self.assertEqual(angr["arguments"]["eight_args"][0].count("long long"), 9)
        self.assertEqual(angr["arguments"]["big_ret"], ["(BOT*, long long (64 bits)) -> BOT*"])
        self.assertEqual(captures["angr-convention-x86_64-windows-O2.txt"]["conventions"]["eight_args"], "SimCCMicrosoftAMD64")

    def test_live_tools_are_optional(self) -> None:
        results = main.run_tools()
        for tool in ("radare2", "rizin"):
            self.assertTrue(results[tool] == "absent" or isinstance(results[tool], list) or results[tool].startswith("failed"), tool)


class FigureAndCliTests(unittest.TestCase):
    def test_figure_data_is_derived_from_the_analysis(self) -> None:
        data = main.figure_data()
        self.assertEqual(data["functions"], ["eight_args", "keeps"])
        self.assertEqual([a["id"] for a in data["abis"]], [main.SYSV, main.WIN64, main.AAPCS64])
        sysv = data["frames"]["eight_args"]["O2"][main.SYSV]
        self.assertEqual([c["lo"] for c in sysv["cells"] if c["kind"] == "arg"], [16, 8])
        self.assertEqual(sysv["regs"][0], {"p": "a", "r": "rdi"})
        win = data["frames"]["eight_args"]["O2"][main.WIN64]
        self.assertEqual(len([c for c in win["cells"] if c["kind"] == "shadow"]), 4)
        self.assertEqual([c["lo"] for c in win["cells"] if c["kind"] == "arg"], [64, 56, 48, 40])
        keeps = data["frames"]["keeps"]["O2"]
        self.assertEqual((keeps[main.SYSV]["frame"], keeps[main.WIN64]["frame"], keeps[main.AAPCS64]["frame"]), (24, 56, 48))
        self.assertEqual([c["label"] for c in keeps[main.AAPCS64]["cells"] if c["kind"] == "fp"], ["frame record: saved x30 (LR)", "frame record: saved x29"])
        red = [c for c in data["frames"]["eight_args"]["O0"][main.SYSV]["cells"] if c["kind"] == "redzone"]
        self.assertEqual((red[0]["lo"], red[0]["hi"]), (-56, -8))

    def test_site_figure_module_embeds_the_same_data(self) -> None:
        if not SITE_MODULE.exists():
            self.skipTest("site module not present in this checkout")
        source = SITE_MODULE.read_text()
        match = re.search(r"var DATA = (\{.*?\});\n", source, re.S)
        assert match is not None, "figures-re-38.js must define var DATA = {...};"
        self.assertEqual(json.loads(match.group(1)), json.loads(json.dumps(main.figure_data())))
        for forbidden in ("=>", "let ", "const ", "`"):
            self.assertNotIn(forbidden, source, f"ES5 only: found {forbidden!r}")

    def test_cli_commands_run(self) -> None:
        for argv in (["object", str(FIXTURES / "convention-aarch64-linux-O2.o")], ["analyze", "convention-x86_64-windows-O2", "keeps"], ["seh"], ["eh-frame", "convention-aarch64-linux-O2-eh"], ["figure-data"]):
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                self.assertEqual(main.main(argv), 0, argv)
            json.loads(out.getvalue())
        self.assertEqual(main.main(["bogus"]), 2)

    def test_demo_reports_every_object_with_full_agreement(self) -> None:
        report = main.demo()
        self.assertEqual(sorted(report["objects"]), sorted(main.FIXTURE_OBJECTS))
        for stem, entry in report["objects"].items():
            agree, total = entry["checks"].split()[0].split("/")
            self.assertEqual(agree, total, stem)
        self.assertTrue(all(r["agree"] for r in report["sehCrossCheck"]))


if __name__ == "__main__":
    unittest.main()
