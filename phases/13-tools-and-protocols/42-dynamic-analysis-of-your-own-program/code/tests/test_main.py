import json
import re
import shutil
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
SITE_MODULE = Path(__file__).resolve().parents[5] / "site" / "figures-re-42.js"


def plan(variant: str) -> main.Plan:
    return main.make_plan(variant)


def transcript(variant: str) -> main.Transcript:
    return main.load_transcript(f"session-{variant}.lldb.txt")


def layout(variant: str = "O0") -> dict:
    return main.struct_layout((FIXTURES / f"account-{variant}.dwarfdump.txt").read_text(), "account")


class ListingTests(unittest.TestCase):
    def test_listing_finds_the_four_functions_and_their_ranges(self) -> None:
        listing = main.load_listing("account-O0.objdump.txt")
        self.assertEqual(listing.format, "mach-o")
        self.assertEqual(listing.arch, "arm64")
        self.assertEqual(sorted(listing.functions), ["bump", "classify", "main", "sum_balances"])
        bump = listing.function("bump")
        self.assertEqual((bump.start, bump.end), (0x1000004B0, 0x1000004E0))
        self.assertEqual(listing.function_containing(0x100000504).name, "classify")
        self.assertEqual(bump.line_at(0x1000004B0).text, "sub\tsp, sp, #0x10")

    def test_conditional_branches_of_classify_at_o0_carry_target_and_fallthrough(self) -> None:
        branches = plan("O0").branches()
        self.assertEqual([(b.mnemonic, hex(b.address), hex(b.target), hex(b.fallthrough)) for b in branches], [
            ("tbz", "0x1000004f0", "0x100000504", "0x1000004f4"),
            ("b.le", "0x100000510", "0x100000524", "0x100000514"),
        ])

    def test_lift_of_tbz_and_b_le_matches_the_source_conditions(self) -> None:
        listing = main.load_listing("account-O0.objdump.txt")
        classify = listing.function("classify")
        first, second = classify.conditional_branches("arm64")
        text, predicate = main.lift_condition(classify, first, "a->balance")
        self.assertEqual(text, "a->balance >= 0")
        self.assertEqual([predicate(v) for v in (-40, 0, 100)], [False, True, True])
        text, predicate = main.lift_condition(classify, second, "a->balance")
        self.assertEqual(text, "a->balance <= 200")
        self.assertEqual([predicate(v) for v in (100, 200, 255)], [True, True, False])

    def test_main_at_o0_calls_the_three_functions_and_at_o2_calls_none(self) -> None:
        self.assertEqual(main.load_listing("account-O0.objdump.txt").call_counts("main"), {"external": 6, "bump": 1, "classify": 3, "sum_balances": 1})
        self.assertEqual(main.load_listing("account-O2.objdump.txt").call_counts("main"), {"external": 4})
        self.assertEqual(plan("O2").branches(), [])

    def test_x86_64_conditional_branch_detection(self) -> None:
        self.assertTrue(main.is_conditional("jle", "x86_64"))
        self.assertTrue(main.is_conditional("ja", "x86_64"))
        self.assertFalse(main.is_conditional("jmp", "x86_64"))
        self.assertFalse(main.is_conditional("callq", "x86_64"))
        self.assertTrue(main.is_conditional("b.ne", "arm64"))
        self.assertFalse(main.is_conditional("b", "arm64"))


class DwarfTests(unittest.TestCase):
    def test_struct_layout_from_the_dwarf_dump(self) -> None:
        result = layout()
        self.assertEqual(result["size"], 32)
        self.assertEqual({name: member["offset"] for name, member in result["members"].items()}, {"kind": 0, "balance": 4, "code": 8, "rate": 16, "label": 24})
        self.assertEqual(result["members"]["label"]["type"], "const char *")

    def test_o2_dwarf_keeps_the_subprograms_but_has_no_inlined_subroutine_entries(self) -> None:
        text = (FIXTURES / "account-O2.dwarfdump.txt").read_text()
        self.assertEqual(main.count_tags(text, "DW_TAG_inlined_subroutine"), 0)
        self.assertEqual(sorted(main.subprogram_names(text)), ["bump", "classify", "main", "sum_balances"])

    def test_nm_still_lists_the_three_functions_at_o2(self) -> None:
        names = {line.split()[-1] for line in (FIXTURES / "account-O2.nm.txt").read_text().splitlines()}
        self.assertTrue({"_bump", "_classify", "_sum_balances", "_main"} <= names)


