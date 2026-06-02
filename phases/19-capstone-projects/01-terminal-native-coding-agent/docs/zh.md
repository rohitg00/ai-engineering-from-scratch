# Capstone 01 — 终端原生编码 agent（Terminal-Native Coding Agent）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 到 2026 年，编码 agent 的形态已经定型。一个 TUI harness（外壳）、一份有状态的 plan、一组沙箱化的工具表面、一个 plan-act-observe-recover（规划-行动-观察-恢复）的循环。Claude Code、Cursor 3、OpenCode 在 50 英尺外看起来都长一个样。这个 capstone 要你端到端造一个出来 —— CLI 进、pull request 出 —— 并把它放到 SWE-bench Pro 上和 mini-swe-agent、Live-SWE-agent 对照。你会明白：难的不是模型调用，而是工具循环、沙箱，以及 50 轮跑下来的成本天花板。

**Type:** Capstone
**Languages:** TypeScript / Bun (harness), Python (eval scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and protocols), Phase 14 (agents), Phase 15 (autonomous systems), Phase 17 (infrastructure)
**Phases exercised:** P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**Time:** 35 hours

## 问题（Problem）

到 2026 年，编码 agent 已经成为占主导地位的 AI 应用门类。Claude Code（Anthropic）、装上 Composer 2 与 Agent Tabs 的 Cursor 3（Cursor）、Amp（Sourcegraph）、OpenCode（112k stars）、Factory Droids、Google Jules，全都是同一套架构的不同变体：终端 harness、带权限的工具表面、沙箱、围绕一个前沿模型的 plan-act-observe 循环。前沿很窄 —— Live-SWE-agent 用 Opus 4.5 在 SWE-bench Verified 上跑到了 79.2% —— 但工程上的功夫面很宽。多数失败模式不是模型犯错，而是工具循环不稳定、上下文被污染、token 成本失控、文件系统操作具有破坏性。

这些 agent 你没法从外部空想清楚。你得真造一个，然后亲眼看着它在第 47 轮被 ripgrep 返回的 8MB 匹配结果搞崩，再去重写截断层。这就是这个 capstone 的意义。

## 概念（Concept）

harness 有四个表面。**Plan**（规划）维护一个 TodoWrite 风格的状态对象，模型每一轮都重写它。**Act**（行动）派发工具调用（read、edit、run、search、git）。**Observe**（观察）捕获 stdout / stderr / 退出码，做截断，把摘要喂回去。**Recover**（恢复）处理工具错误，既不撑爆 context window（上下文窗口），也不无限循环。2026 年的形态还多了一样东西：**hooks**（钩子）。`PreToolUse`、`PostToolUse`、`SessionStart`、`SessionEnd`、`UserPromptSubmit`、`Notification`、`Stop`、`PreCompact` —— 一组可配置的扩展点，运维者在这里注入策略、遥测和 guardrail（护栏）。

沙箱是 E2B 或 Daytona。每个任务都跑在一个全新的 devcontainer 里，里面挂载一个可读写的 git worktree。harness 永远不去碰宿主机文件系统。worktree 在成功或失败后被销毁。成本控制有三层：每轮的 token 上限、每会话的美元预算、硬性的轮数上限（一般是 50）。可观测性那一层是带 GenAI 语义约定的 OpenTelemetry span，发到自建的 Langfuse。

## 架构（Architecture）

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

## 技术栈（Stack）

- harness 运行时：Bun 1.2 + Ink 5（终端里的 React）
- 模型接入：OpenRouter 统一 API，包含 Claude Sonnet 4.7、GPT-5.4-Codex、Gemini 3 Pro、Opus 4.5（留给最难的任务）
- 工具传输：Model Context Protocol StreamableHTTP（MCP 2026 修订版）
- 沙箱：E2B sandboxes（JS SDK）或 Daytona devcontainers
- 代码搜索：ripgrep 子进程，配合预编译的 17 种语言 tree-sitter parser
- 隔离：每个任务一个 `git worktree add`，成功 / 失败时清理
- 评测 harness：SWE-bench Pro（verified 子集）+ Terminal-Bench 2.0 + 你自己的 30 任务 holdout（保留集）
- 可观测性：OpenTelemetry SDK 配合 `gen_ai.*` semconv（语义约定）→ 自建 Langfuse
- PR 发布：GitHub App，使用 fine-grained token，作用域限定到目标 repo

## 动手实现（Build It）

1. **TUI 与命令循环。** 用 Bun 搭一个项目，引入 Ink。接受 `agent run <repo> "<task>"`。打印一个分栏视图：plan 面板（顶部）、工具调用流（中部）、token 预算（底部）。加上 Ctrl-C 取消，退出前先触发 `SessionEnd` hook。

2. **Plan 状态。** 定义一份带类型的 TodoWrite schema（pending / in_progress / done 的条目，带备注）。让模型每轮以一次工具调用整体重写状态 —— 不要让它增量改。把 plan 持久化到 `.agent/state.json`，崩溃后好恢复。

