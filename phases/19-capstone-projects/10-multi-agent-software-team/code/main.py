"""Multi-agent software team — typed task board + handoff accounting scaffold.

The hard architectural primitive is the typed message task board that
coordinates an architect, N parallel coders, a reviewer, and a tester, with
every role boundary producing a trace span. This scaffold runs the full
message flow with stubbed LLM calls so the handoff logic and token accounting
are observable end to end.

Run:  python main.py
"""

from __future__ import annotations

import random
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum


# ---------------------------------------------------------------------------
# typed message task board  --  A2A-style typed messages
# ---------------------------------------------------------------------------

class MsgKind(Enum):
    PLAN_REQUEST = "plan_request"
    SUBTASK = "subtask"
    DIFF_READY = "diff_ready"
    REVIEW_NEEDED = "review_needed"
    REVIEW_FEEDBACK = "review_feedback"
    APPROVED = "approved"
    TEST_NEEDED = "test_needed"
    TEST_PASSED = "test_passed"
    TEST_FAILED = "test_failed"


@dataclass
class Msg:
    kind: MsgKind
    by: str
    to: str
    payload: dict = field(default_factory=dict)
    tokens: int = 0


@dataclass
class Board:
    messages: list[Msg] = field(default_factory=list)
    tokens_by_role: dict[str, int] = field(default_factory=lambda: defaultdict(int))

    def post(self, m: Msg) -> None:
        self.messages.append(m)
        self.tokens_by_role[m.by] += m.tokens

    def inbox(self, role: str) -> list[Msg]:
        return [m for m in self.messages if m.to == role]


# ---------------------------------------------------------------------------
# role stubs  --  architect, coders, reviewer, tester
# ---------------------------------------------------------------------------

@dataclass
class Subtask:
    name: str
    files: list[str]
    lines_changed: int = 0
    has_bug: bool = False  # for injected-bug probe


def architect_plan(issue: str, rng: random.Random) -> list[Subtask]:
    """Stubbed architect plan."""
    subs = [
        Subtask("parser", ["src/parser.py"]),
        Subtask("cache", ["src/cache.py", "src/cache_test.py"]),
        Subtask("api", ["src/api.py"]),
        Subtask("migration", ["src/migrate.py"]),
    ]
    # randomly inject one bug for reviewer probe
    subs[rng.randrange(len(subs))].has_bug = rng.random() < 0.3
    return subs


def coder_implement(sub: Subtask, rng: random.Random) -> dict:
    sub.lines_changed = rng.randint(15, 95)
    return {"subtask": sub.name, "lines": sub.lines_changed,
            "has_bug": sub.has_bug}


def reviewer_check(diffs: list[dict], rng: random.Random) -> tuple[bool, str]:
    """Reviewer stub. Catches bugs ~85% of the time; 15% false-approve rate."""
    buggy = [d for d in diffs if d["has_bug"]]
    if not buggy:
        return True, "lgtm"
    if rng.random() < 0.85:
        return False, f"found bug in {buggy[0]['subtask']}: please revisit"
    return True, "lgtm (FALSE-APPROVE)"


def tester_run(diffs: list[dict], rng: random.Random) -> tuple[bool, str]:
    """Tester stub. Catches any remaining bugs, with ~3% flake rate."""
    buggy = [d for d in diffs if d["has_bug"]]
    if buggy:
        return False, f"test fails in {buggy[0]['subtask']} module"
    if rng.random() < 0.03:
        return False, "flaky test"
    return True, "412/412 passing"


# ---------------------------------------------------------------------------
# orchestrator  --  runs the full flow, computes token amplification
# ---------------------------------------------------------------------------

