---
id: agent-tool-use-skills
title: Agent Tool Use and Skill Libraries
code: AT
subtitle: Define, validate, dispatch and secure tool calls. Store skills as code, retrieve, compose and refine them.
hue: 160
sources: phases/14-agent-engineering/06-tool-use-and-function-calling, phases/14-agent-engineering/10-skill-libraries-voyager, phases/11-llm-engineering/09-function-calling
source_hash: 38005f151c51ea9a
---

## The function calling loop
type: architecture
from: phases/11-llm-engineering/09-function-calling/docs/en.md

```arch
node | user | 1,1 | User | sends a message | client
node | app | 2,1 | Application | executes tools | process
node | model | 3,1 | Model | decides the call | model
node | tool | 2,2 | Tool | get_weather("Tokyo") | process
node | reg | 3,2 | Tool definitions | JSON Schema | store
edge | user | app | message
edge | app | model | messages + tool definitions
edge | model | app | tool_call
edge | app | tool | execute
edge | tool | app | result
edge | reg | model | schemas
```

## Tool schema
type: annotated-code
lang: json
from: phases/11-llm-engineering/09-function-calling/docs/en.md

```json
{"type": "function", "function": {
  "name": "get_weather",
  "description": "Get current weather for a city.",  # a prompt for tool selection
  "parameters": {"type": "object",  # Anthropic: input_schema
    "properties": {"city": {"type": "string"},
      "units": {"enum": ["celsius", "fahrenheit"]}},
    "required": ["city"]}}}  # missing field: error observation
```

## Providers side by side
type: comparison
span: 2
from: phases/11-llm-engineering/09-function-calling/docs/en.md, phases/14-agent-engineering/06-tool-use-and-function-calling/docs/en.md

| Factor | OpenAI | Anthropic | Google |
|---|---|---|---|
| Tools parameter | `tools` | `tools` | `function_declarations` |
| Call format | `tool_calls[].function` | `content[].type="tool_use"` | `functionCall` |
| Schema field | `function.parameters` | `input_schema` | JSON Schema |
| Forced call | `tool_choice="required"` | `tool_choice={"type":"any"}` | `function_calling_config` |
| Result goes back as | `{"role": "tool", "tool_call_id": ...}` | `type: "tool_result"` in a user message | Not in the lesson table |

## Tasks in code
type: task-table
from: phases/14-agent-engineering/06-tool-use-and-function-calling/code/main.py, phases/14-agent-engineering/10-skill-libraries-voyager/code/main.py, phases/11-llm-engineering/09-function-calling/code/function_calling.py, phases/14-agent-engineering/06-tool-use-and-function-calling/docs/en.md, phases/14-agent-engineering/10-skill-libraries-voyager/docs/en.md

| Task | Code |
|---|---|
| Register a tool | `reg.register(ToolDef(...))` |
| Show the catalog to the model | `reg.catalog()` |
| Run calls of one turn | `reg.dispatch_many(calls)` |
| Check args against a schema | `validate(args, schema)` |
| Run the loop with a cap | `run_function_calling_loop(user_message, max_iterations=5)` |
| Find skills for a task | `lib.search("I need a pickaxe")` |
| Run a skill with its deps | `lib.execute("craft_iron_pickaxe")` |
| Run the demo | `python3 code/main.py` |

## Registry with structured errors
type: annotated-code
lang: python
from: phases/14-agent-engineering/06-tool-use-and-function-calling/code/main.py

```python
reg = ToolRegistry()
reg.register(ToolDef(name="classify", description="<when to use>",
    input_schema={"type": "object", "required": ["status"],
        "properties": {"status": {"type": "string",
            "enum": ["open", "closed", "pending"]}}},
    executor=classify))   # timeout_s defaults to 5.0
calls = [ToolCall("u02", "multiply", {"a": "4", "b": 5}),  # "4" coerces
         ToolCall("u03", "classify", {"status": "in_progress"})]  # not in enum
for result in reg.dispatch_many(calls):
    result.ok, result.content  # errors are strings, never raised
```

## Skill library loop
type: annotated-code
lang: python
from: phases/14-agent-engineering/10-skill-libraries-voyager/code/main.py

