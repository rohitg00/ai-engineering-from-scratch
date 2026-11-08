# Evidence: cheatsheets/research-agent-writing.md

Abbreviations: L54 = phases/19-capstone-projects/54-paper-writer, L55 = phases/19-capstone-projects/55-critic-loop, L56 = phases/19-capstone-projects/56-iteration-scheduler, L57 = phases/19-capstone-projects/57-end-to-end-research-demo. d = docs/en.md, c = code/main.py.

## End-to-end research demo (architecture, 8 nodes, 8 edges)
- Seed hypotheses alpha, beta, gamma: L57/c:114-120
- IterationScheduler with UCB picker: L57/d:26, L56/d:44
- 3 parallel slots as asyncio tasks: L57/c:222-224, L56/d:74, 91
- Result bus, reward per branch, UCB stats back to scheduler: L57/d:28-30, L56/d:39-40
- paper.trigger to pick_best_branch, highest mean reward: L57/d:30-31, 88, L57/c:123-136
- CriticLoop on a MiniPaper, five scores: L57/d:92, L57/c:231-238
- mini_to_full_paper into PaperWriter, tex, bib, manifest: L57/d:98, L57/c:240-248
- DemoReport with stop_reason: L57/d:61-67, L57/c:94-101

## Run the lessons (command-table, 4 rows)
- 54 writes paper.tex, references.bib, manifest.json into a temp dir: L54/c:7, 233-235, 263-270
- 55 prints the loop result with trace: L55/c:8, 372-373, 120-128
- 56 prints stop_reason, paper_triggers, branches: L56/c:9, 352-360
- 57 prints best_branch, critic_status, paper_sections: L57/c:10, 270-281

## Calls in code (task-table, 8 rows)
- read_experiment_manifest(experiments, out_dir): L54/c:188, 279
- render_latex(paper): L54/c:125
- PaperWriter(prose=prose).write(paper, out_dir): L54/c:216-260, 305-306
- make_deterministic_critic_pair(): L55/c:353-354, 366
- CriticLoop(critic=..., reviser=..., max_rounds=6, target_score=8.0): L55/c:367, L57/c:232-237
- make_deterministic_runner(base_rewards, noise=0.04, delay_ms=2.0, seed=seed): L57/c:216-221
- await sched.run(seed): L56/c:158, 344
- pick_best_branch(sched_report), mini_to_full_paper(critic_result.paper, branch): L57/c:229, 240

## Declare the paper skeleton (annotated-code, 14 lines)
- Paper(title, authors=["Lab Bot"], abstract, sections, figures, bibliography): L54/c:63-70, 280-299
- Section(id="method", title="Method", cites=["jones2021"], figure_refs=[figs[0].id]): L54/c:287-288
- Labels sec:<id> and fig:<id>: L54/c:45-47, 58-60, L54/d:50
- BibEntry(key="jones2021", entry_type="article", fields=...): L54/c:296-297
- MockProseGenerator(outlines=...): L54/c:300-304
- PaperWriter(prose=prose), gates before any file: L54/c:305, 226-231, L54/d:93-100

## Run the UCB scheduler (annotated-code, 14 lines)
- Hypothesis(id="h-a-1", branch="branch-a"): L56/c:329-331
- make_deterministic_runner(base_rewards=..., seed=7, delay_ms=2.0): L56/c:335-338
- reward base + N(0, noise): L56/c:303
- IterationScheduler(runner, slots=3, max_experiments=20, paper_threshold=0.7, prune_floor=0.25, prune_after_runs=3, expander=deterministic_expander): L56/c:339-343
- deterministic_expander spawns two follow-ups: L56/c:319-325
- asyncio.run(sched.run(seed)) returns SchedulerReport: L56/c:344, 348-349
- report.to_dict() with stop_reason, paper_triggers: L56/c:91-99, 345

## Critic round and stop rules (flow, 7 steps)
1. Five dimensions 0 to 10: L55/c:18-24, 214-253, L55/d:32-36
2. One suggestion per dimension below 8.0: L55/c:256-297
3. All five >= target_score stops with target: L55/c:154-155, 174-184, L55/d:70
4. Mean gain within plateau_epsilon for 2 rounds gives plateau: L55/c:157-164, 193-199, L55/d:70
5. Reviser edits expand-body, add-method-section: L55/c:300-350
6. After max_rounds status stopped, reason budget: L55/c:203-211
7. Target wins over plateau wins over budget: L55/d:72

## Formulas and scores (concepts, 8 bullets)
- UCB1 mean + c sqrt(ln(total_runs) / runs): L56/d:64-66, L56/c:106-111
- Untried branch float("inf"): L56/c:107-108, L56/d:68
- Prune below prune_floor after prune_after_runs: L56/c:229-235, L56/d:70
- Paper trigger once per branch at paper_threshold: L56/c:221-227, L56/d:95
- Clarity min(10.0, 3.0 + avg_body / 50.0): L55/c:220
- Evidence min(10.0, 2.0 + 2.0 * fig_refs + 1.5 * cites): L55/c:231
- Novelty 9.0, 6.0, 3.0 by originality_tag: L55/c:222-227
- Demo originality high >= 0.8, medium >= 0.6: L57/c:139-144, L57/d:92

## Loop defaults (defaults, 8 rows)
- max_rounds 5, ValueError below 1: L55/c:138, 143-144
- target_score 8.0 on every dimension: L55/c:139, L55/d:70
- plateau_epsilon 0.1, plateau_window 2: L55/c:140-141
- slots 3: L56/c:120
- max_experiments 50, max_seconds 30.0: L56/c:121-122
- exploration_c sqrt(2): L56/c:123, L56/d:68
- paper_threshold 0.7, paper.trigger: L56/c:124, 225
- prune_floor 0.2, prune_after_runs 3: L56/c:125-126

## Errors and fixes (troubleshooting, 6 rows)
- cites unknown bibliography key: L54/c:93-98
- references unknown figure id: L54/c:99-103
- NoTriggerError when no branch crossed the paper threshold, writer not invoked: L57/c:128-129, L57/d:84
- Five rounds flat, verdict budget, critic bug: L55/d:120
- Pruned branch removed from the queue and skipped: L56/c:149-150, 234-235
- Trace kind error with repr(exc): L56/c:202-207

## Questions (qa, 4 bullets)
- Skeleton first, validate before prose: L54/d:26
- Critic reads the manifest, does not parse LaTeX: L54/d:89
- Greedy never explores, uniform never exploits: L56/d:26
- Demo adjusts sys.path to import earlier lessons: L57/d:41, L57/c:28-35
