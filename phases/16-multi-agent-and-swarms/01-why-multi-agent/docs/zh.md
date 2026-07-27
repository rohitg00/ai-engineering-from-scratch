# 为什么需要多智能体？

> 一个智能体会碰壁。明智的做法不是打造更大的智能体——而是引入更多智能体。

**类型：** 学习
**语言：** TypeScript
**前置要求：** 阶段 14（智能体工程）
**时间：** 约 60 分钟

## 学习目标

- 识别单智能体的天花板（上下文溢出、专长混杂、顺序瓶颈），并解释何时拆分为多个智能体才是正确的选择
- 比较编排模式（流水线、并行扇出、监督者、层次结构），并为给定的任务结构选择合适的方式
- 设计一个具有清晰角色边界、共享状态和通信契约的多智能体系统
- 分析多智能体复杂性（延迟、成本、调试难度）与单智能体简洁性之间的权衡

## 问题

你在阶段 14 中构建了一个单智能体。它能工作。它可以读取文件、运行命令、调用 API 并对结果进行推理。然后你把它指向一个真实的代码库：200 个文件、三种语言、依赖基础设施的测试，以及在编写代码之前需要研究外部 API 的要求。

智能体卡住了。不是因为 LLM 笨，而是因为任务超出了单个智能体循环所能处理的范围。上下文窗口被文件内容填满。智能体忘记了 40 次工具调用之前读过的东西。它试图同时扮演研究者、编码者和审查者，结果三者都做得一塌糊涂。

这就是单智能体的天花板。每当任务需要以下条件时，你都会碰到它：

- **超出单个窗口容量的上下文**——读取 50 个文件就会超过 20 万 token
- **不同阶段需要不同专长**——研究的提示词工程与代码生成的要求截然不同
- **可以并行完成的工作**——既然可以同时读取三个文件，何必串行读取？

## 概念

### 单智能体的天花板

单个智能体是一个循环、一个上下文窗口、一个系统提示。想象一下：

```
┌─────────────────────────────────────────┐
│              单智能体                    │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │          上下文窗口               │  │
│  │                                   │  │
│  │  研究笔记                         │  │
│  │  + 代码文件                       │  │
│  │  + 测试输出                       │  │
│  │  + 审查反馈                       │  │
│  │  + API 文档                       │  │
│  │  + ……                             │  │
│  │                                   │  │
│  │  ██████████████████████ 已满 ███  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  一个系统提示试图覆盖                    │
│  研究 + 编码 + 审查 + 测试              │
│                                         │
│  结果：每件事都做得平庸                  │
└─────────────────────────────────────────┘
```

三件事会出问题：

1. **上下文饱和**——工具结果不断堆积。到第 30 轮时，智能体已经消耗了 15 万 token 的文件内容、命令输出和先前的推理。第 5 轮的关键细节就丢失了。

2. **角色混淆**——一个写着"你既是研究者、编码者、审查者，也是测试者"的系统提示，会产生一个研究了一半、编了一半代码、从未完成审查的智能体。

3. **顺序瓶颈**——智能体先读文件 A，再读文件 B，然后读文件 C。三次串行的 LLM 调用。三次串行的工具执行。没有并行。

### 多智能体解决方案

拆分工作。给每个智能体一个任务、一个上下文窗口和一个针对该任务调优的系统提示：

```
┌──────────────────────────────────────────────────────────┐
│                      编排器                               │
│                                                          │
│  "构建一个用户管理 REST API"                              │
│                                                          │
│         ┌──────────┬──────────┬──────────┐               │
│         │          │          │          │               │
│         ▼          ▼          ▼          ▼               │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│   │  研究者  │ │  编码者  │ │  审查者  │ │  测试者  │  │
│   │          │ │          │ │          │ │          │  │
│   │ 阅读文档 │ │ 编写代码 │ │ 检查代码 │ │ 运行测试 │  │
│   │ 发现模式 │ │ 基于研究 │ │ 质量    │ │ 报告结果 │  │
│   │          │ │ 和规格   │ │ 发现缺陷 │ │          │  │
│   └─────┬────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│         │           │            │             │         │
│         └───────────┴────────────┴─────────────┘         │
│                          │                               │
│                     合并结果                              │
└──────────────────────────────────────────────────────────┘
```

每个智能体拥有：
- 一个聚焦的系统提示（"你是一名代码审查者。你唯一的工作就是发现缺陷。"）
- 自己的上下文窗口（不被其他智能体的工作污染）
- 清晰的输入/输出契约（接收研究笔记，输出代码）

