# STaR, V-STaR, Quiet-STaR — Self-Taught Reasoning

> The smallest possible self-improvement loop sits inside the rationale. A model generates a chain of thought, keeps the ones that land on correct answers, and fine-tunes on those. That is STaR. V-STaR adds a verifier so inference-time selection is better. Quiet-STaR pushes the rationale down to every token. All three work. None of them are magic — the loop preserves any shortcut that happened to reach the right answer.

**Type:** Learn
**Languages:** Python (stdlib, bootstrap-loop simulator)
**Prerequisites:** Phase 13 · 01-03 (Reasoning and CoT), Phase 15 · 01 (long-horizon framing)
**Time:** ~60 minutes

## The Problem

The straightforward way to teach a model to reason is to collect human-written reasoning traces. That is expensive, slow, and bounded by how much high-quality chain-of-thought humans are willing to write.

STaR (Self-Taught Reasoner, Zelikman et al., 2022) asks: what if the model writes its own rationales and grades them against known answers? The loop is:

1. Sample a reasoning trace plus answer.
2. If the final answer is correct, keep the trace.
3. Fine-tune on the kept traces.
4. Repeat.

It works. GSM8K and CommonsenseQA both improved without new human annotation. But the loop has a built-in bias: any rationale that produced the right answer is retained, regardless of whether the reasoning itself was sound. V-STaR (Hosseini et al., 2024) patches this with a learned verifier; Quiet-STaR (Zelikman et al., 2024) generalizes the idea to per-token internal rationales.

## The Concept

### STaR: bootstrap on what worked

Start from a base model with some weak reasoning ability. On each training problem, sample a rationale plus answer. If the answer matches the label, keep the (problem, rationale, answer) triple. Fine-tune the model on the kept set. Repeat.

One twist matters. If the model can never get a problem right, the loop cannot learn on it. STaR adds **rationalization**: for problems the model fails, inject the correct answer as a hint and re-prompt the model to produce a rationale that leads to it. Rationalized rationales are added to the training set.

Result in the original paper (Zelikman et al., 2022): a GPT-J base model improved on GSM8K from 5.8% to 10.7% through repeated STaR rounds with rationalization — about 5 percentage points absolute. On CommonsenseQA, STaR-trained GPT-J 6B reached 72.5%, comparable to a fine-tuned GPT-3 175B (~73%) — a roughly 30x larger model trained on hand-annotated rationales.

### V-STaR: train a verifier with DPO

STaR throws away incorrect rationales. Hosseini et al. (2024) observed those are also data: every pair of (rationale, "is this correct") can train a verifier. They use Direct Preference Optimization over both correct and incorrect solutions to build a ranker. At inference time, sample N rationales and pick the verifier's top choice.

Reported delta: +4 to +17 percentage points over prior self-improvement baselines on GSM8K and MATH, with most of the gain coming from using the verifier for inference-time selection rather than for additional generator fine-tuning.

### Quiet-STaR: per-token internal rationales

Zelikman et al. (2024) asked: what if the model learns to generate a short internal rationale at every token position, not just between problem and answer? Quiet-STaR trains a model to emit a hidden "thought" before each predicted token, then mixes the thought-aware prediction with the baseline prediction via a learned weight.

Result: Mistral 7B gained absolute zero-shot improvements on GSM8K from 5.9% to 10.9% and CommonsenseQA from 36.3% to 47.2% without task-specific fine-tuning. The model learned "when to think" — hard tokens get longer internal rationales; easy ones get almost none.

### Why all three share a safety concern

All three methods use the final answer as the gradient signal. A rationale that reaches the right answer via flawed reasoning — exploiting a shortcut, guessing, or using a non-generalizing pattern — gets positively reinforced. On in-distribution problems the shortcut works. On out-of-distribution problems it breaks silently.

V-STaR's verifier mitigates by learning to rank rationales, but the verifier is trained on the same label set. It can learn to prefer well-formatted wrong reasoning over honest uncertainty. The safer design is to combine STaR-style data with (a) process-supervised reward models (rewarding intermediate steps, not just answers) and (b) held-out OOD evaluation that breaks simple shortcuts.

### Comparison

