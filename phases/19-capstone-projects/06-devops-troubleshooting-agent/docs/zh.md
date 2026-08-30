# 06 · Kubernetes DevOps 故障排查智能体

> AWS DevOps Agent 正式发布（GA），Resolve AI 公开了其 K8s 排障手册（playbook），NeuBird 演示了语义监控，Metoro 则将 AI SRE 绑定到每个服务的 SLO。生产形态已经确定：告警 Webhook 触发，智能体读取遥测数据，遍历 K8s 对象图，对根因假设进行排序，并将带有审批按钮的 Slack 简报推送到频道。默认只读。每一次修复操作都必须经过人工审批。本项目就是构建这样一个智能体，在 20 个合成事件上评估，并与 AWS Agent 在三个共同案例上进行对比。

**类型：** 综合项目
**语言：** Python（智能体）、TypeScript（Slack 集成）
**前置：** 第 11 阶段（LLM 工程）、第 13 阶段（工具与 MCP）、第 14 阶段（智能体）、第 15 阶段（自主运行）、第 17 阶段（基础设施）、第 18 阶段（安全）
**涉及阶段：** P11 · P13 · P14 · P15 · P17 · P18
**时长：** 30 小时

## 问题阐述

2025-2026 年 SRE 的主流叙事变成了：「AI 智能体负责事件分诊（triage），人工负责审批修复。」AWS DevOps Agent、Resolve AI、NeuBird、Metoro、PagerDuty AIOps 都在生产中采用了这一形态。智能体读取 Prometheus 指标、Loki 日志、Tempo 追踪、kube-state-metrics 以及 K8s 对象的知识图谱（knowledge graph），在五分钟内生成带有遥测引用（telemetry citation）的排序根因假设。它永远不会在没有通过 Slack 获得明确人工审批的情况下执行破坏性命令。

大部分难点在于范围界定和安全防护，而非推理本身。智能体需要默认只读的 RBAC 权限面、加固的 MCP 工具服务器，以及记录每条「曾考虑执行」与「实际执行」命令的审计日志。它需要知道何时超出自身能力范围并升级处理。同时，它的运行成本必须足够低，不能因为一次 OOM-kill 级联故障就产生 5000 美元的智能体账单。

## 核心概念

智能体运作于一张知识图谱之上。节点包括 K8s 对象（Pod、Deployment、Service、Node、HPA、PVC）以及遥测数据源（Prometheus 序列、Loki 流、Tempo 追踪）。边编码了归属关系（Pod -> ReplicaSet -> Deployment）、调度关系（Pod -> Node）和观测关系（Pod -> Prometheus 序列）。图谱通过 kube-state-metrics 同步保持更新，并在每次告警时重新采样。

当告警触发时，智能体从受影响的对象出发进行根因分析。它沿着边遍历，拉取相关遥测数据切片（最近 15 分钟），并起草假设。假设按证据排序：支持它的遥测引用数量、数据的新近程度、具体程度。排名前三的假设将发送到 Slack，附带图谱路径可视化和修复操作的审批按钮。

修复操作受审批门控。默认允许的操作仅为只读。破坏性操作（缩容、回滚、删除 Pod）需要 Slack 审批；ArgoCD 回滚钩子需要智能体从不持有的认证令牌。审计日志记录智能体「曾考虑执行」的每条命令（不仅仅是已执行的），以便审查流程捕捉到险些发生的问题。

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
- 知识图谱：Neo4j（托管）或 kuzu（嵌入式），存储 K8s 对象与遥测边的图谱
- 智能体：LangGraph，配备逐工具允许列表，默认只读
- 工具传输：基于 StreamableHTTP 的 FastMCP；破坏性工具部署在独立的审批门控服务器上
- 模型：Claude Sonnet 4.7 用于根因推理，Gemini 2.5 Flash 用于日志摘要
- 修复操作：ArgoCD 回滚 Webhook、PagerDuty 升级、Slack 审批卡片
- 审计：追加写入的结构化日志（曾考虑、已执行、已审批、结果）
- 部署：K8s Deployment，配备自身受限的 RBAC 角色；独立命名空间

## 构建步骤

1. **图谱数据接入。** 每 30 秒将 kube-state-metrics 同步到 Neo4j/kuzu。节点类型：Pod、Deployment、Node、Service、PVC、HPA。边类型：OWNED_BY、SCHEDULED_ON、EXPOSES、MOUNTS、SCALES。遥测覆盖边：OBSERVED_BY（Pod 被某条 Prometheus 序列观测）。

2. **告警接收器。** FastAPI 端点，接受 PagerDuty 或 Alertmanager Webhook。提取受影响的对象及 SLO 违规信息。

3. **只读工具面。** 通过 FastMCP 封装 kubectl、Prometheus 查询、Loki LogQL、Tempo TraceQL。每个工具仅拥有受限的 RBAC 动词（"get"、"list"、"describe"）。默认服务器中不包含 "delete"、"exec"、"scale"。

