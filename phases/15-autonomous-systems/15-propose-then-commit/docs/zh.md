# 人工确认：先提案、再提交（Human-in-the-Loop: Propose-Then-Commit）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2026 年关于 HITL（human-in-the-loop，人工确认）的共识是非常具体的。它不是「agent 问一句、用户点 Approve」。它是 propose-then-commit（先提案、再提交）：把待执行的动作以幂等键写入一个可持久化的存储；连同 intent（意图）、data lineage（数据血缘）、所触及的权限、blast radius（影响半径）、回滚方案一起呈现给 reviewer（审核者，首次括注 验证器）；只有在收到明确确认之后才提交；执行完毕后再做一次验证，确认副作用真的发生了。LangGraph 的 `interrupt()` + PostgreSQL checkpointing、Microsoft Agent Framework 的 `RequestInfoEvent`、Cloudflare 的 `waitForApproval()`，本质上都是同一个形状。最经典的失效模式叫 rubber-stamp approval（橡皮图章式批准）：用户没看就点了 Approve。文档化的缓解手段是 challenge-and-response（挑战-回应）——配一份明确的检查清单。

**Type:** Learn
**Languages:** Python (stdlib, propose-then-commit state machine with idempotency)
**Prerequisites:** Phase 15 · 12 (Durable execution), Phase 15 · 14 (Tripwires)
**Time:** ~60 minutes

## 问题（The Problem）

agent 要执行一个动作。用户得做决定：批准还是不批准。如果决定是瞬间下的，那它大概率不算审核。如果决定是结构化的，那它会慢，但可信。工程上的问题是：怎么让结构化审核成为阻力最小的那条路。

2023 年那一代的 HITL 模式是同步弹窗：「agent 要给 X 发邮件，正文是 Y——批准吗？」用户点 Approve。所有人都觉得系统很安全。实践里这种界面被严重橡皮图章化了：用户批得飞快，批准本身预测不了什么，等 agent 真出事时，审计日志里只剩一长串用户根本想不起来的批准记录。

2026 年的模式——propose-then-commit——把 HITL 搬到一个可持久化的底座之上、附加结构化的元数据、并且要求一次明确的提交动作。每一个 managed agent SDK 都内置了一份实现：LangGraph `interrupt()`、Microsoft Agent Framework `RequestInfoEvent`、Cloudflare `waitForApproval()`。API 名字不一样，形状是一样的。

## 概念（The Concept）

### propose-then-commit 状态机（The propose-then-commit state machine）

1. **Propose（提案）。** agent 产出一个待执行的动作。写入持久化存储（PostgreSQL、Redis、Durable Object）。内容包括：
   - intent（agent 为什么要做这件事）
   - data lineage（哪一份源头数据导致了这个提案）
   - permissions touched（涉及哪些 scope / 文件 / endpoint）
   - blast radius（最坏情况是什么）
   - rollback plan（如果提交了，怎么撤销）
   - 幂等键（每个提案唯一；重复提交返回同一条记录）
2. **Surface（呈现）。** reviewer 看到完整元数据下的提案。reviewer 是人（不是 agent 自审）。
3. **Commit（提交）。** 收到明确确认，动作执行。
4. **Verify（验证）。** 执行之后，回读副作用确认结果。如果验证步骤失败，系统就处于一个已知的坏状态，告警随之触发。

### 幂等键（The idempotency key）

没有幂等键，瞬时故障后的重试可能让一个已批准的动作执行两次。一个具体例子：用户批准「从 A 转 100 美元到 B」。网络抖了一下。工作流重试。用户只批了一次，但转账执行了两次。幂等键把这次批准绑定到一个唯一的副作用上；第二次执行就是 no-op（空操作）。

这就是 Stripe 和 AWS API 用的同一个 idempotency 模式。把它复用到 agent 批准上，Microsoft Agent Framework 的文档里写得很明白。

### 持久性：批准为什么要比进程活得更久（Durability: why approvals outlast processes）

「等待批准」这间候车室是一份 agent 自己不持有的状态。工作流被挂起（见 Lesson 12）。批准送达时，工作流要从那一点上精确恢复。这就是为什么 LangGraph 把 `interrupt()` 配的是 PostgreSQL checkpointing 而不仅仅是内存状态——两天后才到的批准，依然能找到完好的工作流。

### 橡皮图章批准与 challenge-and-response 缓解（Rubber-stamp approvals and the challenge-and-response mitigation）

