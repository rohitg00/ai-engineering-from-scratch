# 多会话交接

> 会话即将结束。工作还没有。交接数据包是将"Agent 工作了一小时"转变为"下一轮会话在第一分钟就高效"的制品。有目的地构建它，而非作为事后想法。

**类型：** 构建
**语言：** Python（标准库）
**先决条件：** 阶段 14 · 34（仓库记忆）、阶段 14 · 38（验证）、阶段 14 · 39（审查者）
**时间：** ~50 分钟

## 学习目标

- 识别每个交接数据包需要的七个字段。
- 从工作台制品生成交接，无需手写散文。
- 将大型反馈日志修剪为交接大小的摘要。
- 使下一轮会话的第一个操作是确定性的。

## 问题

会话结束。Agent 说"太好了，我们有了进展。" 下一轮会话打开。下一个 Agent 问"我们上次停在哪里？" 第一个 Agent 的回答消失了。下一个 Agent 重新发现，重新运行相同的命令，重新询问人类相同的问题，并浪费三十分钟来恢复上一轮会话的最后三十秒。

不良交接的成本在任务的生命周期内每轮会话都要付出。修复方法是在会话结束时自动生成的数据包：什么变更了，为什么，尝试了什么，什么失败了，剩下什么，下次首先做什么。

## 概念

```mermaid
flowchart LR
  State[agent_state.json] --> Generator[generate_handoff.py]
  Verdict[verification_report.json] --> Generator
  Review[review_report.json] --> Generator
  Feedback[feedback_record.jsonl] --> Generator
  Generator --> Handoff[handoff.md + handoff.json]
  Handoff --> Next[下一轮会话]
```

### 每个交接携带的七个字段

| 字段 | 回答的问题 |
|-------|--------------|
| `summary` | 做了什么的一段话 |
| `changed_files` | 差异一览 |
| `commands_run` | 实际执行了什么 |
| `failed_attempts` | 尝试了什么以及为什么不起作用 |
| `open_risks` | 下次会话可能出问题的地方，带严重性 |
| `next_action` | 下次会话采取的第一个具体步骤 |
| `verdict_pointer` | 验证 + 审查报告的路径 |

`next_action` 字段是承重字段。除了 `next_action` 之外什么都有交接是状态报告，而非交接。

### 交接是生成的，而非编写的

手写的交接是在困难日子会被跳过交接。生成器读取工作台制品并发布数据包。Agent 的工作是使工作台处于生成器可以总结的状态，而非编写摘要。

### 两种形式：人类可读和机器可读

`handoff.md` 是人类读取的内容。`handoff.json` 是下一个 Agent 加载的内容。两者来自相同的来源制品。如果它们分歧，JSON 胜出。

### 反馈日志修剪

完整的 `feedback_record.jsonl` 可能有数百个条目。交接仅携带最后 K 个加上每个非零退出的条目。下一轮会话如果需要可以加载完整日志，但数据包保持小巧。

## 构建

`code/main.py` 实现：

- 将状态、裁决、审查和反馈收集到单个 `WorkbenchSnapshot` 的加载器。
- `generate_handoff(snapshot) -> (markdown, payload)` 函数。
- 选择最后 K 个反馈条目加上所有非零退出的过滤器。
- 在脚本旁边写入 `handoff.md` 和 `handoff.json` 的演示运行。

运行：

```
python3 code/main.py
```

输出：打印的交接正文，加上磁盘上的两个文件。

## 生产模式

Codex CLI、Claude Code 和 OpenCode 各自提供不同的压缩故事；结构化交接数据包位于所有三者之上。

**压缩策略不同；数据包模式不变。** Codex CLI 的 POST /v1/responses/compact 是服务器端不透明 AES blob（OpenAI 模型的快速路径）；回退是作为 `_summary` 用户角色消息附加的本地"交接摘要"。Claude Code 在上下文的 95% 运行五阶段渐进式压缩。OpenCode 做基于时间戳的消息隐藏加上 5 头部 LLM 摘要。三种不同机制，相同需求：将 surviv 压缩的内容序列化为可移植制品。数据包就是那个制品。

**新鲜会话交接不是压缩。** 压缩扩展会话；交接干净地关闭一个并开始下一个。Hermes Issue #20372 框架（2026 年 4 月）是正确的：当就地压缩开始降级时，Agent 应该编写紧凑交接，结束会话，并在新鲜上下文中恢复。数据包使那种转换便宜。错误是保持压缩直到质量崩溃；修复方法是预算用于早期、干净的交接。

