# 行动预算、迭代上限与成本调控器（Action Budgets, Iteration Caps, and Cost Governors）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 某中型电商 agent 的月度 LLM 成本在团队启用「订单追踪」技能后，从 1,200 美元飙到了 4,800 美元。这不是计费 bug，而是一个 agent 找到了新的 loop，然后在里面持续烧钱。微软 Agent Governance Toolkit（2026 年 4 月 2 日）把对这类问题的防御正式编纂成法：每请求 `max_tokens`、单任务 token 与美元预算、按日 / 月封顶、迭代上限、分层模型路由、prompt caching、上下文窗口管理、对昂贵动作的 HITL（human-in-the-loop，人工确认）检查点、预算突破时的 kill switch。Anthropic 的 Claude Code Agent SDK 也提供同一套原语，只是名字不同。资金速率限制——比如 10 分钟内花费超过 50 美元就切断访问——比月度封顶更快抓住 loop。

**Type:** Learn
**Languages:** Python (stdlib, layered cost-governor simulator)
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 12 (Durable execution)
**Time:** ~60 minutes

## 问题（The Problem）

自主 agent 每一轮都在花真金白银。聊天机器人输出糟糕，结果就是糟糕的回复；agent 陷入糟糕的 loop，结果就是一张账单。业界对这类故障模式有个公认的名字——「Denial of Wallet」（钱包拒绝服务）：agent 一直推理、一直调工具、一直产生账单，没有任何东西阻止它，因为没有人设计过停止机制。

修复方案不是一个数字，而是一摞不同时间尺度、不同粒度的限制：每请求、每任务、每小时、每天、每月。设计良好的限制栈能在几分钟内抓住失控 loop，几小时内抓住缓慢泄漏，一天内抓住糟糕的发布。同一套栈也是 agent 长链路自主运行时还能守住预算的唯一办法。

这是一节工程课：数学很平凡，纪律才是团队翻车的地方。下面列出的所有限制项，都在微软 Agent Governance Toolkit 或 Anthropic Claude Code Agent SDK 文档里被点过名。

## 概念（The Concept）

### 成本调控栈（The cost-governor stack）

1. **每请求 `max_tokens`。** 简单。防止单次调用产生不受控的长回复。
2. **单任务 token 预算。** 整次运行不得超过 N 个 token。到顶硬停。
3. **单任务美元预算。** 同 token，但以货币计。Claude Code 里叫 `max_budget_usd`。
4. **每工具调用上限。** `WebFetch` 调用不超过 N 次，`shell_exec` 不超过 N 次，等等。
5. **迭代上限（`max_turns`）。** agent loop 的总迭代次数；防止无限推理。
6. **每分钟 / 每小时 / 每天 / 每月封顶。** 滚动窗口。在不同时间尺度上抓泄漏。
7. **资金速率限制。** 比如「10 分钟内花费超过 50 美元就切断访问」。在月度封顶触发之前抓住 loop 类燃烧。
8. **分层模型路由。** 默认走更小的模型；只有当分类器判断任务确实需要时，才升到更大的模型。
9. **Prompt caching。** system prompt 与稳定上下文存在 provider 缓存里；重复发送的 token 成本接近零。
10. **上下文窗口管理（context windowing）。** 通过 compaction（压缩）/ 总结，把活动 context window（上下文窗口）压在阈值之下；直接降低 token 成本。
11. **昂贵动作的 HITL 检查点。** 在已知昂贵的动作之前（长工具调用、大规模下载、升级到更贵的模型），要求人工确认。
12. **预算突破时的 kill switch。** 任何一道封顶被触发时 session 即终止。封顶事件被记录；重新启用走单独路径。

### 为什么是栈，不是一个封顶

单一的月度封顶只在钱包见底之后才能抓到失控 agent。单一的每请求封顶在 session 层面抓不到任何东西。不同失败模式需要不同的时间尺度：

- **失控 loop**（agent 卡在 5 秒重试里）：靠速率限制抓。
- **缓慢泄漏**（agent 每个任务做了约 2 倍预期工作量）：靠日封顶抓。
- **糟糕发布**（新版本 token 用量是 5 倍）：靠周 / 月封顶抓。
- **合理飙升**（真实需求，不是 bug）：靠小时 / 天封顶抓，并在日志里清晰留痕。

### Claude Code 的预算面（Claude Code's budget surface）

Claude Code Agent SDK 暴露的接口（公开文档）：

