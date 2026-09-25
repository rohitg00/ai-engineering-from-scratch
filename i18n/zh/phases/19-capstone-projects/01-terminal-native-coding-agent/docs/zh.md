# 毕业项目 01 — 终端原生编码 Agent

> 到 2026 年，编码 agent 的形态已经定型：一个 TUI 外壳、一个有状态的计划、一个沙箱化的工具接口，以及一个“计划—执行—观察—恢复”的循环。Claude Code、Cursor 3 和 OpenCode 从远处看几乎一模一样。这个毕业项目要求你从头到尾构建一个——输入 CLI，输出 pull request——并在 SWE-bench Pro 上与 mini-swe-agent 和 Live-SWE-agent 对比评测。你将理解为什么难点不在于模型调用，而在于工具循环、沙箱，以及 50 轮运行的成本上限。

**Type:** 毕业项目
**Languages:** TypeScript / Bun（外壳），Python（评测脚本）
**Prerequisites:** Phase 11（LLM 工程）、Phase 13（工具与协议）、Phase 14（agent）、Phase 15（自主系统）、Phase 17（基础设施）
**Phases exercised:** P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**Time:** 35 小时

## 问题

编码 agent 在 2026 年成为 AI 应用的主导类别。Claude Code（Anthropic）、Cursor 3（含 Composer 2 和 Agent Tabs，来自 Cursor）、Amp（Sourcegraph）、OpenCode（112k stars）、Factory Droids 和 Google Jules 都在发布同一架构的不同变体：一个终端外壳、一个带权限控制的工具接口、一个沙箱，以及围绕前沿模型构建的计划—执行—观察循环。前沿很窄——Live-SWE-agent 在 SWE-bench Verified 上用 Opus 4.5 达到 79.2%——但工程细节的空间很大。大多数失败模式不是模型错误，而是工具循环不稳定、上下文污染、token 成本失控，以及破坏性的文件系统操作。

你无法从外部推演这些 agent。你必须亲手构建一个，看着循环在第 47 轮因为 ripgrep 返回 8MB 匹配结果而崩溃，然后重建截断层。这正是这个毕业项目的意义所在。

## 概念

外壳有四个层面。**计划**（Plan）维护一个 TodoWrite 风格的状态对象，模型每一轮都重写它。**执行**（Act）分发工具调用（读取、编辑、运行、搜索、git）。**观察**（Observe）捕获 stdout / stderr / 退出码，进行截断，并把摘要回传。**恢复**（Recover）处理工具错误，既不撑爆上下文窗口，也不陷入无限循环。2026 年的形态又增加了一项：**hooks**。`PreToolUse`、`PostToolUse`、`SessionStart`、`SessionEnd`、`UserPromptSubmit`、`Notification`、`Stop` 和 `PreCompact` ——可配置的扩展点，操作者在这些点上注入策略、遥测和防护栏。

沙箱是 E2B 或 Daytona。每个任务在一个全新的 devcontainer 中运行，git worktree 以读写方式挂载。外壳从不触碰宿主文件系统。无论成功还是失败，worktree 都会被销毁。成本控制在三层实施：每轮 token 上限、每个会话的美元预算，以及硬性轮次限制（通常为 50）。可观测性层是带 GenAI 语义约定的 OpenTelemetry span，发送到自托管的 Langfuse。

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

- 外壳运行时：Bun 1.2 + Ink 5（终端中的 React）
- 模型接入：OpenRouter 统一 API，包括 Claude Sonnet 4.7、GPT-5.4-Codex、Gemini 3 Pro、Opus 4.5（用于最难的任务）
- 工具传输：Model Context Protocol StreamableHTTP（MCP 2026 修订版）
- 沙箱：E2B sandboxes（JS SDK）或 Daytona devcontainers
- 代码搜索：ripgrep 子进程，17 种语言的 tree-sitter 解析器（预编译）
- 隔离：每个任务使用 `git worktree add`，成功 / 失败后清理
- 评测外壳：SWE-bench Pro（verified 子集）+ Terminal-Bench 2.0 + 你自己的 30 任务 holdout
- 可观测性：带 `gen_ai.*` semconv 的 OpenTelemetry SDK → 自托管 Langfuse
- PR 发布：GitHub App 配细粒度 token，作用域仅限于目标仓库

```figure
ce-agent-loop
```

## 动手构建

1. **TUI 与命令循环。** 用 Ink 搭建 Bun 项目骨架。接受 `agent run <repo> "<task>"`。打印分屏视图：计划面板（上）、工具调用流（中）、token 预算（下）。在 Ctrl-C 时增加取消功能，退出前触发 `SessionEnd` hook。

2. **计划状态。** 定义一个带类型的 TodoWrite schema（pending / in_progress / done 条目，附注释）。模型每一轮把完整状态作为工具调用重写——不要让它增量修改。将计划持久化到 `.agent/state.json`，以便崩溃后可以恢复。

