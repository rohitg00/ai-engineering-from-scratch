# 为什么要用多 agent？（Why Multi-Agent?）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一个 agent 撞了墙。聪明的做法不是把它做得更大，而是叫上更多 agent。

**Type:** Learn
**Languages:** TypeScript
**Prerequisites:** Phase 14 (Agent Engineering)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 识别单 agent 的天花板（context 溢出、专业混杂、串行瓶颈），并能解释什么时候拆成多 agent 才是正确选择
- 比较各种编排模式（pipeline、并行 fan-out、supervisor、hierarchical），并能为给定任务结构挑出合适的那一种
- 设计一个角色边界清晰、共享状态明确、通信契约规范的多 agent 系统
- 分析多 agent 复杂度的权衡（延迟、成本、调试难度）相对于单 agent 简洁性的代价

## 问题（The Problem）

你在 Phase 14 里造了一个单 agent。它能跑：能读文件，能跑命令，能调 API，能对结果做推理。然后你把它丢到一个真实代码库面前：200 个文件、三种语言、依赖基础设施才能跑的测试，还要求在写代码之前先研究外部 API。

agent 噎住了。不是因为 LLM 笨，而是任务超出了一个 agent loop 能搞定的范围。context window 被文件内容塞满。agent 忘了 40 次 tool 调用之前读过什么。它一会儿当研究员、一会儿写代码、一会儿做 reviewer，三件事都做得一塌糊涂。

这就是单 agent 的天花板。每当任务出现下面这些情况，你就会撞上它：

- **context 装不下** —— 读 50 个文件就能把 200k token 撑爆
- **不同阶段需要不同专业** —— 研究阶段需要的 prompt 风格和写代码完全不同
- **可以并行的活儿** —— 三个文件为啥要顺序读，明明可以同时读？

## 概念（The Concept）

### 单 agent 的天花板（The Single-Agent Ceiling）

一个单 agent 就是一个 loop、一个 context window、一个 system prompt。想象一下：

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

三处会崩：

1. **context 饱和** —— tool 结果不停堆积。到第 30 轮，agent 已经吞下 150k token 的文件内容、命令输出和此前的推理。第 5 轮里那些关键细节早就丢了。

2. **角色混淆** —— 一个写着「你是研究员、程序员、reviewer 和测试员」的 system prompt 只会产出一个研究做一半、代码写一半、review 永远完不成的 agent。

3. **串行瓶颈** —— agent 先读文件 A，再读 B，再读 C。三次串行 LLM 调用，三次串行 tool 执行。零并行。

### 多 agent 解法（The Multi-Agent Solution）

把活儿拆开。每个 agent 一个职责、一个 context window、一个为该职责量身打磨的 system prompt：

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

每个 agent 都有：
- 一个聚焦的 system prompt（「你是 code reviewer，唯一职责就是找 bug。」）
- 自己的 context window（不会被其他 agent 的工作污染）
- 一份清晰的输入/输出契约（接收 research notes，输出代码）

### 真实系统就是这么干的（Real Systems That Do This）

**Claude Code subagents** —— 当 Claude Code 用 `Task` 派生一个 subagent 时，它创建了一个带有限定任务的子 agent。父 agent 保持自己的 context 干净。子 agent 做聚焦的工作，并返回一份摘要。

**Devin** —— 跑一个 planner agent、一个 coder agent 和一个 browser agent。planner 把工作拆成步骤。coder 写代码。browser 去查文档。每一个都有独立的 context。

**多 agent 编码团队（SWE-bench）** —— SWE-bench 上排名靠前的系统会用一个 researcher 读代码库、一个 planner 设计修复方案、一个 coder 实现它。单 agent 系统得分更低。

**ChatGPT Deep Research** —— 并行派出多个搜索 agent，每个从一个不同的角度去探索，然后合成结果。

### 这是个谱系（The Spectrum）

多 agent 不是非黑即白，而是一个谱系：

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

**Single agent**（单 agent）—— 一个 loop、一个 prompt。适合简单任务。

**Subagents**（子 agent）—— 父 agent 为聚焦的子任务派生子 agent。父 agent 维护整体计划，子 agent 完成后回报。这就是 Claude Code 的做法。

**Pipeline**（流水线）—— agent 按顺序运行。Agent A 的输出作为 Agent B 的输入。适合分阶段的工作流：research -> code -> review -> test。

**Team**（团队）—— agent 并行运行，共享一条消息总线。每个有自己的角色，由一个 orchestrator 协调。适合同时需要多种技能的场景。

**Swarm**（蜂群）—— 大量相同或相似的 agent 共享状态。没有固定的 orchestrator。agent 从队列里领活儿。适合高吞吐的并行任务。

### 四种多 agent 模式（The Four Multi-Agent Patterns）

#### 模式 1：Pipeline（Pattern 1: Pipeline）

```
Input ──▶ Agent A ──▶ Agent B ──▶ Agent C ──▶ Output
          (research)  (code)      (review)
```

每个 agent 都对数据做一次变换再往后传。逻辑简单。某一阶段挂了，后面也跟着挂。

#### 模式 2：Fan-out / Fan-in（Pattern 2: Fan-out / Fan-in）

```
                ┌──▶ Agent A ──┐
                │              │
Input ──▶ Split ├──▶ Agent B ──├──▶ Merge ──▶ Output
                │              │
                └──▶ Agent C ──┘
```

