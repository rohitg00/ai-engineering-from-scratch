# Why Multi-Agent?

> 1 つの agent が壁にぶつかったとき、賢い手は巨大な agent ではなく、複数の agent です。

**種別:** 学習
**言語:** TypeScript
**前提条件:** Phase 14 (Agent Engineering)
**所要時間:** 約60分

## 学習目標

- single-agent ceiling (context overflow、混在した expertise、sequential bottleneck) を見分け、いつ複数 agent に分割すべきか説明する
- orchestration patterns (pipeline、parallel fan-out、supervisor、hierarchical) を比較し、task structure に合うものを選ぶ
- 明確な role boundary、shared state、communication contract を持つ multi-agent system を設計する
- multi-agent complexity (latency、cost、debugging difficulty) と single-agent simplicity の tradeoff を分析する

## 問題

Phase 14 で single agent を作りました。動きます。files を読み、commands を実行し、APIs を呼び、結果について推論できます。次に、200 files、3 つの languages、infrastructure に依存する tests、さらに code を書く前に external APIs を調査する要件を持つ実際の codebase に向けます。

agent は詰まります。LLM が愚かだからではありません。1 つの agent loop が扱える範囲を task が超えるからです。context window は file contents で埋まります。40 tool calls 前に読んだ内容を忘れます。researcher、coder、reviewer を同時にこなそうとして、3 つすべてが中途半端になります。

これが single-agent ceiling です。次のどれかが必要になるたびに、この天井にぶつかります。

- **1 つの window に収まらない context** - 50 files を読むと 200k tokens を簡単に超える
- **段階ごとに異なる expertise** - research には code generation とは異なる prompting が必要
- **並列化できる work** - 3 files を順番に読む必要はなく、同時に読める

## コンセプト

### Single-Agent Ceiling

single agent は 1 つの loop、1 つの context window、1 つの system prompt です。図にするとこうです。

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

壊れるのは 3 点です。

1. **Context saturation** - tool results が積み上がります。30 turn 目には、file contents、command outputs、過去の reasoning で 150k tokens を消費しています。5 turn 目の重要な details は失われます。

2. **Role confusion** - 「researcher、coder、reviewer、tester である」と書いた system prompt は、半分だけ調査し、半分だけ code を書き、review を終えない agent を生みます。

3. **Sequential bottleneck** - agent は file A、次に file B、次に file C を読みます。LLM calls も tool executions も直列です。parallelism はありません。

### Multi-Agent Solution

work を分割します。各 agent に 1 つの job、1 つの context window、その job に調整した 1 つの system prompt を与えます。

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

各 agent が持つもの:

- focused system prompt ("You are a code reviewer. Your only job is finding bugs.")
- 自分専用の context window (ほかの agent の work で汚れない)
- 明確な input/output contract (research notes を受け取り、code を出す)

### 実際のシステム例

**Claude Code subagents** - Claude Code が `Task` で subagent を起動すると、scoped task を持つ child agent が作られます。parent は context を clean に保ちます。child は focused work を行い、summary を返します。

**Devin** - planner agent、coder agent、browser agent を実行します。planner が work を steps に分解し、coder が code を書き、browser が documentation を調査します。それぞれ context が分かれています。

**Multi-agent coding teams (SWE-bench)** - SWE-bench 上位の systems は、codebase を読む researcher、fix を設計する planner、実装する coder を使います。single-agent systems の score は低くなります。

**ChatGPT Deep Research** - 複数の search agents を parallel に起動し、それぞれが別の angle を探索してから results を synthesis します。

### Spectrum

multi-agent は binary ではありません。spectrum です。

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

**Single agent** - 1 loop、1 prompt。simple tasks に向きます。

**Subagents** - parent が focused subtasks のために children を起動します。parent は plan を維持し、children は報告します。Claude Code がこの形です。

**Pipeline** - agents が順番に走ります。Agent A の output が Agent B の input になります。research -> code -> review -> test のような staged workflows に向きます。

**Team** - agents が shared message bus で parallel に走ります。各 agent に role があり、orchestrator が調整します。異なる skills が同時に必要なときに向きます。

**Swarm** - 同一または近い agent が多数、shared state を使います。固定 orchestrator はなく、agents が queue から work を拾います。high-throughput parallel tasks に向きます。

### 4 つの Multi-Agent Patterns

#### Pattern 1: Pipeline

```
Input ──▶ Agent A ──▶ Agent B ──▶ Agent C ──▶ Output
          (research)  (code)      (review)
```

各 agent が data を変換して次に渡します。reasoning しやすい一方、1 stage の failure が以降を止めます。

#### Pattern 2: Fan-out / Fan-in

```
                ┌──▶ Agent A ──┐
                │              │
Input ──▶ Split ├──▶ Agent B ──├──▶ Merge ──▶ Output
                │              │
                └──▶ Agent C ──┘
```

