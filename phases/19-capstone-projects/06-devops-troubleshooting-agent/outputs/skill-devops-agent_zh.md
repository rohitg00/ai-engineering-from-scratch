---
name: devops-agent
description: 构建一个 Kubernetes 故障排除智能体，遍历集群知识图谱，对根因进行排序，并通过 Slack 门控每个修复操作。
version: 1.0.0
phase: 19
lesson: 06
tags: [capstone, devops, sre, kubernetes, langgraph, fastmcp, aiops]
---

给定一个 K8s 集群和一个告警源（PagerDuty 或 Alertmanager），构建一个智能体，在五分钟内生成排序的根因假设，并通过 Slack 审批卡门控每个修复操作。

构建计划：

1. 每 30 秒将 kube-state-metrics 摄取到 Neo4j 或 kuzu 中。构建 Pod、Deployment、Service、Node、PVC、HPA 以及连接到 Prometheus、Loki 和 Tempo 源的遥测覆盖边的图谱。
2. 为 PagerDuty 和 Alertmanager 搭建 FastAPI webhook 接收器。
3. 通过带 StreamableHTTP 传输的 FastMCP 公开只读工具：kubectl get/describe、promql、logql、traceql。
4. 构建一个 LangGraph 根因智能体，包含三个节点：`sample`（拉取 15 分钟遥测）、`walk`（遍历图谱邻居）、`hypothesize`（按时效性 × 特异性 × 引用计数对候选排序）。
5. 将排名前 3 的假设（含图谱路径可视化）通过审批按钮发布到 Slack。
6. 将破坏性工具（scale、rollback、delete）放在单独的 FastMCP 服务器上，该服务器需要智能体在获得 Slack 批准后才能获取的审批令牌。
7. 维护一个仅追加的审计日志：每个*考虑过*的命令、是否批准、是否执行、谁批准的。
8. 构建 20 个合成事故场景（OOMKill、DNS 抖动、HPA 震荡、PVC 填满、噪音邻居、有故障的 sidecar、ConfigMap 错误发布、证书轮换、镜像拉取回退、探测失败等 10 个更多）。对智能体进行 RCA 准确率和假设生成时间的评分。

评估量规：

| 权重 | 标准 | 衡量方法 |
|:-:|---|---|
| 25 | 场景套件上的 RCA 准确率 | 20 个合成事故中至少 80% 的正确根因 |
| 20 | 安全性 | 破坏性操作守卫在没有 Slack 批准的情况下绝不在审计日志中触发 |
| 20 | 假设生成时间 | 从告警到 Slack 简报的 p50 时间低于 5 分钟 |
| 20 | 可解释性 | 每个假设都有图谱路径和遥测引用 |
| 15 | 集成完整性 | PagerDuty、Slack、ArgoCD、Prometheus 端到端工作 |

硬性拒绝：

- 使用单个 MCP 服务器混合只读和破坏性工具的智能体。
- 任何没有遥测引用的 RCA。未引用的假设必须被拒绝。
- 仅记录执行的审计日志。它们必须记录每个考虑过的命令。
- 没有在 20 场景套件上使用种子运行智能体的准确率声明。

拒绝规则：

- 拒绝在没有人工值班人员的 Slack 批准的情况下进行修复。即使假设很明显。
- 拒绝通过只读 MCP 暴露 `kubectl exec`、`kubectl port-forward` 或任何交互式工具。这些在效果上是破坏性的。
- 拒绝在跨多个部署时批量应用修复而不为每个部署单独提供审批卡。

输出：一个包含 FastAPI 接收器、LangGraph 智能体、只读和破坏性 MCP 服务器、Slack 集成、20 场景测试套件、与 AWS DevOps Agent 在三个共享事故上的并排比较，以及一份关于一周观察窗口中接近失误命令（智能体*考虑过*但未执行的）的报告的仓库。
