# Multi-Region LLM Serving と KV Cache Locality

> Round-robin load balancing は cached LLM inference では積極的に有害です。Prefix を持つ node に着地しない request は full prefill cost を支払います。長い prompt では P50 で約 800 ms かかる一方、cache hit なら約 80 ms です。2026 年の production pattern は cache-aware router（Rust の vLLM Router、llm-d router）で、KV-cache events を取り込み、prefix-hash match に基づいて route します。Recent research（GORGO）は cross-region network latency を routing objective の明示的な項にします。Commercial な "cross-region inference" offerings（Bedrock cross-region inference、GKE multi-cluster gateways）は inference を opaque に扱います。Availability は扱いますが TTFT は扱いません。JPMorgan と Mayo Clinic は 2024 年 11 月に us-east-1 failover を実施し、約 22 分でした。DR の現実: LLM DR failures の 32% は、team が weights を backup したものの tokenizer files や quantization configs を忘れたことが原因です。

**種別:** 学習
**言語:** Python (stdlib、toy prefix-cache-aware router simulator)
**前提条件:** Phase 17 · 04 (vLLM Serving), Phase 17 · 06 (SGLang RadixAttention)
**所要時間:** 約 60 分

## 学習目標

- Round-robin load balancing が cached inference を壊す理由を説明し、TTFT penalty を定量化できる。
- Cache-aware router を図解できる: inputs（KV-cache events）、algorithm（prefix-hash match）、tie-breaker（GPU utilization）。
- LLM の 32% DR failure driver（missing tokenizer files / quantization configs）を挙げ、3-file DR checklist を示せる。
- Commercial cross-region offerings（Bedrock CRI、GKE Multi-Cluster Gateway）と KV-aware routing を区別できる。

## 問題

Service は us-east-1、us-west-2、eu-west-1 で動いています。前段に round-robin の ALB を置きました。Production の prefix cache hit rate は 8% まで落ちました。TTFT P50 は 3 倍になりました。vLLM logs には、すべての request が full prefill cost を支払っていることが示されています。

Round-robin は stateless services では最適です。LLM inference は設計上 stateful です。KV cache は model が見たすべてを encode します。盲目的に route することは、間違った cache に route することです。

別の問題として、team には DR plan があります。Model weights を S3 cross-region に backup しています。Regional outage が起き、failover を試みると replica が起動を拒否します。`tokenizer.json`、quantization config、RoPE scaling config が別 bucket にあり、sync していませんでした。

Multi-region LLM serving は cache problem、routing problem、DR-hygiene problem であり、load-balancer problem ではありません。

## コンセプト

### Cache-aware routing

Request が prompt とともに到着します。Router は prefix（例: first 512 tokens）を hash し、各 replica に「この prefix を cache しているか」を尋ねます。Replicas は block を allocate/evict するたびに pub/sub channel へ KV-cache events を publish します。Router は match した replica を選び、誰も match しなければ GPU-util-based tie-breaker に fall through します。

**vLLM Router**（Rust、2026 production-stack）: `kv.cache.block_added` events を subscribe し、prefix-hash → replica index を保持し、O(1) lookup で route します。Match がない場合は least-queue-depth に fall through します。

**llm-d router**: 同じ pattern で Kubernetes-native です。ControlPlane API 経由で events を publish します。

**SGLang RadixAttention**（Phase 17 · 06）は intra-replica equivalent です。Cross-replica routing はその upstream にあります。

### 数値

2K-token prompt、Llama 3.3 70B FP8、H100 での TTFT P50:
- Cache hit（same replica、prefix resident）: 約 80 ms。
- Cache miss（cold prefill）: 約 800 ms。

10x の差です。Router が replicas 全体で prefix cache の 60-80% に hit できれば、N-replica capacity で single-replica performance に近づきます。10% しか hit できない場合、naive scaling に近づきます。

### Cross-region には新しい制約がある — network latency

Inter-region RTT:
- us-east-1 ↔ us-west-2: 約 65 ms。
- us-east-1 ↔ eu-west-1: 約 75 ms。
- us-east-1 ↔ ap-southeast-1: 約 220 ms。

Routing が us-east-1 の request を ap-southeast-1 の hot prefix に送ると、保存できる prefill（800 → 80 ms）は 440 ms の round-trip によって薄まります。GORGO（2026 research）はこれを明示します。Prefill だけでなく `prefill_time + network_latency` を同時に minimize します。多くの場合、massive multi-MB prefixes で prefill が支配的な場合を除き、regional routing に留めるのが答えです。

### Commercial "cross-region inference" はここでは役に立たない