class PlanTests(unittest.TestCase):
    def test_plan_commands_match_the_captured_session_file(self) -> None:
        for variant in main.VARIANTS:
            expected = (FIXTURES / f"session-{variant}.lldb").read_text().splitlines()
            self.assertEqual(plan(variant).commands(), expected, variant)

    def test_plan_sets_name_breakpoints_then_edge_breakpoints_then_one_hook(self) -> None:
        commands = plan("O0").commands()
        self.assertEqual(commands[:3], ["breakpoint set -n bump", "breakpoint set -n classify", "breakpoint set -n sum_balances"])
        self.assertEqual(sum(1 for c in commands if c.startswith("breakpoint set -a")), 4)
        self.assertTrue(all("-s account-O0" in c for c in commands if c.startswith("breakpoint set -a")))
        self.assertEqual(sum(1 for c in commands if c.startswith("target stop-hook add")), 1)
        self.assertEqual(commands.count("continue"), main.CONTINUE_BUDGET)
        self.assertEqual(commands[-2:], ["breakpoint list", "watchpoint list -v"])

    def test_transcript_header_records_the_lldb_command_that_ran_the_plan(self) -> None:
        for variant in main.VARIANTS:
            header = transcript(variant).header
            self.assertEqual(header["command"], " ".join(plan(variant).lldb_command()), variant)
            self.assertTrue(header["lldb"].startswith("lldb-"), variant)


