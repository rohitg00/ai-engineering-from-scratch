---
name: terminal-coding-agent
description: 构建并评估一个终端原生编码智能体，在 SWE-bench Pro 上进行评估，具有有限的预算、沙箱化工具和完整的 2026 钩子接口。
version: 1.0.0
phase: 19
lesson: 01
tags: [capstone, coding-agent, claude-code, swe-bench, mcp, hooks, sandbox]
---

给定一个目标仓库和一个自然语言任务，构建一个框架，用于规划、在沙箱中执行，并打开一个拉取请求。在 30 个任务的 SWE-bench Pro 子集上达到或超过 mini-swe-agent 基线，同时保持每个任务低于 5 美元的预算。

构建计划：

1. 搭建一个 Bun + Ink TUI 框架，包含计划面板、工具调用流和实时令牌/美元预算。
2. 定义六个工具（read_file, edit_file, ripgrep, tree_sitter_symbols, run_shell, git），基于 Model Context Protocol StreamableHTTP。每次调用最多返回 4k 个令牌。
3. 在 E2B 或 Daytona 沙箱中的新 `git worktree add` 分支上运行每个工具调用。绝不接触主机文件系统。
4. 连接所有八个 2026 钩子事件：SessionStart, SessionEnd, PreToolUse, PostToolUse, UserPromptSubmit, Notification, Stop, PreCompact。至少提供四个用户编写的钩子（破坏性命令守卫、令牌记账、OTel 跨度发射器、跟踪包写入器）。
5. 强制三个预算：50 轮、200k 令牌、5 美元。PreCompact 在 150k 时触发并总结较早的轮次。
6. 使用 GenAI 语义约定发射 OpenTelemetry 跨度到自托管的 Langfuse。
7. 成功时，推送分支并打开一个 PR，主体中包含计划和跟踪包。
8. 在 30 个问题的 SWE-bench Pro Python 子集上评估 mini-swe-agent，并记录每个任务的 pass@1、轮次、令牌和美元。

评估量规：

| 权重 | 标准 | 衡量方法 |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | 匹配 30 任务子集 vs mini-swe-agent 基线 |
| 20 | 架构清晰度 | 计划/行动/观察分离、钩子接口、工具模式可读性 |
| 20 | 安全性 | 沙箱逃逸红队 + 破坏性命令守卫审计 |
| 20 | 可观测性 | 100% 工具调用产生跨度，每轮令牌记账 |
| 15 | 开发者体验 | 冷启动 2 秒以内、崩溃恢复、Ctrl-C 取消语义 |

硬性拒绝：

- 在主机文件系统上通过 shell 执行 git 操作（而非在沙箱内部）的框架。
- 任何可以在工作树外写入或 curl 外部 URL 且无明确允许列表钩子的智能体。
- 没有在同一 30 个问题上匹配基线运行的评估数字报告。
- 依赖于重试之间使用 `git reset --hard` 的"通过率"声明；SWE-bench Pro 是 pass@1。

拒绝规则：

- 拒绝在任何配置下直接推送到 main 分支。仅允许 PR 分支。
- 拒绝禁用破坏性命令守卫。这是量规的硬性要求。
- 拒绝在没有预算上限的情况下运行。开放式运行会污染评估比较。

输出：一个包含框架、固定的 30 任务 SWE-bench Pro 评估框架（含匹配的 mini-swe-agent 基线运行）、至少 5 次完整运行的 OpenTelemetry 跟踪存档，以及一份说明框架解决的（和未解决的）任务的报告的仓库。最后部分说明您观察到的前三大故障模式以及修复每种模式的钩子变更。
