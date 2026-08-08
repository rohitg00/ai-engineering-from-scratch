# 顶点项目 06 —— Kubernetes DevOps 故障排除智能体

> AWS 的 DevOps Agent 正式上线，Resolve AI 发布了其 K8s 剧本，NeuBird 演示了语义监控，Metoro 将 AI SRE 与每个服务的 SLO 绑定。生产形态已经确定：告警 webhook 触发，智能体读取遥测，遍历 K8s 对象图谱，排序根因假设，并发布带审批按钮的 Slack 简报。默认只读。每次修复都需人工把关。这个顶点项目就是这个智能体，在 20 个合成事件上评估，并在三个共享案例上与 AWS Agent 对比。

**类型：** 顶点项目
**语言：** Python（智能体）、TypeScript（Slack 集成）
**先决条件：** Phase 11（LLM 工程）、Phase 13（工具和 MCP）、Phase 14（智能体）、Phase 15（自主系统）、Phase 17（基础设施）、Phase 18（安全）
**涉及阶段：** P11 · P13 · P14 · P15 · P17 · P18
**时间：** 30 小时

## 问题

2025-2026 年的 SRE 叙事变成："AI 智能体分流事件，人类审批修复。"AWS DevOps Agent、Resolve AI、NeuBird、Metoro、PagerDuty AIOps 都在生产中交付这种形态。智能体读取 Prometheus 指标、Loki 日志、Tempo 追踪、kubestate-metrics 和 K8s 对象的知识图谱。它在五分钟内生成带遥测引用的排序根因假设。它从不执行破坏性命令，除非通过 Slack 获得明确的人工审批。

大部分艰苦工作是范围界定和安全性，不是推理。智能体需要默认只读的 RBAC 界面、加固的 MCP 工具服务器，以及每个考虑与执行的命令的审计日志。它需要知道何时超出其能力范围并升级。而且它必须运行得足够便宜，OOM 杀死级联不会产生 5000 美元的智能体账单。

## 概念

智能体在知识图谱上操作。节点是 K8s 对象（Pod、Deployment、Service、Node、HPA、PVC）加上遥测源（Prometheus 系列、Loki 流、Tempo 追踪）。边编码所有权（Pod -> ReplicaSet -> Deployment）、调度（Pod -> Node）和观察（Pod -> Prometheus 系列）。图谱通过 kube-state-metrics 同步保持新鲜，并在每次告警时重新采样。

当告警触发时，智能体从受影响对象开始根因分析。它遍历边，拉取相关的遥测切片（最近 15 分钟），并起草假设。假设按证据排序：多少遥测引用支持它、多新、多具体。前 3 个假设进入 Slack，带图谱路径可视化和修复操作审批按钮。

修复是门控的。允许的默认操作是只读的。破坏性操作（缩容、回滚、删除 Pod）需要 Slack 审批；ArgoCD 回滚钩子需要智能体从不持有的认证令牌。审计日志记录智能体*考虑*的每个命令——不仅仅是执行的——所以审查过程捕获未遂事件。

## 架构

```
PagerDuty / Alertmanager webhook
           |
           v
     FastAPI 接收器
           |
           v
   LangGraph 根因智能体
           |
           +---- 只读 MCP 工具 ----+
           |                             |
           v                             v
   K8s 知识图谱              遥测切片
     (Neo4j / kuzu)              Prometheus, Loki, Tempo
   所有权 + 调度          最近 15 分钟，有范围
           |
           v
   假设排序（证据权重）
           |
           v
   Slack 简报 + 审批按钮
           |
           v (已审批)
   ArgoCD 回滚钩子 / PagerDuty 升级
           |
           v
   审计日志：考虑 vs 执行，每个命令
```

## 技术栈

- 可观察性源：Prometheus、Loki、Tempo、kube-state-metrics
- 知识图谱：K8s 对象 + 遥测边的 Neo4j（托管）或 kuzu（嵌入式）
- 智能体：LangGraph，带每工具允许列表，默认只读
- 工具传输：StreamableHTTP 上的 FastMCP；破坏性工具的独立服务器在审批门后
- 模型：Claude Sonnet 4.7 用于根因推理，Gemini 2.5 Flash 用于日志摘要
- 修复：ArgoCD 回滚 webhook、PagerDuty 升级、Slack 审批卡
- 审计：仅追加结构化日志（考虑、执行、审批、结果）
- 部署：K8s 部署，带其自己的窄 RBAC 角色；独立命名空间

## 构建它

1. **图谱摄取。** 每 30 秒将 kube-state-metrics 同步到 Neo4j/kuzu。节点：Pod、Deployment、Node、Service、PVC、HPA。边：OWNED_BY、SCHEDULED_ON、EXPOSES、MOUNTS、SCALES。遥测覆盖边：OBSERVED_BY（Pod 被 Prometheus 系列观察）。

2. **告警接收器。** 接受 PagerDuty 或 Alertmanager webhook 的 FastAPI 端点。提取受影响对象和 SLO 违规。