class TranscriptTests(unittest.TestCase):
    def test_o0_run_stops_eleven_times_and_exits_zero(self) -> None:
        result = transcript("O0")
        self.assertEqual(result.arch, "arm64")
        self.assertEqual(len(result.stops), 11)
        self.assertEqual([s.function for s in result.stops], ["bump", "bump"] + ["classify"] * 8 + ["sum_balances"])
        self.assertEqual(result.exit_status, 0)
        self.assertEqual(result.program_output, list(main.EXPECTED_OUTPUT))

    def test_hook_output_is_attached_to_the_stop_that_follows_it(self) -> None:
        first = transcript("O0").stops[0]
        self.assertEqual(first.pc, 0x1000004BC)
        self.assertEqual(first.reason, "breakpoint 1.1")
        self.assertEqual(first.registers["x1"], 5)
        self.assertEqual(first.registers["x0"], first.memory_base)
        self.assertEqual(first.memory[:8], [0x73, 0xFA, 0x9, 0x0, 0x0, 0x3FF40000, 0x719, 0x1])
        self.assertEqual(first.arguments, {"a": "0x000000016fdfe008", "by": "5"})
        self.assertEqual(first.struct_pointer().fields["label"], '0x0000000100000719 "savings"')

    def test_breakpoint_table_carries_resolution_and_hit_counts(self) -> None:
        result = transcript("O0")
        self.assertEqual({n: b.hits for n, b in result.breakpoints.items()}, {1: 1, 2: 3, 3: 1, 4: 2, 5: 1, 6: 1, 7: 1})
        self.assertTrue(all(b.resolved for b in result.breakpoints.values()))
        self.assertEqual(result.breakpoints[4].address, 0x100000504)
        self.assertEqual(result.hits(), {"bump": 1, "classify": 3, "sum_balances": 1, "0x0000000100000504": 2, "0x00000001000004f4": 1, "0x0000000100000524": 1, "0x0000000100000514": 1})

    def test_watchpoint_reports_old_and_new_value_and_four_hardware_slots(self) -> None:
        result = transcript("O0")
        watch = result.watchpoints[1]
        self.assertEqual((watch.size, watch.kind, watch.hits, watch.hit_count), (4, "m", [(250, 255)], 1))
        self.assertEqual(watch.address, result.stops[0].registers["x0"] + 4)
        self.assertEqual(result.hardware_watchpoints, 4)
        hit = result.stops[1]
        self.assertTrue(hit.is_watchpoint)
        self.assertEqual((hit.watch_hit, hit.pc, hit.line), ((250, 255), 0x1000004D0, 14))

    def test_o2_run_resolves_every_breakpoint_hits_none_and_the_watchpoint_fails(self) -> None:
        result = transcript("O2")
        self.assertEqual(result.stops, [])
        self.assertEqual(result.exit_status, 0)
        self.assertEqual({n: (b.resolved, b.hits) for n, b in result.breakpoints.items()}, {1: (True, 0), 2: (True, 0), 3: (True, 0)})
        self.assertEqual(result.watchpoints, {})
        self.assertIn(("watchpoint set variable a->balance", "Command requires a process which is currently stopped."), result.errors)
        self.assertEqual(sum(1 for c, m in result.errors if m == "Process must be launched."), main.CONTINUE_BUDGET)
        self.assertEqual(result.program_output, list(main.EXPECTED_OUTPUT))

    def test_sandboxed_launch_fails_before_any_stop(self) -> None:
        result = main.load_transcript("sandbox-O0.lldb.txt")
        self.assertEqual(result.stops, [])
        self.assertIsNone(result.launched)
        self.assertEqual(result.errors[0], ("run", "process exited with status -1 (attach failed ((os/kern) invalid address))"))

    def test_core_round_trip_keeps_the_stack_and_loses_the_text_string(self) -> None:
        report = main.core_report()
        self.assertEqual(report["savedAt"], {"function": "bump", "pc": "0x1000004bc"})
        self.assertEqual(report["saving"], "Saving 49152 bytes of data for memory region at 0x16fdf4000")
        self.assertEqual([f["function"] for f in report["backtrace"]], ["bump", "main", "start"])
        self.assertEqual(report["fieldsFromCore"]["balance"], "250")
        self.assertEqual(report["fieldsFromCore"]["label"], '""')
        self.assertEqual(report["labelPointer"], '0x0000000100000719 ""')
        self.assertEqual(report["memory"]["0x16fdfe008"][1], "0x000000fa")

    def test_python_api_without_a_process_reads_layout_and_function_ranges(self) -> None:
        report = main.types_report()
        self.assertEqual(report["python"], "3.9.6")
        self.assertEqual(report["size"], 32)
        self.assertEqual(report["fields"], [("kind", 0, "char"), ("balance", 4, "int"), ("code", 8, "short"), ("rate", 16, "double"), ("label", 24, "const char *")])
        self.assertEqual(report["functions"][0], ("bump", "0x1000004b0", "0x1000004e0", 12))

    def test_parser_handles_a_hand_written_x86_64_style_transcript(self) -> None:
        text = "\n".join([
            "(lldb) target create \"./prog\"",
            "Current executable set to '/tmp/prog' (x86_64).",
            "(lldb) breakpoint set -n f",
            "Breakpoint 1: where = prog`f + 4 at prog.c:3:5, address = 0x0000000000401130",
            "(lldb) run",
            "     rdi = 0x0000000000000007",
            "     rsi = 0x0000000000000008",
            "     rip = 0x0000000000401130  prog`f + 4 at prog.c:3:5",
            "0x7fffffffe000: 0x00000007 0x00000008",
            "(int) x = 7",
            "Process 7 launched: '/tmp/prog' (x86_64)",
            "Process 7 stopped",
            "* thread #1, name = 'prog', stop reason = breakpoint 1.1",
            "    frame #0: 0x0000000000401130 prog`f(x=7, y=8) at prog.c:3:5",
            "(lldb) continue",
            "Process 7 resuming",
            "Process 7 exited with status = 3 (0x00000003)",
            "",
        ])
        result = main.parse_transcript(text, leader="rdi")
        self.assertEqual(result.arch, "x86_64")
        self.assertEqual(len(result.stops), 1)
        self.assertEqual(result.stops[0].registers, {"rdi": 7, "rsi": 8, "rip": 0x401130})
        self.assertEqual(result.stops[0].memory, [7, 8])
        self.assertEqual(result.stops[0].arguments, {"x": "7", "y": "8"})
        self.assertEqual(result.exit_status, 3)


