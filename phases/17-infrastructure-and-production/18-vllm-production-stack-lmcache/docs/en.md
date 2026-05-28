# LMCache KV Offloading を使う vLLM Production Stack

> vLLM の production-stack は reference Kubernetes deployment です。router、engines、observability が一緒に wire されています。LMCache は GPU memory から KV cache を取り出し、query と engines をまたいで reuse する KV-offloading layer です (CPU DRAM、次に disk/Ceph)。vLLM 0.11.0 KV Offloading Connector (2026 年 1 月) は Connector API (v0.9.0+) によりこれを asynchronous かつ pluggable にします。offload latency は user-facing ではありません。LMCache は shared prefix がなくても有用です。GPU の KV slots が枯渇したとき、preempted requests を prefill 再計算ではなく CPU から restore できるからです。4 台の a3-highgpu-4g にまたがる 16x H100 (80GB HBM) benchmark では、KV cache が HBM を超えると native CPU offload と LMCache はどちらも throughput を大きく改善します。KV footprint が小さい場合、全 config は小さな overhead つきで baseline と同等です。

**種別:** 学習
**言語:** Python (stdlib, toy KV-spill simulator)
**前提条件:** Phase 17 · 04 (vLLM Serving Internals), Phase 17 · 06 (SGLang/RadixAttention)
**所要時間:** 約60分

## 学習目標

- vLLM production-stack layer を diagram する: router、engines、KV offload、observability。
- KV Offloading Connector API (v0.9.0+) と、0.11.0 asynchronous path が offload latency をどう隠すか説明する。
- LMCache CPU-DRAM が効く場合 (KV > HBM) と overhead になる場合 (KV が HBM に収まる) を定量化する。
- deployment constraints に応じて native vLLM CPU offload と LMCache connector を選ぶ。

## 課題

vLLM serving で concurrency が上がるたびに GPU が HBM 100% となり preemption events が発生しています。requests は evict され requeue され、同じ 2K-token prompt を 1 分に 4 回 re-prefill しています。GPU compute は redundant prefill に使われ、goodput は raw throughput を大きく下回ります。

GPU を増やすと cost は線形に増えます。HBM を増やすことはできません。しかし CPU DRAM は安いです。1 socket に 512 GB+ を載せられ、latency は HBM より桁違いに悪いものの、「一時的に warm」な KV cache には十分です。

LMCache は KV cache を CPU DRAM に抽出し、preempted requests を高速に recover します。また engines をまたいだ repeated prefixes を共有し、各 engine が再度 prefill することを避けます。

## コンセプト

### vLLM production-stack

`github.com/vllm-project/production-stack` は reference Kubernetes deployment です。

- **Router** — cache-aware (Phase 17 · 11)。KV events を consume します。
- **Engines** — vLLM workers。GPU ごと、または TP/PP group ごとに 1 つ。
- **KV cache offload** — LMCache deployment または native connector。
- **Observability** — Prometheus scrape、Grafana dashboards、OTel traces。
- **Control plane** — service discovery、config、rolling updates。

Helm chart + operator として出荷されます。

### KV Offloading Connector API (v0.9.0+)

vLLM 0.9.0 は pluggable KV cache backends 用の Connector API を導入しました。engine は blocks を connector に offload し、connector が保存します (RAM、disk、object storage、LMCache)。request が block を必要とすると、connector が load back します。

vLLM 0.11.0 (2026 年 1 月) は asynchronous offload path を追加しました。offload は background で行えるため、common case で engine は block しません。ただし end-to-end latency と throughput は workload shape、KV cache hit rate、system pressure に依存します。vLLM notes も、custom-kernel offload は low hit rate で throughput を degrade しうること、async scheduling は speculative decoding と既知の interaction issue を持つことを明記しています。

### Native CPU offload vs LMCache

**Native vLLM CPU offload**: engine-local。host RAM に KV blocks を保存します。実装が速く、network hop がありません。ただし engines をまたぎません。

**LMCache connector**: cluster-scale。shared LMCache server (CPU DRAM + Ceph/S3 tier) に blocks を保存します。任意の engine から access できます。16x H100 benchmark が公開されています。

single engine が HBM pressure を持つだけなら native を選びます。複数 engines が prefix を共有する場合 (common system prompts の RAG、shared templates の multi-tenant) は LMCache を選びます。

