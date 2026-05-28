# Disaggregated Prefill/Decode — NVIDIA Dynamo and llm-d

> Prefill は compute-bound、decode は memory-bound である。同じ GPU で両方を動かすと、どちらかの resource を無駄にする。disaggregation は両者を別々の pool に分け、NIXL（RDMA/InfiniBand または TCP fallback）で KV cache を転送する。NVIDIA Dynamo（GTC 2025 announcement、1.0 GA）は vLLM/SGLang/TRT-LLM の上に位置する。Planner Profiler + SLA Planner が prefill:decode ratio を自動で rate-match し、SLO を満たす。NVIDIA はこの範囲の throughput gain を公開している。developer.nvidia.com（2025-06）は GB200 NVL72 + Dynamo 上の DeepSeek-R1 MoE で medium-latency regime における約6x改善を示し、Dynamo product page（developer.nvidia.com、日付なし）は GB300 NVL72 + Dynamo で Hopper 比最大50x MoE throughput を宣伝している。"30x" という数字は full-stack Blackwell + Dynamo + DeepSeek-R1 report 全体の community aggregate であり、正確に30xと述べる単一 primary source は見つかっていない。方向感を示す主張として扱う。llm-d（Red Hat + AWS）は Kubernetes-native で、prefill / decode / router を独立した Services とし、role ごとの HPA を使う。llm-d 0.5 は hierarchical KV offloading、cache-aware LoRA routing、UCCL networking、scale-to-zero を追加した。economics: 複数 customer disclosure の internal rollup では、constant SLA のまま colocated serving から Dynamo による disaggregated serving へ切り替えると、$2M 級 inference spend で30-40% saving（つまり $600-800K/year）が示唆される。この $2M→$600-800K という具体値は internal composite であり、単一の published case study ではない。reference citation ではなく order-of-magnitude anchor として使う。短い prompt（<512 tokens、short output）は transfer cost を正当化しない。

**種別:** 学習
**言語:** Python (stdlib, toy disaggregated-vs-colocated simulator)
**前提条件:** Phase 17 · 04 (vLLM Serving Internals), Phase 17 · 08 (Inference Metrics)
**所要時間:** 約75分

## 学習目標

- prefill と decode で最適な GPU allocation が異なる理由を説明し、colocation 下の waste を定量化する。
- disaggregated architecture を図示する。prefill pool、decode pool、NIXL による KV transfer、router。
- disaggregation が割に合わない条件（short prompts、short outputs）を説明する。
- NVIDIA Dynamo（stack-above）と llm-d（Kubernetes-native）を区別し、それぞれを運用 context に対応づける。

## 課題

あなたは Llama 3.3 70B を 8 H100s で動かしている。mixed workload（long prompts + short outputs）では、compute の大半が prefill に使われた後、decode 中に GPU が idle になる。別の workload（short prompts + long outputs）では逆が起きる。colocated prefill + decode は、両方を over-provision することを意味する。

予算への影響: GPU time の20-40%が間違った resource に浪費される。memory-bound decode を走らせるために H100 compute を買っている、または compute-bound prefill を走らせるために H100 HBM bandwidth を買っている。どちらも高価な無駄だ。

disaggregation は prefill と decode を、それぞれの bottleneck に合わせて size した別 pool に分ける。KV cache は prefill pool から decode pool へ high-bandwidth interconnect で転送される。

## コンセプト

### bottleneck が異なる理由

**Prefill** — 入力 prompt 全体に対して transformer を1回 forward する。matrix multiplication が支配的で compute-bound。H100 FP8 は有効 throughput として約2000 TFLOPS を出す。batch efficiency は高く、1回の forward で多くの tokens を処理する。

**Decode** — 1 token ずつ生成し、各 iteration で全 weights を読む。memory-bandwidth-bound。HBM3 は約3 TB/s。batch efficiency が良いのは high concurrency のときだけで、weights read が batch で償却される。

両者を colocate すると、両方に最適化された GPU を買うことになる。H100 はどちらにも強いが、どちらの使い方でも同じ金額がかかる。scale すると、prefill pool は H100 / compute-heavy、decode pool は H200 / memory-heavy、または aggressive quantization を使いたくなる。

### architecture

```
            ┌──────────────┐
  Request → │    Router    │ ───────────────────────┐
            └──────┬───────┘                        │
                   │                                │
                   ▼ (prompt only)                  │
            ┌──────────────┐    KV cache    ┌───────▼──────┐
            │ Prefill pool │ ─── NIXL ────► │ Decode pool  │
            │  (compute)   │                │  (memory)    │
            └──────────────┘                └──────┬───────┘
                                                   │ tokens
                                                   ▼
                                                 Client
```

NIXL は NVIDIA の inter-node transport である。利用できる場合は RDMA/InfiniBand を使い、なければ TCP に fallback する。transfer latency は実在する。70B FP8 の 4K-token prompt の KV cache では典型的に20-80 ms 程度だ。だから short prompt では disaggregation を正当化できない。transfer tax が saving を上回る。

### Dynamo vs llm-d

**NVIDIA Dynamo**（GTC 2025 announcement、1.0 GA）:
- vLLM、SGLang、TRT-LLM の上に orchestrator として位置する。
- Planner Profiler が workload を測定し、SLA Planner が prefill:decode ratio を自動設定する。
- Rust core、Python extensibility。
- Throughput gains: NVIDIA は GB200 NVL72 + Dynamo 上の DeepSeek-R1 MoE で medium-latency regime における6xを報告している（developer.nvidia.com, 2025-06）。full Blackwell + Dynamo + DeepSeek-R1 stack で「最大30x」という community report は単一 primary source を欠くため、方向感として扱う。
- GB300 NVL72 + Dynamo: Dynamo product page（developer.nvidia.com、日付なし）によれば Hopper 比で最大50x MoE throughput。