| Method | Training signal | Inference cost | Data waste | Known failure mode |
|---|---|---|---|---|
| STaR | keep (rationale, answer) if correct | 1x | discards all incorrect rationales | shortcut rationales |
| STaR + rationalization | above + correct-answer hinted retries | 1x | less | rationalized rationales may be implausible |
| V-STaR | STaR + DPO verifier from both classes | Nx (best-of-N) | minimal | verifier can reinforce confident wrongness |
| Quiet-STaR | per-token rationale + mixing weight | 1.5-3x | minimal | still answer-conditioned gradient |

### Where this sits in the 2026 stack

STaR is old. But the pattern reappears everywhere in 2025-2026. RL on verifiable math problems (DeepSeek-R1, Kimi-k1.5, o1) is STaR's answer-conditioned gradient signal, scaled up. Process reward models (Lightman et al., 2023; OpenAI's "Let's verify step by step") are the process-supervised alternative. AlphaEvolve (Lesson 3) is STaR for code, with a program evaluator instead of a label. Darwin Godel Machine (Lesson 4) is STaR for the agent scaffolding itself.

Understanding STaR makes all of these click. It is the minimum-viable self-improvement loop.

## Use It

`code/main.py` runs a simulated STaR loop on a toy arithmetic task. You can watch:

- How accuracy climbs over bootstrap rounds.
- How shortcuts sneak in: the simulator includes a "lazy" rationale class that gets the right answer 40% of the time but generalizes badly. Watch whether STaR keeps them.
- How a verifier (V-STaR style) helps at inference but cannot fully prune shortcuts introduced during training.

## Ship It

`outputs/skill-star-loop-reviewer.md` helps you audit a proposed self-taught-reasoning pipeline before you train on it.

## Exercises

1. Run the simulator. Set the shortcut frequency to zero, then to 0.4. How much does final accuracy diverge between the two runs, even though both hit >90% on the training distribution?

2. Add a held-out OOD test to the simulator. Draw problems from a different distribution and evaluate the bootstrapped model on both in-distribution and OOD sets. Quantify the gap.

3. Read the Quiet-STaR paper (arXiv:2403.09629) Section 3. Explain the "end-of-thought" token and the mixing-weight head in three sentences each.

4. Compare STaR's keep-if-correct filter to a process-supervised alternative that rewards each rationale step independently. Identify the labelling cost difference and the plausible quality difference.

5. Design one evaluation that would catch shortcut rationales in a deployed model. It does not have to be perfect — it has to break the simplest shortcuts a STaR loop would reinforce.

## Key Terms

| Term | What people say | What it actually means |
|---|---|---|
| STaR | "Self-Taught Reasoner" | Fine-tune on model-generated rationales that land correct answers; repeat |
| Rationalization | "Hinted retry" | Inject the correct answer and re-prompt for a rationale on problems the base model fails |
| V-STaR | "Verifier STaR" | DPO-train a verifier on both correct and incorrect rationales, use it for inference-time selection |
| Quiet-STaR | "Per-token rationales" | Generate hidden thoughts at every token position; mix with baseline prediction |
| Answer-conditioned gradient | "Outcome-based signal" | The training loop rewards final answers, not reasoning steps |
| Process reward model | "Step-level verifier" | Reward model trained on per-step correctness, not outcome — contrasts with STaR |
| Shortcut rationale | "Right answer, wrong reasoning" | A rationale that reaches the label via a non-generalizing pattern; STaR keeps these |

## Further Reading

- [Zelikman et al. (2022). STaR: Bootstrapping Reasoning With Reasoning](https://arxiv.org/abs/2203.14465) — the original paper.
- [Hosseini et al. (2024). V-STaR: Training Verifiers for Self-Taught Reasoners](https://arxiv.org/abs/2402.06457) — adds a DPO verifier for inference-time selection.
- [Zelikman et al. (2024). Quiet-STaR: Language Models Can Teach Themselves to Think Before Speaking](https://arxiv.org/abs/2403.09629) — per-token internal rationales.
- [Lightman et al. (2023). Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) — process reward models, the alternative gradient signal.
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — RL on verifiable tasks, STaR scaled to frontier training.
