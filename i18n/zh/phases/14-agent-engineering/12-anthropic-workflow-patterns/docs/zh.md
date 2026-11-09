# 简单而不是复杂的"人类"工作流程模式

> 施伦茨和张 (Anthropic, Dec 2024) 区分工作流程 (预定义的路径) 与代理 (动态工具使用).五个工作流程模式涵盖大多数情况.从直接的API调用开始.只需无法预测步骤时添加代理.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## 学习目标

- 命名Anthropic的五个工作流程模式:快速链接,路由,并行,管弦工作者,评估者优化器.
- 解释代理与工作流程的区别以及每个工程成本.
- 确定何时选择工作流而不是代理 (反之亦然).
- 执行五个模式,与编写的LLM进行.

## 问题

团队寻求多代理框架来解决需要单次函数调用的问题.成本是真实的:框架添加了模糊提示的层次,隐藏了控制流量,并邀请过早的复杂性.Schluntz和张的2024年12月的帖子是行业最受引用的推迟:简单开始,只有当它获得成本时添加复杂性.

## 概念

### 工作流程与代理人

- **Workflow.**工程师拥有图表.
- **Agent.**士们动态地指导自己的工具,采取自己的步骤.

工作流程便宜,快速,更容易调试. 代理人解锁了无限的问题, 但使失败模式更难推理.

### 增强的法定律师

基础五种模式:一个LLM,有三个功能,包括搜索 (检索),工具 (行动),内存 (持久性).任何API调用都可以使用这些.

### 五种模式

1. **Prompt chaining.**输出调用1是输入调用2. 使用当任务具有清洁的线性分解时. 选项间的程序门.

2. **Routing.**类别的LLM选择下游LLM或工具. 使用当不同的输入需要不同的处理 (级-1支持与退款与错误与销售).

3. **Parallelization.**运行N LLM同时调用,总结结果.两个形式:分区 (不同块) 和投票 (相同的提示,N运行,多数/合成).

4. **Orchestrator-workers.**管弦乐师 (LLM) 动态决定哪些工人 (也叫做LLM) 运行并合成他们的产量.类似于代理循环,但管弦乐师不会无限时间循环.

5. **Evaluator-optimizer.**一个法学士提出答案,另一个法学士评估它. 连续进行直到评估者通过. 这就是自我清理 (课程05).

### 工作流程比代理人更好

- **Predictable tasks.**如果您能列出步骤,那么您应该.
- **Cost-bound tasks.**工作流程有限步骤数量; 代理人可以螺旋.
- **Compliance-bound tasks.**审计人员希望阅读图表,而不是从轨迹中推断.

### 代理人比工作流程更好

- **Open-ended research.**接下来的步骤是什么,取决于最后的步骤是什么.
- **Variable-length tasks.**工作时间分钟到几个小时,步骤数量不清楚.
- **Novel domains.**首先要编码,然后要编码.

### 环境工程的伴侣

"人工智能代理人有效的文本工程" (Anthropic 2025) 正式化了相邻的学科:200k窗口是一个预算,而不是容器.什么要包括,何时缩小,何时让文本生长.在文本压缩的第14阶段课程 (在重新编号之前的第14阶段课程中,第06课程) 中详细介绍.

```figure
workflow-chain
```

## 建立它

`code/main.py`执行所有五种工作流程模式`ScriptedLLM`其他:

- `prompt_chain(input, steps)`连续.
- `route(input, classifier, handlers)`分类+发送.
- `parallel_vote(prompt, n, aggregator)`N运行,总数.
- `orchestrator_workers(task, workers)`管家选工人.
- `evaluator_optimizer(task, proposer, evaluator, max_iter)`循环到通过.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

每个图案都会印出其痕迹.每个图案的代码总线是10-15个;一个框架的成本是以数千计的.

## 用它

- 直接 API 要求大多数任务.
- 只有当模式真正需要持久状态 (LangGraph),演员模型同步性 (AutoGen v0.4),或角色模板 (CrewAI) 时.
- 找克劳德代理 SDK,当你想要克劳德代码的使用形状,

## 运送它

`outputs/skill-workflow-picker.md`选择给定的任务描述的正确模式,包括决定的理由和工作流程不足时向代理的重点路径.

## 运动

1. 实现可靠性门的路由. 门以下 -> 升级到人. 对于一级支持使用情况,门到底是什么?
2. 加入时间休息`parallel_vote`什么会发生当一个电话挂?
3. 转`evaluator_optimizer`让二排前进的输出在反复中保持,以免一个晚期好的结果被晚期的坏结果覆盖.
4. 结合即时链接和路由:路由器选择三条链中的一个. 测量代币成本与单个大即时代代方案.
5. 选择一个生产特征,绘制工作流程图,计算步骤.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Workflow | "Predefined flow" | Engineer-owned graph of LLM and tool calls |
| Agent | "Autonomous AI" | Model-owned graph; dynamic tool direction |
| Augmented LLM | "LLM with tools" | LLM + search + tools + memory; the atomic unit |
| Prompt chaining | "Sequential calls" | Output of call N is input to call N+1 |
| Routing | "Classifier dispatch" | Pick which chain/model handles the input |
| Parallelization | "Fan out" | N concurrent calls; aggregate by sectioning or voting |
| Orchestrator-workers | "Dispatcher agent" | Orchestrator LLM picks specialist LLMs dynamically |
| Evaluator-optimizer | "Proposer + judge" | Iterate until evaluator passes; Self-Refine generalized |

## 进一步阅读

- [Anthropic, Building Effective Agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents)五个工作流程模式
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)伴侣的纪律
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)当状态图表取成本时
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) 演唱家-工人模式,生产
