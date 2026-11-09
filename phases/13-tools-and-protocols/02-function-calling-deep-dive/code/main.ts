// Lesson: Function Calling Deep Dive: OpenAI, Anthropic, Gemini (phase 13 / lesson 02)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/02-function-calling-deep-dive/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/02-function-calling-deep-dive/code/main.ts

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

function pyJsonString(s: string): string {
  return JSON.stringify(s).replace(/[\u0080-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

function pyJson(value: Json, indent?: number, sortKeys = false, level = 0): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyJsonString(value);
  const itemSep = indent === undefined ? ", " : ",";
  const pad = indent === undefined ? "" : "\n" + " ".repeat(indent * (level + 1));
  const end = indent === undefined ? "" : "\n" + " ".repeat(indent * level);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return "[" + value.map((v) => pad + pyJson(v, indent, sortKeys, level + 1)).join(itemSep) + end + "]";
  }
  let keys = Object.keys(value);
  if (keys.length === 0) return "{}";
  if (sortKeys) keys = [...keys].sort();
  return "{" + keys.map((k) => pad + pyJsonString(k) + ": " + pyJson(value[k], indent, sortKeys, level + 1)).join(itemSep) + end + "}";
}

function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const c of s) {
    if (c === "\\") out += "\\\\";
    else if (c === quote) out += "\\" + c;
    else if (c === "\n") out += "\\n";
    else if (c === "\r") out += "\\r";
    else if (c === "\t") out += "\\t";
    else if (c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f) out += "\\x" + c.charCodeAt(0).toString(16).padStart(2, "0");
    else out += c;
  }
  return quote + out + quote;
}

function pyRepr(value: Json): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyStrRepr(value);
  if (Array.isArray(value)) return "[" + value.map(pyRepr).join(", ") + "]";
  return "{" + Object.keys(value).map((k) => pyStrRepr(k) + ": " + pyRepr(value[k])).join(", ") + "}";
}

function pyTypeName(value: Json): string {
  if (value === null) return "NoneType";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
  if (typeof value === "string") return "str";
  if (Array.isArray(value)) return "list";
  return "dict";
}

class Tool {
  constructor(
    public name: string,
    public description: string,
    public input_schema: JsonObject,
    public strict: boolean = true,
  ) {}

  asdict(): JsonObject {
    return { name: this.name, description: this.description, input_schema: this.input_schema, strict: this.strict };
  }
}

class Call {
  constructor(
    public id: string,
    public name: string,
    public args: JsonObject,
  ) {}

  toString(): string {
    return `Call(id=${pyStrRepr(this.id)}, name=${pyStrRepr(this.name)}, args=${pyRepr(this.args)})`;
  }
}

class ToolChoice {
  constructor(
    public mode: string,
    public tool_name: string | null = null,
  ) {}
}

const WEATHER = new Tool(
  "get_weather",
  "Use when the user asks about current conditions in a named city. " +
    "Do not use for forecasts or historical weather data.",
  {
    type: "object",
    properties: {
      city: { type: "string" },
      units: { type: ["string", "null"], enum: ["celsius", "fahrenheit"] },
    },
    required: ["city", "units"],
    additionalProperties: false,
  },
);

function to_openai(tool: Tool): JsonObject {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
      strict: tool.strict,
    },
  };
}

function to_anthropic(tool: Tool): JsonObject {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  };
}

function _gemini_schema(node: Json): Json {
  if (node !== null && typeof node === "object" && !Array.isArray(node)) {
    const out: JsonObject = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "additionalProperties") continue;
      if (k === "type" && typeof v === "string") {
        out["type"] = v.toUpperCase();
        continue;
      }
      out[k] = _gemini_schema(v);
    }
    return out;
  }
  if (Array.isArray(node)) return node.map((x) => _gemini_schema(x));
  return node;
}

function to_gemini(tool: Tool): JsonObject {
  return {
    functionDeclarations: [
      {
        name: tool.name,
        description: tool.description,
        parameters: _gemini_schema(tool.input_schema),
      },
    ],
  };
}

function tool_choice_openai(tc: ToolChoice): Json {
  if (tc.mode === "auto") return "auto";
  if (tc.mode === "none") return "none";
  if (tc.mode === "required") return "required";
  if (tc.mode === "force") return { type: "function", function: { name: tc.tool_name } };
  throw new Error(tc.mode);
}

function tool_choice_anthropic(tc: ToolChoice): JsonObject {
  if (tc.mode === "auto") return { type: "auto" };
  if (tc.mode === "none") return { type: "none" };
  if (tc.mode === "required") return { type: "any" };
  if (tc.mode === "force") return { type: "tool", name: tc.tool_name };
  throw new Error(tc.mode);
}

function tool_choice_gemini(tc: ToolChoice): JsonObject {
  const mode_map: Record<string, string> = { auto: "AUTO", none: "NONE", required: "ANY" };
  if (tc.mode in mode_map) return { function_calling_config: { mode: mode_map[tc.mode] } };
  if (tc.mode === "force") {
    return {
      function_calling_config: {
        mode: "ANY",
        allowed_function_names: [tc.tool_name],
      },
    };
  }
  throw new Error(tc.mode);
}

