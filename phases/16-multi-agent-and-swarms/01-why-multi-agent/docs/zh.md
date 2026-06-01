# 01 · 为什么要用多智能体？

> 单个智能体会撞上天花板。聪明的做法不是造一个更大的智能体，而是用更多的智能体。

**类型：** 学习
**语言：** TypeScript
**前置：** 阶段 14（智能体工程 Agent Engineering）
**时长：** 约 60 分钟

## 学习目标

- 识别「单智能体天花板（single-agent ceiling）」（上下文溢出、专长混杂、串行瓶颈），并解释在什么情况下拆分为多个智能体才是正确的选择
- 比较各种编排模式（流水线 pipeline、并行扇出 parallel fan-out、监督者 supervisor、分层 hierarchical），并为给定的任务结构选出合适的模式
- 设计一个具有清晰角色边界、共享状态和通信契约的多智能体系统
- 分析多智能体复杂度（延迟、成本、调试难度）与单智能体简洁性之间的权衡

## 问题所在

你在阶段 14 构建了一个单智能体。它能正常工作：能读文件、执行命令、调用 API，并对结果进行推理。然后你把它指向一个真实的代码库：200 个文件、三种语言、依赖基础设施的测试，还要求在写代码前先研究外部 API。

这个智能体卡住了。不是因为 LLM 笨，而是因为任务超出了单个智能体循环所能处理的范围。上下文窗口被文件内容塞满。智能体忘了 40 次工具调用之前读过什么。它试图同时扮演研究员、程序员和审查员，结果三件事都做得很差。

这就是单智能体天花板。每当一个任务有以下需求时，你就会撞上它：

- **上下文量超过单个窗口所能容纳** —— 读 50 个文件就会突破 200k tokens
- **不同阶段需要不同的专长** —— 研究所需的提示词与代码生成所需的截然不同
- **可以并行进行的工作** —— 既然能同时读三个文件，为什么要一个接一个地读？

## 核心概念

### 单智能体天花板

单个智能体就是一个循环、一个上下文窗口、一个系统提示词。想象一下：

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

有三样东西会崩溃：

1. **上下文饱和（context saturation）** —— 工具结果不断堆积。到第 30 轮时，智能体已经消耗了 150k tokens 的文件内容、命令输出和先前的推理。第 5 轮的关键细节就此丢失。

2. **角色混乱（role confusion）** —— 一个说「你是研究员、程序员、审查员和测试员」的系统提示词，会产出一个研究做了一半、代码写了一半、审查永远做不完的智能体。

3. **串行瓶颈（sequential bottleneck）** —— 智能体先读文件 A，再读文件 B，再读文件 C。三次串行 LLM 调用。三次串行工具执行。毫无并行可言。

### 多智能体解决方案

拆分工作。给每个智能体一份工作、一个上下文窗口，以及一个为该工作专门调校过的系统提示词：

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

每个智能体都有：
- 一个聚焦的系统提示词（「你是一名代码审查员。你唯一的工作就是找出 bug。」）
- 它自己的上下文窗口（不会被其他智能体的工作所污染）
- 一份清晰的输入/输出契约（接收研究笔记，输出代码）

### 真实系统是这么做的

**Claude Code 子智能体（subagents）** —— 当 Claude Code 通过 `Task` 派生一个子智能体时，它会创建一个带有受限范围任务的子智能体。父智能体保持其上下文整洁。子智能体做聚焦的工作，并返回一份摘要。

**Devin** —— 运行一个规划者智能体、一个编码者智能体和一个浏览器智能体。规划者把工作拆分成步骤。编码者写代码。浏览器去研究文档。每个智能体都有独立的上下文。

**多智能体编码团队（SWE-bench）** —— 在 SWE-bench 上表现最好的系统使用一个读代码库的研究员、一个设计修复方案的规划者，以及一个实现它的编码者。单智能体系统得分更低。

**ChatGPT Deep Research** —— 并行派生多个搜索智能体，每个探索不同的角度，然后综合结果。

### 谱系

多智能体不是非黑即白的。它是一条谱系：

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

**单智能体（single agent）** —— 一个循环、一个提示词。适合简单任务。

**子智能体（subagents）** —— 父智能体为聚焦的子任务派生子智能体。父智能体维护计划。子智能体回报结果。这正是 Claude Code 的做法。

**流水线（pipeline）** —— 智能体按顺序运行。智能体 A 的输出成为智能体 B 的输入。适合分阶段的工作流：research -> code -> review -> test。

**团队（team）** —— 智能体借助共享的消息总线（message bus）并行运行。每个都有一个角色。一个编排者进行协调。适合需要同时具备不同技能的场景。

**蜂群（swarm）** —— 许多相同或近乎相同的智能体共享状态。没有固定的编排者。智能体从队列中领取工作。适合高吞吐量的并行任务。

### 四种多智能体模式

#### 模式 1：流水线（Pipeline）

```
Input ──▶ Agent A ──▶ Agent B ──▶ Agent C ──▶ Output
          (research)  (code)      (review)
```

每个智能体转换数据并向前传递。易于推理。某一阶段失败会阻塞其余阶段。

#### 模式 2：扇出/扇入（Fan-out / Fan-in）

