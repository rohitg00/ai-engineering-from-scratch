# 为什么需要多智能体？

> 一个智能体遇到瓶颈。聪明的做法不是更大的智能体——而是更多智能体。

**类型：** 学习
**语言：** TypeScript
**前置条件：** 第14阶段（智能体工程）
**时间：** 约60分钟

## 学习目标

- 识别单智能体瓶颈（上下文溢出、专业混合、顺序瓶颈）并解释何时拆分为多个智能体是正确的选择
- 比较编排模式（流水线、并行扇出、监督者、分层）并为给定任务结构选择正确的模式
- 设计具有清晰角色边界、共享状态和通信契约的多智能体系统
- 分析多智能体复杂性的权衡（延迟、成本、调试难度）与单智能体简单性

## 问题

你在第14阶段构建了一个单智能体。它可以工作。它可以读取文件、运行命令、调用 API 并对结果进行推理。然后你将它指向一个真实代码库：200个文件、三种语言、依赖于基础设施的测试，以及编写代码前研究外部 API 的要求。

智能体窒息了。不是因为 LLM 很笨，而是因为任务超出了单个智能体循环可以处理的范围。上下文窗口被文件内容填满。智能体忘记了40个工具调用前读取的内容。它试图同时成为研究员、编程员和审查员，并且三者都做不好。

这就是单智能体瓶颈。你在以下情况下会遇到它：

- **超过单个窗口可以容纳的更多上下文** - 读取50个文件会超过200k Token
- **不同阶段需要不同专业知识** - 研究需要与代码生成不同的提示
- **可以并行发生的工作** - 为什么在可以并行读取它们时顺序读取三个文件？

## 概念

### 单智能体瓶颈

单个智能体是一个循环、一个上下文窗口、一个系统提示。设想一下：

```
┌─────────────────────────────────┐
│            SINGLE AGENT                 │
│                                         │
│  ┌───────────────────────────┐  │
│  │         Context Window            │  │
│  │                                   │  │
│  │  research notes                   │  │
│  │  + code files                     │  │
│  │  + test output                    │  │
│  │  + review feedback                │  │
│  │  + API docs                       │  │
│  │  + ...                            │  │
│  │                                   │  │
│  │  ███████████████████ FULL ███  │  │
│  └───────────────────────────┘  │
│                                         │
│  One system prompt tries to cover       │
│  research + coding + review + testing   │
│                                         │
│  Result: mediocre at everything         │
└─────────────────────────────────┘
```

三件事会损坏：

1. **上下文饱和** - 工具结果堆积。到第30轮时，智能体已经消耗了150k Token 的文件内容、命令输出和先前的推理。第5轮的关键细节丢失了。
2. **角色混淆** - 一个说"你是研究员、编程员、审查员和测试员"的系统提示会产生一个半研究、半编码并且从不完成审查的智能体。
3. **顺序瓶颈** - 智能体先读取文件 A，然后文件 B，然后文件 C。三个串行 LLM 调用。零并行性。

### 多智能体解决方案

拆分工作。给每个智能体一个工作、一个上下文窗口和一个针对该工作调整的系统提示：

```
┌──────────────────────────────────────────┐
│                    ORCHESTRATOR                          │
│                                                          │
│  "Build a REST API for user management"                  │
│                                                          │
│         ┌──────────┬──────────┬──────────┐               │
│         │          │          │          │               │
│         ▼          ▼          ▼          ▼               │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│   │RESEARCHER│ │  CODER   │ │ REVIEWER │ │  TESTER  │  │
│   │          │ │          │ │          │ │          │  │
│   │ Reads    │ │ Writes   │ │ Checks   │ │ Runs     │  │
│   │ docs,    │ │ code     │ │ code     │ │ tests,   │  │
│   │ finds    │ │ based on │ │ quality, │ │ reports  │  │
│   │ patterns │ │ research │ │ finds    │ │ results  │  │
│   │          │ │ + spec   │ │ bugs     │ │          │  │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│         │           │            │         │
│         └──────────┴────────────┴─────────┘
│                          │                               │
│                     Merge results                        │
└──────────────────────────────────────────┘
```

每个智能体都有：

- 一个专注的系统提示（"你是一个代码审查员。你唯一的工作是找到 Bug。"）
- 它自己的上下文窗口（不被其他智能体的工作污染）
- 清晰的输入/输出契约（接收研究笔记，输出代码）

### 实践中的真实系统

**Claude Code 子智能体** - 当 Claude Code 使用 `Task` 生成子智能体时，它会创建一个具有范围任务子智能体。父智能体保持其上下文清洁。子智能体执行专注的工作并返回摘要。

**Devin** - 运行规划器智能体、编程员智能体和浏览器智能体。规划器将工作分解为步骤。编程员编写代码。浏览器研究文档。每个都有独立的上下文。

**多智能体编码团队（SWE-bench）** - SWE-bench 上表现最好的系统使用阅读代码库的研究员、设计修复的规划器和实现它的编程员。单智能体系统得分较低。

