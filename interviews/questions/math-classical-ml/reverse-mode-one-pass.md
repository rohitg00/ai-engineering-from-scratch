---
id: reverse-mode-one-pass
title: Why backpropagation runs the chain rule in reverse
card: math-classical-ml
kind: concept
level: 2
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [ml-depth, screen]
tags: [autodiff, chain-rule, reverse-mode, backpropagation]
minutes: 8
lessons: [phases/01-math-foundations/05-chain-rule-and-autodiff]
manuals: []
practice: []
cheatsheet: [calculus-optimization]
related: [math-classical-ml/grad-accumulate-plus-equals]
updated: 2026-11-03
---

Automatic differentiation can push derivatives forward from the inputs or pull them backward from the output. Training frameworks pick the backward direction. Why, and in which situation would the forward direction be the better choice?

## Short answer

A network has millions of parameters and one scalar loss. Reverse mode seeds the output with a gradient of 1 and gets the gradient of every parameter in one backward sweep. Forward mode needs one sweep for each input variable, so it wins only when the inputs are few and the outputs are many.

## Full answer

### The two modes

Both modes apply the chain rule at every node of the computation graph. They differ in where the seed goes.

| Mode | Seed | Direction | Best when |
|---|---|---|---|
| Forward | the derivative of one input with respect to itself, set to 1 | input to output | few inputs, many outputs |
| Reverse | the derivative of the output with respect to itself, set to 1 | output to input | many inputs, few outputs |

Forward mode carries one derivative through the graph. To get the gradient of a loss with respect to a million weights, you would run it a million times. Reverse mode carries the gradient of the single loss back to every node, and each node multiplies by its local derivative and passes the result to its children.

### What reverse mode costs

The backward sweep visits each node once, so the time is proportional to one forward pass. The engine must order the nodes first. A topological sort guarantees that a node has received the gradient from every consumer before it passes gradient on. When a value feeds several operations, the contributions add.

### When forward mode is the right choice

Forward mode fits a function with one or two inputs and a large output, because one sweep gives the derivative of the whole output along one input direction. Dual numbers implement it with almost no code: a pair of value and derivative, with the rule that the square of the derivative part is zero, so the product rule falls out of the arithmetic.

## Follow-ups

- **Level 2:** Why does the backward sweep need a topological order? Expected: a node must receive the full gradient from every consumer before it passes gradient to its children.
- **Level 3:** How many forward-mode sweeps does a model with one million weights need for one gradient? Expected: one million, one per input variable, which is why nobody trains that way.
- **Level 3:** What is a dual number and how does it carry a derivative? Expected: a pair of a value and a derivative, where the derivative part squares to zero, so each arithmetic rule carries the derivative along.
- **Level 4:** Name a case in an ML system where you would pick forward mode. Expected: a function with one or two inputs and a large vector output, where one sweep gives the derivative of the whole output along one input direction.

## Wrong answers

- "Reverse mode is more accurate than forward mode." Both are exact up to floating point rounding. The difference is the cost, not the result.
- "Forward mode cannot handle a composition of functions." Both modes apply the chain rule through every link. Forward mode pushes the derivative from the input side.
- "Backpropagation is a different algorithm from reverse-mode autodiff." Backpropagation is reverse-mode autodiff applied to the network graph, with the loss as the single output.

## Taught in

The [chain rule and autodiff lesson](../../../phases/01-math-foundations/05-chain-rule-and-autodiff/) compares the two modes and builds a reverse-mode engine.
