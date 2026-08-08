# 顶点项目 01 —— 终端原生编码智能体

> 到 2026 年，编码智能体的形态已经确定。一个 TUI 工具、一个有状态的规划、一个沙盒化的工具界面、一个规划-执行-观察-恢复的循环。Claude Code、Cursor 3 和 OpenCode 从远处看都一样。这个顶点项目要求你端到端构建一个——CLI 输入，拉取请求输出——并在 SWE-bench Pro 上将其与 mini-swe-agent 和 Live-SWE-agent 进行对比测量。你将了解到困难的部分不是模型调用，而是工具循环、沙盒和 50 轮运行的成本上限。

**类型：** 顶点项目
**语言：** TypeScript / Bun（工具）、Python（评估脚本）
**先决条件：** Phase 11（LLM 工程）、Phase 13（工具与协议）、Phase 14（智能体）、Phase 15（自主系统）、Phase 17（基础设施）
**涉及阶段：** P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**时间：** 35 小时

## 问题

编码智能体在 2026 年成为主导的 AI 应用类别。Claude Code（Anthropic）、带有 Composer 2 和 Agent Tabs 的 Cursor 3（Cursor）、Amp（Sourcegraph）、OpenCode（112k 星标）、Factory Droids 和 Google Jules 都交付了相同架构的变体：一个终端工具、一个受权限控制的工具界面、一个沙盒，以及围绕前沿模型构建的规划-执行-观察循环。前沿很窄——Live-SWE-agent 使用 Opus 4.5 在 SWE-bench Verified 上达到 79.2%——但工程技艺很广泛。大多数失败模式不是模型错误。它们是工具循环不稳定、上下文污染、失控的 token 成本和破坏性的文件系统操作。

你无法从外部推理这些智能体。你必须构建一个，观察循环在第 47 轮崩溃，因为 ripgrep 返回 8MB 的匹配结果，然后重建截断层。这就是这个顶点项目的意义。

## 概念

工具有四个界面。**规划** 维护一个 TodoWrite 风格的状态对象，模型每轮重写。**执行** 分派工具调用（读取、编辑、运行、搜索、git）。**观察** 捕获 stdout / stderr / 退出码，截断，并将摘要反馈回去。**恢复** 处理工具错误，而不会炸掉上下文窗口或永远循环。2026 年的形态增加了一个东西：**钩子**。`PreToolUse`、`PostToolUse`、`SessionStart`、`SessionEnd`、`UserPromptSubmit`、`Notification`、`Stop` 和 `PreCompact` —— 可配置的扩展点，操作员在其中注入策略、遥测和护栏。

沙盒是 E2B 或 Daytona。每个任务在一个全新的 devcontainer 中运行，git worktree 以读写方式挂载。工具从不接触主机文件系统。worktree 在成功或失败时被拆除。成本控制通过三层强制执行：每轮 token 上限、每会话美元预算和硬轮次限制（通常为 50）。可观察性层是带有 GenAI 语义约定的 OpenTelemetry 跨度，发送到自托管的 Langfuse。

## 架构

```
  用户 CLI  ->  工具（Bun + Ink TUI）
                  |
                  v
           规划 / 执行 / 观察循环  <--->  Claude Sonnet 4.7 / GPT-5.4-Codex / Gemini 3 Pro
                  |                         （通过 OpenRouter，与模型无关）
                  v
           工具分派器（MCP StreamableHTTP 客户端）
                  |
     +------------+------------+----------+
     v            v            v          v
  读取/编辑    ripgrep     tree-sitter   git/运行
     |            |            |          |
     +------------+------------+----------+
                  |
                  v
           E2B / Daytona 沙盒  （worktree 隔离）
                  |
                  v
           钩子：Pre/Post、Session、Prompt、Compact
                  |
                  v
           OpenTelemetry -> Langfuse（跨度、token、$）
                  |
                  v
           通过 GitHub 应用提交 PR
```

## 技术栈

- 工具运行时：Bun 1.2 + Ink 5（终端中的 React）
- 模型访问：OpenRouter 统一 API，支持 Claude Sonnet 4.7、GPT-5.4-Codex、Gemini 3 Pro、Opus 4.5（用于最难的任务）
- 工具传输：Model Context Protocol StreamableHTTP（MCP 2026 修订版）
- 沙盒：E2B 沙盒（JS SDK）或 Daytona devcontainers
- 代码搜索：ripgrep 子进程，17 种语言的 tree-sitter 解析器（预编译）
- 隔离：每个任务 `git worktree add`，成功/失败时清理
- 评估工具：SWE-bench Pro（验证子集）+ Terminal-Bench 2.0 + 你自己的 30 任务保留集
- 可观察性：OpenTelemetry SDK，使用 `gen_ai.*` 语义约定 → 自托管 Langfuse
- PR 提交：GitHub 应用，使用细粒度 token，范围限于目标仓库

## 构建它

1. **TUI 和命令循环。** 使用 Ink 搭建 Bun 项目。接受 `agent run <repo> "<task>"`。打印分屏视图：规划窗格（顶部）、工具调用流（中部）、token 预算（底部）。添加 Ctrl-C 取消，在退出前触发 `SessionEnd` 钩子。

2. **规划状态。** 定义一个类型化的 TodoWrite 模式（待处理/进行中/已完成项目，带注释）。模型每轮作为工具调用重写完整状态——不要让它增量修改。将规划持久化到 `.agent/state.json`，以便崩溃可以恢复。

