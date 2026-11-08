# 為什麼要多代理？

> 一個代理會撞牆。聰明的做法不是弄一個更大的代理 —— 而是弄更多代理。

**類型：** 學習
**程式語言：** TypeScript
**先修單元：** 階段 14（代理工程）
**時間：** 約 60 分鐘

## 學習目標

- 指認出單一代理的天花板（脈絡溢位、專業混雜、循序瓶頸），並解釋何時拆成多個代理才是對的做法
- 比較各種編排模式（管線、平行扇出、supervisor、階層式），並替給定的任務結構挑出對的那一個
- 設計一套多代理系統，具備清楚的角色邊界、共享狀態與通訊契約
- 分析多代理複雜度（延遲、成本、除錯難度）相對於單一代理簡潔性的取捨

## 問題所在

你在階段 14 建了一個單一代理。它能用。它可以讀檔案、跑指令、呼叫 API，並對結果做推理。然後你把它指向一個真實的程式庫：200 個檔案、三種語言、依賴基礎設施的測試，以及一項「寫程式前得先研究外部 API」的要求。

代理噎住了。不是因為 LLM 笨，而是因為這項任務超出了單一代理迴圈處理得了的範圍。脈絡視窗被檔案內容塞滿。代理忘了它 40 次工具呼叫之前讀過什麼。它試著同時當研究員、寫程式的人與審查者，結果三件事都做得很差。

這就是單一代理的天花板。每當一項任務需要以下這些時，你就會撞到它：

- **比一個視窗裝得下的更多脈絡** —— 讀 50 個檔案就爆過 200k 詞元
- **不同階段需要不同專業** —— 研究需要的提示詞方式跟程式碼生成不一樣
- **可以平行進行的工作** —— 明明可以同時讀三個檔案，何必循序讀？

## 核心概念

### 單一代理的天花板

單一代理就是一個迴圈、一個脈絡視窗、一段系統提示詞。想像一下：

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

有三件事會壞掉：

1. **脈絡飽和** —— 工具結果不斷堆積。到第 30 輪時，代理已經吞掉 15 萬詞元的檔案內容、指令輸出與先前推理。第 5 輪的關鍵細節就這樣不見了。

2. **角色混淆** —— 一段寫著「你是研究員、寫程式的人、審查者，也是測試者」的系統提示詞，產出的代理會研究一半、寫一半程式碼，然後永遠審查不完。

3. **循序瓶頸** —— 代理讀檔案 A，然後檔案 B，然後檔案 C。三次串行的 LLM 呼叫。三次串行的工具執行。毫無平行性。

### 多代理的解法

把工作拆開。給每個代理一份工作、一個脈絡視窗，以及一段為那份工作調校過的系統提示詞：

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

每個代理有：
- 一段聚焦的系統提示詞（「你是程式碼審查者。你唯一的工作就是找出臭蟲。」）
- 它自己的脈絡視窗（不會被其他代理的工作汙染）
- 一份清楚的輸入／輸出契約（收到研究筆記，輸出程式碼）

### 真的在這樣做的系統

**Claude Code 的子代理** —— 當 Claude Code 用 `Task` 生出一個子代理時，它建立的是一個帶劃定範圍任務的子代理。父代理維持自己的脈絡乾淨。子代理做聚焦的工作，並回傳一份摘要。

**Devin** —— 跑一個規劃器代理、一個寫程式代理，以及一個瀏覽器代理。規劃器把工作拆成步驟。寫程式代理寫程式碼。瀏覽器代理研究文件。各自有獨立的脈絡。

**多代理寫程式團隊（SWE-bench）** —— SWE-bench 上表現最好的系統，會用一個讀程式庫的研究員、一個設計修法的規劃器，以及一個實作它的寫程式代理。單一代理的系統分數較低。

**ChatGPT Deep Research** —— 平行生出多個搜尋代理，各自探索不同角度，再把結果綜合起來。

### 那道光譜

多代理不是二元的。它是一道光譜：

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

**單一代理** —— 一個迴圈、一段提示詞。適合簡單任務。

**子代理** —— 父代理為聚焦的子任務生出子代理。父代理維持那份計畫。子代理回報。這就是 Claude Code 在做的事。

**管線** —— 代理循序執行。代理 A 的輸出成為代理 B 的輸入。適合分階段的工作流：研究 -> 寫程式 -> 審查 -> 測試。

**團隊** —— 代理平行執行，共用一條訊息匯流排。每個都有一個角色。由一個編排者協調。當同時需要不同技能時很適合。

**Swarm** —— 許多相同或近乎相同、共享狀態的代理。沒有固定的編排者。代理從佇列中撿工作。適合高吞吐的平行任務。

### 四種多代理模式

#### 模式 1：管線

```
Input ──▶ Agent A ──▶ Agent B ──▶ Agent C ──▶ Output
          (research)  (code)      (review)
```

每個代理轉換資料並往前傳。很容易推敲。某一階段失敗就擋住其餘。

#### 模式 2：扇出／扇入

