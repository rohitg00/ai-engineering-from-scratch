"""All five Anthropic workflow patterns in stdlib.

prompt chaining, routing, parallelization (voting), orchestrator-workers,
evaluator-optimizer. Each pattern is 10-15 lines; the point is to show how
small they are compared to a framework.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Any, Callable


class ScriptedLLM:
    def __init__(self, script: dict[str, str | list[str]]) -> None:
        self.script = script
        self.index: dict[str, int] = {}
        self.calls: list[str] = []

    def __call__(self, prompt: str) -> str:
        self.calls.append(prompt)
        value = self.script.get(prompt)
        if isinstance(value, list):
            i = self.index.get(prompt, 0)
            self.index[prompt] = min(i + 1, len(value) - 1)
            return value[i]
        if isinstance(value, str):
            return value
        return f"[unhandled: {prompt}]"


def prompt_chain(input_text: str, llm: Callable[[str], str],
                 steps: list[tuple[str, str]]) -> list[tuple[str, str]]:
    current = input_text
    trace: list[tuple[str, str]] = []
    for label, template in steps:
        prompt = template.format(text=current)
        output = llm(prompt)
        trace.append((label, output))
        current = output
    return trace


def route(input_text: str, classifier: Callable[[str], str],
          handlers: dict[str, Callable[[str], str]]) -> tuple[str, str]:
    label = classifier(input_text)
    handler = handlers.get(label) or handlers.get("default")
    if handler is None:
        return label, f"no handler for {label}"
    return label, handler(input_text)


def parallel_vote(prompt: str, llm: Callable[[str], str], n: int = 5) -> tuple[str, Counter]:
    votes = [llm(prompt) for _ in range(n)]
    counts = Counter(votes)
    winner, _ = counts.most_common(1)[0]
    return winner, counts


@dataclass
class Worker:
    name: str
    handles: Callable[[str], bool]
    fn: Callable[[str], str]


def orchestrator_workers(task: str, workers: list[Worker],
                         synth: Callable[[list[tuple[str, str]]], str]) -> tuple[str, list[tuple[str, str]]]:
    outputs: list[tuple[str, str]] = []
    for worker in workers:
        if worker.handles(task):
            outputs.append((worker.name, worker.fn(task)))
    return synth(outputs), outputs


def evaluator_optimizer(task: str, proposer: Callable[[str, str | None], str],
                        evaluator: Callable[[str, str], tuple[bool, str]],
                        max_iter: int = 5) -> tuple[str, list[tuple[str, str, str]]]:
    trace: list[tuple[str, str, str]] = []
    feedback: str | None = None
    for i in range(max_iter):
        candidate = proposer(task, feedback)
        ok, judge = evaluator(task, candidate)
        trace.append((candidate, "PASS" if ok else "FAIL", judge))
        if ok:
            return candidate, trace
        feedback = judge
    return candidate, trace


def demo_chain(llm: ScriptedLLM) -> None:
    print("-" * 70)
    print("1. PROMPT CHAINING — summarize then title")
    print("-" * 70)
    trace = prompt_chain(
        input_text="Agents are ReAct loops with tools, memory, and guardrails.",
        llm=llm,
        steps=[
            ("summarize", "summarize: {text}"),
            ("title", "give a 6-word title: {text}"),
        ],
    )
    for label, output in trace:
        print(f"  [{label}] {output}")


def demo_route(llm: ScriptedLLM) -> None:
    print("\n" + "-" * 70)
    print("2. ROUTING — classify then dispatch")
    print("-" * 70)

    def classifier(text: str) -> str:
        return llm(f"classify: {text}")

    handlers = {
        "refund": lambda t: llm(f"handle refund: {t}"),
        "bug": lambda t: llm(f"handle bug: {t}"),
        "sales": lambda t: llm(f"handle sales: {t}"),
        "default": lambda t: "escalate to human",
    }

    for inp in ("I want my money back",
                "the CLI crashes on ctrl-c",
                "do you offer volume pricing"):
        label, out = route(inp, classifier, handlers)
        print(f"  [{label}] {out}")


def demo_parallel(llm: ScriptedLLM) -> None:
    print("\n" + "-" * 70)
    print("3. PARALLELIZATION — N voters on a boolean")
    print("-" * 70)
    winner, counts = parallel_vote("is this code safe to ship?", llm, n=5)
    print(f"  winner: {winner}")
    print(f"  counts: {dict(counts)}")


def demo_orchestrator(llm: ScriptedLLM) -> None:
    print("\n" + "-" * 70)
    print("4. ORCHESTRATOR-WORKERS — specialist pool")
    print("-" * 70)

    workers = [
        Worker("python_reviewer",
               handles=lambda t: "python" in t.lower(),
               fn=lambda t: llm(f"review python: {t}")),
        Worker("security_reviewer",
               handles=lambda t: True,
               fn=lambda t: llm(f"review security: {t}")),
        Worker("style_reviewer",
               handles=lambda t: "style" in t.lower(),
               fn=lambda t: llm(f"review style: {t}")),
    ]

    def synth(outputs: list[tuple[str, str]]) -> str:
        return " | ".join(f"{name}: {out}" for name, out in outputs)

    task = "review this python change for style and security"
    final, outputs = orchestrator_workers(task, workers, synth)
    for name, out in outputs:
        print(f"  [{name}] {out}")
    print(f"  synth: {final}")


def demo_evaluator_optimizer(llm: ScriptedLLM) -> None:
    print("\n" + "-" * 70)
    print("5. EVALUATOR-OPTIMIZER — propose, judge, refine")
    print("-" * 70)

    def proposer(task: str, feedback: str | None) -> str:
        prompt = f"propose: {task}"
        if feedback:
            prompt += f" (fix: {feedback})"
        return llm(prompt)

    def evaluator(task: str, candidate: str) -> tuple[bool, str]:
        verdict = llm(f"evaluate: {candidate}")
        ok = verdict.startswith("PASS")
        return ok, verdict

    final, trace = evaluator_optimizer(
        "write a one-line summary of ReAct", proposer, evaluator
    )
    for i, (cand, verdict, reason) in enumerate(trace, 1):
        print(f"  iter {i}  [{verdict}] {cand}  // {reason}")
    print(f"  final: {final}")


def main() -> None:
    print("=" * 70)
    print("ANTHROPIC WORKFLOW PATTERNS — Phase 14, Lesson 12")
    print("=" * 70)

    llm = ScriptedLLM({
        "summarize: Agents are ReAct loops with tools, memory, and guardrails.":
            "Agents: ReAct + tools + memory + guardrails.",
        "give a 6-word title: Agents: ReAct + tools + memory + guardrails.":
            "Agents as ReAct with Guardrails Built In",

        "classify: I want my money back": "refund",
        "classify: the CLI crashes on ctrl-c": "bug",
        "classify: do you offer volume pricing": "sales",
        "handle refund: I want my money back": "refund filed",
        "handle bug: the CLI crashes on ctrl-c": "bug logged",
        "handle sales: do you offer volume pricing": "quote sent",

        "is this code safe to ship?": ["yes", "yes", "no", "yes", "no"],

        "review python: review this python change for style and security":
            "python ok",
        "review security: review this python change for style and security":
            "security ok",
        "review style: review this python change for style and security":
            "style ok",

        "propose: write a one-line summary of ReAct":
            "ReAct loops thoughts and tool calls.",
        "evaluate: ReAct loops thoughts and tool calls.":
            "FAIL: missing observations",
        "propose: write a one-line summary of ReAct (fix: FAIL: missing observations)":
            "ReAct interleaves thought, action, and observation until done.",
        "evaluate: ReAct interleaves thought, action, and observation until done.":
            "PASS",
    })

    demo_chain(llm)
    demo_route(llm)
    demo_parallel(llm)
    demo_orchestrator(llm)
    demo_evaluator_optimizer(llm)

    print(f"\ntotal llm calls across all five patterns: {len(llm.calls)}")
    print("direct API + small helpers. no framework needed.")


if __name__ == "__main__":
    main()
