# 毕业设计 06 — Kubernetes DevOps 排障智能体

> AWS 的 DevOps Agent 正式发布，Resolve AI 公开了其 K8s 操作手册，NeuBird 演示了语义监控，Metoro 将 AI SRE 与按服务的 SLO 绑定。生产形态已经定型：告警 webhook 触发，智能体读取遥测数据，遍历 K8s 对象图谱，对根因假设进行排序，并在 Slack 上发布附带审批按钮的简报。默认只读。每次修复操作都需人工审批。本毕业设计就是这样一个智能体，将在 20 个合成事故上进行评估，并在三个共享案例上与 AWS 的 Agent 进行对比。

**Type:** 毕业设计
**Languages:** Python（智能体）、TypeScript（Slack 集成）
**Prerequisites:** Phase 11（LLM 工程）、Phase 13（工具与 MCP）、Phase 14（智能体）、Phase 15（自主智能体）、Phase 17（基础设施）、Phase 18（安全）
**Phases exercised:** P11 · P13 · P14 · P15 · P17 · P18
**Time:** 30 小时

## 问题

2025-2026 年 SRE 的叙事变成了："AI 智能体分流事故，人类审批修复操作。" AWS DevOps Agent、Resolve AI、NeuBird、Metoro、PagerDuty AIOps 都以这种形态投入生产。智能体读取 Prometheus 指标、Loki 日志、Tempo 追踪、kube-state-metrics 以及 K8s 对象的知识图谱。它在五分钟内产出带有遥测引用的、经排序的根因假设。它绝不会在没有通过 Slack 获得明确人工审批的情况下执行破坏性命令。

大部分难点在于范围限定与安全，而非推理。智能体需要默认只读的 RBAC 面、加固的 MCP 工具服务器，以及对每个"考虑过"与"实际执行"的命令的审计日志。它需要知道何时超出自身能力并上报。而且它的运行成本必须足够低，以免 OOM-kill 级联产生 5000 美元的智能体账单。

## 概念

智能体运行在知识图谱上。节点是 K8s 对象（Pod、Deployment、Service、Node、HPA、PVC）加上遥测数据源（Prometheus 序列、Loki 流、Tempo 追踪）。边编码所有权（Pod -> ReplicaSet -> Deployment）、调度（Pod -> Node）和观测（Pod -> Prometheus 序列）。图谱通过 kube-state-metrics 同步保持最新，并在每次告警时重新采样。

当告警触发时，智能体从受影响的对象出发进行根因分析。它遍历边，拉取相关的遥测片段（最近 15 分钟），并起草假设。假设按证据排序：有多少遥测引用支持它、多新、多具体。前 3 个假设连同图谱路径可视化和修复操作审批按钮一起发送到 Slack。

修复操作是受控的。默认允许的操作是只读的。破坏性操作（缩容、回滚、删除 Pod）需要 Slack 审批；ArgoCD 回滚钩子需要智能体永远不持有的授权令牌。审计日志记录智能体*考虑过*的每一条命令——而不仅仅是执行过的——以便审查流程能够发现险些造成破坏的情况。

## 架构

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

## 技术栈

- 可观测性数据源：Prometheus、Loki、Tempo、kube-state-metrics
- 知识图谱：K8s 对象 + 遥测边的 Neo4j（托管）或 kuzu（嵌入式）
- 智能体：LangGraph，每个工具都有允许列表，默认只读
- 工具传输：基于 StreamableHTTP 的 FastMCP；破坏性工具使用独立服务器，置于审批关卡之后
- 模型：Claude Sonnet 4.7 用于根因推理，Gemini 2.5 Flash 用于日志摘要
- 修复：ArgoCD 回滚 webhook、PagerDuty 升级、Slack 审批卡片
- 审计：仅追加的结构化日志（considered、executed、approved、outcome）
- 部署：拥有自身窄权限 RBAC 角色的 K8s 部署；独立命名空间

```figure
ce-rootcause-walk
```

## 动手构建

1. **图谱摄取。** 每 30 秒将 kube-state-metrics 同步到 Neo4j/kuzu。节点：Pod、Deployment、Node、Service、PVC、HPA。边：OWNED_BY、SCHEDULED_ON、EXPOSES、MOUNTS、SCALES。遥测覆盖边：OBSERVED_BY（一个 Pod 由一个 Prometheus 序列观测）。

2. **告警接收器。** 接受 PagerDuty 或 Alertmanager webhook 的 FastAPI 端点。提取受影响对象和 SLO 违约。

