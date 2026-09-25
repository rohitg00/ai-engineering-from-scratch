# 为什么需要多智能体？

> 单个智能体遇到瓶颈。聪明的做法不是造一个更大的智能体，而是使用更多智能体。

**Type:** Learn
**Languages:** TypeScript
**Prerequisites:** Phase 14 (Agent Engineering)
**Time:** ~60 分钟

## 学习目标

- 识别单智能体的上限（上下文溢出、专业能力混杂、串行瓶颈），并解释何时拆分为多个智能体是正确的选择
- 比较各种编排模式（pipeline、并行 fan-out、supervisor、hierarchical），并针对给定任务结构选择合适的模式
- 设计一个具有清晰角色边界、共享状态和通信契约的多智能体系统
- 分析多智能体复杂性（延迟、成本、调试难度）与单智能体简单性之间的权衡

## 问题所在

你在 Phase 14 中构建了一个单智能体。它能正常工作：可以读取文件、运行命令、调用 API，并对结果进行推理。然后你把它指向一个真实的代码库：200 个文件、三种语言、依赖基础设施的测试，以及一个要求——在写代码之前先调研外部 API。

这个智能体崩溃了。不是因为 LLM 笨，而是因为任务超出了单个智能体循环所能处理的范围。上下文窗口被文件内容塞满。智能体忘记了 40 次工具调用之前读到的内容。它试图同时充当调研员、程序员和审查者，结果三件事都做不好。

这就是单智能体的上限。每当任务满足以下条件时，你都会撞上它：

- **上下文超出单个窗口的容量** - 读取 50 个文件会超出 200k token
- **不同阶段需要不同的专业能力** - 调研所需的提示词与代码生成不同
- **工作可以并行进行** - 既然可以同时读取三个文件，为什么还要串行读取？

## 概念

### 单智能体的上限

单智能体就是：一个循环、一个上下文窗口、一个系统提示词。想象一下：

```
┌─────────────────────────────────────────┐
│            SINGLE AGENT                 │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │         Context Window            │  │
│  │                                   │  │
│  │  research notes                   │  │
│  │  + code files                     │  │
│  │  + test output                    │  │
│  │  + review feedback                │  │
│  │  + API docs                       │  │
│  │  + ...                            │  │
│  │                                   │  │
│  │  ██████████████████████ FULL ███  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  One system prompt tries to cover       │
│  research + coding + review + testing   │
│                                         │
│  Result: mediocre at everything         │
└─────────────────────────────────────────┘
```

有三件事会出问题：

1. **上下文饱和** - 工具结果不断堆积。到第 30 轮时，智能体已经消耗了 150k token 的文件内容、命令输出和先前推理。第 5 轮的关键细节被遗忘了。

2. **角色混乱** - 一个写着“你是调研员、程序员、审查者和测试员”的系统提示词，会产生一个半途调研、半途写码、从不完成审查的智能体。

3. **串行瓶颈** - 智能体先读文件 A，再读文件 B，再读文件 C。三次串行的 LLM 调用。三次串行的工具执行。没有任何并行。

### 多智能体解决方案

拆分工作。给每个智能体分配一个任务、一个上下文窗口和一个为该任务专门调优的系统提示词：

```
┌──────────────────────────────────────────────────────────┐
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
│   └─────┬────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│         │           │            │             │         │
│         └───────────┴────────────┴─────────────┘         │
│                          │                               │
│                     Merge results                        │
└──────────────────────────────────────────────────────────┘
```

每个智能体拥有：
- 一个专注的系统提示词（“你是代码审查员。你唯一的任务是找出 bug。”）
- 自己的上下文窗口（不被其他智能体的工作污染）
- 一个清晰的输入/输出契约（接收调研笔记，输出代码）

### 采用这种方案的真实系统

**Claude Code subagents** - 当 Claude Code 用 `Task` 生成一个子智能体时，它会创建一个具有限定范围任务的子智能体。父智能体保持上下文干净。子智能体执行专注的工作并返回摘要。

**Devin** - 运行一个规划智能体、一个编码智能体和一个浏览器智能体。规划者把工作拆解成步骤。编码者写代码。浏览器智能体调研文档。各自拥有独立的上下文。

