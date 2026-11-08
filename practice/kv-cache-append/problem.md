A decoder makes one token at a time. Without a cache, each new token computes the keys and values of the whole prefix again. A KV cache stores the key and the value of each step once. Then each new token needs only one query against the stored keys and values.

## Task

Write a class `KVCache` and a function `decode_step`.

`KVCache(max_len, d_k, d_v)` makes an empty cache with room for `max_len` steps. It has these methods:

1. `append(k, v)` adds one or more steps after the steps that are already in the cache. A 1D `k` of shape `(d_k,)` is one step. A 2D `k` of shape `(n, d_k)` is `n` steps. The same rule applies to `v`.
2. `keys()` returns the stored keys, in the order of the appends, with shape `(len, d_k)`.
3. `values()` returns the stored values with shape `(len, d_v)`.
4. `len(cache)` returns the number of stored steps.

`append` raises `ValueError` in two cases:

- the new steps do not fit, that is, `len(cache) + n > max_len`;
- `k` and `v` have different numbers of steps.

When `append` raises, the cache does not change.

`decode_step(q, cache)` computes the attention of one query over the cache. Let $K$ be `cache.keys()` and $V$ be `cache.values()`. The scores are $s = K q / \sqrt{d_k}$. The weights are the softmax of $s$. The output is the weights times $V$.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `max_len` | int | | the number of steps that the cache can hold |
| `d_k`, `d_v` | int | | the size of one key and of one value |
| `k` | float array | `(d_k,)` or `(n, d_k)` | the keys of one or `n` new steps |
| `v` | float array | `(d_v,)` or `(n, d_v)` | the values of the same steps |
| `q` | float array | `(d_k,)` | the query of the current step |
| `cache` | `KVCache` | | a cache with at least one step |

- `append` returns `None`.
- `decode_step` returns a tuple `(output, weights)`.
- `output` is a float array of shape `(d_v,)`.
- `weights` is a float array of shape `(len(cache),)`.

## Constraints

- `1 <= max_len <= 256` and `1 <= d_k, d_v <= 64`.
- Scores can be larger than 1000. The output must stay finite.
- The cache stores a copy of the data. A later change to the caller's `k` or `v` does not change the cache.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
cache = KVCache(4, 2, 2)
cache.append(np.array([[1.0, 0.0], [0.0, 1.0]]), np.array([[1.0, 2.0], [3.0, 4.0]]))
len(cache)
cache.append(np.array([1.0, 1.0]), np.array([5.0, 6.0]))
len(cache)
cache.values()
```

```text
2
3
[[1. 2.]
 [3. 4.]
 [5. 6.]]
```

```python
output, weights = decode_step(np.array([1.0, 0.0]), cache)
```

```text
output
[3. 4.]
weights
[0.40111209 0.19777581 0.40111209]
```

```python
cache.append(np.zeros((2, 2)), np.zeros((2, 2)))
```

```text
ValueError: the cache is full
```

After the error, `len(cache)` is still `3`.
