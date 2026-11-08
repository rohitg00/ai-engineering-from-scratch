## What the numbers say

The default model saturates at concurrency 32. From 32 to 64 the output throughput falls from 270.11 to 250.85 tokens per second. The median TTFT rises from 2,970 ms to 18,349 ms in the same step. The default KV pool has room for 24,094 tokens, so at 64 requests the scheduler cannot admit all of them and the queue grows.

The FP8 run does not saturate inside the sweep. FP8 weights and an FP8 KV cache leave room for 142,369 tokens, about six times the default pool. At concurrency 32 the FP8 run gives 1.88 times the throughput of the default run.

## Throughput, the SLO and goodput are three different answers

The p99 TTFT meets the 1,000 ms SLO only up to concurrency 4. The goodput is highest at concurrency 16. The throughput saturates at 32. A capacity plan that uses only throughput picks a level where the goodput is 0. This is the point of the goodput lesson: report the share of requests that meet every SLO, not the token rate.

## The chunk result is not a result

The 1024 token chunk changed the median TTFT by about 3 percent and the throughput by about minus 3 percent. The seed ranges overlap at all three rates. A change inside the seed spread is not a measured effect. On this card the workload was more than the GPU could serve, so the queue, not the chunk size, set the TTFT.

## Where this goes next

The same reading applies to any sweep: a saturation rule, an SLO bound and a seed range check. The SGLang serving cheat sheet and the inference load testing lessons use these steps on other engines.
