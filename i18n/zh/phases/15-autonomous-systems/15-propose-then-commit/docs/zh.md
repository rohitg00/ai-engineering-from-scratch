# 人在回路：先提议后提交（Propose-Then-Commit）

> 2026 年对 HITL（人在回路）的共识非常具体。它不是“代理提问，用户点击 Approve”。而是先提议后提交：提议的动作被持久化到持久化存储中并附带幂等键；呈现给审查者时附带意图、数据血缘、涉及的权限、影响范围（blast radius）和回滚计划；只有在得到明确确认后才提交；执行后进行验证，确认副作用确实发生了。LangGraph 的 `interrupt()` 加上 PostgreSQL 检查点、Microsoft Agent Framework 的 `RequestInfoEvent`，以及 Cloudflare 的 `waitForApproval()` 都实现了同一形态。典型的失败模式是走过场式批准（rubber-stamp approval）：不经过审查就点击 "Approve?"。有据可查的缓解手段是带明确清单的质询-应答机制。

**Type:** Learn
**Languages:** Python（标准库，带幂等性的先提议后提交状态机）
**Prerequisites:** Phase 15 · 12（持久化执行）、Phase 15 · 14（Tripwires）
**Time:** 约 60 分钟

## 问题所在

代理执行一个动作。用户必须决定：批准与否。如果决策是瞬间的，那它大概算不上审查。如果决策是结构化的，它就慢但可信。工程问题在于：如何让结构化审查成为阻力最小的路径。

2023 年代的 HITL 模式是一个同步提示："代理想向 X 发送正文为 Y 的邮件——批准吗？"用户点击 Approve。所有人都觉得系统是安全的。实际上这个界面被大量走过场式批准：用户批准得很快，批准几乎不能预测什么，而当代理出错时，审计日志里是一长串用户根本记不起来的批准记录。

2026 年的模式——先提议后提交——把 HITL 搬到持久化基底上，附加结构化元数据，并要求明确的提交动作。每个受管理的代理 SDK 都提供了某个版本：LangGraph `interrupt()`、Microsoft Agent Framework `RequestInfoEvent`、Cloudflare `waitForApproval()`。API 名称各不相同；形态是一样的。

## 核心概念

### 先提议后提交的状态机

1. **提议（Propose）。** 代理产出一个提议的动作。持久化到持久化存储（PostgreSQL、Redis、Durable Object）。包括：
   - 意图（代理为什么要做这件事）
   - 数据血缘（什么来源导致了这个提议）
   - 涉及的权限（哪些 scope / 文件 / 端点）
   - 影响范围（最坏情况是什么）
   - 回滚计划（如果已提交，如何撤销）
   - 幂等键（每个提议唯一；重复提交返回同一条记录）
2. **呈现（Surface）。** 审查者看到带有全部元数据的提议。审查者是人（不是代理自己审查自己）。
3. **提交（Commit）。** 明确的确认。动作执行。
4. **验证（Verify）。** 执行后，读回副作用并确认。如果验证步骤失败，系统处于已知的坏状态，并触发告警。

### 幂等键

没有幂等键，瞬时故障后的重试可能导致一个已批准的动作被执行两次。具体例子：用户批准"从 A 向 B 转账 $100"。网络抖动。工作流重试。用户只批准了一次，但转账执行了两次。幂等键把批准绑定到一个唯一、单一的副作用上；第二次执行是空操作（no-op）。

这与 Stripe 和 AWS API 使用的幂等模式相同。Microsoft Agent Framework 文档明确指出将其复用于代理批准。

### 持久性：为什么批准比进程存活更久

批准等待室是一份代理不拥有的状态。工作流处于暂停状态（第 12 课）。当批准到达时，工作流从确切的那个点恢复。这正是 LangGraph 把 `interrupt()` 与 PostgreSQL 检查点配对、而不仅仅依赖内存状态的原因——两天后的批准依然能找到完好无损的工作流。

### 走过场式批准与质询-应答缓解手段

HITL 的默认 UI（"Approve" / "Reject" 按钮）产生了没有真正审查的快速批准。有据可查的缓解手段：一个质询-应答清单，要求在 Approve 按钮启用之前对具体问题给出肯定的回答。具体形态：

