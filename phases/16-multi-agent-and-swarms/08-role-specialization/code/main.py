"""Role specialization: planner, executor, critic, verifier。

小さな Python function を build する。critic (LLM-simulated) と verifier (code) が
一緒に、どちらか片方では見逃す bugs を捕まえる。

2 回実行する。1 回は correct executor output、もう 1 回は off-spec output。
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Spec:
    task_name: str
    signature: str
    description: str
    tests: list[tuple[tuple, int]]


@dataclass
class Artifact:
    code: str


@dataclass
class CriticReport:
    approved: bool
    notes: list[str] = field(default_factory=list)


@dataclass
class VerifierReport:
    passed: bool
    failures: list[str] = field(default_factory=list)


def planner(user_wish: str) -> Spec:
    """high-level wish から structured spec を生成する。"""
    return Spec(
        task_name="add_two",
        signature="add_two(a: int, b: int) -> int",
        description=user_wish,
        tests=[((1, 2), 3), ((10, 20), 30), ((-5, 5), 0)],
    )


def executor_correct(spec: Spec) -> Artifact:
    return Artifact(code="def add_two(a, b):\n    return a + b\n")


def executor_buggy(spec: Spec) -> Artifact:
    return Artifact(code="def add_two(a, b):\n    return a * b\n")


def critic(spec: Spec, art: Artifact) -> CriticReport:
    """LLM-style review。common issues を pattern-match するが、
    semantically wrong でも plausible-looking code には騙されることがある。"""
    notes: list[str] = []
    if "def" not in art.code:
        notes.append("def statement がない")
    if "return" not in art.code:
        notes.append("return がない")
    if spec.task_name not in art.code:
        notes.append(f"function name が spec '{spec.task_name}' と一致しない")
    approved = not notes
    return CriticReport(approved=approved, notes=notes)


def verifier(spec: Spec, art: Artifact) -> VerifierReport:
    """code を sandbox namespace で実行し tests を走らせる。deterministic。"""
    ns: dict = {}
    try:
        exec(art.code, ns, ns)
    except Exception as e:
        return VerifierReport(passed=False, failures=[f"exec error: {e}"])
    fn = ns.get(spec.task_name)
    if not callable(fn):
        return VerifierReport(passed=False, failures=[f"callable '{spec.task_name}' が生成されていない"])
    failures: list[str] = []
    for args, expected in spec.tests:
        try:
            got = fn(*args)
        except Exception as e:
            failures.append(f"call {args} raised {e}")
            continue
        if got != expected:
            failures.append(f"call {args}: expected {expected}, got {got}")
    return VerifierReport(passed=not failures, failures=failures)


def run_pipeline(user_wish: str, executor, label: str) -> None:
    print(f"\n=== {label} ===")
    spec = planner(user_wish)
    print(f"  [planner] spec: {spec.signature} with {len(spec.tests)} tests")
    art = executor(spec)
    print(f"  [executor] produced:\n    {art.code.replace(chr(10), chr(10)+'    ')}")
    crep = critic(spec, art)
    print(f"  [critic] approved={crep.approved}, notes={crep.notes}")
    vrep = verifier(spec, art)
    print(f"  [verifier] passed={vrep.passed}, failures={vrep.failures}")
    if crep.approved and vrep.passed:
        print("  RESULT: ship してよい。")
    elif not vrep.passed:
        print("  RESULT: verifier が ship を止めました (deterministic catch)。")
    elif not crep.approved:
        print("  RESULT: critic が ship を止めました (subjective catch)。")


def main() -> None:
    print("Role specialization pipeline - planner, executor, critic, verifier")
    print("-" * 70)

    run_pipeline(
        "2 つの integers の sum を返す function。",
        executor_correct,
        "Correct executor output",
    )

    run_pipeline(
        "2 つの integers の sum を返す function。",
        executor_buggy,
        "Buggy executor output (plausible に見えるが runtime で失敗)",
    )

    print("\nKey insight: critic は buggy code がまともに見えるため pass します。")
    print("verifier、つまり deterministic test execution だけが semantic bug を捕まえます。")
    print("All-LLM pipelines (verifier なし) は bug を ship します。classic MAST failure mode です。")


if __name__ == "__main__":
    main()
