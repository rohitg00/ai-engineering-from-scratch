# 综合项目 01 — 终端原生编程智能体

> 到 2026 年，编程智能体的形态已经定型。一个 TUI（终端用户界面）框架、一个有状态的计划、一个沙箱化的工具表面、一个规划-执行-观察-恢复的循环。Claude Code、Cursor 3 和 OpenCode 从 50 英尺外看基本一样。本综合项目要求你从头到尾构建一个——从 CLI 输入到拉取请求（PR）输出——并在 SWE-bench Pro 上用 mini-swe-agent 和 Live-SWE-agent 进行测评。你将学到为什么最困难的部分不是模型调用，而是工具循环、沙箱和 50 轮运行的代价上限。

**类型：** 综合项目
**语言：** TypeScript / Bun（框架）、Python（测评脚本）
**前置条件：** 第 11 阶段（LLM 工程）、第 13 阶段（工具和协议）、第 14 阶段（智能体）、第 15 阶段（自主系统）、第 17 阶段（基础设施）
**涉及阶段：** P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**时间：** 35 小时

## 问题描述

编程智能体在 2026 年成为主导的 AI 应用类别。Claude Code（Anthropic）、配备 Composer 2 和 Agent Tabs 的 Cursor 3（Cursor）、Amp（Sourcegraph）、OpenCode（11.2 万星）、Factory Droids 和 Google Jules 都提供了相同架构的变体：一个终端框架、一个带权限的工具表面、一个沙箱，以及一个围绕前沿模型构建的规划-执行-观察循环。前沿进展有限——Live-SWE-agent 在 SWE-bench Verified 上用 Opus 4.5 达到了 79.2%——但工程工艺的广度很大。大多数失败模式不是模型错误，而是工具循环不稳定、上下文污染、token 代价失控和破坏性的文件系统操作。

你无法从外部推理这些智能体。你必须构建一个，看着循环在第 47 轮崩溃（当 ripgrep 返回 8MB 匹配结果时），然后重建截断层。这就是本综合项目的意义所在。

## 核心概念

框架有四个表面。**规划（Plan）** 维护一个 TodoWrite 风格的状态对象，模型每轮都会重写它。**执行（Act）** 分发工具调用（读取、编辑、运行、搜索、git）。**观察（Observe）** 捕获 stdout / stderr / 退出码，进行截断，并将摘要反馈回去。**恢复（Recover）** 在不撑爆上下文窗口或无限循环的情况下处理工具错误。2026 年的形态增加了一样东西：**钩子（hooks）**。`PreToolUse`、`PostToolUse`、`SessionStart`、`SessionEnd`、`UserPromptSubmit`、`Notification`、`Stop` 和 `PreCompact`——可配置扩展点，运维人员可以在其中注入策略、遥测和护栏。

沙箱使用 E2B 或 Daytona。每个任务在一个全新的 devcontainer 中运行，挂载了可读写的 git worktree。框架从不触碰宿主机文件系统。worktree 在成功或失败时都会被拆除。代价控制通过三层强制执行：每轮 token 上限、每个会话的美元预算，以及硬性轮次限制（通常为 50 轮）。可观测性层使用带有 GenAI 语义约定的 OpenTelemetry span，发送到自托管的 Langfuse。

## 架构

```
  用户 CLI  ->  框架（Bun + Ink TUI）
                   |
                   v
           规划 / 执行 / 观察 循环  <--->  Claude Sonnet 4.7 / GPT-5.4-Codex / Gemini 3 Pro
                   |                          （通过 OpenRouter，模型无关）
                   v
           工具分发器（MCP StreamableHTTP 客户端）
                   |
      +------------+------------+----------+
      v            v            v          v
   read/edit    ripgrep     tree-sitter   git/run
      |            |            |          |
      +------------+------------+----------+
                   |
                   v
            E2B / Daytona 沙箱  （worktree 隔离）
                   |
                   v
            钩子：Pre/Post、Session、Prompt、Compact
                   |
                   v
            OpenTelemetry -> Langfuse（spans、tokens、$）
                   |
                   v
            通过 GitHub App 创建 PR
```

## 技术栈

- 框架运行时：Bun 1.2 + Ink 5（终端中的 React）
- 模型访问：OpenRouter 统一 API，支持 Claude Sonnet 4.7、GPT-5.4-Codex、Gemini 3 Pro、Opus 4.5（用于最困难的任务）
- 工具传输：模型上下文协议 StreamableHTTP（MCP 2026 修订版）
- 沙箱：E2B 沙箱（JS SDK）或 Daytona devcontainers
- 代码搜索：ripgrep 子进程、17 种语言的 tree-sitter 解析器（预编译）
- 隔离：`git worktree add` 每个任务一个，成功/失败时清理
- 测评框架：SWE-bench Pro（验证子集）+ Terminal-Bench 2.0 + 你自己的 30 任务留出集
- 可观测性：OpenTelemetry SDK，带 `gen_ai.*` 语义约定 → 自托管 Langfuse
- PR 发布：GitHub App，使用细粒度 token，范围限于目标仓库

## 构建步骤

1. **TUI 和命令循环。** 用 Ink 搭建 Bun 项目。接受 `agent run <repo> "<task>"` 命令。打印分屏视图：计划面板（顶部）、工具调用流（中部）、token 预算（底部）。在退出前添加 Ctrl-C 取消功能，触发 `SessionEnd` 钩子。

2. **计划状态。** 定义一个类型化的 TodoWrite schema（待处理 / 进行中 / 完成，带备注）。模型每轮作为工具调用重写完整状态——不允许增量变更。将计划持久化到 `.agent/state.json`，以便崩溃后可以恢复。

