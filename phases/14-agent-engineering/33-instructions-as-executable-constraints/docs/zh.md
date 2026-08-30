# Agent 指令作为可执行约束

> 以散文形式编写的指令是愿望。以约束形式编写的指令是测试。工作台将每条规则转化为 agent 可以在运行时检查、审查者可以在事后验证的东西。

**类型：** 构建
**语言：** Python（标准库）
**前置条件：** 第 14 阶段 · 32（最小工作台）
**时间：** ~50 分钟

## 学习目标

- 将路由散文与操作规则分开。
- 将启动规则、禁止动作、完成定义、不确定性处理和审批边界表达为机器可检查的约束。
- 实现一个规则检查器，根据规则集对运行进行评分。
- 使规则集差异友好，以便审查可以看到什么改变了。

## 问题

典型的 `AGENTS.md` 读起来像入职文档。它告诉 agent "小心"、"彻底测试"、"不确定时询问"。三天后，agent 发布了一个没有测试的变更，写入禁止目录，并且从未询问，因为它从不知道界限在哪里。

指令在可操作时是强大的，在愿望式时是弱小的。修复方法是编写工作台可以解释、审查者可以评分的规则。

## 概念

规则属于 `docs/agent-rules.md`，远离简短的根路由器。每条规则有名称、类别和检查。

```mermaid
flowchart LR
  Router[AGENTS.md] --> Rules[docs/agent-rules.md]
  Rules --> Checker[rule_checker.py]
  Checker --> Report[rule_report.json]
  Report --> Reviewer[审查者]
```

### 涵盖大多数规则的五种类别

| 类别 | 规则回答的问题 | 示例 |
|------|--------------|------|
| 启动 | 工作开始前必须为真的是什么？ | "状态文件存在且是新鲜的" |
| 禁止 | 什么绝不能发生？ | "不要编辑 `scripts/release.sh`" |
| 完成定义 | 什么证明任务完成了？ | "pytest 退出 0 且验收行通过" |
| 不确定性 | 不确定时 agent 做什么？ | "打开问题笔记而不是猜测" |
| 审批 | 什么需要人工审批？ | "任何新依赖、任何生产写入" |

不适合这五种类别之一的规则通常想成为两条规则。强制拆分。

### 规则是机器可读的

每条规则有 slug、类别、单行描述和 `check` 字段，命名 `rule_checker.py` 中的函数。添加规则意味着添加检查；检查器随工作台增长。

### 规则是差异友好的

规则以单个 markdown 文件中每个标题一条的形式存在。重命名在差异中可见。新规则位于其类别顶部。陈旧规则被删除，不是注释掉，因为工作台是事实来源，不是团队上季度感受的聊天记录。

### 规则与框架护栏

框架护栏（OpenAI Agents SDK 护栏、LangGraph 中断）在运行时级别强制执行规则。本课中的规则集是运行时实现的人类可读、可审查的合约。你需要两者：运行时在一轮中捕获违规，规则集证明运行时在做正确的事。

## 构建

`code/main.py` 交付：

- 将规则加载到数据类的 `agent-rules.md` 解析器。
- `rule_checker.py` 风格检查器函数，每个 `check` 引用一个。
- 一个演示 agent 运行，违反两条规则，检查通过捕获它们。

运行：

```
python3 code/main.py
```

输出：解析的规则集、运行跟踪、每条规则的通过/失败，以及保存在脚本旁边的 `rule_report.json`。

## 野外生产模式

三种模式将持续一个季度的规则集与一周内衰减的规则集分开。

**写入时的严重度标记。** 每条规则携带 `severity`：`block`、`warn` 或 `info`。检查器报告所有三种；运行时仅在 `block` 上拒绝。大多数团队早期高估严重度，然后在截止日期压力下悄悄削弱；写入时标记强制提前校准。与验证门控（第 14 阶段 · 38）配对，后者将任何 `block` 规则的覆盖签名到 `overrides.jsonl` 审计日志中。

