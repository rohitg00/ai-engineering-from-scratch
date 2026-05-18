# 为什么需要多智能体？

> 单个智能体遇到瓶颈。明智的做法不是造一个更大的智能体——而是增加更多智能体。

**类型：** 学习
**语言：** TypeScript
**前置知识：** 第14阶段（智能体工程）
**时间：** 约60分钟

## 学习目标

- 识别单智能体天花板（上下文溢出、混合专业能力、串行瓶颈），并解释何时拆分为多个智能体是正确的选择
- 比较编排模式（流水线、并行扇出、监督者、层级式），并为给定的任务结构选择合适的一种
- 设计一个具有清晰角色边界、共享状态和通信契约的多智能体系统
- 分析多智能体复杂性（延迟、成本、调试难度）与单智能体简单性之间的权衡

## 问题所在

你在第14阶段构建了一个单智能体。它能工作。它可以读取文件、运行命令、调用API，并对结果进行推理。然后你让它面对一个真实的代码库：200个文件、三种语言、依赖基础设施的测试，以及在编写代码之前需要研究外部API的需求。

这个智能体卡住了。不是因为LLM笨，而是因为任务超出了单个智能体循环的处理能力。上下文窗口被文件内容填满。智能体忘记了40次工具调用前读取的内容。它试图同时充当研究员、编码者和审查者，结果三件事都做得不好。

这就是单智能体天花板。每当任务需要以下能力时，你就会遇到它：

- **上下文超过一个窗口的容量** —— 读取50个文件会超过20万token
- **不同阶段需要不同的专业能力** —— 研究需要与代码生成不同的提示策略
- **可以并行处理的工作** —— 既然可以同时读取三个文件，为什么要串行读取？

## 核心概念

### 单智能体天花板

单个智能体是一个循环、一个上下文窗口、一个系统提示。想象一下：

```
┌─────────────────────────────────────────┐
│            单智能体                     │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │         上下文窗口                │  │
│  │                                   │  │
│  │  研究笔记                         │  │
│  │  + 代码文件                       │  │
│  │  + 测试输出                       │  │
│  │  + 审查反馈                       │  │
│  │  + API文档                        │  │
│  │  + ...                            │  │
│  │                                   │  │
│  │  ██████████████████████ 已满 ███  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  一个系统提示试图覆盖                   │
│  研究 + 编码 + 审查 + 测试              │
│                                         │
│  结果：每件事都做得平庸                 │
└─────────────────────────────────────────┘
```

三件事会崩溃：

1. **上下文饱和** —— 工具结果不断堆积。到第30轮时，智能体已经消耗了15万token的文件内容、命令输出和先前推理。第5轮的关键细节已经丢失。

2. **角色混淆** —— 一个系统提示说"你是研究员、编码者、审查者和测试者"，产生的智能体只能半吊子研究、半吊子编码，永远完不成审查。

3. **串行瓶颈** —— 智能体先读取文件A，然后文件B，然后文件C。三次串行LLM调用。三次串行工具执行。没有并行性。

### 多智能体解决方案

拆分工作。给每个智能体分配一个任务、一个上下文窗口，以及一个针对该任务调优的系统提示：

```
┌──────────────────────────────────────────────────────────┐
│                    编排器                                │
│                                                          │
│  "构建一个用户管理的REST API"                            │
│                                                          │
│         ┌──────────┬──────────┬──────────┐               │
│         │          │          │          │               │
│         ▼          ▼          ▼          ▼               │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│   │ 研究员   │ │  编码者  │ │ 审查者   │ │ 测试者   │  │
│   │          │ │          │ │          │ │          │  │
│   │ 读取     │ │ 编写     │ │ 检查     │ │ 运行     │  │
│   │ 文档，   │ │ 代码     │ │ 代码     │ │ 测试，   │  │
│   │ 发现     │ │ 基于     │ │ 质量，   │ │ 报告     │  │
│   │ 模式     │ │ 研究+规范│ │ 发现bug  │ │ 结果     │  │
│   └─────┬────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│         │           │            │             │         │
│         └───────────┴────────────┴─────────────┘         │
│                          │                               │
│                     合并结果                             │
└──────────────────────────────────────────────────────────┘
```

每个智能体拥有：
- 一个专注的系统提示（"你是代码审查者。你唯一的任务是发现bug。"）
- 自己的上下文窗口（不会被其他智能体的工作污染）
- 清晰的输入/输出契约（接收研究笔记，输出代码）

### 实际应用此方法的系统

**Claude Code子智能体** —— 当Claude Code使用`Task`生成子智能体时，它会创建一个具有限定任务的子智能体。父智能体保持其上下文干净。子智能体执行专注的工作并返回摘要。

**Devin** —— 运行规划器智能体、编码者智能体和浏览器智能体。规划器将工作分解为步骤。编码者编写代码。浏览器研究文档。每个都有独立的上下文。

**多智能体编码团队（SWE-bench）** —— SWE-bench上表现最好的系统使用研究员读取代码库，规划器设计修复方案，编码者实现它。单智能体系统得分更低。

