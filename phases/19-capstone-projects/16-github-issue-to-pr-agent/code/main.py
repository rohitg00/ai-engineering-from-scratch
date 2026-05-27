"""GitHub issue-to-PR async cloud agent — dispatcher + budget + safety gates.

The hard architectural primitive is the dispatcher that enforces per-repo
budgets, scoped GitHub App credentials, and a sandbox lifecycle that never
lets the agent force-push or escape the repo scope. This scaffold implements
the dispatcher, budget ledger, sandbox state machine, and verification gates.

Run:  python main.py
"""

from __future__ import annotations

import random
import time
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from enum import Enum, auto


# ---------------------------------------------------------------------------
# webhook -> task enqueue  --  label trigger and queue contract
# ---------------------------------------------------------------------------

@dataclass
class Task:
    task_id: int
    repo: str
    issue_num: int
    title: str
    created_at: float = field(default_factory=time.time)


# ---------------------------------------------------------------------------
# budget ledger  --  per-repo per-day $ and PR-count caps
# ---------------------------------------------------------------------------

@dataclass
class BudgetLedger:
    daily_dollar_cap: float = 50.0
    daily_pr_cap: int = 5
    per_task_dollar_cap: float = 20.0
    spent_today: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    prs_today: dict[str, int] = field(default_factory=lambda: defaultdict(int))

    def permit(self, repo: str, estimated_cost: float) -> tuple[bool, str]:
        if estimated_cost > self.per_task_dollar_cap:
            return False, f"task estimate ${estimated_cost:.2f} > cap ${self.per_task_dollar_cap}"
        # Reserve against the worst-case per-task spend, not the estimate. The
        # agent loop in ``run_agent`` is allowed to run up to ``per_task_dollar_cap``
        # before tripping ``dollar_cap``, so admitting on ``estimated`` lets a
        # burst of cap-hitting runs overrun the daily ceiling. ``record`` still
        # writes the actual spend so unused reservation auto-reconciles.
        worst_case = self.per_task_dollar_cap
        if self.spent_today[repo] + worst_case > self.daily_dollar_cap:
            return False, f"daily $ cap for {repo} would be exceeded"
        if self.prs_today[repo] >= self.daily_pr_cap:
            return False, f"daily PR cap ({self.daily_pr_cap}) for {repo} reached"
        return True, "ok"

    def record(self, repo: str, spent: float, opened_pr: bool) -> None:
        self.spent_today[repo] += spent
        if opened_pr:
            self.prs_today[repo] += 1


# ---------------------------------------------------------------------------
# GitHub App identity  --  short-lived installation token, scoped permissions
# ---------------------------------------------------------------------------

@dataclass
class InstallationToken:
    repo: str
    expires_at: float
    permissions: dict[str, str] = field(default_factory=dict)

    @classmethod
    def mint(cls, repo: str) -> "InstallationToken":
        return cls(repo=repo,
                   expires_at=time.time() + 3600,
                   permissions={"issues": "rw", "pull_requests": "rw",
                                "contents": "rw", "workflows": "r"})

    def can(self, action: str) -> bool:
        # hard policy: never force-push
        if action == "force_push":
            return False
        if action.startswith("write:main"):
            return False
        return True


# ---------------------------------------------------------------------------
# sandbox state machine  --  CLONE -> INFER -> AGENT -> VERIFY -> PR
# ---------------------------------------------------------------------------

class SState(Enum):
    CLONE = auto()
    INFER = auto()
    AGENT = auto()
    VERIFY = auto()
    PR = auto()
    DONE = auto()
    FAILED = auto()


@dataclass
class SandboxRun:
    task: Task
    state: SState = SState.CLONE
    turns: int = 0
    dollars: float = 0.0
    wall_min: float = 0.0
    coverage_delta: float = 0.0
    ci_green: bool = False
    pr_opened: bool = False
    failure: str | None = None
    trace: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# agent loop stub  --  uses per-turn probability weighted by difficulty
# ---------------------------------------------------------------------------

