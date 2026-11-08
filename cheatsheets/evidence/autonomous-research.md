# Evidence: cheatsheets/autonomous-research.md

Abbreviations: P15 = phases/15-autonomous-systems, P19 = phases/19-capstone-projects. L03 = P15/03-alphaevolve-evolutionary-coding, L04 = P15/04-darwin-godel-machine, L05 = P15/05-ai-scientist-v2, L06 = P15/06-automated-alignment-research, L07 = P15/07-recursive-self-improvement, C05 = P19/05-autonomous-research-agent. d = docs/en.md, c = code/main.py.

## The generator plus evaluator loop (flow, 7 steps)
1. seed program P_0, correct but suboptimal: L03/d:24
2. database of variants, each scored by the evaluator: L03/d:25
3. sample parents, MAP-elites or island-based: L03/d:26
4. LLM proposes a modified variant, prompt holds top variants plus evaluator signature: L03/d:27, 32
5. compile, run, evaluate on held-out evaluator: L03/d:28
6. insert keyed by score and feature vector: L03/d:29
7. repeat, loop runs hours to weeks: L03/d:30, 14

## Four systems side by side (comparison, 5 rows)
- Edit target: AlphaEvolve algorithms, kernels, schedulers L03/d:67. DGM agent scaffolding L04/d:16, L05/d:61. AI Scientist v2 research papers L05/d:62. AAR well-scoped alignment tasks L06/d:43
- Evaluator: correctness + benchmark L03/d:67. SWE-bench or Polyglot L04/d:23, 34. peer review (weak) L05/d:62. humans review results L06/d:49
- Result: 48-mul 4x4 matmul L03/d:67. SWE-bench 20% to 50% L03/d:70, L04/d:14. ICLR 2025 workshop paper L05/d:16. AARs outperformed humans on weak-to-strong L06/d:25
- Known failure: bounded by evaluator rigor L05/d:60. reward hacking L05/d:61. 42% experiment failures L05/d:25, 40. prescribed workflows degrade performance L06/d:35
- Main control: held-out evaluator L03/d:55. evaluator firewall L04/d:106. Docker isolation and manual review L05/d:54. forum outside every sandbox L06/d:23

## Run the lesson simulators (command-table, 8)
- L03 runs Run A then Run B: L03/c:188-203
- --no-holdout skips Run A, train-only evaluator: L03/c:177-179, 188, 200
- --reward-hack-allowed: L04/c:142, L04/d:77
- --experiment-failure 0.20 --novelty-mislabel 0.10 override the baseline: L05/d:86, L05/c:155-158, 168-175
- L06 fixed vs free and tamper demo: L06/c:153-157
- --threshold 2.0 for C - A: L07/d:78, L07/c:88-89
- --seed defaults 42 and 11: L05/c:17, 159. L07/c:17, 90
- python main.py, budget $30: C05/c:9, 114, 182

## Numbers to know (concepts, 8)
- 48 scalar multiplications, Strassen 1969 bound 49: L03/d:3, 16
- Borg heuristic ~0.7% of cluster compute: L03/d:3
- SWE-bench 20.0% to 50.0%, Polyglot 14.2% to 30.7%: L04/d:14
- 2,294 Python test-fixing tasks from real GitHub issues: L04/d:34, 102
- 42% of experiments failed from coding errors: L05/d:40
- alignment faking 12% basic, up to 78% after retraining attempts: L07/d:3, 30
- $30 hard budget per paper, $28.40 spent: C05/d:70, 110
- 5 judges, mean < 4.0/5 returns to writer, hard stop after 3 rewrites: C05/d:90

