# Evidence: cheatsheets/research-agent-pipeline.md

Abbreviations: L05 = phases/19-capstone-projects/05-autonomous-research-agent, L50 = phases/19-capstone-projects/50-hypothesis-generator, L51 = phases/19-capstone-projects/51-literature-retrieval, L52 = phases/19-capstone-projects/52-experiment-runner, L53 = phases/19-capstone-projects/53-result-evaluator, RRA = projects/research-report-agent, RA = RRA/solution/report_agent. d = docs/en.md, c = code/main.py.

## The research loop (architecture, 8 nodes, 7 edges)
- HypothesisGenerator, ranked queue: L50/d:104, 110, 116
- RetrievalClient, BM25 plus citation graph: L51/d:21, 63, 113
- ExperimentRunner, subprocess with timeout and memory cap: L52/d:12, 115
- Evaluator, paired t test: L53/d:19, 124
- Seed prompt and temperature ramp: L50/d:52-53
- Tree search scored by novelty, quality, budget: L05/d:19, 46
- LaTeX writer with vision critique: L05/d:21, 49-52
- Reviewer ensemble of 5 LLM judges: L05/d:55
- Queue head to retrieval, not settled to runner, result to evaluator, verdict back: L50/d:116, L53/d:130-143
- Best branch to writer: L05/d:49

## Run it (command-table, 8 rows)
- python3 code/main.py in lessons 50 to 53: L50/c:7, L51/c:7, L52/c:7, L53/c:8
- python main.py, budget $30: L05/c:9, 182
- docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only: L05/d:84
- run_report.py "<question>" --out out/ --code: RRA/README.md:15-17, 20-22
- --eval heldout/questions.json: RRA/solution/run_report.py:5, 28-32
- --model replay --cassette: RRA/solution/run_report.py:38-44, 64-67, RRA/README.md:80
- --corpus and --compare write changes.json: RRA/README.md:73-78, RRA/solution/run_report.py:73-80
- project_test.py --stage --path reruns earlier stages: RRA/README.md:40-44

## Loop calls in code (task-table, 8 rows)
- GeneratorConfig(n_passes=4, t_min=0.2, t_max=1.1): L50/c:300
- queue, logs = generator.run(...): L50/c:221, 302
- build_client(RetrievalConfig(top_k_lexical=5, max_hops=2)): L51/c:400-402, 406
- client.search(query): L51/c:311, 407
- ExperimentRunner().run(spec): L52/c:182, 317-318
- AblationRunner(runner).sweep(base, "k", [4, 8, 16, 32]): L52/c:291-301, 319
- MetricSpec(name="perplexity", direction=LOWER, scale=LOG): L53/c:320
- evaluator.evaluate(1, metric_spec, candidates, baselines): L53/c:232-238, 322

## Spec a sandboxed experiment (annotated-code, 14 lines)
- ExperimentSpec fields and demo values demo_base, 1, k 16, steps 4, sleep_s 0.0, seed 7, 15.0, 256, metric_keys: L52/c:30-38, 307-316
- Script prints a single json line: L52/d:37
- Seed forwarded as config["__seed"]: L52/c:186, L52/d:87
- wall_timeout_s hard, memory_cap_mb soft polled: L52/d:32-33, 62-64
- runner = ExperimentRunner(), base_result = runner.run(base): L52/c:317-318
- terminal ok, timeout, oom, crash: L52/d:102, L52/c:249-258
- base_result.to_dict() with metrics, peak_rss_mb, stderr_tail: L52/c:54-80, 321
- ablate spec_id f"{base.spec_id}_{knob}_{value}": L52/c:261-267

## Report agent run (flow, 7 steps)
1. index: BM25Index(documents), Rust owns ranking: RA/pipeline.py:33-35, RRA/README.md:11
2. plan: plan_research, max_facets=4: RA/pipeline.py:36-38, RA/planner.py:116
3. gather: gather_snippets, per_facet=3: RA/pipeline.py:42-43, RA/writer.py:42
4. write: write_report, [S1] markers: RA/pipeline.py:51-52, RA/citations.py:11
5. verify: review and apply_verdicts: RA/pipeline.py:56-59, RA/critic.py:96-154
6. state: decide_state completed, needs_review, failed: RA/pipeline.py:66, RA/critic.py:125-132
7. publish: write_outputs report.html, report.json, trace.json: RA/pipeline.py:78-82, RRA/README.md:20-22

## Scores and formulas (concepts, 8 bullets)
- Cosine distance 1 - dot(a, b): L50/d:74
- rank_score weights 0.4, 0.3, 0.3: L50/d:80-88
- final_score weights 0.5, 0.3, 0.2: L51/d:89-97
- graph_score 1, 0.6, 0.3: L51/d:95
- Node score 0.4 novelty + 0.5 quality + 0.1 budget weight: L05/c:36-38
- Improvement for lower_is_better: L53/d:38-43
- t_stat = mean / sqrt(variance / n), df = n - 1: L53/d:23-29
- Report score 100 x weighted means 0.4, 0.3, 0.3: RA/evaluate.py:15, 39-43

## Loop defaults (defaults, 8 rows)
- n_passes 6, t_min 0.2, t_max 1.2: L50/c:146-148
- novelty_threshold 0.25, reject below: L50/c:149, 236-238
- BM25 k1 1.5, b 0.75: L51/c:53
- top_k_lexical 10 seeds the graph: L51/c:208, 316-318
- max_hops 2, clamped in __post_init__: L51/c:209, 214-216
- wall_timeout_s 30.0, memory_cap_mb 512: L52/c:36-37
- improvement_threshold 0.02 gives noise below: L53/c:222, 289-293
- significance_threshold 0.05 gives noise above: L53/c:223, 296-300

## Report agent defaults (defaults, 8 rows)
- --model default rules, choices replay and live: RRA/solution/run_report.py:38-43
- Budget max_steps 50, BudgetExceeded: RA/critic.py:33, 40-41, RA/critic.py:126-127
- Budget max_tokens 20000, estimate_tokens len // 4: RA/critic.py:33, 56-57
- review threshold 0.6: RA/critic.py:96, 114
- citation_precision threshold 0.8: RA/evaluate.py:46
- max_facets 4, four facet templates: RA/planner.py:19-32, 116
- max_sentences 3 per section: RA/writer.py:81, 85
- Reference score 87.5 / 100 on six public questions: RRA/README.md:68

## Failures and fixes (troubleshooting, 8 rows)
- parse:no hypothesis block found, above 1.2 fails the parser: L50/c:89, 232, L50/d:70
- duplicate, drafts that share most nouns, widen the seed prompt: L50/c:237, L50/d:76, 106
- crash on non-zero exit even with metrics: L52/d:72
- PairingError when seeds do not match, re run: L53/d:90
- noise when p_value is None (n < 2): L53/d:103, 115, L53/c:294-295
- loss_diverged above 4.0: L05/c:95-100
- names or numbers not in source, extractive writing: RA/critic.py:79-81, RRA/README.md:80
- rules-fallback on bad model JSON or CassetteMiss (KeyError): RA/planner.py:128-134, RA/model.py:16, 41-42

## Questions (qa, 7 bullets)
- Temperature ramp, below 0.2 parrots the seed: L50/d:21, 70
- Citation graph finds other vocabulary: L51/d:19
- Three hops blows up the result: L51/d:83
- Subprocess isolation for untrusted code: L52/d:19
- One knob at a time, full factorial is exponential: L52/d:83
- Paired test, standard error is the noise floor: L53/d:19
- needs_review is not a failure: RRA/stages/05-verify-every-claim/docs/en.md:59
