Quantization stores weights as small integers and one float scale for each group of values. Symmetric int8 quantization maps the value with the largest magnitude to 127 and maps 0 to 0. A per-tensor scale uses one number for the whole matrix. A per-row scale uses one number for each row, so a row with an outlier does not reduce the precision of the other rows.

## Task

Write four functions.

1. `quantize_symmetric(tensor)` returns `(quantized, scale)` with one scale for the whole tensor.
2. `dequantize_symmetric(quantized, scale)` returns the float tensor.
3. `quantize_per_channel(tensor)` returns `(quantized, scales)` with one scale for each row of a 2D tensor.
4. `dequantize_per_channel(quantized, scales)` returns the float tensor.

For a group of values $x$ (the whole tensor, or one row):

$$\text{scale} = \max |x| / 127, \quad q = \text{clip}(\text{round}(x / \text{scale}), -127, 127)$$

Use `np.round`. It rounds a value that is exactly halfway to the nearest even integer, so 2.5 becomes 2. The dequantized value is $q \cdot \text{scale}$.

When $\max |x| = 0$, the scale of that group is `1.0`. All its quantized values are then 0.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `tensor` | float array | any shape for `quantize_symmetric`, `(R, C)` for `quantize_per_channel` | the values to quantize |
| `quantized` | int8 array | same as `tensor` | the integer values |
| `scale` | float | | the per-tensor scale |
| `scales` | float array | `(R,)` | the scale of each row |

- `quantize_symmetric` returns a tuple `(quantized, scale)`. `quantized` is an `np.int8` array with the shape of `tensor`. `scale` is a Python `float`.
- `quantize_per_channel` returns a tuple `(quantized, scales)`. `quantized` is an `np.int8` array of shape `(R, C)`. `scales` is a float array of shape `(R,)`, also when `R` is 1.
- Both dequantize functions return a `float64` array with the shape of `quantized`.

## Constraints

- `1 <= R, C <= 256`. All values are finite.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
tensor = np.array([[0.5, -1.0, 0.25], [2.0, 0.1, -0.04]])
q, scale = quantize_symmetric(tensor)
```

```text
q
[[ 32 -64  16]
 [127   6  -3]]
scale
0.015748031496062992
dequantize_symmetric(q, scale)
[[ 0.50393701 -1.00787402  0.2519685 ]
 [ 2.          0.09448819 -0.04724409]]
```

```python
q, scales = quantize_per_channel(tensor)
```

```text
q
[[  64 -127   32]
 [ 127    6   -3]]
scales
[0.00787402 0.01574803]
dequantize_per_channel(q, scales)
[[ 0.50393701 -1.          0.2519685 ]
 [ 2.          0.09448819 -0.04724409]]
```

```python
quantize_per_channel(np.array([[0.0, 0.0], [1.0, -3.0]]))
```

```text
q
[[   0    0]
 [  42 -127]]
scales
[1.         0.02362205]
```
