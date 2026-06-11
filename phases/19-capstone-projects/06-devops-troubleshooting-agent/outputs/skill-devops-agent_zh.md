---
name: devops-agent
description: 构建Kubernetes故障排查代理，遍历集群知识图、排序根因，并通过Slack门控每个修复操作。
version: 1.0.0
phase: 19
lesson: 06
tags: [capstone, devops, sre, kubernetes, langgraph, fastmcp, aiops]
---

给定K8s集群和告警源（PagerDuty或Alertmanager），构建一个在五分钟内产生排序根因假设并通过Slack审批卡门控每个修复操作的代理。

构建计划：

1. 每30秒将kube-state-metrics摄取到Neo4j或kuzu。构建Pod、Deployment、Service、Node、PVC、HPA的图，加上到Prometheus、Loki和Tempo源的遥测覆盖边。
2. 为PagerDuty和Alertmanager搭建FastAPI webhook接收器。
3. 通过FastMCP以StreamableHTTP传输暴露只读工具：kubectl get/describe、promql、logql、traceql。
4. 构建LangGraph根因代理，包含三个节点：`sample`（拉取15分钟遥测）、`walk`（遍历图邻居）、`hypothesize`（按新近性×特异性×引用计数排序候选）。
5. 将前3个排序假设与图路径可视化一起发布到Slack，带审批按钮。
6. 将破坏性工具（scale、rollback、delete）放在单独的FastMCP服务器后，仅在Slack签字后代理才获得审批token。
7. 维护仅追加审计日志：每个*被考虑的*命令、是否获批、是否执行、谁批准。
8. 构建20个合成事件场景（OOMKill、DNS抖动、HPA抖动、PVC填满、嘈杂邻居、故障sidecar、ConfigMap错误推出、证书轮换、镜像拉取退避、探针失败，以及10个更多）。在RCA准确性和假设时间上对代理评分。

评估标准：

| 权重 | 标准 | 测量 |
|:-:|---|---|
| 25 | 场景套件上的RCA准确性 | 20个合成事件中至少80%正确根因 |
| 20 | 安全性 | 破坏性操作守卫从未在审计日志中没有Slack批准的情况下触发 |
| 20 | 假设时间 | 从告警到Slack摘要的p50低于5分钟 |
| 20 | 可解释性 | 每个假设都有图路径和遥测引用 |
| 15 | 集成完整性 | PagerDuty、Slack、ArgoCD、Prometheus端到端工作 |

硬性拒绝：
- 在单个MCP服务器中混合只读和破坏性工具的代理。
- 任何没有遥测引用的RCA。无引用假设必须被拒绝。
- 仅记录执行的审计日志。它们必须记录每个被考虑的命令。
- 未在20场景套件上针对种子运行代理的准确性声明。

拒绝规则：
- 拒绝在没有值班人员Slack批准的情况下修复。即使假设很明显。
- 拒绝通过只读MCP暴露`kubectl exec`、`kubectl port-forward`或任何交互式工具。这些在效果上是破坏性的。
- 拒绝在没有每部署审批卡的情况下跨多个部署批量应用修复。

输出：包含FastAPI接收器、LangGraph代理、只读和破坏性MCP服务器、Slack集成、20场景测试套件、与AWS DevOps Agent在三个共享事件上的并排比较，以及一份关于一周观察期内未遂命令（代理*考虑*但未执行的）的撰写的仓库。
