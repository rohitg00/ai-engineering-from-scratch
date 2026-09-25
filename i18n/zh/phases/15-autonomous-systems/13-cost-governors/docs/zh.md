# 动作预算、迭代上限与成本管控器

> 一个中型电商 agent 团队启用"订单追踪"技能后,其月度 LLM 成本从 $1,200 to $4,800。这不是定价 bug,而是一个 agent 发现了新的循环并在其中持续烧钱。Microsoft 的 Agent Governance Toolkit(2026 年 4 月 2 日)将针对这类问题的防御规范化:每请求 `max_tokens`、每任务 token 与美元预算、按日/月上限、迭代上限、分层模型路由、prompt 缓存、上下文窗口化、昂贵动作上的人工检查点、预算超支熔断开关。Anthropic 的 Claude Code Agent SDK 以不同名称提供了同样的原语。资金流速限制——例如 10 分钟内消费超过 $50 即切断访问——比月度上限更快捕获循环。

**Type:** Learn
**Languages:** Python(标准库,分层成本管控器模拟器)
**Prerequisites:** Phase 15 · 10(Permission modes)、Phase 15 · 12(Durable execution)
**Time:** 约 60 分钟

## 问题

自主 agent 每一轮都在花真金白银。聊天机器人的坏输出只是一条糟糕的回复;agent 的坏循环则是一张账单。业界对这种失效模式的术语是"Denial of Wallet"(钱包拒绝服务)—— agent 持续推理、持续调用工具、持续计费,而没有任何东西阻止它,因为设计时就没有让它停下来。

解决方案不是单个数字,而是一组位于不同时间尺度和粒度上的限制:每请求、每任务、每小时、每天、每月。设计良好的限制栈能在几分钟内捕获失控循环,几小时内捕获缓慢泄漏,一天内捕获糟糕的发布。当 agent 是长时程且自主运行时,同一限制栈也能保证预算始终受控。

这是一门工程课:数学很简单,纪律才是团队失败之处。下文列出的所有限制,均在 Microsoft Agent Governance Toolkit 或 Anthropic Claude Code Agent SDK 文档中有明确命名。

## 概念

### 成本管控器栈

1. **每请求 `max_tokens`。** 简单。防止任何单次调用生成无界的补全。
2. **每任务 token 预算。** 覆盖整个运行过程,不超过 N 个 token。达到上限即硬停止。
3. **每任务美元预算。** 同 token 预算,但以货币计。Claude Code 中的 `max_budget_usd`。
4. **每工具调用上限。** N 次 `WebFetch` 调用、N 次 `shell_exec` 调用等,不得超过。
5. **迭代上限(`max_turns`)。** agent 循环总迭代次数;防止无限推理循环。
6. **每分钟/每小时/每天/每月上限。** 滚动窗口。在不同时间尺度上捕获泄漏。
7. **资金流速限制。** 例如,"若 10 分钟内消费超过 $50,切断访问。"在月度上限触发之前捕获基于循环的烧钱。
8. **分层模型路由。** 默认使用较小模型;仅当分类器判定任务需要时才升级到更大模型。
9. **Prompt 缓存。** 系统提示与稳定上下文存入提供商缓存;重复发送的 token 成本近乎为零。
10. **上下文窗口化。** 通过压缩/摘要使活动上下文保持在阈值以下;直接降低 token 成本。
11. **昂贵动作上的人工检查点。** 在已知代价高昂的动作(长时间工具调用、大文件下载、昂贵的模型升级)之前,要求一次人工确认。
12. **预算超支熔断开关。** 任一上限触发时中止会话。记录该上限;需要单独的重新启用路径。

### 为什么用栈而不是单一上限

单一的月度上限只能在钱包耗尽后才发现失控的 agent。单一的每请求上限在会话层面什么都捕获不到。不同的失效模式需要不同的时间尺度:

- **失控循环**(agent 卡在 5 秒一次的重试中):由流速限制捕获。
- **缓慢泄漏**(agent 每个任务做约 2 倍于预期的工作):由每日上限捕获。
- **糟糕的发布**(新版本消耗 5 倍 token):由每周/每月上限捕获。
- **合理激增**(真实需求,而非 bug):由小时/天上限捕获,并留下清晰的日志。

### 一个 harness 的预算接口