```
                ┌──▶ Agent A ──┐
                │              │
Input ──▶ Split ├──▶ Agent B ──├──▶ Merge ──▶ Output
                │              │
                └──▶ Agent C ──┘
```

把工作切給平行的代理，再把結果合併。適合能拆成獨立子任務的任務。

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

一個聰明的編排者決定要做什麼、委派給 worker，再把結果綜合起來。編排者自己也是一個代理，其工具包含生出並管理其他代理。

#### 模式 4：點對點 Swarm

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

沒有中央編排者。代理點對點通訊。決策從互動中浮現。比較難除錯，但擴展得到很多代理。

### 什麼時候「不要」用多代理

多代理增加複雜度。代理之間的每一則訊息都是潛在的失敗點。除錯從「讀一段對話」變成「跨五個代理追訊息」。

**維持單一代理的時機：**
- 任務裝得進一個脈絡視窗（工作資料在 10 萬詞元以下）
- 你不需要為不同階段配不同的系統提示詞
- 循序執行已經夠快
- 任務簡單到拆開來的開銷大於價值

**那筆複雜度成本：**
- 每一條代理邊界都是一次有損壓縮：代理 A 的完整脈絡被摘要成一則給代理 B 的訊息
- 協調邏輯（誰做什麼、何時做、依什麼順序）本身就是一個臭蟲來源
- 延遲增加：N 個代理至少代表 N 次串行 LLM 呼叫，若它們需要來回對話則更多
- 成本翻倍：每個代理各自燒詞元

拇指法則：如果一項任務少於 20 次工具呼叫、而且裝得進 10 萬詞元，就維持單一代理。

```figure
swarm-messages
```

## 動手實作

### 步驟 1：那個超載的單一代理

底下是一個試圖做完所有事的單一代理。它有一段巨大的系統提示詞，以及一個同時裝著研究、程式碼與審查的脈絡視窗：

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

這種做法的問題：
- 脈絡視窗隨每個階段長大。到審查那一步時，它同時裝著研究筆記、程式碼與先前的推理。
- 系統提示詞很泛用。它沒辦法為每個階段調校。
- 沒有任何東西是平行跑的。

### 步驟 2：專家代理

現在把它拆開。每個代理一份工作：

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

每個專家都有一段聚焦的提示詞。每個都拿到一個乾淨的脈絡視窗，只裝著它需要的輸入。

### 步驟 3：透過訊息協調

用明寫的訊息傳遞把這些專家接起來：

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

每個代理只收到寄給它的訊息。沒有脈絡汙染。研究員那 5 萬詞元的文件閱讀，從來不會進到審查者的脈絡裡。

### 步驟 4：比較

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

多代理版本用掉的總詞元較多（三個代理、三次獨立的 LLM 呼叫），但每個代理的脈絡都維持乾淨。每個階段的品質都提升了，因為系統提示詞是特化的。

## 框架應用

這一課產出一段可重用的提示詞，用來判斷何時該走多代理。見 `outputs/prompt-multi-agent-decision.md`。

## 練習

1. 加上第四位專家：一個「測試者」代理，接收來自寫程式代理的程式碼與來自審查者的審查回饋，然後寫測試
2. 修改這條管線，讓審查者可以把回饋送回給寫程式代理做一輪修訂（最多 2 回合）
3. 把這條循序管線改成扇出：平行跑研究員與一個「需求分析師」代理，再把它們的輸出合併後傳給寫程式代理

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|----------------------|
| Swarm | 「AI 代理的蜂群思維」 | 一組共享狀態、沒有固定領導者的點對點代理。行為從局部互動中浮現。 |
| 編排者 | 「老大代理」 | 一個其工具包含生出並管理其他代理的代理。它規劃並委派，但可能不做實際工作。 |
| 協調者 | 「交通警察」 | 一個非代理的元件（通常只是程式碼，不是 LLM），依規則在代理之間路由訊息。 |
| 共識 | 「代理達成一致」 | 一套多個代理必須先達成一致才能繼續的協定。用在需要解決衝突輸出的時候。 |
| 浮現行為 | 「代理自己想出來的」 | 從代理互動中生出、但沒有被明確寫進程式的系統層級樣式。可能有用，也可能有害。 |
| 扇出／扇入 | 「代理版的 map-reduce」 | 把任務切給平行代理（扇出），再把它們的結果組合起來（扇入）。 |
| 訊息傳遞 | 「代理彼此對話」 | 代理之間的通訊機制：從一個代理送給另一個代理的結構化資料，取代共享脈絡視窗。 |

## 延伸閱讀

- [The Landscape of Emerging AI Agent Architectures](https://arxiv.org/abs/2409.02977) —— 多代理模式的綜述
- [AutoGen: Enabling Next-Gen LLM Applications](https://arxiv.org/abs/2308.08155) —— Microsoft 的多代理對話框架
- [Claude Code subagents documentation](https://docs.anthropic.com/en/docs/claude-code) —— Claude Code 如何用 Task 做委派
- [CrewAI documentation](https://docs.crewai.com/) —— 角色制的多代理框架
