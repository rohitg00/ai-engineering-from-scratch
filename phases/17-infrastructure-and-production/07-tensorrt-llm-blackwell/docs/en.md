# FP8 と NVFP4 を使う Blackwell 上の TensorRT-LLM

> TensorRT-LLM は NVIDIA-only ですが、Blackwell では勝ちます。GB200 NVL72 と Dynamo orchestration では、SemiAnalysis InferenceX が 2026 年 Q1-Q2 に 120B model で $0.012 per million tokens を測定しました。H100 + vLLM の $0.09/M に対して 7x の economic gap です。この stack は 3 つの floating-point regime が重なっています。FP8 は必要な dynamic range を持つため KV cache と attention kernels で critical のままです。NVFP4 (4-bit microscaling) は weights と activations を扱います。multi-token prediction (MTP) と disaggregated prefill/decode がさらに 2-3x を積みます。Day-0 model support は post-training conversion なしに FP4 weights を直接 load します。2026 年の engineering team にとっての catch は、TRT-LLM が closed NVIDIA stack であり、採用は portability と throughput の tradeoff になることです。commit する前に、自分たちの model/hardware mix で math を走らせてください。

**種別:** 学習
**言語:** Python (stdlib, toy FP8/NVFP4 memory and cost calculator)
**前提条件:** Phase 17 · 04 (vLLM Serving Internals), Phase 10 · 13 (Quantization)
**所要時間:** 約75分

## Learning Objectives

- weights が NVFP4 でも、KV cache と attention で FP8 が critical のままなのはなぜか説明する。
- BF16、FP8、NVFP4 における frontier model の HBM footprint を計算し、saving がどこから来るか reason する。
- TRT-LLM が利用する Blackwell-specific features (day-0 FP4、MTP、disaggregated serving、all-to-all primitives) を naming する。
- TRT-LLM の NVIDIA-lock が Hopper 上の vLLM に対する 7x cost gap に見合う場面を判断する。

## 問題

2026 年の inference economics の frontier は「dollar あたり tokens 数」です。答えは 4 つの選択の stack に依存します。hardware generation (Hopper H100/H200 vs Blackwell B200/GB200)、precision (BF16 → FP8 → NVFP4)、serving engine (vLLM vs SGLang vs TRT-LLM)、orchestration (plain vs disaggregated vs Dynamo) です。

Hopper + vLLM では、120B MoE は約 $0.09 per million tokens で動きます。Blackwell + TRT-LLM + Dynamo では、同じ model が約 $0.012、つまり 7x cheap に動きます。gap の一部は hardware です (Blackwell は Hopper に対して per-GPU LLM throughput が 11-15x)。一部は stack です。FP4 weights、MTP draft、disaggregated prefill/decode、MoE expert communication 向け NVLink 5 all-to-all です。

これは NVIDIA stack 外では再現できません。つまり tradeoff は portability と economics です。gap のどの share がどの stack choice から来るのか理解することが、この lesson の目的です。

## The Concept

### KV cache では FP8 がまだ floor である理由

2026 年の common mistake は、NVFP4 が everywhere に適用できると思うことです。できません。KV cache は FP8 (8-bit floating point) を必要とします。attention keys と values は wide dynamic range にまたがるからです。KV を FP4 に quantize すると catastrophic accuracy loss が起きます。distribution tail が落ち、attention scores が collapse します。FP8 の exponent bits が KV cache に必要な range を与えます。

NVFP4 (2025-2026) は weights と activations に適用されます。microscaling では、weights block ごとに独自の scale factor を持たせます。small blocks が per-tensor scale loss なしに異なる dynamic range を持てるようにするためです。activations は layer 内で small-range なので FP4 でも持ちます。

typical Blackwell config:

- Weights: NVFP4 (4-bit microscaling)。
- Activations: NVFP4。
- KV cache: FP8。
- Attention accumulator: FP32 (softmax stability)。

### TRT-LLM が使う Blackwell-specific primitives

- **Day-0 FP4 weights**: model providers が FP4 weights を直接出荷し、TRT-LLM は post-training conversion なしに load します。FP4 用の AWQ / GPTQ step は不要です。
- **Multi-token prediction (MTP)**: EAGLE (Phase 17 · 05) と同じ idea ですが、TRT-LLM build に integrated されています。
- **Disaggregated serving**: prefill と decode を separate GPU pools に置き、KV cache を NVLink または InfiniBand で転送します。Dynamo (Phase 17 · 20) と同じ idea です。
- **All-to-all communication primitives**: NVLink 5 は Hopper 比で MoE expert communication latency を 3x 削減しました。TRT-LLM の MoE kernels はこれに tune されています。
- **NVFP4 + MXFP8 microscaling**: Blackwell Tensor Cores 上で scale-factor handling が hardware-accelerated されています。

### 覚えるべき数字

