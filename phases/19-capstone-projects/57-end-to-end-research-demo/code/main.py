"""end-to-end auto-research demo: seed -> scheduler -> critic loop -> paper writer。

概念参照:
- ./docs/en.md (この lesson)
- Phase 19 lesson 54 (paper writer)
- Phase 19 lesson 55 (critic loop)
- Phase 19 lesson 56 (iteration scheduler)
- Phase 19 lessons 50-53 (earlier auto-research stages; ここでは seed/runner stub が代役)

stdlib + numpy のみ。実行: python3 code/main.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import tempfile
from dataclasses import dataclass, field
from typing import Awaitable, Callable


HERE = os.path.dirname(os.path.abspath(__file__))
LESSON_ROOT = os.path.dirname(os.path.dirname(HERE))


def _add(path: str) -> None:
    if path not in sys.path:
        sys.path.insert(0, path)


_add(os.path.join(LESSON_ROOT, "54-paper-writer", "code"))
_add(os.path.join(LESSON_ROOT, "55-critic-loop", "code"))
_add(os.path.join(LESSON_ROOT, "56-iteration-scheduler", "code"))

import importlib
import importlib.util


def _load_module(name: str, file_path: str):
    spec = importlib.util.spec_from_file_location(name, file_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"{file_path} から {name} を load できません")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


paper_writer_mod = _load_module(
    "_t_d2_paper_writer",
    os.path.join(LESSON_ROOT, "54-paper-writer", "code", "main.py"),
)
critic_loop_mod = _load_module(
    "_t_d2_critic_loop",
    os.path.join(LESSON_ROOT, "55-critic-loop", "code", "main.py"),
)
scheduler_mod = _load_module(
    "_t_d2_scheduler",
    os.path.join(LESSON_ROOT, "56-iteration-scheduler", "code", "main.py"),
)


Paper = paper_writer_mod.Paper
Section = paper_writer_mod.Section
Figure = paper_writer_mod.Figure
BibEntry = paper_writer_mod.BibEntry
PaperWriter = paper_writer_mod.PaperWriter
PaperValidationError = paper_writer_mod.PaperValidationError
MockProseGenerator = paper_writer_mod.MockProseGenerator

MiniPaper = critic_loop_mod.MiniPaper
MiniSection = critic_loop_mod.MiniSection
CriticLoop = critic_loop_mod.CriticLoop
deterministic_critic = critic_loop_mod.deterministic_critic
deterministic_reviser = critic_loop_mod.deterministic_reviser

Hypothesis = scheduler_mod.Hypothesis
Result = scheduler_mod.Result
IterationScheduler = scheduler_mod.IterationScheduler
SchedulerReport = scheduler_mod.SchedulerReport
make_deterministic_runner = scheduler_mod.make_deterministic_runner


class NoTriggerError(Exception):
    """paper threshold を超えた branch がなく、demo が best result を選べません。"""


class BestResultError(Exception):
    """picker が空の trigger list を受け取りました。"""


@dataclass
class DemoReport:
    scheduler_report: dict
    best_branch: str
    best_reward: float
    critic_result: dict
    paper_manifest: dict
    stop_reason: str

    def to_dict(self) -> dict:
        return {
            "scheduler_report": self.scheduler_report,
            "best_branch": self.best_branch,
            "best_reward": self.best_reward,
            "critic_result": self.critic_result,
            "paper_manifest": self.paper_manifest,
            "stop_reason": self.stop_reason,
        }


def make_seed_hypotheses() -> list[Hypothesis]:
    """research branch ごとに一つ、計三つの seed hypotheses。lessons 50-53 の代役です。"""
    return [
        Hypothesis(id="h-alpha-1", branch="alpha", payload={"q": "method-x"}),
        Hypothesis(id="h-beta-1", branch="beta", payload={"q": "method-y"}),
        Hypothesis(id="h-gamma-1", branch="gamma", payload={"q": "method-z"}),
    ]


def pick_best_branch(scheduler_report: SchedulerReport) -> tuple[str, float]:
    """triggered branches の中で mean reward が最大の branch を選びます。

    tie は branch id の alphabetic order で解きます (deterministic)。
    """
    if not scheduler_report.paper_triggers:
        raise NoTriggerError("paper threshold を超えた branch がありません")
    by_branch = {b.branch: b for b in scheduler_report.branches}
    triggered = [by_branch[name] for name in scheduler_report.paper_triggers if name in by_branch]
    if not triggered:
        raise BestResultError("lookup 後の trigger list が空です")
    triggered.sort(key=lambda b: (-b.mean, b.branch))
    best = triggered[0]
    return best.branch, best.mean


def _originality_for_reward(reward: float) -> str:
    if reward >= 0.8:
        return "high"
    if reward >= 0.6:
        return "medium"
    return "low"


def build_mini_paper(branch: str, reward: float) -> MiniPaper:
    return MiniPaper(
        title=f"branch {branch} に関する Auto-Research Findings",
        abstract=f"auto-research loop で最も高い yield を示した branch {branch} を要約する。",
        sections=[
            MiniSection(id="intro", title="Introduction", body="初期観察"),
            MiniSection(id="results", title="Results", body=""),
        ],
        originality_tag=_originality_for_reward(reward),
    )


def mini_to_full_paper(mini: MiniPaper, branch: str) -> Paper:
    """converged MiniPaper を writer 用の full Paper に昇格させます。

    使用された citation key ごとに bibliography entry を追加し、figure を一つ追加します。
    各 section の cite list は保持され、bibliography は union から作られます。
    """
    cites: list[str] = []
    for sec in mini.sections:
        for c in sec.cites:
            if c not in cites:
                cites.append(c)

    bib = [
        BibEntry(
            key=key, entry_type="article",
            fields={"title": f"出典 {key}", "author": "Synthesised", "year": "2026"},
        )
        for key in cites
    ]
    if not bib:
        bib = [BibEntry(
            key=f"{branch}-baseline", entry_type="article",
            fields={"title": "baseline", "author": "Synthesised", "year": "2026"},
        )]
        for sec in mini.sections:
            if sec.id == "intro":
                sec.cites.append(f"{branch}-baseline")
                break

    fig = Figure(
        id=f"{branch}-results",
        path=f"figs/{branch}.pdf",
        caption=f"branch {branch} の reward trajectory",
    )

    sections = []
    for s in mini.sections:
        figure_refs = [fig.id] if s.id == "results" else []
        sections.append(Section(
            id=s.id, title=s.title, body=s.body,
            cites=list(s.cites), figure_refs=figure_refs,
        ))
    return Paper(
        title=mini.title,
        authors=["Auto-Research Demo"],
        abstract=mini.abstract,
        sections=sections,
        figures=[fig],
        bibliography=bib,
    )


async def _run_demo_async(out_dir: str, seed: int = 11) -> DemoReport:
    seed_list = make_seed_hypotheses()
    if not seed_list:
        raise BestResultError("seed list が空です")

    runner = make_deterministic_runner(
        base_rewards={"alpha": 0.82, "beta": 0.55, "gamma": 0.15},
        noise=0.04,
        delay_ms=2.0,
        seed=seed,
    )
    sched = IterationScheduler(
        runner=runner, slots=3, max_experiments=6,
        paper_threshold=0.7, prune_floor=0.2, prune_after_runs=3,
        expander=scheduler_mod.deterministic_expander,
    )
    sched_report = await sched.run(seed_list)

    branch, reward = pick_best_branch(sched_report)

    mini = build_mini_paper(branch, reward)
    loop = CriticLoop(
        critic=deterministic_critic,
        reviser=deterministic_reviser,
        max_rounds=6,
        target_score=8.0,
    )
    critic_result = loop.run(mini)

    full_paper = mini_to_full_paper(critic_result.paper, branch)
    prose = MockProseGenerator(outlines={
        "intro": f"branch {branch} の動機",
        "results": f"branch {branch} の reward trajectory の要約",
        "method": "method の説明",
        "related-work": "related work の survey",
    })
    writer = PaperWriter(prose=prose)
    manifest = writer.write(full_paper, out_dir)

    return DemoReport(
        scheduler_report=sched_report.to_dict(),
        best_branch=branch,
        best_reward=reward,
        critic_result=critic_result.to_dict(),
        paper_manifest=manifest,
        stop_reason=sched_report.stop_reason,
    )


def run_demo(out_dir: str | None = None, seed: int = 11) -> DemoReport:
    if out_dir is None:
        out_dir = tempfile.mkdtemp(prefix="auto-research-demo-")
    return asyncio.run(_run_demo_async(out_dir, seed=seed))


def demo() -> dict:
    return run_demo().to_dict()


if __name__ == "__main__":
    rep = demo()
    print(json.dumps({
        "stop_reason": rep["stop_reason"],
        "best_branch": rep["best_branch"],
        "best_reward": rep["best_reward"],
        "critic_status": rep["critic_result"]["status"],
        "critic_rounds": rep["critic_result"]["rounds_used"],
        "paper_sections": [s["id"] for s in rep["paper_manifest"]["sections"]],
        "paper_figures": [f["id"] for f in rep["paper_manifest"]["figures"]],
        "experiments_run": rep["scheduler_report"]["experiments_run"],
    }, indent=2))