3. **工具表面。** 定义六个工具：`read_file`、`edit_file`（带 diff 预览）、`ripgrep`、`tree_sitter_symbols`、`run_shell`（带超时）、`git`（status / diff / commit / push）。通过 MCP StreamableHTTP 暴露，使框架传输协议无关。每个工具返回截断的输出（每次调用上限 4k tokens）。

4. **沙箱封装。** 每个任务启动一个 E2B 沙箱。`git worktree add -b agent/$TASK_ID` 创建一个新分支。所有工具调用在沙箱内执行。宿主机文件系统不可访问。

5. **钩子。** 实现所有八种 2026 年钩子类型。至少连接四个用户编写的钩子：(a) `PreToolUse` 破坏性命令守卫，阻止在 worktree 外执行 `rm -rf`；(b) `PostToolUse` token 记账；(c) `SessionStart` 预算初始化；(d) `Stop` 写入最终追踪包。

6. **测评循环。** 克隆 SWE-bench Pro Python 的 30 个 issue 子集。对每个 issue 运行你的框架。在 pass@1、每任务轮次和每任务代价方面与 mini-swe-agent（最小基线）进行比较。将结果写入 `eval/results.jsonl`。

7. **代价控制。** 硬性截断：50 轮、200k 上下文、$5 每任务。`PreCompact` 钩子在 150k 标记处将较早的轮次摘要为prior-state 块，为新观察释放空间而不丢失计划。

8. **PR 发布。** 成功后，最后一步是 `git push` + 一个 GitHub API 调用，打开一个 PR，在正文包含计划和 diff 摘要。

## 使用示例

```
$ agent run ./my-repo "Fix the race condition in worker.rs"
[plan]  1 定位 worker.rs 并枚举 mutex 使用情况
        2 识别存在竞争的共享状态
        3 提出修复方案，验证测试
[tool]  ripgrep mutex.*lock -t rust           （44 个匹配，已截断）
[tool]  read_file src/worker.rs 120..180
[tool]  edit_file src/worker.rs (+8 -3)
[tool]  run_shell cargo test worker::          （通过）
[plan]  1 完成 · 2 完成 · 3 完成
[done]  PR 已打开：#482   轮次=9   tokens=38k   代价=$0.41
```

## 交付成果

可交付技能位于 `outputs/skill-terminal-coding-agent.md`。给定一个仓库路径和任务描述，它在沙箱中运行完整的规划-执行-观察循环，并返回 PR URL 以及追踪包。本综合项目的评分标准：

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 对比基线 | 你的框架 vs mini-swe-agent，在 30 个匹配的 Python 任务上 |
| 20 | 架构清晰度 | 规划/执行/观察分离、钩子表面、工具 schema——对照 Live-SWE-agent 布局审查 |
| 20 | 安全性 | 沙箱逃逸测试、权限提示、破坏性命令守卫通过红队测试 |
| 20 | 可观测性 | 追踪完整性（100% 工具调用被 span 覆盖）、每轮 token 记账 |
| 15 | 开发者 UX | 冷启动 < 2s、崩溃恢复能恢复计划、Ctrl-C 能在工具执行中干净取消 |
| **100** | | |

## 练习

1. 将后端模型从 Claude Sonnet 4.7 切换为在 vLLM 上服务的 Qwen3-Coder-30B。比较 pass@1 和每任务代价。报告开源模型表现不佳的地方。

2. 添加一个 `reviewer` 子智能体，在 PR 发布前读取 diff，并可以请求修订循环。测量误报审查是否使 SWE-bench 通过率低于单智能体基线（提示：通常会）。

3. 对沙箱进行压力测试：编写一个尝试 `curl` 外部 URL 的任务，以及一个在 worktree 外写入的任务。确认两者都被 PreToolUse 钩子阻止。记录尝试。

4. 使用更小的模型（Haiku 4.5）实现 `PreCompact` 摘要。测量在 3 倍压缩时损失了多少计划保真度。

5. 将 MCP StreamableHTTP 传输交换为 stdio。对冷启动和每次调用延迟进行基准测试。为仅本地使用选择一个优胜方案。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| Harness | "智能体循环" | 模型周围的代码，负责分发工具、维护计划状态和执行预算 |
| Hook | "智能体事件监听器" | 由框架在八个生命周期事件之一上运行的用户编写脚本 |
| Worktree | "Git 沙箱" | 在单独路径上的链接 git 检出；可丢弃而不触及主克隆 |
| TodoWrite | "计划状态" | 一个类型化的待处理/进行中/完成项目列表，模型每轮重写 |
| StreamableHTTP | "MCP 传输" | 2026 MCP 修订版：长连接 HTTP，支持双向流；取代 SSE |
| Token ceiling | "上下文预算" | 每轮或每会话的输入+输出 token 上限；触发压缩或终止 |
| pass@1 | "单次尝试通过率" | 在第一次运行中没有重试或测试集窥探的情况下解决的 SWE-bench 任务比例 |

## 延伸阅读

- [Claude Code 文档](https://docs.anthropic.com/en/docs/claude-code) — Anthropic 的参考框架
- [Cursor 3 更新日志](https://cursor.com/changelog) — Agent Tabs 和 Composer 2 产品说明
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) — 用于 SWE-bench 框架比较的最小基线
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) — 使用 Opus 4.5 达到 79.2% SWE-bench Verified
- [OpenCode](https://opencode.ai) — 开源框架，11.2 万星
- [SWE-bench Pro 排行榜](https://www.swebench.com) — 本综合项目目标的评估
- [模型上下文协议 2026 路线图](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — StreamableHTTP、能力元数据
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — 工具调用和 token 使用的 span schema