class EvidenceTests(unittest.TestCase):
    def test_every_claim_is_confirmed_at_o0(self) -> None:
        report = main.variant_report("O0")
        self.assertEqual({c["id"]: c["verdict"] for c in report["claims"]}, {
            "arg-registers": "confirmed",
            "field-offsets": "confirmed",
            "branch-1": "confirmed",
            "branch-2": "confirmed",
            "calls": "confirmed",
            "store-once": "confirmed",
            "stride": "confirmed",
            "output": "confirmed",
        })
        counts = {c["id"]: c["confirmed"] for c in report["claims"]}
        self.assertEqual(counts, {"arg-registers": 5, "field-offsets": 11, "branch-1": 3, "branch-2": 2, "calls": 1, "store-once": 1, "stride": 1, "output": 1})

    def test_branch_evidence_names_the_value_the_condition_and_the_edge(self) -> None:
        records = [e for e in main.variant_report("O0")["evidence"] if e["claim"].startswith("branch")]
        self.assertEqual([(e["claim"], e["stop"]) for e in records], [("branch-1", 3), ("branch-2", 4), ("branch-1", 6), ("branch-2", 7), ("branch-1", 9)])
        self.assertIn("a->balance = -40, a->balance >= 0 is False, next stop 0x1000004f4 (fallthrough)", records[-1]["observation"])
        self.assertIn("a->balance = 255, a->balance <= 200 is False, next stop 0x100000514 (fallthrough)", records[3]["observation"])

    def test_field_offset_evidence_decodes_the_words_through_the_dwarf_layout(self) -> None:
        records = [e for e in main.variant_report("O0")["evidence"] if e["claim"] == "field-offsets"]
        self.assertEqual(len(records), 11)
        self.assertIn("kind 's', balance 250, code 9, rate 1.25, label 0x100000719", records[0]["observation"])
        self.assertIn("balance 255", records[1]["observation"])
        self.assertIn("kind 'l', balance -40, code 3, rate 2.0", records[8]["observation"])

    def test_store_and_stride_evidence(self) -> None:
        by_claim = {e["claim"]: e for e in main.variant_report("O0")["evidence"] if e["claim"] in ("store-once", "stride")}
        self.assertEqual(by_claim["store-once"]["observation"], "watchpoint hit 1 time(s): old 250, new 255, by 5, pc 0x1000004d0")
        self.assertIn("row 1 at 0x16fdfe008 balance 255 (classify saw 255)", by_claim["stride"]["observation"])
        self.assertIn("total 315, program printed 'sum 315'", by_claim["stride"]["observation"])

    def test_o2_refutes_the_call_edges_and_leaves_the_rest_not_observed(self) -> None:
        report = main.variant_report("O2")
        self.assertEqual({c["id"]: c["verdict"] for c in report["claims"]}, {
            "arg-registers": "not-observed",
            "field-offsets": "not-observed",
            "calls": "refuted",
            "store-once": "not-observed",
            "stride": "not-observed",
            "output": "confirmed",
        })
        calls = next(e for e in report["evidence"] if e["claim"] == "calls")
        self.assertIn("exit status 0", calls["observation"])
        self.assertIn("hit count 0", calls["observation"])

    def test_a_wrong_register_value_is_refuted_not_ignored(self) -> None:
        text = (FIXTURES / "session-O0.lldb.txt").read_text().replace("x1 = 0x0000000000000005", "x1 = 0x0000000000000006", 1)
        result = main.parse_transcript(text)
        evidence = main.evaluate(plan("O0"), result, layout())
        first = next(e for e in evidence if e.claim == "arg-registers")
        self.assertEqual((first.verdict, first.stop), ("refuted", 0))
        self.assertEqual(main.rollup(evidence)["arg-registers"]["verdict"], "refuted")

    def test_a_missing_watchpoint_hit_is_not_observed(self) -> None:
        text = re.sub(r"old value: 250\nnew value: 255\n", "", (FIXTURES / "session-O0.lldb.txt").read_text())
        result = main.parse_transcript(text)
        evidence = main.evaluate(plan("O0"), result, layout())
        store = next(e for e in evidence if e.claim == "store-once")
        self.assertEqual(store.verdict, "not-observed")

    def test_rollup_prefers_refuted_over_confirmed(self) -> None:
        records = [main.Evidence("c", "confirmed", 0, ""), main.Evidence("c", "refuted", 1, ""), main.Evidence("d", "not-observed", None, "")]
        summary = main.rollup(records)
        self.assertEqual(summary["c"]["verdict"], "refuted")
        self.assertEqual(summary["d"]["verdict"], "not-observed")


