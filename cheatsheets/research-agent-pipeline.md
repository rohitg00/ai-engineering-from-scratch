---
id: research-agent-pipeline
title: Research Agent Pipeline from Scratch
code: RP
subtitle: Generate hypotheses, retrieve papers, run sandboxed experiments, judge results, and publish a cited report.
hue: 165
sources: phases/19-capstone-projects/05-autonomous-research-agent, phases/19-capstone-projects/50-hypothesis-generator, phases/19-capstone-projects/51-literature-retrieval, phases/19-capstone-projects/52-experiment-runner, phases/19-capstone-projects/53-result-evaluator, projects/research-report-agent
source_hash: e3bed71e0634229b
---

## The research loop
type: architecture
from: phases/19-capstone-projects/50-hypothesis-generator/docs/en.md, phases/19-capstone-projects/51-literature-retrieval/docs/en.md, phases/19-capstone-projects/52-experiment-runner/docs/en.md, phases/19-capstone-projects/53-result-evaluator/docs/en.md, phases/19-capstone-projects/05-autonomous-research-agent/docs/en.md

```arch
node | gen | 1,1 | HypothesisGenerator | lesson 50, ranked queue | model
node | ret | 2,1 | RetrievalClient | lesson 51, BM25 + citation graph | store
node | run | 3,1 | ExperimentRunner | lesson 52, subprocess limits | process
node | eval | 4,1 | Evaluator | lesson 53, paired t test | process
node | seed | 1,2 | Seed prompt | temperature ramp | client
node | tree | 2,2 | Tree search | novelty, quality, budget | process
node | write | 3,2 | LaTeX writer | vision critique | model
node | rev | 4,2 | Reviewer ensemble | 5 judges | model
edge | seed | gen |
edge | gen | ret | queue head
edge | ret | run | not settled
edge | run | eval | ExperimentResult
edge | eval | gen | verdict
edge | tree | write | best branch
edge | write | rev | draft
```

## Run it
type: command-table
span: 2
from: phases/19-capstone-projects/50-hypothesis-generator/code/main.py, phases/19-capstone-projects/51-literature-retrieval/code/main.py, phases/19-capstone-projects/52-experiment-runner/code/main.py, phases/19-capstone-projects/53-result-evaluator/code/main.py, phases/19-capstone-projects/05-autonomous-research-agent/code/main.py, phases/19-capstone-projects/05-autonomous-research-agent/docs/en.md, projects/research-report-agent/README.md, projects/research-report-agent/solution/run_report.py

| Command | What it does |
|---|---|
| `python3 code/main.py` | Lessons 50 to 53 demo. Prints JSON |
| `python main.py` | Lesson 05 tree search, budget $30 |
| `docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only` | Sandbox for one experiment |
| `run_report.py "<question>" --out out/ --code <dir>` | Report, trace and evidence JSON |
| `run_report.py --eval heldout/questions.json` | Score the public fixtures |
| `run_report.py "<question>" --model replay --cassette <file>` | Plan from recorded replies |
| `run_report.py "<question>" --corpus <dir> --compare <old>/report.json` | Write `changes.json` |
| `project_test.py research-report-agent --stage <n> --path <dir>` | Grade a stage and all earlier ones |

## Loop calls in code
type: task-table
span: 2
from: phases/19-capstone-projects/50-hypothesis-generator/code/main.py, phases/19-capstone-projects/51-literature-retrieval/code/main.py, phases/19-capstone-projects/52-experiment-runner/code/main.py, phases/19-capstone-projects/53-result-evaluator/code/main.py

| Task | Code |
|---|---|
| Configure the ramp | `GeneratorConfig(n_passes=4, t_min=0.2, t_max=1.1)` |
| Draft and rank | `queue, logs = generator.run(seed_prompt)` |
| Build a retriever | `build_client(RetrievalConfig(top_k_lexical=5, max_hops=2))` |
| Search papers | `result = client.search(query)` |
| Run one spec | `ExperimentRunner().run(spec)` |
| Sweep one knob | `AblationRunner(runner).sweep(base, "k", [4, 8, 16, 32])` |
| Pick the metric | `MetricSpec(name="perplexity", direction=LOWER, scale=LOG)` |
| Judge the runs | `evaluator.evaluate(1, metric_spec, candidates, baselines)` |

## Spec a sandboxed experiment
type: annotated-code
lang: python
from: phases/19-capstone-projects/52-experiment-runner/code/main.py, phases/19-capstone-projects/52-experiment-runner/docs/en.md

```python
base = ExperimentSpec(
    spec_id="demo_base", hypothesis_id=1,
    script_path=script,                       # prints one json line
    config={"k": 16, "steps": 4, "sleep_s": 0.0},
    seed=7,                                   # sent as config["__seed"]
    wall_timeout_s=15.0,                      # hard, killed on exceed
    memory_cap_mb=256,                        # soft, polled RSS
    metric_keys=["perplexity", "final_loss"],
)
runner = ExperimentRunner()
base_result = runner.run(base)                # terminal: ok, timeout, oom, crash
base_result.to_dict()                         # metrics, peak_rss_mb, stderr_tail
ablate(base, "k", [4, 8])                     # spec_id demo_base_k_4
```

## Report agent run
type: flow
from: projects/research-report-agent/solution/report_agent/pipeline.py, projects/research-report-agent/solution/report_agent/critic.py, projects/research-report-agent/solution/report_agent/writer.py, projects/research-report-agent/solution/report_agent/planner.py, projects/research-report-agent/README.md

