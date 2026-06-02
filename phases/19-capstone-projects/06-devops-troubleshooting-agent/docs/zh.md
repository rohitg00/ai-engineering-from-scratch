# Capstone 06 — Kubernetes 的 DevOps 故障排查 Agent

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> AWS 的 DevOps Agent 已 GA、Resolve AI 公开了它的 K8s playbook、NeuBird 演示了语义化监控、Metoro 把 AI SRE 与每个服务的 SLO 绑定。生产形态已经定型：一个告警 webhook 触发，agent 读取 telemetry、走一遍 K8s 对象的图、给根因假设排序，然后把一份带审批按钮的简报推到 Slack。默认只读。所有补救动作由人审批。本 capstone 要做的就是这种 agent，用 20 个合成事故来评估，并在三个共享案例上与 AWS 的 Agent 对比。

**Type:** Capstone
**Languages:** Python (agent), TypeScript (Slack integration)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and MCP), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:** P11 · P13 · P14 · P15 · P17 · P18
**Time:** 30 hours

## 问题（Problem）

2025-2026 年 SRE 圈的叙事变成了：「AI agent 做事故分诊，人类审批补救动作」。AWS DevOps Agent、Resolve AI、NeuBird、Metoro、PagerDuty AIOps 都在生产里跑这种形态。Agent 读 Prometheus 指标、Loki 日志、Tempo trace、kube-state-metrics，以及一张 K8s 对象的知识图谱。它在 5 分钟内产出一份带 telemetry 引用的、按可信度排序的根因假设。没有明确的人通过 Slack 批准，它绝不执行破坏性命令。

大部分硬骨头其实是范围划定和安全，而不是推理本身。Agent 需要一个默认只读的 RBAC 面、一台加固过的 MCP 工具服务器，以及一份对每条「考虑过 vs 执行了」命令的审计日志。它得知道自己什么时候力不能及，要往上 escalate。还得便宜到 OOM-kill 雪崩时不会刷出 5 千美元的 agent 账单。

## 概念（Concept）

Agent 在一张知识图谱上工作。节点是 K8s 对象（Pod、Deployment、Service、Node、HPA、PVC）外加 telemetry 源（Prometheus 序列、Loki 流、Tempo trace）。边编码归属（Pod -> ReplicaSet -> Deployment）、调度（Pod -> Node）、观察（Pod -> Prometheus 序列）。图由一个 kube-state-metrics 同步保持新鲜，并在每次告警时重新采样。

告警触发后，agent 从受影响对象出发做根因分析。它沿边游走，拉取相关的 telemetry 切片（最近 15 分钟），起草一份假设。假设按证据排序：有多少 telemetry 引用支持它、有多新、有多具体。Top-3 假设带着图路径可视化和补救动作的审批按钮一起发到 Slack。

补救是受闸门控制的。默认放行的动作都是只读的。破坏性动作（缩容、回滚、删 Pod）需要 Slack 审批；ArgoCD 回滚 hook 用的 auth token agent 自己也拿不到。审计日志会记录 agent *考虑过* 的每条命令——而不仅是执行了的——好让复盘流程能抓到擦边球。

## 架构（Architecture）

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

## 技术栈（Stack）

- 可观测性来源：Prometheus、Loki、Tempo、kube-state-metrics
- 知识图谱：托管的 Neo4j 或嵌入式的 kuzu，承载 K8s 对象 + telemetry 边
- Agent：LangGraph，按工具配 allow-list（白名单），默认只读
- 工具传输：FastMCP over StreamableHTTP；破坏性工具放在审批闸门后的另一台服务器
- 模型：Claude Sonnet 4.7 做根因推理，Gemini 2.5 Flash 做日志摘要
- 补救：ArgoCD rollback webhook、PagerDuty escalate、Slack 审批卡片
- 审计：append-only 结构化日志（considered、executed、approved、outcome）
- 部署：K8s deployment，自带一个范围很窄的 RBAC role；放在独立 namespace

## 动手实现（Build It）

1. **图入库（Graph ingestion）。** 每 30 秒把 kube-state-metrics 同步进 Neo4j/kuzu。节点：Pod、Deployment、Node、Service、PVC、HPA。边：OWNED_BY、SCHEDULED_ON、EXPOSES、MOUNTS、SCALES。Telemetry 叠加边：OBSERVED_BY（一个 Pod 被某条 Prometheus 序列观察）。

2. **告警接收器（Alert receiver）。** 一个 FastAPI 端点，接收 PagerDuty 或 Alertmanager 的 webhook。提取受影响对象和 SLO 违规。

3. **只读工具面（Read-only tool surface）。** 用 FastMCP 包装 kubectl、Prometheus 查询、Loki logql、Tempo traceql。每个工具只暴露一个窄 RBAC 动词（"get"、"list"、"describe"）。默认服务器里没有 "delete"、"exec"、"scale"。