3. **工具接口。** 定义六个工具：`read_file`、`edit_file`（带 diff 预览）、`ripgrep`、`tree_sitter_symbols`、`run_shell`（带超时）、`git`（status / diff / commit / push）。通过 MCP StreamableHTTP 暴露，使外壳与传输方式无关。每个工具都返回截断后的输出（每次调用上限 4k token）。

4. **沙箱封装。** 每个任务启动一个 E2B 沙箱。`git worktree add -b agent/$TASK_ID` 一个新分支。所有工具调用都在沙箱内执行。宿主文件系统不可达。

5. **Hooks。** 实现全部八种 2026 hook 类型。接入至少四个用户编写的 hooks：(a) `PreToolUse` 破坏性命令防护，阻止在 worktree 之外执行 `rm -rf`；(b) `PostToolUse` token 计账；(c) `SessionStart` 预算初始化；(d) `Stop` 写入最终的 trace 包。

6. **评测循环。** 克隆 SWE-bench Pro Python 的 30 个 issue 子集。用你的外壳对每个任务运行。在 pass@1、每任务轮数和每任务美元成本上与 mini-swe-agent（最小基线）对比。将结果写入 `eval/results.jsonl`。

7. **成本控制。** 硬性截止：50 轮、200k 上下文、每任务 $5。`PreCompact` hook 在 150k 标记处把较早的轮次总结成先验状态块，为新观察腾出空间，同时不丢失计划。

8. **PR 发布。** 成功时，最后一步是 `git push` 加一次 GitHub API 调用，打开一个 PR，正文包含计划和 diff 摘要。

## 使用

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

## 发布

交付技能位于 `outputs/skill-terminal-coding-agent.md`。给定一个仓库路径和任务描述，它在沙箱中运行完整的计划—执行—观察循环，返回 PR URL 和 trace 包。本毕业项目的评分标准：

| 权重 | 标准 | 如何衡量 |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 对比基线 | 你的外壳与 mini-swe-agent 在 30 个配对 Python 任务上的对比 |
| 20 | 架构清晰度 | 计划/执行/观察的分离、hook 接口、工具 schema——对照 Live-SWE-agent 的布局评审 |
| 20 | 安全性 | 沙箱逃逸测试、权限提示、破坏性命令防护通过红队测试 |
| 20 | 可观测性 | trace 完整性（100% 的工具调用有 span）、每轮 token 计账 |
| 15 | 开发者体验 | 冷启动 < 2s、崩溃恢复可续接计划、Ctrl-C 在工具执行中干净地取消 |
| **100** | | |

## 练习

1. 把底层模型从 Claude Sonnet 4.7 换成 vLLM 上部署的 Qwen3-Coder-30B。对比 pass@1 和每任务美元成本。报告开源模型在哪些方面表现欠佳。

2. 添加一个 `reviewer` 子 agent，在发布 PR 前阅读 diff，并可以请求一轮修订。衡量假阳性评审是否会将 SWE-bench pass 率拉低到单 agent 基线以下（提示：通常会）。

3. 压力测试沙箱：编写一个尝试 `curl` 外部 URL 的任务，以及一个向 worktree 之外写入的任务。确认两者都被 PreToolUse hook 阻止。记录这些尝试。

4. 用较小的模型（Haiku 4.5）实现 `PreCompact` 总结。衡量在 3 倍压缩下计划保真度损失了多少。

5. 把 MCP StreamableHTTP 传输换成 stdio。对冷启动和每调用延迟做基准测试。为纯本地使用场景选出一个赢家。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| Harness | “agent 循环” | 包裹模型的代码，负责分发工具、维护计划状态并执行预算限制 |
| Hook | “agent 事件监听器” | 由外壳在八种生命周期事件之一上运行的用户编写脚本 |
| Worktree | “git 沙箱” | 位于独立路径的关联 git checkout；可随意丢弃，不影响主克隆 |
| TodoWrite | “计划状态” | 一个带类型的 pending/in-progress/done 条目列表，模型每一轮都重写它 |
| StreamableHTTP | “MCP 传输” | 2026 MCP 修订版：带双向流的长连接 HTTP；取代 SSE |
| Token 上限 | “上下文预算” | 每轮或每会话的输入+输出 token 上限；触发压缩或终止 |
| pass@1 | “单次尝试通过率” | SWE-bench 任务首次运行即解决、无重试、不偷看测试集的比例 |

## 延伸阅读

- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) —— Anthropic 的参考外壳
- [Cursor 3 changelog](https://cursor.com/changelog) —— Agent Tabs 和 Composer 2 的产品说明
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) —— SWE-bench 外壳对比的最小基线
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) —— 用 Opus 4.5 在 SWE-bench Verified 达到 79.2%
- [OpenCode](https://opencode.ai) —— 开源外壳，112k stars
- [SWE-bench Pro leaderboard](https://www.swebench.com) —— 本毕业项目针对的评测
- [Model Context Protocol 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) —— StreamableHTTP、能力元数据
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 工具调用和 token 用量的 span schema