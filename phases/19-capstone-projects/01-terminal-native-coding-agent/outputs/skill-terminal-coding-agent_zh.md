---
name: terminal-coding-agent
description: 构建并评估一个终端原生编码代理，在SWE-bench Pro上以有界成本、沙箱工具和完整2026钩子表面运行。
version: 1.0.0
phase: 19
lesson: 01
tags: [capstone, coding-agent, claude-code, swe-bench, mcp, hooks, sandbox]
---

给定目标仓库和自然语言任务，构建一个规划、在沙箱中执行并打开拉取请求的 harness。在30个任务的SWE-bench Pro子集上匹配或击败mini-swe-agent基线，同时保持每任务5美元预算。

构建计划：

1. 搭建Bun + Ink TUI harness，包含规划面板、工具调用流和实时token/美元预算。
2. 通过Model Context Protocol StreamableHTTP定义六个工具（read_file, edit_file, ripgrep, tree_sitter_symbols, run_shell, git）。每次调用最多返回4k token。
3. 在E2B或Daytona沙箱中的全新`git worktree add`分支上运行每个工具调用。绝不触碰主机文件系统。
4. 连接全部八个2026钩子事件：SessionStart, SessionEnd, PreToolUse, PostToolUse, UserPromptSubmit, Notification, Stop, PreCompact。至少发布四个用户编写的钩子（破坏性命令守卫、token核算、OTel span发射器、trace bundle写入器）。
5. 强制执行三个预算：50轮、200k token、5美元。PreCompact在150k时触发并总结较早的轮次。
6. 使用GenAI语义约定将OpenTelemetry span发射到自托管Langfuse。
7. 成功时，推送分支并打开PR，正文包含规划和trace bundle。
8. 在30个问题的SWE-bench Pro Python子集上针对mini-swe-agent进行评估，记录每个任务的pass@1、轮次、token和美元。

评估标准：

| 权重 | 标准 | 测量 |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | 30任务子集与mini-swe-agent基线匹配 |
| 20 | 架构清晰度 | 规划/执行/观察分离、钩子表面、工具模式可读性 |
| 20 | 安全性 | 沙箱逃逸红队 + 破坏性命令守卫审计 |
| 20 | 可观测性 | 100%工具调用被span，每轮token核算 |
| 15 | 开发者体验 | 冷启动低于2秒、崩溃恢复、Ctrl-C取消语义 |

硬性拒绝：
- 在主机文件系统上调用git的harness，而非在沙箱内。
- 任何可以在工作树外写入或未经显式白名单钩子就curl外部URL的代理。
- 未在同一30个问题上与匹配基线运行一起报告的评估数字。
- 依赖`git reset --hard`在重试之间的"通过率"声明；SWE-bench Pro是pass@1。

拒绝规则：
- 拒绝在任何配置下直接推送到main。仅限PR分支。
- 拒绝禁用破坏性命令守卫。它是评分标准的硬性要求。
- 拒绝在没有预算上限的情况下运行。开放式运行会污染评估比较。

输出：包含harness的仓库、带匹配mini-swe-agent基线运行的固定30任务SWE-bench Pro评估harness、至少5次完整运行的OpenTelemetry trace存档，以及一份说明harness解决而基线未解决的任务（及反之）的撰写。最后附上一节，说明观察到的前三大失败模式及修复每个模式的钩子变更。