**ChatGPT深度研究** —— 并行生成多个搜索智能体，每个探索不同角度，然后综合结果。

### 光谱

多智能体不是二元的。它是一个光谱：

```
简单 ─────────────────────────────────────────── 复杂

 单智能体     子智能体      流水线       团队        群体

 ┌───┐       ┌───┐        ┌───┐───┐    ┌───┐───┐    ┌─┐┌─┐┌─┐
 │ A │       │ A │        │ A │ B │    │ A │ B │    │ ││ ││ │
 └───┘       └─┬─┘        └───┘─┬─┘    └─┬─┘─┬─┘    └┬┘└┬┘└┬┘
               │                │        │   │       ┌┴──┴──┴┐
             ┌─┴─┐          ┌───┘───┐    │   │       │共享   │
             │ a │          │ C │ D │  ┌─┴───┴─┐    │状态   │
             └───┘          └───┘───┘  │ 消息   │    └───────┘
                                       │ 总线   │
 1个循环     父级 +       按阶段      │       │    N个对等体，
 1个上下文   子任务       执行         └───────┘    涌现行为
                                       显式      
                                       角色
```

**单智能体** —— 一个循环，一个提示。适合简单任务。

**子智能体** —— 父级为专注的子任务生成子级。父级维护计划。子级报告回来。这就是Claude Code的做法。

**流水线** —— 智能体按顺序运行。智能体A的输出成为智能体B的输入。适合分阶段工作流：研究 -> 编码 -> 审查 -> 测试。

**团队** —— 智能体通过共享消息总线并行运行。每个都有角色。编排器协调。当需要同时使用不同技能时很有用。

**群体** —— 许多相同或几乎相同的智能体共享状态。没有固定的编排器。智能体从队列中拾取工作。适合高吞吐量并行任务。

### 四种多智能体模式

#### 模式1：流水线

```
输入 ──▶ 智能体A ──▶ 智能体B ──▶ 智能体C ──▶ 输出
          (研究)      (编码)      (审查)
```

每个智能体转换数据并向前传递。简单易懂。一个阶段的失败会阻塞其余阶段。

#### 模式2：扇出/扇入

```
                ┌──▶ 智能体A ──┐
                │              │
输入 ──▶ 拆分 ├──▶ 智能体B ──├──▶ 合并 ──▶ 输出
                │              │
                └──▶ 智能体C ──┘
```

将工作拆分到并行智能体，然后合并结果。适合可分解为独立子任务的任务。

#### 模式3：编排器-工作者

```
                    ┌──────────┐
                    │  编排器  │
                    └──┬───┬───┘
                  任务 │   │ 任务
                 ┌─────┘   └─────┐
                 ▼               ▼
           ┌──────────┐   ┌──────────┐
           │ 工作者A  │   │ 工作者B  │
           └──────────┘   └──────────┘
```

一个智能编排器决定做什么，委派给工作者，并综合结果。编排器本身是一个具有生成工作者工具的智能体。

#### 模式4：对等群体

```
         ┌───┐ ◄──── 消息 ────▶ ┌───┐
         │ A │                  │ B │
         └─┬─┘                  └─┬─┘
           │                      │
      消息 │    ┌───────────┐     │ 消息
           └───▶│   共享    │◄────┘
                │   状态    │
           ┌───▶│  / 队列   │◄────┐
           │    └───────────┘     │
      消息 │                      │ 消息
         ┌─┴─┐                  ┌─┴─┐
         │ C │ ◄──── 消息 ────▶ │ D │
         └───┘                  └───┘
```

没有中央编排器。智能体对等通信。决策从交互中涌现。更难调试，但可扩展到许多智能体。

### 何时不使用多智能体

多智能体增加了复杂性。智能体之间的每条消息都是潜在的故障点。调试从"读取一个对话"变成"追踪五个智能体之间的消息"。

**在以下情况保持单智能体：**
- 任务适合一个上下文窗口（工作数据少于约10万token）
- 不同阶段不需要不同的系统提示
- 串行执行足够快
- 任务足够简单，拆分它增加的负担大于价值

**复杂性成本：**
- 每个智能体边界都是有损压缩步骤：智能体A的完整上下文被压缩成给智能体B的消息
- 协调逻辑（谁做什么、何时做、按什么顺序）本身就是bug的来源
- 延迟增加：N个智能体意味着至少N次串行LLM调用，如果它们需要来回通信则更多
- 成本倍增：每个智能体独立消耗token

经验法则：如果任务需要少于20次工具调用且适合10万token，保持单智能体。

## 构建它

### 步骤1：过载的单智能体

这里是一个试图做所有事情的单智能体。它有一个庞大的系统提示和一个保存研究、代码和审查的上下文窗口：

```typescript
type AgentResult = {
  content: string;
  tokensUsed: number;
  toolCalls: number;
};

async function singleAgentApproach(task: string): Promise<AgentResult> {
  const systemPrompt = `你是一个全栈开发者。你必须：