4. **根因分析智能体。** LangGraph，包含三个节点：`sample` 拉取最近 15 分钟的遥测切片，`walk` 查询图谱获取邻近对象，`hypothesize` 生成带有遥测引用的排序根因候选假设。

5. **证据评分。** 每个假设的得分 = 新近程度 × 具体程度 × 图谱路径长度倒数 × 引用数量。返回前三名。

6. **Slack 简报。** 推送一个附件，包含假设、图谱路径可视化（服务端渲染的子图图片），以及最多一个修复操作的审批按钮。

7. **修复审批门控。** 破坏性工具（缩容、回滚、删除）部署在第二个 MCP 服务器上，需审批令牌才能访问。智能体只有在 Slack 卡片获得人工审批后才能调用它们。

8. **审计日志。** 追加写入的 JSONL 格式：对每条候选命令，记录是否曾被考虑、是否已执行、由谁审批。每日归档到 S3。

9. **合成事件测试套件。** 构建 20 个场景：OOMKill 级联、DNS 抖动、HPA 震荡、PVC 填满、嘈杂邻居（noisy neighbor）、有缺陷的边车（sidecar）、错误的 ConfigMap 发布、证书轮换、镜像拉取回退（image-pull backoff）等。按根因准确率和从告警到生成假设的耗时对智能体进行评分。

## 使用示例

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

## 交付标准

`outputs/skill-devops-agent.md` 为交付物。给定一个 K8s 集群和告警源，智能体应能生成排序的根因假设并提供经 Slack 审批门控的修复流程。

| 权重 | 标准 | 如何衡量 |
|:-:|---|---|
| 25 | 场景套件中的根因分析（RCA）准确率 | 在 20 个合成事件中，根因正确率 ≥ 80% |
| 20 | 安全性 | 审计日志中，破坏性操作门控从未在无 Slack 审批的情况下触发 |
| 20 | 生成假设耗时 | 从告警到 Slack 简报的 p50 耗时低于 5 分钟 |
| 15 | 可解释性 | 每个假设都附有图谱路径和遥测引用 |
| 15 | 集成完整度 | PagerDuty、Slack、ArgoCD、Prometheus 端到端打通 |
| **100** | | |

## 练习

1. 在 AWS DevOps Agent 演示所用的三个相同事件上运行你的智能体。发布并排对比结果。报告智能体在哪些方面与 AWS Agent 表现不同。

2. 添加「险些发生」（near-miss）审计功能：标记智能体「曾考虑执行」但在无审批情况下本应属于破坏性的任何命令。测量一周内的险些发生率。

3. 将假设生成模型从 Claude Sonnet 4.7 替换为自托管的 Llama 3.3 70B。测量根因分析准确率的变化以及每次事件的美元成本。

4. 构建因果过滤器：区分相关的遥测尖峰与真正的根因。在 20 个场景的标注数据上训练一个小型分类器。

5. 添加回滚预演：在具有相同清单的预发布（staging）集群上执行 ArgoCD 回滚。在 Slack 审批按钮出现之前，先在真实集群中验证回滚计划。

## 关键术语

| 术语 | 常见说法 | 实际含义 |
|------|-----------------|------------------------|
| K8s 知识图谱 | 「集群图谱」 | 节点 = K8s 对象 + 遥测序列；边 = 归属关系、调度关系、观测关系 |
| 默认只读 | 「受限 RBAC」 | 智能体的 Service Account 仅拥有 get/list/describe 动词；破坏性动词部署在独立服务器上，需审批方可访问 |
| 审计日志 | 「曾考虑 vs 已执行」 | 对每条候选命令的追加写入记录，包含是否运行、由谁审批 |
| 假设排序 | 「证据评分」 | 新近程度 × 具体程度 × 图谱路径长度倒数 × 引用数量 |
| Slack 审批卡片 | 「人机回路（HITL）门控」 | 带有修复按钮的交互式 Slack 消息；智能体在人工点击前不能继续操作 |
| 遥测引用 | 「证据指针」 | 支持某个结论的 Prometheus 查询、Loki 选择器或 Tempo 追踪 URL |
| MTTR | 「恢复时间」 | 从告警触发到 SLO 恢复的墙钟时长 |

## 延伸阅读

- [AWS DevOps Agent 正式发布](https://aws.amazon.com/blogs/aws/aws-devops-agent-helps-you-accelerate-incident-response-and-improve-system-reliability-preview/) — 2026 年权威参考资料
- [Resolve AI K8s 排障](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) — 竞品参考资料
- [NeuBird 语义监控](https://www.neubird.ai) — 语义图谱方案
- [Metoro AI SRE](https://metoro.io) — 以 SLO 为先的生产框架
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) — 集群状态数据源
- [LangGraph](https://langchain-ai.github.io/langgraph/) — 参考智能体编排器
- [FastMCP](https://github.com/jlowin/fastmcp) — Python MCP 服务器框架
- [ArgoCD 回滚](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) — 门控修复目标