把活儿拆给并行的 agent 做，再把结果合并起来。适合那些能拆成相互独立子任务的任务。

#### 模式 3：Orchestrator-Worker（Pattern 3: Orchestrator-Worker）

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

一个聪明的 orchestrator 决定要做什么，把活儿派给 worker，再把结果合成。orchestrator 自己也是一个 agent，只不过它的 tool 包含派生 worker 的能力。

#### 模式 4：Peer Swarm（Pattern 4: Peer Swarm）

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

没有中心 orchestrator。agent 之间点对点通信。决策从交互中涌现出来。调试更难，但能扩展到大量 agent。

### 什么时候不该用多 agent（When NOT to Use Multi-Agent）

多 agent 是要付复杂度成本的。每一条 agent 间的消息都是潜在的故障点。调试也从「读一段对话」变成「跨五个 agent 追踪消息」。

**继续单 agent，如果：**
- 任务能装进一个 context window（工作数据 ~100k token 以内）
- 你不需要为不同阶段配不同的 system prompt
- 串行执行已经够快
- 任务简单到拆开反而平添 overhead，没增加多少价值

**复杂度成本：**
- 每条 agent 边界都是一次有损压缩：agent A 的完整 context 会被压成一条消息塞给 agent B
- 协调逻辑（谁做什么、什么时候做、按什么顺序做）本身就是 bug 的温床
- 延迟会增加：N 个 agent 至少意味着 N 次串行 LLM 调用，如果还要来回沟通就更多
- 成本会翻倍：每个 agent 都独立烧 token

经验法则：如果一个任务用不到 20 次 tool 调用、且能装进 100k token，就保持单 agent。

## 动手实现（Build It）

### 第 1 步：被压垮的单 agent（Step 1: The Overloaded Single Agent）

下面是一个想包揽一切的单 agent。它有一个巨型 system prompt，一个 context window 里同时塞着研究、代码和 review：

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
- context window 每多一个阶段就膨胀一次。到 review 那一步，里面同时装着 research notes、代码 还有此前的推理。
- system prompt 是通用的，没法为每个阶段单独调优。
- 没有任何东西并行跑。

### 第 2 步：专才 agent（Step 2: Specialist Agents）

现在拆开。每个 agent 只干一件事：

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

每个专才都有聚焦的 prompt。每个都拿到一个干净的 context window，里面只装它需要的输入。

### 第 3 步：用消息把它们串起来（Step 3: Coordinate Through Messages）

用显式的消息传递把专才们连起来：

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

每个 agent 只收到发给自己的那些消息。没有 context 污染。researcher 那 50k token 的文档阅读结果永远不会出现在 reviewer 的 context 里。

### 第 4 步：对比一下（Step 4: Compare）

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

多 agent 版本总 token 数更高（三个 agent，三次独立 LLM 调用），但每个 agent 的 context 都很干净。每个阶段的质量都因为 system prompt 专门化而上升。

## 用起来（Use It）

本节产出一份可复用的 prompt，用来判断什么时候该上多 agent。见 `outputs/prompt-multi-agent-decision.md`。

## 练习（Exercises）

1. 加第四个专才：一个「tester」agent，从 coder 那拿到代码、从 reviewer 那拿到反馈，然后写测试
2. 改造 pipeline，让 reviewer 能把反馈打回给 coder 做修订循环（最多 2 轮）
3. 把串行 pipeline 改成 fan-out：让 researcher 和一个「需求分析」agent 并行跑，再合并它们的输出后传给 coder

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 实际是什么意思 |
|------|----------------|----------------------|
| Swarm（蜂群） | 「AI agent 的群体心智」 | 一群对等的 agent，共享状态、没有固定 leader。行为从局部交互中涌现。 |
| Orchestrator（编排器） | 「老板 agent」 | 一种 agent，它的 tool 包括派生和管理其它 agent。它做规划与派活儿，但可能并不真正动手。 |
| Coordinator（协调者） | 「交通警察」 | 一个非 agent 的组件（通常就是代码，不是 LLM），按规则在 agent 之间路由消息。 |
| Consensus（共识） | 「agent 们达成一致」 | 一种协议：多个 agent 必须先达成一致才能继续。在结果冲突需要裁决时使用。 |
| Emergent behavior（涌现行为） | 「agent 们自己琢磨出来了」 | 从 agent 交互中产生但没被显式编程的系统级模式。可能有用，也可能有害。 |
| Fan-out / fan-in | 「agent 版的 map-reduce」 | 把任务分拆给并行 agent（fan-out），再合并它们的结果（fan-in）。 |
| Message passing（消息传递） | 「agent 们互相说话」 | agent 间的通信机制：从一个 agent 发往另一个 agent 的结构化数据，用以替代共享 context window。 |

## 延伸阅读（Further Reading）

- [The Landscape of Emerging AI Agent Architectures](https://arxiv.org/abs/2409.02977) —— 多 agent 模式综述
- [AutoGen: Enabling Next-Gen LLM Applications](https://arxiv.org/abs/2308.08155) —— 微软的多 agent 对话框架
- [Claude Code subagents documentation](https://docs.anthropic.com/en/docs/claude-code) —— Claude Code 如何用 Task 派活儿
- [CrewAI documentation](https://docs.crewai.com/) —— 基于角色的多 agent 框架
