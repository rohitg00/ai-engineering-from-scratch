---
name: workbench-audit
description: 审计仓库的七个代理工作台表面，报告在开始任何代理工作之前哪些缺失、部分或健康。
version: 1.0.0
phase: 14
lesson: 31
tags: [workbench, audit, reliability, agent-engineering]
---

给定仓库路径和将在其中运行的代理产品，审计七个工作台表面并生成准备情况报告。

七个表面：

1. Instructions：代理首先读取的根文件（例如 `AGENTS.md`），简短，路由到更深层的规则。
2. State：持久的、机器可读的文件，记录任务、触及的文件、阻塞者、下一步动作。
3. Scope：每个任务的契约，列出允许的文件、禁止的文件、验收标准、回滚计划。
4. Feedback：捕获命令、stdout、stderr、退出代码并将结果反馈回循环的运行器。
5. Verification：运行测试、lint、类型检查、smoke run 并确认验收标准的门。
6. Review：不同角色的第二次传递，构建者不能标记自己的工作。
7. Handoff：总结更改内容、原因、剩余内容和下一步最佳动作的工件。

生成：

- 每个表面的分数：0 缺失，1 部分，2 健康。将每个分数绑定到你观察到的文件或过程。
- 按杠杆排序的三个优先级：如果首先添加哪个缺失表面，消除最多的失败模式。
- 机器可读的 `workbench_audit.json` 报告加上人类可读的 `workbench_audit.md` 摘要。
- 最弱表面的启动补丁：将分数从 0 移动到 1 的最小文件更改。

硬性拒绝：

- 没有文件路径或过程引用的"健康"分数。没有证据的审计会腐烂。
- 单个组合的"agent config"表面。组合表面隐藏了任务中断时哪个失败。
- 因为测试慢而跳过验证。如果验证不在工作台上，构建者标记自己的作业。

拒绝规则：

- 如果仓库根本没有测试命令，拒绝验证分数并将其作为阻塞发现提出。
- 如果仓库没有版本控制历史，拒绝 handoff 分数并将其作为阻塞发现提出。
- 如果代理产品以 root 或不受限制的文件访问运行，拒绝 scope 分数，直到定义沙箱或写入列表。

输出结构：

```
workbench-audit/
├── workbench_audit.json
├── workbench_audit.md
├── patches/
│   └── <weakest-surface>.patch
└── README.md
```

以"what to read next"结束，指向：

- Lesson 32 用于最小仓库布局。
- Lesson 33 用于深入 instructions 表面。
- Lesson 38 用于验证门。
