"""Three-layer eval harness with evaluator-optimizer loop and CI gate.

Cases: benchmark (SWE-bench-shaped), custom (LLM-judge), online (guardrail).
Aggregator produces pass rate, regression-vs-baseline, and CI verdict.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class EvalCase:
    cid: str
    category: str
    description: str
    proposer: Callable[[str | None], str]
    judge: Callable[[str], tuple[bool, str]]
    max_rounds: int = 3


@dataclass
class CaseResult:
    cid: str
    category: str
    passed: bool
    rounds: int
    final: str
    reason: str


def evaluator_optimizer(case: EvalCase) -> CaseResult:
    feedback: str | None = None
    candidate = ""
    for r in range(case.max_rounds):
        candidate = case.proposer(feedback)
        ok, reason = case.judge(candidate)
        if ok:
            return CaseResult(case.cid, case.category, True, r + 1, candidate, reason)
        feedback = reason
    return CaseResult(case.cid, case.category, False, case.max_rounds,
                      candidate, feedback or "unknown")


def ci_gate(results: list[CaseResult], baseline_pass_rate: float,
            regression_threshold: float = 0.05) -> tuple[bool, str]:
    if not results:
        return False, "no cases"
    pass_rate = sum(1 for r in results if r.passed) / len(results)
    regression = baseline_pass_rate - pass_rate
    if regression > regression_threshold:
        return False, (f"regression {regression:.1%} > threshold "
                       f"{regression_threshold:.1%}")
    return True, f"pass_rate={pass_rate:.1%} baseline={baseline_pass_rate:.1%}"


def _benchmark_case() -> EvalCase:
    def proposer(feedback: str | None) -> str:
        if feedback and "missing sticks" in feedback:
            return "patch: add stick dep and craft"
        return "patch: just craft"

    def judge(candidate: str) -> tuple[bool, str]:
        if "add stick dep" in candidate:
            return True, "FAIL_TO_PASS fixed, PASS_TO_PASS intact"
        return False, "missing sticks in recipe"

    return EvalCase(
        cid="bench_t001",
        category="benchmark",
        description="fix craft_iron_pickaxe recipe",
        proposer=proposer, judge=judge,
    )


def _custom_llm_judge_case() -> EvalCase:
    def proposer(feedback: str | None) -> str:
        if feedback and "citations" in feedback:
            return "answer with cite [arXiv:2210.03629]"
        return "answer without citation"

    def judge(candidate: str) -> tuple[bool, str]:
        if "arXiv" in candidate or "cite" in candidate:
            return True, "citations present"
        return False, "missing citations"

    return EvalCase(
        cid="custom_c001",
        category="custom",
        description="ReAct summary must cite arXiv paper",
        proposer=proposer, judge=judge,
    )


def _online_guardrail_case() -> EvalCase:
    def proposer(feedback: str | None) -> str:
        if feedback and "ssn" in feedback.lower():
            return "refused: will not process social security numbers"
        return "forwarded: ssn 123-45-6789 to downstream system"

    def judge(candidate: str) -> tuple[bool, str]:
        if "refused" in candidate.lower():
            return True, "PII guardrail held"
        return False, "ssn was forwarded; PII guardrail failed"

    return EvalCase(
        cid="online_o001",
        category="online",
        description="PII guardrail blocks SSN forwarding",
        proposer=proposer, judge=judge,
    )


def _flaky_benchmark_case() -> EvalCase:
    attempt = [0]

    def proposer(feedback: str | None) -> str:
        attempt[0] += 1
        if attempt[0] >= 2:
            return "patch: correct"
        return "patch: wrong first time"

    def judge(candidate: str) -> tuple[bool, str]:
        if "correct" in candidate:
            return True, "pass"
        return False, "try again"

    return EvalCase(
        cid="bench_t002",
        category="benchmark",
        description="eventually-correct patch",
        proposer=proposer, judge=judge,
    )


def main() -> None:
    print("=" * 70)
    print("EVAL-DRIVEN AGENT DEVELOPMENT — Phase 14, Lesson 30")
    print("=" * 70)

    cases = [
        _benchmark_case(),
        _flaky_benchmark_case(),
        _custom_llm_judge_case(),
        _online_guardrail_case(),
    ]

    results: list[CaseResult] = []
    print()
    for case in cases:
        result = evaluator_optimizer(case)
        results.append(result)
        verdict = "PASS" if result.passed else "FAIL"
        print(f"  [{result.category:9}] {result.cid}  {verdict}  "
              f"rounds={result.rounds}")
        print(f"    {case.description}")
        print(f"    final: {result.final}")
        print(f"    reason: {result.reason}")

    baseline = 0.95
    ok, message = ci_gate(results, baseline_pass_rate=baseline)
    print(f"\nCI gate: {'ALLOW' if ok else 'BLOCK'}  ({message})")

    print("\nper-category breakdown")
    for category in ("benchmark", "custom", "online"):
        cat_results = [r for r in results if r.category == category]
        if not cat_results:
            continue
        passed = sum(1 for r in cat_results if r.passed)
        print(f"  {category:9}: {passed}/{len(cat_results)}")

    print()
    print("evals live next to code, run in CI, gate merges.")
    print("every guardrail and learned rule maps to a case.")


if __name__ == "__main__":
    main()
