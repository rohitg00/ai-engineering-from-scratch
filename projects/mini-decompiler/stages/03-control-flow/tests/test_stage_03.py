
import unittest
from pathlib import Path

from minidec.cfg import EXIT, ControlFlowGraph, build_cfg, dominance_frontiers, find_value_tables, immediate_dominators, jump_table_resolver, recursive_descent
from minidec.decoder import linear_sweep
from minidec.elf import load_object

PROJECT = Path(__file__).resolve().parents[3]
FIXTURES = PROJECT / "fixtures"


def hexbytes(text):
    return bytes.fromhex(text.replace(" ", ""))


class JumpTableTests(unittest.TestCase):
    def setUp(self):
        self.elf = load_object(FIXTURES / "samples-x86_64-O0.o")

    def test_descent_without_a_resolver_stops_at_the_indirect_jump(self):
        code = self.elf.section(".text").data
        plain = recursive_descent(code, [0x50], 0xC0)
        self.assertEqual([i.address for i in plain.unresolved], [0x76])
        self.assertNotIn(0x78, plain.instructions)
        self.assertEqual(len(plain.instructions), 16)
        self.assertIn(0xAE, plain.instructions)

    def test_table_targets_come_from_the_rodata_relocations(self):
        code = self.elf.section(".text").data
        resolved = recursive_descent(code, [0x50], 0xC0, jump_table_resolver(self.elf))
        self.assertEqual(resolved.unresolved, [])
        table = resolved.tables[0x76]
        self.assertEqual((table.section, table.offset, table.entry_size, table.count), (".rodata", 0, 4, 6))
        self.assertEqual(table.targets, (0x78, 0x81, 0x8A, 0x93, 0x9C, 0xA5))
        self.assertEqual(table.evidence, "relocation")
        self.assertEqual((table.bounds_instruction, table.lea_instruction, table.load_instruction, table.jump_instruction), (0x5E, 0x68, 0x6F, 0x76))
        self.assertEqual(table.index_register, "rax")
        self.assertEqual(len(resolved.instructions), 28)

    def test_graph_with_the_table_has_one_block_per_case_and_table_edges(self):
        graph = build_cfg(self.elf, "band")
        self.assertEqual(len(graph.cfg.blocks), 10)
        kinds = sorted({kind for _s, _t, kind in graph.cfg.edges})
        self.assertEqual(kinds, ["fallthrough", "jump", "table", "taken"])
        self.assertEqual(sum(1 for _s, _t, kind in graph.cfg.edges if kind == "table"), 6)
        idom = graph.cfg.dominators()
        self.assertEqual(idom[0x78], 0x64)
        self.assertEqual(idom[0xAE], 0x50)
        self.assertEqual(idom[0xB5], 0x50)
        self.assertEqual(graph.cfg.post_dominators()[0x50], 0xB5)
        self.assertEqual(graph.cfg.unreachable(), [])
        self.assertEqual(graph.padding_end - graph.end, 6)

    def test_value_table_at_O1_is_read_from_bytes_with_no_indirect_jump(self):
        elf = load_object(FIXTURES / "samples-x86_64-O1.o")
        graph = build_cfg(elf, "band")
        self.assertEqual(graph.descent.tables, {})
        self.assertEqual(len(graph.value_tables), 1)
        table = graph.value_tables[0]
        self.assertFalse(table.is_jump_table)
        self.assertEqual((table.targets, table.evidence, table.count), ((5, 8, 12, 20, 20, 35), "bytes", 6))
        self.assertEqual(len(graph.cfg.blocks), 3)
        self.assertEqual(find_value_tables(elf, graph.descent.sorted_instructions())[0].offset, 0)