3. **只读工具面。** 通过 FastMCP 封装 kubectl、Prometheus 查询、Loki logql、Tempo traceql。每个工具只有窄 RBAC 动词（"get"、"list"、"describe"）。默认服务器中没有 "delete"、"exec"、"scale"。

4. **根因智能体。** LangGraph，三个节点：`sample` 拉取最近 15 分钟的遥测片段，`walk` 查询图谱中的相邻对象，`hypothesize` 起草带有遥测引用的、经排序的根因候选。

5. **证据评分。** 每个假设的得分 = 新近度 × 具体性 × 图谱路径长度倒数 × 引用数。返回前 3 个。

6. **Slack 简报。** 发布一个附件，包含假设、图谱路径可视化（服务端渲染的子图图像），以及至多一个修复操作的审批按钮。

7. **修复关卡。** 破坏性工具（缩容、回滚、删除）位于第二个 MCP 服务器上，由审批令牌保护。只有在 Slack 卡片经人工批准后，智能体才能调用它们。

8. **审计日志。** 仅追加的 JSONL：对每条候选命令，记录它是否被考虑过、是否被执行过、由谁批准。每日发送到 S3。

9. **合成事故套件。** 构建 20 个场景：OOMKill 级联、DNS 抖动、HPA 震荡、PVC 填满、嘈杂邻居、故障 sidecar、错误的 ConfigMap 发布、证书轮换、镜像拉取退避等。对智能体的根因准确率和假设生成时间进行评分。

## 使用

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

## 交付

`outputs/skill-devops-agent.md` 是交付物。给定一个 K8s 集群和告警源，智能体产出经排序的根因假设和经 Slack 审批的修复流程。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 场景套件上的 RCA 准确率 | 20 个合成事故中根因正确率 ≥80% |
| 20 | 安全性 | 审计日志中无 Slack 审批时破坏性操作防护绝不放行 |
| 20 | 假设生成时间 | 从告警到 Slack 简报的 p50 低于 5 分钟 |
| 20 | 可解释性 | 每个假设都有图谱路径和遥测引用 |
| 15 | 集成完整性 | PagerDuty、Slack、ArgoCD、Prometheus 端到端可用 |
| **100** | | |

## 练习

1. 在 AWS DevOps Agent 的演示所用的同三个事故上运行你的智能体。发布并排对比结果。报告智能体产生分歧之处。

2. 添加"险情"审计，标记智能体*考虑过*的任何未经批准即具有破坏性的命令。测量一周内的险情率。

3. 将假设模型从 Claude Sonnet 4.7 换成自托管的 Llama 3.3 70B。测量 RCA 准确率差异和每起事故的成本。

4. 构建因果过滤器：区分相关的遥测峰值与真正的根因。在 20 个场景的标签上训练一个小型分类器。

5. 添加回滚演练：针对具有相同清单的预发布集群执行 ArgoCD 回滚。在 Slack 审批按钮点击之前，在真实集群中验证回滚计划。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| K8s 知识图谱 | "集群图谱" | 节点 = K8s 对象 + 遥测序列；边 = 所有权、调度、观测 |
| 默认只读 | "受限 RBAC" | 智能体的服务账户只有 get/list/describe 动词；破坏性动词位于审批之后的独立服务器中 |
| 审计日志 | "考虑过 vs 执行过" | 对每条候选命令的仅追加记录：是否执行、由谁批准 |
| 假设排序 | "证据得分" | 新近度 × 具体性 × 图谱路径长度倒数 × 引用数 |
| Slack 审批卡片 | "HITL 关卡" | 带修复按钮的交互式 Slack 消息；在人工点击之前智能体无法继续 |
| 遥测引用 | "证据指针" | 支持某个论断的 Prometheus 查询、Loki 选择器或 Tempo 追踪 URL |
| MTTR | "解决时间" | 从告警触发到 SLO 恢复的墙上时钟时间 |

## 延伸阅读

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/aws/aws-devops-agent-helps-you-accelerate-incident-response-and-improve-system-reliability-preview/) — 2026 年的权威参考
- [Resolve AI K8s 排障](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) — 竞品参考
- [NeuBird 语义监控](https://www.neubird.ai) — 语义图谱方法
- [Metoro AI SRE](https://metoro.io) — SLO 优先的生产视角
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) — 集群状态数据源
- [LangGraph](https://langchain-ai.github.io/langgraph/) — 参考智能体编排器
- [FastMCP](https://github.com/jlowin/fastmcp) — Python MCP 服务器框架
- [ArgoCD 回滚](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) — 受控修复的目标