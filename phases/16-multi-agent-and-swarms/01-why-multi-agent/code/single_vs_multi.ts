type LLMResponse = {
  output: string;
  tokens: number;
  calls: number;
};

type AgentResult = {
  content: string;
  tokensUsed: number;
  toolCalls: number;
};

type AgentMessage = {
  from: string;
  to: string;
  content: string;
  timestamp: number;
};

type SpecialistAgent = {
  name: string;
  systemPrompt: string;
  run: (input: string) => Promise<AgentResult>;
};

async function fakeLLMCall(
  systemPrompt: string,
  userMessage: string
): Promise<LLMResponse> {
  const inputLength = systemPrompt.length + userMessage.length;
  const simulatedTokens = Math.floor(inputLength / 4) + 500;

  await new Promise((resolve) => setTimeout(resolve, 50));

  return {
    output: `[応答: ${userMessage.slice(0, 80)}...]`,
    tokens: simulatedTokens,
    calls: Math.floor(Math.random() * 5) + 1,
  };
}

async function singleAgentApproach(task: string): Promise<AgentResult> {
  const systemPrompt = `あなたは full-stack developer です。必ず次を行ってください:
1. 要件を調査する
2. code を書く
3. bugs がないか code を review する
4. tests を書く
これらをすべて 1 つの conversation で行ってください。`;

  const contextWindow: string[] = [];
  let totalTokens = 0;
  let totalToolCalls = 0;

  const research = await fakeLLMCall(systemPrompt, `調査: ${task}`);
  contextWindow.push(research.output);
  totalTokens += research.tokens;
  totalToolCalls += research.calls;

  const code = await fakeLLMCall(
    systemPrompt,
    `この調査に基づいて:\n${contextWindow.join("\n")}\n\n次の code を書いてください: ${task}`
  );
  contextWindow.push(code.output);
  totalTokens += code.tokens;
  totalToolCalls += code.calls;

  const review = await fakeLLMCall(
    systemPrompt,
    `これまでの context に基づいて:\n${contextWindow.join("\n")}\n\ncode を review してください。`
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

function createSpecialist(
  name: string,
  systemPrompt: string
): SpecialistAgent {
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
  "あなたは technical researcher です。documentation を読み、patterns を見つけ、findings を要約してください。implementation に必要な facts だけを出力してください。"
);

const coder = createSpecialist(
  "coder",
  "あなたは senior TypeScript developer です。requirements と research notes に基づいて、clean で tested な code だけを書いてください。"
);

const reviewer = createSpecialist(
  "reviewer",
  "あなたは code reviewer です。bugs、security issues、logic errors を見つけてください。具体的に、line numbers を示してください。"
);

async function multiAgentPipeline(task: string): Promise<AgentResult> {
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
    .map((m) => `[${m.from} から]: ${m.content}`)
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
    .map((m) => `[${m.from} から]: ${m.content}`)
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
    content: messages
      .map((m) => `[${m.from} -> ${m.to}]: ${m.content}`)
      .join("\n\n"),
    tokensUsed: totalTokens,
    toolCalls: totalToolCalls,
  };
}

async function multiAgentFanOut(task: string): Promise<AgentResult> {
  const messages: AgentMessage[] = [];
  let totalTokens = 0;
  let totalToolCalls = 0;

  const [researchResult, requirementsResult] = await Promise.all([
    researcher.run(`technical approach を調査してください: ${task}`),
    createSpecialist(
      "requirements",
      "あなたは requirements analyst です。functional requirements と non-functional requirements を抽出してください。網羅的に行ってください。"
    ).run(`requirements を分析してください: ${task}`),
  ]);

  messages.push({
    from: "researcher",
    to: "coder",
    content: researchResult.content,
    timestamp: Date.now(),
  });
  messages.push({
    from: "requirements",
    to: "coder",
    content: requirementsResult.content,
    timestamp: Date.now(),
  });
  totalTokens += researchResult.tokensUsed + requirementsResult.tokensUsed;
  totalToolCalls += researchResult.toolCalls + requirementsResult.toolCalls;

  const coderInput = messages
    .filter((m) => m.to === "coder")
    .map((m) => `[${m.from} から]: ${m.content}`)
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

  const reviewResult = await reviewer.run(codeResult.content);
  totalTokens += reviewResult.tokensUsed;
  totalToolCalls += reviewResult.toolCalls;

  return {
    content: messages
      .map((m) => `[${m.from} -> ${m.to}]: ${m.content}`)
      .join("\n\n"),
    tokensUsed: totalTokens,
    toolCalls: totalToolCalls,
  };
}

async function main() {
  const task = "Express.js API 用の rate limiter middleware を作る";

  console.log("=== SINGLE AGENT APPROACH ===\n");
  const singleResult = await singleAgentApproach(task);
  console.log(`使用 tokens: ${singleResult.tokensUsed}`);
  console.log(`Tool calls: ${singleResult.toolCalls}`);
  console.log(`Context: すべてが 1 つの window に入る\n`);

  console.log("=== MULTI-AGENT PIPELINE ===\n");
  const pipelineResult = await multiAgentPipeline(task);
  console.log(`使用 tokens: ${pipelineResult.tokensUsed}`);
  console.log(`Tool calls: ${pipelineResult.toolCalls}`);
  console.log(`Context: 各 agent は必要なものだけを受け取る\n`);

  console.log("=== MULTI-AGENT FAN-OUT ===\n");
  const fanOutResult = await multiAgentFanOut(task);
  console.log(`使用 tokens: ${fanOutResult.tokensUsed}`);
  console.log(`Tool calls: ${fanOutResult.toolCalls}`);
  console.log(`Context: researcher + requirements が parallel に走る\n`);

  console.log("=== COMPARISON ===\n");
  console.log(
    `Single agent context pollution: ${singleResult.tokensUsed} tokens すべてが 1 つの window に入る`
  );
  console.log(
    `Multi-agent isolation: ${pipelineResult.tokensUsed} total tokens が 3 つの isolated windows に分かれる`
  );
  console.log(
    `Fan-out parallelism: research + requirements が同時に走った`
  );
}

main();
