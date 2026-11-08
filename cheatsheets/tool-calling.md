---
id: tool-calling
title: Tool Calling and Structured Outputs
code: TC
subtitle: Declare tools, read calls, return results, run calls in parallel, stream arguments, and force JSON that validates.
hue: 30
sources: phases/11-llm-engineering/03-structured-outputs, phases/11-llm-engineering/09-function-calling, phases/13-tools-and-protocols/01-the-tool-interface, phases/13-tools-and-protocols/02-function-calling-deep-dive, phases/13-tools-and-protocols/03-parallel-and-streaming-tool-calls, phases/13-tools-and-protocols/04-structured-output, phases/13-tools-and-protocols/05-tool-schema-design, phases/19-capstone-projects/21-tool-registry-schema-validation, phases/19-capstone-projects/23-function-call-dispatcher
source_hash: ba9bf49229d13a30
---

## Function call tasks
type: task-table
from: phases/11-llm-engineering/09-function-calling/docs/en.md

| Task | Code |
|---|---|
| Declare a tool, OpenAI | `{"type": "function", "function": {...}}` |
| Declare a tool, Anthropic | `{"name": ..., "input_schema": {...}}` |
| Let the model decide | `tool_choice="auto"` |
| Require a tool call | `tool_choice="required"` |
| Force one tool | `tool_choice={"type":"function", ...}` |
| Read OpenAI calls | `message.tool_calls` |
| Find an Anthropic call | `b.type == "tool_use"` |
| Return an Anthropic result | `{"type": "tool_result", "tool_use_id": ...}` |

## Structured output tasks
type: task-table
from: phases/11-llm-engineering/03-structured-outputs/docs/en.md, phases/13-tools-and-protocols/04-structured-output/docs/en.md

| Task | Code |
|---|---|
| Valid JSON, no schema | `{ type: "json_object" }` |
| JSON that fits a schema | `{type: "json_schema", strict: true}` |
| Parse into a Pydantic model | `response_format=Product` |
| Read the typed result | `message.parsed` |
| Retry on validation errors | `instructor.from_openai(OpenAI())` |

## The tool loop
type: architecture
from: phases/13-tools-and-protocols/01-the-tool-interface/docs/en.md, phases/11-llm-engineering/09-function-calling/docs/en.md

```arch
node | user | 1,1 | User | message
node | host | 2,1 | Host | registry, loop bound
node | model | 3,1 | Model | text, call or refuse
node | result | 1,2 | Tool result | tool message, same id
node | exec | 2,2 | Executor | your code runs it
node | valid | 3,2 | Validator | JSON Schema 2020-12
edge | user | host | message
edge | host | model | tools
edge | model | valid | tool call
edge | valid | exec | valid args
edge | exec | result | result
edge | result | host | observe
```

## One tool call
type: flow
from: phases/13-tools-and-protocols/01-the-tool-interface/docs/en.md, phases/13-tools-and-protocols/01-the-tool-interface/code/main.py, phases/11-llm-engineering/09-function-calling/docs/en.md

1. **Host**: declares name, description and input schema.
2. **Model**: answers, calls tools, or refuses.
3. **Model**: each call has `id`, `name`, `arguments`.
4. **Host**: validates the arguments against the schema.
5. **Executor**: runs the code, returns a serializable result.
6. **Host**: appends a `tool` message with the same id.
7. **Host**: repeats until no calls or `MAX_TURNS`.

## OpenAI round trip
type: annotated-code
lang: python
from: phases/11-llm-engineering/09-function-calling/docs/en.md

```python
response = client.chat.completions.create(
    model="gpt-4o", messages=messages,
    tools=tools, tool_choice="auto",           # model picks tool or text
)
tool_call = response.choices[0].message.tool_calls[0]
args = json.loads(tool_call.function.arguments)  # arguments are a string
result = get_weather(**args)                   # your code executes
messages += [
    response.choices[0].message,               # keep the assistant turn
    {"role": "tool", "tool_call_id": tool_call.id,  # same id as the call
     "content": json.dumps(result)},
]
final = client.chat.completions.create(model="gpt-4o", messages=messages)
```

## Validate, then repair or refuse
type: annotated-code
lang: python
from: phases/13-tools-and-protocols/04-structured-output/code/main.py, phases/13-tools-and-protocols/04-structured-output/docs/en.md

```python
def process_model_output(raw: str, schema: dict) -> ParsedResult:
    if raw.startswith("__REFUSAL__"):            # model declined: no retry
        return ParsedResult("refusal", raw.removeprefix("__REFUSAL__").strip(), [])
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:            # failure 1: not JSON
        return ParsedResult("parse_error", None, [ValidationError("$", str(e))])
    errs = validate(schema, parsed)              # list of path and message
    if errs:
        return ParsedResult("violation", parsed, errs)  # inject errs, retry
    return ParsedResult("ok", parsed, [])
```

## Shapes by provider
type: concepts
from: phases/13-tools-and-protocols/02-function-calling-deep-dive/docs/en.md

