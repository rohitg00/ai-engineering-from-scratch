"""Multi-agent software team - typed task board + handoff accounting scaffold。

難しい architectural primitive は、architect、N parallel coders、reviewer、tester
を coordinate し、すべての role boundary が trace span を生成する typed message
task board です。この scaffold は stubbed LLM call で message flow 全体を走らせ、
handoff logic と token accounting を end to end に観測できるようにします。

Run:  python main.py
"""

from __future__ import annotations

import random
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum


# ---------------------------------------------------------------------------
# typed message task board  --  A2A-style typed message
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
# role stub  --  architect、coder、reviewer、tester
# ---------------------------------------------------------------------------

@dataclass
class Subtask:
    name: str
    files: list[str]
    lines_changed: int = 0
    has_bug: bool = False  # injected-bug probe 用


def architect_plan(issue: str, rng: random.Random) -> list[Subtask]:
    """stubbed architect plan。"""
    subs = [
        Subtask("parser", ["src/parser.py"]),
        Subtask("cache", ["src/cache.py", "src/cache_test.py"]),
        Subtask("api", ["src/api.py"]),
        Subtask("migration", ["src/migrate.py"]),
    ]
    # reviewer probe 用に bug を1つ random に注入する
    subs[rng.randrange(len(subs))].has_bug = rng.random() < 0.3
    return subs


def coder_implement(sub: Subtask, rng: random.Random) -> dict:
    sub.lines_changed = rng.randint(15, 95)
    return {"subtask": sub.name, "lines": sub.lines_changed,
            "has_bug": sub.has_bug}


def reviewer_check(diffs: list[dict], rng: random.Random) -> tuple[bool, str]:
    """reviewer stub。約85%で bug を検出し、15% false-approve rate を持つ。"""
    buggy = [d for d in diffs if d["has_bug"]]
    if not buggy:
        return True, "承認"
    if rng.random() < 0.85:
        return False, f"{buggy[0]['subtask']} に bug を発見。再確認してください"
    return True, "承認 (FALSE-APPROVE)"


def tester_run(diffs: list[dict], rng: random.Random) -> tuple[bool, str]:
    """tester stub。残った bug を検出し、約3%の flake rate を持つ。"""
    buggy = [d for d in diffs if d["has_bug"]]
    if buggy:
        return False, f"{buggy[0]['subtask']} module で test が失敗"
    if rng.random() < 0.03:
        return False, "flaky test で失敗"
    return True, "412/412 pass"


# ---------------------------------------------------------------------------
# orchestrator  --  flow 全体を走らせ、token amplification を計算する
# ---------------------------------------------------------------------------

def run_team(issue: str, n_coders: int = 4, rng: random.Random | None = None) -> dict:
    rng = rng or random.Random(0)
    board = Board()

    # architect
    plan = architect_plan(issue, rng)
    board.post(Msg(MsgKind.PLAN_REQUEST, by="architect", to="board",
                   payload={"issue": issue, "subtasks": [s.name for s in plan]},
                   tokens=4500))

    # subtask を coder に dispatch する
    for i, sub in enumerate(plan[:n_coders]):
        coder = f"coder-{chr(65 + i)}"
        board.post(Msg(MsgKind.SUBTASK, by="architect", to=coder,
                       payload={"subtask": sub.name, "files": sub.files},
                       tokens=1200))

    # coder が parallel に実装する
    diffs: list[dict] = []
    for i, sub in enumerate(plan[:n_coders]):
        coder = f"coder-{chr(65 + i)}"
        result = coder_implement(sub, rng)
        diffs.append(result)
        board.post(Msg(MsgKind.DIFF_READY, by=coder, to="merge_coord",
                       payload=result, tokens=3200 + result["lines"] * 30))

    # merge (この scaffold では構造上 conflict しない)
    board.post(Msg(MsgKind.REVIEW_NEEDED, by="merge_coord", to="reviewer",
                   payload={"diffs": diffs}, tokens=2000))

    # reviewer
    approved, comment = reviewer_check(diffs, rng)
    if approved:
        board.post(Msg(MsgKind.APPROVED, by="reviewer", to="tester",
                       payload={"comment": comment}, tokens=1800))
    else:
        # subtask を所有する coder に戻す (簡略化して first coder)
        board.post(Msg(MsgKind.REVIEW_FEEDBACK, by="reviewer", to="coder-A",
                       payload={"comment": comment}, tokens=1800))
        # coder が revise する
        board.post(Msg(MsgKind.DIFF_READY, by="coder-A", to="merge_coord",
                       payload={"subtask": "parser", "lines": 52, "has_bug": False},
                       tokens=3100))
        # reviewer が再 approve する
        board.post(Msg(MsgKind.APPROVED, by="reviewer", to="tester",
                       payload={"comment": "修正後に承認"}, tokens=1500))
        # diff を更新して bug を落とす
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
# single-agent baseline に対する matched trial を複数走らせる
# ---------------------------------------------------------------------------

def single_agent_baseline(issue: str, rng: random.Random) -> dict:
    """stub: single worktree 上の Sonnet 4.7 1体が全体を実行する。"""
    # 遅いが handoff は少ない。tokens は role overhead を除いた全体 budget 程度
    return {
        "passed": rng.random() < 0.68,
        "total_tokens": 18_000 + rng.randint(0, 6_000),
    }


def main() -> None:
    rng = random.Random(11)
    print("=== multi-agent team run ===")
    result = run_team("widget parser race を修正", n_coders=4, rng=rng)
    print(f"approved     : {result['approved']}  ({result['review_comment']})")
    print(f"tested passed: {result['tested_passed']}  ({result['test_msg']})")
    print(f"handoffs     : {result['handoffs']}")
    print(f"total tokens : {result['total_tokens']:,}")
    print("role 別 token:")
    for role, n in sorted(result['tokens_by_role'].items(), key=lambda x: -x[1]):
        print(f"  {role:14s} {n:>6,}")

    print("\n=== single-agent baseline との matched trial 10回 ===")
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