**每个分支和主题一个活跃交接。** 多 Agent 协调在陈旧交接上比在不良模型输出上更常崩溃。始终包括 `branch`、`last_known_good_commit` 和 `status` 为 `active | superseded | archived`。陈旧交接被归档；只有活跃的那个驱动下一轮会话。这是交接作为笔记与交接作为状态之间的区别。

**在 50-75% 上下文时总结，而非在墙边。** 手写模式 playbook（CLAUDE.md + HANDOVER.md）报告当会话在 50-75% 上下文预算而非 95% 结束时的最佳结果。数据包生成器在压缩制品污染源状态之前干净地运行。当上下文完整时编写便宜；当模型已经失去其位置时昂贵。

## 使用

生产模式：

- **会话结束 hook。** 运行时在用户关闭聊天时触发生成器。数据包进入 `outputs/handoff/<session_id>/`。
- **PR 模板。** 生成器的 Markdown 也是 PR 正文。审查者无需打开五个其他文件即可阅读它。
- **跨 Agent 交接。** 用一个产品（Claude Code）构建，用另一个（Codex）继续。数据包是通用语。

数据包小巧、规律且生产成本低。成本节省随每轮会话复合。

## 部署

`outputs/skill-handoff-generator.md` 产生调优到项目制品路径的生成器、运行它的会话结束 hook，以及下一个 Agent 在启动时读取的 `handoff.json` 模式。

## 练习

1. 添加 `assumptions_to_validate` 字段，呈现构建者记录但审查者未评分高于 1 的每个假设。
2. 对失败运行与通过运行不同地修剪反馈摘要。辩护不对称性。
3. 包括"向人类提问"列表。问题进入数据包与进入聊天消息的阈值是多少？
4. 使生成器幂等：运行两次产生相同数据包。为此保持需要什么是稳定的？
5. 添加"下一轮会话先决条件"部分，准确列出下一轮会话必须在行动前加载的制品。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------|----------|
| Handoff packet（交接数据包） | "会话摘要" | 携带七个字段的生成制品，既有 Markdown 也有 JSON |
| Next action（下一步操作） | "首先做什么" | 开始下一轮会话的一个具体步骤 |
| Feedback trim（反馈修剪） | "日志摘要" | 最后 K 个记录加上每个非零退出 |
| Status report（状态报告） | "我们做了什么" | 缺少 `next_action` 的文档；有用，但不是交接 |
| Verdict pointer（裁决指针） | "收据" | 验证 + 审查报告的路径，用于可追溯性 |

## 延伸阅读

- [Anthropic, 长运行 Agent 的有效 harness](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [OpenAI Agents SDK 交接](https://platform.openai.com/docs/guides/agents-sdk/handoffs)
- [Codex Blog, Codex CLI 上下文压缩：架构、配置、管理长会话](https://codex.danielvaughan.com/2026/03/31/codex-cli-context-compaction-architecture/) — POST /v1/responses/compact 和本地回退
- [Justin3go, 剥离沉重记忆：Codex、Claude Code、OpenCode 中的上下文压缩](https://justin3go.com/en/posts/2026/04/09-context-compaction-in-codex-claude-code-and-opencode) — 三供应商压缩比较
- [JD Hodges, Claude 交接提示：如何在会话间保持上下文 (2026)](https://www.jdhodges.com/blog/ai-session-handoffs-keep-context-across-conversations/) — CLAUDE.md + HANDOVER.md，50-75% 上下文预算
- [Mervin Praison, 管理多 Agent 编码会话中的交接：新鲜上下文而不丢失连续性](https://mer.vin/2026/04/managing-handoffs-in-multi-agent-coding-sessions-fresh-context-without-losing-continuity/) — 分布式系统框架
- [Hermes Issue #20372 — 当压缩变得风险时自动新鲜会话交接](https://github.com/NousResearch/hermes-agent/issues/20372)
- [Hermes Issue #499 — 上下文压缩质量大修](https://github.com/NousResearch/hermes-agent/issues/499) — Codex CLI 中面向交接的提示
- [Microsoft Agent Framework, 压缩](https://learn.microsoft.com/en-us/agent-framework/agents/conversations/compaction)
- [OpenCode, 上下文管理和压缩](https://deepwiki.com/sst/opencode/2.4-context-management-and-compaction)
- [LangChain, Agent 的上下文工程](https://www.langchain.com/blog/context-engineering-for-agents)
- 阶段 14 · 34 — 生成器读取的状态文件
- 阶段 14 · 38 — 数据包指向的验证裁决
- 阶段 14 · 39 — 打包到数据包中的审查者报告