1. **index**: `BM25Index(documents)` ranks the markdown corpus in Rust.
2. **plan**: `plan_research` splits the question into up to 4 facets.
3. **gather**: `gather_snippets` keeps 3 snippets per facet with offsets.
4. **write**: `write_report` composes sentences with `[S1]` markers.
5. **verify**: `review` scores each sentence. `apply_verdicts` drops the rest.
6. **state**: `decide_state` gives completed, needs_review or failed.
7. **publish**: `write_outputs` writes report.html, report.json and trace.json.

## Scores and formulas
type: concepts
from: phases/19-capstone-projects/50-hypothesis-generator/docs/en.md, phases/19-capstone-projects/51-literature-retrieval/docs/en.md, phases/19-capstone-projects/53-result-evaluator/docs/en.md, phases/19-capstone-projects/05-autonomous-research-agent/code/main.py, projects/research-report-agent/solution/report_agent/evaluate.py

- **Cosine distance**: `1 - dot(a, b)` on unit vectors.
- **rank_score**: 0.4 novelty + 0.3 specificity + 0.3 testability.
- **final_score**: 0.5 normalized BM25 + 0.3 graph + 0.2 recency.
- **graph_score**: 1 for a lexical hit, 0.6 at one hop, 0.3 at two hops.
- **Node score**: novelty 0.4 + quality 0.5 + budget weight 0.1.
- **Improvement**: (baseline - candidate) / abs(baseline) when lower is better.
- **Paired t**: `t_stat = mean / sqrt(variance / n)`, df is n - 1.
- **Report score**: 100 x (0.4 precision + 0.3 recall + 0.3 facts).

## Loop defaults
type: defaults
from: phases/19-capstone-projects/50-hypothesis-generator/code/main.py, phases/19-capstone-projects/51-literature-retrieval/code/main.py, phases/19-capstone-projects/52-experiment-runner/code/main.py, phases/19-capstone-projects/53-result-evaluator/code/main.py

| Setting | Default | Note |
|---|---|---|
| `n_passes` | 6 | `t_min` 0.2 to `t_max` 1.2 |
| `novelty_threshold` | 0.25 | Lower distance is a duplicate |
| BM25 `k1`, `b` | 1.5 | `b` is 0.75 |
| `top_k_lexical` | 10 | Seeds for the graph walk |
| `max_hops` | 2 | Values above 2 are clamped |
| `wall_timeout_s` | 30.0 | `memory_cap_mb` is 512 |
| `improvement_threshold` | 0.02 | Smaller change is noise |
| `significance_threshold` | 0.05 | Larger p value is noise |

## Report agent defaults
type: defaults
from: projects/research-report-agent/solution/report_agent/critic.py, projects/research-report-agent/solution/report_agent/evaluate.py, projects/research-report-agent/solution/report_agent/writer.py, projects/research-report-agent/solution/report_agent/planner.py, projects/research-report-agent/solution/run_report.py, projects/research-report-agent/README.md

| Setting | Default | Note |
|---|---|---|
| `--model` | rules | Also replay or live |
| Budget `max_steps` | 50 | `BudgetExceeded` gives failed |
| Budget `max_tokens` | 20000 | `estimate_tokens` is len / 4 |
| `review` threshold | 0.6 | Overlap needed to keep a sentence |
| `citation_precision` threshold | 0.8 | Stricter than the critic |
| `max_facets` | 4 | Overview, how, risks, when |
| `max_sentences` | 3 | Per section |
| Reference score | 87.5 | Six public questions, out of 100 |

## Failures and fixes
type: troubleshooting
from: phases/19-capstone-projects/50-hypothesis-generator/code/main.py, phases/19-capstone-projects/50-hypothesis-generator/docs/en.md, phases/19-capstone-projects/52-experiment-runner/docs/en.md, phases/19-capstone-projects/53-result-evaluator/docs/en.md, phases/19-capstone-projects/53-result-evaluator/code/main.py, phases/19-capstone-projects/05-autonomous-research-agent/code/main.py, projects/research-report-agent/solution/report_agent/critic.py, projects/research-report-agent/solution/report_agent/planner.py, projects/research-report-agent/README.md

| Symptom | Cause | Fix |
|---|---|---|
| Log shows `parse:no hypothesis block found` | Reply has no tagged block | Keep temperature at or below 1.2 |
| Every pass logs `duplicate` | Drafts share most nouns | Widen the seed prompt and run again |
| `terminal` is `crash` with metrics | Non-zero exit code | Fix the script. Partial runs count as failed |
| `PairingError` | Seeds differ between the lists | Rerun both arms on the same seeds |
| Verdict `noise` with a big gain | Fewer than 2 pairs, no p value | Run more seeds |
| Node fails `loss_diverged` | Loss above 4.0 | Drop that branch. Expand others |
| Sentence dropped: names or numbers not in source | Swapped name or changed number | Keep writing extractive |
| Plan `source` is `rules-fallback` | Bad model JSON or cassette miss | Read the plan note. Rerecord the cassette |

## Questions
type: qa
from: phases/19-capstone-projects/50-hypothesis-generator/docs/en.md, phases/19-capstone-projects/51-literature-retrieval/docs/en.md, phases/19-capstone-projects/52-experiment-runner/docs/en.md, phases/19-capstone-projects/53-result-evaluator/docs/en.md, projects/research-report-agent/stages/05-verify-every-claim/docs/en.md

- **Why ramp the temperature?** Later drafts wander. Below 0.2 the model parrots the seed.
- **Why walk the citation graph?** It finds papers that use other words than the query.
- **Why only two hops?** Three hops blows up the result and drifts off topic.
- **Why a subprocess?** Untrusted code must not crash the orchestrator.
- **Why one knob at a time?** Full factorial sweeps grow exponentially.
- **Why a paired test?** Each seed gives a difference. Noise floor is their standard error.
- **Is needs_review a failure?** No. It tells a human exactly where to look.
