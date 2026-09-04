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
    output: `[Response to: ${userMessage.slice(0, 80)}...]`,
    tokens: simulatedTokens,
    calls: Math.floor(Math.random() * 5) + 1,
  };
}

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
    researcher.run(`Research technical approach for: ${task}`),
    createSpecialist(
      "requirements",
      "You are a requirements analyst. Extract functional and non-functional requirements. Be exhaustive."
    ).run(`Analyze requirements for: ${task}`),
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
  const task = "Build a rate limiter middleware for an Express.js API";

  console.log("=== SINGLE AGENT APPROACH ===\n");
  const singleResult = await singleAgentApproach(task);
  console.log(`Tokens used: ${singleResult.tokensUsed}`);
  console.log(`Tool calls: ${singleResult.toolCalls}`);
  console.log(`Context: everything in one window\n`);

  console.log("=== MULTI-AGENT PIPELINE ===\n");
  const pipelineResult = await multiAgentPipeline(task);
  console.log(`Tokens used: ${pipelineResult.tokensUsed}`);
  console.log(`Tool calls: ${pipelineResult.toolCalls}`);
  console.log(`Context: each agent gets only what it needs\n`);

  console.log("=== MULTI-AGENT FAN-OUT ===\n");
  const fanOutResult = await multiAgentFanOut(task);
  console.log(`Tokens used: ${fanOutResult.tokensUsed}`);
  console.log(`Tool calls: ${fanOutResult.toolCalls}`);
  console.log(`Context: researcher + requirements run in parallel\n`);

  console.log("=== COMPARISON ===\n");
  console.log(
    `Single agent context pollution: all ${singleResult.tokensUsed} tokens in one window`
  );
  console.log(
    `Multi-agent isolation: ${pipelineResult.tokensUsed} total tokens across 3 isolated windows`
  );
  console.log(
    `Fan-out parallelism: research + requirements ran simultaneously`
  );
}

main();