def run_team(issue: str, n_coders: int = 4, rng: random.Random | None = None) -> dict:
    rng = rng or random.Random(0)
    board = Board()

    # architect
    plan = architect_plan(issue, rng)
    board.post(Msg(MsgKind.PLAN_REQUEST, by="architect", to="board",
                   payload={"issue": issue, "subtasks": [s.name for s in plan]},
                   tokens=4500))

    # dispatch subtasks to coders
    for i, sub in enumerate(plan[:n_coders]):
        coder = f"coder-{chr(65 + i)}"
        board.post(Msg(MsgKind.SUBTASK, by="architect", to=coder,
                       payload={"subtask": sub.name, "files": sub.files},
                       tokens=1200))

    # coders implement in parallel
    diffs: list[dict] = []
    for i, sub in enumerate(plan[:n_coders]):
        coder = f"coder-{chr(65 + i)}"
        result = coder_implement(sub, rng)
        diffs.append(result)
        board.post(Msg(MsgKind.DIFF_READY, by=coder, to="merge_coord",
                       payload=result, tokens=3200 + result["lines"] * 30))

    # merge (no conflict by construction in this scaffold)
    board.post(Msg(MsgKind.REVIEW_NEEDED, by="merge_coord", to="reviewer",
                   payload={"diffs": diffs}, tokens=2000))

    # reviewer
    approved, comment = reviewer_check(diffs, rng)
    if approved:
        board.post(Msg(MsgKind.APPROVED, by="reviewer", to="tester",
                       payload={"comment": comment}, tokens=1800))
    else:
        # route back to coder who owned the subtask (simplified: first coder)
        board.post(Msg(MsgKind.REVIEW_FEEDBACK, by="reviewer", to="coder-A",
                       payload={"comment": comment}, tokens=1800))
        # coder revises
        board.post(Msg(MsgKind.DIFF_READY, by="coder-A", to="merge_coord",
                       payload={"subtask": "parser", "lines": 52, "has_bug": False},
                       tokens=3100))
        # reviewer re-approves
        board.post(Msg(MsgKind.APPROVED, by="reviewer", to="tester",
                       payload={"comment": "now lgtm"}, tokens=1500))
        # update diffs: drop bug
        diffs = [{"subtask": d["subtask"], "lines": d["lines"], "has_bug": False}
                 for d in diffs]

    # tester
    passed, testmsg = tester_run(diffs, rng)
    if passed:
        board.post(Msg(MsgKind.TEST_PASSED, by="tester", to="pr_opener",
                       payload={"msg": testmsg}, tokens=1200))
    else:
        board.post(Msg(MsgKind.TEST_FAILED, by="tester", to="coder-A",
                       payload={"msg": testmsg}, tokens=1400))

    return {
        "approved": approved,
        "review_comment": comment,
        "tested_passed": passed,
        "test_msg": testmsg,
        "total_tokens": sum(board.tokens_by_role.values()),
        "tokens_by_role": dict(board.tokens_by_role),
        "handoffs": sum(1 for m in board.messages if m.to != m.by),
    }


# ---------------------------------------------------------------------------
# run several matched trials vs single-agent baseline
# ---------------------------------------------------------------------------

def single_agent_baseline(issue: str, rng: random.Random) -> dict:
    """Stub: one Sonnet 4.7 in a single worktree does the whole thing."""
    # slower but fewer handoffs; tokens roughly the whole budget minus role overhead
    return {
        "passed": rng.random() < 0.68,
        "total_tokens": 18_000 + rng.randint(0, 6_000),
    }


def main() -> None:
    rng = random.Random(11)
    print("=== multi-agent team run ===")
    result = run_team("fix widget parser race", n_coders=4, rng=rng)
    print(f"approved     : {result['approved']}  ({result['review_comment']})")
    print(f"tested passed: {result['tested_passed']}  ({result['test_msg']})")
    print(f"handoffs     : {result['handoffs']}")
    print(f"total tokens : {result['total_tokens']:,}")
    print("tokens by role:")
    for role, n in sorted(result['tokens_by_role'].items(), key=lambda x: -x[1]):
        print(f"  {role:14s} {n:>6,}")

    print("\n=== 10 matched trials vs single-agent baseline ===")
    team_pass = 0
    baseline_pass = 0
    team_tok_sum = 0
    base_tok_sum = 0
    rng2 = random.Random(17)
    for i in range(10):
        r_team = run_team(f"issue-{i}", n_coders=4, rng=rng2)
        r_base = single_agent_baseline(f"issue-{i}", rng2)
        if r_team['tested_passed']:
            team_pass += 1
        if r_base['passed']:
            baseline_pass += 1
        team_tok_sum += r_team['total_tokens']
        base_tok_sum += r_base['total_tokens']

    print(f"team pass    : {team_pass}/10   tokens/run: {team_tok_sum/10:,.0f}")
    print(f"baseline pass: {baseline_pass}/10   tokens/run: {base_tok_sum/10:,.0f}")
    print(f"token amplification: {team_tok_sum / max(1, base_tok_sum):.2f}x")


if __name__ == "__main__":
    main()