- `max_turns` —— 迭代上限。
- `max_budget_usd` —— 美元封顶；触发即终止 session。
- `allowed_tools` / `disallowed_tools` —— 工具 allowlist 与 denylist（白名单与黑名单）。
- 工具调用前的 hook 点，可挂自定义成本核算。

要和权限模式阶梯（第 10 节）配合用。一个开了 `autoMode` 但没设 `max_budget_usd` 的 session，就是无人治理的自主权。Anthropic 明确把 Auto Mode 定义为「需要预算控制」；分类器与成本是正交的两件事。

### 欧盟 AI 法案与 OWASP Agentic Top 10（EU AI Act, OWASP Agentic Top 10）

微软的 Agent Governance Toolkit 覆盖了 OWASP Agentic Top 10 与欧盟 AI 法案第 14 条（人类监督）的要求。要在欧盟生产环境里跑，日志与封顶执行不是可选项。

### 实测的 $1,200 → $4,800 案例（The observed $1,200 → $4,800 case）

微软文档里那个真实案例：一个电商 agent 在新增一个工具后，月度成本翻了三倍。那个工具允许 agent 在每个 session 里轮询订单状态。没有 loop 检测。没有每工具封顶。没有按周环比的告警。修复是加了每工具封顶 + 日增长告警。这是一个模板：每个新工具面就是一个潜在新 loop；每个新工具都需要自己的封顶与自己的告警。

## 用起来（Use It）

`code/main.py` 模拟一次 agent 运行——分别在有和没有分层成本调控栈的情况下跑。模拟 agent 跑若干轮后会漂进一个轮询 loop；分层栈能在速率窗口内抓住它，而单独的月度封顶要好几天后才会触发。

## 上线部署（Ship It）

`outputs/skill-agent-budget-audit.md` 是一份审计 skill：审计某个待部署 agent 的成本调控栈，标出缺失的层。

## 练习（Exercises）

1. 跑 `code/main.py`。确认在轮询 loop 轨迹上，速率限制比迭代上限先触发。然后关掉速率限制，测一下在迭代上限抓到它之前，agent 「花」了多少。

2. 为一个浏览器 agent（第 11 节）设计一套每工具封顶。哪个工具需要最紧的封顶？哪个工具可以无封顶运行而不带风险？

3. 读微软 Agent Governance Toolkit 文档。列出文档里点名的每一种封顶类型。把每种映射到某个失败模式上（失控 loop、缓慢泄漏、糟糕发布、飙升）。

4. 给一个真实任务的过夜无人值守运行报价（比如「在某仓里 triage 50 个 issue」）。把 `max_budget_usd` 设为你点估值的 2 倍。说明为什么是 2 倍。

5. Claude Code 的 `max_budget_usd` 是按 session 累计成本触发的。设计一个外部强制的、互补的速率限制。是什么触发切断？重新启用是什么样子？

## 关键术语（Key Terms）

| 术语 | 别人怎么说 | 它实际是什么 |
|---|---|---|
| Denial of Wallet | 「失控账单」 | agent loop 在没有封顶阻止的情况下持续产生支出 |
| max_tokens | 「每请求封顶」 | 单次回复体量的上限 |
| max_turns | 「迭代上限」 | 一个 session 里 agent loop 迭代次数的上限 |
| max_budget_usd | 「美元 kill switch」 | session 成本封顶；触发即终止 |
| Velocity limit（速率限制） | 「速率封顶」 | 短时间窗口内的支出上限（比如 10 分钟 50 美元） |
| Tiered routing（分层路由） | 「先小模型」 | 默认走便宜模型；只在分类器认为有必要时才升级 |
| Prompt caching | 「缓存的 system prompt」 | provider 端缓存把重复发送的 token 成本降到接近零 |
| HITL checkpoint | 「人工审批关卡」 | 昂贵动作之前要求人工确认 |

## 延伸阅读（Further Reading）

- [Anthropic Claude Code Agent SDK — agent loop and budgets](https://code.claude.com/docs/en/agent-sdk/agent-loop) —— `max_turns`、`max_budget_usd`、工具 allowlist。
- [Microsoft Agent Framework — human-in-the-loop and governance](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) —— 成本调控检查点。
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) —— provider 端成本控制。
- [Anthropic — Prompt caching (Claude API docs)](https://platform.claude.com/docs/en/prompt-caching) —— 缓存机制。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) —— 长链路 agent 的成本画像。
