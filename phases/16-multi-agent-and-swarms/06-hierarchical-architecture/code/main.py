"""Hierarchical multi-agent with decomposition-drift demo.

3-level hierarchy: top manager -> sub-managers -> workers.
Run happy path and a perturbed path where the top manager mislabels one branch.
Watch the error cascade.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class LeafOutput:
    worker: str
    question: str
    answer: str


@dataclass
class SubSummary:
    sub_manager: str
    leaves: list[LeafOutput]
    summary: str


@dataclass
class TopSynthesis:
    top_manager: str
    branches: list[SubSummary]
    synthesis: str


class Worker:
    def __init__(self, name: str, canned: dict[str, str]) -> None:
        self.name = name
        self.canned = canned

    def run(self, question: str) -> LeafOutput:
        key = self._match_key(question)
        ans = self.canned.get(key, f"[no canned answer for '{question}']")
        return LeafOutput(worker=self.name, question=question, answer=ans)

    def _match_key(self, q: str) -> str:
        ql = q.lower()
        for k in self.canned:
            if k in ql:
                return k
        return "default"


class SubManager:
    def __init__(self, name: str, workers: list[Worker], split: dict[str, str]) -> None:
        self.name = name
        self.workers = workers
        self.split = split

    def run(self, task: str) -> SubSummary:
        leaves = []
        for w in self.workers:
            sub_q = self.split.get(w.name, task)
            leaves.append(w.run(sub_q))
        summary = f"[{self.name}] aggregated: " + " | ".join(l.answer for l in leaves)
        return SubSummary(sub_manager=self.name, leaves=leaves, summary=summary)


class TopManager:
    def __init__(self, name: str, subs: dict[str, SubManager]) -> None:
        self.name = name
        self.subs = subs

    def run(self, task: str, branch_labels: list[str]) -> TopSynthesis:
        summaries: list[SubSummary] = []
        for label in branch_labels:
            if label not in self.subs:
                summaries.append(
                    SubSummary(
                        sub_manager=f"MISSING[{label}]",
                        leaves=[],
                        summary=f"[top] tried to delegate to '{label}' -- no such sub-manager",
                    )
                )
                continue
            summaries.append(self.subs[label].run(f"{task} -- branch: {label}"))
        synth = "top synthesis: " + " || ".join(s.summary for s in summaries)
        return TopSynthesis(top_manager=self.name, branches=summaries, synthesis=synth)


def build_hierarchy() -> TopManager:
    fe = Worker("fe", {"frontend": "React component audited; 2 issues."})
    be = Worker("be", {"backend": "API endpoints audited; 1 issue."})
    eng = SubManager(
        "eng-manager",
        [fe, be],
        {"fe": "frontend review of the feature", "be": "backend review of the feature"},
    )
    lw = Worker("lawyer", {"legal": "Contract clauses A and B are non-compliant."})
    legal = SubManager("legal-manager", [lw], {"lawyer": "legal review of the feature"})
    fw = Worker(
        "finance",
        {"finance": "Projected cost $42k/month; exceeds budget by 12%."},
    )
    finance = SubManager("finance-manager", [fw], {"finance": "finance review of the feature"})
    return TopManager("vp-eng", {"engineering": eng, "legal": legal, "finance": finance})


def render(label: str, synth: TopSynthesis) -> None:
    print(f"\n=== {label} ===")
    for branch in synth.branches:
        print(f"  [sub] {branch.sub_manager}")
        for leaf in branch.leaves:
            print(f"    [leaf] {leaf.worker:8s} asked: {leaf.question}")
            print(f"           answered: {leaf.answer}")
        print(f"    [summary] {branch.summary}")
    print(f"  [top] {synth.synthesis}")


def main() -> None:
    print("Hierarchical multi-agent with decomposition-drift demo")
    print("-" * 60)

    top = build_hierarchy()
    task = "Ship the premium tier feature to production."

    happy = top.run(task, branch_labels=["engineering", "legal"])
    render("Happy path (correct branches)", happy)

    perturbed = top.run(task, branch_labels=["engineering", "finance"])
    render("Perturbed path (top manager mislabels 'legal' as 'finance')", perturbed)

    print("\nUser asked about legal/engineering review.")
    print("Happy path: both legal and engineering answer truthfully.")
    print("Perturbed path: finance dutifully answers, legal question goes unanswered.")
    print("The error appears at TOP synthesis -- one level removed from where a human could catch it.")


if __name__ == "__main__":
    main()
