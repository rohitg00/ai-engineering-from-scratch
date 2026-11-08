Adam keeps two running averages for each parameter: the mean of the gradient and the mean of the squared gradient. It divides the first by the square root of the second, so every parameter gets its own step size. AdamW adds weight decay that does not pass through these averages. You write one Adam step as a pure function: it takes the state and returns a new state.

## Task

Write two functions.

1. `init_adam_state(params)` returns the start state: a dict with `"m"` and `"v"` as float zero arrays of the shape of `params`, and `"t"` equal to the int `0`.
2. `adam_step(params, grads, state, lr, beta1, beta2, epsilon, weight_decay)` does one update and returns `(new_params, new_state)`.

One step computes, in this order:

$$t \leftarrow t + 1$$
$$m \leftarrow \beta_1 m + (1 - \beta_1) g, \qquad v \leftarrow \beta_2 v + (1 - \beta_2) g^2$$
$$\hat m = \frac{m}{1 - \beta_1^t}, \qquad \hat v = \frac{v}{1 - \beta_2^t}$$
$$\theta \leftarrow \theta (1 - \eta \lambda) - \eta \frac{\hat m}{\sqrt{\hat v} + \epsilon}$$

The counter grows before the bias correction, so the first step uses $t = 1$. All operations are element by element. The decay factor multiplies the old parameters, as in the `AdamW` class of the lesson code. With `weight_decay = 0` the step is plain Adam.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `params` | float array | any shape | the parameters $\theta$ before the step |
| `grads` | float array | same as `params` | the gradient $g$ |
| `state` | dict | | `"m"` and `"v"`: float arrays of the shape of `params`. `"t"`: int, the number of steps done |
| `lr` | float | scalar | the learning rate $\eta$, default `0.001` |
| `beta1` | float | scalar | default `0.9` |
| `beta2` | float | scalar | default `0.999` |
| `epsilon` | float | scalar | default `1e-8`, added after the square root |
| `weight_decay` | float | scalar | the decoupled decay $\lambda$, default `0.0` |

- `adam_step` returns a tuple. The first item is a float array with the shape of `params`. The second item is a new dict with the keys `"m"`, `"v"` and `"t"`.

## Constraints

- Arrays have at most 100 elements.
- Do not change `params`, `grads` or the arrays in `state`. Return new arrays.
- Use numpy only.

## Examples

```python
params = np.array([1.0, -2.0, 0.5])
grads = np.array([0.1, -0.3, 2.0])
state = init_adam_state(params)
params, state = adam_step(params, grads, state, lr=0.1)
params
state
```

```text
array([ 0.90000001, -1.9       ,  0.4       ])
{'m': array([ 0.01, -0.03,  0.2 ]), 'v': array([1.e-05, 9.e-05, 4.e-03]), 't': 1}
```

```python
params, state = adam_step(params, np.array([0.2, 0.1, -1.0]), state, lr=0.1)
params
state
```

```text
array([ 0.80348181, -1.85997815,  0.3733663 ])
{'m': array([ 0.029, -0.017,  0.08 ]), 'v': array([4.999e-05, 9.991e-05, 4.996e-03]), 't': 2}
```

```python
params = np.array([1.0, -2.0, 0.5])
adam_step(params, np.array([0.1, -0.3, 2.0]), init_adam_state(params), lr=0.1, weight_decay=0.5)[0]
```

```text
array([ 0.85000001, -1.8       ,  0.375     ])
```