### 实际系统中是如何应用的

**Claude Code 子智能体**——当 Claude Code 使用 `Task` 生成子智能体时，它会创建一个具有限定范围任务的子智能体。父智能体保持其上下文干净。子智能体执行聚焦的工作并返回摘要。

**Devin**——运行一个规划智能体、一个编码智能体和一个浏览器智能体。规划者将工作拆分为步骤。编码者编写代码。浏览器研究文档。每个都有独立的上下文。

**多智能体编码团队（SWE-bench）**——SWE-bench 上表现最好的系统使用一个研究者来阅读代码库，一个规划者来设计修复方案，一个编码者来实现它。单智能体系统的得分较低。

**ChatGPT Deep Research**——并行生成多个搜索智能体，每个探索不同的角度，然后综合结果。

### 频谱

多智能体不是二元的。它是一个频谱：

```
简单 ──────────────────────────────────────────────── 复杂

 单智能体      子智能体        流水线         团队         群体

 ┌───┐       ┌───┐        ┌───┐───┐    ┌───┐───┐    ┌─┐┌─┐┌─┐
 │ A │       │ A │        │ A │ B │    │ A │ B │    │ ││ ││ │
 └───┘       └─┬─┘        └───┘─┬─┘    └─┬─┘─┬─┘    └┬┘└┬┘└┬┘
               │                │        │   │       ┌┴──┴──┴┐
             ┌─┴─┐          ┌───┘───┐    │   │       │共享   │
             │ a │          │ C │ D │  ┌─┴───┴─┐    │状态   │
             └───┘          └───┘───┘  │  消息  │    └───────┘
                                        │  总线  │
 1个循环     父+子任务      逐阶段       │       │    N个对等体
 1个上下文                 进行        └───────┘    涌现行为
                                        显式角色
```

**单智能体**——一个循环，一个提示。适用于简单任务。

**子智能体**——父智能体为聚焦的子任务生成子智能体。父智能体维护计划。子智能体回报结果。Claude Code 就是这样做的。

**流水线**——智能体按顺序运行。智能体 A 的输出成为智能体 B 的输入。适用于分阶段工作流：研究 → 编码 → 审查 → 测试。

**团队**——智能体通过共享消息总线并行运行。每个都有角色。编排器进行协调。适用于需要同时使用不同技能的场景。

**群体**——许多相同或几乎相同的智能体，具有共享状态。没有固定的编排器。智能体从队列中获取工作。适用于高吞吐量的并行任务。

### 四种多智能体模式

#### 模式 1：流水线

```
输入 ──▶ 智能体 A ──▶ 智能体 B ──▶ 智能体 C ──▶ 输出
         (研究)       (编码)       (审查)
```

每个智能体转换数据并将其传递下去。易于推理。一个阶段的失败会阻塞后续阶段。

#### 模式 2：扇出 / 扇入

```
                ┌──▶ 智能体 A ──┐
                │              │
输入 ──▶ 拆分  ├──▶ 智能体 B ──├──▶ 合并 ──▶ 输出
                │              │
                └──▶ 智能体 C ──┘
```

将任务拆分到并行智能体中，然后合并结果。适用于可分解为独立子任务的任务。

#### 模式 3：编排器-工作者

```
                    ┌──────────┐
                    │  编排器  │
                    └──┬───┬───┘
                  任务 │   │ 任务
                 ┌─────┘   └─────┐
                 ▼               ▼
           ┌──────────┐   ┌──────────┐
           │ 工作者 A  │   │ 工作者 B  │
           └──────────┘   └──────────┘
```

一个智能的编排器决定做什么，委派给工作者，并综合结果。编排器本身是一个拥有生成工作者工具的智能体。

#### 模式 4：对等群体

```
         ┌───┐ ◄──── 消息 ────▶ ┌───┐
         │ A │                  │ B │
         └─┬─┘                  └─┬─┘
           │                      │
      消息 │    ┌───────────┐     │ 消息
           └───▶│  共享状态  │◄────┘
                │  / 队列    │
           ┌───▶│           │◄────┐
           │    └───────────┘     │
      消息 │                      │ 消息
         ┌─┴─┐                  ┌─┴─┐
         │ C │ ◄──── 消息 ────▶ │ D │
         └───┘                  └───┘
```

没有中央编排器。智能体之间点对点通信。决策从交互中涌现。更难调试，但可扩展到大量智能体。

