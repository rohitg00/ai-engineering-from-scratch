---
name: devops-agent
description: Build a Kubernetes troubleshooting agent that walks a cluster knowledge graph, ranks root causes, and gates every remediation through Slack.
version: 1.0.0
phase: 19
lesson: 06
tags: [capstone, devops, sre, kubernetes, langgraph, fastmcp, aiops]
---

Given a K8s cluster and an alert source (PagerDuty or Alertmanager), build an agent that produces ranked root-cause hypotheses in under five minutes and gates every remediation through a Slack approval card.

Build plan:

1. Ingest kube-state-metrics into Neo4j or kuzu every 30s. Build a graph of Pods, Deployments, Services, Nodes, PVCs, HPAs plus telemetry-overlay edges to Prometheus, Loki, and Tempo sources.
2. Stand up a FastAPI webhook receiver for PagerDuty and Alertmanager.
3. Expose read-only tools through FastMCP with StreamableHTTP transport: kubectl get/describe, promql, logql, traceql.
4. Build a LangGraph root-cause agent with three nodes: `sample` (pull 15m telemetry), `walk` (traverse graph neighbors), `hypothesize` (rank candidates by recency × specificity × citation count).
5. Post the top-3 ranked hypotheses with graph-path visualization to Slack with approval buttons.
6. Put destructive tools (scale, rollback, delete) on a separate FastMCP server behind an approval token the agent obtains only after Slack signoff.
7. Maintain an append-only audit log: every *considered* command, whether approved, whether executed, who approved.
8. Build 20 synthetic incident scenarios (OOMKill, DNS flap, HPA thrash, PVC fill, noisy neighbor, faulty sidecar, ConfigMap bad rollout, cert rotation, image-pull backoff, probe failure, and 10 more). Score agent on RCA accuracy and time-to-hypothesis.

Assessment rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | RCA accuracy on scenario suite | At least 80% correct root cause across 20 synthetic incidents |
| 20 | Safety | Destructive-action guard never fires without Slack approval in the audit log |
| 20 | Time-to-hypothesis | p50 under 5 minutes from alert to Slack brief |
| 20 | Explainability | Every hypothesis has graph paths and telemetry citations |
| 15 | Integration completeness | PagerDuty, Slack, ArgoCD, Prometheus end-to-end working |

Hard rejects:

- Agents with a single MCP server that mixes read-only and destructive tools.
- Any RCA produced without telemetry citations. Uncited hypotheses must be rejected.
- Audit logs that only record executions. They must record every command considered.
- Claims of accuracy without running the agent against the 20-scenario suite with seeds.

Refusal rules:

- Refuse to remediate without Slack approval from a human on-caller. Even if the hypothesis is obvious.
- Refuse to expose `kubectl exec`, `kubectl port-forward`, or any interactive tool via the read-only MCP. These are destructive in effect.
- Refuse to batch-apply remediations across multiple deployments without per-deployment approval cards.

Output: a repo containing the FastAPI receiver, the LangGraph agent, the read-only and destructive MCP servers, the Slack integration, the 20-scenario test suite, a side-by-side comparison against AWS DevOps Agent on three shared incidents, and a write-up on near-miss commands (what the agent *considered* but did not execute) over a one-week observation window.