**ChatGPT 深度研究** - 并行生成多个搜索智能体，每个探索不同的角度，然后综合结果。

### 谱系

多智能体不是二进制。它是一个谱系：

```
SIMPLE ─────────────────────────────────── COMPLEX

 Single        Sub-         Pipeline      Team         Swarm
 Agent         agents
                │
 ┌───┐       ┌───┐        ┌───┐───┐    ┌───┐───┐    ┌─┐┌─┐┌─┐
 │ A │       │ A │        │ A │ B │    │ A │ B │    │ ││ ││ ││
 └───┘       └───┘        └───┘───┘    └───┘───┘    └─┘└─┘└─┘
               │                │   │         │   │       │
             ┌───┴───┐          │   │         ┌───┴───┐    ┌──┴───┴───┐
             │ a │          │ │         │  msg   │    │   shared │
             └───┘          │   │         │  bus   │    │   state │
                               │   │         └───┴───┘    └───────────┘
```

**单个智能体** - 一个循环，一个提示。适用于简单任务。

**子智能体** - 父智能体为专注的子任务生成子代。父智能体保持计划。子代报告回来。这是 Claude Code 所做的。

**流水线** - 智能体按顺序运行。智能体 A 的输出成为智能体 B 的输入。适用于分阶段工作流：研究 -> 代码 -> 审查 -> 测试。

**团队** - 智能体通过共享消息总线并行运行。每个都有一个角色。编排器进行协调。当同时需要不同技能时很好。

**群体** - 许多相同或接近相同的智能体具有共享状态。没有固定的编排器。智能体从队列中拾取工作。适用于高吞吐量并行任务。

### 四种多智能体模式

#### 模式1：流水线

```
Input ──▶ Agent A ──▶ Agent B ──▶ Agent C ──▶ Output
          (research)  (code)      (review)
```

每个智能体转换数据并将其向前传递。易于推理。一个阶段的失败会阻止其余部分。

#### 模式2：扇出/扇入

```
                ┌───▶ Agent A ──┐
                │              │
Input ──▶ Split ├──▶ Agent B ──┼──▶ Merge ──▶ Output
                │              │
                └───▶ Agent C ──┘
```

将工作拆分到并行智能体上，然后合并结果。适用于分解为独立子任务的任务。

#### 模式3：编排器-工作器

```
                    ┌──────────┐
                    │  Orch.   │
                    └──┬───┬───┘
                  task │   │ task
                 ┌─────┘   └─────┐
                 ▼               ▼
           ┌──────────┐   ┌──────────┐
           │ Worker A │   │ Worker B │
           └──────────┘   └──────────┘
```

智能编排器决定要做什么，委托给工作器，并综合结果。编排器本身是一个带有生成工作器工具的智能体。

#### 模式4：对等群体

```
         ┌───┐ ◄──── msg ───▶ ┌───┐
         │ A │                  │ B │
         └───┬───┘                  └───┬───┘
           │                      │
      msg  │    ┌──────────┐     │ msg
           └───▶│  Shared   │◄────┘
                │  State    │
           ┌───▶│  / Queue  │◄────┐
           │    └──────────┘     │
      msg  │                      │ msg
         ┌───┐                  ┌───┐
         │ C │ ◄──── msg ────▶ │ D │
         └───┘                  └───┘
```

没有中央编排器。智能体点对点通信。决策从交互中出现。更难调试，但扩展到许多智能体。

### 何时不使用多智能体

多智能体会增加复杂性。智能体之间的每条消息都是一个潜在的失败点。调试从"读取一个对话"变为"跨五个智能体追踪消息"。

**保持单智能体当：**

- 任务适合一个上下文窗口（约100k Token 的工作数据）
- 你不需要不同阶段的不同系统提示
- 顺序执行足够快
- 任务足够简单，拆分它增加的负担超过价值

**复杂性成本：**

- 每个智能体边界都是一个有损压缩步骤：智能体 A 的完整上下文被总结为智能体 B 的消息
- 协调逻辑（谁做什么、何时、什么顺序）本身就是 Bug 的来源
- 延迟增加：N 个智能体意味着最少 N 个串行 LLM 调用，如果它们需要来回对话则会更多
- 成本倍增：每个智能体独立消耗 Token

经验法则：如果任务需要少于20个工具调用并且适合100k Token，就保持单智能体。

## 构建它

### 第1步：过载的单智能体

这是一个试图做所有事情的单智能体。它有一个巨大的系统提示和一个保存研究、代码和审查的上下文窗口：

```typescript
type AgentResult = {
  content: string;
  tokensUsed: number;
  toolCalls: number;
};

async function singleAgentApproach(task: string): Promise<AgentResult> {
  const systemPrompt = `You are a full-stack developer. You must:
