# Serverless LLM の Cold Start Mitigation

> 20 GB の model image が cold 状態から serving 可能になるまで、5-10 分（7B）から 20 分超（70B）かかります。本当の serverless の世界では、これは warm-up ではなく outage です。Mitigation は 5 つの層で働きます。Pre-seeded node images（AWS の Bottlerocket、dual-volume architecture）、model streaming（NVIDIA Run:ai Model Streamer、vLLM native）、GPU memory snapshots（Modal checkpoints、restart が最大 10x 高速）、warm pools（`min_workers=1`）、tiered loading（ServerlessLLM の NVMe→DRAM→HBM pipeline、latency 10-200x reduction）、そして KV cache（GB）ではなく input tokens（KB）を移動する live migration です。Modal は cold start の floor として 2-4s を公開しています。Baseten は default で 5-10s、pre-warming で sub-second です。このレッスンでは、5 つの層を測定し、budget し、積み重ねる方法を学びます。

**種別:** 学習
**言語:** Python (stdlib、toy cold-start path simulator)
**前提条件:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 03 (GPU Autoscaling)
**所要時間:** 約 60 分

## 学習目標

- Cold-start mitigation の 5 つの層を列挙し、各層の tool または pattern を 1 つ挙げられる。
- 70B model に対して、total cold-start time を (node provision) + (weights download) + (weights load into HBM) + (engine init) の和として計算できる。
- Live migration が KV cache（GB）ではなく input tokens（KB）を転送する理由と、その penalty（recomputation）を説明できる。
- Warm-pool trade-off（idle GPU に支払うか、cold-start tail を受け入れるか）と、`min_workers > 0` が必須になる SLA threshold を説明できる。

## 問題

Serverless LLM endpoint が夜間に scale to zero します。午前 8 時に traffic が急増します。最初の request は次を待ちます。

1. Karpenter が GPU node を provision: 45-60s。
2. Container が weights を含む 30 GB image を pull: 120-300s。
3. Engine が weights を HBM に load: model size と storage speed により 45-120s。
4. vLLM または TRT-LLM が CUDA graphs、KV cache pool、tokenizer を initialize: 10-30s。

合計: token が 1 つ返るまで 220-510s（およそ 3-8 分）。SLA は 2s です。Warm-pool（`min_workers=1`）を ship すると問題は消えたように見えます。しかし今度は idle GPU 1 台分を 24x7 支払います。Service に 5 products があり、それぞれ 1 warm replica を持つなら、ユーザーが 1 回も呼ばなくても 5 × 24 × 30 = 3,600 GPU-hours/month です。

Cold-start mitigation は、serverless economics を保ちながら always-on に近い latency を実現する方法です。

## コンセプト

### Layer 1 — pre-seeded node images（Bottlerocket）

AWS では Bottlerocket の dual-volume architecture が OS と data を分離します。Container image を事前に pull した data volume を snapshot し、`EC2NodeClass` で snapshot ID を参照します。新しい nodes は weights が local NVMe 上にある状態で boot します。step 2 と step 3 の一部が消えます。Karpenter と native に動きます。典型的な節約は large models の cold start で 2-4 分です。

GCP での同等機能は、container layers を pre-bake した custom VM images です。Azure では同じ pattern の managed disk snapshots です。

### Layer 2 — model streaming（Run:ai Model Streamer）

最初の request に答える前にファイル全体を load するのではなく、weights を layer-by-layer に GPU memory へ stream し、最初の transformer block が resident になった時点で processing を開始します。NVIDIA Run:ai Model Streamer は 2026 年の vLLM に native に同梱されています。S3、GCS、local NVMe と動きます。I/O と compute setup を overlap することで、large models の weight-load time をおよそ半分にします。

### Layer 3 — GPU memory snapshots（Modal）

Modal は最初の load 後に GPU state（weights、CUDA graphs、KV cache region）の checkpoint を取ります。以後の restarts は HBM へ直接 deserialize します。これは re-initialize より 10x 高速です。「warm GPU を 2 秒で boot」する最も近いものです。Trade-off は、snapshots が per-GPU-topology であることです。Karpenter が別 SKU に移した場合、re-checkpoint が必要です。

### Layer 4 — warm pools（min_workers=1）

最も単純な mitigation は、常に 1 replica を ready に保つことです。Cost は 1 GPU の hourly rate を 24x7 支払うことです。小さな model では計算が厳しく（30s cold start を避けるために $0.85-$1.50/hr を支払う）、大きな model では納得しやすくなります（5 分 cold start を避けるために $4/hr を支払う）。Warm pools が mandatory になる SLA threshold は、通常 70B+ model で TTFT P99 < 60s です。

### Layer 5 — tiered loading（ServerlessLLM）

ServerlessLLM は storage を階層として扱います。NVMe（fast but big）、DRAM（medium but tiered）、HBM（tiny but instant）です。Weights は DRAM に pre-load され、HBM に load-on-demand されます。Paper は naive disk-to-HBM と比べて cold loads の latency 10-200x reduction を報告しています。Production adoption は early ですが、vLLM との integrations は存在します。

