# 求婚的人:提出,然后承诺

> 关于HITL的2026年共识是具体的. 它不是"代理要求,用户点击批准". 它是提出-然后承诺:建议的行动是继续使用无权密钥的持久存储器;向审查者显示了意图,数据谱系,触摸的权限,爆炸半径和反弹计划;只有在积极的确认后进行;执行后验证以确认副作用实际发生. 长格拉夫的`interrupt()`另外,我们还可以使用微软代理框架的 PostgreSQL 检查点.`RequestInfoEvent`云的`waitForApproval()`标准的标准是: 通过"通过"的,没有审查的. 文件的减轻是挑战和反应,有明确的检查列表.

**Type:** Learn
**Languages:** Python (stdlib, propose-then-commit state machine with idempotency), TypeScript
**Prerequisites:** Phase 15 · 12 (Durable execution), Phase 15 · 14 (Tripwires)
**Time:** ~60 minutes

## 问题

经纪人采取行动.用户必须决定:批准或不批准.如果决定是即时的,它可能不是审查.如果决定是结构化的,它是缓慢的,但可信的.工程问题是如何使结构化的审查成为最少抵抗的道路.

2023年HITL模式是一个同步提示:"代理想发送电子邮件给X,体 Y 批准?"用户点击批准.每个人都觉得系统安全.实际上,这个表面很大程度上是纹:用户快速批准,批准预测很少,当代理错误时,审计轨迹显示了用户无法回忆的长期批准历史.

2026 模式 建议然后承诺 将HITL移动到一个耐用基板上,附加结构化元数据,并需要积极承诺.每个管理代理SDK发送一个版本:LangGraph `interrupt()`微软代理框架`RequestInfoEvent`云`waitForApproval()` API名称不同,形状不同.

## 概念

### 提出,然后承诺的国家机器

1. **Propose.**代理生成一个拟议的操作. 持续到一个持久的存储器 (PostgreSQL, Redis,持久的对象). 包括:
   - 意图 (为什么代理人这样做)
   - 数据系 (该提案的来源)
   - 触及的权限 (哪些范围 / 文件 / 终点)
   - 爆炸半径 (最坏情况是什么)
   - 倒退计划 (如果已实施,我们如何撤销它)
   - 无效关键 (每项提案均为独一无二;重新提交的记录相同)
2. **Surface.**审查者看到所有元数据的提案. 审查者是一个人 (而不是审查自己的代理人).
3. **Commit.**确认了,行动执行了.
4. **Verify.**执行后,副作用被检查并确认. 如果验证步骤失败,系统处于已知坏状态,并启动警报.

### 无能之钥匙

没有无效率关键,过渡失败后重试可以双重执行批准的操作.具体例子:用户批准"从A转移100美元到B".网络闪.工作流重试.用户一次批准,但转移执行两次.无效率关键将批准与单个独特的副作用联系在一起;第二次执行是无效.

对于代理批准,它被明确使用在微软代理框架文件中.

### 耐用性:为什么批准的过程过期

通过等待室是一个代理人不拥有的状态.工作流程被暂停 (课12).`interrupt()`通过 PostgreSQL 检查点,而不是仅仅在内存状态, 两天后的批准仍然发现工作流程完整.

### 印批准和挑战和响应减轻

默认的HITLUI ("批准" / "拒绝"按) 产生了快速的批准,没有真正的审查. 文档减轻:需要在批准按启用之前对特定问题作出积极答案的挑战和响应检查清单.

- "你知道这是什么资源吗?"
- "你是否确定爆炸半径是可接受的?"
- "如果这失败,你有没有反弹计划吗?"

没有官僚主义本身是一个强制性功能.不能点击框的评论员要么要求澄清 (升级) 或拒绝 (安全默认).人类代理安全研究明确引用了检查清单驱动的HITL作为印批准模式的减轻.

### 什么是重要的

没有任何行动都需要提出,然后承诺.

- **Consequential actions**无可逆的文件,金融交易,出口通信,生产数据库的变化,破坏性文件系统操作.
- **Reversible actions**(有时HITL):编辑本地文件,阶段化变化,可逆的写作,清晰的反转.
- **Reads and inspections**读取文件,列出资源,调用只读取API.

### 行动后的验证

"提交运行"与"副作用发生"不同.网络分区和比赛条件可以产生一个认为成功的工作流程,而后端没有持续.验证步骤在提交确认后重新阅读目标资源.这是与数据库交易相同的模式.`RETURNING`条款或 AWS `GetObject`之后`PutObject`现在,我们要去.

### 欧盟人工智能法第14条

根据第14条,在欧盟高风险人工智能系统的有效监督."有效"并非装饰性的.监管语言特别排除了印模式.提出,然后承诺,挑战和回应是微软代理管理工具包合规文件中保存的第14条审查的形状.

```figure
mx-propose-then-commit
```

## 用它

`code/main.py`执行一个建议然后执行状态机在 stdlib Python. 持久存储是一个 JSON 文件. 无效密钥是 (thread_id, action_signature) 的哈希. 驱动程序模拟了三个情况:清洁的批准流,过渡失败后的重试 (不得执行双重),以及印默认对挑战和响应流.

## 运送它

`outputs/skill-hitl-design.md`审查拟议的HITL工作流程,以提出后承诺的形式和缺少元数据,无权,验证或挑战和响应层的标志.

## 运动

1. 跑步`code/main.py`确认批准的提案的重试使用了持久记录,而不是重复执行. 现在更改无效键,包括时间印,并显示重试双重执行.

2. 延长提案记录`rollback`执行执行过程中验证步骤失败. 显示自动反弹.

3. 阅读微软代理框架的文章`RequestInfoEvent`文件. 识别一个元数据领域,API包括玩具机器缺失. 添加它并解释它保护什么.

4. 设计一个特定行动的挑战和答案检查清单 (例如"发布到公共Twitter帐户").评论员必须回答哪些三个问题?为什么这三个问题?

5. 选择一个同步的"批准"提示 (不需要持久的存储) 足够的情况.解释原因,并列出你接受的风险类别.

## 关键词

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

## 进一步阅读

- [Microsoft Agent Framework — Human in the loop](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) `RequestInfoEvent`经过长期的批准.
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) `waitForApproval()`它们是可靠的.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy)HITL作为缓解长远风险.
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/)高风险系统的监管基准.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) 关于监督的宪法框架.