- HGX B200 は TRT-LLM で GPT-OSS-120B を $0.02/M tokens。
- GB200 NVL72 は Dynamo (TRT-LLM orchestration) で $0.012/M tokens。
- H100 + vLLM は comparable workload で約 $0.09/M tokens。
- 2026 年の TRT-LLM updates 3 か月で throughput gain 2.8x。
- Blackwell vs Hopper は per-GPU LLM throughput 11-15x。
- MLPerf Inference v6.0 (2026 年 4 月): Blackwell は submitted task すべてで dominant。

### FP4 が quality に与える実際の cost

NVFP4 は aggressive です。reasoning-heavy workloads (chain-of-thought、math、long context の code-gen) では FP4 weights は visibly に degrade します。per-block calibration は緩和しますが消しません。reasoning model を出荷する team は、compromise として FP8 weights + FP4 activations を使うか、H200 で throughout FP8 に留まることがあります。

rule: NVFP4 weights に commit する前に、必ず eval set で task quality を validate してください。

### なぜ NVIDIA-lock decision なのか

TRT-LLM は C++ + CUDA + closed-source kernels です。model は specific GPU SKU 向けに compile する必要があります。AMD なし、Intel なし、ARM なし。infra strategy が multi-vendor なら、TRT-LLM-served tier に TRT-LLM は non-starter です。mixed hardware では vLLM で serve できます。NVIDIA-only なら 7x gap が lock-in の代金を払います。

### 2026 practical recipe

年間 inference bill が $100M+ なら、Hopper + vLLM のままでは 7-10x を table に残しています。cost-dominant workload を Blackwell + TRT-LLM + Dynamo へ migrate します。model iteration speed のために experimentation tier は H100 + vLLM に残します。本番前に各 NVFP4-converted model の quality を validate します。

### disaggregation bonus

TRT-LLM の disaggregated serving (separate prefill and decode pools) は Phase 17 · 20 で詳しく扱います。Blackwell では multiplier が stack します。FP4 weights × MTP speedup × disaggregated placement × cache-aware routing です。7x の数字はこの full stack を仮定しています。

## Use It

`code/main.py` は HBM footprint、decode throughput (memory-bound regime)、$/M-tokens を 3 stack で計算します。H100 + BF16 + vLLM、H100 + FP8 + vLLM、B200 + NVFP4/FP8 + TRT-LLM です。実行すると compounding effect と、gap の各 share が見えます。

## Ship It

この lesson は `outputs/skill-trtllm-blackwell-advisor.md` を生成します。workload、model size、annual token volume が与えられると、Blackwell + TRT-LLM stack が NVIDIA-lock に見合うかを判断します。

## Exercises

1. `code/main.py` を実行してください。active parameters 30% の 120B MoE で、H100 BF16、H100 FP8、B200 NVFP4/FP8 の memory-bandwidth-limited decode throughput を計算してください。最大の jump はどこから来ますか。
2. customer が H100 + vLLM に年間 $2M を使っています。7x economic gap を前提に、12 か月で TRT-LLM migration を amortize するには Blackwell GPU を何台買う必要がありますか。
3. NVFP4 weight conversion 後に MATH accuracy が 3 points 落ちました。recovery path を 2 つ挙げてください。quality-first (FP8 weights を維持) と cost-first (in-domain data で calibrate) です。
4. MLPerf v6.0 inference results を読んでください。Blackwell-over-Hopper gap が最小の task はどれで、なぜですか。
5. 405B model を NVFP4 weights + FP8 KV cache、128k context で動かす HBM を計算してください。single GB200 NVL72 node に収まりますか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| FP8 | 「eight-bit float」 | 8-bit floating point。dynamic range のため KV cache と attention に使う |
| NVFP4 | 「four-bit micro」 | NVIDIA の 4-bit microscaling FP format。Blackwell 上の weights と activations |
| MXFP8 | 「MX eight」 | microscaling FP8 variant。Blackwell Tensor Cores で hardware-accelerated |
| Day-0 FP4 | 「FP4 weights を出荷」 | model providers が FP4 weights を既に release し、post-train conversion が不要 |
| MTP | 「multi-token prediction」 | TRT-LLM の integrated speculative-decoding draft (Phase 17 · 05) |
| Disaggregated serving | 「prefill/decode を分離」 | prefill と decode を separate GPU pools へ置き、KV を NVLink/IB で転送 |
| All-to-all | 「MoE expert comm」 | tokens を expert GPUs に route する communication pattern。NVLink 5 が 3x 削減 |
| InferenceX | 「SemiAnalysis inference bench」 | 2026 年の industry-accepted cost-per-token benchmark |

## 参考文献

- [NVIDIA — Blackwell Ultra MLPerf Inference v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/) — 2026 年 4 月 MLPerf results。
- [NVIDIA — MoE Inference on Blackwell](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/) — NVLink 5 all-to-all と MoE kernels。
- [TensorRT-LLM Overview](https://nvidia.github.io/TensorRT-LLM/overview.html) — 公式エンジンドキュメント。
- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) — TRT-LLM 上の disaggregated orchestration。
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) — Blackwell numbers を publish する benchmark suite。