```
                ┌──▶ Agent A ──┐
                │              │
Input ──▶ Split ├──▶ Agent B ──├──▶ Merge ──▶ Output
                │              │
                └──▶ Agent C ──┘
```

把工作拆分给并行的多个智能体，然后合并结果。适合可分解为相互独立子任务的任务。

#### 模式 3：编排者-工作者（Orchestrator-Worker）

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

一个聪明的编排者决定要做什么，把任务委派给工作者，并综合结果。编排者本身也是一个智能体，拥有用于派生工作者的工具。

#### 模式 4：对等蜂群（Peer Swarm）

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

没有中央编排者。智能体进行点对点通信。决策从交互中涌现。更难调试，但能扩展到很多智能体。

### 什么情况下不该用多智能体

多智能体会增加复杂度。智能体之间的每一条消息都是潜在的故障点。调试从「读一段对话」变成「跨五个智能体追踪消息」。

**保持单智能体的情形：**
- 任务能装进一个上下文窗口（工作数据不超过约 100k tokens）
- 你不需要为不同阶段使用不同的系统提示词
- 串行执行已经足够快
- 任务足够简单，拆分它带来的开销大于价值

**复杂度的代价：**
- 每一个智能体边界都是一次有损压缩：智能体 A 的完整上下文被概括成一条发给智能体 B 的消息
- 协调逻辑（谁、何时、以何种顺序做什么）本身就是 bug 的来源
- 延迟上升：N 个智能体意味着至少 N 次串行 LLM 调用，如果它们需要来回沟通则更多
- 成本翻倍：每个智能体都独立消耗 tokens

经验法则：如果一个任务的工具调用少于 20 次且能装进 100k tokens，就保持单智能体。

## 动手构建

### 第 1 步：超载的单智能体

下面是一个试图包揽一切的单智能体。它有一个庞大的系统提示词，以及一个同时容纳研究、代码和审查的上下文窗口：

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
- 上下文窗口随每个阶段不断增长。到审查这一步时，它包含了研究笔记、代码以及先前的推理。
- 系统提示词是通用的。它无法为每个阶段单独调校。
- 没有任何工作并行进行。

### 第 2 步：专家智能体

现在拆分它。每个智能体只负责一份工作：

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

每个专家都有一个聚焦的提示词。每个都获得一个只包含其所需输入的整洁上下文窗口。

### 第 3 步：通过消息进行协调

用显式的消息传递把这些专家串联起来：

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

每个智能体只接收发给它的消息。没有上下文污染。研究员那 50k tokens 的文档阅读内容，永远不会进入审查员的上下文。

### 第 4 步：对比

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

多智能体版本使用的总 tokens 更多（三个智能体、三次独立的 LLM 调用），但每个智能体的上下文都保持整洁。每个阶段的质量都得到提升，因为系统提示词是专门化的。

## 实际运用

本课产出一个可复用的提示词，用于决定何时应该转向多智能体。参见 `outputs/prompt-multi-agent-decision.md`。

## 练习

1. 增加第四个专家：一个「测试员（tester）」智能体，它从编码者那里接收代码、从审查员那里接收审查反馈，然后编写测试
2. 修改流水线，使审查员能把反馈发回给编码者以进行一轮修订循环（最多 2 轮）
3. 把串行流水线改造成扇出：并行运行研究员和一个「需求分析器（requirements analyzer）」智能体，然后在传给编码者之前合并它们的输出

## 关键术语

| 术语 | 人们通常的说法 | 它实际的含义 |
|------|----------------|----------------------|
| 蜂群（Swarm） | 「AI 智能体的蜂巢思维」 | 一组对等的智能体，共享状态且没有固定的领导者。行为从局部交互中涌现。 |
| 编排者（Orchestrator） | 「老板智能体」 | 一个其工具包含派生和管理其他智能体的智能体。它进行规划和委派，但可能不做实际工作。 |
| 协调者（Coordinator） | 「交通警察」 | 一个非智能体的组件（通常只是代码，而非 LLM），根据规则在智能体之间路由消息。 |
| 共识（Consensus） | 「智能体们达成一致」 | 一种协议，多个智能体必须先达成一致才能继续。用于需要解决相互冲突的输出时。 |
| 涌现行为（Emergent behavior） | 「智能体们自己搞定了」 | 由智能体交互产生、但并未被显式编程的系统级模式。可能有益，也可能有害。 |
| 扇出/扇入（Fan-out / fan-in） | 「智能体版的 map-reduce」 | 把任务拆分给并行的多个智能体（扇出），然后合并它们的结果（扇入）。 |
| 消息传递（Message passing） | 「智能体彼此对话」 | 智能体之间的通信机制：从一个智能体发送到另一个智能体的结构化数据，用以替代共享上下文窗口。 |

## 延伸阅读

- [The Landscape of Emerging AI Agent Architectures](https://arxiv.org/abs/2409.02977) —— 多智能体模式综述
- [AutoGen: Enabling Next-Gen LLM Applications](https://arxiv.org/abs/2308.08155) —— 微软的多智能体对话框架
- [Claude Code subagents documentation](https://docs.anthropic.com/en/docs/claude-code) —— Claude Code 如何通过 Task 进行委派
- [CrewAI documentation](https://docs.crewai.com/) —— 基于角色的多智能体框架
