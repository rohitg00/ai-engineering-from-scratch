# 共同记忆和黑板图案

> 在2026年多代理系统中,存在两个方法:**message pool**(每个人都能看到每个人的信息,如在AutoGen GroupChat或MetaGPT)**blackboard with subscription**两个是多代理系统的唯一状态部分,这意味着两个都是有趣的错误居住的地方.参考故障模式是**memory poisoning**另一种方法是:一个代理人幻觉化一个"事实",其他代理人将其视为验证,准确性逐渐衰退,比即时崩更难进行调试.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## 问题

多代理系统需要一个代理分享事实的地方.一个字面上的选择是"通过信息",但这重新发明了共享状态,并增加了复制.另一个是"给每个人都提供全球日志",但全球日志会无限增长并很容易被毒害.第三个是"每代理的项目"可扩展但重于方案.

当一个代理人幻觉并写幻觉到共享状态时,每一个读到该状态的下游代理都会把幻觉作为事实.人类注意到的时候,推理链已经深入了五步,根源是有史以来第三个消息.调整多代理精度衰退比调整崩更难.

这是一种记忆中毒.这是MAST类别中第二大记录的失败家族 (Cemri等人, arXiv:2503.13657) ,它是结构性的:任何没有来源的共享记忆设计和不可编写的验证器最终将显示它.

## 概念

### 两个主要的拓物

**Full message pool.**每个代理都会阅读每一个消息.AutoGen GroupChat和MetaGPT都使用这种方法.简单,透明,可检查,但不会超过10个代理,因为每个代理的文本充满了其他代理的工作.

```
agent-A ──write──▶ ┌────────────────┐ ◀──read── agent-D
                   │ message pool   │
agent-B ──write──▶ │                │ ◀──read── agent-E
                   │ (global log)   │
agent-C ──write──▶ └────────────────┘ ◀──read── agent-F
```

**Blackboard with subscription.**代理人表示对主题的兴趣;基板路线只传递相关信息.CA-MCP (arXiv:2601.11595) 和矩阵分散框架 (arXiv:2511.21686) 使用此.进一步扩展,但需要先前的方案设计,使订阅有意义.

```
                   ┌─ topic: prices ──┐
agent-A ──pub────▶ │                  │ ──▶ agent-D (subscribed)
                   ├─ topic: orders ──┤
agent-B ──pub────▶ │                  │ ──▶ agent-E (subscribed)
                   ├─ topic: alerts ──┤
agent-C ──pub────▶ │                  │ ──▶ agent-F (subscribed)
                   └──────────────────┘
```

### 当每个人都赢得

- **Full pool**只有在代理人少 (<10),不均的情况下,谈话是短视线的.
- **Blackboard**通过线路调节节节省代码成本和环境污染.

生产系统通常混合:顶部有一个小的完整池 (规划层),下面是黑板 (工人层).

### 记忆中毒,在一个场景中

现在,我们有三名特工在研究任务上,A特工是检索特工,B特工是总结者,C特工是分析师.

1. 一个人拿到一个页面,然后写一个信息给共享状态:"研究报告了42%的准确性改善.
2. 收到的页面实际上说"4.2%的改善". 一个幻觉了一个十数.
3. 报告的准确度增加了42% (来源:A).
4. ,阅读共享状态,写道:"建议采用 42%升高是转型的.
5. 报告指出,这一数字从未存在过的42%.

没有任何代理毁,没有任何测试失败,系统"工作了",幻觉从一个代理的背景到每个下游代理的推理通过共享状态.

### 为什么这是结构性的

没有共享状态,A代理的幻觉仍然存在于A的背景下.下游代理会重新搜索或重新推导,可能会发现错误. 通过天真共享状态,A的背景成为每个人的背景,幻觉被洗成事实.

问题不是一个共享国家本身**without provenance and without an independent verifier**三个减轻措施解决了这一问题:

1. **Attribute provenance on every write.**根据什么提示,如果适用,代理引用哪个来源. 下游代理阅读怀疑,关键是来源.
2. **Version writes; treat them as append-only.**修改是取代旧的新条目,而不是现场更新.
3. **Keep at least one agent that cannot write to shared state.**一个只读的验证器代理采样输入,重新查找来源,并标记不一致性.它仍然读取池,因此可以被一个错误的输入所欺骗,但它会检查每个输入与原始的源头相比,并且无法写,因此它的判决从来没有把毒的事实重新传递到共享状态.

### 黑板先例 (海斯-罗思,1985年)

黑板模式比法师事务所代理人早了四十年. 哈伊斯-罗思 (1985,"控制的黑板架构") 描述了观察全球黑板的专业知识来源,贡献部分解决方案,并触发其他来源. 2026年黑板 (CA-MCP,矩阵) 与知识来源和部分解决方案的JSON片一样,具有LLM代理. 旧文献记录了写作争端,机会主义控制和一致性的解决方案,

