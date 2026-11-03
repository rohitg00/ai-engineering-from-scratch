---
id: choose-the-draft-for-a-new-model
title: Bake in the draft, train it after, or borrow a small model
card: tokenization-decoding
kind: design
level: 4
roles: [inference-engineer, applied-ai-engineer]
rounds: [system-design, design-review]
tags: [speculative-decoding, multi-token-prediction, eagle, draft-model, acceptance-rate]
minutes: 15
lessons: [phases/10-llms-from-scratch/18-multi-token-prediction, phases/10-llms-from-scratch/15-speculative-decoding-eagle3, phases/17-infrastructure-and-production/05-eagle3-speculative-decoding, phases/19-capstone-projects/14-speculative-decoding-server]
manuals: []
practice: []
cheatsheet: [speculative-decoding]
related: [tokenization-decoding/mtp-sequential-vs-parallel, tokenization-decoding/hidden-state-drafts]
updated: 2026-11-03
---

You are about to pretrain a model that will later serve a large volume using speculative decoding. Three ways to get a draft are on the table: bake sequential multi-token modules into pretraining, train a hidden-state draft head after pretraining, or reuse a small model of the same family. Give the decision with its costs, and name the gate you measure before you ship the flag.

## Short answer

If I control pretraining and the hidden size is at least 4096, I bake in the sequential modules: about 10 percent slower training buys a denser supervision signal and a draft that accepts 80 percent or more at depth one. If the weights already exist, I train a post-hoc head on the verifier's features with about 60 to 200B tokens; it is backward compatible and reaches 0.88 to 0.92 acceptance on general chat. A same-family small model needs no training and sits around 0.55 to 0.70. Whatever I pick, the gate is measured acceptance on my own traffic mix at production concurrency, with the flag off below about 0.55 and the tail latency watched, not the mean.

## Full answer

### The three options

| Option | When trained | Works with existing weights | Draft parameters | Acceptance | Extra benefit |
|---|---|---|---|---|---|
| Sequential modules in pretraining | during pretraining | no | one block plus a projection per depth | 0.80 and above at depth one | denser training signal |
| Post-hoc head on verifier features | after pretraining | yes | one or two layers, trained on about 60 to 200B tokens | 0.88 to 0.92 on chat | none beyond speed |
| Same-family small model | none | yes | a whole small model | 0.55 to 0.70 | none, and it costs memory |

### The decision tree

1. **Do you own pretraining?** If yes and the model is large enough, the modules are the only option that improves the model and the serving at once; the report that introduced them measured about 1.8 times generation throughput from the draft alone. At a 1B scale the overhead hurts more than it helps.
2. **Do the weights already exist?** Then the post-hoc head. It is a light training job compared with the verifier, and it does not touch the verifier's outputs.
3. **No training budget at all?** The small model, as a prototype, knowing the acceptance ceiling is low and the second model takes memory.

### The gate

Speculation is opt-in on the production engine, and the production lesson's rule is that flipping the flag without measuring acceptance on real traffic is an anti-pattern. The plan:

1. Serve the target plain and record time to first token, inter-token latency and throughput at the target concurrency.
2. Enable the draft and rerun the same benchmark.
3. Read accepted draft tokens and proposed draft tokens per request from the engine and divide the first by the second to get acceptance.
4. Below about 0.55 at production concurrency, disable the flag or train a domain-specific head.
5. Confirm that the tail inter-token latency did not get worse, because a rejected draft costs a verify and a re-roll.

### Traffic mix

A head trained on general chat sits at 0.6 to 0.8 there and falls to 0.4 to 0.6 on code, medical or legal traffic. Weight the acceptance by traffic share before you decide, and measure each slice on its own; a blended number can hide a slice where speculation is net negative. The capstone's exercise asks exactly this for a 70 percent chat and 30 percent code mix with acceptances of 0.7 and 0.4.

### Operate it

Acceptance drifts when the target changes version and the draft does not, so alert on it per slice, and keep a draft-free or n-gram fallback for the slices where the head stops paying.

## Follow-ups

- **Level 3:** The traffic is 70 percent chat at 0.7 acceptance and 30 percent code at 0.4. How do you decide? Expected: weight by traffic share, then check each slice against the floor; code alone is below it, so route code to a plain decode or train a code head.
- **Level 4:** The target gets a new version next quarter. What happens to each option? Expected: the baked-in modules move with the model; the post-hoc head must be retrained against the new target; the small model drifts further; alert on acceptance per version.
- **Level 4:** What does a hidden-state head read in the current generation? Expected: features from several target layers, not only the last, which is part of why acceptance rose.
- **Level 4:** Where does the small-model option still win? Expected: a prototype with no training budget, or a CPU deployment where the engine ships only the plain draft path.

## Wrong answers

- "Always use the latest hidden-state draft; it is strictly best." It needs training against your target and its acceptance on domain traffic can fall to 0.4; the baked-in modules give you a draft and a better model if you own pretraining.
- "Bake the modules in later with a fine-tune." They are a pretraining choice; an existing dense model gets a post-hoc head instead.
- "Pick by the speedup on a public benchmark." Acceptance depends on your traffic; the gate is measured on your own mix at your concurrency.

## Taught in

The [multi-token prediction lesson](../../../phases/10-llms-from-scratch/18-multi-token-prediction/) and the [EAGLE-3 lesson](../../../phases/10-llms-from-scratch/15-speculative-decoding-eagle3/) give the two trained options and their costs, the [production EAGLE-3 lesson](../../../phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/) sets the measurement gate, and the [speculative decoding server capstone](../../../phases/19-capstone-projects/14-speculative-decoding-server/) covers drift and fallback.
