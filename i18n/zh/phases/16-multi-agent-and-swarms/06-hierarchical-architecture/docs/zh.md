# 层次结构及其失败方式

> 管理员的管理员,管理员的管理员,管理员的管理员.`Process.hierarchical`是教科书版本:a `manager_llm`通过LangGraph等同的方法,`create_supervisor(create_supervisor(...))`管理人员的任务是很容易被管理的循环中崩的模式. 管理人员的代理人分配工作不佳,误解子输出,或无法达成共识. 序列通常超过它.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 05 (Supervisor Pattern)
**Time:** ~60 minutes

## 问题

团队有子团队,公司有部门.等级结构反映了这一点.

问题:LLM经理与人经理不同.一个人经理对他们的报告有稳定的前.一个LLM经理从任何情况下都重新考虑组织.

## 概念

### 形状

```
                 Manager
                 ┌─────┐
                 └──┬──┘
           ┌────────┴────────┐
           ▼                 ▼
       Sub-Mgr A         Sub-Mgr B
       ┌─────┐           ┌─────┐
       └──┬──┘           └──┬──┘
         ┌┴──┬──┐          ┌┴──┐
         ▼   ▼  ▼          ▼   ▼
       W1  W2  W3         W4  W5
```

每个内部节点都会进行计划,委托和合成.

### 在它闪的地方

- **Clear org mapping.**如果真正的任务是部门 ("法律审查文件,财务审查文件,工程审查文件,然后为 exec 总结"),等级是明确的.
- **Local summarization.**每个副经理都会在顶级经理看到之前合成他的团队的输出.顶级经理看到的三个副经理总结,而不是十五个工人输出.

### 在它破裂的地方

两次失败模式,2026年后的测试继续发现:

1. **Task assignment error.**由于副经理顺服地工作于它所给出的,错误只会在顶部合成一个层次从一个人可能抓住它.
2. **Output misinterpretation.**副管理员返回"无法验证X索赔".顶级管理员总结为"X索赔未确认".意思在每个级别上波动.
3. **Consensus loops.**两位副经理不同意;最高经理要求他们和解;他们重新委托下;工人重新运行;副经理回应稍微不同的答案;循环.`Process.hierarchical`现在这个限制本身就是一个超参数.

### 关键问题

序列 (线性管道) 与层次:你的任务是否实际上有独立的子组,还是一个线性流流假装是树?如果后者,使用序列.如果前者,使用层次性但预算明确的调和规则.

### 角色框架的实施

机组人员`Process.hierarchical`经理: 管理员:

- 接收最高级别任务,
- 分配小任务给机组人员,
- 评估船员的输出,
- 决定是否接受,重新授权或重复.

文件:https://docs.crewai.com/en/introduction(在核心概念中搜索"层次流程").

### 图形框架的实施

兰格拉夫使用嵌套`create_supervisor`内部监督器有自己的图表;外部监督器把内部图表视为一个不透明的节点.这是更干净的CrewAI对调试 (你可以单独通过每个图表),但更难表达动态重塑树.

参考:https://reference.langchain.com/python/langgraph-supervisor.

```figure
swarm-hierarchy-token
```

## 建立它

`code/main.py`运行一个3级级别的层次结构:

- 高级管理员:将任务分为"工程"和"法律"分类,
- 工程副经理:分为"前端"和"后端"工人,
- 法律副经理:一个员工.

演示与快乐道路的对比 (每个人都同意)**perturbed path**总经理的分解错误地标记"法律"为"金融"并观察错误 副经理顺服地完成财务工作,顶级合成器报告财务发现,最初的法律问题没有得到答案.

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

输出显示了两条路径, 单边的"要求"与"交付"

## 用它

`outputs/skill-hierarchy-fitness.md`评估一个特定任务是否应该使用层次,序列或平面监督器.输入:任务描述,组织结构,调整预算.输出:模式建议,包括特定的故障模式.

## 运送它

如果您运输等级:

- **Cap tree depth at 2.**现在,三层层已经隐藏了大多数错误.
- **Explicit reconciliation budget.**总是要在最高经理承诺之前,设定最大的轮子.
- **Provenance on every synthesis.**每个节点的总结必须指出哪些叶子输出产生它.
- **Alert on decomposition drift.**记录管理器的分解按步骤;与用户查询不同.如果分解不再覆盖查询,请发出警报.

## 运动

1. 跑步`code/main.py`管理者交付需要多少级别才能完全与用户的问题分开?
2. 增加第三层次 (上 → 下 → 下 → 工作者). 测量受扰路径随着深度增长的频率自行纠正与完全分离.
3. 根据"鱼"的定义,使用"鱼"的答案来检测分解漂移.当"鱼"不同意合成答案时,管理员应该如何反应?
4. 阅读CrewAI的文章`Process.hierarchical`确定一个CrewAI应用的混凝土护 (步骤限制,管理者_llm限制) 并描述它针对哪种故障模式.
5. 让调整循环更便宜地检测?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hierarchical | "Org chart pattern" | Supervisors over supervisors; only leaves do work. |
| Manager LLM | "The boss" | The LLM that decomposes, assigns, and validates at an internal node. |
| Decomposition drift | "The boss lost the plot" | Top manager's split no longer covers the original question. |
| Reconciliation loop | "Endless meetings" | Sub-managers disagree; top re-delegates; workers re-run; loop until budget exhausted. |
| Depth-2 ceiling | "Don't go deeper than 2 levels" | Empirical guardrail: 3+ levels collapses observability. |
| Canary question | "Ground truth at every level" | A worker that is always asked the original query unchanged, to detect drift. |
| Provenance chain | "Who said what" | Trace from each synthesis back to the leaf outputs that produced it. |

## 进一步阅读

- [CrewAI introduction — Process.hierarchical](https://docs.crewai.com/en/introduction)课本层次管理者LLM
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) 通过监管者`create_supervisor`
- [Anthropic engineering — Research system](https://www.anthropic.com/engineering/multi-agent-research-system)为什么人类会故意选择平面监管者
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) MAST分类;关于协调失败的部分文件分解漂移