const OPENAI_RESPONSE: any = {
  choices: [
    {
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_abc123",
            type: "function",
            function: {
              name: "get_weather",
              arguments: '{"city":"Bengaluru","units":"celsius"}',
            },
          },
        ],
      },
      finish_reason: "tool_calls",
    },
  ],
};

const ANTHROPIC_RESPONSE: any = {
  id: "msg_01",
  type: "message",
  role: "assistant",
  content: [
    { type: "text", text: "Looking that up." },
    {
      type: "tool_use",
      id: "toolu_xyz789",
      name: "get_weather",
      input: { city: "Bengaluru", units: "celsius" },
    },
  ],
  stop_reason: "tool_use",
};

const GEMINI_RESPONSE: any = {
  candidates: [
    {
      content: {
        role: "model",
        parts: [
          {
            functionCall: {
              id: "fc-9a3d",
              name: "get_weather",
              args: { city: "Bengaluru", units: "celsius" },
            },
          },
        ],
      },
      finishReason: "STOP",
    },
  ],
};

function parse_openai(resp: any): Call[] {
  const msg = resp["choices"][0]["message"];
  const calls: Call[] = [];
  for (const tc of msg["tool_calls"] ?? []) {
    const fn = tc["function"];
    calls.push(new Call(tc["id"], fn["name"], JSON.parse(fn["arguments"])));
  }
  return calls;
}

function parse_anthropic(resp: any): Call[] {
  const calls: Call[] = [];
  for (const block of resp["content"] ?? []) {
    if (block["type"] === "tool_use") calls.push(new Call(block["id"], block["name"], block["input"]));
  }
  return calls;
}

function parse_gemini(resp: any): Call[] {
  const calls: Call[] = [];
  for (const part of resp["candidates"][0]["content"]["parts"] ?? []) {
    if ("functionCall" in part) {
      const fc = part["functionCall"];
      calls.push(new Call(fc["id"] ?? "", fc["name"], fc["args"]));
    }
  }
  return calls;
}

function diff_line(a: string, b: string, c: string): void {
  console.log(`  OpenAI    : ${a}`);
  console.log(`  Anthropic : ${b}`);
  console.log(`  Gemini    : ${c}`);
}

function main(): void {
  console.log("=".repeat(72));
  console.log("PHASE 13 LESSON 02 - FUNCTION CALLING DEEP DIVE");
  console.log("=".repeat(72));
  console.log("\nCanonical tool:");
  console.log(pyJson(WEATHER.asdict(), 2));

  console.log("\n--- provider declarations ---");
  console.log("\nOpenAI:");
  console.log(pyJson(to_openai(WEATHER), 2));
  console.log("\nAnthropic:");
  console.log(pyJson(to_anthropic(WEATHER), 2));
  console.log("\nGemini:");
  console.log(pyJson(to_gemini(WEATHER), 2));

  console.log("\n--- tool_choice translation ---");
  for (const mode of ["auto", "none", "required", "force"]) {
    const tc = new ToolChoice(mode, mode === "force" ? "get_weather" : null);
    console.log(`\nmode = ${pyStrRepr(mode)}`);
    diff_line(pyJson(tool_choice_openai(tc)), pyJson(tool_choice_anthropic(tc)), pyJson(tool_choice_gemini(tc)));
  }

  console.log("\n--- parsing provider responses ---");
  const oa = parse_openai(OPENAI_RESPONSE)[0];
  const an = parse_anthropic(ANTHROPIC_RESPONSE)[0];
  const gm = parse_gemini(GEMINI_RESPONSE)[0];
  console.log(`\nOpenAI     : ${oa}`);
  console.log(`Anthropic  : ${an}`);
  console.log(`Gemini     : ${gm}`);

  console.log("\n--- id prefixes ---");
  console.log(`  OpenAI     : ${oa.id} (call_...)`);
  console.log(`  Anthropic  : ${an.id} (toolu_...)`);
  console.log(`  Gemini     : ${gm.id} (fc- / UUID from Gemini 3+)`);

  console.log("\n--- args type after parsing ---");
  console.log(`  OpenAI raw args type : string -> ${pyTypeName(oa.args)}`);
  console.log(`  Anthropic raw args   : object -> ${pyTypeName(an.args)}`);
  console.log(`  Gemini raw args      : object -> ${pyTypeName(gm.args)}`);

  console.log("\n--- equivalence check ---");
  const all_names = new Set([oa.name, an.name, gm.name]);
  const all_args = new Set([pyJson(oa.args, undefined, true), pyJson(an.args, undefined, true), pyJson(gm.args, undefined, true)]);
  console.log(`  same tool name across providers : ${all_names.size === 1 ? "True" : "False"}`);
  console.log(`  same args payload across providers : ${all_args.size === 1 ? "True" : "False"}`);
}

main();

export {};
