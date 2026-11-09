# 监督员/管弦乐员工作模式

> 一个主要代理人计划和代表;专业工作者在平行环境中执行并报告. 这就是安特罗皮克研究系统 (Claude Opus 4作为, Sonnet 4作为子基) 背后的模式,在内部研究评估中,测量为+90.2% 据Anthropic的工程文章报道,BrowseComp上的80%的差异仅仅是通过代币使用解释的. 这一课从原始人构建了监督模式,并涵盖了2026年的生产部署工程课程.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## 问题

研究是单代理系统失败的原型任务.你问"2023年至2026年间多代理系统发生了什么变化?" 一个单代理在连续阅读五篇论文,将其文本填写到一半,然后必须一起考虑它们.在达到第五篇时,它忘记了第一篇论文.它不能平行化.

监督模式解决了这一问题:一个领导代理计划搜索,委托每个子问题给一个工人,并合成.每个工人获得了自己的200k代币窗口,以满足一个狭窄的问题.领导从来没有看到原材料 只有工人的摘要.

报告显示,在内部研究评估和单个Opus4中,Anthropic的生产研究系统报告了90.2%的数据. 同一篇文章指出,80%的BrowseComp变化仅仅是通过使用代币来解释的.

## 概念

### 模式

```
                 ┌──────────────┐
                 │   Lead       │  plans, decomposes,
                 │  (Opus 4)    │  synthesizes
                 └──┬────┬───┬──┘
                    │    │   │
            ┌───────┘    │   └───────┐
            ▼            ▼           ▼
      ┌─────────┐  ┌─────────┐  ┌─────────┐
      │ Worker1 │  │ Worker2 │  │ Worker3 │
      │(Sonnet) │  │(Sonnet) │  │(Sonnet) │
      └─────────┘  └─────────┘  └─────────┘
         fresh       fresh        fresh
         context     context      context
```

子从来没有读到原材料. 工人从来没有看到彼此的工作,直到子合成. 每个箭头都是一个狭窄的文物.

### 为什么它赢得

三个机制:

1. **Fresh context per subagent.**调查"FIPA-ACL遗产"的工人没有带上40万代币,
2. **Specialization via prompt.**领导的提示是"分解和合成",而不是"研究".每个工作者的提示是狭窄的:"找到X变化的东西".
3. **Parallelism.**工人同时运行.`max(worker_times) + plan + synthesis`没有`sum(worker_times)`现在,我们要去.

### 工程课程 (人类学2025年)

对于2026年,这份"人类"文章列出了一些仍然与2026年相关的生产课程:

- **Scale effort to query complexity.**简单的查询:一个代理,3-10个工具调用.复杂的查询:10个代理. 领先者必须估计这一点,而不是调用者.
- **Broad then narrow.**首先将其分解成广泛的子问题,然后在答案要求深度时,每次子问题就会产生更多的工人.
- **Rainbow deployments.**机器人是长期的,充满状态的.传统的蓝绿色不起作用.人类使用彩虹:新版本逐步推出,而旧版本会耗尽.
- **Token usage dominates.**单代理的代币是15x. 只有任务值证明成本时运行.

### 图表原生转折

拉格格拉夫最初发送了一个`langgraph-supervisor`具有高水平的图书馆`create_supervisor`帮助人. 在2025年,兰格链将推转移到直接通过工具调用实现监督模式,因为工具调用对监督者看到的东西给予更多控制 (文本工程).图书馆仍然运行; 文档现在建议使用工具调用形式.

### 失败模式

- **Lead hallucinates the plan.**如果引擎引发了不解解答真正的问题的子问题,
- **Workers over-explore.**没有明确的范围限制,工人超越了分配给他们的子问题,
- **Synthesis conflicts.**两个工人返回矛盾的事实. 领先者要么重新问 (添加一轮) 或明确指出分歧. 默默选择一边是最严重的失败:用户永远不知道分歧发生了.

