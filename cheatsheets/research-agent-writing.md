---
id: research-agent-writing
title: Paper Writer, Critic and Iteration
code: PW
subtitle: Schedule experiments with UCB, iterate a draft with a five-score critic, and emit LaTeX, BibTeX and a manifest.
hue: 280
sources: phases/19-capstone-projects/54-paper-writer, phases/19-capstone-projects/55-critic-loop, phases/19-capstone-projects/56-iteration-scheduler, phases/19-capstone-projects/57-end-to-end-research-demo
source_hash: 68a4188a61fb9e49
---

## End-to-end research demo
type: architecture
from: phases/19-capstone-projects/57-end-to-end-research-demo/docs/en.md, phases/19-capstone-projects/57-end-to-end-research-demo/code/main.py, phases/19-capstone-projects/56-iteration-scheduler/docs/en.md

```arch
node | seed | 1,1 | Seed hypotheses | alpha, beta, gamma | client
node | sched | 2,1 | IterationScheduler | UCB picker | process
node | slots | 3,1 | 3 parallel slots | asyncio tasks | process
node | bus | 4,1 | Result bus | reward per branch | queue
node | pick | 4,2 | pick_best_branch | highest mean reward | process
node | critic | 3,2 | CriticLoop | five scores per round | model
node | writer | 2,2 | PaperWriter | tex, bib, manifest | process
node | report | 1,2 | DemoReport | stop_reason | store
edge | seed | sched |
edge | sched | slots | dispatch
edge | slots | bus | Result
edge | bus | sched | UCB stats
edge | bus | pick | paper.trigger
edge | pick | critic | MiniPaper
edge | critic | writer | mini_to_full_paper
edge | writer | report | manifest
```

## Run the lessons
type: command-table
span: 2
from: phases/19-capstone-projects/54-paper-writer/code/main.py, phases/19-capstone-projects/55-critic-loop/code/main.py, phases/19-capstone-projects/56-iteration-scheduler/code/main.py, phases/19-capstone-projects/57-end-to-end-research-demo/code/main.py

| Command | What it does |
|---|---|
| `python3 code/main.py` (54) | Writes paper.tex, references.bib, manifest.json to a temp dir |
| `python3 code/main.py` (55) | Prints the critic loop result and per-round trace |
| `python3 code/main.py` (56) | Prints stop_reason, paper triggers and branch stats |
| `python3 code/main.py` (57) | Prints best branch, critic status and paper sections |

## Calls in code
type: task-table
span: 2
from: phases/19-capstone-projects/54-paper-writer/code/main.py, phases/19-capstone-projects/55-critic-loop/code/main.py, phases/19-capstone-projects/56-iteration-scheduler/code/main.py, phases/19-capstone-projects/57-end-to-end-research-demo/code/main.py

| Task | Code |
|---|---|
| Figures from experiment outputs | `figs = read_experiment_manifest(experiments, out_dir)` |
| Render LaTeX only | `render_latex(paper)` |
| Fill prose and write three files | `manifest = PaperWriter(prose=prose).write(paper, out_dir)` |
| Pair critic and reviser | `critic, reviser = make_deterministic_critic_pair()` |
| Iterate a draft | `CriticLoop(critic=critic, reviser=reviser, max_rounds=6, target_score=8.0)` |
| Mock experiments | `make_deterministic_runner(base_rewards, noise=0.04, delay_ms=2.0, seed=seed)` |
| Schedule and wait | `report = await sched.run(seed)` |
| Pick and promote | `pick_best_branch(sched_report)`, then `mini_to_full_paper(critic_result.paper, branch)` |

## Declare the paper skeleton
type: annotated-code
lang: python
from: phases/19-capstone-projects/54-paper-writer/code/main.py, phases/19-capstone-projects/54-paper-writer/docs/en.md

```python
paper = Paper(
    title="<title>", authors=["Lab Bot"], abstract="<abstract>",
    sections=[
        Section(id="method", title="Method", cites=["jones2021"],
                figure_refs=[figs[0].id]),     # label sec:method
    ],
    figures=figs,                              # label fig:<id>
    bibliography=[
        BibEntry(key="jones2021", entry_type="article",
                 fields={"title": "On loops", "author": "Jones", "year": "2021"}),
    ],
)
prose = MockProseGenerator(outlines={"method": "<outline>"})
writer = PaperWriter(prose=prose)              # gates run before any file
```

## Run the UCB scheduler
type: annotated-code
lang: python
from: phases/19-capstone-projects/56-iteration-scheduler/code/main.py

