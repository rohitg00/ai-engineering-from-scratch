# Production Quantization — AWQ、GPTQ、GGUF K-quants、FP8、MXFP4/NVFP4

> Quantization format は万能に選ぶものではなく、hardware、serving engine、workload の関数です。GGUF Q4_K_M または Q5_K_M は CPU と edge を担い、llama.cpp と Ollama 経由で提供されます。同じ base で multi-LoRA が必要な vLLM 内では GPTQ が有利です。Marlin-AWQ kernels を使う AWQ は 7B class model で約 741 tok/s を出し、INT4 で最高の Pass@1 を示します。これは 2026 年の datacenter production の default です。FP8 は Hopper、Ada、Blackwell 上で中間の選択肢であり、near-lossless で広くサポートされています。NVFP4 と MXFP4（Blackwell microscaling）は aggressive で、per-block validation が必要です。チームがはまりやすい罠は 2 つあります。Calibration dataset は deployment domain と一致しなければなりません。また KV cache は weight quantization とは別です。「model が 4 GB になった」という AWQ の学びでは、production batch size で 10-30 GB になる KV cache を忘れがちです。

**種別:** 学習
**言語:** Python (stdlib、toy memory and throughput comparison across formats)
**前提条件:** Phase 10 · 13 (Quantization foundations), Phase 17 · 04 (vLLM Serving Internals)
**所要時間:** 約 75 分

## 学習目標

- 2026 年の 6 つの production quantization format と、それぞれの得意領域を挙げられる。
- Hardware（CPU vs GPU、Hopper vs Blackwell）、engine（vLLM、TRT-LLM、llama.cpp）、workload（routine chat、reasoning、multi-LoRA）に応じて format を選べる。
- 選んだ format で節約できる weight memory と、手つかずで残る KV cache を計算できる。
- Quantized model が domain traffic で劣化する calibration-dataset の落とし穴を説明できる。

## 問題

Quantization は memory と HBM bandwidth を減らします。これは decode がまさに必要としているものです。FP16 の 70B model は weights だけで 140 GB です。Weights を INT4（AWQ または GPTQ）に quantize すると model は 35 GB になり、KV cache の余地を残して 1 台の H100 に収まります。これは重要です。128 concurrent sequences、2k context では KV cache だけで 20-30 GB になるからです。

しかし quantization は無料ではありません。Aggressive quantization は quality を劣化させ、特に reasoning-heavy tasks で顕著です。Format ごとに使える engine が違います。Hardware ごとに native support される precision が違います。2026 年の format zoo は現実です。他人の選択をコピーするのではなく、自分の stack に基づいて選ぶ必要があります。

## コンセプト

### 6 つの format

| Format | Bits | Sweet spot | Engines |
|--------|------|-----------|---------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU、edge、laptops | llama.cpp、Ollama |
| GPTQ | 4-8 | vLLM 上の Multi-LoRA | vLLM、TGI |
| AWQ | 4 | Datacenter GPU production | vLLM (Marlin-AWQ)、TGI |
| FP8 | 8 | Hopper/Ada/Blackwell datacenter | vLLM、TRT-LLM、SGLang |
| MXFP4 | 4 | Blackwell multi-user | TRT-LLM |
| NVFP4 | 4 | Blackwell multi-user | TRT-LLM |

### GGUF — CPU/edge の default

GGUF は厳密には quantization scheme ではなく file format です。K-quant variants（Q2_K、Q3_K_M、Q4_K_M、Q5_K_M、Q6_K、Q8_0）を 1 つの container に束ねます。Q4_K_M と Q5_K_M が production default で、4-5 bits でも near-BF16 quality です。llama.cpp は圧倒的に高速な CPU inference engine なので、CPU や edge serving では最良の選択です。

vLLM での throughput penalty は約 93 tok/s（7B）です。この format は GPU kernels 向けに最適化されていません。Deployment target が CPU/edge のときに GGUF を使います。それ以外では使いません。

### GPTQ — vLLM の multi-LoRA

GPTQ は calibration pass を持つ post-training quantization algorithm です。Marlin kernels によって GPU 上で高速になります（non-Marlin GPTQ 比 2.6x speedup）。7B で約 712 tok/s です。

固有の利点は、GPTQ-Int4 が vLLM で LoRA adapters をサポートすることです。Base model と 10-50 個の fine-tuned variants（それぞれ LoRA）を serving するなら、GPTQ が道筋です。2026 年初時点で NVFP4 はまだ LoRA をサポートしていません。

### AWQ — datacenter GPU の default

Activation-aware Weight Quantization です。Quantization 中に最も salient な約 1% の weights を保護します。Marlin-AWQ kernels は naive 実装比 10.9x speedup。7B で約 741 tok/s、INT4 formats の中で最高の Pass@1 です。

Multi-LoRA（GPTQ）や aggressive Blackwell FP4（NVFP4）が必要でない限り、新規 GPU serving では AWQ を選びます。

### FP8 — 信頼できる中間

8-bit floating point です。Near-lossless で、広くサポートされています。Hopper Tensor Cores は FP8 を native acceleration します。Blackwell も引き継いでいます。Quality が譲れない場合（reasoning、medical、code-gen）、FP8 は 2026 年の安全な default です。Memory savings は INT4 の半分ですが、quality risk は大幅に低くなります。

