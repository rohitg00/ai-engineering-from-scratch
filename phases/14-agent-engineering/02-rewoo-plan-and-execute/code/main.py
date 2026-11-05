"""Toy ReWOO — Planner, Workers, Solver. Stdlib only.

Demonstrates the decoupled pattern from Xu et al. (arXiv:2305.18323):
  1. Planner emits a DAG of (tool, args) steps with references (#E1, #E2, ...).
  2. Workers run the DAG level by level; steps in one level run concurrently
     (asyncio), so wall time follows the number of levels, not nodes.
  3. Solver composes the final answer from question + plan + evidence.
  4. Optional replan loop (max_replans > 0): if a worker errors, the planner
     sees the evidence and returns a new plan. That is Plan-and-Execute.

Compare run_rewoo() vs run_react() at the bottom for token-use intuition.
"""

from __future__ import annotations

import asyncio
import re
import time
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class PlanStep:
    id: str
    tool: str
    args: dict[str, Any]


@dataclass
class Plan:
    steps: list[PlanStep]


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Callable[..., str]] = {}

    def register(self, name: str, fn: Callable[..., str]) -> None:
        self._tools[name] = fn

    def dispatch(self, name: str, args: dict[str, Any]) -> str:
        fn = self._tools.get(name)
        if fn is None:
            return f"error: unknown tool {name!r}"
        try:
            return fn(**args)
        except Exception as e:
            return f"error: {type(e).__name__}: {e}"


REFERENCE_RE = re.compile(r"#E(\d+)")


def resolve_references(value: Any, evidence: dict[str, str]) -> Any:
    if not isinstance(value, str):
        return value
    return REFERENCE_RE.sub(lambda m: evidence.get(f"E{m.group(1)}", m.group(0)),
                            value)


def topological(plan: Plan) -> list[list[PlanStep]]:
    resolved: list[list[PlanStep]] = []
    known: set[str] = set()
    pending = list(plan.steps)
    while pending:
        progress = False
        rest: list[PlanStep] = []
        batch: list[PlanStep] = []
        for step in pending:
            refs = REFERENCE_RE.findall(str(step.args))
            if all(f"E{r}" in known for r in refs):
                batch.append(step)
                progress = True
            else:
                rest.append(step)
        if not progress:
            raise RuntimeError("cyclic plan or unresolved reference")
        pending = rest
        for step in batch:
            known.add(step.id)
        resolved.append(batch)
    return resolved


async def run_step(step: PlanStep, evidence: dict[str, str],
                   tools: ToolRegistry) -> tuple[str, str]:
    """Run one step in a worker thread; return (id, result) so the result
    stays attached to its step no matter which step finishes first."""
    bound_args = {k: resolve_references(v, evidence) for k, v in step.args.items()}
    result = await asyncio.to_thread(tools.dispatch, step.tool, bound_args)
    return step.id, result


async def run_workers(plan: Plan, tools: ToolRegistry) -> dict[str, str]:
    """Batches run in order; steps inside a batch run concurrently.

    Evidence is only updated after a batch finishes, so every step in a
    batch binds its #E references against earlier batches only.
    """
    evidence: dict[str, str] = {}
    for batch in topological(plan):
        results = await asyncio.gather(*(run_step(s, evidence, tools) for s in batch))
        evidence.update(results)
    return evidence


class ScriptedPlanner:
    def __init__(self, plan: Plan, fixed_plan: Plan | None = None) -> None:
        self.plan = plan
        self.fixed_plan = fixed_plan

    def plan_for(self, question: str) -> Plan:
        return self.plan

    def replan(self, question: str, plan: Plan, evidence: dict[str, str]) -> Plan:
        # Scripted stand-in: a real planner would read the errors in `evidence`
        # and write a corrected plan. With no fix scripted, keep the old plan.
        return self.fixed_plan or plan


