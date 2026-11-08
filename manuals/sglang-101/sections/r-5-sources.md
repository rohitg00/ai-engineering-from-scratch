# Sources

> The manual ranks its sources by authority, and this page lists every external source the sections cite, with the sections that use each one.

The ranks match [how this manual was made](#s-ref-how-this-manual-was-made). When two sources disagree, the higher one wins and the section says so. The SGLang source files each section used are recorded in the manual source and checked by the audit. They are not listed here. Every page below was read on 2026-10-16. The studies and reports added for the research update were read on 2026-10-22.

## The ranked sources

| Rank | Source | What the manual takes from it | Source key |
|---|---|---|---|
| 1 | the SGLang source at the tag, `baa9befa` | every default and every mechanism | the source files of each section, in the manual source |
| 2 | the captured runs [on the Mac](manuals/sglang-101/capture/out) and [on the GPUs](manuals/sglang-101/capture/gpu) | every listing and every number marked as measured | the capture file name |
| 3 | SGLang issues and pull requests | incidents and the design history of each feature | `issue` and its number |
| 4 | papers | the original design of RadixAttention and the methods SGLang implements | `paper` and a title |
| 5 | the SGLang documentation at the tag | documented behaviour, checked against the code | `docs` and a heading |
| 6 | independent field reports | GPUs and scales that this manual could not run | `field`, the author, and the month |
| 7 | SGLang team and vendor reports | claims, always labeled as the claim of the author | `team` or the vendor, and the month |

## Rank 1 and rank 2: the code and the captures

| Source | Used in |
|---|---|
| SGLang 0.5.22, tag `v0.5.22`, commit `baa9befa381511cd4d56f83980951e5a45fffc6d`, [github.com/sgl-project/sglang](https://github.com/sgl-project/sglang) | every section |
| Miles 0.1.2, tag `v0.1.2`, commit `a22fd824`, [github.com/radixark/miles](https://github.com/radixark/miles) | [7.2](#s-sglang-as-an-rl-rollout-engine) |
| The capture kit and [its Mac runs](manuals/sglang-101/capture/out), recorded on 2026-10-16 | every section with a listing |
| The GPU kit and [its runs](manuals/sglang-101/capture/gpu), recorded from 2026-10-16 to 2026-10-21 on an NVIDIA L4 node and a DGX Spark (GB10) | every section with a GPU measurement |
| The Miles image `radixark/miles:latest` at Miles commit `08752a12`, with SGLang 0.5.22.dev46+g7b6993a | [7.2](#s-sglang-as-an-rl-rollout-engine) |

## Rank 3: pull requests

The issues are in [the incident index](#s-ref-incident-index). These pull requests explain a design change.

| Pull request | What it changed | Used in |
|---|---|---|
| [#9241](https://github.com/sgl-project/sglang/pull/9241) | warm-up followed by a frozen garbage collector | [1.2](#s-check-that-the-server-is-healthy) |
| [#11210](https://github.com/sgl-project/sglang/pull/11210) | overlap with two CUDA streams in one thread | [2.4](#s-the-overlap-scheduler) |
| [#14312](https://github.com/sgl-project/sglang/pull/14312) | renamed `sgl-router` to `sgl-model-gateway` | [6.4](#s-sgl-model-gateway) |
| [#23906](https://github.com/sgl-project/sglang/pull/23906) | moved the prefill graph field into the per-phase config | [4.1](#s-forwardmode-and-cuda-graphs) |
| [#29458](https://github.com/sgl-project/sglang/pull/29458) | breakable prefill graphs on CUDA | [4.1](#s-forwardmode-and-cuda-graphs) |
| [#32114](https://github.com/sgl-project/sglang/pull/32114) | deleted Cutlass MLA, Dual Chunk FlashAttention, and the plain GPTQ CUDA kernel | [4.2](#s-attention-backend), [4.3](#s-quantization) |
| [#37898](https://github.com/sgl-project/sglang/pull/37898) | raised the decode graph cap on 20 to 35 GB GPUs from 24 to 48 | [4.1](#s-forwardmode-and-cuda-graphs) |
| [#35455](https://github.com/sgl-project/sglang/pull/35455) | loaded the KV scales of compressed-tensors checkpoints, merged 2026-08-20 | [4.3](#s-quantization) |
| [#40795](https://github.com/sgl-project/sglang/pull/40795) | deleted the old benchmark aliases | [5.1](#s-sglang-benchmark-serving) |
| [#41818](https://github.com/sgl-project/sglang/pull/41818) | added `--attn-dp-size` and gave `--dp-size` one meaning | [6.1](#s-tp-size-dp-size-and-attn-dp-size) |
| [#42285](https://github.com/sgl-project/sglang/pull/42285), [#42286](https://github.com/sgl-project/sglang/pull/42286), [#42287](https://github.com/sgl-project/sglang/pull/42287) | remove the torch.compile path for prefill graphs | [4.1](#s-forwardmode-and-cuda-graphs) |

## Rank 4: papers

| Paper | Used in |
|---|---|
| Zheng and others, SGLang: Efficient Execution of Structured Language Model Programs, [arXiv 2312.07104](https://arxiv.org/abs/2312.07104) | [2.2](#s-the-scheduler-loop-and-schedule-policy), [3.1](#s-kv-bytes-per-token-and-the-kv-pool), [3.3](#s-radixcache), [4.5](#s-structured-outputs-with-xgrammar) |
| The tail-optimized LRU policy that the code names, [arXiv 2510.15152](https://arxiv.org/abs/2510.15152) | [3.5](#s-eviction-policies-and-hicache) |
| Lee and others, From Tokens to Layers: Redefining Stall-Free Scheduling for MoE Serving with Layered Prefill, [arXiv 2510.08055](https://arxiv.org/abs/2510.08055) | [2.2](#s-the-scheduler-loop-and-schedule-policy) |
| Liu, Yu, and Yang, When Fancy Eviction Fails: Rethinking Cache Replacement For LLM Prefix Reuse, [arXiv 2609.28870](https://arxiv.org/abs/2609.28870) | [3.5](#s-eviction-policies-and-hicache) |
| Abramovich and others, SPEED-Bench: A Unified and Diverse Benchmark for Speculative Decoding, [arXiv 2604.09557](https://arxiv.org/abs/2604.09557) | [4.4](#s-speculative-decoding), [6.2](#s-moe-serving-deepep-and-eplb) |
| Kumar, Sanghavi, and Das, Test-Time Speculation, [arXiv 2605.09329](https://arxiv.org/abs/2605.09329) | [4.4](#s-speculative-decoding) |
| Agrawal and others, On Evaluating Performance of LLM Inference Serving Systems, [arXiv 2507.09019](https://arxiv.org/abs/2507.09019) | [4.4](#s-speculative-decoding) |
| Zhao and others, CoRun: Padding is Simple and Efficient for Deterministic LLM Inference, [arXiv 2608.14376](https://arxiv.org/abs/2608.14376) | [4.6](#s-deterministic-inference-and-logprobs) |
| Qin and others, Vosti: Specifying, Implementing, and Verifying Deterministic LLM Inference, [arXiv 2609.38981](https://arxiv.org/abs/2609.38981) | [4.6](#s-deterministic-inference-and-logprobs) |
| Patodiya, Same Request, Different Answer: Quantization Amplifies Cache-Induced Divergence in LLM Serving, [arXiv 2609.04748](https://arxiv.org/abs/2609.04748) | [4.6](#s-deterministic-inference-and-logprobs) |
| Chandrasekar and Kramberger, Identifying and Mitigating Systemic Measurement Bias in Production LLM Inference Benchmarks, [arXiv 2605.24217](https://arxiv.org/abs/2605.24217) | [5.1](#s-sglang-benchmark-serving) |
| Li and others, Revisiting Disaggregated Large Language Model Serving for Performance and Energy Implications, [arXiv 2601.08833](https://arxiv.org/abs/2601.08833) | [6.3](#s-prefill-decode-disaggregation) |

## Rank 5: SGLang documentation at the tag

| Page | Used in |
|---|---|
| `docs/docs/hardware-platforms/apple_metal.mdx` | the front matter, [2.1](#s-sglang-serve-and-the-three-processes), [2.4](#s-the-overlap-scheduler) |
| `docs/docs/advanced_features/hyperparameter_tuning.mdx` | [2.3](#s-admission-and-retraction) |
| `docs/docs/advanced_features/hicache_design.mdx` and `radix_eviction_policy.mdx` | [3.5](#s-eviction-policies-and-hicache) |
| `docs/docs/advanced_features/attention_backend.mdx` | [4.2](#s-attention-backend) |
| `docs/docs/advanced_features/quantization.mdx` | [4.3](#s-quantization) |
| `docs/docs/advanced_features/speculative_decoding.mdx` | [4.4](#s-speculative-decoding) |
| `docs/docs/advanced_features/expert_parallelism.mdx` | [6.2](#s-moe-serving-deepep-and-eplb) |
| `docs/docs/advanced_features/pd_disaggregation.mdx` | [6.3](#s-prefill-decode-disaggregation) |
| `docs/docs/get-started/install.mdx` | [7.1](#s-operating-sglang) |
| `docs/docs/advanced_features/sglang_for_rl.mdx` | [7.2](#s-sglang-as-an-rl-rollout-engine) |

## Rank 6: independent field reports

| Author | Report | Month | Used in |
|---|---|---|---|
| AIMultiple | [Inference engines benchmark](https://aimultiple.com/inference-engines) | 2026-01, answer 2026-10 | [1.3](#s-what-the-server-does-with-your-request), [5.3](#s-reading-other-peoples-benchmarks) |
| Alibaba Cloud, RBG and Mooncake teams | [A production inference platform with SGLang RBG and Mooncake](https://www.alibabacloud.com/blog/building-a-production-grade-cloud-native-large-model-inference-platform-with-sglang-rbg-%2B-mooncake_602933) | 2026-03 | [3.5](#s-eviction-policies-and-hicache) |
| Ant Group | [DeepSeek-R1 on H20 with SGLang, on the LMSYS blog](https://www.lmsys.org/blog/2025-09-26-sglang-ant-group/) | 2025-09 | [4.4](#s-speculative-decoding), [6.1](#s-tp-size-dp-size-and-attn-dp-size), [6.2](#s-moe-serving-deepep-and-eplb), [7.1](#s-operating-sglang) |
| basbunarhasan on the NVIDIA developer forum | [SGLang with NVFP4 and DSpark on a DGX Spark](https://forums.developer.nvidia.com/t/qwen3-8-27b-at-34-38-tok-s-on-dgx-spark-open-source-one-command-setup-sglang-nvfp4-dspark/380257) | 2026-08 | [3.2](#s-mem-fraction-static-and-startup-sizing) |
| CERIT-SC | [Running LLMs at CERIT-SC](https://blog.cerit.io/blog/run-llm2/) and [a later post](https://blog-dev.cerit.io/blog/llm3/) | 2025-10, 2026-04 | [7.1](#s-operating-sglang) |
| Cloudflare | [Smaller, faster, safer models](https://blog.cloudflare.com/smaller-faster-safer-models/) | 2026-08 | [3.1](#s-kv-bytes-per-token-and-the-kv-pool), [4.3](#s-quantization) |
| Crusoe | [MLPerf Inference v6.1 results on AMD MI355X](https://www.crusoe.ai/resources/blog/serving-5-75-million-tokens-per-second-crusoes-mlperf-inference-v6-1-results-on-amd-mi355x) | 2026-09 | [5.3](#s-reading-other-peoples-benchmarks), [6.2](#s-moe-serving-deepep-and-eplb) |
| David Noel Ng | [GH200 benchmarking, part 4](https://dnhkng.github.io/posts/gh200-benchmarking-part-4-dsv4-released/) | 2026-08 | [4.4](#s-speculative-decoding) |
| DeepInfra | [vLLM vs SGLang](https://deepinfra.com/blog/vllm-vs-sglang) | 2026-08 | [5.3](#s-reading-other-peoples-benchmarks) |
| Doubleword | [Fast SGLang starts](https://fergusfinn.com/blog/fast-sglang-starts/) | 2026-04 | [7.1](#s-operating-sglang) |
| dstack | [Benchmarking prefill-decode ratios](https://dstack.ai/blog/benchmarking-pd-ratios/) | 2025-09 | [6.3](#s-prefill-decode-disaggregation) |
| Hazy Research | [Tensor-parallel Llama megakernel](https://hazyresearch.stanford.edu/blog/2025-09-28-tp-llama-main) | 2025-09 | [4.1](#s-forwardmode-and-cuda-graphs) |
| InferenceX by SemiAnalysis | [GLM-5 FP8 on MI355X](https://inferencex.semianalysis.com/blog/mi355x-glm5-fp8-sglang-40-cheaper-than-b200), [DeepSeek-V4-Pro on MI355X in 26 days](https://inferencex.semianalysis.com/blog/mi355x-deepseek-v4-pro-sglang-110x-in-26-days), and [GLM-5 NVFP4 on B200](https://inferencex.semianalysis.com/blog/b200-glm5-nvfp4-vs-h200-fp8-3-6x-perf-per-dollar) | 2026-05 | [4.1](#s-forwardmode-and-cuda-graphs), [5.3](#s-reading-other-peoples-benchmarks) |
| Jarvislabs | [SGLang vs vLLM on H100](https://jarvislabs.ai/blog/vllm-sglang-trtllm-comparison) | 2026-05 | [4.1](#s-forwardmode-and-cuda-graphs), [5.3](#s-reading-other-peoples-benchmarks) |
| Jarvislabs | [Managed endpoints](https://jarvislabs.ai/blog/managed-endpoints) | 2026-08 | [3.4](#s-prefix-friendly-prompts), [6.4](#s-sgl-model-gateway) |
| joshua8.ai | [LLM inference benchmark](https://joshua8.ai/llm-inference-benchmark/) | 2026-01 | [4.1](#s-forwardmode-and-cuda-graphs), [4.3](#s-quantization), [5.3](#s-reading-other-peoples-benchmarks) |
| LinkedIn Engineering | [Scaling LLM-based ranking systems with SGLang at LinkedIn](https://www.linkedin.com/blog/engineering/ai/scaling-llm-based-ranking-systems-with-sglang-at-linkedin) | 2026-02 | [1.2](#s-check-that-the-server-is-healthy), [2.1](#s-sglang-serve-and-the-three-processes), [7.1](#s-operating-sglang) |
| Luca Lowndes | [SGLang optimisations](https://luca.lowndes.net/blog/sglang-optimisations) | 2025-11 | [6.1](#s-tp-size-dp-size-and-attn-dp-size) |
| Modal | [LLM almanac](https://modal.com/llm-almanac/summary) | 2025-06 | [5.3](#s-reading-other-peoples-benchmarks) |
| Novita AI | [SGLang with GLM MoE models, on Hugging Face](https://huggingface.co/blog/novita/sglang-glm4-moe) | 2026-01 | [6.3](#s-prefill-decode-disaggregation) |
| Pivot News | [A summary of a mixed Blackwell benchmark](https://pivotnews.ai/build/benchmarking-vllm-vs-sglang-vs-llama-cpp-on-a-mixed-blackwel) | 2026-05 | [4.3](#s-quantization), [5.3](#s-reading-other-peoples-benchmarks) |
| RunPod | [When to choose SGLang over vLLM](https://runpod.ghost.io/when-to-choose-sglang-over-vllm-multi-turn-conversations-and-kv-cache-reuse/) | 2025-06 | [3.3](#s-radixcache), [5.3](#s-reading-other-peoples-benchmarks) |
| SemiAnalysis | [InferenceMAX](https://newsletter.semianalysis.com/p/inferencemax-open-source-inference) | 2025-10 | [5.3](#s-reading-other-peoples-benchmarks) |
| Spheron | [vLLM vs TensorRT-LLM vs SGLang](https://www.spheron.network/blog/vllm-vs-tensorrt-llm-vs-sglang-benchmarks/) | 2026 | [5.3](#s-reading-other-peoples-benchmarks) |
| Steve Rawlinson | [vLLM vs SGLang on dual H100](https://rawlinson.ca/articles/vllm-vs-sglang-performance-benchmark-h100) | 2025-12 | [3.2](#s-mem-fraction-static-and-startup-sizing), [5.3](#s-reading-other-peoples-benchmarks) |
| Thinking Machines | [Defeating nondeterminism in LLM inference](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/) | 2025-09 | [4.6](#s-deterministic-inference-and-logprobs) |
| Varad More | [Inference engine benchmark system](https://github.com/varad-more/inference-engine-benchmark-system) | 2026-04 | [3.3](#s-radixcache), [4.2](#s-attention-backend), [4.5](#s-structured-outputs-with-xgrammar), [5.3](#s-reading-other-peoples-benchmarks) |
| vLLM community | [Discussion #17221](https://github.com/vllm-project/vllm/discussions/17221) | 2025-04 | [5.3](#s-reading-other-peoples-benchmarks) |

## Rank 7: SGLang team and vendor reports

| Author | Report | Month | Used in |
|---|---|---|---|
| The vLLM team | [The state of FP8 KV cache and attention quantization in vLLM](https://vllm.ai/blog/2026-04-22-fp8-kvcache) | 2026-04 | [4.3](#s-quantization) |
| LMSYS | [SGLang with Llama 3](https://www.lmsys.org/blog/2024-07-25-sglang-llama3/) | 2024-07 | [5.3](#s-reading-other-peoples-benchmarks) |
| LMSYS | [SGLang v0.4: zero-overhead batch scheduler](https://lmsys.org/blog/2024-12-04-sglang-v0-4/) | 2024-12 | [2.4](#s-the-overlap-scheduler), [6.1](#s-tp-size-dp-size-and-attn-dp-size), [6.4](#s-sgl-model-gateway) |
| LMSYS | [DeepSeek with PD disaggregation and large-scale EP on 96 H100 GPUs](https://lmsys.org/blog/2025-05-05-large-scale-ep/) | 2025-05 | [6.2](#s-moe-serving-deepep-and-eplb), [6.3](#s-prefill-decode-disaggregation) |
| The Mooncake team on the LMSYS blog | [Kimi K2 with large-scale EP](https://www.lmsys.org/blog/2025-07-20-k2-large-scale-ep/) | 2025-07 | [6.3](#s-prefill-decode-disaggregation) |
| LMSYS | [SGLang HiCache](https://lmsys.org/blog/2025-09-10-sglang-hicache/) | 2025-09 | [3.5](#s-eviction-policies-and-hicache) |
| SGLang | [v0.5.21 release notes](https://github.com/sgl-project/sglang/releases/tag/v0.5.21) | 2026-10 | [3.5](#s-eviction-policies-and-hicache) |
| Google Cloud | [EAGLE-3 on Vertex AI](https://docs.cloud.google.com/gemini-enterprise-agent-platform/blog/posts/from-research-to-production-accelerate-oss-llm-with-eagle-3-on-vertex) | 2025-11 | [4.4](#s-speculative-decoding) |
| Modal with Decagon | [Decagon case study](https://frontend.modal.com/blog/decagon-case-study) | 2025-11 | [4.4](#s-speculative-decoding) |
| LMSYS and RadixArk | [Miles](https://www.lmsys.org/blog/2025-11-19-miles/) | 2025-11 | [7.2](#s-sglang-as-an-rl-rollout-engine) |
| RadixArk | [Miles v0.1](https://www.lmsys.org/blog/2026-08-18-miles-v0-1/) | 2026-08 | [7.2](#s-sglang-as-an-rl-rollout-engine) |
| The Miles team | `docs/advanced/p2p-weight-transfer.md` at Miles v0.1.2 | 2026-10 | [7.2](#s-sglang-as-an-rl-rollout-engine) |

Sources: front.md; the Sources line and the citations of every file under sections/.
