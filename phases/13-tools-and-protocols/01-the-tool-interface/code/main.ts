// Phase 13 Lesson 01 — the tool interface, in TypeScript.
//
// Mirrors code/main.py: describe -> decide -> execute -> observe.
// The "decide" step is faked with a keyword router so the loop runs offline;
// replace with any real provider client and the shape stays the same.
//
// Spec references:
//   OpenAI tool calling     https://platform.openai.com/docs/guides/function-calling
//   Anthropic tool use      https://docs.anthropic.com/en/docs/build-with-claude/tool-use
//   MCP tool primitive      https://modelcontextprotocol.io/specification/2025-11-25
//
// Run: npx tsx code/main.ts

import { randomUUID } from "node:crypto";

const MAX_TURNS = 5;

type JsonSchema = {
  type?: "object" | "string" | "number" | "integer" | "boolean" | "array";
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: unknown[];
};

type ToolArgs = Record<string, unknown>;
type ToolResult = Record<string, unknown>;

type Tool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  executor: (args: ToolArgs) => ToolResult;
  consequential?: boolean;
};

type HistoryEntry =
  | { role: "user"; content: string }
  | { role: "tool"; id: string; name: string; content: string };

type ToolCall = {
  id: string;
  name: string;
  arguments: ToolArgs;
};

type Decision = { content: string } | { toolCalls: ToolCall[] };

function toolAdd(args: ToolArgs): ToolResult {
  const a = args.a as number;
  const b = args.b as number;
  return { sum: a + b };
}

function toolGetTime(args: ToolArgs): ToolResult {
  const timezone = (args.timezone as string | undefined) ?? "UTC";
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  return { now, timezone };
}

function toolGetWeather(args: ToolArgs): ToolResult {
  const fake: Record<string, number> = {
    Bengaluru: 28,
    Tokyo: 12,
    Zurich: 4,
    Lagos: 31,
  };
  const city = args.city as string;
  const units = (args.units as string | undefined) ?? "celsius";
  const temp = fake[city] ?? 20;
  return { city, temp, units };
}

const REGISTRY: Tool[] = [
  {
    name: "add",
    description:
      "Use when the user asks for the sum of two numbers. " +
      "Do not use for subtraction, product, or symbolic algebra.",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number" },
        b: { type: "number" },
      },
      required: ["a", "b"],
    },
    executor: toolAdd,
  },
  {
    name: "get_time",
    description:
      "Use when the user asks what time it is. " +
      "Do not use for historical dates or future scheduling.",
    inputSchema: {
      type: "object",
      properties: {
        timezone: { type: "string" },
      },
      required: [],
    },
    executor: toolGetTime,
  },
  {
    name: "get_weather",
    description:
      "Use when the user asks about current conditions in a named city. " +
      "Do not use for forecasts or historical weather data.",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string" },
        units: { type: "string", enum: ["celsius", "fahrenheit"] },
      },
      required: ["city"],
    },
    executor: toolGetWeather,
  },
];

function validate(schema: JsonSchema, value: unknown): string[] {
  const errors: string[] = [];
  const t = schema.type;

  if (t === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return [`expected object, got ${describeType(value)}`];
    }
    const obj = value as Record<string, unknown>;
    for (const field of schema.required ?? []) {
      if (!(field in obj)) errors.push(`missing required field '${field}'`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in obj) errors.push(...validate(sub, obj[key]));
    }
    return errors;
  }

  if (t === "number" && typeof value !== "number") {
    errors.push(`expected number, got ${describeType(value)}`);
  }
  if (t === "string" && typeof value !== "string") {
    errors.push(`expected string, got ${describeType(value)}`);
  }
  if (schema.enum && !schema.enum.includes(value as never)) {
    errors.push(`value ${JSON.stringify(value)} not in enum ${JSON.stringify(schema.enum)}`);
  }
  return errors;
}

