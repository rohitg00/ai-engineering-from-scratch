# GPU Autoscaling on Kubernetes — Karpenter, KAI Scheduler, Gang Scheduling

> 1つではなく3つの layer です。Karpenter は node を dynamic に provision します（1分未満、Cluster Autoscaler より40%高速）。KAI Scheduler は gang scheduling、topology awareness、hierarchical queues を扱い、8 GPU 中7 GPU だけ確保して1 GPU 待ちのまま燃え続ける partial allocation trap を防ぎます。Application-level autoscalers（NVIDIA Dynamo Planner、llm-d Workload Variant Autoscaler）は、CPU/DCGM duty cycle ではなく、queue depth や KV cache utilization といった inference-specific signal で scale します。classic HPA trap は `DCGM_FI_DEV_GPU_UTIL` が duty-cycle measurement である点です。100% は10 requests でも100 requests でもあり得ます。vLLM は KV cache memory を事前確保するため、memory は scale-down を trigger しません。このレッスンでは3 layer を組み合わせ、running GPU jobs を inference 中に terminate する default Karpenter `WhenEmptyOrUnderutilized` policy を避ける方法を学びます。

**種別:** 学習
**言語:** Python (stdlib, toy queue-depth autoscaler simulator)
**前提条件:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 04 (vLLM Serving Internals)
**所要時間:** 約75分

## Learning Objectives

- 3つの autoscaling layers（node provisioning、gang scheduling、application-level）を図示し、各 layer で使う tool を名前で挙げる。
- `DCGM_FI_DEV_GPU_UTIL` が vLLM の HPA signal として間違っている理由を説明し、代替 signal を2つ（queue depth、KV cache utilization）挙げる。
- gang scheduling と、KAI Scheduler が防ぐ partial-allocation failure mode（8 GPU 中7 GPU が idle）を説明する。
- running GPU jobs を terminate する Karpenter consolidation policy（`WhenEmptyOrUnderutilized`）を名前で挙げ、2026年の safe alternative を述べる。

## 問題

あなたの team は Kubernetes 上で LLM-serving service を出荷します。`DCGM_FI_DEV_GPU_UTIL` を signal にして HPA を設定しました。service は business hours に 100% utilization に張り付きます。HPA は scale up しません。すでに満杯だと考えているからです。replica を手動で追加すると TTFT は下がります。それでも HPA は scale しません。signal が嘘をついています。

別の問題として、node には Cluster Autoscaler を使っています。午前2時に 1M-token prompt が到着すると、cluster は node provision に3分かけ、request は timeout します。

さらに別の問題として、2 nodes にまたがる 8 GPUs を必要とする 70B model を deploy します。cluster には7 GPUs が空いていて、残り1つは3 nodes に分散しています。Cluster Autoscaler は不足している1 GPU のために node を provision します。Kubernetes が最後の GPU を立ち上げるまで、7 nodes が4分間待ちながらコストを燃やします。

3つの layer、3つの異なる failure modes。2026年の GPU-aware autoscaling は「HPA を有効化する」ことではありません。node provisioning、gang scheduling、application-signal autoscaling を組み合わせることです。

## The Concept

### Layer 1 — node provisioning (Karpenter)

Karpenter は pending pods を監視し、約45-60秒で node を provision します（Cluster Autoscaler は GPU nodes で通常90-120秒）。`NodePool` constraint に従って instance types を dynamic に選びます。pod が 8 H100s を必要とし、cluster に一致する node がなければ、既存 group を scale するのではなく直接 provision します。

**The consolidation trap**: Karpenter の default `consolidationPolicy: WhenEmptyOrUnderutilized` は GPU pools では危険です。より安価で right-sized な instance に pods を移すため、running GPU node を terminate します。inference workload では running requests を evict し、新しい node で 70B model を reload することを意味します。失うものは数分の capacity と request failures です。

GPU pools の safe setting:

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

Karpenter は1時間後に本当に empty な node だけを consolidate し、running job は evict しません。

### Layer 2 — gang scheduling (KAI Scheduler)

KAI Scheduler（project "Karp" から rename）は、default kube-scheduler が扱わないものを扱います。

**Gang scheduling** — all-or-nothing で schedule します。8 GPUs を必要とする distributed inference pod は、8つすべてが一緒に start するか、何も start しません。これがないと、8 pods のうち7つが start し、いつまでも待ち、cost を燃やす partial-allocation trap になります。

**Topology awareness** — どの GPUs が NVLink を共有するか、どれが同じ rack にあるか、どれの間に InfiniBand があるかを知っています。それに応じて pods を配置します。DeepSeek-V3 67B tensor-parallel workload は1つの NVLink domain に留める必要があり、KAI Scheduler はそれを尊重します。

**Hierarchical queues** — 複数 team が priority と quota を持って同じ GPU pool を競います。Team A の production pinch が Team B の training job に preempt されるのは、priority rules が許す場合だけです。

KAI は kube-scheduler と並行して secondary scheduler として deploy されます。workload に annotation を付けて使います。Ray と vLLM production-stack はどちらも integration しています。

### Layer 3 — application-level signals

**The HPA trap**: `DCGM_FI_DEV_GPU_UTIL` は duty-cycle metric です。各 sampling interval で GPU が仕事をしていたかを測ります。100% utilization は 10 concurrent requests でも100でもあり得ます。GPU はどちらでも busy です。duty cycle で scale するのは blind scaling です。

