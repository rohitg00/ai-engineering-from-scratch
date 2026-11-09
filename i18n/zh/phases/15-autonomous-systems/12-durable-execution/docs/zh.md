# 长期经营的后台代理人:持续执行

> 生产长视线代理不运行`while True`每次LLM电话都会变成一个检查点,重试和重播的活动. Temporal的OpenAI Agents SDK集成完成了2026年3月.Claude Code Routines (Anthropic) 运行定期的Claude Code调用,而没有持续的本地过程.会议暂停了人输入,生存部署,并从最新的检查点重启.`thread_id`后面是旧模式工作流程配套,其中有一个新的输入:LLM称其为非确定性活动,必须在恢复时进行确定性重演.

**Type:** Learn
**Languages:** Python (stdlib, minimal durable-execution state machine), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~60 minutes

## 问题

想象一下,一个经纪人运行四个小时,他打电话给三个工具,两个次向用户发出提示,四十次进行LLM电话.

- 在一个天真的人中`while True`循环:一切都丢失了.运行从零开始.三个工具调用 (具有真正的副作用) 再次执行.用户再次被要求进行已经批准的东西.40次LLM调用被重新收费.
- 通过持久执行:从最近的检查点恢复运行.已经完成的活动不会重新执行;其结果从持久日志中重播.用户不会重新批准已经批准的东西.已经做出的LLM电话不会重新收费.

这就是十年前的工作流动引擎 (Temporal,Cadence,Uber的Cherami) 的模式. 新的是,LLM电话现在是一种活动,不确定性,昂贵,有副作用,

课程的主题是:长视野可靠性衰退 (METR观察到"35分钟的降低"成功率与视野相差别下降).耐用执行使运行时间比可靠性配置文件更长,这是一个安全失败的新方法,如果设计是正确的,如果设计是错误的,则是不安全的.

## 概念

### 活动,工作流程和重播

- **Workflow**定义活动序列,分支,等待.必须是确定性的,以便可以从事件日志中重播而不会出现意外的分歧.
- **Activity**任何活动都会被记录在其输入和输出中. 任何活动都会被记录在其输入和输出中.
- **Event log**工作过程中,每一个活动都开始,完成,失败,重新尝试,每一个工作流决定都会被记录.
- **Replay**:在恢复时,工作流代码从开始重新运行;已经完成的每个活动都会返回记录结果,而不需要重新执行.

这与React重新呈现虚拟DOM或Git从 commit 中重建一个工作树的形状相同.

### 为什么LLM电话符合模式

招聘法师:
- 不确定性 (温度 > 0;即使在模型版本中温度 0 波动).
- 价格昂贵 (金钱和延迟).
- 潜在失败 (利率限制,时间限制).
- 副作用 (如果使用工具).

包装每一次LLM电话作为一个活动,让你重新尝试,

### 通过键键的检查点`thread_id`

长度图,微软代理框架,云飞耐用对象和克劳德代码程序都以相同的API形状相结合:`thread_id`(或相当于) 标识了会议;每个状态转换仍然存在后端 (PostgreSQL默认, dev 的 SQLite,缓存的 Redis); 恢复阅读了最新的检查点.

后端选择是重要的:

- **PostgreSQL**长期使用,可查询,可以使用.
- **SQLite**: 只有本地服务器; 输出数据在主机中.
- **Redis**:快速但短暂,除非配置AOF/快照.
- **Cloudflare Durable Objects**透明分布;使用独特的钥匙进行范围;持续数小时至数周.

### 人类输入作为一流的状态

提出后承诺 (课 15) 需要持续的"等待人"状态.工作流动暂停,外部队列将待定请求保留,批准从那个点开始.没有持续性,这是最好的努力;它将在一夜之间获得批准,工作流程将在早上开始.

### 降解时间35分钟

测量剂类别的每种类别都显示了持续运行35分钟以上的可靠性衰退. 两倍任务时间大约是四倍的失败率. 耐用执行不会解决这个问题,它允许您运行时间超过可靠性配置文件的支持. 安全模式是将耐用性与重新进入时需要新增HITL的检查站结合起来,以及预算杀死开关 (课 13) 限制了整个计算,不管墙钟时间如何.

### 当持续执行是错误的答案

- 没有人投入的运行时间短于几分钟.
- 严格仅阅读信息.
- 要求在一个背景窗口内进行端到端的任务 (某些推理任务;一些一次性生成).

```figure
memory-consolidation
```

## 用它

`code/main.py`在 stdlib Python 中实现了最小耐用执行引擎. 它支持:

- `@activity`装饰器记录输入和输出到一个JSON事件日志.
- 工作流程函数,将活动进行序列.
- `run_or_replay(workflow, event_log)`功能可以重复完成的活动,而不会再执行它们.

驾驶员模拟了三项活动工作流程,在半途中崩,并显示 (a) 一个简单的重复尝试,

## 运送它

`outputs/skill-durable-execution-review.md`审查拟议的长期代理部署以确定有效的持续执行形式:活动,确定性,检查点后台,人力输入状态和HITL在恢复政策.

## 运动

1. 跑步`code/main.py`观察无明的重复试验和重复执行数量的差异. 改变崩点,并显示重复数量相应的变化.

2. 转换玩具机器使用`thread_id`模拟两个同时共享引擎的会议,并确认他们的事件日志不会碰撞.

3. 举例来说,玩具机器中的一个活动. 引入一个非确定性 (一个工作流程决定中壁表时刻标志). 证明重播时的分歧. 解释真正的机器如何处理这一问题 (副作用记录, `Workflow.now()`其他类型

4. 阅读"生产深度代理后的运行时间"的LangChain帖子.列出运行时间持续的每个状态,并列出每个失败模式.

5. 设计一个检查点政策,为一个6小时的自主编码任务.你在哪里检查点?恢复在崩时看起来像什么?需要新的HITL是什么?

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| Workflow | "Agent's script" | Deterministic orchestration code; replayable from event log |
| Activity | "A step" | Non-deterministic unit (LLM call, tool call); logged before and after |
| Event log | "The backing store" | Durable record of every state transition |
| Replay | "Resume" | Re-run workflow; completed activities return logged results without re-execution |
| Checkpoint | "Save point" | Persisted state keyed by thread_id; latest-wins on resume |
| thread_id | "Session key" | Identifier that scopes durable state |
| 35-minute degradation | "Reliability decay" | METR: success rate drops ~quadratically with horizon |
| Non-determinism | "Drift on replay" | Wall clock, random, LLM output; must be registered as side effect |

## 进一步阅读

- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop)预算,转型和恢复语义.
- [Microsoft — Agent Framework: human-in-the-loop and checkpointing](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) 请求信息事件形状.
- [LangChain — The Runtime Behind Production Deep Agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents)具体的运行时间要求.
- [OpenAI Agents SDK + Temporal integration (Trigger.dev announcement)](https://trigger.dev) 法学士招生活动形式.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy)35分钟的降解参考.
