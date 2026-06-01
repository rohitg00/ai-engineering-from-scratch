# 01 · 终端原生编程智能体

> 到 2026 年，编程智能体（coding agent）的形态已然定型：一个 TUI 主框架、一份有状态的计划、一个沙箱化的工具面、一套"规划-执行-观察-恢复"的循环。Claude Code、Cursor 3 和 OpenCode 从远处看如出一辙。本顶点项目要求你从头构建一个——命令行进，Pull Request 出——并在 SWE-bench Pro 上将其与 mini-swe-agent 和 Live-SWE-agent 对标。你将学到，难点不在于模型调用，而在于工具循环、沙箱，以及 50 轮运行的成本天花板。

**类型：** 顶点项目
**语言：** TypeScript / Bun（主框架），Python（评估脚本）
**前置：** 第 11 阶段（LLM 工程），第 13 阶段（工具与协议），第 14 阶段（智能体），第 15 阶段（自主系统），第 17 阶段（基础设施）
**涉及阶段：** P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**时长：** 35 小时

## 问题

编程智能体在 2026 年成为了 AI 应用的主导品类。Claude Code（Anthropic）、Cursor 3（含 Composer 2 和 Agent Tabs）、Amp（Sourcegraph）、OpenCode（112k stars）、Factory Droids 以及 Google Jules，都交付了同一架构的变体：一个终端主框架（terminal harness）、一个受权限管控的工具面（tool surface）、一个沙箱（sandbox），以及围绕前沿模型构建的"规划-执行-观察"循环（plan-act-observe loop）。前沿很窄——Live-SWE-agent 在 SWE-bench Verified 上使用 Opus 4.5 达到了 79.2%——但工程工艺很宽。大多数失败模式并非模型错误，而是工具循环不稳定、上下文污染（context poisoning）、令牌成本失控（runaway token cost），以及破坏性文件系统操作。

你无法从外部推理这些智能体的行为。你必须亲手构建一个，看着它在第 47 轮因 ripgrep 返回 8MB 匹配结果而崩溃，然后重建截断层（truncation layer）。这正是本顶点项目的意义所在。

## 概念

主框架有四个面。**规划（Plan）** 维护一个类似 TodoWrite 风格的状态对象，模型在每一轮中重写它。**执行（Act）** 分发工具调用（read、edit、run、search、git）。**观察（Observe）** 捕获 stdout / stderr / 退出码，进行截断，并将摘要反馈回去。**恢复（Recover）** 在不撑爆上下文窗口或无限循环的前提下处理工具错误。2026 年的形态还多了一个东西：**钩子（hooks）**。`PreToolUse`、`PostToolUse`、`SessionStart`、`SessionEnd`、`UserPromptSubmit`、`Notification`、`Stop` 和 `PreCompact`——这些是可配置的扩展点，供运维者注入策略、遥测和护栏。

沙箱使用 E2B 或 Daytona。每个任务在一个全新的 devcontainer 中运行，挂载一个可读写的 git 工作树（worktree）。主框架绝不接触宿主机文件系统。工作树在成功或失败后都会被拆除。成本控制在三个层面执行：每轮令牌上限、每次会话美元预算，以及硬性的轮次限制（通常 50 轮）。可观测性层采用 OpenTelemetry spans，遵循 GenAI 语义约定，发送到自托管的 Langfuse。

## 架构

```
  user CLI  ->  harness (Bun + Ink TUI)
                  |
                  v
           plan / act / observe loop  <--->  Claude Sonnet 4.7 / GPT-5.4-Codex / Gemini 3 Pro
                  |                          (via OpenRouter, model-agnostic)
                  v
           tool dispatcher (MCP StreamableHTTP client)
                  |
     +------------+------------+----------+
     v            v            v          v
  read/edit    ripgrep     tree-sitter   git/run
     |            |            |          |
     +------------+------------+----------+
                  |
                  v
           E2B / Daytona sandbox  (worktree isolated)
                  |
                  v
           hooks: Pre/Post, Session, Prompt, Compact
                  |
                  v
           OpenTelemetry -> Langfuse (spans, tokens, $)
                  |
                  v
           PR via GitHub app
```

## 技术栈

- 主框架运行时：Bun 1.2 + Ink 5（终端中的 React）
- 模型访问：OpenRouter 统一 API，支持 Claude Sonnet 4.7、GPT-5.4-Codex、Gemini 3 Pro、Opus 4.5（用于最难的任务）
- 工具传输：模型上下文协议 StreamableHTTP（MCP 2026 修订版）
- 沙箱：E2B sandboxes（JS SDK）或 Daytona devcontainers
- 代码搜索：ripgrep 子进程，tree-sitter 解析器（17 种语言，预编译）
- 隔离：每个任务执行 `git worktree add`，成功/失败后清理
- 评估框架：SWE-bench Pro（verified 子集）+ Terminal-Bench 2.0 + 你自己的 30 题留出集（holdout）
- 可观测性：OpenTelemetry SDK，使用 `gen_ai.*` 语义约定 → 自托管 Langfuse
- PR 提交：GitHub App，使用细粒度 token，范围限定目标仓库

## 构建步骤

1. **TUI 与命令循环。** 用 Bun 搭建一个 Ink 项目。接受 `agent run <repo> "<task>"`。打印分屏视图：计划面板（上）、工具调用流（中）、令牌预算（下）。添加 Ctrl-C 取消功能，在退出前触发 `SessionEnd` 钩子。

2. **计划状态。** 定义一个带类型的 TodoWrite schema（含 pending / in_progress / done 条目及备注）。模型每轮以工具调用的形式重写完整状态——不要让它增量修改。将计划持久化到 `.agent/state.json`，以便崩溃后恢复。

