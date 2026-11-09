# 检查点和回车

> 图形状态的每一个转变都持续. 工人车时,租期限会过期, 云耐用物体保持状态数小时或数周. 建议后承诺 (课 15) 定义每项行动的反弹计划. 后行动验证结束了循环. 根据欧盟人工智能法第14条,高风险系统必须有有效的人类监督. 严重故障模式:没有无效密钥和先决条件检查,过渡故障后再次尝试可以双重执行已经批准的操作. 行动后的验证是发现的.

**Type:** Learn
**Languages:** Python (stdlib, checkpoint and rollback state machine), TypeScript
**Prerequisites:** Phase 15 · 12 (Durable execution), Phase 15 · 15 (Propose-then-commit)
**Time:** ~60 minutes

## 问题

持续执行 (课 12) 使一个失败的代理重新启动.提出然后承诺 (课 15) 使一个批准的行动可审计. 这一课加入他们:如果一个批准的行动部分执行,崩,并恢复,会发生什么?什么时候反弹运行,和什么状态?

实际系统的方法是不同的:

- **LangGraph**在每次转移到PostgreSQL的时间内,租合同会被释放,另一个工人在最后的检查点恢复.`interrupt()`现在,我们已经知道,
- **Cloudflare Durable Objects**按键状态保持几个小时或几周. 合并计算与批准行动的存储.
- **Microsoft Agent Framework**暴露`Checkpoint`工作流 API中的原始性;重播加上无能性涵盖重试.

在每种情况下,实际上有效的组合是:无效关键 (防止双重执行) +先决条件检查 (状态仍然是我们批准的) +后行动验证 (副作用实际发生) +验证失败的反转.

## 概念

### 每次过渡都持续

图形状态转型是从一个命名状态到另一个工作流动的任何步骤. 简单的实现只存在于特定的承诺点上;生产实现在每个转型上持续.成本 (一些额外的写作) 与可靠性增长相比较小 (重播到处都会降落,租恢复是精确的).

### 租回收

工人失败时,工作流程不会丢失;租 (即该工人执行这次运行的短暂声明) 简单地过期.另一个工人接到最新的检查点并恢复.租机制是让生产系统在运行中生存的,而不会失去飞行工作.

### 无能性加上先决条件

考虑一下:一个工作流程被批准以"转移"$100 from A to B when balance > $1000. "工作流已提交,执行中崩,然后恢复.如果只检查无效率密钥,然后执行恢复,转移运行一次 (正确).但考虑到在崩和恢复之间,A的余额通过不同的工作流程下降到500美元.无效率检查仍然通过;先决条件没有.没有先决条件检查,我们发送过账.

每个后果行动都需要:

- **Idempotency key**防止双重执行.
- **Precondition check**证实国家仍与批准的内容一致.

### 行动后的验证

实际验证重新读取目标状态并确认副作用实际发生.

- 数据库更新:`UPDATE ... RETURNING *`然后确认返回的行匹配的预期状态.
- 发送电子邮件:在发送后检查发送文件查询消息身份.
- 文件写:读取文件并将其加密.
- 接下来的应用程序`GET`目标资源.

如果验证失败,工作流程已知坏状态.

### 翻车计划

建议后承诺 (课 15) 的每一个后续行动都包含了反弹计划.

- **In-band rollback**直接扭转副作用 (`DELETE`之后`INSERT`现在`Send-correction-email`在发送后).
- **Compensating transaction**:一种新的行动,它可以消除原始的 (标准SAGA模式).
- **Out-of-band rollback**警报人类,暂停工作流程,离开坏状态进行调查.

没有反弹的行动需要在承诺时间上加强HITL (课题15挑战和反应).

### 欧盟人工智能法第14条 操作阅读

执行者将其运用为以下方式:

- 检查点可以由审计师查询.
- 轮反弹进行了练习 (至少一次进行了端到端测试).
- 审计轨迹存活着部署 (检查点后台不是短暂的).
- 失败的验证会被警报,而不是默默记录.

工作流程在执行中崩,恢复并完成副作用,而没有验证+反弹路径,不会经过第14条测试.

### 断故障模式:双执行模式

在这个领域最常见的生产事件:

1. 行动批准,无权关键 k.
2. 承诺开始,执行,返回200.
3. 在"承诺"状态持续之前,工作流失效.
4. 工作流程恢复;查看"批准但未承诺";重新执行.
5. 副作用两次发生.

减轻:在执行之前坚持"在飞行"的意图,使用无效密钥执行,然后仅在后操作验证成功后标记"承诺".如果操作执行和状态写失败,你知道要验证和 (如果必要) 重复执行.如果状态写成功和操作失败,你通过恢复路径检查和执行确切一次.

```figure
checkpoint-replay
```

## 用它

`code/main.py`驾驶员模拟四种情况:清洁运行,事故后重新尝试 (无效捕获),预先条件失败 (工作流失无需开火),验证失败 (滚动火灾).

## 运送它

`outputs/skill-rollback-rehearsal.md`设计一个拟议的工作流程的反弹试验,并对检查轨迹持续性进行检查.

## 运动

1. 跑步`code/main.py`检查四种情况, 确认一次性行动,

2. 修改"先标记完成,然后做"模式,以便状态在操作后写火灾. 重复崩情况.测量多次重复操作火灾.

3. 设计一个特定生产行动的反弹计划 (例如"将其转载到Slack频道"). 归类为带内,补偿或带外. 理由选择.

4. 确定每个状态转变. 标记每个状态转变的耐用性要求 (持续/不持续). 计算你目前没有持续的转变.

5. 复制反转测试:设计一个端到端测试,运行一个真正的工作流程,崩它,并确认反转路径的火灾.测试声称什么?

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| Checkpoint | "Save point" | Every graph-state transition persists to a durable store |
| Lease | "Worker claim" | Short-lived claim that a worker is executing a run; expires on crash |
| Precondition | "State gate" | Assertion that the state is still consistent with the approved action |
| Post-action verify | "Re-read check" | Confirm the side effect actually happened in the target system |
| In-band rollback | "Direct undo" | Reverse the side effect with the inverse operation |
| Compensating transaction | "SAGA undo" | A new action that neutralizes the original |
| Mark-as-done-first | "Status write order" | Persist the committed status before returning from commit |
| Article 14 | "EU AI Act human oversight" | Operational: queryable checkpoints, rehearsed rollbacks, auditable trail |

## 进一步阅读

- [Microsoft Agent Framework — Checkpointing and HITL](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop)检查点原始和租回收.
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) 作为状态基板的持久物体.
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/)监管基准.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy)可靠性框架长远工作流程.
- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) 克劳德代码程序工作流程形状.
