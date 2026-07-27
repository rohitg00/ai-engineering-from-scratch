# 将指令作为可执行约束

> 以散文形式写成的指令是愿望。以约束形式写成的指令是测试。工作台将每一条规则变成代理可以在运行时检查、审查者可以在事后验证的东西。

**类型：** 构建  
**语言：** Python（标准库）  
**前置条件：** 阶段 14 · 32（最小工作台）  
**时长：** ~50 分钟

## 学习目标

- 将路由散文与操作规则分离。
- 将启动规则、禁止行为、完成的定义、不确定性处理以及审批边界，表达为机器可检查的约束。
- 实现一个规则检查器，根据规则集对一次运行进行评分。
- 使规则集便于 diff，以便审查可以看到变更内容。

## 问题

一个典型的 `AGENTS.md` 读起来像上岗培训文档。它告诉代理"要小心"、"充分测试"、"不确定时要问"。三天后，代理提交了一个没有测试的变更，写入了被禁止的目录，而且从未提问，因为它从来不知道边界在哪里。

指令在可操作时才有力量，在空泛时则很脆弱。解决方法是编写工作台可以解释、审查者可以评分的规则。

## 概念

规则放在 `docs/agent-rules.md` 中，远离短小的根路由文件。每条规则都有一个名称、一个类别和一个检查。

```mermaid
flowchart LR
  Router[AGENTS.md] --> Rules[docs/agent-rules.md]
  Rules --> Checker[rule_checker.py]
  Checker --> Report[rule_report.json]
  Report --> Reviewer[Reviewer]
```

### 覆盖大多数规则的五个类别

| 类别 | 规则回答的问题 | 示例 |
|----------|---------------------------|---------|
| 启动（Startup） | 工作开始前必须满足什么条件？ | "状态文件存在且是最新的" |
| 禁止（Forbidden） | 什么绝对不能发生？ | "不要编辑 `scripts/release.sh`" |
| 完成的定义（Definition of done） | 什么证明任务已完成？ | "pytest 退出码为 0 且验收线通过" |
| 不确定性（Uncertainty） | 代理不确定时该怎么做？ | "提出问题笔记而不是猜测" |
| 审批（Approval） | 什么需要人工审批？ | "任何新依赖项，任何生产写入操作" |

一条规则如果不属于这五类中的任何一类，通常意味着它应该拆分成两条规则。强行拆分。

### 规则是机器可读的

每条规则有一个标识符（slug）、一个类别、一行描述和一个 `check` 字段，该字段指向 `rule_checker.py` 中的一个函数名。添加一条规则意味着添加一个检查；检查器随着工作台一同成长。

### 规则对 diff 友好

规则以每条一个标题的形式存在于单个 Markdown 文件中。重命名在 diff 中可见。新规则放在其类别的最前面。过时的规则被删除而非注释掉，因为工作台才是真相的来源，而不是团队上一季度感受的聊天记录。

### 规则与框架护栏

框架护栏（OpenAI Agents SDK 护栏、LangGraph 中断）在运行时层面执行规则。本课中的规则集是人类可读、可审查的契约，这些护栏正是实现了该契约。两者都需要：运行时在一次轮次中捕获违规行为，规则集则证明运行时在做正确的事。

### 渐进式呈现：一张地图，而非一部百科全书

`AGENTS.md` 不断增长的原因是每次事故都会增加一条规则，而没有事故会移除一条规则。一年后，文件变成了两千行，代理只读了第一屏，注意力预算耗尽，只执行了被告知内容的一小部分。一个巨型指令文件失败的原因与一本四十页的上岗培训文档一样：读者匆匆浏览一遍，再也不会回到那句重要的话上。

解决方法不是更短的文件，而是分层文件。根路由文件保持足够短小，每次会话都能读完，并且只包含指针。深度内容放在主题文件中，代理只在任务涉及时才加载。给代理一张地图，而不是整部百科全书，让它自己走到需要的页面。

```
AGENTS.md                  # 路由文件，< 50 行：这个仓库是什么、去哪里查找、5 条硬规则
docs/
  agent-rules.md           # 完整的规则集（本课内容）
  architecture.md          # 当任务涉及模块边界时加载
  testing.md               # 当任务编写或运行测试时加载
  deploy.md                # 仅用于发布工作，受审批规则门控
feature_list.json          # 待办事项列表（阶段 14 · 36）
```

| 层级 | 存放位置 | 何时读取 | 大小预算 |
|------|----------|-----------|-------------|
| 路由 | `AGENTS.md` | 每次会话，始终读取 | 不超过 ~50 行 |
| 规则 | `docs/agent-rules.md` | 每次会话，启动时读取 | 每个类别一屏 |
| 主题文档 | `docs/<topic>.md` | 仅在任务涉及该主题时读取 | 按需深入 |

两个测试保持分层的诚实性。**可达性测试**：代理最多两次跳转就能从路由文件到达任何一条规则，因此路由文件必须通过路径链接每个主题文档，而不是用散文描述它。**新鲜度测试**：路由文件足够短，审查者在每个 PR 中都会重新阅读它，这是阻止它悄悄重新长回那本被取代的百科全书的唯一方法。一个不再指向目标的指针比一条缺失的规则更糟糕，因此路由文件中的断链本身就是一个启动检查违规。

## 构建

`code/main.py` 提供：

