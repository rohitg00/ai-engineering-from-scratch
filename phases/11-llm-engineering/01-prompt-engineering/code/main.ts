// Prompt engineering in TypeScript: pattern catalog, role/context/instruction
// composition, multi-provider request formatters, simulated LLM dispatch with
// deterministic scoring. Mirrors code/prompt_engineering.py.
// Sources:
//   https://platform.openai.com/docs/guides/text-generation
//   https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering
//   https://ai.google.dev/gemini-api/docs/text-generation

import { createHash } from "node:crypto";

type PatternName =
  | "persona"
  | "few_shot"
  | "chain_of_thought"
  | "template_fill"
  | "critique"
  | "guardrail"
  | "decomposition"
  | "audience_adapt"
  | "boundary";

type Pattern = {
  readonly name: string;
  readonly template: string;
  readonly variables: readonly string[];
  readonly temperature: number;
  readonly description: string;
};

const PROMPT_PATTERNS: Readonly<Record<PatternName, Pattern>> = {
  persona: {
    name: "Persona Pattern",
    template:
      "You are {role} with {experience}.\nYour communication style is {style}.\nYou prioritize {priority}.\n\n{task}",
    variables: ["role", "experience", "style", "priority", "task"],
    temperature: 0.7,
    description: "Activates a specific expert distribution in the training data",
  },
  few_shot: {
    name: "Few-Shot Pattern",
    template: "Here are examples of the expected input/output format:\n\n{examples}\n\nNow process this input:\n{input}",
    variables: ["examples", "input"],
    temperature: 0.0,
    description: "Anchors output format with concrete examples",
  },
  chain_of_thought: {
    name: "Chain-of-Thought Pattern",
    template:
      "Think through this step by step.\n\nProblem: {problem}\n\nSteps:\n1. Identify the key components\n2. Analyze each component\n3. Synthesize your findings\n4. State your conclusion\n\nShow your reasoning before the final answer.",
    variables: ["problem"],
    temperature: 0.3,
    description: "Forces explicit reasoning before the final answer",
  },
  template_fill: {
    name: "Template Fill Pattern",
    template:
      "Extract information from the following text and fill in the template.\n\nText: {text}\n\nTemplate:\n{template_structure}\n\nFill every field. If unknown, write 'N/A'.",
    variables: ["text", "template_structure"],
    temperature: 0.0,
    description: "Constrains output to named fields",
  },
  critique: {
    name: "Critique Pattern",
    template:
      "Task: {task}\n\nStep 1: Generate an initial response.\nStep 2: Critique it for accuracy, completeness, and clarity.\nStep 3: Produce an improved final version.\n\nLabel each step clearly.",
    variables: ["task"],
    temperature: 0.5,
    description: "Self-refinement through explicit critique",
  },
  guardrail: {
    name: "Guardrail Pattern",
    template:
      "You are a {role}.\n\nRules:\n- ONLY answer questions about {domain}\n- If outside {domain}, say: 'This is outside my scope.'\n- NEVER make up information. If unsure, say 'I don't know.'\n- {additional_rules}\n\nUser question: {question}",
    variables: ["role", "domain", "additional_rules", "question"],
    temperature: 0.3,
    description: "Constrains to a domain with explicit boundaries",
  },
  decomposition: {
    name: "Decomposition Pattern",
    template:
      "Problem: {problem}\n\nBreak this into sub-problems:\n1. List each sub-problem\n2. Solve each independently\n3. Combine sub-solutions into a final answer\n4. Verify the final answer against the original problem",
    variables: ["problem"],
    temperature: 0.3,
    description: "Breaks complex problems into manageable pieces",
  },
  audience_adapt: {
    name: "Audience Adaptation Pattern",
    template:
      "Explain {concept} for the following audience: {audience}.\n\nConstraints:\n- Vocabulary appropriate for {audience}\n- Length: {length}\n- Include {include}\n- Exclude {exclude}",
    variables: ["concept", "audience", "length", "include", "exclude"],
    temperature: 0.5,
    description: "Adapts explanation to the target audience",
  },
  boundary: {
    name: "Boundary Pattern",
    template:
      "You are an assistant that ONLY handles {scope}.\n\nIf the request is in scope, help fully.\nIf out of scope, respond exactly with:\n'{refusal_message}'\n\nDo not attempt to answer out-of-scope questions.\n\nUser: {user_input}",
    variables: ["scope", "refusal_message", "user_input"],
    temperature: 0.0,
    description: "Hard boundary on what the model responds to",
  },
} as const;

