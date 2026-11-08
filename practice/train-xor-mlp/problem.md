XOR is the classic problem that one neuron cannot solve. A network with one hidden layer can solve it, but only after training. In this task you train a small sigmoid network on noisy XOR points with full-batch gradient descent. The checks then measure it on new points that your code never sees.

## Task

Write two functions.

1. `train(X, y, rng)` trains a network and returns the trained model.
2. `predict(model, X)` returns the label 0 or 1 for each row of `X`.

The data comes from `make_xor(n, rng)` in `support.py`. Each point is a corner of the unit square, $(0, 0)$, $(0, 1)$, $(1, 0)$ or $(1, 1)$, plus Gaussian noise with standard deviation 0.15. The label is the XOR of the two corner bits.

Use the network of the lesson: 2 inputs, a hidden layer of 4 sigmoid units and 1 sigmoid output, $p = \sigma(\sigma(X W_1 + b_1) W_2 + b_2)$. Train it with backpropagation and gradient descent on the whole batch. The mean squared error $\frac{1}{N} \sum_i (p_i - y_i)^2$ is a good loss. Binary cross-entropy also works. The label is 1 when $p \ge 0.5$.

During training, call `report(step, loss)` from `practice_check` once for each update step. The first step is 0. The page draws these values as a live loss curve, and the checks count them.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `X` | float array | `(N, 2)` | the training points |
| `y` | int array | `(N,)` | the label of each point, 0 or 1 |
| `rng` | `np.random.Generator` | | the only source of random numbers |
| `model` | any | | the value that `train` returns |

- `train` returns the model. The model can be any Python value, for example a list of weight arrays.
- `predict` returns an int array of shape `(M,)` for an input of shape `(M, 2)`.

## Constraints

- Budget: at most 2000 update steps, so at most 2000 calls to `report`.
- Target: accuracy of at least 0.95 on a held-out set of 2000 points made with a seed that this page does not give.
- Take every random number from `rng`. The same seed must give the same model.
- Do not change `X` or `y`.
- `predict` must work for one point, shape `(1, 2)`.
- Use numpy only. One full submit has a limit of 20 seconds.

## Examples

```python
X, y = make_xor(200, np.random.default_rng(0))
model = train(X, y, np.random.default_rng(1))
predict(model, np.array([[0.0, 0.0], [0.0, 1.0], [1.0, 0.0], [1.0, 1.0]]))
```

```text
[0 1 1 0]
```

The reference reaches a training accuracy of 0.99 on these 200 points. Its first reported loss is 0.2479 and its last is 0.0103, after 2000 steps.
