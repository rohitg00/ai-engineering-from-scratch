# Why an RL framework owns an inference engine

> RL needs fast generation and exact probabilities from the same weights, and an engine under the trainer's control gives both.

Reinforcement learning on a language model spends most of its time generating text. A training library can generate, but slowly: one sequence at a time, with no shared cache. An inference engine generates fast, but it was built to serve users, not to agree with a trainer.

When you finish this section, you can explain why Miles runs its own inference engine, and name the five ways the two sides can disagree.

Miles puts an SGLang engine under the trainer's control. This page explains why, and what that control has to cover. The Inside Miles guide walks one step from start to end, so this page stays with the reasons.

## What RL asks of the engine

A GRPO step generates many answers for each prompt. Our runs generated 8 answers for each of 32 prompts, 256 answers per step. Three things make that fast:

- **Batching.** The engine runs hundreds of sequences in one pass.
- **A shared prompt cache.** The 8 answers of one prompt share the same prompt, so the engine can compute it once and reuse it.
- **Short answers end early.** A finished answer leaves the batch, and its memory goes to the next one.

A training library is not built for these. So an RL framework that cares about speed needs a real engine.

## What the engine must do for RL

A serving engine never changes its weights while it runs. An RL engine must:

- Take new weights after every training step, in seconds.
- Give its memory back while the trainer runs on the same GPU, and take it back after.
- Pause or stop the requests that are still running when the weights change.
- Return the log probability of every token it sampled.

Each of these needs a hook into the engine. That is why Miles runs a patched SGLang build, and why the SGLang inside the image is not a stock release.

## Five ways the two sides disagree

GRPO assumes that the trainer and the engine agree on the probability of each sampled token. They can disagree in five ways:

| Source | What happens | What Miles offers |
|---|---|---|
| Tokens | text turns into tokens in a different way on each side, often between agent turns | the session server, which passes tokens and not text |
| Routing | a MoE router picks different experts on each side | routing replay |
| Sampling | with top-p or top-k, the engine samples from a cut-down set of tokens, and the trainer scores over the full vocabulary | sampling replay |
| Numbers | different kernels add in a different order, or one side uses lower precision | importance-sampling corrections, true on-policy mode |
| Staleness | a sample came from older weights than the trainer now holds | limits on sample age, and corrections |

Most of our runs on one GB10 had only the numbers source. One run sampled with top-p and top-k, so it also had the sampling source. In our Qwen3-0.6B runs, the gap stayed at 0.013 to 0.016 per token. [Section 8.2](#s-the-correction-methods) matches each correction to its source.

Our view: most of what makes an RL framework hard is not the loss function. It is keeping these five sources small and measured while the engine runs at full speed.

```takeaways
- RL needs a real inference engine for speed, and the engine needs RL hooks for weights, memory, and probabilities.
- The trainer and the engine disagree through tokens, routing, sampling, numbers, and staleness.
- Measure the gap first, then pick the correction that matches its source.
```

Sources: Miles architecture documentation, inference controller, and session server at main 08752a12; capture/gpu/summary/miles-gb10-lab.json; capture/gpu/miles_grpo.py.