type Provider = "openai" | "anthropic" | "google";

type ModelConfig = {
  readonly provider: Provider;
  readonly model: string;
  readonly maxTokens: number;
  readonly contextWindow: number;
};

const MODEL_CONFIGS: Readonly<Record<string, ModelConfig>> = {
  "gpt-4o": { provider: "openai", model: "gpt-4o", maxTokens: 2048, contextWindow: 128_000 },
  "claude-3.5-sonnet": { provider: "anthropic", model: "claude-3-5-sonnet-20241022", maxTokens: 2048, contextWindow: 200_000 },
  "gemini-1.5-pro": { provider: "google", model: "gemini-1.5-pro", maxTokens: 2048, contextWindow: 2_000_000 },
};

type BuiltPrompt = {
  readonly system: string;
  readonly user: string;
  readonly temperature: number;
  readonly pattern: PatternName;
  readonly metadata: { description: string; variablesUsed: readonly string[] };
};

function renderTemplate(template: string, vars: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name];
    if (value === undefined) throw new Error("Missing template variable: " + name);
    return value;
  });
}

function buildPrompt(
  patternName: PatternName,
  variables: Readonly<Record<string, string>>,
  systemOverride?: string,
): BuiltPrompt {
  const pattern = PROMPT_PATTERNS[patternName];
  const missing = pattern.variables.filter((v) => !(v in variables));
  if (missing.length > 0) {
    throw new Error("Missing variables for " + patternName + ": " + missing.join(","));
  }
  const rendered = renderTemplate(pattern.template, variables);
  const system = systemOverride ?? "You are an AI assistant using the " + pattern.name + ".";
  return {
    system,
    user: rendered,
    temperature: pattern.temperature,
    pattern: patternName,
    metadata: { description: pattern.description, variablesUsed: Object.keys(variables) },
  };
}

type OpenAIRequest = {
  model: string;
  messages: ReadonlyArray<{ role: "system" | "user"; content: string }>;
  temperature: number;
  max_tokens: number;
};

type AnthropicRequest = {
  model: string;
  system: string;
  messages: ReadonlyArray<{ role: "user"; content: string }>;
  temperature: number;
  max_tokens: number;
};

type GoogleRequest = {
  model: string;
  contents: ReadonlyArray<{ role: "user"; parts: ReadonlyArray<{ text: string }> }>;
  generationConfig: { temperature: number; maxOutputTokens: number };
};

type ProviderRequest = OpenAIRequest | AnthropicRequest | GoogleRequest;

function formatOpenAI(p: BuiltPrompt, cfg: ModelConfig): OpenAIRequest {
  return {
    model: cfg.model,
    messages: [
      { role: "system", content: p.system },
      { role: "user", content: p.user },
    ],
    temperature: p.temperature,
    max_tokens: cfg.maxTokens,
  };
}

function formatAnthropic(p: BuiltPrompt, cfg: ModelConfig): AnthropicRequest {
  return {
    model: cfg.model,
    system: p.system,
    messages: [{ role: "user", content: p.user }],
    temperature: p.temperature,
    max_tokens: cfg.maxTokens,
  };
}

function formatGoogle(p: BuiltPrompt, cfg: ModelConfig): GoogleRequest {
  return {
    model: cfg.model,
    contents: [{ role: "user", parts: [{ text: p.system + "\n\n" + p.user }] }],
    generationConfig: { temperature: p.temperature, maxOutputTokens: cfg.maxTokens },
  };
}

const FORMATTERS: Readonly<Record<Provider, (p: BuiltPrompt, c: ModelConfig) => ProviderRequest>> = {
  openai: formatOpenAI,
  anthropic: formatAnthropic,
  google: formatGoogle,
};

