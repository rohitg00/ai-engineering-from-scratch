Softmax regression is logistic regression for more than two classes. It gives each class a linear score and turns the scores into probabilities with softmax. In this task you train it with gradient descent on four Gaussian blobs. The checks then measure its accuracy and its log loss on new points that your code never sees.

## Task

Write two functions.

1. `train(X, y, rng)` trains the model and returns it.
2. `predict_proba(model, X)` returns the probability of each class for each row of `X`.

The data comes from `make_blobs(n, rng)` in `support.py`. Each point belongs to one of 4 classes. A point of class $k$ is `CENTERS[k]` plus Gaussian noise with standard deviation 0.9. The `weights` argument sets the class frequencies. The default is equal frequencies.

The model has a weight matrix $W$ of shape $(2, 4)$ and a bias vector $b$ of shape $(4,)$. The probabilities are $P = \mathrm{softmax}(Z W + b)$, where $Z$ holds the input features. Train with gradient descent on the mean cross-entropy $-\frac{1}{N} \sum_i \log P_{i, y_i}$. The features have a mean of about 4 and 3. Scale them to mean 0 and standard deviation 1 with the statistics of the training set, and store these statistics in the model.

During training, call `report(step, loss)` from `practice_check` once for each update step. The first step is 0. The page draws these values as a live loss curve, and the checks count them.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `X` | float array | `(N, 2)` | the training points |
| `y` | int array | `(N,)` | the class of each point, from 0 to 3 |
| `rng` | `np.random.Generator` | | the only source of random numbers, if you need any |
| `model` | any | | the value that `train` returns |

- `train` returns the model. The model can be any Python value, for example a dict of arrays.
- `predict_proba` returns a float array of shape `(M, 4)` for an input of shape `(M, 2)`. Each row sums to 1.

## Constraints

- Budget: at most 500 update steps, so at most 500 calls to `report`.
- Targets on a held-out set of 4000 points made with a seed that this page does not give: accuracy of at least 0.95 and log loss of at most 0.11. The checks use the class with the highest probability as the prediction.
- The targets also apply when one class has 85 percent of the points.
- `predict_proba` must give finite probabilities for points far from the data, for example `(1000, 1000)`.
- The same seed must give the same model. Do not change `X` or `y`.
- Use numpy only. One full submit has a limit of 15 seconds.

## Examples

```python
X, y = make_blobs(400, np.random.default_rng(0))
model = train(X, y, np.random.default_rng(1))
predict_proba(model, np.array([[1.0, 1.0], [4.0, 3.0]]))
```

```text
[[0.9994 0.0001 0.0005 0.    ]
 [0.0293 0.3585 0.5689 0.0432]]
```

The output is rounded to 4 decimals. The first point is the center of class 0. The second point is between the blobs, so no class is sure. The reference starts at zero weights, so its first reported loss is $\log 4 = 1.3863$. After 500 steps its training log loss is 0.0609 and its training accuracy is 0.9875.