### 当监督员错误时

- **Sequential tasks.**如果步骤2实际上需要步骤1的输出,并行性就不会买到任何东西.使用管道 (CrewAI序列,LangGraph线形图).
- **Simple queries.**单个代理人处理它们更快,更便宜.
- **Strict determinism.**监督者使用LLM选定的代表. 静态图表在审计/重播更重要时比适应性更好.

```figure
supervisor-hierarchy
```

## 建立它

`code/main.py`执行一个由三个平行工人组成的监督员工,使用`threading`将查询分解成子问题,工人同时对每个子问题进行运行,合成.没有真正的LLM工人编写以模拟搜索和总结.

关键结构:

- `Lead.plan(query)`问题分为3个子问题.
- `Worker.run(sub_q)`返回假摘要 (可能是生产中的任何使用工具的代理).
- `Lead.run(query)`它们将工人分为线程,结合和合成.

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

输出显示了计划,并行工作者跟踪了开始/结束时间标签,以及最终合成.你可以看到墙钟的胜利:三名0.3秒的工人在0.35秒内跑,而不是0.9.

## 用它

`outputs/skill-supervisor-designer.md`通过使用者查询,生成一个监督模式设计:导向系统提示,工作者角色,子问题分解规则和合成模板. 在构建新的研究式代理系统之前,使用此.

## 运送它

在部署监督模式之前,检查列表:

- **Model pairing.**在推理层模型上 (Opus类,`o3`工人在更快,更便宜的模型上 (Sonnet, `o4-mini`)
- **Worker timeout.**任何超过2倍的平均运行时间的工人都会被杀害; 领先者要么以更窄的范围重新生长,要么没有它.
- **Token cap per worker.**强制限制 (例如,预期的合成输入10倍) 阻止逃离工人
- **Observability.**追踪领导的计划,每个员工的工具调用,以及合成. 这是任何后期调试的基础.
- **Rainbow rollout.**长期经营的代理人需要逐步的版本转换,而不是热交换.

## 运动

1. 跑步`code/main.py`现在,我们可以看到一个新的方法,然后修改引擎到5个工人而不是3.观察墙钟效果.在哪个工人数量上,在这个演示中,产生的总成本超过了平行节省?
2. 执行员工时间限制:杀死超过0.5秒的员工,让领先者合成剩余的结果.
3. 另外,如果两个工人回复矛盾的答案,领导者会注意到不同意见,而不是选择一个.
4. 列出这款玩具演示需要采用的三种做法,才能在生产中运行.
5. 比较兰格拉夫的情况`create_supervisor`什么让你更好地控制监督者看到的东西?为什么人类明确地将仅次答案而不是原始工人背景合成?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Supervisor | "Lead agent" | An orchestrator agent that plans, delegates, and synthesizes. Does not do the work itself. |
| Worker | "Subagent" | A focused agent invoked by the supervisor with narrow scope and its own context window. |
| Orchestrator-worker | "Supervisor pattern" | Same thing, different name. The 2026 literature uses both. |
| Fresh context | "Clean window" | A worker's context starts from its system prompt and assigned question, not the lead's history. |
| Rainbow deployment | "Gradual rollout" | Long-running stateful agents need versioned drain-and-replace, not blue-green. |
| Token dominance | "Context is the variable" | 80% of research-eval variance comes from total tokens used, not model choice, per Anthropic. |
| Scale effort | "Match agent count to complexity" | Lead estimates query difficulty, spawns 1 vs 10+ workers accordingly. |
| Synthesis conflict | "Workers disagree" | Two workers return contradictory facts; the lead must surface disagreement, not silently pick one. |

## 进一步阅读

- [Anthropic engineering — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)监管模式的生产参考
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) 工具调用监督者现在是建议的形式
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor)传统的辅助器,仍在2026年生产中使用
- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents)基于转让的监管变体
