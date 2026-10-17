import importlib.util
import sys
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson01_agent_loop", MODULE_PATH)
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)

class ToolRegistryTests(unittest.TestCase):
    def test_dispatch_runs_registered_tool(self):
        registry = module.ToolRegistry()
        registry.register("calculator", module.calculator)
        call = module.ToolCall(id="call-1", name="calculator", args={"expr": "2 + 2"})
        self.assertEqual(registry.dispatch(call), "4")

    def test_dispatch_unknown_tool_returns_error_string(self):
        registry = module.ToolRegistry()
        call = module.ToolCall(id="call-1", name="missing", args={})
        self.assertIn("unknown tool", registry.dispatch(call))

    def test_dispatch_bad_args_is_caught_not_raised(self):
        registry = module.ToolRegistry()
        registry.register("calculator", module.calculator)
        call = module.ToolCall(id="call-1", name="calculator", args={"expression": "1 + 1"})
        observation = registry.dispatch(call)
        self.assertIn("error: bad args for calculator", observation)

class CalculatorAndKVStoreTests(unittest.TestCase):
    def test_calculator_evaluates_arithmetic(self):
        self.assertEqual(module.calculator("120 * 0.15"), "18.0")

    def test_calculator_rejects_illegal_characters(self):
        self.assertEqual(module.calculator("__import__('os')"), "error: illegal character in expr")

    def test_kv_store_roundtrip(self):
        kv = module.KVStore()
        kv.set("base", "120")
        self.assertEqual(kv.get("base"), "120")
        self.assertEqual(kv.get("missing-key"), "missing:missing-key")

class AgentLoopTests(unittest.TestCase):
    def test_demo_agent_reaches_explicit_finish(self):
        agent = module.build_demo_agent()
        result = agent.run("What is 120 plus 15% tax, stored in kv?")
        self.assertEqual(result, "the total including 15% tax is 138.0")
        self.assertEqual(agent.history[-1].kind, "final")

    def test_no_tool_calls_triggers_implicit_stop(self):
        agent = module.build_no_tool_calls_demo()
        result = agent.run("compute 2 + 2 then stop")
        self.assertEqual(result, "stopped: assistant turn had no tool calls")

    def test_max_tool_calls_per_turn_drops_excess_calls(self):
        agent = module.build_parallel_calls_demo()
        agent.run("store three values")
        dropped = [t for t in agent.history if t.observation and "dropped" in t.observation]
        self.assertEqual(len(dropped), 1)

    def test_malformed_args_recover_on_retry(self):
        agent = module.build_malformed_args_demo()
        result = agent.run("divide 10 by 2")
        errors = [t for t in agent.history if t.observation and t.observation.startswith("error:")]
        self.assertEqual(len(errors), 1)
        self.assertEqual(result, "the answer is 5.0")

    def test_tool_call_ids_are_unique_within_a_turn(self):
        agent = module.build_out_of_order_demo()
        agent.run("compute two sums")
        actions = [t for t in agent.history if t.kind == "action"]
        ids = [t.tool_call.id for t in actions]
        self.assertEqual(len(ids), len(set(ids)))

    def test_supplied_call_ids_are_preserved(self):
        agent = module.build_out_of_order_demo()
        agent.run("compute two sums")
        ids = {t.tool_call.id for t in agent.history if t.kind == "action"}
        self.assertEqual(ids, {"tool-42", "tool-7"})

    def test_out_of_order_results_correlate_by_id(self):
        agent = module.build_out_of_order_demo()
        agent.run("compute two sums")
        order = [t.tool_call.id for t in agent.history if t.kind == "action"]
        self.assertEqual(order, ["tool-7", "tool-42"])
        by_id = module.observations_by_id(agent.history)
        self.assertEqual(by_id["tool-42"], "2")
        self.assertEqual(by_id["tool-7"], "4")

    def test_missing_ids_are_generated(self):
        agent = module.build_parallel_calls_demo()
        agent.run("store three values")
        ids = [t.tool_call.id for t in agent.history if t.kind == "action"]
        self.assertEqual(ids, ["call-1", "call-2", "call-3"])

    def test_implicit_stop_returns_reply_content_when_present(self):
        agent = module.AgentLoop(
            llm=module.ToyLLM([{"kind": "action", "thought": "done", "calls": [],
                                "content": "the answer is 4"}]),
            tools=_calculator_only_registry(),
        )
        self.assertEqual(agent.run("2 + 2"), "the answer is 4")

    def test_budget_exhausted_when_llm_never_finishes(self):
        agent = module.AgentLoop(
            llm=module.ToyLLM([{"kind": "action", "thought": "keep going", "calls": [
                {"name": "calculator", "args": {"expr": "1 + 1"}}
            ]}] * 3),
            tools=_calculator_only_registry(),
            max_turns=3,
        )
        result = agent.run("never finishes")
        self.assertEqual(result, "budget exhausted")

def _calculator_only_registry() -> "module.ToolRegistry":
    registry = module.ToolRegistry()
    registry.register("calculator", module.calculator)
    return registry

if __name__ == "__main__":
    unittest.main()
