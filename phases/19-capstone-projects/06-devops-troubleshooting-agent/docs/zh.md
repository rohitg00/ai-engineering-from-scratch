# 综合项目 06 — Kubernetes 运维故障排查智能体

> AWS 的 DevOps Agent 已 GA，Resolve AI 发布了其 K8s 操作手册，NeuBird 演示了语义监控，Metoro 将 AI SRE 与每服务 SLO 绑定。生产形态已确定：告警 webhook 触发，智能体读取遥测数据，遍历 K8s 对象图谱，对根因假设进行排序，并发布带有批准按钮的 Slack 简报。默认只读。每次修复都由人工把关。本综合项目就是构建该智能体，在 20 个合成事件上进行评估，并在三个共享案例上与 AWS 的 Agent 进行比较。

**类型：** 综合项目
**语言：** Python（智能体）、TypeScript（Slack 集成）
**前置条件：** 第 11 阶段（LLM 工程）、第 13 阶段（工具和 MCP）、第 14 阶段（智能体）、第 15 阶段（自主）、第 17 阶段（基础设施）、第 18 阶段（安全）
**涉及阶段：** P11 · P13 · P14 · P15 · P17 · P18
**时间：** 30 小时

## 问题描述

2025-2026 年的 SRE 叙事变成了："AI 智能体分类事件，人工批准修复。" AWS DevOps Agent、Resolve AI、NeuBird、Metoro、PagerDuty AIOps 都在生产环境中交付了这种形态。智能体读取 Prometheus 指标、Loki 日志、Tempo 追踪、kube-state-metrics 和 K8s 对象的知识图谱。它在五分钟内生成带有遥测引用的根因假设排序。它绝不在没有通过 Slack 明确人工批准的情况下执行破坏性命令。

最困难的工作大多是范围界定和安全性，而非推理。智能体需要一个默认只读的 RBAC 表面、一个加固的 MCP 工具服务器，以及每个被考虑 vs 被执行的命令的审计日志。它需要知道自己何时超出能力范围并升级。而且它必须运行得足够便宜，以至于 OOM-kill 级联不会产生 $5k 的智能体账单。

## 核心概念

智能体在知识图谱上操作。节点是 K8s 对象（Pod、Deployment、Service、Node、HPA、PVC）加上遥测源（Prometheus 序列、Loki 流、Tempo 追踪）。边编码了所有权（Pod -> ReplicaSet -> Deployment）、调度（Pod -> Node）和观察（Pod -> Prometheus 序列）。图谱通过 kube-state-metrics 同步保持新鲜，并在每次告警时重新采样。

当告警触发时，智能体从受影响对象进行根因分析。它遍历边，提取相关遥测切片（最后 15 分钟），并起草假设。假设按证据排序：有多少遥测引用支持它、有多近期、有多具体。前 3 个假设连同图谱路径可视化以及修复操作的批准按钮一起发送到 Slack。

修复是有门控的。允许的默认操作是只读的。破坏性操作（缩容、回滚、删除 Pod）需要 Slack 批准；ArgoCD 回滚钩子需要一个智能体永远不持有的身份验证 token。审计日志记录智能体*考虑*的每个命令——不仅是执行的——以便审查过程捕获未遂事件。

## 架构

```
PagerDuty / Alertmanager webhook
           |
           v
     FastAPI 接收器
           |
           v
   LangGraph 根因分析智能体
           |
           +---- 只读 MCP 工具 ----+
           |                             |
           v                             v
   K8s 知识图谱              遥测切片
     (Neo4j / kuzu)              Prometheus, Loki, Tempo
   所有权 + 调度               最后 15 分钟，范围限定
           |
           v
   假设排序（证据权重）
           |
           v
   Slack 简报 + 批准按钮
           |
           v（已批准）
   ArgoCD 回滚钩子 / PagerDuty 升级
           |
           v
   审计日志：考虑 vs 执行，每个命令
```

## 技术栈

- 可观测性源：Prometheus、Loki、Tempo、kube-state-metrics
- 知识图谱：K8s 对象 + 遥测边的 Neo4j（托管）或 kuzu（嵌入式）
- 智能体：带有每工具允许列表的 LangGraph，默认只读
- 工具传输：基于 StreamableHTTP 的 FastMCP；破坏性工具位于批准门之后单独的服务器
- 模型：用于根因推理的 Claude Sonnet 4.7，用于日志摘要的 Gemini 2.5 Flash
- 修复：ArgoCD 回滚 webhook、PagerDuty 升级、Slack 批准卡片
- 审计：仅追加结构化日志（考虑、执行、批准、结果）
- 部署：带有自己狭窄 RBAC 角色的 K8s 部署；独立命名空间

## 构建步骤

1. **图谱摄取。** 每 30 秒将 kube-state-metrics 同步到 Neo4j/kuzu。节点：Pod、Deployment、Node、Service、PVC、HPA。边：OWNED_BY、SCHEDULED_ON、EXPOSES、MOUNTS、SCALES。遥测叠加边：OBSERVED_BY（一个 Pod 被一个 Prometheus 序列观察）。

2. **告警接收器。** 接受 PagerDuty 或 Alertmanager webhook 的 FastAPI 端点。提取受影响对象和 SLO 违背。

