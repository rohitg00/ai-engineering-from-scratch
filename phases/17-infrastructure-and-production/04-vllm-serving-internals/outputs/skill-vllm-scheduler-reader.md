---
name: vllm-scheduler-reader
description: vLLM serving config を scheduler-level knob から診断し、PagedAttention、continuous batching、chunked prefill のどれが bottleneck かを特定する。
version: 1.0.0
phase: 17
lesson: 04
tags: [vllm, paged-attention, continuous-batching, chunked-prefill, serving, scheduler]
---

vLLM serving config (model, dtype, hardware, `--gpu-memory-utilization`, `--max-num-batched-tokens`, `--enable-chunked-prefill`, `--speculative-model` または `--speculative-config`, max concurrency) と観測 metrics (TTFT mean/P99, ITL mean/P99, throughput tok/s) が与えられたら、scheduler-level diagnosis を作成してください。

生成するもの:

1. Config read。各 flag について、それが control する scheduler behavior と 2026 default を naming する。non-default value の flag は理由を call out する。
2. Bottleneck identification。bottleneck を次のいずれかに分類する: PagedAttention under-provisioned (KV block starvation)、continuous-batching stall (WAITING queue growth)、chunked-prefill mis-sized (TTFT tail spike)、decode compute-bound (ITL floor)、HBM-bound (batch が入らない)。reported metrics で justify する。
3. Knob recommendations。specific で ordered な action。どの flag を flip し、どの value を試し、どの metric を見るかを書く。scheduler-level tuning を尽くす前に "try more GPUs" を提案しない。
4. Compatibility check。vLLM v0.18.0 では `--enable-chunked-prefill` + `--speculative-model` を hard incompatibility として flag する。両方が必要な場合は documented exception として V1 の N-gram GPU speculative decoding を推奨する。
5. What to read next。diagnosis が示した内容に応じて、vLLM v0.18.0 release notes、PagedAttention paper、Aleksa Gordic の V1 scheduler walkthrough のどれかを指す。

Hard rejects:
- 4 つの core metrics (TTFT, ITL, throughput, concurrency) なしに診断すること。拒否し metric set を求める。
- speculative-decoding config を確認せず `--enable-chunked-prefill` を推奨すること。
- `DCGM_FI_DEV_GPU_UTIL` を scaling signal として扱うこと。vLLM は KV を pre-allocate するため duty-cycle number は misleading です。

Refusal rules:
- H100 上で reported throughput が 100 tok/s 未満の場合、bottleneck は vLLM ではない可能性が高い。client 側 tokenizer、Python GIL、request-level serialization を確認してください。
- `--gpu-memory-utilization` が 0.7 未満の場合、追加 tuning を拒否してください。operator が HBM を空けておく選択をしているため、scheduler flag の前に ceiling を上げる必要があります。
- operator が draft-model speculation で speculative-decoding + chunked-prefill recipe を求めた場合、拒否して v0.18.0 incompatibility を明示してください。代わりに Phase 17 · 05 の EAGLE-3 を指してください。

Output: 1 page の scheduler diagnosis。flags、bottleneck、ordered recommendations、compatibility notes、next-read pointer を含めてください。最後に "what to measure next" paragraph を置き、identified bottleneck に応じて P99 ITL、block allocation rate、WAITING queue depth のいずれかを naming してください。
