Backpropagation computes the gradient of the loss with respect to every weight of a network. You run the forward pass once, keep the values that the backward pass needs, and then apply the chain rule from the loss back to the input. In this problem, you write both passes for a network with two sigmoid layers and a mean squared error loss.

## Task

Write three functions.

1. `mlp_forward(x, params)` runs the network on a batch and returns `(output, cache)`.
2. `mse_loss(predicted, target)` returns the mean squared error.
3. `mlp_backward(params, cache, target)` returns the gradient of the loss with respect to each parameter.

The forward pass for a batch `x` of shape `(N, n_in)` is:

$$z_1 = x W_1 + b_1, \quad a_1 = \sigma(z_1), \quad z_2 = a_1 W_2 + b_2, \quad a_2 = \sigma(z_2)$$

Here $\sigma(z) = 1 / (1 + e^{-z})$ is the sigmoid. The output is $a_2$. The bias vectors add to every row.

The loss is the mean over all $N \cdot n_{out}$ entries:

$$L = \frac{1}{N \, n_{out}} \sum_{i,j} (a_{2,ij} - y_{ij})^2$$

The cache is your own choice. It can be any Python object. The checks pass the cache from your `mlp_forward` to your `mlp_backward` and do not read it.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `x` | float array | `(N, n_in)` | one row for each example |
| `params` | dict of float arrays | see below | the parameters of the network |
| `params["W1"]` | float array | `(n_in, n_hidden)` | the weights of the hidden layer |
| `params["b1"]` | float array | `(n_hidden,)` | the bias of the hidden layer |
| `params["W2"]` | float array | `(n_hidden, n_out)` | the weights of the output layer |
| `params["b2"]` | float array | `(n_out,)` | the bias of the output layer |
| `predicted` | float array | `(N, n_out)` | the output of `mlp_forward` |
| `target` | float array | `(N, n_out)` | the target values, from 0 to 1 |
| `cache` | any | | the second value that your `mlp_forward` returns |

- `mlp_forward` returns a tuple `(output, cache)`. `output` is a float array of shape `(N, n_out)`.
- `mse_loss` returns a Python `float`.
- `mlp_backward` returns a dict with the keys `"W1"`, `"b1"`, `"W2"` and `"b2"`. Each value is a float array with the shape of that parameter. It is the partial derivative of $L$ with respect to that parameter.

## Constraints

- `1 <= N <= 64`, `1 <= n_in, n_hidden, n_out <= 16`.
- Weights and inputs can be large. A pre-activation can be 1000 or more. No output or gradient can be NaN or infinite.
- Do not change `x`, `target` or the arrays in `params`.
- Use numpy only.

## Examples

```python
x = np.array([[0.0, 1.0], [1.0, 0.0]])
params = {
    "W1": np.array([[0.5, -0.5, 1.0], [0.25, 0.75, -1.0]]),
    "b1": np.array([0.0, 0.1, -0.1]),
    "W2": np.array([[1.0], [-1.0], [0.5]]),
    "b2": np.array([0.2]),
}
target = np.array([[1.0], [0.0]])
output, cache = mlp_forward(x, params)
loss = mse_loss(output, target)
grads = mlp_backward(params, cache, target)
```

```text
output
[[0.5464852 ]
 [0.68495157]]
loss
0.33741716
grads["W2"]
[[ 0.02881637]
 [-0.01942579]
 [ 0.07701337]]
grads["b2"]
[0.03540898]
grads["W1"]
[[ 0.03473536 -0.03551239  0.01518726]
 [-0.02766515  0.0235782  -0.01053007]]
grads["b1"]
[ 0.0070702  -0.01193419  0.0046572 ]
```
