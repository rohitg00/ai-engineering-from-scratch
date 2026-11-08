# Incident index

> This page lists every issue the manual cites, with its status at 0.31.0.

Use this page to check whether a problem you see is known.

States are as of 2026-10-22. Numbers refer to issues in the vLLM repository.

## Issues

| Issue | What it reports | State | Page |
|---|---|---|---|
| 44740 | a negative CUDA graph memory estimate with MTP speculation on the GB10, which makes the KV cache too large | open | [DGX Spark](#s-size-memory-on-a-dgx-spark) |
| 46307 | memory use above the `--gpu-memory-utilization` share during the startup profile on the GB10, which stopped the host | closed as stale on 2026-10-22, with no fix | [DGX Spark](#s-size-memory-on-a-dgx-spark) |
| 52479 | a level 2 wake from sleep that does not reload the speculative draft, so no draft token is accepted | open | [RL rollouts](#s-use-vllm-as-an-rl-rollout-engine) |
| 54623 | the Qwen3.5 family never loads checkpoint KV scales, so an FP8 KV cache runs at scale 1.0 | open | [FP8 KV cache](#s-fit-more-users-with-an-fp8-kv-cache) |
| 57853 | a weight update sent while the engine sleeps segfaults the engine core | open | [RL rollouts](#s-use-vllm-as-an-rl-rollout-engine) |
| 60333 | one MTP draft loader drops FP8 KV scales, and the draft layers use scale 1.0 | open | [FP8 KV cache](#s-fit-more-users-with-an-fp8-kv-cache) |
| 58726 | slow weight load on the GB10, from per-tensor copies out of the file map | open | [DGX Spark](#s-size-memory-on-a-dgx-spark) |
| 59770 | slower NVFP4 decode for one model on the GB10 since 0.29.0 | open | [troubleshooting](#s-troubleshoot-by-symptom) |
| 60174 | one repeated token after a prefix-cache hit with DFlash2 or DSpark speculation on 0.30 and 0.31 | closed on 2026-10-22 | [troubleshooting](#s-troubleshoot-by-symptom) |
| 60262 | a crash at start when an FP8 KV cache picks FlashInfer without a working kernel build | open | [troubleshooting](#s-troubleshoot-by-symptom) |
| 60830 | invalid JSON with MTP speculation and a JSON schema on one model | closed | [troubleshooting](#s-troubleshoot-by-symptom) |
| 60838 | `--mamba-block-size` has no effect after the removal of the `all` Mamba cache mode | open | [long contexts](#s-serve-long-contexts-and-hybrid-models) |
| 61024 | the project roadmap for Q4 2026, which lists the removal of the old model runner | open | [Model Runner V2](#s-what-model-runner-v2-changed) |
| 61886 | KV offloading that does not depend on the tensor-parallel size | open | [KV connectors](#s-how-kv-connectors-move-the-cache) |
| 59538 | a compression layer for KV transfer and storage | open | [KV connectors](#s-how-kv-connectors-move-the-cache) |
| 61229 | KV blocks released during a remote read in the NIXL connector | open | [KV connectors](#s-how-kv-connectors-move-the-cache) |
| 58253 | a request for a reviewer role, to raise review capacity | open | [history](#s-where-vllm-came-from) |
| 61698 | a request for reproducible evals and benchmarks that contributors run on their own GPUs | open | [history](#s-where-vllm-came-from) |

## Our own incidents

| Date | Machine | What happened | Page |
|---|---|---|---|
| 2026-10-22 | L4, shared GPU | the start failed, because one request at a maximum length of 2,928 tokens needed slightly more KV cache than was free | [startup](#s-fix-out-of-memory-at-startup) |
| 2026-10-21 | GB10 | the first weight load of 56.93 GiB took 330 seconds | [DGX Spark](#s-size-memory-on-a-dgx-spark) |

Sources: vLLM issues 44740, 46307, 52479, 54623, 57853, 58253, 58726, 59538, 59770, 60174, 60262, 60333, 60830, 60838, 61024, 61229, 61698, and 61886 (fetched 2026-10-21, and the state of each again on 2026-10-22); capture/gpu/out-gb10/server-load-vllm.log.
