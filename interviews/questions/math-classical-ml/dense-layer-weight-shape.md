---
id: dense-layer-weight-shape
title: Read a shape error in a dense layer
card: math-classical-ml
kind: concept
level: 1
roles: [ai-data-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [screen, ml-breadth]
tags: [linear-algebra, matrix-multiply, shapes, broadcasting]
minutes: 5
lessons: [phases/01-math-foundations/02-vectors-matrices-operations]
manuals: []
practice: []
cheatsheet: [linear-algebra]
related: [math-classical-ml/elementwise-or-matmul]
updated: 2026-11-03
---

A colleague builds a dense layer that takes 784 inputs and gives 128 outputs. The first forward pass stops with a shape error. Which dimensions does the weight matrix need, and how do you read an error like this one?

## Short answer

The matrix is 128 by 784: one row for each output and one column for each input. A matrix product needs the inner sizes to agree, so a 128 by 784 matrix times a 784 by 1 input gives a 128 by 1 output. An error means the inner sizes differ, and the fix starts with the shapes of every operand written on paper.

## Full answer

### The rule

A product of an m by n matrix and an n by p matrix gives an m by p matrix. The inner sizes, both n, must agree. For the layer in the question:

```text
(128 x 784) @ (784 x 1) = (128 x 1)
  weights       input       output
```

The rows of the weight matrix count the outputs. The columns count the inputs. Each output is the dot product of one weight row with the whole input vector.

### The bias

The bias holds one value for each output. Store it as a 128 by 1 column, as the lesson does, so that it adds to the 128 by 1 result element by element. A flat array of 128 values against a 128 by 1 column broadcasts to 128 by 128 with no error. When the layer runs on a batch, the bias has fewer dimensions than the output, and broadcasting repeats it across the batch. Broadcasting only stretches a dimension of size 1, so it never fixes a 784 against a 128.

### How to read the error

1. Write the shape of every operand next to the operation.
2. Find the operation whose inner sizes do not match. That is the broken line.
3. Decide which side is wrong. A transposed weight matrix, an input stored as a row instead of a column, and a missing batch dimension each give a different pair of numbers in the message.

The lesson makes the same check for a two layer network: the first matrix is 4 by 3 and the second is 2 by 4, so a 3 by 1 input gives a 4 by 1 hidden vector and a 2 by 1 output.

## Follow-ups

- **Level 1:** What shape does the bias have? Expected: one value for each output, so 128 values, stored as a 128 by 1 column so that it adds to each output column.
- **Level 2:** A batch of inputs arrives as rows instead of columns. What changes? Expected: the order of the product changes, so the batch matrix times the transposed weight gives one output row for each input.
- **Level 2:** Why does a transpose appear in the backward pass? Expected: the gradient for the input needs the weight matrix with its rows and columns swapped, so that the shapes agree in the reverse direction.
- **Level 3:** How does broadcasting hide a shape bug? Expected: a dimension of size 1 is stretched to fit, so a wrong shape can run without an error and give wrong values. An assertion on the shape catches it.

## Wrong answers

- "The weight matrix is 784 by 128 because inputs come first." With a column input the matrix needs 128 rows and 784 columns. The order of the product decides which form is right, not the order in which you name the sizes.
- "Shapes do not matter, the framework fixes them." Broadcasting repeats only a dimension of size 1. A 784 against a 128 inner size is an error, or a silent wrong result after a reshape.
- "Transpose things until the code runs." A transpose that makes the code run can multiply the wrong pairs of numbers. Write the shapes down first and then change the one that is wrong.

## Taught in

The [vectors and matrices lesson](../../../phases/01-math-foundations/02-vectors-matrices-operations/) gives the shape rule and builds a dense layer from a Matrix class.