3. **工具表面。** 定义六个工具：`read_file`、`edit_file`（带 diff 预览）、`ripgrep`、`tree_sitter_symbols`、`run_shell`（带超时）、`git`（status / diff / commit / push）。通过 MCP StreamableHTTP 暴露，让 harness 与具体传输无关。每个工具都返回截断后的输出（每次调用上限 4k token）。

4. **沙箱包装。** 每个任务起一个 E2B sandbox。`git worktree add -b agent/$TASK_ID` 一个新分支。所有工具调用都在 sandbox 里执行。宿主机文件系统够不到。

5. **Hooks。** 实现 2026 全部八种 hook 类型。至少接上四个用户自写 hook：(a) `PreToolUse` 破坏性命令守卫，挡住 worktree 之外的 `rm -rf`；(b) `PostToolUse` token 计账；(c) `SessionStart` 预算初始化；(d) `Stop` 写出最终的 trace 包。

6. **评测循环。** 克隆 SWE-bench Pro Python 的一个 30 题子集。用你的 harness 跑一遍。和 mini-swe-agent（最小基线）在 pass@1、每任务轮数、每任务美元成本上对照。结果写到 `eval/results.jsonl`。

7. **成本控制。** 硬性截断：50 轮、200k context、每任务 $5。`PreCompact` hook 在 150k 这条线上把更早的轮次摘要成一个 prior-state 块，腾出地方放新 observation，但不丢失 plan。

8. **PR 发布。** 成功时，最后一步是 `git push` + 一次 GitHub API 调用，开一个 PR，把 plan 和 diff 摘要写进正文。

## 用起来（Use It）

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

## 上线部署（Ship It）

最终交付的 skill 落在 `outputs/skill-terminal-coding-agent.md`。给它一个 repo 路径和一份任务描述，它就在 sandbox 里跑完整的 plan-act-observe 循环，返回一个 PR URL 加一份 trace 包。本 capstone 的评分标准：

| 权重 | 评判项 | 怎么衡量 |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 vs 基线 | 你的 harness 和 mini-swe-agent 在 30 道匹配 Python 任务上的对照 |
| 20 | 架构清晰度 | plan/act/observe 是否分离、hook 表面、工具 schema —— 对照 Live-SWE-agent 的布局来评 |
| 20 | 安全 | 沙箱逃逸测试、权限提示、破坏性命令守卫能扛住红队 |
| 20 | 可观测性 | trace 完整度（100% 的工具调用都被 span 覆盖）、每轮 token 计账 |
| 15 | 开发者体验 | 冷启动 < 2s、崩溃恢复能续上 plan、Ctrl-C 在工具执行中段也能干净取消 |
| **100** | | |

## 练习（Exercises）

1. 把背后的模型从 Claude Sonnet 4.7 换成在 vLLM 上跑的 Qwen3-Coder-30B。对比 pass@1 与每任务美元成本。报告开放模型在哪些地方掉链子。

2. 加一个 `reviewer`（验证器）子 agent，在发 PR 前读 diff，可以发起一次返工循环。测一下：误报的 review 会不会把 SWE-bench 通过率压到单 agent 基线之下（提示：通常会）。

3. 压测沙箱：写一个任务尝试 `curl` 一个外部 URL，再写一个任务尝试在 worktree 之外写文件。确认这两个都被 PreToolUse hook 挡住。把尝试记录下来。

4. 用更小的模型（Haiku 4.5）实现 `PreCompact` 摘要。在 3x compaction（压缩）下测一下 plan 的保真度损失了多少。

5. 把 MCP StreamableHTTP 传输换成 stdio。基准测试冷启动和单次调用延迟。在仅本地使用的场景下挑一个赢家。

## 关键术语（Key Terms）

| 术语 | 大家嘴上的说法 | 它真正的意思 |
|------|-----------------|------------------------|
| Harness | "agent 循环" | 包在模型外面那一坨代码：派发工具、维护 plan 状态、执行预算 |
| Hook | "agent 事件监听器" | 用户自写的脚本，由 harness 在八种生命周期事件之一上触发运行 |
| Worktree | "git 沙箱" | 在另一条路径上的一个关联 git checkout；可丢弃，不影响主 clone |
| TodoWrite | "Plan 状态" | 一份带类型的 pending/in-progress/done 列表，模型每轮重写它 |
| StreamableHTTP | "MCP 传输" | 2026 MCP 修订：长连 HTTP，双向流式；取代 SSE |
| Token ceiling | "context 预算" | 每轮或每会话的输入+输出 token 上限；触发 compaction 或终止 |
| pass@1 | "单次通过率" | 第一次跑就解掉的 SWE-bench 任务比例，不重试、不偷看 test set |

## 延伸阅读（Further Reading）

- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) — Anthropic 的参考 harness
- [Cursor 3 changelog](https://cursor.com/changelog) — Agent Tabs 与 Composer 2 的产品说明
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) — SWE-bench harness 对照用的最小基线
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) — 用 Opus 4.5 在 SWE-bench Verified 上跑到 79.2%
- [OpenCode](https://opencode.ai) — 开源 harness，112k stars
- [SWE-bench Pro leaderboard](https://www.swebench.com) — 本 capstone 瞄准的评测
- [Model Context Protocol 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — StreamableHTTP、capability metadata
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — 工具调用与 token 用量的 span schema
