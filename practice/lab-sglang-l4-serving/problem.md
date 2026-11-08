A serving benchmark gives a table of numbers for each setting. You must read the table and decide. In this lab you read real SGLang 0.5.22 runs of Qwen3-8B on one NVIDIA L4. You find where throughput stops rising, where the latency SLO breaks, what FP8 gives, and whether a smaller prefill chunk helps.

The data comes from `manuals/sglang-101/capture/gpu/summary/l4.json` in this repository. `support.py` has a copy of the rows that the lab needs. Each value is the median of three seeds. The `MIXED` rows also keep the `min` and `max` of the three seeds.

## Task

Write five helper functions and `answers()`.

1. `gains(ys)` returns a float array of length $n - 1$. Entry $i$ is $y_{i+1} / y_i - 1$.
2. `saturation_point(xs, ys, min_gain=0.05)` finds the first step $i$ with gain strictly below `min_gain`. It returns `xs[i]`, the last level before that step. If no step has a gain below `min_gain`, it returns `xs[-1]`.
3. `largest_within(xs, ys, limit)` returns the largest `x` whose `y` is less than or equal to `limit`. If no `y` meets the limit, it returns `None`.
4. `pct_change(new, old)` returns $100 \cdot (new - old) / old$.
5. `ranges_overlap(a, b)` takes two dicts with the keys `"min"` and `"max"`. It returns `True` when $a_{min} \le b_{max}$ and $b_{min} \le a_{max}$.

Then do the experiment in `answers()`. Use the helpers.

1. Change the concurrency from 1 to 64 in `LOAD["default"]`. Measure `output_throughput`. Report the saturation point with `min_gain = 0.05` as `saturation_default`.
2. Do step 1 again for `LOAD["fp8"]`. Report `saturation_fp8`.
3. In `LOAD["default"]`, measure `p99_ttft_ms` at each concurrency. Report the largest concurrency with `p99_ttft_ms` within `SLO["ttft_ms"]` as `slo_concurrency_default`.
4. In `LOAD["default"]`, measure `goodput_rps`. Report the concurrency with the highest goodput as `best_goodput_concurrency_default`. If two levels have the same goodput, use the lower concurrency.
5. At concurrency 32, divide the FP8 `output_throughput` by the default `output_throughput`. Report the ratio as `fp8_speedup_c32`.
6. Change the prefill chunk from the default (4096 tokens) to 1024 tokens. Compare `MIXED["chunk-1024"]` with `MIXED["default"]` at the same rate. Use the `"median"` field. Report the mean over the three rates of `pct_change` in `median_ttft_ms` as `chunk_ttft_change_pct`. Report the same mean for `output_throughput` as `chunk_throughput_change_pct`. The new value is the chunk 1024 value. The old value is the default value.
7. For each rate, test if the seed ranges of `median_ttft_ms` for the two settings overlap. Report the number of rates with an overlap as `chunk_overlap_rates`.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `xs` | list of numbers | `(n,)` | the levels of the variable that you change, in increasing order |
| `ys` | list of floats | `(n,)` | the measured value at each level, all above 0 for `gains` |
| `min_gain` | float | scalar | the smallest relative gain that counts as a rise |
| `limit` | float | scalar | the SLO bound, in the unit of `ys` |
| `new`, `old` | float | scalar | the changed value and the base value, `old` is not 0 |
| `a`, `b` | dict | keys `min`, `max` | one seed range each |

- `gains` returns a float array of shape `(n - 1,)`.
- `saturation_point` and `largest_within` return one element of `xs`. `largest_within` can return `None`.
- `pct_change` returns a float. `ranges_overlap` returns a bool.
- `answers()` returns a dict with the eight keys above. Each value is a Python `float`.

## Constraints

- `2 <= n <= 20` for `gains` and `saturation_point`.
- Do not change the input lists.
- Do not round the answers. The checks accept a relative difference of `1e-6` from the reference run.
- Use the data in `support.py` only. Use numpy and the standard library only.

## Examples

```python
gains([13.42, 31.2, 61.54])
```

```text
[1.32488823 0.9724359 ]
```

```python
saturation_point([1, 2, 4, 8], [10.0, 20.0, 20.5, 30.0])
```

```text
2
```

The gain from 2 to 4 is 0.025, which is below 0.05. The series rises again at 8, but the rule stops at the first low gain.

```python
largest_within([1, 2, 4, 8], [100.0, 900.0, 1000.0, 1200.0], 1000.0)
```

```text
4
```

```python
pct_change(37411.99, 35999.18)
```

```text
3.9245616150145577
```

`answers()["saturation_default"]` is `32.0`.