3. **只读工具表面。** 通过 FastMCP 封装 kubectl、Prometheus 查询、Loki logql、Tempo traceql。每个工具都有狭窄的 RBAC 动词（"get"、"list"、"describe"）。默认服务器中没有 "delete"、"exec"、"scale"。

4. **根因分析智能体。** 带有三个节点的 LangGraph：`sample` 提取最后 15 分钟的遥测切片，`walk` 查询图谱中的相邻对象，`hypothesize` 起草带有遥测引用的排序根因候选。

5. **证据评分。** 每个假设有一个分数 = 新近度 * 特异性 * 图路径长度倒数 * 引用计数。返回前 3 个。

6. **Slack 简报。** 发布一个附件，包含假设、图谱路径可视化（服务器端渲染的子图图像），以及最多一个修复操作的批准按钮。

7. **修复门控。** 破坏性工具（缩容、回滚、删除）位于批准 token 之后的第二个 MCP 服务器上。智能体仅在 Slack 卡片被人工批准后才能调用它们。

8. **审计日志。** 仅追加 JSONL：对于每个候选命令，记录是否已被考虑、是否被执行、谁批准的。每日发送到 S3。

9. **合成事件套件。** 构建 20 个场景：OOMKill 级联、DNS 抖动、HPA 震荡、PVC 填满、吵闹邻居、故障边车、错误 ConfigMap 推出、证书轮换、镜像拉取退避等。在根因准确性和假设生成时间上评分智能体。

## 使用示例

```
webhook：alert.pagerduty.com -> checkout-api SLO 违背，错误率 14%
[graph]   受影响：Deployment checkout-api（3 个 Pod，Node ip-10-2-3-4）
[walk]    邻居：ReplicaSet checkout-api-abc，Service checkout-api，
           14 分钟前的近期推出
[sample]  prometheus 错误率 14%，上升趋势；loki /api/v2/pay 上的 500 错误
[hypo]    #1 错误推出：最新镜像 checkout-api:v2.41 在 /healthz 上失败
          引用：deploy.yaml（修订版 42）、prometheus 错误率、loki 500 堆栈
[slack]   [回滚到 v2.40]  [升级]  [忽略]
          （需要批准；智能体不会单方面回滚）
```

## 交付成果

`outputs/skill-devops-agent.md` 是可交付成果。给定一个 K8s 集群和告警源，智能体生成排序的根因假设和 Slack 门控的修复流程。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 场景套件上的 RCA 准确性 | 20 个合成事件中 ≥80% 正确的根因 |
| 20 | 安全性 | 审计日志中未经 Slack 批准绝不触发破坏性操作守卫 |
| 20 | 假设生成时间 | 从告警到 Slack 简报的 p50 在 5 分钟内 |
| 20 | 可解释性 | 每个假设都有图路径和遥测引用 |
| 15 | 集成完整性 | PagerDuty、Slack、ArgoCD、Prometheus 端到端工作 |
| **100** | | |

## 练习

1. 在 AWS 的 DevOps Agent 演示的相同三个事件上运行你的智能体。发布并排对比。报告智能体在何处出现分歧。

2. 添加一个"未遂"审计，标记智能体*考虑*过的任何未经批准会是破坏性的命令。在一周内测量未遂率。

3. 将假设模型从 Claude Sonnet 4.7 换为自托管的 Llama 3.3 70B。测量 RCA 准确性差异和每次事件代价。

4. 构建一个因果过滤器：区分相关的遥测峰值与真正的根因。在 20 个场景标签上训练一个小型分类器。

5. 添加回滚干运行：针对具有相同清单的预发集群进行 ArgoCD 回滚。在 Slack 批准按钮之前，在实时集群中验证回滚计划。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| K8s 知识图谱 | "集群图" | 节点 = K8s 对象 + 遥测序列；边 = 所有权、调度、观察 |
| 默认只读 | "范围 RBAC" | 智能体的服务账户只有 get/list/describe 动词；破坏性动词位于批准之后的独立服务器中 |
| 审计日志 | "考虑 vs 执行" | 每个候选命令的仅追加记录，无论是否运行、谁批准 |
| 假设排序 | "证据分数" | 新近度 × 特异性 × 图路径长度倒数 × 引用计数 |
| Slack 批准卡片 | "人在回路门控" | 带有修复按钮的交互式 Slack 消息；智能体在人工点击之前无法继续 |
| 遥测引用 | "证据指针" | 支持声明的 Prometheus 查询、Loki 选择器或 Tempo 追踪 URL |
| MTTR | "解决时间" | 从告警触发到 SLO 恢复的实际时间 |

## 延伸阅读

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/aws/aws-devops-agent-helps-you-accelerate-incident-response-and-improve-system-reliability-preview/) — 2026 年规范参考
- [Resolve AI K8s 故障排查](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) — 竞争对手参考
- [NeuBird 语义监控](https://www.neubird.ai) — 语义图方法
- [Metoro AI SRE](https://metoro.io) — SLO 优先的生产框架
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) — 集群状态源
- [LangGraph](https://langchain-ai.github.io/langgraph/) — 参考智能体编排器
- [FastMCP](https://github.com/jlowin/fastmcp) — Python MCP 服务器框架
- [ArgoCD 回滚](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) — 门控修复目标
