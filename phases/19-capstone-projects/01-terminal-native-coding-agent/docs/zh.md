# 巅峰项目 01 — 终端原生编程智能体

> 到 2026 年，编程智能体的形态已基本定型：一个 TUI 框架、一个带状态的计划、一个沙箱化的工具层、一个计划-行动-观察-恢复的循环。Claude Code、Cursor 3 和 OpenCode 从远处看几乎一模一样。本巅峰项目要求你从头到尾构建一个——从 CLI 输入到拉取请求输出——并在 SWE-bench Pro 上与 mini-swe-agent 和 Live-SWE-agent 进行对比评测。你将体会到，难点不在于模型调用，而在于工具循环、沙箱以及 50 轮运行的成本上限。

**类型：** 巅峰项目
**语言：** TypeScript / Bun（框架）、Python（评测脚本）
**前置要求：** 阶段 11（LLM 工程）、阶段 13（工具与协议）、阶段 14（智能体）、阶段 15（自主系统）、阶段 17（基础设施）
**涉及阶段：** P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**时间：** 35 小时

## 问题

编程智能体在 2026 年成为了主导的 AI 应用类别。Claude Code（Anthropic）、带 Composer 2 和 Agent Tabs 的 Cursor 3（Cursor）、Amp（Sourcegraph）、OpenCode（11.2 万星）、Factory Droids 和 Google Jules 都推出了同一架构的变体：一个终端框架、一个带权限的工具层、一个沙箱，以及一个围绕前沿模型构建的计划-行动-观察循环。前沿很窄——Live-SWE-agent 在 SWE-bench Verified 上使用 Opus 4.5 达到了 79.2%——但工程技艺却很广。大多数失败模式并非模型错误，而是工具循环不稳定、上下文污染、token 成本失控以及破坏性文件系统操作。

你无法从外部推理这些智能体。你必须亲手构建一个，看着它在第 47 轮因 ripgrep 返回 8MB 的匹配结果而崩溃，然后再重建截断层。这就是本巅峰项目的意义所在。

## 概念

该框架有四个层面。**计划（Plan）**维护一个 TodoWrite 风格的状态对象，模型每轮重写它。**行动（Act）**分发工具调用（读取、编辑、运行、搜索、git）。**观察（Observe）**捕获标准输出/标准错误/退出码，进行截断，并将摘要反馈回去。**恢复（Recover）**处理工具错误，同时不撑破上下文窗口也不无限循环。2026 年的形态增加了一个新东西：**钩子（Hooks）**。`PreToolUse`、`PostToolUse`、`SessionStart`、`SessionEnd`、`UserPromptSubmit`、`Notification`、`Stop` 和 `PreCompact`——可配置的扩展点，操作者在此注入策略、遥测和安全护栏。

沙箱使用 E2B 或 Daytona。每个任务在一个全新的 devcontainer 中运行，并挂载一个可读写的 git worktree。框架绝不触碰宿主文件系统。任务成功或失败后 worktree 会被拆除。成本控制分三层实施：每轮 token 上限、每次会话美元预算以及硬性轮数限制（通常为 50）。可观测层使用遵循 GenAI 语义约定的 OpenTelemetry span，发送到自托管的 Langfuse。

## 架构

```
  用户 CLI  ->  框架 (Bun + Ink TUI)
                  |
                  v
          计划 / 行动 / 观察循环  <--->  Claude Sonnet 4.7 / GPT-5.4-Codex / Gemini 3 Pro
                  |                          (通过 OpenRouter，模型无关)
                  v
           工具分发器 (MCP StreamableHTTP 客户端)
                  |
     +------------+------------+----------+
     v            v            v          v
  读取/编辑    ripgrep     tree-sitter   git/运行
     |            |            |          |
     +------------+------------+----------+
                  |
                  v
           E2B / Daytona 沙箱 (worktree 隔离)
                  |
                  v
           钩子: Pre/Post, Session, Prompt, Compact
                  |
                  v
           OpenTelemetry -> Langfuse (span, token, 成本)
                  |
                  v
           通过 GitHub 应用提交 PR
```

## 技术栈

- 框架运行时：Bun 1.2 + Ink 5（终端内 React）
- 模型访问：OpenRouter 统一 API，支持 Claude Sonnet 4.7、GPT-5.4-Codex、Gemini 3 Pro、Opus 4.5（用于最困难的任务）
- 工具传输：Model Context Protocol StreamableHTTP（MCP 2026 修订版）
- 沙箱：E2B 沙箱（JS SDK）或 Daytona devcontainer
- 代码搜索：ripgrep 子进程、17 种语言的 tree-sitter 解析器（预编译）
- 隔离：每个任务 `git worktree add`，成功/失败后清理
- 评测框架：SWE-bench Pro（已验证子集）+ Terminal-Bench 2.0 + 你自己的 30 个任务保留集
- 可观测性：使用 `gen_ai.*` 语义约定的 OpenTelemetry SDK → 自托管 Langfuse
- PR 提交：GitHub 应用，细粒度 token，作用域限定于目标仓库

## 构建步骤

1. **TUI 和命令循环。** 使用 Ink 搭建 Bun 项目。接受 `agent run <repo> "<task>"` 命令。显示分屏视图：计划面板（顶部）、工具调用流（中部）、token 预算（底部）。添加 Ctrl-C 取消功能，在退出前触发 `SessionEnd` 钩子。

2. **计划状态。** 定义一个带类型的 TodoWrite 模式（待处理/进行中/已完成项，附带备注）。模型每轮通过工具调用重写完整状态——不允许增量修改。将计划持久化到 `.agent/state.json`，以便崩溃后可恢复。