function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function newCallId(): string {
  return `call_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

// Stand-in for the model. Routes by keyword so the loop runs offline.
// Production substitute: replace with a provider call returning the same shape.
function fakeDecide(userMsg: string, history: HistoryEntry[]): Decision {
  const last = history[history.length - 1];
  if (last && last.role === "tool") {
    return { content: `Final answer built from tool output: ${last.content}` };
  }
  const msg = userMsg.toLowerCase();

  if (/\b(add|sum|plus)\b/.test(msg)) {
    const nums = (msg.match(/-?\d+\.?\d*/g) ?? []).map((n) => Number(n));
    if (nums.length >= 2) {
      return {
        toolCalls: [
          { id: newCallId(), name: "add", arguments: { a: nums[0], b: nums[1] } },
        ],
      };
    }
  }

  if (msg.includes("time")) {
    return {
      toolCalls: [
        { id: newCallId(), name: "get_time", arguments: { timezone: "UTC" } },
      ],
    };
  }

  const weatherMatch = msg.match(/weather in (\w+)/);
  if (weatherMatch) {
    const city = weatherMatch[1][0].toUpperCase() + weatherMatch[1].slice(1);
    return {
      toolCalls: [
        {
          id: newCallId(),
          name: "get_weather",
          arguments: { city, units: "celsius" },
        },
      ],
    };
  }

  return { content: "I cannot route that query to any registered tool." };
}

function runLoop(userMsg: string): void {
  console.log("=".repeat(72));
  console.log(`USER : ${userMsg}`);
  console.log("-".repeat(72));

  const toolsByName = new Map(REGISTRY.map((t) => [t.name, t]));
  const history: HistoryEntry[] = [{ role: "user", content: userMsg }];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const decision = fakeDecide(userMsg, history);

    if ("content" in decision) {
      console.log(`TURN ${turn} DECIDE : final answer`);
      console.log(`MODEL : ${decision.content}`);
      return;
    }

    for (const call of decision.toolCalls) {
      const tool = toolsByName.get(call.name);
      console.log(`TURN ${turn} DECIDE : call ${call.name} id=${call.id}`);
      console.log(`           args = ${JSON.stringify(call.arguments)}`);

      if (!tool) {
        console.log(`           ERROR : unknown tool ${call.name}`);
        return;
      }
      const errs = validate(tool.inputSchema, call.arguments);
      if (errs.length > 0) {
        console.log(`           VALIDATION ERRORS : ${JSON.stringify(errs)}`);
        return;
      }
      if (tool.consequential) {
        console.log("           GATE : tool is consequential, would confirm");
      }

      const start = performance.now();
      const result = tool.executor(call.arguments);
      const ms = performance.now() - start;
      console.log(
        `TURN ${turn} EXECUTE: ${tool.name} -> ${JSON.stringify(result)} [${ms.toFixed(2)} ms]`,
      );
      history.push({
        role: "tool",
        id: call.id,
        name: tool.name,
        content: JSON.stringify(result),
      });
    }
    console.log(`TURN ${turn} OBSERVE: history length = ${history.length}`);
  }
  console.log("LOOP TERMINATED : hit MAX_TURNS circuit breaker");
}

function describeRegistry(): void {
  console.log("TOOL REGISTRY");
  console.log("-".repeat(72));
  for (const t of REGISTRY) {
    const kind = t.consequential ? "consequential" : "pure";
    console.log(`  ${t.name.padEnd(14)} [${kind}] - ${t.description}`);
  }
  console.log();
}

function main(): void {
  console.log("=".repeat(72));
  console.log("PHASE 13 LESSON 01 - THE TOOL INTERFACE (TypeScript port)");
  console.log("=".repeat(72));
  describeRegistry();
  const queries = [
    "please add 7 and 35",
    "what time is it?",
    "tell me the weather in Bengaluru",
    "write me a haiku about tea",
  ];
  for (const q of queries) {
    runLoop(q);
    console.log();
  }
}

main();
