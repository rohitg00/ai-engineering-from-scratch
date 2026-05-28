"""decomposition drift demo 付き hierarchical multi-agent。

3-level hierarchy: top manager -> sub-managers -> workers。
happy path と、top manager が branch を 1 つ mislabel する perturbed path を実行する。
error cascade を観察する。
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
        ans = self.canned.get(key, f"['{question}' への canned answer なし]")
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
                        summary=f"[top] '{label}' に delegate しようとしたが、その sub-manager は存在しない",
                    )
                )
                continue
            summaries.append(self.subs[label].run(f"{task} -- branch: {label}"))
        synth = "top synthesis: " + " || ".join(s.summary for s in summaries)
        return TopSynthesis(top_manager=self.name, branches=summaries, synthesis=synth)


def build_hierarchy() -> TopManager:
    fe = Worker("fe", {"frontend": "React component を audit。2 issues。"})
    be = Worker("be", {"backend": "API endpoints を audit。1 issue。"})
    eng = SubManager(
        "eng-manager",
        [fe, be],
        {"fe": "feature の frontend review", "be": "feature の backend review"},
    )
    lw = Worker("lawyer", {"legal": "Contract clauses A と B は non-compliant。"})
    legal = SubManager("legal-manager", [lw], {"lawyer": "feature の legal review"})
    fw = Worker(
        "finance",
        {"finance": "Projected cost は $42k/month。budget を 12% 超過。"},
    )
    finance = SubManager("finance-manager", [fw], {"finance": "feature の finance review"})
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
    print("decomposition-drift demo 付き hierarchical multi-agent")
    print("-" * 60)

    top = build_hierarchy()
    task = "premium tier feature を production に ship する。"

    happy = top.run(task, branch_labels=["engineering", "legal"])
    render("Happy path (correct branches)", happy)

    perturbed = top.run(task, branch_labels=["engineering", "finance"])
    render("Perturbed path (top manager が 'legal' を 'finance' と mislabel)", perturbed)

    print("\nUser は legal/engineering review を求めました。")
    print("Happy path: legal と engineering の両方が正しく答えます。")
    print("Perturbed path: finance が従順に答え、legal question は未回答のままです。")
    print("error は TOP synthesis に現れます。human が気づけた場所から 1 level 離れています。")


if __name__ == "__main__":
    main()