### 何时不该使用多智能体

多智能体增加了复杂性。智能体之间的每条消息都是一个潜在的故障点。调试从"阅读一个对话"变成"追踪跨越五个智能体的消息"。

**以下情况应保持单智能体：**
- 任务适合一个上下文窗口（工作数据约在 10 万 token 以内）
- 不同阶段不需要不同的系统提示
- 顺序执行速度足够快
- 任务足够简单，拆分带来的开销超过了价值

**复杂性成本：**
- 每个智能体边界都是一个有损压缩步骤：智能体 A 的完整上下文被总结成一条消息传递给智能体 B
- 协调逻辑（谁做什么、何时做、按什么顺序）本身就是缺陷的来源
- 延迟增加：N 个智能体至少意味着 N 次串行 LLM 调用，如果需要来回沟通则更多
- 成本成倍增加：每个智能体独立消耗 token

经验法则：如果一个任务少于 20 次工具调用且适合 10 万 token，保持单智能体。

```figure
swarm-messages
```

## 动手构建

### 步骤 1：过载的单智能体

这是一个试图包揽一切的智能体。它有一个庞大的系统提示和一个同时容纳研究、代码和审查的上下文窗口：

```typescript
type AgentResult = {
  content: string;
  tokensUsed: number;
  toolCalls: number;
};

async function singleAgentApproach(task: string): Promise<AgentResult> {
  const systemPrompt = `你是一名全栈开发者。你必须：
1. 研究需求
2. 编写代码
3. 审查代码中的缺陷
4. 编写测试
在单次对话中完成以上所有工作。`;

  const contextWindow: string[] = [];
  let totalTokens = 0;
  let totalToolCalls = 0;

  const research = await fakeLLMCall(systemPrompt, `研究：${task}`);
  contextWindow.push(research.output);
  totalTokens += research.tokens;
  totalToolCalls += research.calls;

  const code = await fakeLLMCall(
    systemPrompt,
    `基于以下研究：\n${contextWindow.join("\n")}\n\n现在为以下任务编写代码：${task}`
  );
  contextWindow.push(code.output);
  totalTokens += code.tokens;
  totalToolCalls += code.calls;

  const review = await fakeLLMCall(
    systemPrompt,
    `基于之前的所有上下文：\n${contextWindow.join("\n")}\n\n审查代码。`
  );
  contextWindow.push(review.output);
  totalTokens += review.tokens;
  totalToolCalls += review.calls;

  return {
    content: contextWindow.join("\n---\n"),
    tokensUsed: totalTokens,
    toolCalls: totalToolCalls,
  };
}
```

这种方法的问题：
- 上下文窗口随着每个阶段增长。到审查步骤时，它已经包含了研究笔记、代码和先前的推理。
- 系统提示是通用的。无法针对每个阶段进行调优。
- 没有任何东西是并行运行的。

### 步骤 2：专精智能体

现在拆分它。每个智能体获得一个任务：

```typescript
type SpecialistAgent = {
  name: string;
  systemPrompt: string;
  run: (input: string) => Promise<AgentResult>;
};

function createSpecialist(name: string, systemPrompt: string): SpecialistAgent {
  return {
    name,
    systemPrompt,
    run: async (input: string) => {
      const result = await fakeLLMCall(systemPrompt, input);
      return {
        content: result.output,
        tokensUsed: result.tokens,
        toolCalls: result.calls,
      };
    },
  };
}

const researcher = createSpecialist(
  "researcher",
  "你是一名技术研究员。阅读文档，发现模式，总结发现。只输出实现所需的事实。"
);

const coder = createSpecialist(
  "coder",
  "你是一名资深 TypeScript 开发者。给定需求和研究笔记，编写干净、经过测试的代码。仅此而已。"
);

const reviewer = createSpecialist(
  "reviewer",
  "你是一名代码审查者。发现缺陷、安全问题和逻辑错误。要具体。引用行号。"
);
```

每个专精智能体都有一个聚焦的提示。每个都获得一个干净的上下文窗口，只包含它所需的输入。

### 步骤 3：通过消息进行协调

通过显式的消息传递将专精智能体连接起来：

