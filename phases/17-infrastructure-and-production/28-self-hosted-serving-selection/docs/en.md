# Self-Hosted Serving Selection — llama.cpp、Ollama、TGI、vLLM、SGLang

> 2026 年の self-hosted inference は 4 つの engines が支配しています。hardware、scale、ecosystem に基づいて選びます。**llama.cpp** は CPU で最速です。model support が最も広く、quantization と threading を完全に制御できます。**Ollama** は dev-laptop の one-command install で、llama.cpp より約 15-30% 遅いです (Go + CGo + HTTP serialization)。prod-like load では throughput gap が 3 倍になります。**TGI entered maintenance mode December 11, 2025** — 今後は bug fixes のみです。raw throughput は vLLM より約 10% 遅いものの、historically には top observability と HF-ecosystem integration が強みでした。この maintenance status により、long-term bet としては risk が高く、新規 projects では SGLang または vLLM がより安全な defaults です。**vLLM** は general-purpose production default です。v0.15.1 (2026 年 2 月) は PyTorch 2.10、RTX Blackwell SM120、H200 optimization を追加しました。**SGLang** は agentic multi-turn / prefix-heavy specialist です。production で 400,000+ GPUs が稼働しています (xAI、LinkedIn、Cursor、Oracle、GCP、Azure、AWS)。Hardware constraints: CPU-only → llama.cpp のみ。AMD / non-NVIDIA → vLLM のみ (TRT-LLM は NVIDIA-locked)。2026 pipeline pattern: dev = Ollama、staging = llama.cpp、prod = vLLM または SGLang。同じ GGUF/HF weights を全体で使います。

**種類:** Learn
**言語:** Python (標準ライブラリ、engine-decision tree walker)
**前提:** engines を扱う Phase 17 の全 lessons (04、06、07、09、18)
**時間:** 約 45 分

## 学習目標

- hardware (CPU / AMD / NVIDIA Hopper / Blackwell)、scale (1 user / 100 / 10,000)、workload (general chat / agent / long-context) に応じて engine を選ぶ。
- 2026 年時点の TGI maintenance-mode status (2025 年 12 月 11 日) と、それが新規 projects を vLLM または SGLang に寄せる理由を説明する。
- 同じ GGUF または HF weights を使い続ける dev/staging/prod pipeline を説明する。
- 「CPU only」が llama.cpp を強制し、「AMD」が TRT-LLM を除外する理由を説明する。

## 問題

team が新しい self-hosted LLM project を始めます。ある engineer は Ollama と言い、別の engineer は vLLM と言い、3 人目は「TGI は out of the box で動くんじゃないの?」と言います。3 人とも、違う context では正しいです。すべてに正しいものはありません。

2026 年には choice tree が重要です。hardware first、scale second、workload third。そして 2025 年の特定の event、TGI が 12 月 11 日に maintenance mode に入ったことが、新規 projects の default を変えます。

## コンセプト

### 5 つの engines

| Engine | Best for | Notes |
|--------|----------|-------|
| **llama.cpp** | CPU / edge / minimal deps / widest model support | CPU で最速、full control |
| **Ollama** | Dev laptops、single user、one-command install | llama.cpp より 15-30% 遅い。prod throughput gap は 3 倍 |
| **TGI** | HF ecosystem、regulated industries | **Maintenance mode Dec 11, 2025** |
| **vLLM** | General-purpose production、100+ users | 幅広い production default。v0.15.1 Feb 2026 |
| **SGLang** | Agentic multi-turn、prefix-heavy workloads | production で 400,000+ GPUs |

### Hardware-first decision

**CPU only** → llama.cpp。Ollama も動きますが遅いです。CPU で競争力のある他 engine はありません。

**AMD GPU** → vLLM (AMD ROCm support)。SGLang も動きます。TRT-LLM は NVIDIA-locked なので除外します。

**NVIDIA Hopper (H100 / H200)** → vLLM、SGLang、または TRT-LLM。3 つとも top-tier です。

**NVIDIA Blackwell (B200 / GB200)** → TRT-LLM が throughput leader です (Phase 17 · 07)。vLLM と SGLang が僅差で続きます。

**Apple Silicon (M-series)** → llama.cpp (Metal)。Ollama はこれを wrap します。

### Scale-second decision

**1 user / local dev** → Ollama。one command で、first-token は数秒です。

**10-100 users / small team** → vLLM single-GPU。

