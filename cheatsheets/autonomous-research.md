---
id: autonomous-research
title: Self-Improving and Research Agents
code: SI
subtitle: Generator plus evaluator loops, self-editing agents, research loops, RSI gaps and the controls for each.
hue: 280
sources: phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding, phases/15-autonomous-systems/04-darwin-godel-machine, phases/15-autonomous-systems/05-ai-scientist-v2, phases/15-autonomous-systems/06-automated-alignment-research, phases/15-autonomous-systems/07-recursive-self-improvement, phases/19-capstone-projects/05-autonomous-research-agent
source_hash: e7c7931b49e48d32
---

## The generator plus evaluator loop
type: flow
from: phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/docs/en.md

1. **Seed**: start from a seed program `P_0`. It is correct but suboptimal.
2. **Database**: keep variant programs. The evaluator scores each one.
3. **Sampler**: pick parents from a MAP-elites grid or from islands.
4. **LLM**: propose a targeted edit. The prompt holds top variants and the evaluator signature.
5. **Evaluator**: compile, run and score the variant on held-out inputs.
6. **Database**: insert the variant by its score and feature vector.
7. **Loop**: repeat for hours to weeks.

## Four systems side by side
type: comparison
span: 2
from: phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/docs/en.md, phases/15-autonomous-systems/04-darwin-godel-machine/docs/en.md, phases/15-autonomous-systems/05-ai-scientist-v2/docs/en.md, phases/15-autonomous-systems/06-automated-alignment-research/docs/en.md

| Factor | AlphaEvolve | DGM | AI Scientist v2 | AAR |
|---|---|---|---|---|
| Edit target | Algorithms, kernels, schedulers | Agent scaffolding | Research papers | Scoped alignment tasks |
| Evaluator | Correctness plus benchmark | SWE-bench or Polyglot | Peer review, weak | Human review |
| Result | 48-mul 4x4 matmul | SWE-bench 20% to 50% | ICLR 2025 workshop paper | Beat humans on weak-to-strong |
| Known failure | Bounded by evaluator rigor | Reward hacking | 42% experiment failures | Prescribed workflows degrade it |
| Main control | Held-out evaluator | Evaluator firewall | Docker isolation, human review | Out-of-sandbox forum log |

## Run the lesson simulators
type: command-table
from: phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/code/main.py, phases/15-autonomous-systems/04-darwin-godel-machine/code/main.py, phases/15-autonomous-systems/05-ai-scientist-v2/docs/en.md, phases/15-autonomous-systems/05-ai-scientist-v2/code/main.py, phases/15-autonomous-systems/06-automated-alignment-research/code/main.py, phases/15-autonomous-systems/07-recursive-self-improvement/code/main.py, phases/19-capstone-projects/05-autonomous-research-agent/code/main.py

| Command | What it does |
|---|---|
| `code/main.py` (L03) | Run A with holdout, then Run B without |
| `code/main.py --no-holdout` | Run B only. Train-only evaluator |
| `code/main.py --reward-hack-allowed` | Opens the score side channel |
| `--experiment-failure 0.20 --novelty-mislabel 0.10` | L05 baseline with lower failure rates |
| `code/main.py` (L06) | Fixed vs free regimes, tamper demo |
| `code/main.py --threshold 2.0` | L07 pause gap `C - A` at 2.0 |
| `--seed <n>` | RNG seed. L05 uses 42, L07 uses 11 |
| `python main.py` | Capstone tree search, budget $30 |

## Numbers to know
type: concepts
from: phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/docs/en.md, phases/15-autonomous-systems/04-darwin-godel-machine/docs/en.md, phases/15-autonomous-systems/05-ai-scientist-v2/docs/en.md, phases/15-autonomous-systems/07-recursive-self-improvement/docs/en.md, phases/19-capstone-projects/05-autonomous-research-agent/docs/en.md

- **AlphaEvolve matmul**: 48 scalar multiplications for 4x4 complex. Strassen 1969 used 49.
- **AlphaEvolve production**: Borg heuristic recovers ~0.7% of cluster compute.
- **DGM**: SWE-bench 20.0% to 50.0%. Polyglot 14.2% to 30.7%.
- **SWE-bench**: 2,294 Python test-fixing tasks from real GitHub issues.
- **AI Scientist v2**: 42% of experiments failed from coding errors.
- **Alignment faking**: 12% of basic tests. Up to 78% after retraining attempts.
- **Capstone budget**: $30 hard budget per paper. The demo run spent $28.40.
- **Reviewer gate**: 5 judges. Mean below 4.0/5 goes back to the writer. Stop after 3 rewrites.

## Formulas in the code
type: concepts
from: phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/code/main.py, phases/15-autonomous-systems/04-darwin-godel-machine/code/main.py, phases/15-autonomous-systems/07-recursive-self-improvement/docs/en.md, phases/15-autonomous-systems/07-recursive-self-improvement/code/main.py

- **Misalignment gap**: $M(t) = C(t) - A(t)$. It grows when $r_c > r_a$.
- **One RSI cycle**: `c *= max(0.9, nc)` with `nc = cfg.r_c + random.gauss(0, cfg.noise_c)`.
- **Scenario A**: `r_c=1.15`, `r_a=1.08`. Scenario B sets both to 1.10.
- **Holdout signal**: `0.5 * (c.train_score + c.test_score)`. Without holdout, train only.
- **MAP-elites cell**: `min(depth(e), 6)` and `min(int(max_const(e) / 2), 4)`.
- **DGM side channel**: `min(1.0, base + agent.hack_bonus)` when the hack is allowed.

## Capstone research agent
type: architecture
from: phases/19-capstone-projects/05-autonomous-research-agent/docs/en.md

