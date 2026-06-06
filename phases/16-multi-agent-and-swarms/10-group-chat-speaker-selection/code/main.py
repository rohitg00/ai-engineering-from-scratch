"""Group chat with speaker selection -- AutoGen GroupChat in miniature.

Three agents (coder, reviewer, manager), two selector variants
(round-robin, LLM-simulated), TERMINATE-token stop condition.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional


@dataclass
class Msg:
    speaker: str
    content: str


@dataclass
class Agent:
    name: str
    role: str
    policy: Callable[[list[Msg]], str]


def coder_policy(pool: list[Msg]) -> str:
    recent = [m for m in pool[-3:] if m.speaker != "coder"]
    last = recent[-1].content if recent else ""
    if "review" in last.lower() or "fix" in last.lower():
        return "revised code: return a + b"
    if not any(m.speaker == "coder" for m in pool):
        return "initial code: return a - b  (buggy)"
    return "TERMINATE"


def reviewer_policy(pool: list[Msg]) -> str:
    last_coder = next((m for m in reversed(pool) if m.speaker == "coder"), None)
    if last_coder is None:
        return "waiting for code"
    if "a - b" in last_coder.content:
        return "review: bug detected -- sum must be a+b, please fix"
    if "a + b" in last_coder.content:
        return "review: approved"
    return "review: unclear"


def manager_policy(pool: list[Msg]) -> str:
    approvals = [m for m in pool if m.speaker == "reviewer" and "approved" in m.content]
    if approvals:
        return "TERMINATE"
    return "manager: continue working"


AGENTS: dict[str, Agent] = {
    "coder": Agent("coder", "writes code", coder_policy),
    "reviewer": Agent("reviewer", "reviews code", reviewer_policy),
    "manager": Agent("manager", "keeps things moving", manager_policy),
}


def round_robin_selector(pool: list[Msg], team: dict[str, Agent]) -> Optional[str]:
    names = list(team.keys())
    if not pool:
        return names[0]
    idx = (names.index(pool[-1].speaker) + 1) % len(names)
    return names[idx]


def llm_style_selector(pool: list[Msg], team: dict[str, Agent]) -> Optional[str]:
    """Simulated LLM selector: picks based on recent context keywords.
    A real implementation is an LLM call with the recent pool."""
    if not pool:
        return "manager"
    last = pool[-1]
    if last.speaker == "coder":
        return "reviewer"
    if last.speaker == "reviewer":
        if "approved" in last.content:
            return "manager"
        return "coder"
    if last.speaker == "manager":
        return "coder"
    return None


def run_groupchat(
    team: dict[str, Agent],
    selector: Callable[[list[Msg], dict[str, Agent]], Optional[str]],
    max_rounds: int,
    label: str,
) -> list[Msg]:
    print(f"\n=== {label} ===")
    pool: list[Msg] = []
    trace: list[str] = []
    for _ in range(max_rounds):
        nxt = selector(pool, team)
        if nxt is None:
            break
        trace.append(nxt)
        agent = team[nxt]
        content = agent.policy(pool)
        pool.append(Msg(speaker=nxt, content=content))
        print(f"  [{nxt:8s}]: {content}")
        if content.strip().endswith("TERMINATE"):
            break
    print(f"  Selector trace: {trace}")
    print(f"  Rounds used: {len(pool)}")
    return pool


def speaker_counts(pool: list[Msg]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for m in pool:
        counts[m.speaker] = counts.get(m.speaker, 0) + 1
    return counts


def main() -> None:
    print("Group chat with speaker selection -- AutoGen GroupChat shape")
    print("-" * 62)

    p_rr = run_groupchat(AGENTS, round_robin_selector, max_rounds=8, label="Round-robin")
    print(f"  Speaker counts: {speaker_counts(p_rr)}")

    p_llm = run_groupchat(AGENTS, llm_style_selector, max_rounds=8, label="LLM-style (context-aware)")
    print(f"  Speaker counts: {speaker_counts(p_llm)}")

    print("\nObservations:")
    print("  - Round-robin gives every agent an equal turn regardless of context.")
    print("  - LLM-style routes by context; reviewer only speaks after coder, etc.")
    print("  - Both terminate on TERMINATE token or max_rounds.")


if __name__ == "__main__":
    main()