HITL 的默认 UI（「Approve」/「Reject」按钮）会催生没有真正审核的快速批准。文档里的缓解手段是：一份 challenge-and-response 的检查清单，要求对若干具体问题给出肯定回答之后，Approve 按钮才被点亮。具体形状：

- "Do you understand what resource this touches? [ ]"
- "Have you verified the blast radius is acceptable? [ ]"
- "Do you have a rollback plan if this fails? [ ]"

不是为了官僚而官僚——是一种强制函数。勾不上这些框的 reviewer，要么追问澄清（升级），要么拒绝（安全的默认值）。Anthropic 的 agent-safety 研究里明确把 checklist 驱动的 HITL 列为对橡皮图章式批准模式的一种缓解。

### 什么算「有后果」（What counts as consequential）

不是每个动作都需要 propose-then-commit。2026 年的指南：

- **有后果的动作（始终 HITL）**：不可逆写入、金融交易、对外通信、生产数据库变更、有破坏性的文件系统操作。
- **可逆动作（有时 HITL）**：本地文件编辑、staging 环境变更、有清晰回滚路径的可逆写入。
- **读与查（永不 HITL）**：读文件、列资源、调只读 API。

### 执行后验证（Post-action verification）

「commit 跑完了」不等于「副作用真的发生了」。网络分区和竞态条件可能让工作流自以为成功、而后端其实没落库。verify 这一步要在 commit 之后回读目标资源做一次确认。这与数据库事务里的 `RETURNING` 子句、或者 AWS 在 `PutObject` 之后再 `GetObject`，是同一个模式。

### EU AI Act 第 14 条（EU AI Act Article 14）

EU AI Act 第 14 条要求高风险 AI 系统具备有效的人类监督。「有效」不是装饰。监管语言明确把橡皮图章式模式排除在外。带 challenge-and-response 的 propose-then-commit 是 Microsoft Agent Governance Toolkit 合规文档里通过 Article 14 审视的形状。

## 用起来（Use It）

`code/main.py` 用 stdlib Python 实现了一个 propose-then-commit 状态机。持久化存储是一个 JSON 文件。幂等键是 (thread_id, action_signature) 的哈希。驱动程序模拟了三种场景：一次干净的批准流程、一次瞬时故障后的重试（不能重复执行）、以及一次橡皮图章默认值与 challenge-and-response 流程的对比。

## 上线部署（Ship It）

`outputs/skill-hitl-design.md` 会按 propose-then-commit 形状对一个待评审的 HITL 工作流做检查，并标出缺失的元数据、idempotency、验证或 challenge-and-response 层。

## 练习（Exercises）

1. 跑 `code/main.py`。确认对一个已批准提案的重试会用上持久化记录、不会再次执行。然后把幂等键改成包含时间戳，展示重试会重复执行。

2. 给提案记录加一个 `rollback` 字段。模拟一次执行，让验证步骤失败。展示回滚被自动触发。

3. 读一遍 Microsoft Agent Framework 的 `RequestInfoEvent` 文档。找出 API 包含、而玩具引擎里缺失的一个元数据字段。把它加上，并解释它防的是什么风险。

4. 为某个具体动作（比如「向公开的 Twitter 账户发推」）设计一份 challenge-and-response 检查清单。reviewer 必须回答哪三个问题？为什么是这三个？

5. 找一个用同步「Approve?」弹窗就够了的场景（不需要持久化存储）。解释为什么够，并指出你正在接受的那一类风险是什么。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|---|---|---|
| Propose-then-commit | "Two-phase approval" | Persisted proposal + positive commit + verify |
| Idempotency key | "Retry-safe token" | Unique per proposal; second execution no-ops |
| Data lineage | "Where it came from" | The specific source content that led to the proposal |
| Blast radius | "Worst case" | Scope of effect if the action goes wrong |
| Rubber-stamp | "Fast approval" | "Approve" clicked without genuine review |
| Challenge-and-response | "Forcing checklist" | Reviewer must positively acknowledge specific questions |
| RequestInfoEvent | "MS Agent Framework primitive" | Durable HITL request with structured metadata |
| `interrupt()` / `waitForApproval()` | "Framework primitives" | LangGraph / Cloudflare equivalents of the same shape |

## 延伸阅读（Further Reading）

- [Microsoft Agent Framework — Human in the loop](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — `RequestInfoEvent`、可持久化的批准。
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) — `waitForApproval()` 与 Durable Objects。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 把 HITL 当作长链路风险的缓解手段。
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) — 高风险系统的监管基线。
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — 围绕监督的宪法式框架。