### benchmark の挙動

4 台の a3-highgpu-4g にまたがる 16x H100 (80 GB HBM) test:

- Low KV footprint (short prompts, low concurrency): 全 config は baseline と一致し、LMCache は約 3-5% overhead。
- Moderate footprint: LMCache は engines をまたいだ prefix reuse で効き始める。
- KV exceeds HBM: native CPU offload と LMCache はどちらも throughput を大きく改善。cross-engine sharing のため LMCache の gain が大きい。

### LMCache が decisive な場合

- tenants 間で system prompts を共有する multi-tenant serving。
- document chunks が queries 間で repeat する RAG。
- 同じ base 上の fine-tuned variants (LoRA)。base-model KV reuse が redundant work を減らす。
- preemption-heavy workloads。CPU から restore する方が re-prefill より安い。

### 有効化しない方がよい場合

- HBM pressure が小さい。benefit なしに overhead を払う。
- short contexts (<1K tokens)。transfer time が re-prefill を上回る。
- single-tenant single-prompt workload。capturable reuse がない。

### disaggregated serving との統合

Phase 17 · 17 の disaggregated serving + LMCache は相乗します。prefill pool から decode pool へ transfer された KV は、使われなければ LMCache に着地します。subsequent queries は LMCache から pull できます。Phase 17 · 11 の cache-aware router は local cache または LMCache-shared cache が match する engine へ route できます。

### 覚えるべき数字

- vLLM 0.9.0: Connector API shipped。
- vLLM 0.11.0 (Jan 2026): asynchronous offload path。end-to-end latency impact は workload、KV hit rate、system pressure 依存。
- 16x H100 benchmark: KV footprint が HBM を超えると LMCache が効く。
- 小さな HBM pressure: benefit なしで 3-5% overhead。

## 使ってみる

`code/main.py` は LMCache あり/なしの preemption-heavy workload を simulate します。avoided re-prefills、throughput gain、break-even HBM utilization を報告します。

## 成果物

この lesson は `outputs/skill-vllm-stack-decider.md` を生成します。workload shape と vLLM deployment が与えられると、native、LMCache、neither のどれを選ぶか判断します。

## 演習

1. `code/main.py` を実行してください。どの HBM utilization から LMCache が pay し始めますか。
2. tenant が 6K-token system prompt を 200 queries/hour で共有しています。tenant ごとの expected LMCache savings を計算してください。
3. LMCache server は single point of failure です。HA strategy (replicas、native fallback) を設計してください。
4. LMCache が spinning disk 上の Ceph に保存します。70B FP8 の 4K-token KV (500 MB) では、read time と re-prefill はどう比べますか。
5. vLLM 0.11.0 asynchronous path が「free」かどうか論じてください。overhead はどこに隠れますか。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| Production-stack | 「reference deployment」 | vLLM の Kubernetes Helm chart + operator |
| Connector API | 「KV backend interface」 | vLLM 0.9.0+ の pluggable KV store interface |
| Native CPU offload | 「engine-local spill」 | 同じ engine の host RAM に KV を保存 |
| LMCache | 「cluster KV cache」 | CPU DRAM + disk 上の cross-engine KV cache server |
| 0.11.0 async | 「non-blocking offload」 | engine stream の背後に offload を隠す |
| Preemption | 「room を作るための evict」 | HBM full 時の KV cache shuffle |
| Prefix reuse | 「same system prompt」 | 複数 queries が beginning を共有する cache hit |
| Ceph tier | 「disk tier」 | cache hierarchy 内で DRAM の下にある durable storage |

## 参考資料

- [vLLM Blog — KV Offloading Connector (Jan 2026)](https://blog.vllm.ai/2026/01/08/kv-offloading-connector.html)
- [vLLM Production Stack GitHub](https://github.com/vllm-project/production-stack) — Helm chart + operator。
- [LMCache for Enterprise-Scale LLM Inference (arXiv:2510.09665)](https://arxiv.org/html/2510.09665v2)
- [LMCache GitHub](https://github.com/LMCache/LMCache) — Connector implementation。
- [vLLM 0.11.0 release notes](https://github.com/vllm-project/vllm/releases) — asynchronous path details。
