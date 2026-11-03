---
id: half-the-relus-are-dead
title: Two layers where most ReLU outputs are exactly zero
card: deep-learning
kind: debug
level: 3
roles: [applied-ai-engineer, inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [dead-relu, activation-functions, learning-rate, debugging]
minutes: 12
lessons: [phases/03-deep-learning-core/04-activation-functions, phases/03-deep-learning-core/13-debugging-neural-networks]
manuals: []
practice: []
cheatsheet: [nn-debugging]
related: [deep-learning/sigmoid-gradient-after-ten-layers, deep-learning/zero-init-symmetry]
updated: 2026-11-03
---

After a few hundred steps at a high learning rate, a ReLU network's loss stops falling. You log the activations after each ReLU, and in two layers more than half of them are exactly zero on every batch. Explain what happened to those units, why they cannot come back on their own, and what you change.

## Short answer

First confirm that the units are dead and not only sparse: over a large sample, a dead unit is zero on every input. A ReLU unit whose pre-activation is negative for every input outputs zero and has a derivative of zero, so it receives no gradient and its weights never move again. A large update, driven by the high learning rate, pushed those units' weights and biases far enough negative that no input brings them back. Lower the learning rate, re-initialize the dead units or the dead layers, and move to an activation with a gradient on the negative side, such as a leaky variant or GELU.

## Full answer

### What a dead unit is

ReLU is max(0, x). Its derivative is 1 for positive inputs and 0 otherwise. A unit whose input is negative on every sample outputs 0, passes 0 gradient to its weights, and nothing else in the loss touches those weights. It is dead for the rest of training. The activation lesson reports that 10 to 40 percent of units can die in a ReLU network in practice. The debugging lesson's threshold is more than half zeros after a ReLU layer: at that point switch the activation or reduce the learning rate.

### How the high learning rate did it

One oversized step moves a unit's bias or weights far negative. After that step every input lands below zero. The debugging lesson's demo builds the state directly by filling weights with -1.0 and biases with -5.0 and shows a flat loss with most activations at zero. A high learning rate reaches the same state by accident.

### Telling dead from sparse

Some zeros are normal; ReLU is meant to be sparse. Count, over a large sample, the fraction of inputs on which each unit is positive. Dead means zero on all of them. The activation lesson's detector reports dead, barely alive and healthy units from that count.

### What to change

1. Lower the learning rate, and add gradient clipping so one bad batch cannot produce the step again.
2. Re-initialize the incoming weights of the dead units with a Kaiming draw and continue; the rest of the network keeps its progress. This is the debugging lesson's dead neuron resurrector exercise.
3. Switch the activation. A leaky ReLU keeps a small slope on the negative side, so a unit can recover. GELU is smooth and avoids the failure entirely; the activation lesson prefers it over the leaky variant unless there is a specific reason.
4. Check initialization. A Kaiming draw keeps pre-activations centered at the start, so fewer units begin life negative.

## Follow-ups

- **Level 3:** Why does the unit stay dead rather than drift back? Expected: zero output gives zero gradient to its weights, and nothing else in the loss touches them.
- **Level 3:** How do you tell a dead unit from a sparsely active one? Expected: count the fraction of inputs on which it is positive over a large sample; dead is zero on all, sparse is positive on a small fraction.
- **Level 4:** What links the high learning rate to the death? Expected: one large step moves the bias or weights far negative so every input lands below zero; clipping and a smaller rate limit the step.
- **Level 4:** Can you revive the dead units without retraining from scratch? Expected: re-initialize their incoming weights with a Kaiming draw and continue; the rest of the network keeps its progress.

## Wrong answers

- "Half zeros is normal sparsity for ReLU." Some zeros are normal; a unit that is zero on every input is dead and contributes nothing, and the lesson flags a layer above half zeros.
- "Raise the learning rate so the units jump back." The gradient is zero regardless of the rate; no step reaches them.
- "Switch to sigmoid to avoid zeros." Sigmoid trades dead units for vanishing gradients through depth; a leaky variant or GELU keeps the benefits of ReLU.

## Taught in

The [activation functions lesson](../../../phases/03-deep-learning-core/04-activation-functions/) explains dead units and builds the detector, and the [debugging lesson](../../../phases/03-deep-learning-core/13-debugging-neural-networks/) reproduces the failure and sets the threshold.