- `agent-rules.md` 解析器，将规则加载到数据类中。
- `rule_checker.py` 风格检查函数，每个对应一个 `check` 引用。
- 一个违反了两条规则的演示代理运行，以及一个捕获这些违规的检查过程。

运行：

```
python3 code/main.py
```

输出：解析后的规则集、运行跟踪、每条规则的通过/失败结果，以及保存在脚本旁边的 `rule_report.json`。

## 生产实践中的模式

有三种模式能让一个规则集持续一个季度，而不是在一周内失效。

**编写时标记严重级别。** 每条规则带有 `severity`：`block`（阻塞）、`warn`（警告）或 `info`（信息）。检查器报告所有三个级别；运行时仅在 `block` 级别上拒绝执行。大多数团队早期会夸大严重级别，然后在截止日期压力下悄悄调低；编写时标记迫使你在前期就校准好。与验证门（阶段 14 · 38）配合使用，该门会将任何对 `block` 规则的覆盖签署到 `overrides.jsonl` 审计日志中。

**规则过期作为强制机制。** 每条规则带有一个 `expires_at` 日期（默认从创建起 90 天）。当一条未过期的规则连续 60 天没有任何违规时，检查器发出警告；下一次季度审查要么证明保留它的合理性，将其降级为 `info`，要么删除它。Cloudflare 的 AI 代码审查生产数据（2026 年 4 月，30 天内跨 5,169 个仓库的 131,246 次审查运行）显示，具有明确过期机制的规则集每个仓库保持在 30 条规则以下；而没有过期机制的规则集增长到 80 条以上，且大多数从未触发过。

**Markdown 作为源，JSON 作为缓存。** `agent-rules.md` 是作者编辑的文件；`agent-rules.lock.json` 是检查器在热路径中读取的缓存。锁定文件由 pre-commit 钩子重新生成。Markdown 的 diff 是可审查的；JSON 解析不占用每次轮次的执行时间。与 `package.json` / `package-lock.json` 和 `Cargo.toml` / `Cargo.lock` 的形式相同。

## 使用

在生产中：

- Claude Code、Codex、Cursor 在会话开始时读取规则，并在拒绝操作时引用它们。检查器在 CI 中重新运行以捕获静默漂移。
- OpenAI Agents SDK 护栏将相同的检查注册为输入和输出护栏。Markdown 是文档界面；SDK 是运行时界面。
- LangGraph 中断在运行中的节点违反规则时触发。中断处理器读取规则，询问人工，然后继续执行。

规则集在这三者之间是可移植的，因为它仅仅是 Markdown 加上函数名。

## 交付

`outputs/skill-rule-set-builder.md` 让项目负责人接受访谈，将现有的散文式指令分类到五个类别中，并输出一个带版本号的 `agent-rules.md` 以及一个检查器存根。

## 练习

1. 如果你的产品确实需要，添加第六个类别。论证为什么它不能归入现有的五个类别之一。
2. 扩展检查器，使每条规则可以带有严重级别（`block`、`warn`、`info`），并且报告相应地进行汇总。
3. 将检查器接入 CI：如果阻塞级别的规则在最近的代理运行中失败，则构建失败。
4. 为每条规则添加"过期"字段。如果 90 天内没有检查失败，该规则进入待审查状态。
5. 找一个真实的 `AGENTS.md`，将其重写为五个类别的规则。其中有多少行是可操作的？有多少行是空泛的？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 操作规则（Operational rule） | "一个真正的指令" | 工作台可以在运行时检查的规则 |
| 空泛规则（Aspirational rule） | "要小心" | 没有检查的规则；要么删除，要么升级 |
| 完成的定义（Definition of done） | "验收" | 一个客观的、有文件支持的证明，表明任务已完成 |
| 阻塞级别（Block severity） | "硬规则" | 违规则运行停止；没有操作员干预无法静默 |
| 规则过期（Rule expiry） | "过时规则清理" | 在 N 天内没有违规的规则进入待退休状态 |

## 延伸阅读

- [OpenAI Agents SDK guardrails](https://platform.openai.com/docs/guides/agents-sdk/guardrails)
- [LangGraph interrupts](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/breakpoints/)
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Rick Hightower, Agent RuleZ: A Deterministic Policy Engine](https://medium.com/@richardhightower/agent-rulez-a-deterministic-policy-engine-for-ai-coding-agents-9489e0561edf) — 阻塞/警告/信息严重级别的生产实践
- [Cloudflare, Orchestrating AI Code Review at Scale](https://blog.cloudflare.com/ai-code-review/) — 131k 次审查运行，规则组合的经验教训
- [microservices.io, GenAI development platform — part 1: guardrails](https://microservices.io/post/architecture/2026/03/09/genai-development-platform-part-1-development-guardrails.html) — 规则与 CI 之间的纵深防御
- [Type-Checked Compliance: Deterministic Guardrails (arXiv 2604.01483)](https://arxiv.org/pdf/2604.01483) — Lean 4 作为规则即检查的上限
- [logi-cmd/agent-guardrails](https://github.com/logi-cmd/agent-guardrails) — 合并门控实现：范围、变异测试、违规预算
- 阶段 14 · 32 — 本规则集所依赖的最小工作台
- 阶段 14 · 38 — 消费规则报告的验证门
- 阶段 14 · 39 — 对规则合规性进行评分的审查代理