```arch
node | seed | 1,1 | Seed idea | plus domain | client
node | lit | 2,1 | Literature search | 50 papers, FAISS cache | store
node | tree | 3,1 | Tree search | plan, execute, verify | process
node | box | 4,1 | Sandbox per node | no network egress | process
node | score | 4,2 | Score nodes | novelty, quality, budget | process
node | writer | 3,2 | LaTeX writer | best branch | model
node | vision | 2,2 | Vision critique | compiled PDF | model
node | review | 1,2 | Reviewer ensemble | 5 LLM judges | model
node | out | 1,3 | Outputs | paper.pdf, review, trace | store
edge | seed | lit |
edge | lit | tree |
edge | tree | box | run
edge | box | score | metrics
edge | score | writer | best branch
edge | writer | vision | PDF
edge | vision | review | draft
edge | review | out | mean 4.0+
```

## Best-first tree search
type: annotated-code
lang: python
from: phases/19-capstone-projects/05-autonomous-research-agent/code/main.py

```python
budget_weight = min(1.0, remaining_budget / 10.0)  # full weight above $10 left
return self.novelty * 0.4 + self.quality * 0.5 + budget_weight * 0.1
heapq.heappush(self.frontier, (-node.score(remaining), self.counter, node.node_id))
if tree.spent >= tree.budget:  # BUDGET EXHAUSTED, stop
run_experiment(cur, rng)  # sandboxed run, sets cost_usd
ok = verify(cur)  # loss above 4.0 is loss_diverged
children = expand(cur, next_id)  # one config change per child
best = max(done, key=lambda n: n.quality)  # then walk back to root
```

## Sandbox and run (capstone)
type: annotated-code
lang: bash
from: phases/19-capstone-projects/05-autonomous-research-agent/docs/en.md

```bash
docker run --network=none \  # no network egress
  --memory=8g --cpus=2 \  # pinned resource caps
  --pids-limit=256 \  # process cap
  --read-only  # read-only filesystem
ai-scientist run --seed "<seed idea>" --budget 30  # $30 per paper
```

## Tamper-evident forum (L06)
type: annotated-code
lang: python
from: phases/15-autonomous-systems/06-automated-alignment-research/code/main.py

```python
rec.prev_hash = self.head()  # link to the last record
payload = (f"{rec.author}|{rec.task}|{rec.regime}|"
           f"{rec.result:.3f}|{rec.prev_hash}")
rec.my_hash = hashlib.sha256(payload.encode()).hexdigest()[:16]
bad = tampered.verify()  # indexes of edited records
```

## Troubleshooting
type: troubleshooting
from: phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/docs/en.md, phases/15-autonomous-systems/04-darwin-godel-machine/docs/en.md, phases/15-autonomous-systems/05-ai-scientist-v2/docs/en.md, phases/15-autonomous-systems/06-automated-alignment-research/docs/en.md, phases/15-autonomous-systems/06-automated-alignment-research/code/main.py, phases/15-autonomous-systems/07-recursive-self-improvement/code/main.py

| Symptom | Cause | Fix |
|---|---|---|
| Low train MSE, high test MSE | Train-only evaluator | Held-out inputs made at evaluation time |
| Reported score above true score | Agent can edit its scoring | Evaluator the agent cannot edit |
| Agent removes hallucination markers | Evaluator in the agent repository | Separate check the agent cannot edit |
| Pretty paper, broken experiment | Polish masks weakness | Evaluate the claims. Human review gate |
| Known method flagged as novel | Literature retrieval mislabels | Human review before submission |
| Agent rewrites its own score | Log inside the sandbox | Append-only forum outside the sandbox |
| `verify()` flags records | Chain breaks at the edited record | Cross-check the out-of-sandbox backup |
| Gap `C - A` reaches the threshold | Capability rate or surges beat alignment | PAUSE for human review |

## Glossary
type: glossary
from: phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/docs/en.md, phases/15-autonomous-systems/04-darwin-godel-machine/docs/en.md, phases/15-autonomous-systems/05-ai-scientist-v2/docs/en.md, phases/15-autonomous-systems/06-automated-alignment-research/docs/en.md, phases/15-autonomous-systems/07-recursive-self-improvement/docs/en.md

- **MAP-elites**: grid keyed by feature vectors. Each cell holds its best variant.
- **Island model**: independent populations that migrate periodically.
- **DGM**: Darwin Godel Machine. Archive plus empirical scores, no proof.
- **AAR**: Automated Alignment Researcher. A model run autonomously on alignment problems.
- **RSI**: recursive self-improvement. The system proposes edits to itself each cycle.
- **VLM critique**: a vision-language model reads figures and rewrites them.
- **Evaluator firewall**: the evaluator lives in a namespace the agent cannot edit.
- **Reward hacking**: the loop raises the score without the intended task.

## Q&A
type: qa
from: phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/docs/en.md, phases/15-autonomous-systems/04-darwin-godel-machine/docs/en.md, phases/15-autonomous-systems/06-automated-alignment-research/docs/en.md, phases/15-autonomous-systems/06-automated-alignment-research/code/main.py, phases/15-autonomous-systems/07-recursive-self-improvement/code/main.py

- **Why does AlphaEvolve win on matmul?** The evaluator is fast, deterministic and hard to game.
- **Why does DGM drop the proof?** Nobody completed one for a non-trivial agent. DGM uses score deltas.
- **Fixed workflow or free decomposition?** Free has higher upside. Fixed has lower variance and is easier to audit.
- **Does a higher alignment mean rate save you?** No. Scenario C crosses when capability surges.
- **Who commits AAR results?** Humans. AARs propose, humans commit.
