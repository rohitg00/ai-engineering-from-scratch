---
id: weight-matrix-rows-and-columns
title: Read the shapes of a 2-3-1 network from its Layer class
card: deep-learning
kind: code-reading
level: 2
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [coding, screen]
tags: [forward-pass, shapes, weight-matrix, debugging]
minutes: 8
lessons: [phases/03-deep-learning-core/02-multi-layer-networks]
manuals: []
practice: []
cheatsheet: [neural-net-basics]
related: [deep-learning/xor-needs-a-hidden-layer, deep-learning/missing-zero-grad]
updated: 2026-11-03
---

This Layer class comes from a pure Python forward pass.

```python
class Layer:
    def __init__(self, n_inputs, n_neurons, weights=None, biases=None):
        if weights is not None:
            self.weights = weights
        else:
            self.weights = [
                [random.uniform(-1, 1) for _ in range(n_inputs)]
                for _ in range(n_neurons)
            ]
        self.biases = biases if biases is not None else [0.0] * n_neurons

    def forward(self, inputs):
        self.last_output = []
        for neuron_idx in range(len(self.weights)):
            z = sum(w * x for w, x in zip(self.weights[neuron_idx], inputs))
            z += self.biases[neuron_idx]
            self.last_output.append(sigmoid(z))
        return self.last_output
```

For a 2-3-1 network, give the shape of each weight matrix and bias. Then say what happens when someone builds the hidden layer as `Layer(n_inputs=3, n_neurons=2)` by mistake.

## Short answer

The hidden weights form a 3 by 2 matrix, one row per neuron and one column per input, with a bias of length 3; the output weights form a 1 by 3 matrix with a bias of length 1. The swapped call builds a 2 by 3 matrix: zip pairs each row's three weights with the two inputs and stops at the shorter one, the layer returns two values instead of three, and the output layer's zip truncates again. Nothing raises, and the network computes the wrong function.

## Full answer

### The rule and the table

The weight matrix of a layer has shape (neurons in this layer, neurons in the previous layer). Rows match the current layer, columns match the previous one.

| Step | Operation | Shapes | Result |
|---|---|---|---|
| Input | x | | (2,) |
| Hidden linear | W1 x + b1 | W1 (3, 2), b1 (3,) | (3,) |
| Hidden activation | sigmoid | | (3,) |
| Output linear | W2 h + b2 | W2 (1, 3), b2 (1,) | (1,) |
| Output activation | sigmoid | | (1,) |

In the class, `len(self.weights)` is the neuron count and each row has `n_inputs` entries. The forward loop computes one dot product per row, adds that row's bias, and applies the sigmoid. The output of one layer is the input list of the next.

### What the swapped call does

`Layer(n_inputs=3, n_neurons=2)` allocates two rows of three weights. The forward pass receives a two element input. Python's zip stops at the shorter sequence, so each row uses only its first two weights and the third is ignored. The layer returns two values. The output layer was built for three inputs, so its zip drops a weight too. No exception, no warning, and a model whose parameters are partly dead. A matrix library would raise on the inner size mismatch; this loop does not, which is why the lesson calls shape tracking the most important debugging skill in deep learning.

### Make it fail loudly

Add an assertion in forward that the input length equals the number of columns, or let the Network class check that each layer's input count equals the previous layer's neuron count when it is built.

## Follow-ups

- **Level 2:** How many parameters does the 2-3-1 network have? Expected: nine in the hidden layer, six weights and three biases, and four in the output layer, three weights and one bias.
- **Level 2:** Why does the loop not raise on the swapped shapes? Expected: zip stops at the shorter sequence, so extra weights are ignored and no error occurs; a matrix library would raise on the mismatch.
- **Level 3:** Where do you put a check so the bug fails at once? Expected: an assertion in forward that the input length equals the column count, or a shape check between layers when the Network is built.
- **Level 3:** A text model has a hidden state 768 wide and its input is one token id. Does the rule still hold? Expected: yes; the embedding maps the token to a 768 vector, and each later matrix has rows equal to its own width and columns equal to the previous width.

## Wrong answers

- "The weight matrix is inputs by neurons, so 2 by 3 for the hidden layer." In this class each row holds one neuron's weights across all inputs, so the matrix is neurons by inputs.
- "A wrong shape always raises an error." A library matmul raises; this loop with zip does not, and a framework can broadcast a wrong shape silently.
- "There is one bias per input." A bias belongs to a neuron, so there is one per output of the layer.

## Taught in

The [multi-layer networks lesson](../../../phases/03-deep-learning-core/02-multi-layer-networks/) builds this Layer class and traces the dimensions of the 2-3-1 network.