3. **工具面。** 定义六个工具：`read_file`、`edit_file`（含 diff 预览）、`ripgrep`、`tree_sitter_symbols`、`run_shell`（带超时）、`git`（status / diff / commit / push）。通过 MCP StreamableHTTP 暴露，使主框架与传输层解耦。每个工具返回截断后的输出（每次调用上限 4k tokens）。

4. **沙箱封装。** 每个任务创建一个 E2B 沙箱。`git worktree add -b agent/$TASK_ID` 新建分支。所有工具调用在沙箱内执行。宿主机文件系统不可达。

5. **钩子。** 实现全部八种 2026 钩子类型。至少接入四个用户编写的钩子：(a) `PreToolUse` 破坏性命令防护，阻止工作树外的 `rm -rf`，(b) `PostToolUse` 令牌记账，(c) `SessionStart` 预算初始化，(d) `Stop` 写入最终追踪包。

6. **评估循环。** 克隆 SWE-bench Pro Python 的 30 题子集。用你的主框架逐题运行。在 pass@1、每任务轮次和每任务美元成本上与 mini-swe-agent（最小基线）对比。将结果写入 `eval/results.jsonl`。

7. **成本控制。** 硬性截断：50 轮、200k 上下文、每任务 $5。`PreCompact` 钩子在达到 150k 标记时将较早轮次摘要为 prior-state 块，为新观察腾出空间而不丢失计划。

8. **PR 提交。** 成功时，最后一步是 `git push` + 调用 GitHub API 创建一个 PR，正文中包含计划和 diff 摘要。

## 使用示例

```
$ agent run ./my-repo "Fix the race condition in worker.rs"
[plan]  1 locate worker.rs and enumerate mutex uses
        2 identify shared state under contention
        3 propose fix, verify tests
[tool]  ripgrep mutex.*lock -t rust           (44 matches, truncated)
[tool]  read_file src/worker.rs 120..180
[tool]  edit_file src/worker.rs (+8 -3)
[tool]  run_shell cargo test worker::          (passed)
[plan]  1 done · 2 done · 3 done
[done]  PR opened: #482   turns=9   tokens=38k   cost=$0.41
```

## 交付标准

可交付技能存放在 `outputs/skill-terminal-coding-agent.md` 中。给定一个仓库路径和任务描述，它在沙箱中运行完整的"规划-执行-观察"循环，并返回一个 PR URL 和一个追踪包（trace bundle）。本顶点项目的评分标准：

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 对比基线 | 你的主框架 vs mini-swe-agent，在 30 道匹配的 Python 任务上 |
| 20 | 架构清晰度 | Plan/Act/Observe 分离、钩子面、工具 schema——对照 Live-SWE-agent 布局进行评审 |
| 20 | 安全性 | 沙箱逃逸测试、权限提示、破坏性命令防护通过红队测试 |
| 20 | 可观测性 | 追踪完整性（100% 工具调用有 span），每轮令牌记账 |
| 15 | 开发者体验 | 冷启动 < 2s，崩溃恢复可续接计划，Ctrl-C 可干净取消正在执行中的工具 |
| **100** | | |

## 练习

1. 将后端模型从 Claude Sonnet 4.7 替换为在 vLLM 上部署的 Qwen3-Coder-30B。对比 pass@1 和每任务美元成本。报告开源模型在哪些方面表现不足。

2. 添加一个 `reviewer` 子智能体，在 PR 提交前读取 diff，并可请求一轮修订。衡量误报审查是否会导致 SWE-bench 通过率低于单智能体基线（提示：通常会）。

3. 对沙箱进行压力测试：编写一个尝试 `curl` 外部 URL 的任务，以及一个尝试写入工作树之外的任务。确认两者均被 PreToolUse 钩子阻止。记录尝试日志。

4. 使用较小模型（Haiku 4.5）实现 `PreCompact` 摘要功能。衡量在 3 倍压缩下丢失了多少计划保真度。

5. 将 MCP StreamableHTTP 传输替换为 stdio。对冷启动和每次调用延迟进行基准测试。为纯本地使用场景选出优胜者。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| Harness | "智能体循环" | 围绕模型的代码，负责分发工具、维护计划状态、执行预算 |
| Hook | "智能体事件监听器" | 由用户编写的脚本，由主框架在八种生命周期事件之一上运行 |
| Worktree | "Git 沙箱" | 位于独立路径的关联 git 检出；用完即弃，不影响主克隆 |
| TodoWrite | "计划状态" | 一个带类型的待办/进行中/已完成条目列表，模型每轮重写 |
| StreamableHTTP | "MCP 传输" | 2026 年 MCP 修订版：长连接 HTTP 连接，支持双向流；取代 SSE |
| Token ceiling | "上下文预算" | 每轮或每次会话对输入+输出 token 的上限；触发压缩或终止 |
| pass@1 | "单次尝试通过率" | 首次运行即解决的 SWE-bench 任务比例，无重试、无测试集偷看 |

## 延伸阅读

- [Claude Code 文档](https://docs.anthropic.com/en/docs/claude-code) —— Anthropic 的参考主框架
- [Cursor 3 更新日志](https://cursor.com/changelog) —— Agent Tabs 和 Composer 2 产品说明
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) —— SWE-bench 主框架对比的最小基线
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) —— 使用 Opus 4.5 在 SWE-bench Verified 上达到 79.2%
- [OpenCode](https://opencode.ai) —— 开源主框架，112k stars
- [SWE-bench Pro 排行榜](https://www.swebench.com) —— 本顶点项目所瞄准的评估基准
- [模型上下文协议 2026 路线图](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) —— StreamableHTTP、能力元数据
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 工具调用和令牌使用的 span schema
