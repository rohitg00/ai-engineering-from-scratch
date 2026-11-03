---
id: classifier-head-swap-choice
title: A spam classifier from 800 messages and a pretrained body
card: system-design
kind: tradeoff
level: 2
roles: [applied-ai-engineer, ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, ml-breadth]
tags: [fine-tuning, head-swap, frozen-body, precision-recall]
minutes: 12
lessons: [phases/19-capstone-projects/38-classifier-finetuning]
manuals: []
practice: []
cheatsheet: [lora-fine-tuning, ml-evaluation-metrics]
related: [system-design/finetune-pipeline-design, system-design/when-not-ml]
updated: 2026-11-03
---

You have a small pretrained language model and 800 labeled text messages, half spam and half not. Design the classifier: what you keep, what you replace, which of two training regimes you choose, how you split and evaluate, and when the other regime would win.

## Short answer

Keep the pretrained body and replace the vocabulary head with a linear layer to two classes over a mean-pooled, mask-weighted sequence vector. With 800 examples, train the head only with the body frozen: it is fast, light on memory and rarely overfits, and on this fixture it reaches about 0.9 precision and 0.85 recall after twenty epochs. Full fine-tuning takes about three times longer and lands within a couple of points either way; it starts to pay off at the scale of 80,000 examples or when the domain drifts far from the pretraining text.

## Full answer

### What to keep and replace

The body already encodes word identity, position and co-occurrence. Training a fresh classifier from scratch on 800 examples throws that away. The head is the wrong part: it projects to the vocabulary. Replace it with one linear layer from the hidden width to two logits over a pooled vector, and train with cross-entropy against the label.

### Pooling

A classifier needs one vector per message. Mean pooling weighted by the attention mask is the simplest stable choice across lengths and needs no special token. The alternatives are a leading class token, which the body would have to be pretrained with, and the last non-padding token, which decoder-style classifiers use.

### Two regimes, one loop

| Regime | Trainable set | Cost | Risk |
|---|---|---|---|
| Head only | The linear head | Fast, almost free in memory | Underfits when the domain is far from pretraining |
| Full fine-tuning | Head and body | About three times longer | Overfits and forgets on small data |

Both run through the same training function; the toggle flips `requires_grad` on the body parameters, so the optimizer sees only the head in the first regime.

### Data and evaluation

Split 80/20, stratified so the test set keeps the 50/50 balance: 640 train, 160 test. Report precision, recall and F1 for the spam class with the confusion matrix, so the numbers can be read as honest estimates. The fixture is balanced and generated, so real data will be noisier.

### The decision

On 800 examples and a tiny body, head only is the right call. On 80,000 examples and a bigger body, full fine-tuning starts to win. A middle path unfreezes only the last block, which costs less than full tuning and learns more than the head alone. The contract is the API, not the winner: one training function, one toggle.

## Follow-ups

- **Level 2:** Why does the frozen body rarely overfit here? Expected: only the head's few parameters move, so the model cannot memorize 640 examples through the body.
- **Level 2:** Why stratify the split? Expected: so the test set keeps the class balance and precision and recall mean what they say.
- **Level 3:** Precision matters more than recall for this product. What changes in the design? Expected: the decision threshold on the spam logit, chosen on a validation split held out from the 640 training messages to trade recall for precision, so the 160 test messages stay untouched for the final numbers; the training regime stays the same.
- **Level 3:** The messages are in a domain the body never saw. Which regime and why? Expected: full or partial fine-tuning, because the frozen features do not carry the domain and the head alone underfits.

## Wrong answers

- "Train a small classifier from scratch; the model is tiny anyway." That wastes the pretraining and 800 examples are too few to learn the language from zero.
- "Always fine-tune everything for the best accuracy." On small data full tuning overfits and forgets, for a result within a couple of points of the head alone at three times the cost.
- "Use the last token's hidden state without a mask." Padded sequences then pool a padding position; the mask must select the last real token or weight the mean.

## Taught in

The [classifier fine-tuning lesson](../../../phases/19-capstone-projects/38-classifier-finetuning/) builds both regimes on the 800-message fixture and compares their precision, recall and cost.
