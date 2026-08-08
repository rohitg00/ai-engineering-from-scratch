---
name: multi-agent-team
description: 构建多代理软件团队，包含架构师、并行编码者、评审者和测试者；针对SWE-bench Pro测量并生成交接事后分析。
version: 1.0.0
phase: 19
lesson: 10
tags: [capstone, multi-agent, swe-bench, langgraph, a2a, worktree, roles]
---

给定GitHub issue URL和并行级别，部署一个产生可合并PR的多代理软件团队。在50个SWE-bench Pro issue上评估并发布交接失败直方图。

构建计划：

1. 任务板：基于文件（或Redis）的JSONL存储，存储类型化消息。消息类型：plan_request、subtask、diff_ready、review_needed、review_feedback、approved、test_needed、test_passed、test_failed、replan_needed。
2. 架构师（Opus 4.7）：阅读issue，撰写计划，发出子任务DAG，含显式接口（触及的文件、公共函数、测试影响）。
3. N个编码者（Sonnet 4.7）：每个认领子任务，生成全新`git worktree add` + Daytona沙箱，独立实现。
4. 合并协调者：三路合并；仅在文件级重叠时进行LLM介导的冲突解决。
5. 评审者（GPT-5.4）：阅读合并差异；不能批准其撰写或提出的差异；发出approved或review_feedback，路由到相关编码者。
6. 测试者（Gemini 2.5 Pro）：在干净沙箱中运行测试套件；发出test_passed或test_failed及产物。
7. 交接核算：每个跨角色消息成为Langfuse span，含负载大小和模型。计算token放大 = total_tokens / single_agent_baseline_tokens。
8. 注入明显错误探测（10%运行）以测量评审者误批准率。
9. 在50个SWE-bench Pro issue上运行；发布pass@1、与单代理基线的挂钟时间、每角色token分解、交接失败直方图。

评估标准：

| 权重 | 标准 | 测量 |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | 50-issue子集pass@1 |
| 20 | 并行加速 | 与单代理基线的挂钟时间 |
| 20 | 评审质量 | 注入错误探测上的误批准率 |
| 20 | Token效率 | 每解决issue的总token vs 单代理 |
| 15 | 协调工程 | 合并冲突解决、交接失败直方图 |

硬性拒绝：
- 可以批准其撰写或提出的差异的评审者。硬性约束。
- 没有匹配单代理基线运行的报告。多代理必须*每美元*获胜，而非仅pass@1。
- 消息为自由格式字符串而非类型化A2A消息的任务板。
- 静默丢弃冲突差异而非路由回重新规划的合并协调者。

拒绝规则：
- 拒绝在没有每角色预算上限（token + 美元）的情况下运行。
- 拒绝打开测试者未在干净沙箱中验证的PR。
- 拒绝在单次运行中将编码者扩展到8个以上。协调开销在此之上占主导。

输出：包含任务板 + 角色worker、50-issue SWE-bench Pro运行日志、匹配单代理基线运行、带角色标记span和每角色token分解的Langfuse仪表板、注入错误探测报告，以及一份说明最常断裂的三个交接及减少每个的消息模式或提示变更的事后分析的仓库。
