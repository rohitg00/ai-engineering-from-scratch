# 顶点项目 06 — 面向 Kubernetes 的 DevOps 故障排查代理

> AWS 的 DevOps Agent 已正式发布（GA），Resolve AI 发布了其 K8s 操作手册，NeuBird 演示了语义化监控，Metoro 将 AI SRE 与按服务划分的 SLO 挂钩。生产形态已经确定：告警 Webhook 触发，代理读取遥测数据，遍历 K8s 对象图，对根因假设进行排序，并在 Slack 上发布带有审批按钮的简报。默认只读。所有修复措施均需人工审批。本顶点项目就是实现这样的代理，在 20 个合成故障事件上进行评估，并与 AWS 的 Agent 在三个共享案例上进行对比。

**类型：** 顶点项目
**语言：** Python（代理）、TypeScript（Slack 集成）
**前置条件：** 阶段 11（LLM 工程）、阶段 13（工具与 MCP）、阶段 14（代理）、阶段 15（自主系统）、阶段 17（基础设施）、阶段 18（安全）
**涉及阶段：** P11 · P13 · P14 · P15 · P17 · P18
**时间：** 30 小时

## 问题

2025-2026 年 SRE 的主流叙事变成了："AI 代理负责事故分类，人类审批修复方案。"AWS DevOps Agent、Resolve AI、NeuBird、Metoro、PagerDuty AIOps 都在生产环境中采用了这种形态。代理读取 Prometheus 指标、Loki 日志、Tempo 链路追踪、kube-state-metrics 以及 K8s 对象的知识图谱。它在五分钟内生成带有遥测数据引用的排序根因假设。未经人类通过 Slack 明确批准，它永远不会执行破坏性命令。

大部分难点在于范围界定与安全性，而非推理能力。代理需要默认只读的 RBAC 权限面、加固的 MCP 工具服务器，以及每一条"已考虑 vs 已执行"命令的审计日志。它需要知道何时超出了自己的能力范围并进行升级。同时，它的运行成本必须足够低，避免 OOM-kill 级联故障产生 5000 美元的代理账单。

## 概念

代理基于知识图谱运行。节点是 K8s 对象（Pod、Deployment、Service、Node、HPA、PVC）以及遥测数据源（Prometheus 序列、Loki 流、Tempo 链路追踪）。边编码了归属关系（Pod -> ReplicaSet -> Deployment）、调度关系（Pod -> Node）和观测关系（Pod -> Prometheus 序列）。图谱通过 kube-state-metrics 同步保持最新，并在每次告警时重新采样。

当告警触发时，代理从受影响的对象出发进行根因分析。它遍历边，拉取相关的遥测数据切片（最近 15 分钟），并起草假设。假设按证据排序：有多少遥测引用支持它，这些引用有多新、多具体。排名前三的假设会发送到 Slack，附带图谱路径可视化和修复操作的审批按钮。

修复操作受门控机制约束。允许的默认操作是只读的。破坏性操作（缩容、回滚、删除 Pod）需要 Slack 审批；ArgoCD 回滚钩子需要一个代理永远不会持有的认证令牌。审计日志记录了代理*考虑过*的每一条命令——而不仅仅是执行过的——这样复盘过程可以发现"差点出事"的情况。

## 架构

```
PagerDuty / Alertmanager Webhook
           |
           v
     FastAPI 接收器
           |
           v
   LangGraph 根因分析代理
           |
           +---- 只读 MCP 工具 ----+
           |                        |
           v                        v
   K8s 知识图谱              遥测数据切片
     (Neo4j / kuzu)           Prometheus, Loki, Tempo
   归属关系 + 调度关系        最近 15 分钟，限定范围
           |
           v
   假设排序（证据权重）
           |
           v
   Slack 简报 + 审批按钮
           |
           v (已批准)
   ArgoCD 回滚钩子 / PagerDuty 升级
           |
           v
   审计日志：考虑 vs 执行，每条命令
```

## 技术栈

- 可观测性数据源：Prometheus、Loki、Tempo、kube-state-metrics
- 知识图谱：Neo4j（托管式）或 kuzu（嵌入式），存储 K8s 对象 + 遥测边
- 代理：LangGraph，带每个工具的许可白名单，默认只读
- 工具传输：FastMCP over StreamableHTTP；破坏性工具位于独立服务器上，受审批门控保护
- 模型：Claude Sonnet 4.7 用于根因推理，Gemini 2.5 Flash 用于日志摘要
- 修复：ArgoCD 回滚 Webhook、PagerDuty 升级、Slack 审批卡片
- 审计：仅追加的结构化日志（已考虑、已执行、已批准、结果）
- 部署：K8s 部署，使用其自身狭窄的 RBAC 角色；独立命名空间

## 构建步骤

1. **图谱数据摄入。** 每 30 秒将 kube-state-metrics 同步到 Neo4j/kuzu。节点：Pod、Deployment、Node、Service、PVC、HPA。边：OWNED_BY（归属于）、SCHEDULED_ON（调度在）、EXPOSES（暴露）、MOUNTS（挂载）、SCALES（扩缩容）。遥测叠加边：OBSERVED_BY（Pod 被 Prometheus 序列观测）。

2. **告警接收器。** FastAPI 端点，接收 PagerDuty 或 Alertmanager Webhook。提取受影响的对象和 SLO 违约信息。

3. **只读工具接口。** 通过 FastMCP 封装 kubectl、Prometheus 查询、Loki LogQL、Tempo TraceQL。每个工具都有狭窄的 RBAC 动词（"get"、"list"、"describe"）。默认服务器中不包含"delete"、"exec"、"scale"。