type SimulatedResponse = {
  response: string;
  tokensUsed: { prompt: number; completion: number; total: number };
  latencyMs: number;
  finishReason: string;
};

function simulateLlmCall(modelName: string, request: ProviderRequest): SimulatedResponse {
  const promptHash = createHash("md5").update(JSON.stringify(request)).digest("hex").slice(0, 8);
  const responses: Record<string, SimulatedResponse> = {
    "gpt-4o": {
      response: "[GPT-4o " + promptHash + "] Simulated response. Thorough and well-structured.",
      tokensUsed: { prompt: 150, completion: 45, total: 195 },
      latencyMs: 850,
      finishReason: "stop",
    },
    "claude-3.5-sonnet": {
      response: "[Claude 3.5 Sonnet " + promptHash + "] Simulated response. Direct and precise.",
      tokensUsed: { prompt: 145, completion: 40, total: 185 },
      latencyMs: 720,
      finishReason: "end_turn",
    },
    "gemini-1.5-pro": {
      response: "[Gemini 1.5 Pro " + promptHash + "] Simulated response. Comprehensive grounding.",
      tokensUsed: { prompt: 155, completion: 42, total: 197 },
      latencyMs: 900,
      finishReason: "STOP",
    },
  };
  return responses[modelName] ?? {
    response: "Unknown model",
    tokensUsed: { prompt: 0, completion: 0, total: 0 },
    latencyMs: 0,
    finishReason: "unknown",
  };
}

type Criteria = {
  maxWords?: number;
  requiredKeywords?: readonly string[];
  forbiddenPhrases?: readonly string[];
  expectedFormat?: "json" | "bullet_points" | "numbered_list";
};

type Score = {
  wordCount?: number;
  lengthCompliant?: boolean;
  keywordsFound?: readonly string[];
  keywordCoverage?: number;
  forbiddenViolations?: readonly string[];
  noViolations?: boolean;
  formatValid?: boolean;
  compositeScore: number;
};