**100-10k users / production** → vLLM production-stack (Phase 17 · 18) または SGLang。

**10k+ users / enterprise** → vLLM production-stack + disaggregated (Phase 17 · 17) + LMCache (Phase 17 · 18)。

### Workload-third decision

**General chat / Q&A** → broad default として vLLM が勝ちます。

**Agentic multi-turn (tools、planning、memory)** → SGLang の RadixAttention (Phase 17 · 06) が強いです。

**heavy prefix reuse の RAG** → SGLang。

**Code generation** → vLLM で十分。cache では SGLang がやや有利です。

**Long context (128K+)** → vLLM + chunked prefill、または SGLang + tiered KV。

### TGI maintenance trap

Hugging Face TGI は 2025 年 12 月 11 日に maintenance mode に入りました。今後は bug fixes のみです。historically には top-tier observability、best-in-class HF-ecosystem integration (model cards、safety tools)、raw throughput は vLLM より少し後ろ、という位置づけでした。

2026 年の new projects では、TGI を default にしません。既存 TGI deployments は継続できますが、最終的には migrate すべきです。SGLang と vLLM の方が安全な defaults です。

### Pipeline pattern

Dev (Ollama) → staging (llama.cpp) → prod (vLLM)。同じ GGUF または HF weights を全体で使います。engineers は laptops で素早く iterate し、staging は production quantization を mirror し、prod が serving target になります。

### Ollama caveat

Ollama は dev には優れています。shared production には向きません。Go HTTP serialization が overhead を追加し、concurrency management は vLLM より単純で、OpenTelemetry support も遅れています。Ollama が得意な場所、つまり one user、one command で使い、shared では vLLM に切り替えます。

### Self-hosted と managed は別の判断

Phase 17 · 01 (managed hyperscalers)、· 02 (inference platforms) は managed を扱います。この lesson は self-host すると既に決めた前提です。self-host する理由: data residency、custom fine-tune、scale したときの total cost ownership、hosted で使えない domain model。

### 覚えておくべき数字

- TGI maintenance mode: 2025 年 12 月 11 日。
- vLLM v0.15.1: 2026 年 2 月。PyTorch 2.10。Blackwell SM120 support。
- SGLang production footprint: 400,000+ GPUs。
- Ollama throughput gap vs llama.cpp: 15-30% 遅い。prod load 下では 3 倍。

## 使ってみる

`code/main.py` は decision-tree walker です。hardware + scale + workload を受け取り、engine を選び、その理由を説明します。

## 成果物

この lesson では `outputs/skill-engine-picker.md` を作ります。constraints を受け取り、engine を選び、migration plan を書きます。

## 演習

1. 自分の hardware / scale / workload で `code/main.py` を実行してください。output は直感と一致しますか。
2. infra は 12 H100s と 8 MI300X AMD です。どの engine を選びますか。なぜ TRT-LLM は候補外ですか。
3. ある team が「慣れているから」という理由で 2026 年に TGI を使いたいと言っています。migration case を論じてください。
4. Ollama dev から vLLM prod へ移るとき、quantization、configuration、observability は何が変わりますか。
5. P99 prefix length 8K で tenants 間の reuse が高い RAG product。engine を選び、Phase 17 · 11 + 18 と組み合わせてください。

## 重要語句

| 用語 | よくある言い方 | 実際の意味 |
|------|----------------|------------------------|
| llama.cpp | 「CPU のもの」 | widest model support、CPU で最速 |
| Ollama | 「laptop のもの」 | one-command install、dev-grade throughput |
| TGI | 「HF の serving」 | 2025 年 12 月から maintenance mode |
| vLLM | 「default」 | 2026 年の broad production baseline |
| SGLang | 「agentic のもの」 | prefix-heavy、RadixAttention |
| TRT-LLM | 「NVIDIA-locked」 | Blackwell throughput leader、NVIDIA only |
| GGUF | 「llama.cpp format」 | bundled K-quant variants |
| Production-stack | 「vLLM K8s」 | Phase 17 · 18 reference deployment |
| Pipeline pattern | 「dev→stage→prod」 | 同じ weights で Ollama → llama.cpp → vLLM |

## 参考資料

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI maintenance announcement](https://github.com/huggingface/text-generation-inference) — release notes.
- [vLLM v0.15.1 release notes](https://github.com/vllm-project/vllm/releases)
