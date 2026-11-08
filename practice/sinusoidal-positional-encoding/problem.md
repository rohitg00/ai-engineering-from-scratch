Attention does not see the order of the tokens. The original transformer adds a fixed table of sines and cosines to the token embeddings. Each row of the table is the code of one position, and each pair of columns turns at its own frequency.

## Task

Write two functions.

1. `sinusoidal_pe(max_len, d_model, base=10000.0)` returns the table of shape `(max_len, d_model)`.
2. `add_positional_encoding(x, base=10000.0)` returns `x` plus the table for its sequence length.

For position $p = 0, 1, \dots, \text{max\_len} - 1$ and pair $i = 0, 1, \dots, \lfloor d/2 \rfloor - 1$, with $d$ = `d_model`:

$$PE[p, 2i] = \sin\left(p / \text{base}^{2i/d}\right), \qquad PE[p, 2i+1] = \cos\left(p / \text{base}^{2i/d}\right)$$

The sin and the cos of one pair are in adjacent columns. When `d_model` is odd, the last column has no pair. It stays 0. The exponent still divides by `d_model`.

`add_positional_encoding` adds row `t` of the table to the vector of token `t`. The tokens are on the second to last axis of `x`. Every leading axis gets the same table.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `max_len` | int | | the number of positions |
| `d_model` | int | | the number of columns |
| `base` | float | | the base of the frequencies |
| `x` | float array | `(..., T, d_model)` | the embeddings of `T` tokens, with zero or more leading batch axes |

- `sinusoidal_pe` returns a float array of shape `(max_len, d_model)`.
- `add_positional_encoding` returns a new float array with the shape of `x`.

## Constraints

- `1 <= max_len <= 8192` and `1 <= d_model <= 1024`.
- Positions start at 0.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
sinusoidal_pe(3, 4)
```

```text
[[ 0.          1.          0.          1.        ]
 [ 0.84147098  0.54030231  0.00999983  0.99995   ]
 [ 0.90929743 -0.41614684  0.01999867  0.99980001]]
```

```python
sinusoidal_pe(2, 5)
```

```text
[[0.         1.         0.         1.         0.        ]
 [0.84147098 0.54030231 0.02511622 0.99968454 0.        ]]
```

```python
add_positional_encoding(np.ones((2, 2)))
```

```text
[[1.         2.        ]
 [1.84147098 1.54030231]]
```