3. **只读工具界面。** 通过 FastMCP 包装 kubectl、Prometheus 查询、Loki logql、Tempo traceql。每个工具有窄 RBAC 动词（"get"、"list"、"describe"）。默认服务器中没有"delete"、"exec"、"scale"。

4. **根因智能体。** LangGraph，三个节点：`sample` 拉取最近 15 分钟遥测切片，`walk` 查询邻近对象的图谱，`hypothesize` 起草带遥测引用的排序根因候选。

5. **证据评分。** 每个假设有一个分数 = 新近性 * 特异性 * 图谱路径长度倒数 * 引用计数。返回前 3 个。

6. **Slack 简报。** 发布附件，包含假设、图谱路径可视化（服务器端渲染的子图图像）和最多一个修复操作的审批按钮。

7. **修复门。** 破坏性工具（缩容、回滚、删除）生活在审批令牌后的第二个 MCP 服务器上。智能体仅在 Slack 卡被人工审批后才能调用它们。

8. **审计日志。** 仅追加 JSONL：对于每个候选命令，记录是否被考虑、是否被执行、谁审批的。每日发送到 S3。

9. **合成事件套件。** 构建 20 个场景：OOMKill 级联、DNS 抖动、HPA 抖动、PVC 填满、吵闹邻居、故障 sidecar、错误 ConfigMap 推出、证书轮换、镜像拉取退避等。在根因准确性和假设时间上评分智能体。

## 使用它

```
webhook: alert.pagerduty.com -> checkout-api SLO 违规，错误率 14%
[图谱]   受影响：Deployment checkout-api（3 个 Pod，Node ip-10-2-3-4）
[遍历]    邻居：ReplicaSet checkout-api-abc、Service checkout-api、
           14 分钟前的最近推出
[采样]  prometheus error_rate 14%，上升趋势；loki /api/v2/pay 上的 500 错误
[假设]    #1 错误推出：最新镜像 checkout-api:v2.41 在 /healthz 上失败
          引用：deploy.yaml（修订 42）、prometheus errorRate、loki 500 堆栈
[slack]   [回滚到 v2.40]  [升级]  [忽略]
          （需要审批；智能体不会单方面回滚）
```

## 交付它

`outputs/skill-devops-agent.md` 是可交付成果。给定 K8s 集群和告警源，智能体生成排序根因假设和 Slack 门控修复流。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 场景套件的 RCA 准确性 | 20 个合成事件中 ≥80% 正确根因 |
| 20 | 安全性 | 审计日志中破坏性操作防护从未在没有 Slack 审批的情况下触发 |
| 20 | 假设时间 | 从告警到 Slack 简报的 p50 低于 5 分钟 |
| 20 | 可解释性 | 每个假设都有图谱路径和遥测引用 |
| 15 | 集成完整性 | PagerDuty、Slack、ArgoCD、Prometheus 端到端工作 |
| **100** | | |

## 练习

1. 在 AWS DevOps Agent 演示的三个相同事件上运行你的智能体。发布并排对比。报告智能体在何处分歧。

2. 添加"未遂"审计，标记智能体*考虑*的任何未经审批就会破坏性的命令。测量一周内的未遂率。

3. 将假设模型从 Claude Sonnet 4.7 换成自托管的 Llama 3.3 70B。测量 RCA 准确性差异和每个事件的美元成本。

4. 构建因果过滤器：区分相关遥测峰值与真正根因。在 20 场景标签上训练一个小型分类器。

5. 添加回滚预演：针对具有相同清单的暂存集群进行 ArgoCD 回滚。在 Slack 审批按钮之前在实时集群中验证回滚计划。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| K8s 知识图谱 | "集群图谱" | 节点 = K8s 对象 + 遥测系列；边 = 所有权、调度、观察 |
| 默认只读 | "有范围的 RBAC" | 智能体的服务账户只有 get/list/describe 动词；破坏性动词生活在审批后的独立服务器中 |
| 审计日志 | "考虑 vs 执行" | 每个候选命令的仅追加记录，是否运行，谁审批的 |
| 假设排序 | "证据分数" | 新近性 × 特异性 × 图谱路径长度倒数 × 引用计数 |
| Slack 审批卡 | "HITL 门" | 带修复按钮的交互式 Slack 消息；智能体在人类点击前无法继续 |
| 遥测引用 | "证据指针" | 支持声明的 Prometheus 查询、Loki 选择器或 Tempo 追踪 URL |
| MTTR | "解决时间" | 从告警触发到 SLO 恢复的挂钟时间 |

## 延伸阅读

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/aws/aws-devops-agent-helps-you-accelerate-incident-response-and-improve-system-reliability-preview/) —— 2026 年经典参考
- [Resolve AI K8s 故障排除](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) —— 竞争对手参考
- [NeuBird 语义监控](https://www.neubird.ai) —— 语义图谱方法
- [Metoro AI SRE](https://metoro.io) —— SLO 优先生产框架
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) —— 集群状态源
- [LangGraph](https://langchain-ai.github.io/langgraph/) —— 参考智能体编排器
- [FastMCP](https://github.com/jlowin/fastmcp) —— Python MCP 服务器框架
- [ArgoCD 回滚](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) —— 门控修复目标
