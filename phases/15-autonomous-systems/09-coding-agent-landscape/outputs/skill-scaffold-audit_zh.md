---
name: coding-scaffold-audit
description: 在采用生产代码更改之前，审计提议的编码代理脚手架（retrieval、verifier loop、sandbox、benchmark fit）。
version: 1.0.0
phase: 15
lesson: 9
tags: [coding-agent, scaffolding, swe-bench, codeact, openhands]
---

给定提议的编码代理脚手架（SWE-agent、OpenHands、Aider、Cline、Devin、Claude Code 或内部构建），在四个轴上评分并标记基准数字将夸大生产质量的地方。

生成：

1. **检索。** 描述脚手架如何选择代理在行动前读取的文件。Repo map、embedding search、显式文件列表或代理驱动的 `grep` 调用。检索质量是静默的主导可靠性因素。
2. **验证器循环。** 脚手架是否运行测试、读取堆栈跟踪并将失败反馈到下一轮？如果没有验证器循环，标记为缺失 —— 这通常是 SWE-bench 类任务上 10+ 点的绝对增量。
3. **沙箱和爆炸半径。** 动作在哪里执行？本地文件系统、临时容器、托管 VM。对于 CodeAct 风格脚手架，确认沙箱已加固（no egress、no host mounts、time limit）。对于 JSON 工具调用脚手架，确认工具验证器拒绝每个意外副作用。
4. **基准拟合。** 报告的数字（例如"SWE-bench Verified 上 80.9%"）实际覆盖什么分布？计算基准中 1-2 行任务的比例；将报告分数与同一模型的 SWE-bench Pro（10+ 行任务）进行比较。标题数字由简单尾部驱动的脚手架不是生产信号。

硬性拒绝：
- 任何没有验证器循环的脚手架，用于高于琐碎复杂度的任务。
- 没有沙箱隔离的 CodeAct 脚手架（没有 Docker、没有 rootless 容器、没有 VM）指向真实仓库。
- 不披露分布的基准声明（easy-tail fraction、Pro-equivalent score）。
- 单个工具可以在没有验证器的情况下触及任意路径的工具调用脚手架（例如暴露给模型的原始 `shell_exec` 工具）。

拒绝规则：
- 如果用户无法在其代表内部分布上生成脚手架的测试套件通过率，拒绝并要求先进行小样本测量。公共基准预测排名顺序，不是绝对质量。
- 如果提议的脚手架将在没有暂存干运行的情况下针对生产仓库运行，拒绝并要求先进行暂存。编码代理重写文件；检索不良的编码代理重写错误的文件。
- 如果用户计划单独使用基准分数（没有自己的评估）来做 go/no-go 决策，拒绝并要求内部评估数据。

输出格式：

返回评分备忘录，包含：
- **检索评分**（0-5，附机制描述）
- **验证器循环评分**（0-5，附反馈格式）
- **沙箱评分**（0-5，附隔离机制）
- **基准拟合评分**（0-5，附内部分布增量）
- **部署建议**（production / staging / research only）
- **一句话风险摘要**（最可能的首次生产失败）
