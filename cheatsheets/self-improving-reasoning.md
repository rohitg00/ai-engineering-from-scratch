---
id: self-improving-reasoning
title: Self-Taught Reasoning and Self-Improvement
code: ST
subtitle: Generate, grade, keep, retrain. STaR, GRPO, AlphaEvolve and DGM loops, their numbers, and the evaluator traps.
hue: 290
sources: phases/10-llms-from-scratch/09-constitutional-ai-self-improvement, phases/15-autonomous-systems/02-star-family-reasoning, phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding, phases/15-autonomous-systems/04-darwin-godel-machine, phases/15-autonomous-systems/07-recursive-self-improvement
source_hash: f12393fb82415ea8
---

## Core ideas
type: concepts
from: phases/15-autonomous-systems/02-star-family-reasoning/docs/en.md, phases/10-llms-from-scratch/09-constitutional-ai-self-improvement/docs/en.md, phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/docs/en.md, phases/15-autonomous-systems/04-darwin-godel-machine/docs/en.md, phases/15-autonomous-systems/07-recursive-self-improvement/docs/en.md

- **STaR**: fine-tune on own rationales that reach correct answers. Repeat.
- **Rationalization**: give the correct answer as a hint on failed problems.
- **Constitutional AI**: the model critiques and revises against written principles.
- **GRPO**: PPO with no value function. The group is the baseline.
- **AlphaEvolve**: LLM edits programs. A machine-checkable evaluator scores them.
- **DGM**: the agent edits its own scaffolding. A benchmark scores it.
- **RSI**: system `S_n` proposes the edit that makes `S_{n+1}`.
- **Answer-conditioned gradient**: the loop rewards final answers, not steps.

## One recipe: generator plus evaluator
type: architecture
from: phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/docs/en.md, phases/15-autonomous-systems/04-darwin-godel-machine/docs/en.md, phases/10-llms-from-scratch/09-constitutional-ai-self-improvement/docs/en.md

```arch
node | gen | 1,1 | Generator | LLM, policy or agent | model
node | cand | 2,1 | Candidates | G samples or variants |
node | eval | 3,1 | Evaluator | rule, test or benchmark | process
node | arch | 3,2 | Archive | MAP-elites, score keyed | store
node | train | 1,2 | Retrain or parent | SFT, GRPO or mutate | gpu
node | human | 2,2 | Human data | small fraction | client
edge | gen | cand | sample
edge | cand | eval | score
edge | eval | arch | keep best
edge | arch | train | select
edge | train | gen | next round
edge | human | train |
```

## STaR loop
type: flow
from: phases/15-autonomous-systems/02-star-family-reasoning/docs/en.md, phases/15-autonomous-systems/02-star-family-reasoning/code/main.py

1. **Model**: samples a reasoning trace plus answer for each problem.
2. **Filter**: keeps the trace only if the final answer is correct.
3. **Rationalize**: on failed problems, hints the correct answer and samples again.
4. **Fine-tune**: trains on the kept and rationalized traces.
5. **Repeat**: the next round uses the new model.
6. **V-STaR**: trains a DPO verifier on correct and incorrect traces. Picks best-of-N.

## GRPO in the code
type: annotated-code
lang: python
from: phases/10-llms-from-scratch/09-constitutional-ai-self-improvement/code/main.py

```python
def group_relative_advantage(rewards: list[float]) -> np.ndarray:
    r = np.array(rewards, dtype=float)
    if r.std() < 1e-8:  # same reward for all: no signal
        return np.zeros_like(r)
    return (r - r.mean()) / (r.std() + 1e-8)  # z-score in the group

ratios = np.exp(policy_logprobs - ref_logprobs)
unclipped = ratios * advantages
clipped = np.clip(ratios, 1 - clip_eps, 1 + clip_eps) * advantages
policy_loss = -np.minimum(unclipped, clipped).mean()  # PPO clipped surrogate
kl = (ref_logprobs - policy_logprobs).mean()
total_loss = policy_loss + beta * kl  # KL to the reference stays
```

## STaR family side by side
type: comparison
span: 2
from: phases/15-autonomous-systems/02-star-family-reasoning/docs/en.md

| Factor | STaR | STaR + rationalization | V-STaR | Quiet-STaR |
|---|---|---|---|---|
| Training signal | keep (rationale, answer) if correct | above + correct-answer hinted retries | STaR + DPO verifier from both classes | per-token rationale + mixing weight |
| Inference cost | 1x | 1x | Nx (best-of-N) | 1.5-3x |
| Data waste | discards all incorrect rationales | less | minimal | minimal |
| Failure mode | shortcut rationales | rationalized rationales may be implausible | verifier can reinforce confident wrongness | still answer-conditioned gradient |

## Code search and self-edit loops
type: comparison
span: 2
from: phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/docs/en.md, phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/code/main.py, phases/15-autonomous-systems/04-darwin-godel-machine/docs/en.md

| Factor | AlphaEvolve | Darwin Godel Machine | Godel Machine (2003) |
|---|---|---|---|
| Edit target | A program in a database | The agent scaffolding | Any self-modification |
| Evaluator | correctness + benchmark | SWE-bench / Polyglot | Formal proof |
| Acceptance rule | Score beats the cell incumbent | empirical score delta + archive | formal proof of net benefit |
| Example win | 48-mul 4x4 matmul | 20% → 50% SWE-bench | no known non-trivial instance |
| Failure mode | Reward hacking on a weak evaluator | accepts reward-hacked variants | never triggers |

