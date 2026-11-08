---
id: sft-loss-mask
title: Why the SFT loss skips the instruction tokens
card: post-training
kind: concept
level: 1
roles: [applied-ai-engineer, ai-data-engineer]
rounds: [screen, ml-depth]
tags: [sft, loss-mask, instruction-tuning, chat-template]
minutes: 6
lessons: [phases/10-llms-from-scratch/06-instruction-tuning-sft, phases/19-capstone-projects/39-instruction-tuning-sft]
manuals: []
practice: []
cheatsheet: [llm-pipeline-capstone]
related: [post-training/sft-data-quality-wins, post-training/sft-learning-rate-gap]
updated: 2026-11-03
---

You fine-tune a base model so that it follows instructions. A teammate's training loop computes cross-entropy on every token of each sequence, the instruction tokens included. Is that a problem? What do you change, and why?

## Short answer

Yes. Count the loss only on the answer tokens. The user always provides the instruction at inference time, so a gradient on it teaches the model to write questions, not to answer them. Set the label of every instruction position, every padding position and the answer boundary token to the ignore index, so they add no loss and no gradient.

## Full answer

### What the mask does

Each SFT example is one sequence: the instruction, a boundary token, and the answer. The model still sees the whole sequence in the forward pass, so attention can read the instruction. The loss counts only the positions after the boundary. In PyTorch you copy `input_ids` into `labels` and overwrite the instruction, the boundary and the padding positions with `-100`, the default `ignore_index` of `cross_entropy`. Apply the shift by one position first, then the mask, so the mask lands on the right targets.

### Why it is not a polish

Two things go wrong without the mask. First, the model spends capacity on text that the user always provides. Second, the instruction positions usually outnumber the answer positions, so the answer loss is a small part of the gradient sum. The effective learning rate on the part you care about is lower than the one you set.

### Divide by the right count

Average the masked loss over the number of answer tokens, not over the sequence length. A long instruction would otherwise dilute the signal from a short answer.

### Several turns

With several assistant turns in one conversation, the mask is one for every assistant turn and zero for every user turn. Print the token column next to the label column for one example before you train.

## Follow-ups

- **Level 1:** Which positions get the ignore index? Expected: the instruction, the padding, and the boundary token itself; the model predicts what follows the boundary, not the boundary.
- **Level 2:** Why does the model still need the instruction in the forward pass? Expected: the answer is conditioned on it through attention; the mask removes its loss, not its context.
- **Level 2:** How do you check the mask before a long run? Expected: print the tokens next to the labels for one example and confirm that only answer positions carry real labels, after the shift.
- **Level 3:** A base model given a question keeps writing more questions. What does SFT change, and what does it not change? Expected: it teaches the conversation pattern, so the model answers after the response marker; it adds no facts, those come from pretraining.

## Wrong answers

- "The loss on the instruction is extra signal, so keep it." It trains the model to generate instructions, and it shrinks the share of the gradient that comes from the answer.
- "Divide the masked loss by the sequence length." A long instruction then dilutes the answer signal; divide by the number of answer tokens.
- "Keep the loss on the response marker, so the model learns to emit it." The marker is part of the prompt template; the prompt provides it, and the model predicts what follows it.

## Taught in

The [SFT lesson](../../../phases/10-llms-from-scratch/06-instruction-tuning-sft/) builds the loss mask in numpy, and the [capstone SFT lesson](../../../phases/19-capstone-projects/39-instruction-tuning-sft/) builds the collate function with the ignore index.