work を parallel agents に分け、results を merge します。independent subtasks に分解できる tasks に向きます。

#### Pattern 3: Orchestrator-Worker

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

smart orchestrator が何をするか決め、workers に delegate し、results を synthesize します。orchestrator 自身も workers を起動する tools を持つ agent です。

#### Pattern 4: Peer Swarm

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

central orchestrator はありません。agents が peer-to-peer で communicate します。decisions は interaction から emerge します。debug は難しくなりますが、多数の agents に scale します。

### Multi-Agent を使わない場面

multi-agent は complexity を増やします。agent 間の message はすべて potential failure point です。debugging は「1 つの conversation を読む」から「5 agents にまたがる messages を trace する」になります。

**single-agent に留める条件:**

- task が 1 つの context window に収まる (working data が ~100k tokens 未満)
- stages ごとに異なる system prompts が不要
- sequential execution で十分に速い
- 分割による overhead が value を上回るほど task が simple

**complexity cost:**

- agent boundary はすべて lossy compression step です。agent A の full context は agent B への message に要約されます。
- coordination logic (誰が、いつ、どの順序で何をするか) 自体が bugs の source です。
- latency は増えます。N agents なら最低 N serial LLM calls、往復があればさらに増えます。
- cost は増えます。各 agent が independently tokens を消費します。

経験則: task が 20 tool calls 未満で 100k tokens に収まるなら single-agent のままにします。

## 実装

### Step 1: Overloaded Single Agent

すべてを 1 つでやろうとする single agent です。巨大な system prompt と、research、code、reviews を保持する 1 つの context window を持ちます。

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

この approach の問題:

- context window は stage ごとに増えます。review step では research notes、code、prior reasoning のすべてを含みます。
- system prompt が generic です。stage ごとに tuning できません。
- 何も parallel に走りません。

### Step 2: Specialist Agents

分割します。各 agent は 1 job だけを持ちます。

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

各 specialist は focused prompt を持ちます。各 agent は必要な input だけを持つ clean context window を受け取ります。

### Step 3: Messages で Coordination する

explicit message passing で specialists をつなぎます。

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

各 agent は自分宛の messages だけを受け取ります。context pollution はありません。researcher が documentation を読むために使った 50k tokens は reviewer の context に入りません。

### Step 4: 比較する

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

multi-agent version は total tokens を多く使います (3 agents、3 separate LLM calls)。一方で、各 agent の context は clean なままです。system prompt が specialized されているため、各 stage の quality が改善します。

## Use It

この lesson は、いつ multi-agent にするか判断する reusable prompt を生成します。`outputs/prompt-multi-agent-decision.md` を参照してください。

## Exercises

1. 4 番目の specialist として "tester" agent を追加する。coder から code、reviewer から review feedback を受け取り、tests を書く
2. reviewer が feedback を coder に戻して revision loop を作れるように pipeline を変更する (max 2 rounds)
3. sequential pipeline を fan-out に変換する。researcher と "requirements analyzer" agent を parallel に走らせ、outputs を merge してから coder に渡す

## Key Terms

| Term | よくある言い方 | 実際の意味 |
|------|----------------|------------|
| Swarm | "A hive mind of AI agents" | fixed leader を持たず shared state を使う peer agents の集合。behavior は local interactions から emerge する。 |
| Orchestrator | "The boss agent" | ほかの agents を起動・管理する tools を持つ agent。plan と delegate はするが、actual work はしないこともある。 |
| Coordinator | "The traffic cop" | rules に基づいて agents 間の messages を route する non-agent component (多くは LLM ではなく code)。 |
| Consensus | "The agents agree" | 複数 agents が proceed 前に agreement に到達する protocol。conflicting outputs の resolution に使う。 |
| Emergent behavior | "The agents figured it out themselves" | explicit に program されていないが agent interactions から生じる system-level patterns。有用な場合も有害な場合もある。 |
| Fan-out / fan-in | "Map-reduce for agents" | task を parallel agents に分割し (fan-out)、results を結合する (fan-in)。 |
| Message passing | "Agents talk to each other" | agents 間の communication mechanism。shared context windows の代わりに、structured data を agent から agent へ送る。 |

## 参考文献

- [The Landscape of Emerging AI Agent Architectures](https://arxiv.org/abs/2409.02977) - multi-agent patterns の survey
- [AutoGen: Enabling Next-Gen LLM Applications](https://arxiv.org/abs/2308.08155) - Microsoft の multi-agent conversation framework
- [Claude Code subagents documentation](https://docs.anthropic.com/en/docs/claude-code) - Claude Code が `Task` で delegate する方法
- [CrewAI documentation](https://docs.crewai.com/) - role-based multi-agent framework