**多智能体编码团队（SWE-bench）** - SWE-bench 上表现最好的系统使用一个读取代码库的调研者、一个设计修复方案的规划者和一个实现修复的编码者。单智能体系统得分更低。

**ChatGPT Deep Research** - 并行生成多个搜索智能体，每个从不同角度进行探索，然后综合结果。

### 光谱

多智能体不是二元的。它是一个光谱：

```
SIMPLE ──────────────────────────────────────────── COMPLEX

 Single        Sub-         Pipeline      Team         Swarm
 Agent         agents

 ┌───┐       ┌───┐        ┌───┐───┐    ┌───┐───┐    ┌─┐┌─┐┌─┐
 │ A │       │ A │        │ A │ B │    │ A │ B │    │ ││ ││ │
 └───┘       └─┬─┘        └───┘─┬─┘    └─┬─┘─┬─┘    └┬┘└┬┘└┬┘
               │                │        │   │       ┌┴──┴──┴┐
             ┌─┴─┐          ┌───┘───┐    │   │       │shared │
             │ a │          │ C │ D │  ┌─┴───┴─┐    │ state │
             └───┘          └───┘───┘  │  msg   │    └───────┘
                                       │  bus   │
 1 loop      Parent +      Stage by    │       │    N peers,
 1 context   child tasks   stage       └───────┘    emergent
                                       Explicit      behavior
                                       roles
```

**Single agent** - 一个循环、一个提示词。适合简单任务。

**Subagents** - 父智能体为专注的子任务生成子智能体。父智能体维护计划。子智能体汇报结果。这就是 Claude Code 的做法。

**Pipeline** - 智能体按顺序运行。智能体 A 的输出成为智能体 B 的输入。适合分阶段的工作流：调研 -> 编码 -> 审查 -> 测试。

**Team** - 智能体通过共享消息总线并行运行。每个智能体有一个角色。一个协调器负责协调。适合需要同时运用不同技能的场景。

**Swarm** - 大量相同或近似的智能体共享状态。没有固定的协调器。智能体从队列中领取任务。适合高吞吐量的并行任务。

### 四种多智能体模式

#### 模式 1：Pipeline

```
Input ──▶ Agent A ──▶ Agent B ──▶ Agent C ──▶ Output
          (research)  (code)      (review)
```

每个智能体转换数据并传递给下一个。易于推理。某个阶段失败会阻塞后续所有阶段。

#### 模式 2：Fan-out / Fan-in

```
                ┌──▶ Agent A ──┐
                │              │
Input ──▶ Split ├──▶ Agent B ──├──▶ Merge ──▶ Output
                │              │
                └──▶ Agent C ──┘
```

将工作拆分给并行智能体，然后合并结果。适合可分解为独立子任务的工作。

#### 模式 3：Orchestrator-Worker

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

一个聪明的协调器决定要做什么，委派给工作者，然后综合结果。协调器本身也是一个智能体，拥有生成工作者的工具。

#### 模式 4：Peer Swarm

```
         ┌───┐ ◄──── msg ────▶ ┌───┐
         │ A │                  │ B │
         └─┬─┘                  └─┬─┘
           │                      │
      msg  │    ┌───────────┐     │ msg
           └───▶│  Shared   │◄────┘
                │  State    │
           ┌───▶│  / Queue  │◄────┐
           │    └───────────┘     │
      msg  │                      │ msg
         ┌─┴─┐                  ┌─┴─┐
         │ C │ ◄──── msg ────▶ │ D │
         └───┘                  └───┘
```

没有中央协调器。智能体之间点对点通信。决策从交互中涌现。更难调试，但可扩展到大量智能体。

### 何时不应使用多智能体

多智能体会增加复杂性。智能体之间的每条消息都是一个潜在故障点。调试从“读一段对话”变成“追踪跨越五个智能体的消息”。

**以下情况保持单智能体：**
- 任务能放进一个上下文窗口（工作数据少于约 100k token）
- 不同阶段不需要不同的系统提示词
- 串行执行已足够快
- 任务足够简单，拆分带来的开销大于收益