class ReferenceTests(unittest.TestCase):
    def test_command_map_has_a_gdb_and_an_lldb_form_for_every_task(self) -> None:
        self.assertGreaterEqual(len(main.COMMAND_MAP), 30)
        for task, gdb, lldb, _alias in main.COMMAND_MAP:
            self.assertTrue(task and gdb and lldb, task)
        table = main.command_table()
        self.assertIn("watchpoint set variable a->balance", table)
        self.assertIn("process save-core --style stack core", table)

    def test_hardware_limits_name_four_x86_debug_registers_and_the_arm64_slot_count(self) -> None:
        by_arch = {row["arch"]: row for row in main.HARDWARE_LIMITS}
        self.assertEqual(by_arch["x86-64"]["count"], 4)
        self.assertEqual(by_arch["x86-64"]["lengths"], [1, 2, 4, 8])
        self.assertIn("4 reported by lldb", by_arch["arm64"]["count"])

    def test_demo_lists_absent_tools_instead_of_failing(self) -> None:
        report = main.demo()
        self.assertEqual(set(report["tools"]), set(main.TOOLS))
        self.assertEqual(report["absentTools"], sorted(n for n, present in report["tools"].items() if not present))
        self.assertEqual(report["variants"]["O0"]["exitStatus"], 0)
        self.assertEqual(report["sandbox"]["stops"], 0)

    def test_live_mode_reports_a_reason_when_a_tool_is_missing(self) -> None:
        saved = shutil.which
        try:
            shutil.which = lambda name: None
            result = main.live("O0")
        finally:
            shutil.which = saved
        self.assertFalse(result["ran"])
        self.assertIn("clang", result["reason"])
        self.assertIn("lldb", result["reason"])


class FigureTests(unittest.TestCase):
    def test_figure_data_is_derived_from_both_sessions(self) -> None:
        data = main.figure_data()
        self.assertEqual(data["claimOrder"], ["arg-registers", "field-offsets", "branch-1", "branch-2", "calls", "store-once", "stride", "output"])
        self.assertEqual(len(data["variants"]["O0"]["stops"]), 11)
        self.assertEqual(data["variants"]["O2"]["stops"], [])
        self.assertEqual(data["variants"]["O0"]["stops"][1]["watch"], (250, 255))
        self.assertEqual(data["variants"]["O0"]["stops"][9]["claims"], {"field-offsets": "confirmed", "branch-1": "confirmed"})
        self.assertEqual([h["hits"] for h in data["variants"]["O2"]["hits"]], [0, 0, 0])

    def test_site_figure_module_embeds_the_same_data(self) -> None:
        if not SITE_MODULE.exists():
            self.skipTest("site module not present in this checkout")
        source = SITE_MODULE.read_text()
        match = re.search(r"var DATA = (\{.*?\});\n", source, re.S)
        assert match is not None, "figures-re-42.js must define var DATA = {...};"
        embedded = json.loads(match.group(1))
        expected = json.loads(json.dumps(main.figure_data()))
        self.assertEqual(embedded, expected)
        for forbidden in ("=>", "let ", "const ", "`"):
            self.assertNotIn(forbidden, source, f"ES5 only: found {forbidden!r}")


if __name__ == "__main__":
    unittest.main()
