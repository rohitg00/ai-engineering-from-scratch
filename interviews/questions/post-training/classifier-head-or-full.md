---
id: classifier-head-or-full
title: Train the head only, or fine-tune the whole model
card: post-training
kind: tradeoff
level: 1
roles: [applied-ai-engineer, ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [screen, ml-breadth]
tags: [fine-tuning, classifier, frozen-body, precision-recall]
minutes: 8
lessons: [phases/19-capstone-projects/38-classifier-finetuning]
manuals: []
practice: []
cheatsheet: [llm-pipeline-capstone]
related: [post-training/lora-parameter-count]
updated: 2026-11-03
---

You have a small pretrained transformer and 800 labelled text messages, half of them spam. You need a binary classifier by tomorrow. Do you train only a new classification head, or do you update every weight? Defend the choice.

## Short answer

Swap the language-model head for a two-class linear layer and start with the body frozen. Head-only training is fast, costs almost no memory, and rarely overfits on this little data. Unfreeze the body only when the frozen run leaves accuracy on the table and the domain is far from the pretraining text.

## Full answer

### Two regimes, one loop

The body maps tokens to hidden states and stays as it is. The head maps a pooled hidden state to two logits and is new. Head-only training sets `requires_grad=False` on the body, so the optimizer sees only the head. Full fine-tuning lets the gradient flow through the whole stack, and the body drifts toward the classification objective.

### What each one buys

On the fixture in the capstone lesson, head-only training reached a precision near 0.9 and a recall near 0.85 after twenty epochs. Full fine-tuning took about three times longer and landed within a couple of points either way, depending on the seed. With 800 examples the body has little to learn from the labels, and a lot to forget.

### Pooling

A classifier needs one vector per sequence. Mean pooling weighted by the attention mask is the simplest choice and gives a stable signal across lengths. A CLS token needs pretraining of that token. Last-token pooling is what decoder-style classifiers use.

### Read the numbers, not one accuracy

Report precision, recall, F1 and the confusion matrix on a held-out split with a known balance. The lesson splits 80/20 into 640 training and 160 test messages, stratified so that the test set keeps its balance.

### When the full update starts to pay

On 80,000 examples and a larger body, the body has enough signal to move without overfitting, and a domain shift can justify the cost. A middle path unfreezes only the last block.

## Follow-ups

- **Level 1:** What does `requires_grad=False` on the body do to the optimizer? Expected: the optimizer receives only the head parameters, so the body weights never change.
- **Level 2:** Why mean pooling and not the last hidden state? Expected: mean pooling with the mask is stable across lengths and needs no special token; last-token pooling suits decoder models that saw that pattern.
- **Level 2:** Why keep the test split stratified? Expected: a known class balance lets you read precision and recall as honest numbers.
- **Level 3:** The full update scores lower than the frozen run on this data. What happened? Expected: the body overfit the small set and lost pretrained structure; lower the body learning rate, unfreeze fewer blocks, or stay with the head.

## Wrong answers

- "Train a fresh classifier from scratch, the model is small anyway." The pretrained body already encodes word identity, position and co-occurrence; a new model from 800 examples throws that away.
- "Updating every weight is always more accurate, so do it." On 800 examples it lands within a couple of points of the frozen run and costs about three times the training time, with a real risk of overfitting.
- "Report accuracy, the classes are balanced." Precision and recall tell you which error you make, and the confusion matrix shows the counts behind the score.

## Taught in

The [classifier fine-tuning capstone](../../../phases/19-capstone-projects/38-classifier-finetuning/) builds both regimes on one training loop and reads precision, recall and F1 for each.
