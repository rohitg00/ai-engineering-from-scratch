---
id: overfit-one-batch-first
title: The 30 second check before a multi-day run
card: deep-learning
kind: design
level: 3
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, inference-engineer]
rounds: [design-review, debugging]
tags: [debugging, overfit-one-batch, training-loop, checklist]
minutes: 10
lessons: [phases/03-deep-learning-core/13-debugging-neural-networks]
manuals: []
practice: []
cheatsheet: [nn-debugging]
related: [deep-learning/loss-stuck-at-log-classes, deep-learning/missing-zero-grad]
updated: 2026-11-03
---

You are about to launch a multi-day training run on a new architecture with a new data pipeline. Design a check that runs in about 30 seconds and must pass before the run starts. List the classes of bugs it catches and the ones it does not.

## Short answer

Take one small batch of 8 to 32 samples and train on it alone for a few hundred steps. The loss must fall to near zero and the training accuracy must reach 100 percent. A pass shows that the loss function, the backward pass and the optimizer hookup work, and that the model can fit this batch, but not that each input has its correct label, because a model can memorize a wrong but consistent pairing as well. It says nothing about generalization, leakage or the full data loader, so it is the first gate and not the last.

## Full answer

### The test

The debugging lesson calls this the single most important technique in deep learning. Fix a batch, build a fresh model and optimizer, and loop: zero the gradients, forward, loss, backward, step. Print the loss and accuracy every 50 steps. The lesson's implementation runs 200 steps and treats a final loss above 0.1 as a failure.

### What a failure means

Any of these, and the lesson lists them:

- a loss function that does not match the output layer;
- a broken backward pass or a detached graph;
- an optimizer built before the model's parameters existed, so it updates nothing;
- inputs and labels out of step;
- an architecture too small to represent even this batch.

Each of these would also break the full run, and there it would show up hours later as a slow or flat loss with twenty possible causes. Here it shows up in seconds with five.

### What a pass does not prove

The test overfits by design, so it says nothing about generalization. A model can memorize any consistent labels, so a wrong pairing of inputs and labels inside the fixed batch also passes. It uses one batch, so a shuffle that unpairs inputs and labels across the full set, a normalization computed on the full dataset, duplicate rows across splits, or label noise can all survive it. The lesson's checklist continues after it: print the model summary and check the parameter count, run one forward pass on random data and check the output shape, train for 5 epochs and confirm the loss falls, check activation statistics for dead or exploding layers, check the gradient flow across layers, and print 5 random samples with their labels.

### Make it a gate

Run it at startup on a fixed batch, assert the final loss is below the threshold, and refuse to start the long run when it fails. Run it again whenever the architecture or the pipeline changes.

## Follow-ups

- **Level 3:** The loss on the one batch stalls well above the threshold. Name three suspects. Expected: a loss that does not match the output layer, an optimizer built before the model's parameters were created, or a model too small to fit the batch.
- **Level 3:** Why 8 to 32 samples? Expected: small enough that a correct model memorizes it in a few hundred steps, so a failure is unambiguous and the test stays fast.
- **Level 4:** The test passes and the full run later shows training accuracy at chance. What does the pass rule out, and what remains? Expected: the model and loop can learn, so what remains is the full data path: a shuffle that unpairs inputs and labels, or normalization computed differently for the full set.
- **Level 4:** How do you turn this into a gate in a training script? Expected: run it on a fixed batch at startup, assert the final loss is below the threshold, refuse to start the long run on a failure, and rerun it whenever the architecture or pipeline changes.

## Wrong answers

- "A passing test means the model will generalize." It proves the model can memorize one batch; generalization needs the validation curve.
- "Skip it, the full run shows problems soon enough." The run shows a symptom hours later and the symptom fits many causes; the test isolates the loop in seconds.
- "Use the whole training set for a few epochs instead." That is the full run; a small batch is what makes a failure unambiguous and fast.

## Taught in

The [debugging lesson](../../../phases/03-deep-learning-core/13-debugging-neural-networks/) implements the test, lists what it catches, and places it first in the pre-training checklist.
