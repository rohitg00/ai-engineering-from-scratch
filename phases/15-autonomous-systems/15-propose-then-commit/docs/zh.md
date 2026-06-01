# 15 · 人在回路：先提议后提交

> 2026 年关于「人在回路（Human-in-the-Loop，HITL）」的共识非常具体。它不是「智能体询问、用户点击批准」，而是「先提议后提交（propose-then-commit）」：被提议的操作要带着「幂等键（idempotency key）」持久化到一个持久化存储中；以「意图（intent）」、「数据血缘（data lineage）」、所触及的权限、「影响半径（blast radius）」和「回滚计划（rollback plan）」呈现给审阅者；只有在得到肯定确认后才提交；并在执行后进行验证，确认副作用确实发生。LangGraph 的 `interrupt()` 加 PostgreSQL 检查点、Microsoft Agent Framework 的 `RequestInfoEvent`、以及 Cloudflare 的 `waitForApproval()` 实现的都是同一种形态。典型的失败模式是「橡皮图章式批准（rubber-stamp approval）」：未经审阅就点了「批准」。已被记录的缓解手段是带显式清单的「质询与应答（challenge-and-response）」。

**类型：** 学习
**语言：** Python（标准库，带幂等性的先提议后提交状态机）
**前置：** 阶段 15 · 12（持久化执行）、阶段 15 · 14（绊线机制）
**时长：** 约 60 分钟

## 问题所在

智能体执行一个操作。用户必须做出决定：批准还是不批准。如果这个决定是瞬间做出的，那它很可能算不上一次审阅。如果这个决定是结构化的，那它虽慢却可信。工程上的问题是：如何让「结构化审阅」成为阻力最小的那条路径。

2023 年代的 HITL 模式是一个同步提示：「智能体想给 X 发一封正文为 Y 的邮件——批准吗？」用户点击批准。所有人都觉得系统很安全。但实际上这个交互面被大量地橡皮图章化：用户批得很快，批准本身几乎没有预测价值，而当智能体出错时，审计轨迹中只会显示一长串用户根本想不起来的批准记录。

2026 年的模式——先提议后提交——把 HITL 搬到一个持久化的底层之上，附加结构化元数据，并要求显式的提交动作。每一个托管智能体 SDK 都提供了对应版本：LangGraph 的 `interrupt()`、Microsoft Agent Framework 的 `RequestInfoEvent`、Cloudflare 的 `waitForApproval()`。API 名称各不相同，形态却是一致的。

## 核心概念

### 先提议后提交状态机

1. **提议（Propose）。** 智能体产出一个被提议的操作。持久化到一个持久化存储中（PostgreSQL、Redis、Durable Object）。其中包含：
   - 意图（智能体为什么要这么做）
   - 数据血缘（是哪个来源促成了这次提议）
   - 所触及的权限（涉及哪些作用域 / 文件 / 端点）
   - 影响半径（最坏情况是什么）
   - 回滚计划（如果提交了，我们怎么撤销它）
   - 幂等键（每个提议唯一；重复提交会返回同一条记录）
2. **呈现（Surface）。** 审阅者看到带全部元数据的提议。审阅者是一个人（而不是智能体自己审自己）。
3. **提交（Commit）。** 肯定确认。操作被执行。
4. **验证（Verify）。** 执行之后，把副作用回读出来并加以确认。如果验证步骤失败，系统就处于一个已知的坏状态，告警随即触发。

### 幂等键

没有幂等键，瞬时故障后的一次重试就可能让一个已批准的操作被执行两次。具体例子：用户批准「从 A 向 B 转账 100 美元」。网络抖动。工作流重试。用户只批准过一次，转账却执行了两次。幂等键把这次批准绑定到单一、唯一的副作用上；第二次执行变成无操作（no-op）。

这与 Stripe 和 AWS API 使用的幂等模式是同一套。在 Microsoft Agent Framework 文档中，把它复用于智能体批准是被明确写出来的。

### 持久性：批准为什么要比进程活得更久

批准的「等候室」是一块智能体并不拥有的状态。工作流被暂停（第 12 课）。当批准到来时，工作流从恰好那个点恢复执行。这正是 LangGraph 把 `interrupt()` 与 PostgreSQL 检查点配对、而不是只靠内存状态的原因——两天之后才到来的批准，依然能找到一个完好无损的工作流。

### 橡皮图章式批准与质询应答缓解手段

HITL 的默认 UI（「批准」/「拒绝」按钮）会产出快速却毫无真实审阅的批准。已被记录的缓解手段：一份「质询与应答」清单，要求对具体问题给出肯定回答后，「批准」按钮才会被启用。具体形态：

