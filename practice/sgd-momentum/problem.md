Plain gradient descent steps by the current gradient only. On a long narrow valley it moves from side to side and makes slow progress. Momentum keeps a velocity that adds up past gradients, so the steps in a consistent direction grow and the side to side steps cancel. You write the momentum update from the optimizers lesson and use it to minimize a quadratic.

## Task

Write two functions.

1. `momentum_step(params, grads, velocity, lr, beta)` does one update and returns `(new_params, new_velocity)`.
2. `minimize_quadratic(A, b, x0, lr, beta, steps, nesterov)` runs `steps` momentum updates on $f(x) = \frac{1}{2} x^T A x - b^T x$ and returns every point.

Use the velocity convention of the lesson. The gradient is not scaled by $1 - \beta$:

$$v \leftarrow \beta v + g, \qquad \theta \leftarrow \theta - \eta v$$

The parameters move with the new velocity, not the old velocity.

The gradient of the quadratic is $\nabla f(x) = A x - b$. The velocity starts at 0. With `nesterov=False` the gradient is computed at the current point $x$. With `nesterov=True` the gradient is computed at the lookahead point $x - \eta \beta v$, where $v$ is the velocity before the update. The update of $v$ and $x$ is then the same momentum step.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `params` | float array | any shape | the current parameters |
| `grads` | float array | same as `params` | the gradient at the current parameters |
| `velocity` | float array | same as `params` | the velocity before this step |
| `lr` | float | scalar | the learning rate $\eta$ |
| `beta` | float | scalar | the momentum coefficient $\beta$, from 0 to below 1 |
| `A` | float array | `(D, D)` | a symmetric positive definite matrix |
| `b` | float array | `(D,)` | the linear term |
| `x0` | float array | `(D,)` | the start point |
| `steps` | int | scalar | the number of updates, 0 or more |
| `nesterov` | bool | scalar | use the lookahead gradient |

- `momentum_step` returns a tuple of two float arrays with the shape of `params`: the new parameters and the new velocity.
- `minimize_quadratic` returns a float array of shape `(steps + 1, D)`. Row 0 is `x0`. Row `k` is the point after `k` updates.

## Constraints

- `1 <= D <= 10` and `0 <= steps <= 1000`.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
momentum_step(np.array([1.0, -2.0]), np.array([0.5, 0.5]), np.array([1.0, 0.0]), lr=0.1, beta=0.9)
```

```text
(array([ 0.86, -2.05]), array([1.4, 0.5]))
```

```python
A = np.array([[3.0, 0.0], [0.0, 1.0]])
b = np.array([3.0, -1.0])
minimize_quadratic(A, b, np.array([0.0, 0.0]), lr=0.1, beta=0.9, steps=3)
```

```text
[[ 0.     0.   ]
 [ 0.3   -0.1  ]
 [ 0.78  -0.28 ]
 [ 1.278 -0.514]]
```

```python
minimize_quadratic(A, b, np.array([0.0, 0.0]), lr=0.1, beta=0.9, steps=3, nesterov=True)
```

```text
[[ 0.       0.     ]
 [ 0.3     -0.1    ]
 [ 0.699   -0.271  ]
 [ 1.04067 -0.48241]]
```

The minimum of this quadratic is at $x = (1, -1)$.