3. **工具层。** 定义六个工具：`read_file`、`edit_file`（带 diff 预览）、`ripgrep`、`tree_sitter_symbols`、`run_shell`（带超时）、`git`（status/diff/commit/push）。通过 MCP StreamableHTTP 暴露，使框架与传输方式无关。每个工具返回截断后的输出（每次调用上限 4k token）。

4. **沙箱封装。** 每个任务启动一个 E2B 沙箱。`git worktree add -b agent/$TASK_ID` 创建一个新分支。所有工具调用在沙箱内执行。宿主文件系统不可达。

5. **钩子。** 实现全部八种 2026 钩子类型。接入至少四个用户编写的钩子：(a) `PreToolUse` 破坏性命令守卫，阻止 worktree 之外的 `rm -rf` 操作；(b) `PostToolUse` token 记账；(c) `SessionStart` 预算初始化；(d) `Stop` 写入最终的追踪包。

6. **评测循环。** 克隆 SWE-bench Pro Python 的 30 个问题子集。对你的框架运行评测。与 mini-swe-agent（最小基线）在 pass@1、每任务轮数和每任务成本上进行比较。将结果写入 `eval/results.jsonl`。

7. **成本控制。** 硬性上限：50 轮、200k 上下文、每个任务 5 美元。`PreCompact` 钩子在到达 150k 标记时将较早的轮次总结为前序状态块，为新的观察结果腾出空间而不丢失计划。

8. **PR 提交。** 成功时，最后一步是 `git push` 加上一个 GitHub API 调用，在 PR 正文中附带计划和 diff 摘要。

## 使用示例

```
$ agent run ./my-repo "修复 worker.rs 中的竞态条件"
[计划]  1 定位 worker.rs 并枚举 mutex 使用
        2 识别争用下的共享状态
        3 提出修复方案，验证测试
[工具]  ripgrep mutex.*lock -t rust           (44 个匹配，已截断)
[工具]  read_file src/worker.rs 120..180
[工具]  edit_file src/worker.rs (+8 -3)
[工具]  run_shell cargo test worker::          (通过)
[计划]  1 完成 · 2 完成 · 3 完成
[完成]  PR 已打开: #482   轮数=9   token=38k   成本=$0.41
```

## 交付

交付的技能文件位于 `outputs/skill-terminal-coding-agent.md`。给定仓库路径和任务描述，它在沙箱中运行完整的计划-行动-观察循环，并返回 PR 链接和追踪包。本巅峰项目的评分标准：

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 vs 基线 | 你的框架对比 mini-swe-agent，在 30 个匹配的 Python 任务上 |
| 20 | 架构清晰度 | 计划/行动/观察分离、钩子层、工具模式——对照 Live-SWE-agent 布局评审 |
| 20 | 安全性 | 沙箱逃逸测试、权限提示、破坏性命令守卫通过红队测试 |
| 20 | 可观测性 | 追踪完整性（100% 工具调用有 span），每轮 token 记账 |
| 15 | 开发者体验 | 冷启动 < 2 秒、崩溃恢复可恢复计划、Ctrl-C 可干净地中断进行中的工具 |
| **100** | | |

## 练习

1. 将底层模型从 Claude Sonnet 4.7 替换为在 vLLM 上服务的 Qwen3-Coder-30B。比较 pass@1 和每任务成本。报告开源模型在哪些方面表现不足。

2. 添加一个 `reviewer` 子智能体，在 PR 提交前读取 diff 并可以请求修订循环。衡量误报评审是否会将 SWE-bench 通过率降低到单智能体基线以下（提示：通常是的）。

3. 压力测试沙箱：编写一个尝试 `curl` 外部 URL 的任务和一个在 worktree 之外写入的任务。确认两者均被 PreToolUse 钩子拦截。记录尝试日志。

4. 使用较小模型（Haiku 4.5）实现 `PreCompact` 摘要。衡量在 3 倍压缩下丢失了多少计划保真度。

5. 将 MCP StreamableHTTP 传输方式替换为 stdio。基准测试冷启动和每次调用延迟。为纯本地使用场景选出胜出方案。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| 框架（Harness） | "智能体循环" | 围绕模型的代码，负责分发工具、维护计划状态和执行预算 |
| 钩子（Hook） | "智能体事件监听器" | 用户编写的脚本，在框架的八个生命周期事件之一上运行 |
| Worktree | "Git 沙箱" | 一个独立的 git 检出链接；可丢弃而不影响主仓库 |
| TodoWrite | "计划状态" | 一个带类型的待处理/进行中/已完成项列表，模型每轮重写 |
| StreamableHTTP | "MCP 传输" | 2026 MCP 修订版：长寿命 HTTP 连接，双向流式传输；替代 SSE |
| Token 上限 | "上下文预算" | 每轮或每次会话的输入+输出 token 上限；触发压缩或终止 |
| pass@1 | "单次尝试通过率" | 未经重试或窥视测试集，一次运行即解决的 SWE-bench 任务比例 |

## 延伸阅读

- [Claude Code 文档](https://docs.anthropic.com/en/docs/claude-code) — Anthropic 的参考框架
- [Cursor 3 更新日志](https://cursor.com/changelog) — Agent Tabs 和 Composer 2 产品说明
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) — SWE-bench 框架对比的最小基线
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) — 在 SWE-bench Verified 上使用 Opus 4.5 达到 79.2%
- [OpenCode](https://opencode.ai) — 开源框架，11.2 万星
- [SWE-bench Pro 排行榜](https://www.swebench.com) — 本巅峰项目目标评测平台
- [Model Context Protocol 2026 路线图](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — StreamableHTTP、能力元数据
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — 工具调用和 token 使用的 span 模式
