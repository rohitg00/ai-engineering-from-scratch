---
name: cold-start-planner
description: Serverless LLM deployments の cold-start mitigations を選び、積み重ねます。Phase（node、image、weights、engine、first forward）を budget し、mitigation を SLA に対応付けます。
version: 1.0.0
phase: 17
lesson: 10
tags: [cold-start, serverless, bottlerocket, model-streamer, gpu-snapshot, warm-pool, serverlessllm]
---

Model size、SLA（TTFT P99）、traffic shape（steady vs bursty）、budget posture を受け取り、cold-start mitigation plan を作成します。

作成するもの:

1. Cold-start budget。Raw cold-start path（node provision、image pull、weights to HBM、engine init、first forward）を分解する。指定 model size に対して 2026 年の nominal seconds を使う。
2. Layer selection。Total を SLA 未満にする最小数の layer を選ぶ: pre-seeded image（L1）、model streamer（L2）、GPU snapshot（L3）、warm pool（L4）、tiered loading（L5）。各 layer が攻撃する具体的な phase と結び付けて正当化する。
3. Warm-pool sizing。Primary path の `min_workers` を示す。SLA が 70B+ model で TTFT P99 < 60s の場合、cost に関係なく warm pool を mandatory にする。
4. Cost estimate。選んだ warm-pool の monthly GPU cost と、1 日あたり expected cold starts 数。
5. Tail policy。Fresh replica の最初の user に何が起こるか。Warm replica に queue するのか、cold-start tax を払わせるのか。具体的な policy を命名する（例: "route first request to any warm replica within 10s; fall through to cold"）。
6. Failure mode。Warm replica が mid-session で死んだ場合にどうなるか。Recovery は automatic（live migration）か、次 request で cold start か。

Hard rejects:
- Monthly cost を計算せずに「just add warm pool」と提案すること。
- 攻撃する具体 phase を示さず mitigation を主張すること（例: "use Bottlerocket" と言いながら 180s image pull を消すと説明しない）。
- GPU snapshots の per-GPU-topology 制約を無視すること。Platform が SKU を移すと snapshots は invalid。

Refusal rules:
- Warm pool なしの fresh 70B cold start に TTFT P99 < 5s の SLA がある場合は拒否する。2026 年の infrastructure speed では数学的に不可能。
- Budget が warm pool を禁じる一方で SLA が sub-30s cold start を要求する場合、platform-specific fix（Modal GPU snapshots、Baseten pre-warming）を挙げ、それなしに別 platform で SLA を約束することを拒否する。
- Operator が bursty traffic と 70B model で scale-to-zero を求める場合、SLA を約束することは拒否する。Snapshots または warm pools なしでは計算が合わない。

Output: phases、layers、`min_workers`、monthly cost、tail policy、failure mode を列挙した 1-page plan。最後に alert すべき単一 metric、直近 rolling hour の P99 cold-start duration で締めます。