```python
seed = [Hypothesis(id="h-a-1", branch="branch-a"),
        Hypothesis(id="h-b-1", branch="branch-b")]
runner = make_deterministic_runner(
    base_rewards={"branch-a": 0.85, "branch-b": 0.55},
    seed=7, delay_ms=2.0,
)                                              # reward is base + N(0, noise)
sched = IterationScheduler(
    runner=runner, slots=3, max_experiments=20,
    paper_threshold=0.7, prune_floor=0.25, prune_after_runs=3,
    expander=deterministic_expander,           # two follow-ups per high reward
)
report = asyncio.run(sched.run(seed))          # SchedulerReport
report.to_dict()                               # stop_reason, paper_triggers
```

## Critic round and stop rules
type: flow
from: phases/19-capstone-projects/55-critic-loop/docs/en.md, phases/19-capstone-projects/55-critic-loop/code/main.py

1. **Critic**: scores clarity, novelty, evidence, methodology and related_work from 0 to 10.
2. **Critic**: emits one suggestion for each dimension below 8.0.
3. **Harness**: all five at or above `target_score` stops with reason target.
4. **Harness**: mean gain at most `plateau_epsilon` for 2 rounds stops with plateau.
5. **Reviser**: applies each edit, for example `expand-body` or `add-method-section`.
6. **Harness**: after `max_rounds` the status is stopped with reason budget.
7. **Order**: target wins over plateau. Plateau wins over budget.

## Formulas and scores
type: concepts
from: phases/19-capstone-projects/56-iteration-scheduler/docs/en.md, phases/19-capstone-projects/56-iteration-scheduler/code/main.py, phases/19-capstone-projects/55-critic-loop/code/main.py, phases/19-capstone-projects/57-end-to-end-research-demo/code/main.py

- **UCB1**: mean reward + c times sqrt(ln(total_runs) / runs).
- **Untried branch**: `ucb_score` returns `float("inf")`, so it runs first.
- **Prune**: mean below `prune_floor` after `prune_after_runs` trials.
- **Paper trigger**: branch mean at or above `paper_threshold`, once per branch.
- **Clarity**: `min(10.0, 3.0 + avg_body / 50.0)`.
- **Evidence**: `min(10.0, 2.0 + 2.0 * fig_refs + 1.5 * cites)`.
- **Novelty**: 9.0 for high, 6.0 for medium, 3.0 for low `originality_tag`.
- **Demo originality**: high at reward 0.8 or more, medium at 0.6 or more.

## Loop defaults
type: defaults
from: phases/19-capstone-projects/55-critic-loop/code/main.py, phases/19-capstone-projects/55-critic-loop/docs/en.md, phases/19-capstone-projects/56-iteration-scheduler/code/main.py, phases/19-capstone-projects/56-iteration-scheduler/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `max_rounds` | 5 | Critic budget. Below 1 raises ValueError |
| `target_score` | 8.0 | Every dimension, not the mean |
| `plateau_epsilon` | 0.1 | For `plateau_window` 2 rounds |
| `slots` | 3 | Parallel asyncio tasks |
| `max_experiments` | 50 | `max_seconds` is 30.0 |
| `exploration_c` | sqrt(2) | UCB exploration weight |
| `paper_threshold` | 0.7 | Fires `paper.trigger` |
| `prune_floor` | 0.2 | After `prune_after_runs` 3 trials |

## Errors and fixes
type: troubleshooting
from: phases/19-capstone-projects/54-paper-writer/code/main.py, phases/19-capstone-projects/55-critic-loop/docs/en.md, phases/19-capstone-projects/56-iteration-scheduler/code/main.py, phases/19-capstone-projects/57-end-to-end-research-demo/code/main.py, phases/19-capstone-projects/57-end-to-end-research-demo/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `PaperValidationError`: cites unknown bibliography key | Section cite has no `BibEntry` | Add the entry to `bibliography` |
| `PaperValidationError`: references unknown figure id | `figure_refs` names a missing figure | Add the figure first |
| `NoTriggerError` | No branch reached `paper_threshold` | Check branch rewards against the threshold |
| Five flat rounds, verdict budget | Suggestions never raise the score | Fix the critic, not the draft |
| Branch never scheduled again | Branch is pruned | Check `prune_floor` and `prune_after_runs` |
| Trace event kind error | Runner task raised | Read the `repr` of the exception in the trace |

## Questions
type: qa
span: 2
from: phases/19-capstone-projects/54-paper-writer/docs/en.md, phases/19-capstone-projects/55-critic-loop/docs/en.md, phases/19-capstone-projects/56-iteration-scheduler/docs/en.md, phases/19-capstone-projects/57-end-to-end-research-demo/docs/en.md

- **Why a skeleton first?** Gates check figures, cites and sections before any prose.
- **What does the critic read?** `manifest.json`. It does not parse LaTeX.
- **Why UCB?** Greedy never explores. Uniform never exploits.
- **Why import, not copy?** The demo adjusts `sys.path` and composes the earlier lessons.
