Rotary position embedding (RoPE) puts the position of a token into its query and key vectors. It turns each pair of coordinates by an angle that grows with the position. Then the attention score of a query and a key depends only on the distance between their positions. Most open language models use RoPE.

## Task

Write two functions.

1. `rope_frequencies(d, base=10000.0)` returns the frequency of each coordinate pair.
2. `apply_rope(x, positions, base=10000.0)` returns a rotated copy of `x`.

The frequency of pair `i` is $\theta_i = \text{base}^{-2i/d}$, for $i = 0, 1, \dots, \lfloor d/2 \rfloor - 1$.

Pair `i` is the two adjacent coordinates `2i` and `2i + 1`. For the token at position $p$, let $a = x_{2i}$, $b = x_{2i+1}$ and $\phi = p \, \theta_i$. The output pair is:

$$a' = a \cos\phi - b \sin\phi, \qquad b' = a \sin\phi + b \cos\phi$$

When `d` is odd, the last coordinate has no partner. Copy it to the output without a change.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `d` | int | | the size of the last axis |
| `base` | float | | the base of the frequencies |
| `x` | float array | `(..., T, d)` | the vectors of `T` tokens, with zero or more leading batch axes |
| `positions` | int or float array | `(T,)` | the position of each token |

- `rope_frequencies` returns a float array of shape `(d // 2,)`.
- `apply_rope` returns a new float array with the shape of `x`.

## Constraints

- `1 <= T <= 64` and `2 <= d <= 128`.
- Positions are from 0 to 1000000.
- The positions go with the second to last axis of `x`. Every leading axis gets the same rotation.
- Use the pairs `(0, 1), (2, 3), ...`. Do not pair coordinate `i` with coordinate `i + d/2`.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
rope_frequencies(8)
```

```text
[1.    0.1   0.01  0.001]
```

```python
x = np.array([[1.0, 0.0, 1.0, 0.0], [1.0, 0.0, 1.0, 0.0], [1.0, 0.0, 1.0, 0.0]])
apply_rope(x, np.arange(3))
```

```text
[[ 1.          0.          1.          0.        ]
 [ 0.54030231  0.84147098  0.99995     0.00999983]
 [-0.41614684  0.90929743  0.99980001  0.01999867]]
```

```python
q = np.array([[1.0, 2.0, 3.0, 4.0]])
k = np.array([[0.5, -1.0, 2.0, 1.0]])
apply_rope(q, [2])[0] @ apply_rope(k, [5])[0]
apply_rope(q, [10])[0] @ apply_rope(k, [13])[0]
```

```text
11.912706599522757
11.912706599522759
```
