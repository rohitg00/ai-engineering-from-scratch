---
id: elementwise-or-matmul
title: Two products in NumPy that print different numbers
card: math-classical-ml
kind: code-reading
level: 1
roles: [ai-data-engineer, applied-ai-engineer]
rounds: [screen, coding]
tags: [linear-algebra, matrix-multiply, element-wise, numpy]
minutes: 5
lessons: [phases/01-math-foundations/02-vectors-matrices-operations]
manuals: []
practice: []
cheatsheet: [linear-algebra]
related: [math-classical-ml/dense-layer-weight-shape]
updated: 2026-11-03
---

Read this code and say what each print shows. Then tell me which of the two operations a dense layer uses, and why.

```python
import numpy as np

A = np.array([[1, 2], [3, 4]])
B = np.array([[5, 6], [7, 8]])
print(A * B)
print(A @ B)
```

## Short answer

The star multiplies matching positions, so the first print shows 5, 12, 21 and 32. The at sign forms dot products of rows with columns, so the second print shows 19, 22, 43 and 50. A layer uses the at sign, because every output must sum over every input.

## Full answer

### Element-wise product

Both arrays have the same shape, so the star pairs each cell with the cell at the same position:

```text
1*5 = 5    2*6 = 12
3*7 = 21   4*8 = 32
```

The order of A and B does not change the result.

### Matrix product

The at sign calls the matmul method. Cell (i, j) of the result is the dot product of row i of A with column j of B:

```text
1*5 + 2*7 = 19    1*6 + 2*8 = 22
3*5 + 4*7 = 43    3*6 + 4*8 = 50
```

The order matters. B times A gives other numbers. The inner sizes must agree, and the result has the rows of A and the columns of B.

### Which one a layer uses

A dense layer computes an activation of W times x plus b. Each output mixes all inputs with its own row of weights, which is the dot product inside a matrix product. The element-wise product appears in other places in training, for example when the learning rate scales a gradient, or when a mask zeroes some values. NumPy runs the matrix product with tuned BLAS routines written in C and Fortran, which the lesson measures as about 100 times faster than a Python loop over the same numbers.

## Follow-ups

- **Level 1:** Does the order of A and B matter in each case? Expected: no for the element-wise product, yes for the matrix product.
- **Level 2:** Which of the two operations does a learning rate step use? Expected: a scalar times the gradient, which is an element-wise scale.
- **Level 2:** Why is the at sign so much faster than a loop in Python? Expected: it calls BLAS routines in C and Fortran. The lesson gives about 100 times.
- **Level 3:** Someone writes the star for the layer and the code runs without an error. How is that possible? Expected: the shapes happened to be equal, so the element-wise product ran and gave wrong values with no error.

## Wrong answers

- "Both print the same matrix, the star is another spelling of the at sign." The two operations follow different rules and give different numbers.
- "The at sign is the element-wise product and the star is the matrix product." The at sign calls matmul, which forms dot products of rows and columns. The star works on matching positions.
- "A dense layer multiplies each weight by its input, so it is element-wise." Each output also sums over all inputs. That sum is the dot product inside a matrix product.

## Taught in

The [vectors and matrices lesson](../../../phases/01-math-foundations/02-vectors-matrices-operations/) works both products by hand and then with NumPy.
