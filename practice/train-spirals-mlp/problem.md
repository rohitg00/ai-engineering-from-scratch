Two spirals that wind around each other are a hard test for a small classifier. No straight line and no simple curve splits them. In this task you train a network with two tanh hidden layers on mini-batches with Adam. The checks then measure it on new points that your code never sees.

## Task

Write two functions.

1. `train(X, y, rng)` trains a network and returns the trained model.
2. `predict(model, X)` returns the label 0 or 1 for each row of `X`.

The data comes from `make_spirals(n, rng)` in `support.py`. Arm $k \in \{0, 1\}$ is the curve $r(t) = 3t / (4\pi)$ at the angle $t + k\pi$, for $t$ from 0 to $4\pi$, so each arm makes two turns. Each point has Gaussian noise with standard deviation 0.08. The first half of the rows has label 0 and the second half has label 1.

Use the layers of the lesson: `Linear(2, 24)`, `Tanh`, `Linear(24, 24)`, `Tanh`, `Linear(24, 1)` and a sigmoid output with the binary cross-entropy loss. Train with mini-batches and Adam. The rows of `X` are sorted by label, so take each mini-batch from a shuffled order of the rows. The label is 1 when the output probability is at least 0.5.

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

- Budget: at most 1500 update steps, so at most 1500 calls to `report`.
- Target: accuracy of at least 0.95 on a held-out set of 2000 points made with a seed that this page does not give.
- Take every random number from `rng`, also the shuffle order. The same seed must give the same model.
- Do not change `X` or `y`.
- `predict` must work for one point, shape `(1, 2)`.
- Use numpy only. One full submit has a limit of 25 seconds.

## Examples

```python
X, y = make_spirals(400, np.random.default_rng(0))
model = train(X, y, np.random.default_rng(1))
predict(model, np.array([[0.75, 0.0], [-0.75, 0.0]]))
```

```text
[1 0]
```

At radius 0.75 the parameter is $t = \pi$. Arm 0 is at the angle $\pi$ and arm 1 is at the angle $2\pi$, so the point $(0.75, 0)$ is on arm 1. The reference uses mini-batches of 64 and the Adam learning rate 0.01. It reaches a training accuracy of 1.0 on these 400 points. Its first reported loss is 0.7103 and its last is 0.0163, after 1500 steps.