Claude Code Agent SDK 暴露的接口(公开文档):

- `max_turns` —— 迭代上限。
- `max_budget_usd` —— 美元上限;超支即中止会话。
- `allowed_tools` / `disallowed_tools` —— 工具允许列表和拒绝列表。
- 工具调用之前的钩子点,用于自定义成本核算。

与权限模式阶梯(第 10 课)结合使用。没有 `max_budget_usd` 的 `autoMode` 会话就是不受治理的自主。Anthropic 明确将 Auto Mode 定位为需要预算控制;分类器与成本正交。

### EU AI Act、OWASP Agentic Top 10

Microsoft 的 Agent Governance Toolkit 覆盖了 OWASP Agentic Top 10 和 EU AI Act 第 14 条(人类监督)的要求。在欧盟进行生产部署,日志记录与上限强制执行不是可选项。

### 观察到的 $1,200 → $4,800 案例

Microsoft 文档中的真实案例:一个电商 agent 在新增一个工具后,月度成本翻了三倍。该工具允许 agent 在每次会话期间轮询订单状态。没有循环检测,没有每工具上限,没有对周环比增长的告警。修复方案是每工具上限加上每日增长告警。这是一个模板:每一个新的工具面都是一个新的潜在循环;每一个新工具都需要自己的上限和自己的告警。

```figure
cost-governor-stack
```

## 使用它

`code/main.py` 模拟一个 agent 运行,分别在不带和带分层成本管控器栈的情况下进行。模拟 agent 在若干轮后漂移进入轮询循环;分层栈在流速窗口内捕获它,而单一月度上限要数天后才会触发。

## 上线它

`outputs/skill-agent-budget-audit.md` 审计一个拟议 agent 部署的成本管控器栈,并标记缺失的层。

## 练习

1. 运行 `code/main.py`。确认在轮询循环轨迹上,流速限制先于迭代上限触发。然后禁用流速限制,测量在迭代上限捕获它之前 agent "花费"了多少。

2. 为一个浏览器 agent(第 11 课)设计一组每工具上限。哪个工具需要最紧的上限?哪个工具可以无界运行而无风险?

3. 阅读 Microsoft Agent Governance Toolkit 文档。列出该工具箱命名的每一种上限类型,并将每种映射到一个失效模式(失控循环、缓慢泄漏、糟糕发布、激增)。

4. 为一个现实任务(例如"对一个 repo 中的 50 个 issue 进行分诊")为一个通宵无人值守运行定价。将 `max_budget_usd` 设为你的点估计的 2 倍,并论证 2 倍的合理性。

5. Claude Code 的 `max_budget_usd` 基于会话累计成本触发。设计一个你会在外部强制执行的互补流速限制。触发切断的条件是什么?重新启用是什么样子?

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|---|---|---|
| Denial of Wallet | "账单失控" | Agent 循环持续产生消费,且没有上限阻止它 |
| max_tokens | "每请求上限" | 单次补全大小的上限 |
| max_turns | "迭代上限" | 会话中 agent 循环迭代次数的上限 |
| max_budget_usd | "美元熔断开关" | 会话成本上限;超支即中止 |
| 流速限制 | "速率上限" | 短窗口内的消费限制(例如 $50 / 10 分钟) |
| 分层路由 | "小模型优先" | 默认廉价模型;仅当分类器判定需要时升级 |
| Prompt 缓存 | "缓存系统提示" | 提供商侧缓存将重复发送的 token 成本降至近零 |
| HITL 检查点 | "人工审批门" | 昂贵动作之前需要一次人工确认 |

## 延伸阅读

- [Anthropic Claude Code Agent SDK —— agent 循环与预算](https://code.claude.com/docs/en/agent-sdk/agent-loop) —— `max_turns`、`max_budget_usd`、工具允许列表。
- [Microsoft Agent Framework —— 人机协同与治理](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) —— 成本管控检查点。
- [Anthropic —— Claude Managed Agents 概述](https://platform.claude.com/docs/en/managed-agents/overview) —— 提供商侧成本控制。
- [Anthropic —— Prompt caching(Claude API 文档)](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) —— 缓存机制。
- [Anthropic —— 实践中衡量 agent 自主性](https://www.anthropic.com/research/measuring-agent-autonomy) —— 长时程 agent 的成本画像。