function scoreResponse(text: string, criteria: Criteria): Score {
  const lower = text.toLowerCase();
  const score: Mutable<Score> = { compositeScore: 0 };
  const components: number[] = [];

  if (criteria.maxWords !== undefined) {
    const wc = text.trim().split(/\s+/).length;
    score.wordCount = wc;
    score.lengthCompliant = wc <= criteria.maxWords;
    components.push(score.lengthCompliant ? 1 : 0);
  }
  if (criteria.requiredKeywords) {
    const found = criteria.requiredKeywords.filter((kw) => lower.includes(kw.toLowerCase()));
    score.keywordsFound = found;
    score.keywordCoverage = criteria.requiredKeywords.length === 0 ? 1 : found.length / criteria.requiredKeywords.length;
    components.push(score.keywordCoverage);
  }
  if (criteria.forbiddenPhrases) {
    const violations = criteria.forbiddenPhrases.filter((p) => lower.includes(p.toLowerCase()));
    score.forbiddenViolations = violations;
    score.noViolations = violations.length === 0;
    components.push(score.noViolations ? 1 : 0);
  }
  if (criteria.expectedFormat) {
    if (criteria.expectedFormat === "json") {
      try {
        JSON.parse(text);
        score.formatValid = true;
      } catch {
        score.formatValid = false;
      }
    } else if (criteria.expectedFormat === "bullet_points") {
      const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      const bullets = lines.filter((l) => /^\s*[-*+•]\s+/.test(l));
      score.formatValid = bullets.length >= lines.length * 0.5;
    } else {
      score.formatValid = /^\d+\./m.test(text);
    }
    components.push(score.formatValid ? 1 : 0);
  }

  score.compositeScore = components.length === 0 ? 0 : components.reduce((a, b) => a + b, 0) / components.length;
  return score;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type ModelResult = {
  response: string;
  tokens: SimulatedResponse["tokensUsed"];
  apiLatencyMs: number;
  wallTimeMs: number;
  finishReason: string;
  requestPayload: ProviderRequest;
};

function runPromptTest(prompt: BuiltPrompt, models: readonly string[] = Object.keys(MODEL_CONFIGS)): Record<string, ModelResult> {
  const out: Record<string, ModelResult> = {};
  for (const name of models) {
    const cfg = MODEL_CONFIGS[name];
    if (!cfg) {
      throw new Error("Unknown model: " + name + ". Available models: " + Object.keys(MODEL_CONFIGS).join(", "));
    }
    const request = FORMATTERS[cfg.provider](prompt, cfg);
    const start = Date.now();
    const response = simulateLlmCall(name, request);
    out[name] = {
      response: response.response,
      tokens: response.tokensUsed,
      apiLatencyMs: response.latencyMs,
      wallTimeMs: Date.now() - start,
      finishReason: response.finishReason,
      requestPayload: request,
    };
  }
  return out;
}

function compareModels(results: Record<string, ModelResult>, criteria: Criteria): Array<{ model: string; score: number; tokens: number; latency: number }> {
  const ranked = Object.entries(results).map(([model, r]) => ({
    model,
    score: scoreResponse(r.response, criteria).compositeScore,
    tokens: r.tokens.total,
    latency: r.apiLatencyMs,
  }));
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

function main(): void {
  console.log("=".repeat(60));
  console.log("  PROMPT PATTERN CATALOG");
  console.log("=".repeat(60));
  for (const [name, pattern] of Object.entries(PROMPT_PATTERNS)) {
    console.log("\n  [" + name + "] " + pattern.name);
    console.log("    " + pattern.description);
    console.log("    Variables: " + pattern.variables.join(", "));
    console.log("    Recommended temp: " + pattern.temperature);
  }

  console.log("\n" + "=".repeat(60));
  console.log("  SINGLE PROMPT BUILD + TEST");
  console.log("=".repeat(60));

  const prompt = buildPrompt("persona", {
    role: "a senior DevOps engineer at Netflix",
    experience: "8 years of infrastructure automation",
    style: "direct and practical",
    priority: "reliability over speed",
    task: "Explain why container orchestration matters for microservices.",
  });
  console.log("\n  System: " + prompt.system);
  console.log("  Temperature: " + prompt.temperature);

  const results = runPromptTest(prompt);
  for (const [model, r] of Object.entries(results)) {
    console.log("\n  [" + model + "]");
    console.log("    Response: " + r.response.slice(0, 100));
    console.log("    Tokens: " + JSON.stringify(r.tokens));
    console.log("    Latency: " + r.apiLatencyMs + "ms");
  }

  type TestCase = { name: string; pattern: PatternName; variables: Record<string, string>; criteria: Criteria };
  const suite: readonly TestCase[] = [
    {
      name: "Persona: Technical Writer",
      pattern: "persona",
      variables: {
        role: "a senior technical writer at Stripe",
        experience: "10 years of API documentation",
        style: "precise and example-driven",
        priority: "clarity over comprehensiveness",
        task: "Explain what an API rate limit is and why it exists.",
      },
      criteria: { maxWords: 200, requiredKeywords: ["Simulated"], forbiddenPhrases: ["in conclusion"] },
    },
    {
      name: "Chain-of-Thought: Math",
      pattern: "chain_of_thought",
      variables: { problem: "20% discount on $85 vs $10 coupon. Which order saves more?" },
      criteria: { requiredKeywords: ["Simulated"], maxWords: 300 },
    },
    {
      name: "Guardrail: Scoped Assistant",
      pattern: "guardrail",
      variables: {
        role: "Python programming tutor",
        domain: "Python programming",
        additional_rules: "Do not write complete solutions.",
        question: "How do I sort a list of dictionaries by a key?",
      },
      criteria: { requiredKeywords: ["Simulated"] },
    },
  ];

  console.log("\n" + "=".repeat(60));
  console.log("  TEST SUITE");
  console.log("=".repeat(60));
  for (const test of suite) {
    const p = buildPrompt(test.pattern, test.variables);
    const rs = runPromptTest(p);
    const ranked = compareModels(rs, test.criteria);
    console.log("\n  Test: " + test.name);
    console.log("  Pattern: " + test.pattern);
    for (const r of ranked) {
      console.log("    " + r.model.padEnd(20) + " score=" + r.score.toFixed(3) + " tokens=" + r.tokens + " latency=" + r.latency + "ms");
    }
  }
}

main();
