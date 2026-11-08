## Hint 1

Convert `ys` to a numpy float array. The slice `values[1:]` holds each new value and the slice `values[:-1]` holds the value before it.

## Hint 2

In `saturation_point`, step `i` goes from `xs[i]` to `xs[i + 1]`. When that step has a low gain, the useful level is `xs[i]`, not `xs[i + 1]`.

## Hint 3

Use `column(rows, key)` from `support.py` to get one list for each metric. For the `MIXED` rows, read `row["median_ttft_ms"]["median"]` for the value and pass the whole inner dict to `ranges_overlap`.

## Hint 4

The SLO question uses the p99 TTFT, not the median TTFT. Goodput counts the requests that meet the SLO, so its best level can be higher than the level where the p99 still meets the SLO.