- **Schema field**: `parameters`, `input_schema`, Gemini `parameters`.
- **Call**: `tool_calls[]`, a `tool_use` block, a `functionCall` part.
- **Arguments**: OpenAI sends a string. The others send an object.
- **Result link**: `tool_call_id`, `tool_use_id`, `functionResponse` id.
- **Forbid tools**: `tool_choice: "none"`, `{type: "none"}`, `mode: "NONE"`.
- **Strict**: `strict: true`, always on, `responseSchema`.

## Parallel and streaming calls
type: concepts
from: phases/13-tools-and-protocols/03-parallel-and-streaming-tool-calls/docs/en.md, phases/13-tools-and-protocols/03-parallel-and-streaming-tool-calls/code/main.py

- **Enable**: `parallel_tool_calls: true` is the OpenAI default.
- **Serial**: Turn it off when calls depend on each other.
- **Correlate**: Each result carries its call id. Order is free.
- **OpenAI stream**: Join chunks per `index` until `finish_reason = "tool_calls"`.
- **Anthropic stream**: `input_json_delta` chunks until `content_block_stop`.
- **Parse late**: Partial JSON raises. Parse at the end signal.
- **Latency**: 400, 600, 800 ms: 1800 ms serial, 800 ms parallel.

## Schema design rules
type: concepts
from: phases/13-tools-and-protocols/05-tool-schema-design/docs/en.md, phases/13-tools-and-protocols/04-structured-output/docs/en.md

- **Name**: `snake_case`, verb then noun: `get_weather`. No arguments in the name.
- **Description**: "Use when {condition}. Do not use for {close-but-wrong-cases}."
- **Enums**: Put every closed set in an `enum`.
- **Atomic tools**: Split a tool when `action` has more than three values.
- **Strict mode**: Every property in `required`, `additionalProperties: false`, no `$ref`.

## Limits and defaults
type: defaults
from: phases/13-tools-and-protocols/02-function-calling-deep-dive/docs/en.md, phases/13-tools-and-protocols/05-tool-schema-design/docs/en.md, phases/13-tools-and-protocols/01-the-tool-interface/code/main.py, phases/13-tools-and-protocols/04-structured-output/docs/en.md, phases/19-capstone-projects/21-tool-registry-schema-validation/code/main.py

| Setting | Default | Note |
|---|---|---|
| OpenAI tools per request | 128 | Hard limit |
| Anthropic tools per request | 64 | Hard limit |
| OpenAI schema depth | 5 | Strict mode |
| OpenAI argument string | 8192 bytes | Maximum size |
| Description length | 1024 characters | Longer text is truncated |
| `MAX_TURNS` | 5 | Lesson loop bound |
| Repair retries | 3x | More means a bad schema |
| `timeout_ms` | 30_000 | Per tool record |

## Troubleshooting
type: troubleshooting
from: phases/13-tools-and-protocols/03-parallel-and-streaming-tool-calls/docs/en.md, phases/13-tools-and-protocols/04-structured-output/docs/en.md, phases/13-tools-and-protocols/05-tool-schema-design/docs/en.md, phases/13-tools-and-protocols/02-function-calling-deep-dive/docs/en.md, phases/11-llm-engineering/03-structured-outputs/docs/en.md, phases/19-capstone-projects/23-function-call-dispatcher/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `json.loads` raises mid-stream | Arguments are partial JSON | Parse after the end-of-call signal |
| 400 at request time, strict mode | Strict schema rule broken | All in `required`, no `$ref` |
| Wrong tool picked | Two descriptions overlap | Add a "Do not use for" line |
| Value outside the `enum` | Prompt-based output | Use constrained decoding |
| `refusal` in the response | Input does not fit the schema | Handle it as a typed outcome |
| Extra fields in `input` | Anthropic schema is advisory | Validate on the server |
| Schema errors retried | Errors are deterministic | Fix the arguments, no retry |
| Results on the wrong call | Matched by name, not id | Return each result with its id |

## Questions and answers
type: qa
from: phases/11-llm-engineering/09-function-calling/docs/en.md, phases/13-tools-and-protocols/01-the-tool-interface/docs/en.md, phases/13-tools-and-protocols/04-structured-output/docs/en.md, phases/11-llm-engineering/03-structured-outputs/docs/en.md

- **Structured output or call?** Output is final data. A call asks to act.
- **Why not prompt for JSON?** It fails 5 to 15 percent of the time.
- **Why a call id?** Parallel results return out of order.
- **Can a schema catch a wrong value?** No. Type right, value invented.

## Tips
type: tips
from: phases/11-llm-engineering/09-function-calling/docs/en.md, phases/13-tools-and-protocols/05-tool-schema-design/docs/en.md, phases/11-llm-engineering/03-structured-outputs/docs/en.md, phases/19-capstone-projects/21-tool-registry-schema-validation/docs/en.md

- Return errors as results: `{"error": true, "code": "CITY_NOT_FOUND"}`.
- Write errors for the model: "'city' is required."
- Report errors as JSON pointer paths: `/user/email`.
- Make key fields required. The model writes `null`.
- Expose only the functions the user needs.