```typescript
type AgentMessage = {
  from: string;
  to: string;
  content: string;
  timestamp: number;
};

async function multiAgentApproach(task: string): Promise<AgentResult> {
  const messages: AgentMessage[] = [];
  let totalTokens = 0;
  let totalToolCalls = 0;

  const researchResult = await researcher.run(task);
  messages.push({
    from: "researcher",
    to: "coder",
    content: researchResult.content,
    timestamp: Date.now(),
  });
  totalTokens += researchResult.tokensUsed;
  totalToolCalls += researchResult.toolCalls;

  const coderInput = messages
    .filter((m) => m.to === "coder")
    .map((m) => `[来自 ${m.from}]：${m.content}`)
    .join("\n");

  const codeResult = await coder.run(coderInput);
  messages.push({
    from: "coder",
    to: "reviewer",
    content: codeResult.content,
    timestamp: Date.now(),
  });
  totalTokens += codeResult.tokensUsed;
  totalToolCalls += codeResult.toolCalls;

  const reviewerInput = messages
    .filter((m) => m.to === "reviewer")
    .map((m) => `[来自 ${m.from}]：${m.content}`)
    .join("\n");

  const reviewResult = await reviewer.run(reviewerInput);
  messages.push({
    from: "reviewer",
    to: "orchestrator",
    content: reviewResult.content,
    timestamp: Date.now(),
  });
  totalTokens += reviewResult.tokensUsed;
  totalToolCalls += reviewResult.toolCalls;

  return {
    content: messages.map((m) => `[${m.from} -> ${m.to}]：${m.content}`).join("\n\n"),
    tokensUsed: totalTokens,
    toolCalls: totalToolCalls,
  };
}
```

每个智能体只接收发给它的消息。没有上下文污染。研究者 5 万 token 的文档阅读永远不会进入审查者的上下文。

### 步骤 4：对比

```typescript
async function compare() {
  const task = "构建一个 Express.js API 的速率限制中间件";

  console.log("=== 单智能体 ===");
  const single = await singleAgentApproach(task);
  console.log(`Token 数：${single.tokensUsed}`);
  console.log(`工具调用次数：${single.toolCalls}`);

  console.log("\n=== 多智能体 ===");
  const multi = await multiAgentApproach(task);
  console.log(`Token 数：${multi.tokensUsed}`);
  console.log(`工具调用次数：${multi.toolCalls}`);
}
```

多智能体版本消耗的总 token 更多（三个智能体，三次独立的 LLM 调用），但每个智能体的上下文保持干净。每个阶段的质量都得到提升，因为系统提示是专用化的。

## 使用

本课将生成一个可复用的提示，用于决定何时采用多智能体。参见 `outputs/prompt-multi-agent-decision.md`。

## 练习

1. 添加第四个专精智能体：一个"测试者"智能体，从编码者接收代码，从审查者接收审查反馈，然后编写测试
2. 修改流水线，使审查者可以将反馈发回给编码者进行修订循环（最多 2 轮）
3. 将串行流水线转换为扇出模式：并行运行研究者和"需求分析"智能体，然后将它们的输出合并后传递给编码者

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------|---------|
| 群体 | "AI 智能体的蜂群思维" | 一组对等智能体，拥有共享状态，没有固定领导者。行为从局部交互中涌现。 |
| 编排器 | "老板智能体" | 一个智能体，其工具包括生成和管理其他智能体。它进行规划和委派，但可能不执行实际工作。 |
| 协调器 | "交通警察" | 一个非智能体组件（通常是代码，而非 LLM），根据规则在智能体之间路由消息。 |
| 共识 | "智能体们达成一致" | 一种协议，要求多个智能体在继续之前必须达成一致。用于需要解决冲突输出的场景。 |
| 涌现行为 | "智能体们自己搞定了" | 从智能体交互中产生的系统级模式，并非显式编程的结果。可能有用也可能有害。 |
| 扇出 / 扇入 | "面向智能体的 MapReduce" | 将任务拆分到并行智能体中（扇出），然后合并它们的结果（扇入）。 |
| 消息传递 | "智能体之间互相交谈" | 智能体之间的通信机制：从一个智能体发送到另一个智能体的结构化数据，取代共享的上下文窗口。 |

## 延伸阅读

- [《新兴 AI 智能体架构概览》](https://arxiv.org/abs/2409.02977)——多智能体模式综述
- [《AutoGen：赋能下一代 LLM 应用》](https://arxiv.org/abs/2308.08155)——微软的多智能体对话框架
- [《Claude Code 子智能体文档》](https://docs.anthropic.com/en/docs/claude-code)——Claude Code 如何使用 Task 进行委派
- [《CrewAI 文档》](https://docs.crewai.com/)——基于角色的多智能体框架
