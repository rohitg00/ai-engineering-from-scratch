"""
agent harness の verification gate と observation budget。

See: phases/19-capstone-projects/25-verification-gates-observation-budget/docs/en.md
Concept refs:
  - Gate-chain pattern（最も安い deny を先に、allow は最後）。
  - deterministic stopping criterion としての observation budget。
bottom の demo は synthetic な 3 turn loop を走らせ、exit zero する。
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from typing import Callable, Iterable, Protocol


# ---------------------------------------------------------------------------
# Wire shape
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ToolCall:
    """model から tool invocation への request。"""

    turn: int
    tool: str
    argv: tuple[str, ...]
    payload: str = ""

    def to_dict(self) -> dict:
        return {
            "turn": self.turn,
            "tool": self.tool,
            "argv": list(self.argv),
            "payload": self.payload,
        }


@dataclass(frozen=True)
class Observation:
    """tool call 後に model に見せる text。"""

    turn: int
    tool: str
    text: str
    tokens: int

    def to_dict(self) -> dict:
        return {
            "turn": self.turn,
            "tool": self.tool,
            "tokens": self.tokens,
        }


@dataclass(frozen=True)
class GateDecision:
    """単一 gate の verdict。"""

    allow: bool
    gate: str
    reason: str

    def to_dict(self) -> dict:
        return {"allow": self.allow, "gate": self.gate, "reason": self.reason}


# ---------------------------------------------------------------------------
# Token estimator
# ---------------------------------------------------------------------------


def estimate_tokens(text: str) -> int:
    """real tokenizer の deterministic かつ conservative な stand-in。

    real harness では tiktoken または model 自身の tokenizer を差し込む。
    gate chain が必要とするのは、counter が monotonic かつ deterministic であることだけ。
    """

    if not text:
        return 0
    return max(1, len(text) // 4)


# ---------------------------------------------------------------------------
# Observation ledger
# ---------------------------------------------------------------------------


@dataclass
class ObservationLedger:
    """model に見せた全 observation の append-only ledger。"""

    rows: list[Observation] = field(default_factory=list)

    def record(self, obs: Observation) -> None:
        self.rows.append(obs)

    def cumulative(self) -> int:
        return sum(row.tokens for row in self.rows)

    def per_tool(self, name: str) -> int:
        return sum(row.tokens for row in self.rows if row.tool == name)

    def turns_seen(self) -> list[int]:
        return sorted({row.turn for row in self.rows})

    def latest_turn(self) -> int:
        return self.rows[-1].turn if self.rows else -1

    def snapshot(self) -> list[dict]:
        return [row.to_dict() for row in self.rows]


# ---------------------------------------------------------------------------
# Gate protocol
# ---------------------------------------------------------------------------


@dataclass
class GateContext:
    """各 gate に渡す read-only context。"""

    ledger: ObservationLedger
    current_turn: int
    history: tuple[ToolCall, ...] = ()


class VerificationGate(Protocol):
    name: str

    def evaluate(self, call: ToolCall, ctx: GateContext) -> GateDecision: ...


# ---------------------------------------------------------------------------
# 具体的な gates
# ---------------------------------------------------------------------------


@dataclass
class WhitelistGate:
    """明示的な allow-set にない tool を拒否する。最も安い gate。"""

    allowed: frozenset[str]
    name: str = "whitelist"

    def evaluate(self, call: ToolCall, ctx: GateContext) -> GateDecision:
        if call.tool in self.allowed:
            return GateDecision(True, self.name, "tool は allow-set 内です")
        return GateDecision(
            False,
            self.name,
            f"tool {call.tool!r} は allow-set {sorted(self.allowed)} にありません",
        )


@dataclass
class RegexGate:
    """argv を結合した string が refuse pattern に match する call を拒否する。"""

    refuse_patterns: tuple[re.Pattern[str], ...]
    name: str = "regex"

    @classmethod
    def from_strings(cls, patterns: Iterable[str], name: str = "regex") -> "RegexGate":
        compiled = tuple(re.compile(p) for p in patterns)
        return cls(refuse_patterns=compiled, name=name)

    def evaluate(self, call: ToolCall, ctx: GateContext) -> GateDecision:
        haystack = " ".join(call.argv) + " " + call.payload
        for pat in self.refuse_patterns:
            if pat.search(haystack):
                return GateDecision(
                    False, self.name, f"argv が refuse pattern {pat.pattern!r} に match しました"
                )
        return GateDecision(True, self.name, "refuse pattern に match しませんでした")


@dataclass
class RecencyGate:
    """last observation が window turn より古い場合に call を拒否する。

    意図は stale state に頼る代わりに fresh read を強制すること。
    session の最初の call は常に pass する。
    """

    window: int
    name: str = "recency"

    def evaluate(self, call: ToolCall, ctx: GateContext) -> GateDecision:
        last = ctx.ledger.latest_turn()
        if last < 0:
            return GateDecision(True, self.name, "prior observation はありません")
        gap = call.turn - last
        if gap > self.window:
            return GateDecision(
                False,
                self.name,
                f"observation gap {gap} turn が window {self.window} を超えています",
            )
        return GateDecision(True, self.name, f"gap {gap} は window {self.window} 内です")


@dataclass
class BudgetGate:
    """cumulative observation budget が尽きたら call を拒否する。

    single call は result が何 token になるかを事前には知れない。
    そのため gate は call 前の ledger state に対して評価し、harness は observation
    記録後の新しい ledger state に対して cumulative check を再実行する。
    """

    max_tokens: int
    name: str = "budget"

    def evaluate(self, call: ToolCall, ctx: GateContext) -> GateDecision:
        used = ctx.ledger.cumulative()
        if used >= self.max_tokens:
            return GateDecision(
                False,
                self.name,
                f"observation budget を使い切りました: {used}/{self.max_tokens} tokens",
            )
        remaining = self.max_tokens - used
        return GateDecision(
            True, self.name, f"budget は残り {remaining} tokens です"
        )


@dataclass
class PerToolBudgetGate:
    """optional gate: 単一 tool が割当以上を消費していたら拒否する。"""

    limits: dict[str, int]
    name: str = "per-tool-budget"

    def evaluate(self, call: ToolCall, ctx: GateContext) -> GateDecision:
        limit = self.limits.get(call.tool)
        if limit is None:
            return GateDecision(True, self.name, "tool に per-tool budget はありません")
        used = ctx.ledger.per_tool(call.tool)
        if used >= limit:
            return GateDecision(
                False,
                self.name,
                f"{call.tool} の per-tool budget を使い切りました: {used}/{limit}",
            )
        return GateDecision(
            True, self.name, f"per-tool {call.tool}: 残り {limit - used} tokens"
        )


# ---------------------------------------------------------------------------
# Gate chain
# ---------------------------------------------------------------------------


@dataclass
class ChainOutcome:
    """chain evaluation の full result: per-gate decision と final verdict。"""

    decisions: list[GateDecision]

    @property
    def allow(self) -> bool:
        return all(d.allow for d in self.decisions)

    @property
    def deny_reason(self) -> str | None:
        for d in self.decisions:
            if not d.allow:
                return f"[{d.gate}] {d.reason}"
        return None

    def to_dict(self) -> dict:
        return {
            "allow": self.allow,
            "deny_reason": self.deny_reason,
            "decisions": [d.to_dict() for d in self.decisions],
        }


@dataclass
class GateChain:
    """最初の deny で short-circuit する ordered gate list。"""

    gates: tuple[VerificationGate, ...]

    def evaluate(self, call: ToolCall, ctx: GateContext) -> ChainOutcome:
        decisions: list[GateDecision] = []
        for gate in self.gates:
            decision = gate.evaluate(call, ctx)
            decisions.append(decision)
            if not decision.allow:
                return ChainOutcome(decisions=decisions)
        return ChainOutcome(decisions=decisions)


# ---------------------------------------------------------------------------
# demo 用の mini synthetic agent loop
# ---------------------------------------------------------------------------


ToolFn = Callable[[ToolCall], str]


@dataclass
class LoopReport:
    """synthetic loop run の audit record。"""

    turns: int
    allowed: int
    refused: int
    observations: list[Observation]
    decisions: list[ChainOutcome]

    def to_dict(self) -> dict:
        return {
            "turns": self.turns,
            "allowed": self.allowed,
            "refused": self.refused,
            "observations": [o.to_dict() for o in self.observations],
            "decisions": [d.to_dict() for d in self.decisions],
        }


def run_synthetic_loop(
    calls: list[ToolCall],
    chain: GateChain,
    tool_fns: dict[str, ToolFn],
) -> LoopReport:
    """固定された tool call sequence を chain に通す。

    これは harness skeleton の縮小版。real harness は次の tool call を model に
    問い合わせるが、gate-chain contract は同じ。
    """

    ledger = ObservationLedger()
    decisions: list[ChainOutcome] = []
    observations: list[Observation] = []
    allowed = 0
    refused = 0

    history: list[ToolCall] = []

    for call in calls:
        ctx = GateContext(
            ledger=ledger, current_turn=call.turn, history=tuple(history)
        )
        outcome = chain.evaluate(call, ctx)
        decisions.append(outcome)
        history.append(call)
        if not outcome.allow:
            refused += 1
            continue
        fn = tool_fns.get(call.tool)
        if fn is None:
            refused += 1
            continue
        result = fn(call)
        obs = Observation(
            turn=call.turn,
            tool=call.tool,
            text=result,
            tokens=estimate_tokens(result),
        )
        ledger.record(obs)
        observations.append(obs)
        allowed += 1

    return LoopReport(
        turns=len(calls),
        allowed=allowed,
        refused=refused,
        observations=observations,
        decisions=decisions,
    )


# ---------------------------------------------------------------------------
# Demo wiring
# ---------------------------------------------------------------------------


def _demo_tools() -> dict[str, ToolFn]:
    """3 つの synthetic tool。read_file は verbose、list_dir は小さく、run_tests は structured。"""

    def read_file(call: ToolCall) -> str:
        target = call.argv[0] if call.argv else "<missing>"
        return (
            f"# {target} の fake contents\n"
            + ("60 bytes 程度の fake source code の行 " * 12)
        )

    def list_dir(call: ToolCall) -> str:
        return "main.py\nREADME.md\ntests/test_main.py\n"

    def run_tests(call: ToolCall) -> str:
        return json.dumps(
            {"status": "passed", "tests": 4, "duration_ms": 42}, indent=2
        )

    return {"read_file": read_file, "list_dir": list_dir, "run_tests": run_tests}


def build_default_chain(budget: int = 200) -> GateChain:
    """en.md に記載された順序で canonical な 4-gate chain を wire する。"""

    return GateChain(
        gates=(
            WhitelistGate(
                allowed=frozenset({"read_file", "list_dir", "run_tests"})
            ),
            RegexGate.from_strings(
                patterns=(
                    r"\brm\s+-rf\b",
                    r"\bsudo\b",
                    r"^/etc/",
                )
            ),
            RecencyGate(window=3),
            BudgetGate(max_tokens=budget),
        )
    )


def run_demo() -> int:
    """self-terminating demo。JSON trace を print し、exit zero する。"""

    chain = build_default_chain(budget=200)
    tools = _demo_tools()

    calls = [
        ToolCall(turn=1, tool="list_dir", argv=("./",)),
        ToolCall(turn=2, tool="read_file", argv=("main.py",)),
        ToolCall(turn=3, tool="read_file", argv=("README.md",)),
        ToolCall(turn=4, tool="run_tests", argv=("./",)),
        ToolCall(turn=5, tool="shell", argv=("rm", "-rf", "/")),
    ]

    report = run_synthetic_loop(calls, chain, tools)

    print("VERIFICATION GATE デモ")
    print(f"turns={report.turns} allowed={report.allowed} refused={report.refused}")
    print("")
    for idx, (call, outcome) in enumerate(zip(calls, report.decisions)):
        verdict = "ALLOW" if outcome.allow else "DENY"
        print(f"  [{idx}] turn={call.turn} tool={call.tool} -> {verdict}")
        if not outcome.allow:
            print(f"        理由: {outcome.deny_reason}")
    print("")
    print(f"観測済み cumulative tokens: {sum(o.tokens for o in report.observations)}")
    print(f"記録した observations: {len(report.observations)}")

    if report.refused < 1:
        print("ERROR: demo は少なくとも 1 つの refusal を期待しています", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(run_demo())
