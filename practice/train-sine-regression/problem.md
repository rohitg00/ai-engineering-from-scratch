A network with one hidden layer of tanh units can bend a straight line into a smooth curve. In this task you train a 1-16-1 tanh network to fit $\sin(x)$ from noisy samples. The checks then compare the trained network with the true curve at new points that your code never sees.

## Task

Write two functions.

1. `train(x, y, rng)` trains a network and returns the trained model.
2. `predict(model, x)` returns the network output for each value in `x`.

The data comes from `make_sine(n, rng)` in `support.py`. Each $x$ is uniform from $-\pi$ to $\pi$, and $y = \sin(x) + \varepsilon$ with Gaussian noise of standard deviation 0.1.

Use 1 input, 16 tanh hidden units and 1 linear output: $\hat y = \tanh(x W_1 + b_1) W_2 + b_2$. Train it on the mean squared error $\frac{1}{N} \sum_i (\hat y_i - y_i)^2$ with full-batch gradient descent. Adam reaches the target with the least tuning.

During training, call `report(step, loss)` from `practice_check` once for each update step. The first step is 0. The page draws these values as a live loss curve, and the checks count them.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `x` | float array | `(N,)` | the training inputs, from $-\pi$ to $\pi$ |
| `y` | float array | `(N,)` | the noisy targets |
| `rng` | `np.random.Generator` | | the only source of random numbers |
| `model` | any | | the value that `train` returns |

- `train` returns the model. The model can be any Python value, for example a list of weight arrays.
- `predict` returns a float array of shape `(M,)` for an input of shape `(M,)`.

## Constraints

- Budget: at most 1500 update steps, so at most 1500 calls to `report`.
- Target: a mean squared error of at most 0.01 against the true curve $\sin(x)$, at 2000 new values of $x$ from $-\pi$ to $\pi$. This page does not give their seed.
- Take every random number from `rng`. The same seed must give the same model.
- Do not change `x` or `y`, and do not change their shape.
- `predict` must work for one value, shape `(1,)`.
- Use numpy only. One full submit has a limit of 20 seconds.

## Examples

```python
x, y = make_sine(200, np.random.default_rng(0))
model = train(x, y, np.random.default_rng(1))
predict(model, np.array([0.0, np.pi / 2, -np.pi / 2]))
```

```text
[-0.0165  1.0418 -1.0157]
```

The output is rounded to 4 decimals. The true values are 0, 1 and minus 1. The reference uses Adam with the learning rate 0.01. Its first reported loss is 4.2061 and its last is 0.0101, after 1500 steps. The noise alone gives a mean squared error of 0.0106 on these 200 points, so a training loss far below 0.01 means that the network fits the noise.
