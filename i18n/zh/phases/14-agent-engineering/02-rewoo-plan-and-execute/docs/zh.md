# 复制和计划和执行:离合规规划

> 雷亚克特将思想和行动交织成一个流.雷亚克特分开它们:一个大计划前面,然后执行. 5倍少于代币,HotpotQA上的准确度为4%,你可以将计划器化为7B模型.计划和执行将其概括;计划和行动将其扩展到网络导航.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## 学习目标

- 解释为什么ReWOO的规划者/工人/解决器分区节省了代币,并提高了ReAct的互联循环的强度.
- 实现一个计划DAG,一个依赖命令执行器,以及一个构成员工输出的解决器.
- 决定一个任务应该在2026年"五个工作流程模式"框架 (Anthropic) 中运行时,将计划然后执行与交互 ReAct进行.
- 识别在长远网络或移动任务中需要什么时候使用 Plan-and-Act 的合成计划数据.

## 问题

雷亚克的互联思考-行动-观察循环简单而灵活,但每个工具调用必须携带完整的先前文本,包括每一个先前思想.代币使用随着深度的增长而增长.更糟糕的是:当工具中期失败时,模型必须从错误观察中重新衍生整个计划.

雷沃 (Xu et al., arXiv:2305.18323,2023年5月) 注意到这一点,并投注:提前计划整个事情,并行地收集证据,在最后编写答案.一个LLM调用计划,N工具要求证据 (可以并行),一个LLM调用解决.交易更少的灵活性 (计划是静态的) 获得更好的代币效率和更清晰的失败模式.

## 概念

### 三个角色

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (tool calls, possibly parallel)
Solver:   user_question, plan_dag, evidence -> final_answer
```

规划器生成DAG. 每个节点都会命名一个工具,它的参数,以及它取决于哪些早期节点 (如`#E1`现在`#E2`工人按拓顺序执行节点.

### 为什么5倍少的代币

反应随步数线性增长.在步骤10时,提示包含1加行动1加观察1加思考2加行动2加观察2等.每个中间步骤也含有原始提示.

在HotpotQA上,纸质测量比5倍少的代币,同时获得+4绝对精度.

### 为什么它更强

如果 ReAct 中工作者3失败,循环必须在误差中流中推理出来.在 ReWOO 中,工作者3返回一个错误字符串;解决器将其视为与原始计划的背景,并且可以优雅地降级.故障定位是每个节点,而不是每个步骤.

### 调制剂蒸

由于规划者不看到观察,所以你可以从175B老师对规划者输出进行细节调整7B模型.小模型处理规划;在推断时,大模型不需要.现在这是标准的.

### 计划和执行 (2023)

兰格链团队在2023年8月的帖子将REWOO整体化为模式名称:计划和执行.前面规划器发布一步列表,执行器运行每个步骤,可选的重组规划器可以在观察结果后修改.这更接近ReAct比REWOO (重组规划器将观察恢复到规划中),但保留了代币节省.

### 计划和法案 (埃尔多根等人, arXiv:2503.09572, ICML 2025)

计划和行动将模式扩展到长视野网络和移动代理.主要贡献是合成计划数据:标记轨迹生成器生成了计划明确的训练数据.用于在一个ReAct轨迹失去了一致性的情况下继续在WebArena类任务上工作3050步后调整规划器模型.

### 什么时候选择哪个

| Pattern | When |
|---------|------|
| ReAct | Short tasks, unknown environment, need reactive exception handling |
| ReWOO | Structured tasks with known tools, token-sensitive, parallelizable evidence |
| Plan-and-Execute | Like ReWOO but with replanning after partial execution |
| Plan-and-Act | Long-horizon (>30 steps), web/mobile/computer-use |
| Tree of Thoughts | Search is worth paying for (Lesson 04) |

根据"人类学"的2024年12月指导:从最简单的开始. 如果任务是一个工具调用加上一个总结,不要构建ReWOO. 如果任务是40步的研究任务,不要单独做ReAct.

```figure
rewoo-plan
```

## 建立它

`code/main.py`实现玩具ReWOO:

- `Planner`一个编写的政策,从提示中发出计划DAG.
- `Worker`通过注册表发送每个节点的工具调用.
- `Solver`编写的作文,阅读证据并产生最终答案.
- 依赖性决议 如`#E1`工人产量更换为以前的工人产量.

演示题回答"法国首都人口是多少,总数为数百万?"

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

追踪首先显示了完整的计划,然后是工人结果,然后是解决器组合.将代币数量 (我们打印粗略的字符数量) 与ReAct式的交叉运行进行比较.

## 用它

兰格拉夫公司作为配方 (`create_react_agent`对于ReAct,定制图为计划执行).CrewAI的流程直接编码模式:您先定义任务,流程DAG执行它们.计划和行动的合成数据方法仍然主要是研究;运行时间模式 (明确计划DAG) 通过LangGraph和CrewAI流程进行生产.

## 运送它

`outputs/skill-rewoo-planner.md`在执行器交付之前,它验证该计划 (循环,每个参考已解决,每个工具都存在).

## 运动

1. 通过一个6节点 DAG,两个平行组,你会得到什么?
2. 如果任何员工返回错误,添加一个重组节点,如果任何员工返回错误,它会被执行.
3. 取代`Planner`具有小型型号 (7B类) 和保持`Solver` 哪里是分断失败?
4. 阅读REWOO关于计划器蒸的论文第4节. 概念上复制175B -> 7B结果:您需要哪些培训数据,以及如何评分计划质量?
5. 运输玩具到计划和行动的轨迹形状:计划是序列,而不是DAG.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ReWOO | "Reasoning without observations" | Plan, then fetch evidence in parallel, then solve — no observations in the planning prompt |
| Plan-and-Execute | "LangChain's plan-execute pattern" | ReWOO with an optional replanner node after execution |
| Plan-and-Act | "Scaled plan-execute" | Explicit planner/executor split with synthetic plan training data for long-horizon tasks |
| Evidence reference | "#E1, #E2, ..." | Plan-node placeholder substituted with prior worker output at dispatch time |
| Planner distillation | "Small planner, big executor" | Fine-tune a small model on planner traces from a large teacher |
| Token efficiency | "Fewer round trips" | 5x fewer tokens on HotpotQA vs ReAct in the paper |
| DAG executor | "Topological dispatcher" | Runs plan nodes in dependency order; parallel at each level |

## 进一步阅读

- [Xu et al., ReWOO: Decoupling Reasoning from Observations (arXiv:2305.18323)](https://arxiv.org/abs/2305.18323)法典论文
- [Erdogan et al., Plan-and-Act (arXiv:2503.09572)](https://arxiv.org/abs/2503.09572) 具有合成计划的规模规划者执行者
- [LangGraph Plan-and-Execute tutorial](https://docs.langchain.com/oss/python/langgraph/overview)框架配方
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)选择最简单的模式,