## Formulas in the code (concepts, 6)
- M(t) = C(t) - A(t), grows when r_c > r_a: L07/d:42
- c *= max(0.9, nc), nc = cfg.r_c + random.gauss(0, cfg.noise_c): L07/c:34, 36
- Scenario A r_c=1.15 r_a=1.08, Scenario B 1.10 both: L07/c:103, 109
- signal 0.5 * (c.train_score + c.test_score) else train_score: L03/c:139-140
- cell key min(depth(e), 6) and min(int(max_const(e) / 2), 4): L03/c:117-120
- min(1.0, base + agent.hack_bonus) when hack allowed: L04/c:79-83

## Capstone research agent (architecture, 9 nodes, 8 edges)
- Seed idea + domain: C05/d:28
- Literature search, 50 papers, FAISS cache: C05/d:31, 80
- plan-execute-verify tree: C05/d:34
- per-node sandbox, no network egress: C05/d:37-41
- score nodes by novelty, quality, budget: C05/d:46
- best branch to LaTeX writer: C05/d:49
- compile + vision critique of PDF: C05/d:52, 144
- reviewer ensemble, 5 LLM judges: C05/d:55
- paper.pdf + review.md + trace.json: C05/d:58
- mean 4.0 gate: C05/d:90

## Best-first tree search (annotated-code, 8 lines)
- budget_weight = min(1.0, remaining_budget / 10.0): C05/c:37
- return self.novelty * 0.4 + self.quality * 0.5 + budget_weight * 0.1: C05/c:38
- heapq.heappush(self.frontier, (-node.score(remaining), self.counter, node.node_id)): C05/c:122
- if tree.spent >= tree.budget, BUDGET EXHAUSTED: C05/c:143-145
- run_experiment(cur, rng), sandboxed, sets cost_usd: C05/c:70-74, 82, 147
- ok = verify(cur), loss > 4.0 gives loss_diverged: C05/c:98-99, 149
- children = expand(cur, next_id), one config dimension per child: C05/c:46, 157
- best = max(done, key=lambda n: n.quality), walk back to root: C05/c:173-177

## Sandbox and run (capstone) (annotated-code, 5 lines)
- docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only: C05/d:84
- no network egress, resource caps: C05/d:23, 37-39
- ai-scientist run --seed ... --budget 30: C05/d:99
- $30 per paper: C05/d:70

## Tamper-evident forum (L06) (annotated-code, 5 lines)
- rec.prev_hash = self.head(): L06/c:38
- payload f-string: L06/c:39-40
- rec.my_hash = hashlib.sha256(payload.encode()).hexdigest()[:16]: L06/c:41
- bad = tampered.verify(), returns indexes of tampered records: L06/c:44-45, 140

## Troubleshooting (8)
- train-only evaluator overfits, held-out inputs generated at evaluation time: L03/d:55, 86, L03/c:200, 209
- reported above true, evaluator outside agent reach: L04/c:155-160, L04/d:51
- hallucination markers removed, separate check agent cannot edit: L04/d:49, 51
- polish masks weakness, evaluation must reach claims, human review gate: L05/d:42, 44, L05/c:198
- established concepts flagged as novel, manual review of every submission: L05/d:41, 54
- agents edit own logs, append-only out-of-sandbox forum: L06/d:23, 29, 89
- verify() flags, chain breaks at first edited record, out-of-sandbox backup: L06/c:140-144
- gap crosses threshold, PAUSE flag, pause-on-gap: L07/c:61, 136-137, L07/d:74

## Glossary (8)
- MAP-elites: L03/d:109
- Island model: L03/d:110
- DGM: L04/d:100
- AAR: L06/d:87
- RSI: L07/d:92
- VLM critique: L05/d:99, 101
- Evaluator firewall: L04/d:106
- Reward hacking: L03/d:112

## Q&A (5)
- evaluator fast, deterministic, hard to game: L03/d:36
- nobody completed a proof for a non-trivial agent, empirical score: L04/d:12, 14, 57
- free higher upside, fixed lower variance, free harder to audit: L06/c:156, L06/d:92
- Scenario C, higher alignment mean does not save you with surges: L07/c:135-136
- AARs propose, humans commit: L06/d:51
