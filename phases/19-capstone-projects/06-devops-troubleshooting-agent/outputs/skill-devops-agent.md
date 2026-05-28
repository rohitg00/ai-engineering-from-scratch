---
name: devops-agent
description: cluster knowledge graph をたどり、root cause を rank し、すべての remediation を Slack 経由で gate する Kubernetes troubleshooting agent を構築する。
version: 1.0.0
phase: 19
lesson: 06
tags: [capstone, devops, sre, kubernetes, langgraph, fastmcp, aiops]
---

K8s cluster と alert source (PagerDuty または Alertmanager) を受け取り、5分未満で ranked root-cause hypotheses を出し、すべての remediation を Slack approval card で gate する agent を構築する。

構築計画:

1. kube-state-metrics を30秒ごとに Neo4j または kuzu へ ingest する。Pods、Deployments、Services、Nodes、PVCs、HPAs と、Prometheus、Loki、Tempo sources への telemetry-overlay edges から graph を作る。
2. PagerDuty と Alertmanager 用の FastAPI webhook receiver を立てる。
3. StreamableHTTP transport の FastMCP 経由で read-only tools を公開する: kubectl get/describe、promql、logql、traceql。
4. 3 node の LangGraph root-cause agent を構築する: `sample` (15m telemetry を取得)、`walk` (graph neighbor を traverse)、`hypothesize` (recency x specificity x citation count で candidate を rank)。
5. graph-path visualization 付きの top-3 ranked hypotheses を approval buttons とともに Slack に post する。
6. destructive tools (scale, rollback, delete) は、Slack signoff 後にだけ agent が得る approval token の背後にある別 FastMCP server に置く。
7. append-only audit log を維持する: すべての *considered* command、approved されたか、executed されたか、誰が approve したか。
8. 20 synthetic incident scenarios (OOMKill, DNS flap, HPA thrash, PVC fill, noisy neighbor, faulty sidecar, ConfigMap bad rollout, cert rotation, image-pull backoff, probe failure, and 10 more) を構築する。agent を RCA accuracy と time-to-hypothesis で score する。

評価 rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | RCA accuracy on scenario suite | 20 synthetic incidents で少なくとも80%の correct root cause |
| 20 | Safety | audit log 上で destructive-action guard が Slack approval なしに発火しないこと |
| 20 | Time-to-hypothesis | alert から Slack brief まで p50 が5分未満 |
| 20 | Explainability | すべての hypothesis に graph path と telemetry citation があること |
| 15 | Integration completeness | PagerDuty、Slack、ArgoCD、Prometheus が end-to-end で動くこと |

ハードリジェクト:

- read-only と destructive tools を混在させる単一 MCP server の agent。
- telemetry citation のない RCA。uncited hypothesis は拒否する。
- execution だけを記録する audit log。considered command をすべて記録する必要がある。
- seed 付きの20-scenario suite で agent を走らせずに accuracy を主張すること。

拒否ルール:

- human on-caller からの Slack approval なしに remediate しない。hypothesis が明白でも同じ。
- read-only MCP で `kubectl exec`、`kubectl port-forward`、または interactive tool を公開しない。効果として destructive。
- per-deployment approval card なしに複数 deployment へ remediation を batch-apply しない。

出力: FastAPI receiver、LangGraph agent、read-only と destructive MCP servers、Slack integration、20-scenario test suite、3つの shared incident での AWS DevOps Agent との side-by-side comparison、1週間の observation window での near-miss commands (agent が *considered* したが execute しなかったもの) の write-up を含むリポジトリ。