**复杂性的代价：**
- 每个智能体边界都是一次有损压缩：智能体 A 的完整上下文被压缩成发给智能体 B 的消息
- 协调逻辑（谁在什么时间、以什么顺序做什么）本身就是 bug 的来源
- 延迟增加：N 个智能体意味着至少 N 次串行 LLM 调用，如果需要来回沟通则更多
- 成本成倍增加：每个智能体独立消耗 token

经验法则：如果一个任务少于 20 次工具调用且能放进 100k token，就保持单智能体。

```figure
swarm-messages
```

## 动手构建

### 步骤 1：不堪重负的单智能体

下面是一个试图包办一切的单智能体。它有一个庞大的系统提示词和一个包含调研、代码和审查内容的上下文窗口：

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

这种做法的问题：
- 上下文窗口随每个阶段不断增长。到审查阶段时，它包含调研笔记、代码和先前的推理。
- 系统提示词是通用的。无法针对每个阶段进行调优。
- 没有任何并行运行。

### 步骤 2：专家智能体

现在进行拆分。每个智能体只有一个任务：

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

每个专家都有一个专注的提示词。每个都拥有一个干净的上下文窗口，只包含它需要的输入。

### 步骤 3：通过消息协调

用显式的消息传递把专家连接起来：

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
    .map((m) => `[From ${m.from}]: ${m.content}`)
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
    .map((m) => `[From ${m.from}]: ${m.content}`)
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
    content: messages.map((m) => `[${m.from} -> ${m.to}]: ${m.content}`).join("\n\n"),
    tokensUsed: totalTokens,
    toolCalls: totalToolCalls,
  };
}
```

每个智能体只接收发给它的消息。没有上下文污染。调研者的 50k token 文档阅读内容永远不会进入审查者的上下文。

### 步骤 4：比较

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

多智能体版本使用更多总 token（三个智能体、三次独立的 LLM 调用），但每个智能体的上下文保持干净。每个阶段的质量都得到提升，因为系统提示词是专门化的。

## 使用

本课产出一个可复用的提示词，用于决定何时采用多智能体。参见 `outputs/prompt-multi-agent-decision.md`。

## 练习

1. 增加第四个专家：一个"tester"智能体，接收编码者产出的代码和审查者的反馈，然后编写测试
2. 修改 pipeline，让审查者可以把反馈发回给编码者进行修订循环（最多 2 轮）
3. 把串行 pipeline 转换为 fan-out：让调研者和一个"requirements analyzer"智能体并行运行，然后在传递给编码者之前合并它们的输出

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| Swarm | “AI 智能体的蜂群思维” | 一组具有共享状态、没有固定领导者的对等智能体。行为从局部交互中涌现。 |
| Orchestrator | “老板智能体” | 一个其工具包括生成和管理其他智能体的智能体。它负责规划和委派，但不一定亲自执行实际工作。 |
| Coordinator | “交通警察” | 一个非智能体组件（通常只是代码，而非 LLM），根据规则在智能体之间路由消息。 |
| Consensus | “智能体们达成一致” | 一种要求多个智能体在继续之前必须达成一致的协议。用于需要解决输出冲突的情况。 |
| Emergent behavior | “智能体们自己想明白了” | 从智能体交互中产生的系统级模式，但未被显式编程。可能有益也可能有害。 |
| Fan-out / fan-in | “智能体版的 Map-Reduce” | 将任务拆分给并行智能体（fan-out），然后合并它们的结果（fan-in）。 |
| Message passing | “智能体之间互相交谈” | 智能体之间的通信机制：从一个智能体发送到另一个智能体的结构化数据，取代共享的上下文窗口。 |

## 延伸阅读

- [The Landscape of Emerging AI Agent Architectures](https://arxiv.org/abs/2409.02977) - 多智能体模式综述
- [AutoGen: Enabling Next-Gen LLM Applications](https://arxiv.org/abs/2308.08155) - 微软的多智能体对话框架
- [Claude Code subagents documentation](https://docs.anthropic.com/en/docs/claude-code) - Claude Code 如何用 Task 进行委派
- [CrewAI documentation](https://docs.crewai.com/) - 基于角色的多智能体框架