```python
lib = SkillLibrary()
lib.register(Skill(name="craft_iron_pickaxe", description="<what it does>",
    code="mine_ore(); place_table(); craft('iron_pickaxe')",
    fn=_craft_iron_pick_v1, tags=("craft", "tool"),
    depends_on=("mine_ore", "place_crafting_table")))  # v1
lib.search("I need a pickaxe")           # token overlap, top_k=3
ctx = lib.execute("craft_iron_pickaxe")  # deps first, topo_order
ctx["failed"]                            # True: need 2 stick, have 0
lib.register(Skill(..., fn=_craft_iron_pick_v2))  # same name: v2
```

## Voyager refinement loop
type: flow
from: phases/14-agent-engineering/10-skill-libraries-voyager/docs/en.md

1. **Curriculum**: proposes a task just above current capability.
2. **Library**: returns top-k skills by query-to-description similarity.
3. **Agent**: writes or composes a skill as executable code.
4. **Environment**: runs the skill and returns `success`, `error` or `self-verification failure`.
5. **Agent**: rewrites the skill with the signal as context.
6. **Library**: stores the new version. The loop stops at success or max rounds.

## Validation failures and fixes
type: troubleshooting
from: phases/14-agent-engineering/06-tool-use-and-function-calling/code/main.py, phases/14-agent-engineering/06-tool-use-and-function-calling/docs/en.md, phases/14-agent-engineering/10-skill-libraries-voyager/docs/en.md, phases/11-llm-engineering/09-function-calling/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `error: unknown tool 'subtract'` | Model calls a tool that does not exist | Return the error. Add a no-op tool to refuse |
| `missing required: <name>` | Required field absent | Send the error back. The model retries |
| `'in_progress' not in [...]` | Value outside the enum | Reject with a descriptive error |
| Wrong tool picked | Bad tool description | Say what the tool does and when to use it |
| Results routed to wrong calls | Swapped `tool_use_id` values | Correlate each result by its ID |
| Retrieval gets worse | Library past a few hundred skills | Add tag filters and hard constraints |

## Defaults in the lesson code
type: defaults
from: phases/14-agent-engineering/06-tool-use-and-function-calling/code/main.py, phases/14-agent-engineering/10-skill-libraries-voyager/code/main.py, phases/11-llm-engineering/09-function-calling/code/function_calling.py

| Setting | Default | Note |
|---|---|---|
| `timeout_s` | `5.0` | Per tool in `ToolDef` |
| `version` | `1` | New `Skill` |
| `dedup` | `True` | Same name refines the skill |
| `top_k` | `3` | Skill search results |
| `tag_filter` | `None` | Set it to limit search to one tag |
| `max_iterations` | `5` | `run_function_calling_loop` |

## Numbers that matter
type: concepts
from: phases/14-agent-engineering/06-tool-use-and-function-calling/docs/en.md, phases/14-agent-engineering/10-skill-libraries-voyager/docs/en.md, phases/11-llm-engineering/09-function-calling/docs/en.md

- **BFCL V4**: 40% agentic, 30% multi-turn, 10% live, 10% non-live, 10% hallucination.
- **Parallel calls**: cut round trips from 2 to 1.
- **Parallel latency**: 60-80% less for 5-10 tool calls per query.
- **Call budget**: 10-20 calls per conversation is reasonable.
- **Voyager**: 3.3x more unique items, 8.5x faster stone tools, 6.4x faster iron tools.
- **Toolformer**: keep a tool call only when its result reduces next-token loss.

## Security rules
type: tips
from: phases/11-llm-engineering/09-function-calling/docs/en.md, phases/11-llm-engineering/09-function-calling/code/function_calling.py, phases/14-agent-engineering/06-tool-use-and-function-calling/docs/en.md

- Never pass model-generated SQL directly to a database. Parameterize it.
- Allowlist functions. Expose only the tools the user needs.
- Validate every argument for type, range and format.
- Sanitize tool results. Remove API keys, PII and internal errors.
- `run_code` parses the code with `ast.parse` and blocks imports and dunder access.
- Run untrusted code in a separate process or container.

## Questions
type: qa
from: phases/11-llm-engineering/09-function-calling/docs/en.md, phases/14-agent-engineering/06-tool-use-and-function-calling/docs/en.md, phases/14-agent-engineering/10-skill-libraries-voyager/docs/en.md

- **Who executes the tool?** Your code. The model only decides what to call.
- **Structured outputs or function calling?** Structured outputs for data extraction. Function calling to act on external systems.
- **Why return errors as results?** Models self-correct from structured errors. They fail on empty or generic errors.
- **What is a skill?** A named chunk of code plus a description, retrievable by similarity.
- **Why version skills?** A parent pinned to v1 does not pick up v3 of a child.