def run_agent(run: SandboxRun, difficulty: float, rng: random.Random,
              turn_cap: int = 20, dollar_cap: float = 20.0,
              minute_cap: float = 30.0) -> None:
    run.state = SState.AGENT
    per_turn_p = max(0.05, 0.35 * (1 - difficulty))
    per_turn_min = 0.9 + difficulty * 0.6
    per_turn_usd = 0.25 + difficulty * 0.45

    while True:
        run.turns += 1
        run.wall_min += per_turn_min
        run.dollars += per_turn_usd
        run.trace.append(f"turn {run.turns}: $={run.dollars:.2f}")

        if run.turns >= turn_cap:
            run.failure = "turn_cap"
            run.state = SState.FAILED
            return
        if run.dollars >= dollar_cap:
            run.failure = "dollar_cap"
            run.state = SState.FAILED
            return
        if run.wall_min >= minute_cap:
            run.failure = "minute_cap"
            run.state = SState.FAILED
            return

        if rng.random() < per_turn_p:
            run.state = SState.VERIFY
            return


def run_verify(run: SandboxRun, difficulty: float, rng: random.Random) -> None:
    flake = rng.random() < 0.05
    if flake:
        run.ci_green = False
        run.failure = "flaky_test"
        run.state = SState.FAILED
        return
    run.ci_green = True
    run.coverage_delta = rng.gauss(0.0, 0.6)
    if run.coverage_delta < -2.0:
        run.failure = "coverage_regression"
        run.state = SState.FAILED
        return
    run.state = SState.PR


def open_pr(run: SandboxRun, token: InstallationToken) -> None:
    # Explicit runtime checks -- never use `assert` for a safety gate. `python -O`
    # strips asserts, which would let a denied or expired token still open a PR.
    if time.time() >= token.expires_at:
        run.failure = "token_expired"
        run.state = SState.FAILED
        return
    if not token.can("pull_request.open"):
        run.failure = "policy_denied"
        run.state = SState.FAILED
        return
    run.pr_opened = True
    run.state = SState.DONE


# ---------------------------------------------------------------------------
# dispatcher  --  pulls tasks, enforces budget, runs the sandbox flow
# ---------------------------------------------------------------------------

def dispatch(task: Task, ledger: BudgetLedger, rng: random.Random) -> SandboxRun:
    difficulty = rng.uniform(0.3, 0.92)
    estimated = 2.0 + difficulty * 8.0
    allowed, reason = ledger.permit(task.repo, estimated)
    if not allowed:
        run = SandboxRun(task)
        run.failure = f"dispatcher: {reason}"
        run.state = SState.FAILED
        return run

    token = InstallationToken.mint(task.repo)
    run = SandboxRun(task)
    run.trace.append("state: CLONE")
    run.state = SState.INFER
    run.trace.append("state: INFER (dockerfile synthesized)")
    run_agent(run, difficulty, rng)
    if run.state == SState.VERIFY:
        run_verify(run, difficulty, rng)
    if run.state == SState.PR:
        open_pr(run, token)
    ledger.record(task.repo, run.dollars, run.pr_opened)
    return run


# ---------------------------------------------------------------------------
# demo  --  run 20 issues across 3 repos; some will hit budget cap
# ---------------------------------------------------------------------------

def main() -> None:
    rng = random.Random(9)
    ledger = BudgetLedger()
    repos = ["acme/widget", "acme/service", "acme/library"]
    runs: list[SandboxRun] = []

    for i in range(20):
        task = Task(task_id=i, repo=rng.choice(repos), issue_num=800 + i,
                    title=f"fix NPE in module {i}")
        run = dispatch(task, ledger, rng)
        runs.append(run)

    opened = sum(1 for r in runs if r.pr_opened)
    failed = sum(1 for r in runs if r.state == SState.FAILED)
    print(f"=== dispatch result ({len(runs)} tasks) ===")
    print(f"PRs opened : {opened}")
    print(f"failed     : {failed}")

    print("\nfailure reasons:")
    reasons = defaultdict(int)
    for r in runs:
        if r.failure:
            reasons[r.failure] += 1
    for reason, n in sorted(reasons.items(), key=lambda x: -x[1]):
        print(f"  {reason:24s} {n}")

    print("\nbudget summary:")
    for repo in repos:
        print(f"  {repo:20s} spent=${ledger.spent_today[repo]:.2f}  "
              f"PRs={ledger.prs_today[repo]}")

    if opened:
        mean_cost = sum(r.dollars for r in runs if r.pr_opened) / opened
        mean_turns = sum(r.turns for r in runs if r.pr_opened) / opened
        print(f"\npass set: mean $/PR = ${mean_cost:.2f}  mean turns = {mean_turns:.1f}")


if __name__ == "__main__":
    main()
