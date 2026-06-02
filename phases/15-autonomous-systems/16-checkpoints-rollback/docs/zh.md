# Checkpoint 与回滚（Checkpoints and Rollback）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 每一次图状态（graph-state）的转移都要落盘。当 worker 崩溃时，它持有的 lease 会过期，由另一个 worker 从最新的 checkpoint 接手。Cloudflare Durable Objects 可以把状态保存数小时甚至数周。Propose-then-commit（Lesson 15）为每个动作定义了回滚方案。动作执行后的 verification（验证）闭合了整个回路。EU AI Act 第 14 条对高风险系统强制要求「有效的人工监督」——在工程层面，这意味着 checkpoint 必须可查、回滚必须演练过、审计轨迹必须能扛住一次部署。最尖锐的失败模式是：如果没有 idempotency key（幂等键）和前置条件检查，瞬时故障后的一次重试就可能把已批准的动作执行两次。事后验证（post-action verification）就是用来抓住这种情况的。

**Type:** Learn
**Languages:** Python (stdlib, checkpoint and rollback state machine)
**Prerequisites:** Phase 15 · 12 (Durable execution), Phase 15 · 15 (Propose-then-commit)
**Time:** ~60 minutes

## 问题（The Problem）

Durable execution（Lesson 12）让崩溃后的 agent 可以恢复执行。Propose-then-commit（Lesson 15）让被批准的动作可被审计。这一课要把两者拼起来：当一个被批准的动作只执行了一半就崩溃、然后恢复时会发生什么？回滚什么时候跑、跑在什么状态之上？

真实系统对此有不同的接法：

- **LangGraph** 把每一次图状态转移都 checkpoint 到 PostgreSQL。worker 崩溃时，lease 释放，另一个 worker 从最新 checkpoint 恢复。工作流在 `interrupt()` 处暂停，这个暂停本身也会被持久化。
- **Cloudflare Durable Objects** 按 key 维度持有状态，跨小时甚至跨周都没问题。把计算和存储放在一起，正好服务于已批准的动作。
- **Microsoft Agent Framework** 在 workflow API 里暴露了 `Checkpoint` 原语；replay 加 idempotency 覆盖了重试场景。

不管哪种方案，真正能跑得住的组合都是：idempotency key（防止重复执行）+ 前置条件检查（状态依然是我们当初批准时的样子）+ 事后验证（副作用确实发生了）+ 验证失败时回滚。

## 概念（The Concept）

### 每一次转移都落盘

图状态转移就是工作流从一个有名状态进入另一个有名状态的任意一步。朴素实现只在特定的 commit 点持久化；生产实现则把每一次转移都落盘。代价（多几次写）相对收益（replay 可以从任意点恢复，lease 恢复也更精确）来说很小。

### Lease 恢复

worker 崩溃时，工作流并没有丢；只是它持有的 lease（一个短期的「这个 worker 正在执行这个 run」的声明）过期了。另一个 worker 拾起最新 checkpoint 继续往下走。lease 机制就是生产系统在 rolling deploy 期间不丢失在途任务的关键。

### 幂等加前置条件

光有幂等还不够。设想：一个工作流被批准的语义是「当余额 > $1000 时，从 A 向 B 转 $100」。工作流进入 commit、执行到一半崩溃、然后恢复。如果只检查 idempotency key，恢复后转账只跑一次（看起来对）。但若在崩溃和恢复之间，A 的余额因为另一条工作流跌到了 $500——idempotency 检查依然会通过，但前置条件不再成立。少了前置条件检查，我们就会发出一笔透支。

每一个有后果的动作都需要两样：

- **Idempotency key**：防止重复执行。
- **前置条件检查**：确认状态依然与批准时一致。

### 事后验证（Post-action verification）

「工具返回了 200」不算验证。真正的验证是回头去读目标状态，确认副作用确实发生了。常见模式：

- 数据库更新：`UPDATE ... RETURNING *`，然后断言返回的行就是预期状态。
- 发邮件：提交后，去已发送箱里按 message ID 查这封邮件。
- 写文件：把文件读回来并算 hash。
- API 调用：对目标资源做一次跟进的 `GET`。

如果验证失败，工作流就处在一个「已知坏」的状态。回滚启动。

### 回滚方案（Rollback plans）

Propose-then-commit（Lesson 15）里每个有后果的动作都带着一份回滚方案。类型：

