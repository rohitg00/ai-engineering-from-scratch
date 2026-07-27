# 行动预算（Action Budgets）、迭代上限（Iteration Caps）与成本调节器（Cost Governors）

> 某中型电商智能体的月 LLM 成本在其团队启用"订单跟踪"技能后从 1,200 美元飙升至 4,800 美元。这不是定价问题，而是一个智能体找到了新的循环并在其中持续消耗资源。微软的 Agent Governance Toolkit（2026 年 4 月 2 日）将对此类问题的防御措施体系化：每次请求的 `max_tokens`、每任务的 Token 和金额预算、每天/每月的上限、迭代上限、分层模型路由、提示缓存、上下文窗口化、针对高成本操作的 HITL 检查点，以及预算超支时的急停开关。Anthropic 的 Claude Code Agent SDK 以不同名称实现了同样的原语。金融速度限额（例如 10 分钟内超过 50 美元即切断访问）比月度上限能更快捕获循环问题。

**类型：** 学习
**语言：** Python（标准库，分层成本调节器模拟器）
**前置知识：** 第 15 章 · 10（权限模式），第 15 章 · 12（持久化执行）
**时长：** ~60 分钟

## 问题

自主智能体每一步都在消耗真实费用。聊天机器人的差劲输出只是一个糟糕的回答；而智能体的错误循环则是一张账单。业界对这一失败模式的术语是"拒绝钱包（Denial of Wallet）"——智能体持续推理、持续调用工具、持续产生费用，却没有任何机制能够阻止它，因为从一开始就没有设计这样的机制。

解决方案不是单一的数字，而是一套在不同时间尺度和粒度上的限制：每次请求、每项任务、每小时、每天、每月。设计良好的分层系统能在几分钟内捕获失控循环，几小时内捕获缓慢泄漏，一天内捕获糟糕的发布。当智能体是长周期且自主运行时，这套分层机制才能始终守住预算。

这是一堂工程课：数学很简单，但团队往往在纪律上失败。下面列出的所有限制均在微软 Agent Governance Toolkit 或 Anthropic Claude Code Agent SDK 文档中有所提及。

## 概念

### 成本调节器分层体系

1. **每次请求的 `max_tokens`（最大 Token 数）。** 简单直接。防止任意一次调用产生无上限的补全内容。
2. **每任务的 Token 预算。** 在整个运行过程中不超过 N 个 Token。达到上限即硬停止。
3. **每任务的金额预算。** 与 Token 预算相同，但以货币计。Claude Code 中的 `max_budget_usd`。
4. **每工具的调用上限。** 不超过 N 次 `WebFetch` 调用，N 次 `shell_exec` 调用等。
5. **迭代上限（`max_turns`）。** 智能体循环的总迭代次数，防止无限推理循环。
6. **每分钟 / 每小时 / 每天 / 每月上限。** 滑动窗口。在不同时间尺度上捕获泄漏。
7. **金融速度限额。** 例如"10 分钟内花费超过 50 美元则切断访问"。在月度上限触发之前捕获基于循环的消耗。
8. **分层模型路由。** 默认使用较小模型；仅在分类器判断任务需要时才升级到较大模型。
9. **提示缓存（Prompt caching）。** 系统提示和稳定上下文存储在提供方缓存中；重新发送的 Token 成本接近于零。
10. **上下文窗口化（Context windowing）。** 压缩/摘要以将活动上下文保持在阈值以下，直接降低 Token 成本。
11. **高成本操作的 HITL 检查点。** 在执行已知成本较高的操作（如长时间的工具调用、大规模下载、昂贵的模型升级）之前，需要人工确认。
12. **预算超支的急停开关。** 任何上限触发时会话立即中止。触发记录在案，需要单独的重新启用路径。

### 为什么要分层体系而不仅仅是单个上限

单一的月度上限只有在预算耗尽后才能捕获失控的智能体。单一的每次请求上限在会话层面毫无作用。不同的失败模式需要不同的时间尺度：

- **失控循环**（智能体陷入 5 秒重试循环）：由速度限额捕获。
- **缓慢泄漏**（智能体每项任务的执行量约为预期的 2 倍）：由每日上限捕获。
- **糟糕的发布**（新版本使用 5 倍的 Token 量）：由每周/每月上限捕获。
- **合理激增**（真实的业务需求而非 bug）：由每小时/每日上限捕获，并有清晰的日志。