AWS Bedrock cross-region inference は capacity pressure 時に requests を他 region へ自動 route します。Availability を最適化するもので、TTFT ではありません。Inference を opaque に扱います。GKE Multi-Cluster Gateway も同じです。Service-level failover であり、KV cache awareness はありません。

これらを使っていても、app-layer cache-aware router は必要です。それらは「us-east-1 が燃えている」ケースを扱います。Cache-aware routing は TTFT のケースを扱います。

### DR hygiene — 32% missing-files problem

広く引用される 2026 年の統計: LLM DR failures の 32% は、team が weights を backup したものの次を忘れたことで発生します。

- `tokenizer.json` または `tokenizer.model`
- Quantization configs（`quantize_config.json`、AWQ scales、GPTQ zero-points）
- Model-specific configs（RoPE scaling、attention masks、chat templates）
- Engine config（`vllm_config.yaml`、sampling defaults、LoRA adapter manifests）

修正策は 3-file minimum DR manifest です。

1. HF model repo 配下のすべての file（weights + configs + tokenizer）。
2. Engine-specific serving config。
3. Deployment manifest（K8s YAML、Dockerfile、dependency lock）。

さらに、四半期ごとに DR drill を実行してください。JPMorgan の us-east-1 drill が 2024 年 11 月に 22 分 recovery を達成できたのは、playbook を rehearsal していたからです。

### Data residency は直交する

EU customer PHI は EU を出られません。Cache-aware router が prefix match のために Paris-originated request を us-east-1 に送れば、TTFT gain に関係なく GDPR に違反しています。Cache を最適化する前に、residency boundary ごとに routers を partition してください。

### 覚えておくべき数値

- Cache hit vs miss TTFT gap: 約 10x（2K prompt で 80 ms vs 800 ms）。
- Inter-region RTT US-EU: 約 75 ms。
- DR failure: 32% は tokenizer/quant configs の欠落。
- JPMorgan us-east-1 failover 2024 年 11 月: 22 分（30-min SLA）。

## 使ってみる

`code/main.py` は multi-region workload 上で 3 つの routing strategies（round-robin、cache-aware regional、cache-aware global）を simulate します。Cache hit rate、TTFT P50/P99、cross-region bill を報告します。

## Ship It

このレッスンは `outputs/skill-multi-region-router.md` を生成します。Regions、residency constraints、SLA を与えると routing plan を設計します。

## 演習

1. `code/main.py` を実行してください。75 ms RTT の場合、どの prompt length で cross-region routing が local-only routing に勝ちますか。
2. Cache hit rate が 70% から 12% に落ちました。考えられる原因を 3 つと、それぞれを確認する observables を挙げてください。
3. vLLM で 5 つの LoRA adapters とともに serving される 70B AWQ-quantized model の DR manifest を設計してください。すべての file と config を列挙してください。
4. Strict TTFT SLO を持つ fintech にとって Bedrock cross-region inference が「十分」かどうかを論じてください。具体的な behaviors を引用してください。
5. Paris-origin request が us-east-1 の prefix と match しました。Route しますか。Policy を書いてください。

## 重要用語

| Term | よく言われること | 実際の意味 |
|------|----------------|------------|
| Cache-aware routing | "smart LB" | Prefix-hash match に基づき、KV-cache を持つ replica へ route |
| KV-cache events | "cache pub-sub" | Replicas が block add/evict を publish し、router が index |
| Prefix hash | "cache key" | Router lookup に使う first N tokens の hash |
| GORGO | "cross-region routing research" | arXiv 2602.11688。network latency を明示的な項にする |
| Cross-region inference | "Bedrock CRI" | AWS product。availability failover であり TTFT awareness ではない |
| DR manifest | "the backup list" | Restore に必要なすべての file。weights だけではない |
| Data residency | "GDPR boundary" | どの region が user data を見られるかの法的制約 |
| RTT | "round-trip time" | Network latency。US-EU 75 ms、US-APAC 220 ms |
| LLM-aware LB | "cache-hit LB" | Product category としての cache-aware router |

## 参考資料

- [BentoML — Multi-cloud and cross-region inference](https://bentoml.com/llm/infrastructure-and-operations/multi-cloud-and-cross-region-inference)
- [arXiv — GORGO (2602.11688)](https://arxiv.org/html/2602.11688v1) — network latency term を持つ cross-region KV-cache reuse。
- [TianPan — Multi-Region LLM Serving Cache Locality](https://tianpan.co/blog/2026-04-17-multi-region-llm-serving-data-residency-routing)
- [AWS Bedrock Cross-Region Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html) — availability failover documentation。
- [vLLM Production Stack Router](https://github.com/vllm-project/production-stack) — cache-aware router source。