class ScriptedSolver:
    def __init__(self, answer_template: str) -> None:
        self.template = answer_template

    def solve(self, question: str, plan: Plan, evidence: dict[str, str]) -> str:
        return self.template.format(**evidence)


def fake_search(query: str) -> str:
    if "capital of france" in query.lower():
        return "Paris"
    if "population of paris" in query.lower():
        return "11.2 million metro"
    if "capital of germany" in query.lower():
        return "Berlin"
    return f"no result for {query!r}"


def rounded_million(text: str) -> str:
    m = re.search(r"([0-9]+\.?[0-9]*)", text)
    if not m:
        return "unknown"
    return f"{round(float(m.group(1)))} million"


@dataclass
class ReWOORun:
    question: str
    plan: Plan
    evidence: dict[str, str] = field(default_factory=dict)
    answer: str = ""
    planner_chars: int = 0
    worker_chars: int = 0
    solver_chars: int = 0


def run_workers_with_replan(question: str, plan: Plan, planner: ScriptedPlanner,
                            tools: ToolRegistry,
                            max_replans: int = 0) -> tuple[Plan, dict[str, str]]:
    """Plan-and-Execute: run the plan; if any worker errored, ask the planner
    for a new plan (now that it has seen the evidence) and run that.

    Replans only while another attempt remains, so the returned plan is always
    the one that produced the returned evidence. max_replans=0 is plain ReWOO.
    """
    for attempt in range(max_replans + 1):
        evidence = asyncio.run(run_workers(plan, tools))
        if not any(v.startswith("error:") for v in evidence.values()):
            break
        if attempt < max_replans:
            plan = planner.replan(question, plan, evidence)
    return plan, evidence


def run_rewoo(question: str, planner: ScriptedPlanner,
              tools: ToolRegistry, solver: ScriptedSolver,
              max_replans: int = 0) -> ReWOORun:
    plan = planner.plan_for(question)
    plan, evidence = run_workers_with_replan(question, plan, planner, tools,
                                             max_replans)
    planner_chars = len(question) + sum(len(s.tool) + len(str(s.args))
                                        for s in plan.steps)
    worker_chars = sum(len(str(s.args)) + len(v) for s, v in zip(plan.steps,
                                                                 evidence.values()))
    answer = solver.solve(question, plan, evidence)
    solver_chars = len(question) + worker_chars + len(answer)
    return ReWOORun(question=question, plan=plan, evidence=evidence,
                    answer=answer,
                    planner_chars=planner_chars, worker_chars=worker_chars,
                    solver_chars=solver_chars)


def run_react_mock(question: str, tools: ToolRegistry,
                   trajectory: list[tuple[str, dict[str, Any]]]) -> int:
    prompt_chars = len(question)
    total = 0
    history_chars = 0
    for name, args in trajectory:
        total += prompt_chars + history_chars + len(name) + len(str(args))
        obs = tools.dispatch(name, args)
        history_chars += len(name) + len(str(args)) + len(obs) + 40
    total += prompt_chars + history_chars
    return total


def slow_search(query: str) -> str:
    time.sleep(0.2)
    return f"result({query})"


def six_node_plan() -> Plan:
    """Two parallel groups: E1-E3 are independent, E4-E6 each use one of them."""
    return Plan(steps=[
        PlanStep("E1", "slow", {"query": "a"}),
        PlanStep("E2", "slow", {"query": "b"}),
        PlanStep("E3", "slow", {"query": "c"}),
        PlanStep("E4", "slow", {"query": "uses #E1"}),
        PlanStep("E5", "slow", {"query": "uses #E2"}),
        PlanStep("E6", "slow", {"query": "uses #E3"})
    ])


def broken_plan() -> Plan:
    """six_node_plan, except E1 names a tool that is not registered, so the
    first run produces `error: unknown tool` and triggers a replan."""
    return Plan(steps=[
        PlanStep("E1", "web_search", {"query": "a"}),
        PlanStep("E2", "slow", {"query": "b"}),
        PlanStep("E3", "slow", {"query": "c"}),
        PlanStep("E4", "slow", {"query": "uses #E1"}),
        PlanStep("E5", "slow", {"query": "uses #E2"}),
        PlanStep("E6", "slow", {"query": "uses #E3"})
    ])