4. **根因 agent（Root-cause agent）。** LangGraph，三个节点：`sample` 拉最近 15 分钟的 telemetry 切片；`walk` 在图里查邻居对象；`hypothesize` 起草带 telemetry 引用的、排好序的根因候选。

5. **证据评分（Evidence scoring）。** 每个假设有一个评分 = recency × specificity × 图路径长度的倒数 × 引用数。返回 top-3。

6. **Slack 简报（Slack brief）。** 推一条附件消息，带假设、图路径可视化（一张服务端渲染的子图图片）、以及最多一个补救动作的审批按钮。

7. **补救闸门（Remediation gate）。** 破坏性工具（缩容、回滚、删除）放在第二台 MCP 服务器上，前面有审批 token。Agent 只能在 Slack 卡片被人类批准之后才能调用它们。

8. **审计日志（Audit log）。** Append-only 的 JSONL：每个候选命令都记一行——是否被考虑过、是否执行了、谁批的。每天上传到 S3。

9. **合成事故套件（Synthetic incident suite）。** 构造 20 个场景：OOMKill 雪崩、DNS 抖动、HPA 抖动、PVC 写满、noisy neighbor、坏 sidecar、坏 ConfigMap rollout、证书轮换、image-pull backoff 等。用根因准确率和「告警到假设」的耗时给 agent 打分。

## 用起来（Use It）

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

## 上线部署（Ship It）

`outputs/skill-devops-agent.md` 就是交付物。给定一个 K8s 集群和告警源，agent 产出排序后的根因假设，并走一遍 Slack 闸控的补救流程。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | 场景套件上的 RCA 准确率 | 20 个合成事故里 ≥80% 命中根因 |
| 20 | 安全性 | 审计日志里，破坏性动作的护栏从未在没有 Slack 审批的情况下放行 |
| 20 | 假设产出耗时 | 从告警到 Slack 简报的 p50 < 5 分钟 |
| 20 | 可解释性 | 每个假设都有图路径和 telemetry 引用 |
| 15 | 集成完整度 | PagerDuty、Slack、ArgoCD、Prometheus 端到端跑通 |
| **100** | | |

## 练习（Exercises）

1. 把你的 agent 跑在 AWS DevOps Agent 演示用的同样三个事故上。把对照结果发出来。报告 agent 与之分歧的地方。

2. 加一个「擦边球」审计：标出 agent *考虑过* 的、若没经审批就会成为破坏性的任何命令。测一周内的擦边球率。

3. 把假设模型从 Claude Sonnet 4.7 换成自托管的 Llama 3.3 70B。测 RCA 准确率差异和每个事故的美元成本。

4. 构造一个因果过滤器：把相关性飙升的 telemetry 与真正的根因区分开。在 20 场景的标注上训一个小分类器。

5. 加一个回滚演练（rollback dry-run）：用同一份 manifest 在 staging 集群上跑 ArgoCD 回滚。在 Slack 审批按钮按下之前，先在线上集群里验证回滚计划。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| K8s knowledge graph | "Cluster graph" | 节点 = K8s 对象 + telemetry 序列；边 = 归属、调度、观察 |
| Read-only-by-default | "Scoped RBAC" | Agent 的 service account 只有 get/list/describe 动词；破坏性动词在另一台服务器上、由审批闸门把守 |
| Audit log | "Considered vs executed" | 每条候选命令的 append-only 记录：跑没跑、谁批的 |
| Hypothesis ranking | "Evidence score" | Recency × specificity × 图路径长度的倒数 × 引用数 |
| Slack approval card | "HITL gate" | 一条带补救按钮的交互式 Slack 消息；在人点之前 agent 不能继续（HITL 即 human-in-the-loop / 人工确认） |
| Telemetry citation | "Evidence pointer" | 支撑某个论断的 Prometheus 查询、Loki selector，或 Tempo trace URL |
| MTTR | "Time to resolution" | 从告警触发到 SLO 恢复的墙钟时间 |

## 延伸阅读（Further Reading）

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/aws/aws-devops-agent-helps-you-accelerate-incident-response-and-improve-system-reliability-preview/) — 2026 年的标准参考
- [Resolve AI K8s troubleshooting](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) — 竞品参考
- [NeuBird semantic monitoring](https://www.neubird.ai) — 语义图路线
- [Metoro AI SRE](https://metoro.io) — SLO 优先的生产化框架
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) — 集群状态来源
- [LangGraph](https://langchain-ai.github.io/langgraph/) — 参考 agent orchestrator
- [FastMCP](https://github.com/jlowin/fastmcp) — Python MCP 服务器框架
- [ArgoCD rollback](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) — 闸控补救的目标