- **In-band 回滚**：直接逆转副作用（`INSERT` 后 `DELETE`、发完邮件再发一封更正邮件）。
- **补偿事务**：一个新动作来抵消原动作（标准的 SAGA 模式）。
- **Out-of-band 回滚**：告警人、暂停工作流，把坏状态留在那里等人来查。

无可回滚（「这事我们撤不掉」）的 no-op 必须在 proposal 里讲清楚。这种动作要在 commit 时配更强的 HITL（human-in-the-loop，人工确认）（Lesson 15 challenge-and-response）。

### EU AI Act 第 14 条的工程化解读

第 14 条要求高风险系统具备「有效的人工监督」。落到工程上，实施者一般这么理解：

- Checkpoint 可被审计员查询。
- 回滚演练过（至少端到端跑通过一次）。
- 审计轨迹能扛过一次部署（checkpoint 后端不是临时性存储）。
- 失败的验证要触发告警，而不是默默写日志。

一个在 commit 中途崩溃、恢复后完成副作用、却没有 verify + rollback 通路的工作流，过不了第 14 条的检验。

### 最尖锐的失败模式：重复执行

这个领域最常见的生产事故：

1. 动作被批准，idempotency key 为 k。
2. Commit 开始、执行、返回 200。
3. 工作流在持久化「已 committed」状态前崩溃。
4. 工作流恢复；看到「已批准但未 committed」；再执行一次。
5. 副作用触发了两次。

缓解：执行前先持久化一个「in-flight」意向，带着 idempotency key 执行，然后**只在事后验证成功后**才标记「已 committed」。如果动作触发了但状态写失败，你知道得去验证、必要时再发一次；如果状态写成功了但动作失败了，你通过恢复路径去验证、然后恰好触发一次。

## 用起来（Use It）

`code/main.py` 实现了一个带 checkpoint、幂等、前置条件、验证和回滚的工作流。driver 模拟四种场景：干净跑通、崩溃后重试（幂等接住）、前置条件失败（工作流在不触发动作的情况下中止）、验证失败（回滚触发）。

## 上线部署（Ship It）

`outputs/skill-rollback-rehearsal.md` 为一个待上线的工作流设计回滚演练测试，并审计 checkpoint 后端的审计轨迹持久性。

## 练习（Exercises）

1. 运行 `code/main.py`。逐一验证四种场景。对于「commit 中途崩溃」的那一种，确认动作在多次重试后**恰好触发一次**。

2. 把「先标记完成，再去做」这个模式改成「状态写在动作之后」。再跑一次崩溃场景。数一数有多少重复动作被触发。

3. 给一个具体的生产动作（比如「往一个 Slack channel 发消息」）设计一份回滚方案。归类为 in-band、补偿、还是 out-of-band。说明理由。

4. 挑一个你熟悉的工作流。列出它的所有状态转移。给每一个标上一个持久化要求（要落盘 / 不落盘）。数一数当前**还没**落盘的有几个。

5. 演练型回滚测试：设计一个端到端测试，跑一个真实工作流、把它弄崩、确认回滚路径触发。这个测试该断言什么？

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际是什么 |
|---|---|---|
| Checkpoint | 「存档点」 | 每一次图状态转移都持久化到一个 durable 存储 |
| Lease | 「worker 占用」 | 短期的「该 worker 正在执行该 run」的声明；崩溃时过期 |
| 前置条件（Precondition） | 「状态闸门」 | 断言当前状态依然与已批准的动作一致 |
| 事后验证（Post-action verify） | 「回读检查」 | 确认副作用确实在目标系统里发生了 |
| In-band 回滚 | 「直接撤销」 | 用反向操作逆转副作用 |
| 补偿事务（Compensating transaction） | 「SAGA 撤销」 | 用一个新动作抵消原动作 |
| 先标记完成（Mark-as-done-first） | 「状态写顺序」 | 在 commit 返回前就持久化「已 committed」状态 |
| 第 14 条（Article 14） | 「EU AI Act 的人工监督」 | 工程化：可查 checkpoint、演练过的回滚、可审计的轨迹 |

## 延伸阅读（Further Reading）

- [Microsoft Agent Framework — Checkpointing and HITL](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — checkpoint 原语与 lease 恢复。
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) — 把 Durable Objects 当作状态底座。
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) — 监管侧的基线。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 长链路工作流的可靠性视角。
- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) — Claude Code Routines 的工作流形态。