class LoopAndDominatorTests(unittest.TestCase):
    def test_rotated_loop_at_O1_has_five_blocks_one_back_edge_and_a_self_loop(self):
        elf = load_object(FIXTURES / "samples-x86_64-O1.o")
        graph = build_cfg(elf, "fold")
        cfg = graph.cfg
        self.assertEqual(sorted(cfg.blocks), [0x70, 0x74, 0x80, 0x92, 0x93])
        self.assertEqual(len(cfg.edges), 5)
        self.assertEqual(cfg.back_edges(), [(0x80, 0x80)])
        self.assertEqual(cfg.dominators(), {0x70: 0x70, 0x74: 0x70, 0x80: 0x74, 0x92: 0x80, 0x93: 0x70})
        self.assertEqual(cfg.natural_loops(), {0x80: {0x80}})
        self.assertEqual(cfg.dominance_frontiers()[0x80], {0x80})
        self.assertEqual(cfg.post_dominators()[0x70], EXIT)

    def test_while_loop_at_O0_exits_from_its_header(self):
        elf = load_object(FIXTURES / "samples-x86_64-O0.o")
        cfg = build_cfg(elf, "fold").cfg
        self.assertEqual(cfg.back_edges(), [(0xE1, 0xD9)])
        self.assertEqual(cfg.natural_loops(), {0xD9: {0xD9, 0xE1}})
        self.assertEqual(cfg.successors(0xD9), [0xFE, 0xE1])
        self.assertEqual(cfg.post_dominators()[0xD9], 0xFE)

    def test_hand_built_diamond_with_a_loop(self):
        succs = {1: [2, 3], 2: [4], 3: [4], 4: [5, 1], 5: []}
        preds = {1: [4], 2: [1], 3: [1], 4: [2, 3], 5: [4]}
        order = [1, 2, 3, 4, 5]
        idom = immediate_dominators(1, order, lambda node: preds.get(node, []))
        self.assertEqual(idom, {1: 1, 2: 1, 3: 1, 4: 1, 5: 4})
        frontiers = dominance_frontiers(idom, lambda node: preds.get(node, []))
        self.assertEqual(frontiers[2], {4})
        self.assertEqual(frontiers[3], {4})
        self.assertEqual(frontiers[4], {1})
        self.assertEqual(frontiers[1], {1})
        self.assertEqual(sorted(succs), order)


class MalformedAndAdversarialTests(unittest.TestCase):
    def test_entry_outside_the_code_is_rejected(self):
        with self.assertRaises(ValueError):
            recursive_descent(hexbytes("c3"), [4], 1)
        with self.assertRaises(ValueError):
            ControlFlowGraph(0x10, linear_sweep(hexbytes("c3")).instructions)

    def test_branch_into_the_middle_of_an_instruction_is_a_conflict(self):
        code = hexbytes("74 03 b8 01 00 00 00 c3")
        result = recursive_descent(code, [0], len(code))
        self.assertEqual(result.conflicts, [(5, 2)])
        self.assertEqual(sorted(result.instructions), [0, 2, 7])

    def test_undecodable_byte_stops_the_path_and_is_listed(self):
        code = hexbytes("31 c0 0f 0a c3")
        result = recursive_descent(code, [0], len(code))
        self.assertEqual([(i.address, i.op) for i in result.unresolved], [(2, "(undecodable)")])
        self.assertEqual(sorted(result.instructions), [0])

    def test_indirect_jump_without_a_matching_idiom_stays_unresolved(self):
        elf = load_object(FIXTURES / "samples-x86_64-O0.o")
        code = hexbytes("48 8b 45 f0 ff e0 c3")
        result = recursive_descent(code, [0], len(code), jump_table_resolver(elf))
        self.assertEqual([i.address for i in result.unresolved], [4])
        cfg = ControlFlowGraph(0, result.sorted_instructions())
        self.assertEqual(cfg.unresolved, [4])
        self.assertEqual(cfg.summary()["unresolvedIndirectJumps"], ["0x4"])


class HeldOutTests(unittest.TestCase):
    def test_held_out_switch_and_loop_shapes(self):
        o0 = load_object(FIXTURES / "heldout" / "extra-x86_64-O0.o")
        switch = build_cfg(o0, "quarter_band")
        table = switch.descent.tables[0x46]
        self.assertEqual(table.targets, (0x48, 0x51, 0x5A, 0x63, 0x6C))
        self.assertEqual(table.count, 5)
        self.assertEqual(len(switch.cfg.blocks), 9)
        loop = build_cfg(o0, "weighted").cfg
        self.assertEqual(loop.back_edges(), [(0xB1, 0xA9)])
        o1 = load_object(FIXTURES / "heldout" / "extra-x86_64-O1.o")
        self.assertEqual(build_cfg(o1, "weighted").cfg.back_edges(), [(0x50, 0x50)])
        self.assertEqual(build_cfg(o1, "quarter_band").value_tables[0].targets, (3, 1, 4, 1, 5))


if __name__ == "__main__":
    unittest.main()