1. Research the requirements
2. Write the code
3. Review the code for bugs
4. Write tests
Do ALL of these in a single conversation.`;
  
  const contextWindow: string[] = [];
  let totalTokens = 0;
  let totalToolCalls = 0;
  
  const research = await fakeLLMCall(systemPrompt, `Research: ${task}`);
  contextWindow.push(research.output);
  totalTokens += research.tokens;
  totalToolCalls += research.calls;
  
  const code = await fakeLLMCall(
    systemPrompt,
    `Given this research:\n${contextWindow.join("\n")}\n\nNow write code for: ${task}`
  );
  contextWindow.push(code.output);
  totalTokens += code.tokens;
  totalToolCalls += code.calls;
  
  const review = await fakeLLMCall(
    systemPrompt,
    `Given all previous context:\n${contextWindow.join("\n")}\n\nReview the code.`
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

- 上下文窗口随每个阶段增长。到审查步骤时，它包含研究笔记 AND 代码 AND 先前的推理。
- 系统提示是通用的。它不能在每​​个阶段进行调整。
- 没有东西并行运行。

### 第2步：专业智能体

现在拆分它。每个智能体获得一个工作：

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
  "You are a technical researcher. Read documentation, find patterns, and summarize findings. Output only the facts needed for implementation."
);

const coder = createSpecialist(
  "coder",
  "You are a senior TypeScript developer. Given requirements and research notes, write clean, tested code. Nothing else."
);

const reviewer = createSpecialist(
  "reviewer",
  "You are a code reviewer. Find bugs, security issues, and logic errors. Be specific. Cite line numbers."
);
```

每个专家都有一个专注的提示。每个都获得仅包含其所需输入的干净上下文窗口。

### 第3步：通过消息进行协调

通过显式消息传递将专家连接在一起：

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
    .filter(m => m.to === "coder")
    .map(m => `[From ${m.from}]: ${m.content}`)
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
    .filter(m => m.to === "reviewer")
    .map(m => `[From ${m.from}]: ${m.content}`)
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
    content: messages.map(m => `[${m.from} -> ${m.to}]: ${m.content}`).join("\n\n"),
    tokensUsed: totalTokens,
    toolCalls: totalToolCalls,
  };
}
```

每个智能体仅接收发送给它的消息。没有上下文污染。研究员50k Token 的文档读取永远不会进入审查员的上下文。

### 第4步：比较

```typescript
async function compare() {
  const task = "Build a rate limiter middleware for an Express.js API";
  
  console.log("=== Single Agent ===");
  const single = await singleAgentApproach(task);
  console.log(`Tokens: ${single.tokensUsed}`);
  console.log(`Tool calls: ${single.toolCalls}`);
  
  console.log("\n=== Multi-Agent ===");
  const multi = await multiAgentApproach(task);
  console.log(`Tokens: ${multi.tokensUsed}`);
  console.log(`Tool calls: ${multi.toolCalls}`);
}
```

多智能体版本使用更多总 Token（三个智能体，三个独立的 LLM 调用），但每个智能体的上下文保持清洁。每个阶段的质量提高了，因为系统提示是专业化的。

## 使用它

本课生成一个可重用的提示，用于决定何时转向多智能体。请参见 `outputs/prompt-multi-agent-decision.md`。

## 练习

1. 添加第四个专家："测试员"智能体，它从编程员接收代码并从审查员接收反馈，然后编写测试
2. 修改流水线，以便审查员可以将反馈发送回编程员进行修订循环（最多2轮）
3. 将顺序流水线转换为扇出：并行运行研究员和"需求分析员"智能体，然后在传递到编程员之前合并其输出

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|----------------------|
| 群体（Swarm） | "AI 智能体的蜂巢思维" | 一组具有共享状态且没有固定领导者的对等智能体。行为从本地交互中出现。 |
| 编排器（Orchestrator） | "老板智能体" | 一个工具包括生成和管理其他智能体的智能体。它进行规划和委托，但可能不会做实际工作。 |
| 协调器（Coordinator） | "交通警察" | 一个非智能体组件（通常只是代码，不是 LLM），它根据规则在智能体之间路由消息。 |
| 共识（Consensus） | "智能体同意" | 一种协议，其中多个智能体必须在继续之前达成共识。当冲突的输出需要解决时使用。 |
| 涌现行为（Emergent behavior） | "智能体自己弄清楚" | 从智能体交互出现的系统级模式，但没有显式编程。可能是有用的或有害的。 |
| 扇出/扇入（Fan-out / fan-in） | "智能体的 Map-reduce" | 将任务拆分到并行智能体（扇出），然后合并其结果（扇入）。 |
| 消息传递（Message passing） | "智能体互相交谈" | 智能体之间的通信机制：从一个智能体发送到另一个智能体的结构化数据，替换共享上下文窗口。 |

## 延伸阅读

- [新兴 AI 智能体架构的景观](https://arxiv.org/abs/2409.02977) - 多智能体模式的调查
- [AutoGen：启用下一代 LLM 应用程序](https://arxiv.org/abs/2308.08155) - Microsoft 的多智能体对话框架
- [Claude Code 子智能体文档](https://docs.anthropic.com/en/docs/claude-code) - Claude Code 如何使用 Task 进行委托
- [CrewAI 文档](https://docs.crewai.com/) - 基于角色的多智能体框架