### Layer 6 — live migration（bonus pattern）

Node が利用不能になる（spot eviction、node drain）と、従来 pattern は別 replica を cold-start して request queue を drain することです。Live migration は input tokens（kilobytes）を、model が load 済みの destination に移し、destination 上で KV cache を recompute します。Network 越しに GB の KV cache を転送するより recomputation の方が安いからです。Disaggregated deployments に適用できます。

### Warm-pool の計算

P99 TTFT SLA が 2s の service では、「warm pool yes/no」ではなく「warm replicas は何台で、どの path に割り当てるか」が問題です。

- High-value interactive paths（live chat、voice agent）: `min_workers=1-2`。
- Background batch paths（nightly classification）: scale-to-zero を受け入れ、5-10 分 cold start を許容。
- Premium tier: tenant ごとに dedicated capacity の `min_workers`。

### 最適化前に測定する

Fresh node 上の 70B model の cold-start anatomy（例）:

| Phase | Time | Mitigation |
|-------|------|-----------|
| Node provision | 50s | Bottlerocket + pre-seeded image、warm pool |
| Image pull | 180s | Pre-seeded data volume（eliminate） |
| Weights to HBM | 75s | Model streamer（halve）、GPU snapshot（eliminate） |
| Engine init | 20s | Persistent CUDA graph cache |
| First forward | 3s | Min inherent latency |
| **Total cold** | **328s** | |
| **Total with mitigations** | **~15s** | 22x reduction |

### 覚えておくべき数値

- Modal cold start: 2-4s（GPU snapshots 使用）。
- Baseten default cold start: 5-10s。pre-warming で sub-second。
- Raw 70B cold start: 3-8 分。
- Run:ai Model Streamer: 約 2x weight-load speedup。
- ServerlessLLM tiered loading: 10-200x latency reduction（paper numbers）。

## 使ってみる

`code/main.py` は、各 mitigation の有無による cold-start path を model 化します。Total cold-start time、warm-pool cost、warm pool が採算に合う break-even request rate を報告します。

## Ship It

このレッスンは `outputs/skill-cold-start-planner.md` を生成します。SLA、model size、traffic shape を与えると、どの mitigation を積み重ねるかを選びます。

## 演習

1. `code/main.py` を実行してください。SLO を超えた request drop による cold-start tax より warm replica が安くなる break-even request rate を計算してください。
2. P99 TTFT SLA が 3s の 13B model を deploy します。それを達成する最小の mitigation stack（最少 layer 数）を選んでください。
3. Bottlerocket pre-seeding は image pull を消しますが、weights は snapshot から HBM へ load されます。Snapshot-backed NVMe が 7 GB/s で読める場合、70B model の wall-clock を計算してください。
4. Serverless provider が GPU snapshots（Modal）を提供していますが、team は「snapshots leak PII」として拒否しています。両側を論じてください。現実的な risk と mitigation（ephemeral snapshots、encryption、namespace isolation）は何ですか。
5. Tiered warm-pool policy を設計してください。Paid users、trial users、batch workloads それぞれ warm replicas を何台にしますか。計算を示してください。

## 重要用語

| Term | よく言われること | 実際の意味 |
|------|----------------|------------|
| Cold start | "the big pause" | Fresh replica で request から first token までの時間 |
| Warm pool | "always-on minimum" | 少なくとも 1 replica を ready に保つ `min_workers >= 1` |
| Pre-seeded image | "baked AMI" | Container weights が事前に resident な node image |
| Bottlerocket | "AWS node OS" | Dual-volume snapshot support を持つ AWS container-optimized OS |
| Model streamer | "streaming load" | Weights I/O と compute setup を overlap |
| GPU snapshot | "checkpoint to HBM" | Post-load GPU state を serialize し、restart 時に deserialize |
| Tiered loading | "NVMe + DRAM + HBM" | Storage tier の hierarchy。load on demand |
| Live migration | "move tokens" | Input（KB）を転送し、destination で KV を recompute |
| `min_workers` | "warm replicas" | Serverless minimum keep-alive count |
| Scale-to-zero | "full serverless" | Idle 時の cost なし。full cold-start tax を受け入れる |

## 参考資料

- [Modal — Cold start performance](https://modal.com/docs/guide/cold-start) — Modal の公開 benchmarks と checkpoint architecture。
- [AWS Bottlerocket](https://github.com/bottlerocket-os/bottlerocket) — pre-seeded data volume snapshot pattern。
- [NVIDIA Run:ai Model Streamer](https://github.com/run-ai/runai-model-streamer) — weights load と compute setup の overlap。
- [Baseten — Cold-start mitigation](https://www.baseten.co/blog/cold-start-mitigation/) — pre-warming playbook。
- [ServerlessLLM paper (USENIX OSDI'24)](https://www.usenix.org/conference/osdi24/presentation/fu) — tiered loading design。
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) — disaggregated deployments の live migration。