**llm-d**（Red Hat + AWS、Kubernetes-native）:
- prefill / decode / router を独立した Kubernetes Services として動かす。
- queue depth（prefill）/ KV utilization（decode）signal を使う role ごとの HPA。
- `topologyConstraint packDomain: rack` により、高帯域 KV transfer のため prefill+decode clique を同一 rack に pack する。
- llm-d 0.5（2026）: hierarchical KV offloading、cache-aware LoRA routing、UCCL networking、scale-to-zero。

stack-above の managed orchestrator が欲しいなら Dynamo を使う。Kubernetes-native primitive が欲しく、CNCF ecosystem に committed しているなら llm-d を使う。

### 経済性

Internal composite（単一 published case study ではない。order-of-magnitude anchor）:

- colocated serving に $2M/year の inference spend。
- Dynamo を使う disaggregated へ切り替え。
- request volume も P99 latency SLA も同じ。
- reported savings: $600K–$800K/year（30–40% reduction）。
- 新規 hardware なし。

この数字は単一の cite 可能な case study ではなく、複数 customer disclosure から合成したものだ。近い published data point として、Baseten の Dynamo KV routing による 2x faster TTFT / 61% higher throughput（baseten.co, 2025-10）、VAST + CoreWeave の 40-60% KV hit rate で 60-130% more tokens/$ という projection（vastdata.com, 2025-12）がある。saving は各 pool の right-sizing から生まれる。RAG with 8K+ prefixes のような prefill-heavy workload は、balanced workload より大きく恩恵を受ける。

### disaggregate すべきでない場合

- Prompts < 512 tokens かつ outputs < 200 tokens: transfer tax が gain を支配する。
- Small cluster（< 4 GPUs）: pool diversity が足りない。
- team が role ごとの scaling を持つ2つの GPU pool を運用できない。Dynamo は助けになるが、自動で簡単になるわけではない。
- RDMA fabric がない: TCP transfer tax は重い。

### router と Phase 17 · 11 の統合

Disaggregated router は KV-cache-aware（Phase 17 · 11）である。request は prefix を保持している decode pool に着地する。一致がなければ prefill → decode に流れる。hit rate と disaggregation は相乗効果がある。cache-aware router が、新しい prefill が必要かどうかを決める。

### 本当の数字は Blackwell 上の MoE にある

GB300 NVL72 + Dynamo は Hopper baseline に対して50x MoE throughput を示す。MoE expert routing は prefill では compute-heavy だが decode では memory-heavy（expert caches）なので、disaggregation は二重に効く。2026年の frontier model serving は MoE-dominant（DeepSeek-V3、将来の GPT-5 variants）である。

### 覚えておくべき数字

benchmark number は変動する。NVIDIA と inference stack は四半期ごとに updated result を出す。引用前に再確認する。

- GB200 NVL72 + Dynamo 上の DeepSeek-R1: medium-latency regime で baseline 比約6x throughput（developer.nvidia.com, 2025-06）。full Blackwell + Dynamo stack の community "up to 30x" claim は単一 primary source のない directional aggregate。
- GB300 NVL72 + Dynamo: Hopper 比最大50x MoE throughput（developer.nvidia.com、日付なし）。
- Savings anchor（internal composite、単一 case study ではない）: annual spend $2M から constant SLA で $600-800K/year 削減。
- Disaggregation threshold: prompts >512 tokens + outputs >200 tokens。
- KV transfer via NIXL: 70B FP8 の 4K-prompt KV で20-80 ms。

## 使ってみる

`code/main.py` は colocated と disaggregated serving を simulate する。throughput、cost per request、prompt-length crossover を report する。

## 成果物

この lesson は `outputs/skill-disaggregation-decider.md` を生成する。workload と cluster が与えられたら、disaggregate すべきかを判断する。

## 演習

1. `code/main.py` を実行する。どの prompt length で disaggregation は colocation に勝つか。
2. P99 prefix length 8K、output 300 の RAG service に対して prefill pool と decode pool を設計する。
3. Dynamo vs llm-d: Python runtime preference のない pure-Kubernetes shop にどちらを選ぶか。
4. KV transfer cost を計算する。70B FP8 の 4K prefill は約500 MB KV。RDMA 100 GB/s では transfer = 5 ms。TCP 10 GB/s では 50 ms。あなたの SLA に効くのはどちらか。
5. MoE expert routing は KV access pattern を変える。token ごとに異なる expert を activate する MoE では、disaggregation はどう振る舞うか。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| Disaggregated serving | "split prefill/decode" | phase ごとに separate GPU pools を使う |
| NIXL | "NVIDIA transport" | Dynamo の inter-node KV transfer（RDMA/TCP） |
| NVIDIA Dynamo | "the orchestrator" | vLLM/SGLang/TRT-LLM の stack-above coordinator |
| llm-d | "Kubernetes native" | Red Hat + AWS の K8s disaggregated stack |
| Planner Profiler | "Dynamo auto-config" | workload を測定し pool ratio を設定する |
| SLA Planner | "Dynamo policy" | SLO を満たすよう prefill:decode を auto-rate-match |
| `packDomain: rack` | "llm-d topology" | fast KV のため prefill+decode を同一 rack に pack |
| UCCL | "unified collective" | scale-to-zero 用の llm-d 0.5 networking layer |
| MoE expert routing | "expert per token" | DeepSeek-V3 pattern。disaggregation が効く |

## 参考資料

- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)
- [TensorRT-LLM Disaggregated Serving blog](https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html)
- [llm-d GitHub](https://github.com/llm-d/llm-d)
- [llm-d 0.5 release notes](https://github.com/llm-d/llm-d/releases)
