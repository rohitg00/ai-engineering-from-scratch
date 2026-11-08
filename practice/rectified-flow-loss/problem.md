Rectified flow moves samples from a source distribution to a target distribution along straight lines. A network learns a velocity field $v(x, t)$ for $t$ from 0 to 1. An ODE solver then follows this field from a source sample $x_0$ to a target sample. Straight paths need very few solver steps, so the sampler is fast.

## Task

Write four functions. Here $x_0$ is the source sample at $t = 0$ and $x_1$ is the target sample at $t = 1$.

1. `interpolate(x0, x1, t)` returns the point on the straight path: $x_t = (1 - t)\, x_0 + t\, x_1$.
2. `target_velocity(x0, x1)` returns the velocity of that path: $x_1 - x_0$.
3. `flow_matching_loss(velocity_fn, x0, x1, t)` returns the loss as a float:

$$\mathcal{L} = \frac{1}{B} \sum_{b=1}^{B} \left\lVert (x_1^{(b)} - x_0^{(b)}) - v\big(x_t^{(b)}, t^{(b)}\big) \right\rVert^2$$

The squared norm sums over every axis after the first. Call `velocity_fn` once with the whole batch: `velocity_fn(x_t, t)`.

4. `euler_sample(velocity_fn, x0, num_steps)` integrates $dx/dt = v(x, t)$ from $t = 0$ to $t = 1$ with $n$ = `num_steps` equal Euler steps. Let $\Delta t = 1 / n$. For $k = 0, 1, \ldots, n - 1$:

$$x \leftarrow x + \Delta t \cdot v(x, k \Delta t)$$

At step $k$, pass `t` as a float array of shape `(B,)` with every entry equal to $k \Delta t$. Return $x$ after the last step.

**Time.** In `interpolate`, `t` is a float or a float array of shape `(B,)`. An array gives one time to each row and broadcasts over the other axes.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `x0` | float array | `(B, ...)` | the source samples |
| `x1` | float array | same as `x0` | the target samples, row $b$ pairs with row $b$ of `x0` |
| `t` | float or float array | scalar or `(B,)` | the time of each row, from 0 to 1 |
| `velocity_fn` | function | | `velocity_fn(x, t)` takes `x` of shape `(B, ...)` and `t` of shape `(B,)` and returns an array with the shape of `x` |
| `num_steps` | int | | the number of Euler steps |

- `interpolate` and `target_velocity` return float arrays with the shape of `x0`.
- `flow_matching_loss` returns a Python float. In this function `t` is always an array of shape `(B,)`.
- `euler_sample` returns a float array with the shape of `x0`.

## Constraints

- `1 <= B <= 256` and `1 <= num_steps <= 1000`.
- `x0` can hold integers. Work in float.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
x0 = np.array([[0.0, 1.0], [2.0, -1.0]])
x1 = np.array([[1.0, 1.0], [0.0, 3.0]])
t = np.array([0.25, 0.5])
interpolate(x0, x1, t)
target_velocity(x0, x1)
flow_matching_loss(lambda x, t: 0.5 * x, x0, x1, t)
```

```text
[[0.25 1.  ]
 [1.   1.  ]]
[[ 1.  0.]
 [-2.  4.]]
9.7578125
```

```python
euler_sample(lambda x, t: x, np.array([[1.0]]), 4)
euler_sample(lambda x, t: np.ones_like(x) * t[:, None], np.array([[0.0]]), 4)
```

```text
[[2.44140625]]
[[0.375]]
```
