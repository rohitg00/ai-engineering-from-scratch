---
id: grad-accumulate-plus-equals
title: Why autograd adds gradients instead of setting them
card: math-classical-ml
kind: code-reading
level: 2
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [coding, ml-depth]
tags: [autodiff, chain-rule, gradient-accumulation, gradient-checking]
minutes: 8
lessons: [phases/01-math-foundations/05-chain-rule-and-autodiff]
manuals: []
practice: [mlp-backprop]
cheatsheet: [calculus-optimization]
related: [math-classical-ml/reverse-mode-one-pass, math-classical-ml/gradient-check-step-size]
updated: 2026-11-03
---

This is the multiply operation of a small autograd engine.

```python
def __mul__(self, other):
    other = other if isinstance(other, Value) else Value(other)
    out = Value(self.data * other.data, (self, other), '*')
    def _backward():
        self.grad += other.data * out.grad
        other.grad += self.data * out.grad
    out._backward = _backward
    return out
```

A contributor replaces both `+=` with `=`, with the comment that a gradient should be set, not added. The XOR training loop still runs and the loss still falls. What did the change break, and how do you prove it in one small test?

## Short answer

A value that feeds two or more operations receives a gradient from each consumer, and the chain rule says those contributions add. With assignment, the last consumer to run overwrites the others, so every shared node gets a wrong gradient, including each weight that the summed loss uses once per sample. A numerical gradient check exposes the error in one call.

## Full answer

### What the chain rule says about shared nodes

When y depends on x through two paths, the derivative of y with respect to x is the sum of the derivatives along each path. In the engine, a node that is used twice has two closures that write to its `grad`. The topological order runs every consumer before the node passes its gradient to its own children, so both closures run, and the second must add to the first.

### Why the loop still ran

In the XOR loop the loss is the sum of four squared errors, one per sample, and every weight takes part in all four forward passes. With assignment, each weight keeps only the contribution of the sample that ran last. That is still a direction that often points downhill, so the loss moves. The gradient is wrong for every parameter even so.

### The one-line test

```python
x = Value(3.0)
y = x * x
y.backward()
```

Here `self` and `other` are the same object. The correct gradient of x squared at 3 is 6.0. The two closures each add 3.0, which gives 6.0. With assignment the result is 3.0. The lesson's `gradient_check` does the same job for any expression: it compares the engine with a centered finite difference and reports the difference, which must be far below 1e-5.

### The other side of the same rule

Because gradients add, the training loop must set every `grad` back to 0.0 before each backward call. The lesson does this with a loop over the parameters. A framework does the same with a zero_grad call. Both habits come from the same fact: gradient storage is an accumulator.

## Follow-ups

- **Level 2:** Why must the training loop set every gradient to zero before backward? Expected: gradients accumulate, so a second backward would stack onto the first; the loop sets each parameter's grad to 0.0.
- **Level 3:** Write the smallest expression that fails with assignment. Expected: a value multiplied by itself; the gradient at 3 must be 6.0, and assignment gives 3.0.
- **Level 3:** Why does the topological order matter for this bug? Expected: all consumers of a node must run before the node passes gradient on; with assignment the answer depends on which consumer ran last.
- **Level 4:** Where does the same accumulation rule show up in a framework you use? Expected: a tensor's grad accumulates across uses and across backward calls, which is why the optimizer's zero_grad runs before each step.

## Wrong answers

- "Assignment is fine because each node has one parent." A node that feeds two operations has two consumers in the graph, and a weight in a summed loss has one consumer per sample.
- "The loss still goes down, so the gradients are correct." A wrong gradient can still point partly downhill. Only a numerical check proves it.
- "Use a running average instead of a sum." The chain rule sums the path contributions. An average divides the true gradient by the number of consumers.

## Taught in

The [chain rule and autodiff lesson](../../../phases/01-math-foundations/05-chain-rule-and-autodiff/) builds the Value class and the gradient check that catches this bug.