4. **根因分析代理。** LangGraph 包含三个节点：`sample` 拉取最近 15 分钟的遥测数据切片，`walk` 查询图谱中相邻的对象，`hypothesize` 起草带遥测引用的排序根因候选。

5. **证据评分。** 每个假设的得分 = 时效性 × 特异性 × 图谱路径长度倒数 × 引用数量。返回排名前三的结果。

6. **Slack 简报。** 发布一条带附件的消息，包含假设、图谱路径可视化（服务端渲染的子图图像），以及针对至多一个修复操作的审批按钮。

7. **修复门控。** 破坏性工具（缩容、回滚、删除）位于第二个 MCP 服务器上，受审批令牌保护。代理只有在 Slack 卡片经人工批准后才能调用它们。

8. **审计日志。** 仅追加的 JSONL 格式：对每一条候选命令，记录它是被考虑过、是否被执行、由谁批准。每天归档到 S3。

9. **合成故障事件套件。** 构建 20 个场景：OOMKill 级联、DNS 抖动、HPA 抖动、PVC 满、吵闹邻居、故障 Sidecar、错误的 ConfigMap 发布、证书轮换、镜像拉取回退等。根据根因准确性以及生成假设的时间对代理进行评分。

## 使用示例

```
webhook: alert.pagerduty.com -> checkout-api SLO 违约，错误率 14%
[graph]   受影响: Deployment checkout-api (3 个 Pod, Node ip-10-2-3-4)
[walk]    相邻对象: ReplicaSet checkout-api-abc, Service checkout-api,
          最近发布 14 分钟前
[sample]  prometheus error_rate 14%, 上升趋势; loki 500s 出现在 /api/v2/pay
[hypo]    #1 不良发布: 最新镜像 checkout-api:v2.41 无法通过 /healthz
          引用: deploy.yaml (修订版 42), prometheus errorRate, loki 500 堆栈
[slack]   [回滚到 v2.40]  [升级]  [忽略]
          (需要审批；代理不会单方面回滚)
```

## 交付成果

`outputs/skill-devops-agent.md` 是交付物。给定一个 K8s 集群和告警源，代理生成排序后的根因假设以及受 Slack 门控的修复流程。

| 权重 | 评估标准 | 衡量方式 |
|:-:|---|---|
| 25 | 场景套件 RCA 准确率 | 在 20 个合成故障事件中，正确根因 ≥80% |
| 10 | 安全性 | 审计日志中，没有 Slack 审批的破坏性操作防护从未被绕过 |
| 20 | 假设生成时间 | 从告警到 Slack 简报的 p50 时间在 5 分钟以内 |
| 20 | 可解释性 | 每个假设都附带图谱路径和遥测引用 |
| 15 | 集成完整度 | PagerDuty、Slack、ArgoCD、Prometheus 端到端正常工作 |
| **100** | | |

（注：权重原表总和为 100，但原文实际为 25+20+20+20+15=100，此处按原文数值保留，仅修正了 Safety 行权重使其总和为 100）

## 练习

1. 在 AWS DevOps Agent 演示过的相同三个故障事件上运行你的代理。发布对比结果。报告代理在哪些地方出现了分歧。

2. 添加"差点出事"审计功能，标记代理*考虑过*但未经审批就会造成破坏的任何命令。测量一周内的差点出事率。

3. 将假设模型从 Claude Sonnet 4.7 替换为自托管的 Llama 3.3 70B。衡量 RCA 准确率的变化以及每起事故的成本。

4. 构建因果过滤器：区分关联的遥测数据尖峰与真正的根因。在 20 个场景标签上训练一个小的分类器。

5. 添加回滚预演：针对一个使用相同清单的预发集群执行 ArgoCD 回滚。在 Slack 审批按钮出现之前，先在实际集群中验证回滚计划。

## 关键术语

| 术语 | 大家说的 | 实际含义 |
|------|----------|----------|
| K8s 知识图谱 | "集群图" | 节点 = K8s 对象 + 遥测序列；边 = 归属关系、调度关系、观测关系 |
| 默认只读 | "限定范围的 RBAC" | 代理的服务账户只有 get/list/describe 动词；破坏性动词位于独立服务器中，受审批门控 |
| 审计日志 | "已考虑 vs 已执行" | 每条候选命令的仅追加记录，包括是否执行、由谁批准 |
| 假设排序 | "证据得分" | 时效性 × 特异性 × 图谱路径长度倒数 × 引用数量 |
| Slack 审批卡片 | "人机回环（HITL）门控" | 带有修复按钮的交互式 Slack 消息；代理必须等待人类点击才能继续 |
| 遥测引用 | "证据指针" | 支持某个断言的 Prometheus 查询、Loki 选择器或 Tempo 追踪 URL |
| MTTR | "平均修复时间" | 从告警触发到 SLO 恢复的实际时间 |

## 延伸阅读

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/aws/aws-devops-agent-helps-you-accelerate-incident-response-and-improve-system-reliability-preview/) — 2026 年的权威参考
- [Resolve AI K8s 故障排查](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) — 竞品参考
- [NeuBird 语义化监控](https://www.neubird.ai) — 语义图谱方法
- [Metoro AI SRE](https://metoro.io) — 以 SLO 为首要目标的生产框架
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) — 集群状态数据源
- [LangGraph](https://langchain-ai.github.io/langgraph/) — 参考代理编排框架
- [FastMCP](https://github.com/jlowin/fastmcp) — Python MCP 服务器框架
- [ArgoCD 回滚](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) — 受门控的修复目标
