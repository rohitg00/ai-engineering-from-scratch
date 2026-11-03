---
id: preference-loss-picker
title: Pick a preference loss for four kinds of data
card: post-training
kind: design
level: 3
roles: [applied-ai-engineer, ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, ml-depth]
tags: [dpo, kto, simpo, orpo, ipo, preference-data]
minutes: 15
lessons: [phases/18-ethics-safety-alignment/03-direct-preference-optimization-family, phases/10-llms-from-scratch/08-dpo]
manuals: []
practice: [dpo-loss]
cheatsheet: [alignment-training, rlhf-dpo]
related: [post-training/dpo-chosen-logprob-falls]
updated: 2026-11-03
---

Four teams bring you four datasets. One has thumbs-up and thumbs-down clicks on single answers. One has paired comparisons whose preferred answers are mostly twice the length of the rejected ones. One has no SFT checkpoint and wants a single training stage from the base model. One has pairs where some preferences are near coin flips and others are unanimous. Which preference loss do you recommend to each team, and why?

## Short answer

The clicks team gets the prospect-theory loss that works on single labels. The length-skewed team gets the reference-free loss that normalizes by length and adds a margin, so a longer winner does not win by its token count. The team without an SFT stage gets the odds-ratio loss, which adds a preference term to the SFT likelihood and trains from the base in one pass; the team with mixed preference strengths gets the identity-mapping loss, whose margin is bounded. Each one repairs one assumption that plain DPO makes.

## Full answer

### Start from what DPO assumes

The DPO derivation assumes paired data, an SFT reference that is the true anchor, in-distribution pairs, and a preference that maps to an unbounded log-odds. Each member of the family drops or repairs one of these.

| Data or constraint | Loss | What it changes |
|---|---|---|
| Single answers with good or bad labels | KTO | prospect-theory utility on one label; losses weigh more than gains; no pairs needed |
| Winners much longer than losers | SimPO | average log-probability per token plus a margin; no reference model |
| No SFT checkpoint, one stage | ORPO | SFT negative log-likelihood plus an odds-ratio preference term; the SFT term is the regularizer |
| Preference strength varies widely | IPO | squared error on a target of one over two beta; the gap is bounded |
| Chosen log-probability falls in the DPO logs | BPO | DPO plus a penalty on downward moves of the chosen answer |
| A large clean paired set | DPO | a conservative beta |

### The reasoning for each team

1. Clicks are plentiful and unpaired. Forcing them into pairs throws away most of the data; the unpaired loss uses every label.
2. In plain DPO a long winner has a more negative log-probability by construction, so the gap grows for the wrong reason and the policy learns length. Normalizing by length removes the incentive. Without a reference, drift needs a guard of its own.
3. The single-stage loss trains the base model to follow instructions and to prefer the chosen answer at once; the likelihood term keeps it anchored where DPO used the reference.
4. In DPO a near coin-flip pair and a unanimous pair both push toward an unbounded gap. The bounded loss keeps the gap proportional to the preference strength.

### What every team keeps

A held-out eval with generation, early stopping, and a check on the absolute chosen log-probability. None of these losses escapes over-optimization; they move where it bites.

### How to decide in practice

Run the candidates on one battery and pick per task. The lesson's point is that the best loss for math reasoning has no reason to be the best loss for safety.

## Follow-ups

- **Level 3:** The clicks team also has a small paired set. Combine them? Expected: yes; train with the unpaired loss on the clicks and validate on the pairs, or weight the two losses; the pairs are the cleaner signal for the eval.
- **Level 3:** Why does removing the reference save memory, and what does it cost? Expected: one model in memory instead of two; the cost is no anchor, so the policy can drift, and the margin term and early stopping carry that job.
- **Level 4:** A team runs DPO and watches the probability of its chosen answers drop while the margin grows. Which row applies, and why is it not a tuning problem? Expected: the chosen-preserving variant; the gradient of plain DPO cares only about the difference, so no beta fixes the direction.
- **Level 4:** How do you argue to a skeptic that these losses still over-optimize? Expected: the published curves of gold reward against KL for direct methods show the same peak and collapse as reward-model pipelines; the implicit reward queries out-of-distribution samples, and KL regularization does not stabilize it.

## Wrong answers

- "Convert the clicks into pairs by matching a good and a bad answer for the same prompt." It keeps only prompts with both labels and invents comparisons the raters never made; the unpaired loss uses the labels as they are.
- "Truncate the long winners so that the pairs are balanced." That destroys the answers people preferred; the fix is in the loss normalization, not in the data.
- "Use DPO everywhere and tune beta per team." Beta cannot create pairs, remove a reference, bound a gap or supply an SFT stage; each of those is a different loss.

## Taught in

The [DPO family lesson](../../../phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/) gives each loss and the failure mode it fixes, and the [DPO lesson](../../../phases/10-llms-from-scratch/08-dpo/) tabulates the models, pairs and reference that each method needs.