- "你是否理解这会触及什么资源？[ ]"
- "你是否已确认影响范围是可接受的？[ ]"
- "如果失败，你是否有回滚计划？[ ]"

这不是为流程而流程——这是一种强制机制。无法勾选这些框的审查者要么请求澄清（升级），要么拒绝（安全的默认行为）。Anthropic 的代理安全研究明确将清单驱动的 HITL 列为针对走过场式批准模式的缓解手段。

### 什么算重大动作

并非每个动作都需要先提议后提交。2026 年的指导原则：

- **重大动作**（始终 HITL）：不可逆的写入、金融交易、对外通信、生产数据库变更、破坏性文件系统操作。
- **可逆动作**（有时 HITL）：编辑本地文件、staging 环境变更、有明确回滚的可逆写入。
- **读取与检查**（从不 HITL）：读取文件、列出资源、调用只读 API。

### 动作后验证

"提交已运行"不等于"副作用已发生"。网络分区和竞态条件可能产生一个自认为成功而后端并未持久化的工作流。验证步骤在提交后重新读取目标资源以进行确认。这与数据库事务中使用 `RETURNING` 子句或 AWS 在 `PutObject` 后进行 `GetObject` 的模式相同。

### EU AI Act 第 14 条

第 14 条要求对欧盟的高风险 AI 系统进行有效的人类监督。"有效"不是装饰性的。监管措辞明确排除了走过场式的模式。根据 Microsoft Agent Governance Toolkit 合规文档，带质询-应答的先提议后提交是能够经受住第 14 条审查的形态。

```figure
mx-propose-then-commit
```

## 使用它

`code/main.py` 用标准库 Python 实现了一个先提议后提交的状态机。持久化存储是一个 JSON 文件。幂等键是 (thread_id, action_signature) 的哈希。驱动程序模拟三种情况：一次干净的批准流程、瞬时故障后的重试（必须不能重复执行），以及走过场式默认行为与质询-应答流程的对比。

## 上线它

`outputs/skill-hitl-design.md` 审查提议的 HITL 工作流是否具备先提议后提交形态，并标记缺失的元数据、幂等、验证或质询-应答层。

## 练习

1. 运行 `code/main.py`。确认对已批准提议的重试使用了持久化记录，并且不会重新执行。现在把幂等键改为包含时间戳，并展示重试导致重复执行。

2. 为提议记录扩展一个 `rollback` 字段。模拟一次验证步骤失败的执行。展示回滚自动触发。

3. 阅读 Microsoft Agent Framework 的 `RequestInfoEvent` 文档。找出 API 包含而玩具引擎缺少的一个元数据字段。添加它，并解释它能防范什么。

4. 为一个具体动作设计质询-应答清单（例如"发布到公开的 Twitter 账号"）。审查者必须回答哪三个问题？为什么是这三个？

5. 找出一个同步"批准吗？"提示就足够的场景（不需要持久化存储）。解释原因，并说明你正在接受的风险类别。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|---|---|---|
| 先提议后提交 | "两阶段批准" | 持久化的提议 + 明确提交 + 验证 |
| 幂等键 | "重试安全令牌" | 每个提议唯一；第二次执行为空操作 |
| 数据血缘 | "它从哪来" | 导致该提议的具体来源内容 |
| 影响范围 | "最坏情况" | 动作出错时的影响范围 |
| 走过场式批准 | "快速批准" | 未做真正审查就点击 "Approve" |
| 质询-应答 | "强制清单" | 审查者必须对具体问题给出肯定确认 |
| RequestInfoEvent | "MS Agent Framework 原语" | 带结构化元数据的持久化 HITL 请求 |
| `interrupt()` / `waitForApproval()` | "框架原语" | LangGraph / Cloudflare 中同一形态的等价物 |

## 延伸阅读

- [Microsoft Agent Framework — Human in the loop](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — `RequestInfoEvent`、持久化批准。
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) — `waitForApproval()` 与 Durable Objects。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — HITL 作为长周期风险的缓解手段。
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) — 高风险系统的监管基线。
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — 围绕监督的宪法性框架。