### MXFP4 / NVFP4 — Blackwell aggressive

Microscaling FP4 です。Weights の各 block が独自の scale factor を持ちます。Aggressive ですが Blackwell Tensor Cores で hardware acceleration されます。FP8 と比べて bytes per token を半分にします。これは Phase 17 · 07 の経済的な勝ち筋です。

注意点:
- まだ LoRA support がない（2026 年初）。
- Reasoning-heavy workload では quality drop が見える。
- Model ごとに自分の eval set で validation する。

### Calibration の罠

AWQ と GPTQ は calibration dataset を必要とします。通常は C4 や WikiText です。Domain models（code、medical、legal）で generic web text を使って calibrate すると、algorithm が保護すべき weights を誤って判断します。HumanEval の Pass@1 が数ポイント落ちることがあります。

修正策は、in-domain data で calibrate することです。通常は数百個の domain samples で十分です。Ship 前に eval set で test してください。

### KV cache の罠

AWQ は weights を 4 bits に縮小します。KV cache は別物で、FP16/FP8 のままです。AWQ を使う 70B model の例:

- Weights: 約 35 GB（140 GB から INT4）。
- 128 concurrent × 2k context の KV cache: 約 20 GB。
- Activations: 約 5 GB。
- Total: 約 60 GB — H100 80GB に収まる。

単純に「model を 4 GB に quantize した」と考えると、他の 30-50 GB を忘れます。HBM は全体で budget してください。

別途、KV cache quantization（FP8 KV または INT8 KV）は重みとは別の選択であり、独自の tradeoff があります。Attention accuracy に直接影響し、無料の勝ち筋ではありません。

### AWQ INT4 は reasoning では危険

Chain-of-thought、math、長い context を持つ code-gen は、aggressive quantization の影響をはっきり受けます。AWQ INT4 は MATH で約 3-5 points 落ちます。Reasoning-heavy workloads では FP8 または BF16 を ship し、memory cost を受け入れてください。

### 2026 年の選び方ガイド

- CPU/edge serve: GGUF Q4_K_M。これで完了。
- GPU serve、routine chat、LoRA なし: AWQ。
- GPU serve、multi-LoRA: Marlin 付き GPTQ。
- Reasoning workload: FP8。
- Blackwell datacenter、quality validated: NVFP4 + FP8 KV。
- 曖昧な場合: candidate format ごとに 1,000-sample eval を走らせる。

## 使ってみる

`code/main.py` は、複数の model size に対して 6 つの format の memory footprint（weights + KV + activations）と relative throughput を計算します。KV cache が支配的になる場所、weight compression が効く場所、FP8 が安全な選択になる場所を示します。

## Ship It

このレッスンは `outputs/skill-quantization-picker.md` を生成します。Hardware、model size、workload type、quality tolerance を与えると format を選び、calibration/validation plan を作ります。

## 演習

1. `code/main.py` を実行してください。70B model、128 concurrent、2k context で各 format の total HBM を計算します。1 台の H100 80GB に収められる format はどれですか。
2. 7B coding model があります。Format を選んで理由を述べてください。Quality tolerance の見積もりが誤っていた場合、recovery path は何ですか。
3. Medical domain model の AWQ calibration に必要な calibration-dataset size を計算してください。Data が多ければ常に良いとは限らないのはなぜですか。
4. Marlin-AWQ kernel paper または release notes を読んでください。AWQ が 7B で 741 tok/s を出し、raw GPTQ が約 712 にとどまる理由を 3 文で説明してください。
5. AWQ weights と FP8 KV cache を組み合わせるのはどんな場合に意味があり、KV を BF16 のままにするのはどんな場合ですか。

## 重要用語

| Term | よく言われること | 実際の意味 |
|------|----------------|------------|
| GGUF | "llama.cpp format" | K-quant variants を束ねる file format。CPU/edge default |
| Q4_K_M | "Q4 K M" | 4-bit K-quant medium。production GGUF default |
| GPTQ | "gee pee tee q" | Calibration 付き post-train INT4。vLLM で LoRA をサポート |
| AWQ | "a w q" | Activation-aware INT4。Marlin kernels。INT4 で最高の Pass@1 |
| Marlin kernels | "fast INT4 kernels" | Hopper 上の INT4 用 custom CUDA kernels。10x speedup |
| FP8 | "eight-bit float" | Hopper/Ada/Blackwell 上の安全な precision default |
| MXFP4 / NVFP4 | "microscaling four" | Per-block scale factor を持つ Blackwell 4-bit FP |
| Calibration dataset | "cal data" | Quantization parameters を選ぶための input text。domain と一致が必要 |
| KV cache quantization | "KV INT8" | Weights とは別の選択。attention accuracy に影響 |

## 参考資料

- [VRLA Tech — LLM Quantization 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/) — 比較 benchmark。
- [Jarvis Labs — vLLM Quantization Complete Guide](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks) — format 別 throughput 数値。
- [PremAI — GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/) — format ごとの選び方。
- [vLLM docs — Quantization](https://docs.vllm.ai/en/latest/features/quantization/index.html) — supported formats and flags。
- [AWQ paper (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978) — AWQ の元論文。
- [GPTQ paper (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323) — GPTQ の元論文。
