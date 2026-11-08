# Evidence: cheatsheets/tool-calling.md

Abbreviations: A = phases/11-llm-engineering/03-structured-outputs/docs/en.md, F = phases/11-llm-engineering/09-function-calling/docs/en.md, T1 = phases/13-tools-and-protocols/01-the-tool-interface, T2 = phases/13-tools-and-protocols/02-function-calling-deep-dive/docs/en.md, T3 = phases/13-tools-and-protocols/03-parallel-and-streaming-tool-calls, T4 = phases/13-tools-and-protocols/04-structured-output, T5 = phases/13-tools-and-protocols/05-tool-schema-design/docs/en.md, C21 = phases/19-capstone-projects/21-tool-registry-schema-validation, C23 = phases/19-capstone-projects/23-function-call-dispatcher.

## Function call tasks (task-table, 8)
- declare OpenAI {"type": "function", "function": {...}}: F:63-67, F:582-584
- declare Anthropic {"name", "input_schema"}: F:632-635, F:662
- tool_choice="auto": F:602, F:107
- tool_choice="required": F:96, F:109
- force one tool tool_choice={"type":"function", ...}: F:111
- message.tool_calls: F:605, F:620
- b.type == "tool_use": F:647
- tool_result with tool_use_id: F:657

## Structured output tasks (task-table, 5)
- { type: "json_object" } JSON mode, no schema guarantee: A:55
- {type: "json_schema", strict: true}: T4/docs/en.md:29
- response_format=Product with beta.chat.completions.parse: A:441-447
- message.parsed: A:450
- instructor.from_openai, retries with validation errors: A:493, A:507

## The tool loop (architecture, 6 nodes, 6 edges)
- User, Host holds registry, loop bound: T1/docs/en.md:21, 57, 148; F:40-46
- Model text, call or refuse: T1/docs/en.md:41-45
- Validator JSON Schema 2020-12: T1/docs/en.md:35, 51
- Executor your code: T1/docs/en.md:53; F:57
- Tool result as tool message with same id: T1/docs/en.md:57, 142
- edges message, tools, tool call, valid args, result, observe: F:45-51; T1/docs/en.md:21, 51, 57

## One tool call (flow, 7)
1. declare name, description, input schema: T1/docs/en.md:31-35
2. answer, call, refuse: T1/docs/en.md:41-45
3. id, name, arguments: T1/docs/en.md:47
4. validate arguments: T1/docs/en.md:51
5. executor, serializable result: T1/docs/en.md:53
6. tool message with matching id: T1/docs/en.md:57
7. repeat until no calls or MAX_TURNS: T1/docs/en.md:57; T1/code/main.py:28, 184

## OpenAI round trip (annotated-code, 13 lines)
- create with model, messages, tools, tool_choice="auto": F:598-603
- tool_calls[0]: F:605
- json.loads(tool_call.function.arguments), arguments are a string: F:606; T2:50
- get_weather(**args): F:607
- assistant message, tool message with tool_call_id and json.dumps(result): F:611-615
- final create: F:609-616 (messages list shortened to a variable)

## Validate, then repair or refuse (annotated-code, 11 lines)
- process_model_output body: T4/code/main.py:125-136 (docstring line 126 left out)
- refusal does not retry: T4/docs/en.md:115
- inject errors and retry: T4/docs/en.md:95

## Shapes by provider (concepts, 6)
- schema field: T2:48
- call container: T2:49
- arguments string vs object: T2:50
- result link: T2:52
- forbid tools: T2:54
- strict schema: T2:55

## Parallel and streaming calls (concepts, 7)
- parallel_tool_calls: true default: T3/docs/en.md:51
- serial when dependent: T3/docs/en.md:55
- correlate by id, order free: T3/docs/en.md:59, 101
- OpenAI per index until finish_reason = "tool_calls": T3/docs/en.md:77
- Anthropic input_json_delta, content_block_stop: T3/docs/en.md:78
- partial JSON raises, parse at end signal: T3/docs/en.md:83
- 400, 600, 800 ms: 1800 serial, 800 parallel: T3/docs/en.md:105; T3/code/main.py:25

## Schema design rules (concepts, 5)
- snake_case, verb-noun, no arguments in name: T5:33-38
- Use when ... Do not use for ...: T5:45
- enum every closed set: T5:86
- split when action has more than three values: T5:82
- strict: required, additionalProperties: false, no $ref: T4/docs/en.md:51

## Limits and defaults (defaults, 8)
- OpenAI 128 tools per request: T2:59
- OpenAI schema depth 5: T2:59
- OpenAI argument string 8192 bytes: T2:59
- Anthropic 64 tools: T2:60
- 1024 characters, truncated: T5:57
- MAX_TURNS 5: T1/code/main.py:28
- retries max 3x, more means bad schema: T4/docs/en.md:95, 98
- timeout_ms 30_000: C21/code/main.py:58

## Troubleshooting (troubleshooting, 8)
- json.loads on partial JSON: T3/docs/en.md:83
- 400 at request time in strict mode: T4/docs/en.md:51
- wrong tool, overlapping descriptions, Do not use for: T5:21, 55
- enum confusion, constrained decoding: A:128
- refusal as typed outcome: T4/docs/en.md:72, 88
- extra fields, Anthropic advisory, validate server-side: T2:97
- schema errors deterministic, no retry: C23/docs/en.md:59
- matched by name breaks, return ids: T3/docs/en.md:63

## Questions and answers (qa, 4)
- structured output vs call: F:130-134
- prompt JSON fails 5 to 15 percent: T1/docs/en.md:81
- call id for out-of-order parallel results: T1/docs/en.md:47
- schema cannot catch invented values: A:126

## Tips (tips, 5)
- structured error result with CITY_NOT_FOUND: F:156-162
- errors for the model, 'city' is required: T5:98
- JSON pointer paths /user/email: C21/docs/en.md:68
- make key fields required, explicit null: A:134
- expose only needed functions: F:142