さらに悪いことに、vLLM と同様の engines は KV cache memory（最大 `--gpu-memory-utilization`）を事前確保します。1 request でも memory usage は90%近くに留まります。memory-based HPA は scale down しません。

**2026 replacement signals**:

- Queue depth（prefill を待つ request 数）。
- KV cache utilization（active sequences に割り当てられた blocks の割合）。
- Per-replica P99 TTFT（あなたの SLA signal）。
- Goodput（すべての SLO を満たした requests per second）。

NVIDIA Dynamo Planner と llm-d Workload Variant Autoscaler はこれらの signal を取り込み、replica を scale します。LLM serving では HPA を完全に置き換えます。

### When to use what

| Scale decision | Tool |
|----------------|------|
| Add/remove nodes | Karpenter |
| Schedule multi-GPU jobs | KAI Scheduler |
| Add/remove replicas | Dynamo Planner / llm-d WVA (or custom HPA on queue depth) |
| Choose GPU type | Karpenter NodePool |
| Preempt low-priority | KAI Scheduler queues |

### Disaggregated prefill/decode complicates everything

disaggregated prefill/decode（Phase 17 · 17）を動かす場合、2つの pod classes は異なる scaling triggers を持ちます。prefill pods は queue depth で scale し、decode pods は KV cache pressure で scale します。llm-d はこれらを per-role HPA 付きの separate `Services` として expose します。1つの HPA を両方の前に置こうとしてはいけません。

### Cold start matters here too

cold-start mitigation（Phase 17 · 10）は node provisioning time が user-visible になる場所です。Karpenter の45-60秒の warm-up、20GB model load、engine init を合わせると、from-zero request は2-5分かかります。SLO-critical path では warm pool（`min_workers=1`）を維持するか、application layer で Modal-style checkpointing を使います。

### Numbers you should remember

- Karpenter node provisioning: ~45-60s vs Cluster Autoscaler ~90-120s (GPU nodes).
- KAI Scheduler prevents partial-allocation waste — 7-of-8 trap.
- `DCGM_FI_DEV_GPU_UTIL` as HPA signal: broken; use queue depth or KV utilization.
- Karpenter `WhenEmptyOrUnderutilized`: terminates running GPU jobs. Use `WhenEmpty + consolidateAfter: 1h` for inference.

## Use It

`code/main.py` は bursty GPU workload 上で three-layer autoscaler を simulate します。naive HPA（duty cycle）、queue-depth HPA、KAI-gang-scheduled scaling を比較し、unmet requests、idle-GPU minutes、composite score を報告します。

## Ship It

このレッスンは `outputs/skill-gpu-autoscaler-plan.md` を生成します。cluster topology、workload shape、SLO を入力すると、three-layer autoscaling plan を設計します。

## Exercises

1. `code/main.py` を実行してください。bursty workload で、naive duty-cycle HPA が drop し、queue-depth HPA が拾う requests は何件ですか。差はどこから来ていますか。
2. H100 SXM5 上で Llama 3.3 70B FP8 を serve する cluster 向けに Karpenter NodePool を設計してください。`capacity-type`、`disruption.consolidationPolicy`、`consolidateAfter`、non-GPU workloads をこれらの nodes から除外する taint を指定してください。
3. team が「GPUs は available なのに pod が schedule されず Pending のまま」と報告しています。診断してください。これは Karpenter、kube-scheduler、KAI Scheduler のどれですか。どの metrics で確認しますか。
4. disaggregated prefill pods を autoscale する signal と、decode pods 用の別 signal を選んでください。両方を正当化してください。
5. 平均60件/day の request-dropping events（P99 TTFT > 10s）を起こす 24x7 production service で、`WhenEmptyOrUnderutilized` consolidation trap の cost を計算してください。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Karpenter | "the node provisioner" | Kubernetes node autoscaler。sub-minute provisioning |
| Cluster Autoscaler | "the old scaler" | Kubernetes node autoscaler の predecessor。遅く、group-based |
| KAI Scheduler | "the GPU scheduler" | gang + topology + queues 向け secondary scheduler |
| Gang scheduling | "all or nothing" | N pods を atomically に schedule するか、すべて defer する |
| Topology awareness | "rack-aware" | NVLink/IB/rack placement に基づいて pods を配置する |
| `DCGM_FI_DEV_GPU_UTIL` | "GPU utilization" | duty-cycle metric。LLM の scaling signal ではない |
| Queue depth | "waiting requests" | prefill-bound scaling の正しい HPA signal |
| KV cache utilization | "memory pressure" | decode-bound scaling の正しい HPA signal |
| Consolidation | "Karpenter consolidation" | より安い instance type への移行のための node termination |
| `WhenEmpty + 1h` | "safe consolidation" | running GPU jobs を evict しない policy |

## 参考文献

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler) — design docs and configuration examples.
- [Karpenter Disruption Controls](https://karpenter.sh/docs/concepts/disruption/) — consolidation policy semantics and GPU-safe defaults.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) — Dynamo Planner scaling signals.
- [Ray docs — KAI Scheduler for RayClusters](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html) — Ray integration pattern.
- [AWS EKS Compute and Autoscaling Best Practices](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) — managed-Kubernetes-specific guidance.
- [llm-d GitHub](https://github.com/llm-d/llm-d) — Workload Variant Autoscaler design.
