# 管弦乐模式:监督者,群体,层次

> 五个工作流程模式是不够的,但只需要一个代理加上五个工作流程模式. 五个工作流程模式是不够的. 五个工作流程模式是不够的.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 25 (Multi-Agent Debate)
**Time:** ~60 minutes

## 学习目标

- 举个重复的四种调整模式,
- 描述2026年兰格链推:基于工具的监督与监督库.
- 解释人类的"建立正确系统"规则以及它如何限制拓学选择.
- 执行四个在STDlib与一个共同的剧本LLM.

## 问题

团队在需要它之前就会寻找"多代理".四种模式在框架中重复;一旦你能命名它们,你可以选择正确的或完全跳过拓.

## 概念

### 监督员工

- 专业代理人发送的中心路由LLM.
- 决定:回归自我,交给专家,结束.
- 专家不会互相交谈;所有的路由都通过监督者.

框架: 兰格拉夫`create_supervisor`机器人管家工作者,机器人管家管理人员.

**2026 LangChain recommendation:**通过直接的工具调用来进行监督,而不是`create_supervisor`您可以决定每个专家看到的内容.

### 群体/同行

- 代理人通过共享工具表面直接交付.
- 没有中央路由器.
- 低延迟比监督者 (低跳跃).
- 对于 (没有单一的控制点) 进行推理更难.

框架: 兰格拉夫群群的拓,OpenAI代理SDK交付 (所有代理人可以交给所有其他代理人).

### 层次性

- 管理监督人,管理员工的副监督人.
- 作为在LangGraph中嵌套的子图;在CrewAI中嵌套的机组人员.
- 规模以运营复杂性为代价,

需要时:当一个监管机构的文本预算不能包含所有专家的描述时.

### 辩论

- 并行提出者+反复的交叉批评 (25课).
- 实际上不是调整更多的验证,但在框架中显示为一个拓选择.

### 自主机组与确定性流程

机组人员将两种部署模式正式化:

- **Flow**对于决定性事件驱动的自动化 (建议生产的起点).
- **Crew**基于角色的自主合作.

这与上述四个模式一致,但与拓学的地图相符:流程通常是监督或层次;船员通常是监督者,具有LLM路由器.

### 人类的指导

"在法学士领域的成功不是建立最复杂的系统,而是建立适合你需要的系统.

决策命令:

1. 单个代理+工作流程模式 (课 12) 从这里开始.
2. 监督员工 ,当您有2至4名专家时.
3. ,当延迟比推理清晰度更重要时.
4. 只有监管环境预算失败时才是层次性的.
5. 讨论时,准确性比成本更重要.

### 在这个模式出现错误的地方

- **Topology-first thinking.**在确定多代理解决什么问题之前,我们需要多代理.
- **Bouncing handoffs in swarm.**使用跳跃计数器.
- **Fake hierarchy.**由于企业,三层,两个实际团队.

```figure
orchestration-pattern
```

## 建立它

`code/main.py`执行了四个模式,与编写的LLM相比:

- `Supervisor`中央路由器.
- `Swarm` 直接交付的同行.
- `Hierarchical`监管机构的监管机构.
- `Debate`平行提案+批评.

每个模式都处理相同的三意任务 (退款/错误/销售).

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

产量:每个模式的痕迹+运算数量. 监督员最干净;群群最短;层次结构最深;辩论最昂贵.

## 用它

- **LangGraph**监督和等级 (嵌套子图)
- **OpenAI Agents SDK**对于工具交付 (监督者形状).
- **CrewAI Flow**对于生产定量化.
- **Custom**任何时候,你需要一个确切的控制.

## 运送它

`outputs/skill-orchestration-picker.md`选择一个拓物质并实现它.

## 运动

1. 通过移除路由器,将一个监督员工转化为一群人.
2. 加入一个跳跃计数:放弃3次交给后.它会抓住A->B->A跳动吗?
3. 建立一个为12个专业领域的两层级等级体系.
4. 分析生产型工作负载的四个模式.哪个比较中哪个比较 (延迟,成本,准确性,可调试性)?
5. 读一读"构建有效代理"的文章. 绘制出你每一个生产流程的四个流程之一.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Supervisor-worker | "Router + specialists" | Central LLM dispatches to specialists; they don't talk to each other |
| Swarm | "Peer-to-peer" | Direct handoffs via shared tools; no central router |
| Hierarchical | "Supervisors of supervisors" | Nested subgraphs for large populations |
| Debate | "Proposer + critique" | Parallel proposers, cross-critique (Lesson 25) |
| Tool-call-based supervision | "Supervisor without a library" | Implement supervisor as direct tool calls for context control |
| Crew | "Autonomous team" | CrewAI's role-based collaboration mode |
| Flow | "Deterministic workflow" | CrewAI's event-driven production mode |

## 进一步阅读

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)五种模式 + 代理与工作流程
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)监督者,群体,层次
- [CrewAI docs](https://docs.crewai.com/en/introduction)机组人vs流量
- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325)辩论模式