3. **工具界面。** 定义六个工具：`read_file`、`edit_file`（带差异预览）、`ripgrep`、`tree_sitter_symbols`、`run_shell`（带超时）、`git`（状态/差异/提交/推送）。通过 MCP StreamableHTTP 暴露，使工具与传输无关。每个工具返回截断输出（每次调用上限 4k token）。

4. **沙盒包装。** 每个任务生成一个 E2B 沙盒。`git worktree add -b agent/$TASK_ID` 一个新分支。所有工具调用在沙盒内执行。主机文件系统不可达。

5. **钩子。** 实现所有八种 2026 钩子类型。连接至少四个用户编写的钩子：(a) `PreToolUse` 破坏性命令防护，阻止 worktree 外的 `rm -rf`，(b) `PostToolUse` token 核算，(c) `SessionStart` 预算初始化，(d) `Stop` 写入最终跟踪包。

6. **评估循环。** 克隆 SWE-bench Pro Python 的 30 问题子集。对每个运行你的工具。与 mini-swe-agent（最小基线）比较 pass@1、每任务轮次和每任务美元。将结果写入 `eval/results.jsonl`。

7. **成本控制。** 硬截止：50 轮、200k 上下文、每任务 5 美元。`PreCompact` 钩子在 150k 标记处将较旧的轮次摘要为先前状态块，为新观察腾出空间而不丢失规划。

8. **PR 提交。** 成功时，最后一步是 `git push` + 一个 GitHub API 调用，打开一个 PR，正文包含规划和差异摘要。

## 使用它

```
$ agent run ./my-repo "修复 worker.rs 中的竞态条件"
[规划]  1 定位 worker.rs 并列举互斥锁使用
        2 识别争用下的共享状态
        3 提出修复，验证测试
[工具]  ripgrep mutex.*lock -t rust           (44 个匹配，已截断)
[工具]  read_file src/worker.rs 120..180
[工具]  edit_file src/worker.rs (+8 -3)
[工具]  run_shell cargo test worker::          (通过)
[规划]  1 完成 · 2 完成 · 3 完成
[完成]  PR 已打开：#482   轮次=9   token=38k   成本=$0.41
```

## 交付它

可交付技能位于 `outputs/skill-terminal-coding-agent.md`。给定仓库路径和任务描述，它在沙盒中运行完整的规划-执行-观察循环，并返回 PR URL 和跟踪包。这个顶点项目的评分标准：

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 与基线对比 | 你的工具与 mini-swe-agent 在 30 个匹配的 Python 任务上对比 |
| 20 | 架构清晰度 | 规划/执行/观察分离、钩子界面、工具模式——与 Live-SWE-agent 布局对比审查 |
| 20 | 安全性 | 沙盒逃逸测试、权限提示、破坏性命令防护通过红队测试 |
| 20 | 可观察性 | 跟踪完整性（100% 的工具调用跨度）、每轮 token 核算 |
| 15 | 开发者体验 | 冷启动 < 2 秒、崩溃恢复恢复规划、Ctrl-C 干净地取消工具执行中 |
| **100** | | |

## 练习

1. 将底层模型从 Claude Sonnet 4.7 切换到在 vLLM 上服务的 Qwen3-Coder-30B。比较 pass@1 和每任务美元。报告开源模型在何处表现不佳。

2. 添加一个 `reviewer` 子智能体，在 PR 提交前读取差异，并可以请求修订循环。测量假阳性审查是否将 SWE-bench 通过率降到单智能体基线以下（提示：通常会）。

3. 对沙盒进行压力测试：编写一个尝试 `curl` 外部 URL 的任务和一个在 worktree 外写入的任务。确认两者都被 PreToolUse 钩子阻止。记录尝试。

4. 使用较小的模型（Haiku 4.5）实现 `PreCompact` 摘要。测量 3 倍压缩时丢失多少规划保真度。

5. 将 MCP StreamableHTTP 传输替换为 stdio。对冷启动和每次调用延迟进行基准测试。为仅本地使用选择一个优胜者。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| 工具 | "智能体循环" | 围绕模型的代码，分派工具、维护规划状态并强制执行预算 |
| 钩子 | "智能体事件监听器" | 用户在八个生命周期事件之一上由工具运行的脚本 |
| Worktree | "Git 沙盒" | 在单独路径上的链接 git 检出；可丢弃而不接触主克隆 |
| TodoWrite | "规划状态" | 模型每轮重写的待处理/进行中/已完成项目的类型化列表 |
| StreamableHTTP | "MCP 传输" | 2026 MCP 修订版：具有双向流的长寿命 HTTP 连接；取代 SSE |
| Token 上限 | "上下文预算" | 每轮或每会话的输入+输出 token 上限；触发压缩或终止 |
| pass@1 | "单次尝试通过率" | 在首次运行中解决的 SWE-bench 任务比例，无重试或测试集偷看 |

## 延伸阅读

- [Claude Code 文档](https://docs.anthropic.com/en/docs/claude-code) —— Anthropic 的参考工具
- [Cursor 3 更新日志](https://cursor.com/changelog) —— Agent Tabs 和 Composer 2 产品说明
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) —— SWE-bench 工具对比的最小基线
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) —— 使用 Opus 4.5 在 SWE-bench Verified 上达到 79.2%
- [OpenCode](https://opencode.ai) —— 开源工具，112k 星标
- [SWE-bench Pro 排行榜](https://www.swebench.com) —— 这个顶点项目的目标评估
- [Model Context Protocol 2026 路线图](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) —— StreamableHTTP、能力元数据
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 工具调用和 token 使用的跨度模式
