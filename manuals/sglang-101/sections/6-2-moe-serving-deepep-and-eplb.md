# MoE serving: --moe-a2a-backend, DeepEP, and EPLB

> A mixture-of-experts layer sends every token to the GPUs that hold its experts, so MoE serving is mostly communication, and the busiest GPU sets the pace.

A mixture-of-experts (MoE) model such as DeepSeek-V3 activates a few experts per token out of many. On paper that is cheap compute. In a server it is a traffic problem. Each token must travel to the GPUs that hold its chosen experts, and each result must travel back, in every MoE layer of every step. One overloaded GPU then makes all the others wait.

When you finish this section, you can follow one token through an MoE layer in SGLang. You can also choose an all-to-all backend and an expert parallel size, and decide when to turn on load balancing and batch overlap.

## One MoE layer, five stages

**Expert parallelism (EP):** the experts of each MoE layer are divided among GPUs, and tokens move to the experts. `--ep-size` sets how many GPUs share the experts. Its default is 1 {{code}}.

SGLang cuts the MoE forward pass into stages with one owner each {{docs}}. The router picks experts for each token. The dispatcher moves tokens to the GPUs that hold those experts. A runner computes all local experts with grouped matrix multiplications. The dispatcher then moves results back and combines them.

```figure
id: fig-6-2
kind: flow
title: one token through an MoE layer
claim: Dispatch and combine move every token across GPUs twice per MoE layer, and the grouped matrix multiply in between is the only expert compute.
caption: Read left to right. Indigo arrows are token traffic between GPUs. The labels name the SGLang stage and the flag that picks its implementation. From the MoE layer code and the expert parallelism docs at v0.5.22.
```

Two flags pick the implementations {{code}}:

| Flag | Default | Picks |
|---|---|---|
| `--moe-a2a-backend` | `none` | how tokens move between GPUs: `deepep`, `mooncake`, `nixl`, `mori`, `pplx`, `flashinfer`, and others |
| `--moe-runner-backend` | `auto` | which grouped matrix multiply kernel runs the experts |
| `--deepep-mode` | `auto` | `normal` dispatch for prefill batches and `low_latency` dispatch for decode batches |

With `none`, SGLang moves tokens with all-reduce or all-gather collectives. That works for any layout and costs more bandwidth at scale. The all-to-all backends send each token only where it must go.

## The layout rules that SGLang enforces

The all-to-all backends span the whole TP group. When you choose one of them, SGLang sets `--ep-size` equal to `--tp-size` and logs the change at info level {{code}}. You cannot run DeepEP across four of eight GPUs. A mixed layout with expert parallelism smaller than tensor parallelism works only with `none` {{docs}}.