**规则过期作为强制函数。** 每条规则携带 `expires_at` 日期（默认自编写起 90 天）。当未过期规则连续 60 天零违规时，检查器发出警告；下次季度审查要么证明保留它、削弱为 `info`，要么删除它。Cloudflare 的生产 AI 代码审查数据（2026 年 4 月，30 天内 5,169 个仓库的 131,246 次审查运行）显示，具有明确过期的规则集保持在每个仓库 30 条规则以下；没有过期的增长到 80+，大多数从未触发。

**Markdown 作为源，JSON 作为缓存。** `agent-rules.md` 是编写文件；`agent-rules.lock.json` 是检查器在热路径中读取的缓存。锁由预提交钩子重新生成。Markdown 差异可审查；JSON 解析远离每一轮。与 `package.json` / `package-lock.json` 和 `Cargo.toml` / `Cargo.lock` 相同形状。

## 使用

在生产中：

- Claude Code、Codex、Cursor 在会话开始时读取规则，并在拒绝动作时引用它们。检查器在 CI 中重新运行它们以捕获静默漂移。
- OpenAI Agents SDK 护栏将相同的检查注册为输入和输出护栏。Markdown 是文档表面；SDK 是运行时表面。
- LangGraph 中断在飞行中的节点违反规则时触发。中断处理程序读取规则，询问人类，然后恢复。

规则集在所有三个之间可移植，因为它只是 markdown 加函数名。

## 交付

`outputs/skill-rule-set-builder.md` 访谈项目所有者，将现有散文指令分类为五种类别，并发出版本化的 `agent-rules.md` 加检查器存根。

## 练习

1. 如果你的产品真正需要，添加第六个类别。证明为什么它不会坍缩到五个之一。
2. 扩展检查器，使规则可以携带严重度（`block`、`warn`、`info`），报告相应聚合。
3. 将检查器接入 CI：如果最新 agent 运行上的 block 严重度规则失败，则构建失败。
4. 为每条规则添加"过期"字段。90 天无检查失败后，规则进入审查。
5. 找到一个真实的 `AGENTS.md` 并将其重写为五类别规则。它的多少行是可操作的？多少是愿望式的？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Operational rule | "真实指令" | 工作台可以在运行时检查的规则 |
| Aspirational rule | "小心" | 无检查的规则；要么删除要么升级 |
| Definition of done | "验收" | 任务完成的客观、文件支持的证明 |
| Block severity | "硬规则" | 违规停止运行；无操作员不能静默 |
| Rule expiry | "陈旧规则清理" | N 天无失败的规则进入退役 |

## 延伸阅读

- [OpenAI Agents SDK 护栏](https://platform.openai.com/docs/guides/agents-sdk/guardrails)
- [LangGraph 中断](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/breakpoints/)
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Rick Hightower, Agent RuleZ: A Deterministic Policy Engine](https://medium.com/@richardhightower/agent-rulez-a-deterministic-policy-engine-for-ai-coding-agents-9489e0561edf) —— 生产中的 block/warn/info 严重度
- [Cloudflare, Orchestrating AI Code Review at Scale](https://blog.cloudflare.com/ai-code-review/) —— 131k 审查运行，规则组合教训
- [microservices.io, GenAI development platform — part 1: guardrails](https://microservices.io/post/architecture/2026/03/09/genai-development-platform-part-1-development-guardrails.html) —— 规则与 CI 之间的纵深防御
- [Type-Checked Compliance: Deterministic Guardrails (arXiv 2604.01483)](https://arxiv.org/pdf/2604.01483) —— Lean 4 作为规则即检查的上界
- [logi-cmd/agent-guardrails](https://github.com/logi-cmd/agent-guardrails) —— 合并门实现：范围、变异测试、违规预算
- 第 14 阶段 · 32 —— 此规则集放入的最小工作台
- 第 14 阶段 · 38 —— 消费规则报告的验证门控
- 第 14 阶段 · 39 —— 评分规则合规性的审查者 agent