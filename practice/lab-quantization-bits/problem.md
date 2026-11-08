Quantization stores each weight as a small integer and one float scale. Fewer bits save memory, but each bit removed doubles the rounding step. One large outlier makes it worse, because the outlier sets the scale. In this lab you sweep the bit width from 2 to 8 on a weight matrix with outliers. You measure the error with one scale for the whole matrix and with one scale for each row.

`support.py` gives `make_weights(seed)`. It returns a `(64, 128)` matrix of normal weights with standard deviation 0.02, and six outliers near $\pm 0.25$ in six different rows. It also gives the grid `BITS` and the error limit `THRESHOLD = 0.05`. The starter gives `qrange(num_bits)`, which returns the signed range $(q_{min}, q_{max}) = (-2^{b-1}, 2^{b-1} - 1)$.

## Task

Write six helper functions and `answers()`.

1. `quantize_symmetric(tensor, num_bits)` returns `(quantized, scale)`. The scale is $s = \max \lvert W \rvert / q_{max}$. If $\max \lvert W \rvert = 0$, use $s = 1.0$. The codes are `round(W / s)` clipped to $[q_{min}, q_{max}]$, as integers. Use `np.round`, which rounds a halfway value to the even integer.
2. `quantize_per_row(tensor, num_bits)` does the same with one scale for each row. It returns the codes and a float array of shape `(rows,)`. A row of zeros gets the scale 1.0.
3. `dequantize(quantized, scale)` returns the float array `quantized * scale`. If `scale` is a 1D array, row $i$ uses `scale[i]`.
4. `relative_error(original, reconstructed)` returns $\lVert W - \hat W \rVert_F / \lVert W \rVert_F$.
5. `bit_sweep(tensor, bits, per_row)` returns a float array with one relative error for each bit width in `bits`. It uses `quantize_per_row` when `per_row` is `True`, else `quantize_symmetric`.
6. `smallest_bits(bits, errors, threshold)` returns the smallest bit width whose error is less than or equal to `threshold`. If no bit width passes, it returns `None`.

Then do the experiment in `answers()`.

1. Make the weights with `make_weights(seed=0)`.
2. Change the bit width over `BITS`. Measure the relative error with one scale for the matrix.
3. Do step 2 again with one scale for each row.
4. Report the smallest bit width under `THRESHOLD` for each method as `smallest_bits_per_tensor` and `smallest_bits_per_row`.
5. Report the 4 bit errors as `error_4bit_per_tensor` and `error_4bit_per_row`. Report their ratio, per tensor divided by per row, as `per_row_gain_4bit`.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `tensor` | float array | `(rows, cols)` | the weight matrix |
| `num_bits` | int | scalar | the bit width $b$, from 2 to 8 |
| `quantized` | int array | `(rows, cols)` | the integer codes |
| `scale` | float or float array | scalar or `(rows,)` | one scale, or one scale for each row |
| `bits` | list of ints | `(k,)` | the bit widths of the sweep, in increasing order |
| `errors` | list or float array | `(k,)` | one error for each bit width |

- `quantize_symmetric` returns an int array and a Python `float`.
- `quantize_per_row` returns an int array and a float array of shape `(rows,)`.
- `dequantize` returns a float array of shape `(rows, cols)`.
- `relative_error` returns a float. `bit_sweep` returns a float array of shape `(k,)`.
- `answers()` returns a dict with the five keys above. Each value is a Python `float`.

## Constraints

- `1 <= rows, cols <= 256`. The original matrix in `relative_error` is not all zeros.
- Do not change the input arrays.
- Do not round the answers. The checks accept a relative difference of `1e-6` from the reference run.
- Use numpy and the standard library only.

## Examples

```python
W = np.array([[0.5, -1.0, 0.25], [0.0, 0.0, 0.0]])
quantize_symmetric(W, 4)
```

```text
(array([[ 4, -7,  2],
       [ 0,  0,  0]], dtype=int32), 0.14285714285714285)
```

The value $0.5 / s = 3.5$ is halfway, so it rounds to the even integer 4.

```python
quantize_per_row(W, 4)[1]
```

```text
[0.14285714 1.        ]
```

```python
relative_error(np.array([3.0, 4.0]), np.array([3.0, 3.0]))
```

```text
0.2
```

```python
bit_sweep(make_weights(0), [4, 8], per_row=True)
```

```text
[0.18284473 0.0099937 ]
```