### 投影与全景

纯黑板给每个用户提供相同的投影 (主题范围).**per-agent projection**根据LangGraph的状态减小器是2026年可行的实现.

没有一个,你在每个代理的提示中重建了临时投影.

### 写内容模式

许多代理人同时写作是一个同时问题,而不是仅仅是一个LLM问题.

- **Sequential writer (single producer).**所有的写作都通过一个编辑代理来进行序列化.
- **Optimistic concurrency with versioning.**每个条目都有版本;编写者失败于版本不匹配和重新尝试.
- **Topic partitioning.**不同的代理人拥有不同的主题,没有跨主题争端,需要设计的分区边界.

由于LLM电话速度足够慢,争端很少,瓶不会伤害.

### 无法写的验证器

最有效的减轻是仅可读的验证器.

- 验证者与团队分享状态 (阅读黑板或池).
- 验证器没有写字柄,只能将状态分享到单独的验证道.
- 验证者独立搜索在书中引用的来源.
- 验证器的输出被转移到人类或单独的决策代理,

没有这种分离,验证器的输出将成为池中的新输入,这意味着受毒的池中会毒害验证器,从而毒害其验证.

```figure
swarm-blackboard
```

## 建立它

`code/main.py`在Stlib Python中实现了两个拓,加上玩具毒害攻击和三种减轻.

- `MessagePool` 连接单独登录,全读取.
- `Blackboard`主题关键的酒吧/子酒店,每位代理订阅.
- `ProvenanceEntry`每一个写记录 (作者,时间标签, prompt_hash, source_uri).
- `PoisoningScenario`执行一个三位代理的研究任务,其中A位代理幻觉化一个十位数.
- `Verifier`只能读取的代理,重新查找来源并标记不一致. 运行相同的情况,验证器存在.

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

预期产量:
- 运行1 (没有验证器):幻的42%传播到最终报告.
- 运行2 (与验证器):验证器标记不一致性,池被标记为"标记",最终报告包括撤销.

## 用它

`outputs/skill-memory-auditor.md`通过多代理系统的共享内存设计来审核原产,版本化和验证器分离. 在生产前运行它在新的多代理架构上.

## 运送它

对于任何共享内存设计:

- 每次写的记录来源: `(writer, timestamp, prompt_hash, tool_calls_cited, source_uri)`现在,我们要去.
- 修改是指指新录取的录取.
- 部署至少一个具有独立源访问的仅读验证器.
- 路由验证器输出到单独的频道,而不是返回共享池中.
- 记录那些写作的比例是变异 一个增加的比例是幻觉模式的早期证据.

## 运动

1. 跑步`code/main.py`确认第一个运行传播幻觉,第二次运行捕捉.
2. 另外一个幻觉:B代理发明了一个数据集尺寸.验证器应该捕获两者,而不需要手动调整任何一个.
3. 转换整个池块为一个有主题分区的黑板 (`prices`现在`summaries`现在`analyses`问题是,在哪些情况下,分区更难解决,
4. 阅读Hayes-Roth (1985,"控制的黑板架构"). 鉴定2026年系统将受益于本课中未讨论的两个控制模式.
5. 读取CA-MCP (arXiv:2601.11595). 映射其共享文本存储器到 either MessagePool或黑板类中.`code/main.py`什么原始的CA-MCP添加到上面?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Message pool | "Shared chat history" | Append-only log that every agent reads. Full transparency, poor scaling. |
| Blackboard | "Shared workspace" | Topic-keyed pub/sub. Agents subscribe to relevant topics. Scales farther. |
| Provenance | "Who wrote what" | Metadata on each write: writer, timestamp, prompt, sources. |
| Memory poisoning | "Hallucinations spreading" | One agent's error enters shared state, downstream agents adopt it as fact. |
| Append-only | "No in-place updates" | Corrections are new entries that supersede. Preserves audit trail. |
| Unwritable verifier | "Independent auditor" | Read-only agent that re-fetches sources and flags inconsistencies. |
| Projection | "Scoped view" | Per-agent view computed from global state. LangGraph reducers are the canonical case. |
| Knowledge Source | "Specialist agent" | Hayes-Roth's 1985 term for a blackboard participant. |

## 进一步阅读

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) MAST类别;记忆中毒是一种协调失败子组
- [CA-MCP — Context-Aware Multi-Server MCP](https://arxiv.org/abs/2601.11595)共享MCP服务器的语境存储
- [Matrix — decentralized multi-agent framework](https://arxiv.org/abs/2511.21686)没有中央管弦乐器的消息队列基于黑板
- [LangGraph state and reducers](https://docs.langchain.com/oss/python/langgraph/workflows-agents)生产中每剂投影模式
- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)生产部署的来源和验证说明