def run_workers_sequential(plan: Plan, tools: ToolRegistry) -> dict[str, str]:
    evidence: dict[str, str] = {}
    for batch in topological(plan):
        for step in batch:
            bound = {k: resolve_references(v, evidence) for k, v in step.args.items()}
            evidence[step.id] = tools.dispatch(step.tool, bound)
    return evidence


def parallel_demo() -> None:
    tools = ToolRegistry()
    tools.register("slow", slow_search)
    plan = six_node_plan()

    t0 = time.perf_counter()
    seq = run_workers_sequential(plan, tools)
    seq_s = time.perf_counter() - t0

    t0 = time.perf_counter()
    par = asyncio.run(run_workers(plan, tools))
    par_s = time.perf_counter() - t0

    print("\nPARALLEL WORKERS (6-node DAG, 2 groups, 0.2s per tool call)")
    print(f"  batches    : {[[s.id for s in b] for b in topological(plan)]}")
    print(f"  sequential : {seq_s:.2f}s")
    print(f"  parallel   : {par_s:.2f}s  ({seq_s / par_s:.1f}x faster)")
    print(f"  same evidence: {seq == par}")


def replan_demo() -> None:
    tools = ToolRegistry()
    tools.register("slow", slow_search)
    planner = ScriptedPlanner(broken_plan(), fixed_plan=six_node_plan())
    solver = ScriptedSolver("E1={E1} | E4={E4}")

    first = asyncio.run(run_workers(planner.plan_for("demo"), tools))
    print("\nREPLAN (Plan-and-Execute: planner sees the errors)")
    print(f"  attempt 1 E1 : {first['E1']}")

    run = run_rewoo("demo", planner, tools, solver, max_replans=2)
    print(f"  attempt 2 E1 : {run.evidence['E1']}")
    print(f"  final        : {run.answer}")


def main() -> None:
    print("=" * 70)
    print("REWOO — Planner, Workers, Solver (Phase 14, Lesson 02)")
    print("=" * 70)

    tools = ToolRegistry()
    tools.register("search", fake_search)
    tools.register("round_million", rounded_million)

    plan = Plan(steps=[
        PlanStep("E1", "search", {"query": "capital of France"}),
        PlanStep("E2", "search", {"query": "population of #E1"}),
        PlanStep("E3", "round_million", {"text": "#E2"}),
    ])
    planner = ScriptedPlanner(plan)
    solver = ScriptedSolver(
        "The capital of France is {E1}; rounded population is {E3}."
    )
    run = run_rewoo("What is the population of the capital of France, rounded?",
                    planner, tools, solver)

    print("\nPLAN")
    for step in run.plan.steps:
        print(f"  {step.id}: {step.tool}({step.args})")
    print("\nEVIDENCE")
    for k, v in run.evidence.items():
        print(f"  {k} -> {v}")
    print(f"\nFINAL: {run.answer}")

    react_chars = run_react_mock(
        run.question, tools,
        [("search", {"query": "capital of France"}),
         ("search", {"query": "population of Paris"}),
         ("round_million", {"text": "11.2 million metro"})])
    rewoo_chars = run.planner_chars + run.worker_chars + run.solver_chars
    print("\nTOKEN INTUITION (chars, approximate)")
    print(f"  react total  : {react_chars}")
    print(f"  rewoo total  : {rewoo_chars}")
    print(f"  ratio        : {react_chars / max(rewoo_chars, 1):.2f}x")
    print("\npaper claim: ~5x fewer tokens on HotpotQA. toy approximates the shape.")

    parallel_demo()
    replan_demo()


if __name__ == "__main__":
    main()
