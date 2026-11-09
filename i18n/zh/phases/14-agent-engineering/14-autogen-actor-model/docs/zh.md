# 代理人的演员模式 异步消息和类型的运行时间

> 代理作为演员:异步消息交换,事件驱动处理器,故障隔离,自然同步性.AutoGen v0.4 (微软研究,2025年1月) 重新设计了围绕该模型的代理配套;框架现在处于维护模式,微软代理框架 (公众预览2025年10月) 作为其生产继任者.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~75 minutes

## 学习目标

- 描述演员模式:代理人作为演员,信息作为唯一的IPC,每演员的失败隔离.
- 给AutoGen v0.4的三个API层命名 核心,代理聊天,扩展 ,每个层是什么.
- 解释为什么分离处理信息的传输使得故障隔离和自然的同时发生.
- 在Python中实现一个 stdlib演员运行时间,并将两个代理代码审查流入其中.

## 问题

大多数代理框架是同步的:一个代理生产,一个代理消费,在电话堆中.失败崩堆. 交互是接的. 分布需要重写.

机器人4.4的答案:演员模型.每个代理是一个有私人收件箱的演员. 消息是唯一的交互. 运行时间分离交付与处理. 失败隔离到一个演员. 竞争是本土的. 分布只是不同的运输.

## 概念

### 演员

一个演员有:

- 个人国家 (从外面直接接触的).
- 收件箱 (消息队列).
- 管理者:`receive(message) -> effects`效果可以是"回复","向其他演员发送","新演员发射","更新状态","停止自我".

两个演员不能分享记忆,他们只能发送信息.

### 三个API层

机器人4.0将其表面分为三个:

1. **Core.**低级演员框架. `AgentRuntime`现在`Agent`现在`Message`现在`Topic`基于事件的异步消息交换.
2. **AgentChat.**基于任务的高级API (替代了v0.2的可转换代理). `AssistantAgent`现在`UserProxyAgent`现在`RoundRobinGroupChat`现在`SelectorGroupChat`现在,我们要去.
3. **Extensions.**集成 OpenAI,人类,Azure,工具,内存.

### 为什么分离关系很重要

在v0.2模型中,调用`agent_a.chat(agent_b)`在v0.4中, 除了除了除了除了除了除了除.`send(agent_b, msg)`运行时间后会传递.

- **Fault isolation.**运行时间抓住B的处理器失败,决定要做什么 (登录,重新尝试,死字母).
- **Natural concurrency.**许多消息同时飞行;演员同时处理收件箱.
- **Distribution-ready.**收件箱+运输是同一抽象,无论演员是正在进行或在另一个主机上.

### 拓物

- **RoundRobinGroupChat.**代理人轮流在固定转变.
- **SelectorGroupChat.**选手根据对话背景选择下一个选手.
- **Magentic-One.**参考多代理团队用于浏览网页,执行代码,处理文件.

### 可观察性

每个消息发射一个跨度;工具调用携带`gen_ai.*`根据2026年OTel GenAI语义公约的属性 (课23).

### 状态:维护模式

2026年初:AutoGen v0.7.x为研究和原型设计而稳定.微软已将主动开发转移到微软代理框架,生产后代 (公众预览2026年10月1日; 1.0 GA是2026年1季度末的目标).AutoGen模式将清洁地推进.

```figure
actor-mailbox
```

## 建立它

`code/main.py`执行一个STDlib演员运行时间:

- `Message` 输入用荷`sender`现在`recipient`现在`topic`现在`body`现在,我们要去.
- `Actor`抽象的`receive(message, runtime)`现在,我们要去.
- `Runtime`事件循环与共享队列,交付,故障隔离.
- 两个演员演出:`ReviewerAgent`审查代码`ChecklistAgent`它们交换信息,直到达成一致.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

痕迹显示了消息传递,一个演员的模拟失败,

## 用它

- **AutoGen v0.4/v0.7**稳定研究,原型制造,多代理模式.
- **Microsoft Agent Framework**生产后代 (2025年10月公开预览);相同的演员模型想法在更新的API中.
- **LangGraph swarm topology**通过分享工具的交付, 类似的模式.
- **Custom actor runtime**需要特定的运输 (NATS,RabbitMQ,gRPC).

## 运送它

`outputs/skill-actor-runtime.md`生成一个最小的演员运行时间加上一个团队模板 (RoundRobin或 Selector) 为给定的多代理任务.

## 运动

1. 加入一个死字母队列:当一个操作员提升时, 停留失败信息的人类检查.
2. 实施`SelectorGroupChat`选择器选择了根据对话状态处理下一个信息的演员.
3. 增加分布式运输:将过程中的队列换为JSON-over-HTTP服务器,以便参与者可以在单独的过程中运行.
4. 输出每条消息的 OTel 跨度 (或无操作替代).`gen_ai.agent.name`现在`gen_ai.operation.name`根据第23课.
5. 阅读AutoGen v0.4的架构帖子.`autogen_core`你在生产中错过了什么?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Actor | "Agent" | Private state + inbox + handler; no shared memory |
| Message | "Event" | Typed payload; the only way actors interact |
| Inbox | "Mailbox" | Per-actor queue of pending messages |
| Runtime | "Agent host" | Event loop that routes messages and isolates failures |
| Topic | "Channel" | Named publish-subscribe route between actors |
| Fault isolation | "Let it crash" | One actor failing does not crash others |
| RoundRobinGroupChat | "Fixed-rotation team" | Agents take turns in order |
| SelectorGroupChat | "Context-routed team" | Selector picks who goes next |
| Magentic-One | "Reference team" | Multi-agent squad for web + code + files |

## 进一步阅读

- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/)重新设计的位置
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)图形替代品
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) 跨度自动生成默认发射
