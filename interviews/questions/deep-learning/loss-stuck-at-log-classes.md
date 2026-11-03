---
id: loss-stuck-at-log-classes
title: A loss that sits at 2.3 on a ten class problem
card: deep-learning
kind: debug
level: 3
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, ai-data-engineer]
rounds: [debugging, ml-depth]
tags: [debugging, cross-entropy, data-pipeline, overfit-one-batch]
minutes: 12
lessons: [phases/03-deep-learning-core/13-debugging-neural-networks, phases/03-deep-learning-core/05-loss-functions]
manuals: []
practice: []
cheatsheet: [nn-debugging]
related: [deep-learning/overfit-one-batch-first, deep-learning/mse-predicts-half-for-everything]
updated: 2026-11-03
---

A ten class classifier trains for many epochs, and the cross-entropy loss sits at about 2.3 the whole time, on training data and on validation data. Nothing crashes. What does that number tell you, and in which order do you debug?

## Short answer

Minus the natural log of one tenth is about 2.3, the loss of a model that gives every class the same probability, and the lesson's table reads a loss stuck there as a uniform prediction with no usable signal. The mean alone does not say why. Run the one batch overfit test first: a failure points at the loss, the backward pass, the optimizer hookup or misaligned labels, and a pass sends you to the data path to check that labels line up with inputs. Only then look at the learning rate, the gradients and the architecture.

## Full answer

### Reading the number

Categorical cross-entropy on a one-hot target is minus the log of the probability of the true class. A random guess among 10 classes gives each class probability 0.1 and a loss of minus log 0.1, about 2.3. The debugging lesson's master table has this row: a loss stuck at minus log of 1 over the class count means the model predicts a uniform distribution, and the first thing to check is the data pipeline and whether labels match inputs. A model with no usable signal settles on equal logits, because that is what minimizes the expected loss over a balanced label set.

### The order

1. **Overfit one batch.** Take 8 to 32 samples and train on them for a few hundred steps. The loss must go to near zero and the training accuracy to 100 percent. If it does not, the model or the loop is broken: a wrong loss, a broken backward pass, an optimizer not connected to the parameters, or inputs and labels out of step. The lesson's threshold for a pass is a final loss below 0.1.
2. **Look at the data.** Print 5 random samples with their labels. Check that the shuffle keeps each input paired with its label, that inputs are normalized to mean 0 and standard deviation 1, and that labels have the integer type the loss expects.
3. **Learning rate.** Try three values 10 times apart, such as 1e-2, 1e-3 and 1e-4. A rate that is far too low looks flat, but it would not sit exactly on the uniform value for many epochs.
4. **Gradients.** All zeros points at dead ReLUs or a detached graph.
5. **Architecture.** Only after the above: a model too small underfits, but it still beats a uniform guess on its own training data.

### How this differs from a slow start

A loss that starts near 2.3 and falls slowly is a learning rate or capacity question. A loss that holds at 2.3 for many epochs on the training set means no signal reaches the model at all.

## Follow-ups

- **Level 3:** Why uniform rather than some other wrong answer? Expected: with no usable signal, equal logits minimize the expected cross-entropy over a balanced label set, and that costs the log of the class count.
- **Level 3:** What does the overfit one batch test tell you here? Expected: whether the model and loop can learn at all; a healthy setup drives a small batch to near zero loss in a few hundred steps, and a failure means a broken loss, backward pass, optimizer hookup or misaligned labels.
- **Level 4:** The one batch test passes and full training still sits at 2.3. Where next? Expected: the full data path, such as a shuffle that breaks the pairing of inputs and labels, or unnormalized inputs, since the model can learn when given a consistent batch.
- **Level 4:** What distinguishes this symptom from a loss that starts at 2.3 and falls slowly? Expected: a slow fall is a learning rate or capacity question; a flat 2.3 for many epochs means no signal reaches the model.

## Wrong answers

- "Train longer, it is a slow start." A flat value at the uniform loss for many epochs means no signal, not a slow one.
- "Make the model bigger." Capacity is not the issue when the model cannot beat a uniform guess on its own training data.
- "Lower the learning rate." The rate changes how fast the loss moves, and here it does not move at all; check the data first.

## Taught in

The [debugging lesson](../../../phases/03-deep-learning-core/13-debugging-neural-networks/) gives the master table and the overfit one batch test, and the [loss functions lesson](../../../phases/03-deep-learning-core/05-loss-functions/) computes the uniform loss.