DeepEP has two dispatch modes. **Normal mode** sends large prefill batches with high throughput, and it cannot be captured in a CUDA graph. **Low-latency mode** sends small decode batches and works inside CUDA graphs. The default `auto` uses each mode where it fits. If you force `--deepep-mode normal`, SGLang turns off decode CUDA graphs and prints one warning line {{code}}. [Section 4.1](#s-forwardmode-and-cuda-graphs) shows what decode without graphs costs.

## Choose the expert parallel size from your batch

Wider expert parallelism spreads experts thinner and moves more traffic over slower links. Ant Group measured this on H20 GPUs with DeepSeek-R1 decode {{field Ant-Group 2025-09}}:

| Decode batch | EP16 | EP32 |
|---|---|---|
| 8 | 278 tokens/s | 293 tokens/s |
| 32 | 675 tokens/s | 585 tokens/s |

EP32 won at the small batch and lost by 13 percent at the batch they run in production. They explained the result with traffic: about half of the MoE traffic stays on NVLink at EP16, against about a quarter at EP32. They also chose EP16 to limit how many requests one failed GPU takes down. Their [post](https://www.lmsys.org/blog/2025-09-26-sglang-ant-group/) appeared on the LMSYS blog, and the measurements are theirs.

## Expert load balancing

Real traffic does not spread evenly over experts. Some experts get most of the tokens, and the GPUs that hold them become the slowest rank in every step.

**EPLB:** the expert parallelism load balancer. It records which experts each forward pass uses. Every `--eplb-rebalance-num-iterations` passes, 1000 by default, it computes a new placement and moves expert weights {{code}}. `--ep-num-redundant-experts` adds extra copies of popular experts, and its default is 0. A threshold flag skips the rebalance when GPU utilization is already high. Its default of 1.0 means that it never skips.

EPLB is off by default (`--enable-eplb` is false). Turn it on when your measurements show imbalance, not before. Run with `--expert-balancedness-report-mode prometheus` and watch `sglang:eplb_balancedness` {{code}}. The SGLang team reported EPLB speedups of 1.49 times for prefill and 2.54 times for decode {{team 2025-05}}. Those numbers came from a simulated imbalance, so expect less on traffic that is already balanced.

## Overlapping communication with compute

**Two-batch overlap (TBO):** the scheduler cuts a batch into two micro-batches. One micro-batch runs attention while the other one waits on dispatch or combine. Turn it on with `--enable-two-batch-overlap`. It is off by default {{code}}.

For prefill, SGLang splits by token count. If no split puts at least 48 percent of the tokens on each side, it cuts one sequence across both halves. That is `--tbo-token-distribution-threshold`, 0.48 by default.

The SGLang docs say that TBO can "unlock up to 2x throughput" {{docs}}. The blog post that the docs link to measured 27 to 35 percent on 96 H100 GPUs {{team 2025-05}}. Plan for the measured number.

Ant Group turned TBO down on H20 {{field Ant-Group 2025-09}}. It helped only at batch sizes of 64 or 128, and at those sizes their time per output token missed its target. They used single-batch overlap instead, `--enable-single-batch-overlap`, which overlaps shared experts with the combine step. They measured 8 to 10 percent at batches of 20 to 56.

## One GPU, one MoE model: the batch reads more experts

On one GPU there is no dispatch across GPUs, so MoE looks cheap. We served Qwen3-30B-A3B on one NVIDIA GB10 and swept concurrency from 1 to 64. Its config has 48 layers, 128 experts in each MoE layer, and 8 active experts per token.

| Concurrency | BF16 median TPOT | FP8 median TPOT |
|---|---|---|
| 1 | 32.52 ms | 18.41 ms |
| 8 | 102.21 ms | 54.96 ms |
| 64 | 254.06 ms | 131.78 ms |

**We measured** this with three seeds per point. From 1 to 64 concurrent requests, the time per output token grows 7.8 times with BF16 and 7.2 times with FP8. In a dense model, one decode step reads each weight once for the whole batch. In an MoE model, the set of weights grows with the batch.

```figure
id: fig-6-2c
kind: chart
title: time per output token against concurrency for an MoE model on a GB10
claim: The time per output token grows almost in step with the batch, because each extra request reads other experts.
caption: Read each line from left to right. Plum is BF16, green is FP8, and the band is the lowest and highest of three seeds. Qwen3-30B-A3B, 512 tokens in, 128 out. From capture/gpu/summary/gb10.json.
```

The cause is the union of experts. At concurrency 1, each layer reads the weights of 8 experts in a decode step. At 64, 64 tokens each choose 8 of 128 experts. If routing were uniform, one step would read about 126 of the 128 experts in each layer.

That is arithmetic, not a measurement, and real routing is less even. The name says the model activates about 3B parameters per token. A batch of 64 reads close to all 30B.

**Our position:** on one box, plan an MoE model by the bytes a full batch reads, not by its active parameters. Quantize the experts first. FP8 cut the time per token to between 0.52 and 0.57 of BF16 at every concurrency we measured.

## Our position

Leave `--deepep-mode` at `auto` in a server that does both prefill and decode. Choose `--ep-size` from the batch size that meets your latency target, not from the largest published run. Turn on EPLB only after `sglang:eplb_balancedness` shows imbalance. Treat TBO as a throughput feature for large decode batches, and measure it against your time per output token before you keep it.

## Two field reports at full scale

One result in this part passed an external audit. Crusoe submitted DeepSeek-R1 on 512 AMD MI355X GPUs to MLPerf Inference v6.1 with SGLang 0.5.15.post1 {{field Crusoe 2026-09}}. Each node ran TP8 with EP8 and eight attention groups. The offline score was about 2.90 million tokens per second. In the server scenario, p99 time per output token was 79.98 ms against a limit of 80 ms. Their [write-up](https://www.crusoe.ai/resources/blog/serving-5-75-million-tokens-per-second-crusoes-mlperf-inference-v6-1-results-on-amd-mi355x) lists the flags.

The SGLang team's 96-GPU run reported 52.3k input and 22.3k output tokens per second per node {{team 2025-05}}. It used 12 nodes of eight H100 GPUs, with prefill and decode on separate nodes. [Section 6.3](#s-prefill-decode-disaggregation) explains that split.

## A real incident: one GPU runs out of memory

A team ran DeepSeek V3 with four prefill and six decode servers and large expert parallelism ([issue #9787](https://github.com/sgl-project/sglang/issues/9787)). Under load, one prefill rank's GPU utilization dropped to zero, and then every prefill process crashed. The thread traced it to DeepEP dispatch. Imbalanced routing sent too many tokens to one GPU, and that GPU ran out of memory. The suggested fixes were a smaller chunked prefill per attention group, a tuned initial expert placement, and EPLB. The lesson is general: in MoE serving, the busiest GPU sets both your speed and your memory limit.

```figure
id: fig-6-2b
kind: comparison
title: EP16 and EP32 at two batch sizes
claim: Wider expert parallelism won at batch 8 and lost 13 percent at batch 32, because less of its traffic stayed on NVLink.
caption: Read each column top to bottom. Numbers are decode tokens per second for DeepSeek-R1 on H20, from Ant Group on the LMSYS blog, 2025-09-26. This is their measurement.
```

```takeaways
- Keep --deepep-mode auto unless you debug one dispatch mode.
- Pick --ep-size from the batch that meets your latency target.
- Enable EPLB only after sglang:eplb_balancedness shows imbalance.
- Measure two-batch overlap against time per output token before you keep it.
- Lower chunked prefill per attention group when one MoE rank runs out of memory.
- Size a one-box MoE server by the expert bytes a full batch reads.
```

Sources: python/sglang/srt/arg_groups/fields/exec_.py, python/sglang/srt/arg_groups/overrides.py (_a2a_ep_size), python/sglang/srt/arg_groups/moe_hook.py, python/sglang/srt/eplb/eplb_manager.py, python/sglang/srt/batch_overlap/two_batch_overlap.py, python/sglang/srt/observability/metrics_collector.py, and docs/docs/advanced_features/expert_parallelism.mdx, all at v0.5.22. LMSYS, "Deploying DeepSeek with PD Disaggregation and Large-Scale Expert Parallelism on 96 H100 GPUs", 2025-05-05. Ant Group on the LMSYS blog, 2025-09-26. Crusoe, MLPerf Inference v6.1 results, 2026-09-16. Issue #9787. capture/gpu/summary/gb10.json, capture/gpu/sweep.py, and the config.json of Qwen/Qwen3-30B-A3B-Instruct-2507.