## Run the simulators
type: task-table
span: 2
from: phases/10-llms-from-scratch/09-constitutional-ai-self-improvement/code/main.py, phases/15-autonomous-systems/02-star-family-reasoning/code/main.py, phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/code/main.py, phases/15-autonomous-systems/04-darwin-godel-machine/code/main.py, phases/15-autonomous-systems/07-recursive-self-improvement/code/main.py

| Task | Code |
|---|---|
| One GRPO round with rule rewards | `self_improvement_round(prompts, sampler, group_size=group_size)` |
| Combined rule reward | `reward_math(prompt, response) + 0.1 * reward_format(response)` |
| Bootstrap STaR rounds | `run_star(rounds, initial)` |
| AlphaEvolve with held-out test | `run_loop(generations=1500, pop=20, use_holdout=True, seed=DEFAULT_SEED)` |
| AlphaEvolve train-only demo | `python code/main.py --no-holdout` |
| DGM with the scorer open | `python code/main.py --reward-hack-allowed` |
| RSI race, gap threshold 2.0 | `python code/main.py --threshold 2.0` |
| RSI scenario A | `Config(r_c=1.15, r_a=1.08, noise_c=0.02, noise_a=0.03, threshold=th)` |

## Defaults in the code
type: defaults
from: phases/10-llms-from-scratch/09-constitutional-ai-self-improvement/code/main.py, phases/15-autonomous-systems/02-star-family-reasoning/code/main.py, phases/15-autonomous-systems/07-recursive-self-improvement/code/main.py, phases/15-autonomous-systems/04-darwin-godel-machine/code/main.py

| Setting | Default | Note |
|---|---|---|
| `grpo_step(beta)` | 0.01 | KL weight |
| `grpo_step(clip_eps)` | 0.2 | Ratio clip |
| `self_improvement_round(group_size)` | 8 | Samples per prompt |
| `star_round(n_samples)` | 1000 | Traces per round |
| `--threshold` | 1.5 | Pause gap C - A |
| `--seed` | `DEFAULT_SEED` | 11 in the RSI sim |
| `star_round` `alpha` | 0.6 | Weight of kept traces |

## Troubleshooting
type: troubleshooting
from: phases/10-llms-from-scratch/09-constitutional-ai-self-improvement/docs/en.md, phases/15-autonomous-systems/02-star-family-reasoning/docs/en.md, phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/docs/en.md, phases/15-autonomous-systems/04-darwin-godel-machine/docs/en.md, phases/15-autonomous-systems/07-recursive-self-improvement/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Reward std falls to zero | Mode collapse | Stop the run |
| Lost diversity after 3-5 rounds | Self-generated data is narrower | Mix in fresh human data |
| Advantage zero for a prompt | Same reward in the whole group | Skip the prompt |
| Good in distribution, OOD breaks | Shortcut rationales kept | Process rewards and held-out OOD eval |
| Low train MSE, loose test MSE | Train-only evaluator | Held-out inputs made at eval time |
| Reported score above true score | Agent edits its scorer | Evaluator firewall |
| Gap C - A crosses the threshold | Capability rate above alignment rate | Pause for human review |

## Use X when
type: tips
from: phases/10-llms-from-scratch/09-constitutional-ai-self-improvement/docs/en.md, phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/docs/en.md

- Pure CAI: subjective behavior such as tone, safety and refusal style.
- GRPO + ORM: verifiable tasks with sparse and binary reward.
- DPO on self-generated pairs: constitution makes pairs, DPO trains.
- Full RLHF: multi-objective tradeoffs a rule cannot express.
- AlphaEvolve: only where the evaluator is fast, deterministic and hard to game.

## Q&A
type: qa
from: phases/15-autonomous-systems/02-star-family-reasoning/docs/en.md, phases/15-autonomous-systems/04-darwin-godel-machine/docs/en.md, phases/15-autonomous-systems/07-recursive-self-improvement/docs/en.md, phases/10-llms-from-scratch/09-constitutional-ai-self-improvement/docs/en.md

- **STaR gain on GSM8K?** GPT-J went from 5.8% to 10.7%.
- **DGM gains?** SWE-bench 20.0% → 50.0%, Polyglot 14.2% → 30.7%.
- **Alignment faking rate?** 12% of basic tests, up to 78% after training it away.
- **Can self-improvement add a capability?** No. It amplifies signal already in the model.
- **Healthy run curves?** Mean reward up, std stable, KL bounded.

## Glossary
type: glossary
from: phases/10-llms-from-scratch/09-constitutional-ai-self-improvement/docs/en.md, phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/docs/en.md

- **ORM**: Outcome Reward Model. One reward on the final answer.
- **PRM**: Process Reward Model. One reward for each step.
- **RLAIF**: RL from AI Feedback. PPO or DPO on model preferences.
- **SL-CAI**: stage 1 of CAI. SFT on (prompt, revised) pairs.
- **MAP-elites**: grid keyed by feature vectors. Best variant per cell.