- 「你是否理解这会触及什么资源？[ ]」
- 「你是否核实过影响半径是可接受的？[ ]」
- 「如果这件事失败了，你是否有回滚计划？[ ]」

这不是为流程而流程的官僚主义——而是一个「强制函数（forcing function）」。勾不上这些框的审阅者，要么去寻求澄清（升级处理），要么拒绝（安全默认）。Anthropic 的智能体安全研究明确把清单驱动的 HITL 列为橡皮图章式批准模式的一种缓解手段。

### 什么算「有后果」

并非每个操作都需要先提议后提交。2026 年的指引：

- **有后果的操作**（始终 HITL）：不可逆写入、金融交易、对外通信、生产数据库变更、破坏性的文件系统操作。
- **可逆的操作**（有时 HITL）：对本地文件的编辑、预发布（staging）环境变更、带清晰回滚的可逆写入。
- **读取与检视**（绝不 HITL）：读取文件、列举资源、调用只读 API。

### 操作后验证

「提交跑过了」不等于「副作用发生了」。网络分区和竞态条件可能造成这样一种工作流：它以为自己成功了，而后端其实并未持久化。验证步骤在提交后重新读取目标资源以确认。这与带 `RETURNING` 子句的数据库事务、或在 `PutObject` 之后再 `GetObject` 是同一种模式。

### 欧盟《AI 法案》第 14 条

第 14 条要求欧盟境内的高风险 AI 系统具备有效的人类监督。「有效」并非装饰性措辞。监管语言明确把橡皮图章式模式排除在外。在 Microsoft Agent Governance Toolkit 的合规文档中，带质询应答的先提议后提交，正是能经受住第 14 条审视的那种形态。

## 动手用一用

`code/main.py` 用标准库 Python 实现了一个先提议后提交状态机。持久化存储是一个 JSON 文件。幂等键是 (thread_id, action_signature) 的哈希。驱动程序模拟了三种情形：一次干净的批准流程、一次瞬时故障后的重试（绝不能重复执行）、以及橡皮图章式默认与质询应答式流程的对比。

## 交付出去

`outputs/skill-hitl-design.md` 会针对先提议后提交形态审查一个被提议的 HITL 工作流，并标记出缺失的元数据、幂等性、验证或质询应答层。

## 练习

1. 运行 `code/main.py`。确认对一个已批准提议的重试会使用持久化记录，且不会重新执行。现在把幂等键改为包含时间戳，并展示重试会导致重复执行。

2. 给提议记录扩展一个 `rollback` 字段。模拟一次验证步骤失败的执行。展示回滚被自动触发。

3. 阅读 Microsoft Agent Framework 的 `RequestInfoEvent` 文档。找出一个该 API 包含、而这个玩具引擎缺失的元数据字段。把它加进去，并解释它能防范什么。

4. 为某个具体操作（例如「发布到一个公开的 Twitter 账号」）设计一份质询应答清单。审阅者必须回答哪三个问题？为什么是这三个？

5. 选出一个同步「批准吗？」提示就足够（无需持久化存储）的场景。解释原因，并指出你正在接受哪一类风险。

## 关键术语

| 术语 | 人们的说法 | 它实际的含义 |
|---|---|---|
| 先提议后提交（Propose-then-commit） | 「两阶段批准」 | 持久化提议 + 肯定提交 + 验证 |
| 幂等键（Idempotency key） | 「重试安全令牌」 | 每个提议唯一；第二次执行变为无操作 |
| 数据血缘（Data lineage） | 「它从哪来」 | 促成该提议的那段具体来源内容 |
| 影响半径（Blast radius） | 「最坏情况」 | 操作出错时影响波及的范围 |
| 橡皮图章（Rubber-stamp） | 「快速批准」 | 未经真实审阅就点了「批准」 |
| 质询与应答（Challenge-and-response） | 「强制清单」 | 审阅者必须对具体问题做出肯定确认 |
| RequestInfoEvent | 「MS Agent Framework 原语」 | 带结构化元数据的持久化 HITL 请求 |
| `interrupt()` / `waitForApproval()` | 「框架原语」 | LangGraph / Cloudflare 中同一形态的等价物 |

## 延伸阅读

- [Microsoft Agent Framework — Human in the loop](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) —— `RequestInfoEvent`、持久化批准。
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) —— `waitForApproval()` 与 Durable Objects。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) —— HITL 作为长程风险的一种缓解手段。
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) —— 高风险系统的监管基线。
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) —— 围绕监督的宪法式框架。
