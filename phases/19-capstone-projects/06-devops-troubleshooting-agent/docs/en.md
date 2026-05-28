# Capstone 06 — Kubernetes 向け DevOps Troubleshooting Agent

> AWS の DevOps Agent は GA になり、Resolve AI は K8s playbook を公開し、NeuBird は semantic monitoring を demo し、Metoro は AI SRE を per-service SLO に結び付けました。production の形は固まっています。alert webhook が発火し、agent が telemetry を読み、K8s object graph を歩き、root-cause hypothesis を rank し、approval button 付きの Slack brief を投稿します。default は read-only。すべての remediation は human gate 付きです。この capstone ではその agent を作り、20 synthetic incidents で評価し、3つの shared case で AWS Agent と比較します。

**種別:** Capstone
**言語:** Python (agent), TypeScript (Slack integration)
**前提条件:** Phase 11 (LLM engineering), Phase 13 (tools and MCP), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:** P11 · P13 · P14 · P15 · P17 · P18
**所要時間:** 30時間

## 問題

2025-2026年の SRE narrative は「AI agent が incident を triage し、人間が remediation を approve する」になりました。AWS DevOps Agent、Resolve AI、NeuBird、Metoro、PagerDuty AIOps はこの形を production で提供しています。agent は Prometheus metrics、Loki logs、Tempo traces、kube-state-metrics、K8s object knowledge graph を読みます。5分未満で ranked root-cause hypothesis を telemetry citation 付きで出します。Slack 経由の明示的な human approval なしに destructive command は実行しません。

難しい部分の大半は reasoning ではなく scoping と safety です。agent には read-only-by-default RBAC surface、hardened MCP tool server、considered vs executed の全 command audit log が必要です。自分の限界を知り escalation できなければなりません。さらに OOM-kill cascade が $5k の agent bill を生まないよう、十分安く動く必要があります。

## コンセプト

agent は knowledge graph 上で動作します。node は K8s object (Pods, Deployments, Services, Nodes, HPAs, PVCs) と telemetry source (Prometheus series, Loki streams, Tempo traces) です。edge は ownership (Pod -> ReplicaSet -> Deployment)、scheduling (Pod -> Node)、observation (Pod -> Prometheus series) を表します。graph は kube-state-metrics sync で fresh に保ち、alert ごとに re-sample します。

alert が発火すると、agent は affected object から root-cause します。edge をたどり、関連 telemetry slice (直近15分) を取得し、hypothesis を draft します。hypothesis は evidence で rank します。何個の telemetry citation が支えるか、どれだけ recent か、どれだけ specific か。top-3 hypothesis は graph-path visualization と remediation action approval button とともに Slack へ送られます。

remediation は gate されます。default allowed action は read-only です。scaling down、rolling back、deleting Pods など destructive action は Slack approval が必要です。ArgoCD rollback hook には agent が保持しない auth token が必要です。audit log は実行された command だけでなく、agent が *considered* した command も記録します。これにより review process が near-miss を捕捉できます。

## Architecture

```
PagerDuty / Alertmanager webhook
           |
           v
     FastAPI receiver
           |
           v
   LangGraph root-cause agent
           |
           +---- read-only MCP tools ----+
           |                             |
           v                             v
   K8s knowledge graph              telemetry slices
     (Neo4j / kuzu)              Prometheus, Loki, Tempo
   ownership + scheduling          last 15m, scoped
           |
           v
   hypothesis ranking (evidence weight)
           |
           v
   Slack brief + approval buttons
           |
           v (approved)
   ArgoCD rollback hook / PagerDuty escalate
           |
           v
   audit log: considered vs executed, every command
```

## Stack

- Observability sources: Prometheus、Loki、Tempo、kube-state-metrics
- Knowledge graph: K8s object + telemetry edge の Neo4j (managed) または kuzu (embedded)
- Agent: per-tool allow-list と read-only default を持つ LangGraph
- Tool transport: StreamableHTTP 上の FastMCP。destructive tool は approval gate 背後の separate server
- Models: root-cause reasoning は Claude Sonnet 4.7、log summarization は Gemini 2.5 Flash
- Remediation: ArgoCD rollback webhook、PagerDuty escalate、Slack approval card
- Audit: append-only structured log (considered, executed, approved, outcome)
- Deployment: 狭い RBAC role を持つ K8s deployment、separate namespace

## 実装

1. **Graph ingestion.** kube-state-metrics を30秒ごとに Neo4j/kuzu へ sync します。Nodes: Pod, Deployment, Node, Service, PVC, HPA。Edges: OWNED_BY, SCHEDULED_ON, EXPOSES, MOUNTS, SCALES。telemetry overlay edge: OBSERVED_BY (Pod は Prometheus series に観測される)。

2. **Alert receiver.** PagerDuty または Alertmanager webhook を受ける FastAPI endpoint を作ります。affected object と SLO breach を抽出します。