### Claude Code 的预算体系

Claude Code Agent SDK 公开了以下内容（以官方文档为准）：

- `max_turns`——迭代上限。
- `max_budget_usd`——金额上限；超支时会话中止。
- `allowed_tools` / `disallowed_tools`——工具允许列表和拒绝列表。
- 提供在工具使用前的钩子点（Hook points），用于自定义成本核算。

与权限模式阶梯（第 10 课）结合使用。没有 `max_budget_usd` 的 `autoMode` 会话就是无约束的自主运行。Anthropic 明确指出自动模式需要预算控制；分类器与成本是正交的。

### EU AI Act、OWASP Agentic Top 10

微软的 Agent Governance Toolkit 涵盖了 OWASP Agentic Top 10 和 EU AI Act 第 14 条（人类监督）的要求。在欧洲的生产环境中，日志记录和上限强制执行是不可选项。

### 观察到的 1,200 美元 → 4,800 美元案例

微软文档中的真实案例：某电商智能体在添加新工具后月度成本翻了三倍。该工具允许智能体在每次会话中轮询订单状态。没有循环检测。没有每工具上限。没有针对周环比增长的告警。解决方案是添加每工具上限和每日增长告警。这是一个模板：每个新的工具接口都是一个新的潜在循环；每个新工具都需要自己的上限和告警。

## 使用

`code/main.py` 模拟一个智能体在有和没有分层成本调节器体系下的运行情况。模拟智能体在某些回合后会陷入轮询循环；分层体系能在速度窗口内捕获它，而单一的月度上限要等到数天后才会触发。

## 交付

`outputs/skill-agent-budget-audit.md` 对拟议的智能体部署方案的成本调节器体系进行审计，并标记缺失的层级。

## 练习

1. 运行 `code/main.py`。确认速度限额在轮询循环轨迹上先于迭代上限触发。然后禁用速度限额，测量智能体在迭代上限捕获之前"花费"了多少。

2. 为浏览器智能体（第 11 课）设计一套每工具上限。哪个工具需要最严格的上限？哪个工具可以无限制运行而不带来风险？

3. 阅读微软 Agent Governance Toolkit 文档。列出该工具包中命名的每种上限类型。将每种上限映射到一种失败模式（失控循环、缓慢泄漏、糟糕的发布、合理激增）。

4. 为一个实际任务（例如"对仓库中的 50 个 issue 进行分类"）拟定一次通宵无人值守运行的价格。将 `max_budget_usd` 设置为你点估计值的 2 倍。论证为什么是 2 倍。

5. Claude Code 的 `max_budget_usd` 在会话总成本上触发。设计一个你会在外部强制执行的速度限额。触发切断的条件是什么？重新启用是什么样的流程？

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|---|---|---|
| Denial of Wallet（拒绝钱包） | "失控账单" | 智能体循环产生费用，没有上限来阻止 |
| max_tokens（最大 Token 数） | "每次请求上限" | 单次补全大小的上限 |
| max_turns（最大回合数） | "迭代上限" | 会话中智能体循环迭代次数的上限 |
| max_budget_usd（最大预算美元） | "金额急停开关" | 会话成本上限；超支时中止 |
| Velocity limit（速度限额） | "速率上限" | 短时间窗口内的花费上限（例如 10 分钟 / 50 美元） |
| Tiered routing（分层路由） | "小模型优先" | 默认使用低成本模型；仅在分类器判断需要时升级 |
| Prompt caching（提示缓存） | "缓存的系统提示" | 提供方侧缓存将重新发送的 Token 成本降至接近零 |
| HITL checkpoint（人机协同检查点） | "人工审批关卡" | 高成本操作前需要人工确认 |

## 延伸阅读

- [Anthropic Claude Code Agent SDK — agent loop and budgets](https://code.claude.com/docs/en/agent-sdk/agent-loop) — `max_turns`、`max_budget_usd`、工具允许列表。
- [Microsoft Agent Framework — human-in-the-loop and governance](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — 成本调节器检查点。
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) — 提供方侧的成本控制。
- [Anthropic — Prompt caching (Claude API docs)](https://platform.claude.com/docs/en/prompt-caching) — 缓存机制。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 长周期智能体的成本概况。