1. 研究需求
2. 编写代码
3. 审查代码中的bug
4. 编写测试
在单个对话中完成所有这些。`;

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
    `基于所有先前的上下文：\n${contextWindow.join("\n")}\n\n审查代码。`
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
- 上下文窗口随着每个阶段增长。到审查步骤时，它包含研究笔记AND代码AND先前推理。
- 系统提示是通用的。无法为每个阶段调优。
- 没有并行执行。

### 步骤2：专家智能体

现在拆分它。每个智能体得到一个任务：

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
  "研究员",
  "你是一个技术研究员。阅读文档，发现模式，并总结发现。只输出实现所需的事实。"
);

const coder = createSpecialist(
  "编码者",
  "你是一个资深TypeScript开发者。给定需求和研究笔记，编写干净、经过测试的代码。仅此而已。"
);

const reviewer = createSpecialist(
  "审查者",
  "你是一个代码审查者。发现bug、安全问题和逻辑错误。要具体。引用行号。"
);
```

每个专家都有一个专注的提示。每个都得到只有它需要输入的干净上下文窗口。

### 步骤3：通过消息协调

用显式消息传递将专家连接起来：

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
    from: "研究员",
    to: "编码者",
    content: researchResult.content,
    timestamp: Date.now(),
  });
  totalTokens += researchResult.tokensUsed;
  totalToolCalls += researchResult.toolCalls;

  const coderInput = messages
    .filter((m) => m.to === "编码者")
    .map((m) => `[来自 ${m.from}]：${m.content}`)
    .join("\n");

  const codeResult = await coder.run(coderInput);
  messages.push({
    from: "编码者",
    to: "审查者",
    content: codeResult.content,
    timestamp: Date.now(),
  });
  totalTokens += codeResult.tokensUsed;
  totalToolCalls += codeResult.toolCalls;

  const reviewerInput = messages
    .filter((m) => m.to === "审查者")
    .map((m) => `[来自 ${m.from}]：${m.content}`)
    .join("\n");

  const reviewResult = await reviewer.run(reviewerInput);
  messages.push({
    from: "审查者",
    to: "编排器",
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

每个智能体只接收发送给它的消息。没有上下文污染。研究员的5万token文档阅读永远不会进入审查者的上下文。

### 步骤4：比较

```typescript
async function compare() {
  const task = "为Express.js API构建一个速率限制中间件";

  console.log("=== 单智能体 ===");
  const single = await singleAgentApproach(task);
  console.log(`Token数：${single.tokensUsed}`);
  console.log(`工具调用：${single.toolCalls}`);

  console.log("\n=== 多智能体 ===");
  const multi = await multiAgentApproach(task);
  console.log(`Token数：${multi.tokensUsed}`);
  console.log(`工具调用：${multi.toolCalls}`);
}
```

多智能体版本使用更多总token（三个智能体，三次独立LLM调用），但每个智能体的上下文保持干净。每个阶段的质量提高，因为系统提示是专业化的。

## 使用它

本课程生成一个可重用的提示，用于决定何时使用多智能体。参见 `outputs/prompt-multi-agent-decision.md`。

## 练习

1. 添加第四个专家：一个"测试者"智能体，接收来自编码者的代码和来自审查者的审查反馈，然后编写测试
2. 修改流水线，使审查者可以将反馈发送回编码者进行修订循环（最多2轮）
3. 将串行流水线转换为扇出：并行运行研究员和"需求分析器"智能体，然后在传递给编码者之前合并它们的输出

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| 群体 | "AI智能体的蜂巢思维" | 一组具有共享状态且无固定领导者的对等智能体。行为从局部交互中涌现。 |
| 编排器 | "老板智能体" | 一个工具包括生成和管理其他智能体的智能体。它计划和委派，但可能不做实际工作。 |
| 协调器 | "交通警察" | 一个非智能体组件（通常只是代码，不是LLM），根据规则在智能体之间路由消息。 |
| 共识 | "智能体们达成一致" | 多个智能体必须在继续之前达成一致的协议。用于需要解决冲突输出时。 |
| 涌现行为 | "智能体们自己搞明白了" | 从智能体交互中出现的系统级模式，但未被显式编程。可能有用也可能有害。 |
| 扇出/扇入 | "智能体的Map-Reduce" | 将任务拆分到并行智能体（扇出），然后合并它们的结果（扇入）。 |
| 消息传递 | "智能体们互相交谈" | 智能体之间的通信机制：从一个智能体发送到另一个智能体的结构化数据，替代共享上下文窗口。 |

## 延伸阅读

- [新兴AI智能体架构全景](https://arxiv.org/abs/2409.02977) - 多智能体模式综述
- [AutoGen：赋能下一代LLM应用](https://arxiv.org/abs/2308.08155) - 微软的多智能体对话框架
- [Claude Code子智能体文档](https://docs.anthropic.com/en/docs/claude-code) - Claude Code如何使用Task进行委派
- [CrewAI文档](https://docs.crewai.com/) - 基于角色的多智能体框架