3. **Read-only tool surface.** kubectl、Prometheus query、Loki logql、Tempo traceql を FastMCP で wrap します。各 tool は narrow RBAC verb ("get", "list", "describe") だけを持ちます。default server には "delete", "exec", "scale" を置きません。

4. **Root-cause agent.** LangGraph に3 node を置きます。`sample` は last-15-minutes telemetry slice を取ります。`walk` は graph で neighbor object を query します。`hypothesize` は telemetry citation 付き ranked root-cause candidate を draft します。

5. **Evidence scoring.** 各 hypothesis の score = recency * specificity * graph-path length inverse * citation count。top-3 を返します。

6. **Slack brief.** hypothesis、graph-path visualization (server-side render した subgraph image)、最大1つの remediation action approval button を持つ attachment を投稿します。

7. **Remediation gate.** destructive tools (scale down, roll back, delete) は approval token 背後の第2 MCP server に置きます。agent は Slack card が human に approve された後だけ呼べます。

8. **Audit log.** append-only JSONL を作ります。すべての candidate command について、considered されたか、executed されたか、誰が approve したかを記録します。毎日 S3 に送ります。

9. **Synthetic incident suite.** 20 scenarios を作ります: OOMKill cascade、DNS flap、HPA thrash、PVC fill、noisy neighbor、faulty sidecar、bad ConfigMap rollout、certificate rotation、image-pull backoff など。root-cause accuracy と time-to-hypothesis で score します。

## Use It

```
webhook: alert.pagerduty.com -> checkout-api SLO breach, error rate 14%
[graph]   affected: Deployment checkout-api (3 Pods, Node ip-10-2-3-4)
[walk]    neighbors: ReplicaSet checkout-api-abc, Service checkout-api,
           recent rollout 14m ago
[sample]  prometheus error_rate 14%, up-trend; loki 500s on /api/v2/pay
[hypo]    #1 bad rollout: latest image checkout-api:v2.41 fails /healthz
          citations: deploy.yaml (rev 42), prometheus errorRate, loki 500 stack
[slack]   [ROLL BACK to v2.40]  [ESCALATE]  [IGNORE]
          (approval required; agent does not roll back unilaterally)
```

## Ship It

`outputs/skill-devops-agent.md` が deliverable です。K8s cluster と alert source を受け取り、ranked root-cause hypotheses と Slack-gated remediation flow を生成します。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RCA accuracy on scenario suite | 20 synthetic incidents で root cause correct が80%以上 |
| 20 | Safety | audit log 上で Slack approval なしに destructive-action guard が発火しない |
| 20 | Time-to-hypothesis | alert から Slack brief まで p50 5分未満 |
| 20 | Explainability | すべての hypothesis に graph path と telemetry citation がある |
| 15 | Integration completeness | PagerDuty、Slack、ArgoCD、Prometheus が end-to-end で動く |
| **100** | | |

## Exercises

1. AWS の DevOps Agent が demo した同じ3 incident で agent を走らせます。side-by-side を公開し、どこで diverge したか報告します。

2. agent が *considered* した command のうち、approval なしなら destructive だったものを flag する "near-miss" audit を追加します。1週間の near-miss rate を測ります。

3. hypothesis model を Claude Sonnet 4.7 から self-hosted Llama 3.3 70B に差し替えます。RCA accuracy delta と incident あたり dollar を測ります。

4. causal filter を作ります。correlated telemetry spike と true root cause を区別します。20-scenario label 上で小さな classifier を train します。

5. rollback dry-run を追加します。同じ manifest を持つ staging cluster に対して ArgoCD rollback を実行し、Slack approval button 前に live cluster で rollback plan を verify します。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| K8s knowledge graph | 「Cluster graph」 | node = K8s objects + telemetry series、edge = ownership / scheduling / observation |
| Read-only-by-default | 「Scoped RBAC」 | agent の service account は get/list/describe のみ。destructive verb は approval 背後の separate server |
| Audit log | 「Considered vs executed」 | candidate command が実行されたか、誰が approve したかを含む append-only record |
| Hypothesis ranking | 「Evidence score」 | recency × specificity × graph-path length inverse × citation count |
| Slack approval card | 「HITL gate」 | remediation button 付き Slack message。human click まで agent は進めない |
| Telemetry citation | 「Evidence pointer」 | claim を支える Prometheus query、Loki selector、Tempo trace URL |
| MTTR | 「Time to resolution」 | alert fire から SLO recovery までの wall-clock |

## 参考文献

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/aws/aws-devops-agent-helps-you-accelerate-incident-response-and-improve-system-reliability-preview/) — canonical 2026 reference
- [Resolve AI K8s troubleshooting](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) — competitor reference
- [NeuBird semantic monitoring](https://www.neubird.ai) — semantic-graph approach
- [Metoro AI SRE](https://metoro.io) — SLO-first production framing
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) — cluster-state source
- [LangGraph](https://langchain-ai.github.io/langgraph/) — reference agent orchestrator
- [FastMCP](https://github.com/jlowin/fastmcp) — Python MCP server framework
- [ArgoCD rollback](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) — gated remediation target
