# Evidence: cheatsheets/agent-tool-use-skills.md

Abbreviations: A = phases/14-agent-engineering/06-tool-use-and-function-calling, V = phases/14-agent-engineering/10-skill-libraries-voyager, F = phases/11-llm-engineering/09-function-calling. d = docs/en.md, c = code/main.py, fc = code/function_calling.py.

## The function calling loop (architecture, 5 nodes, 6 edges)
- User sends a message: F/d:45, 55
- Application executes tools: F/d:48, 57
- Model decides the call: F/d:47, 57
- Tool get_weather("Tokyo"): F/d:48
- Tool definitions as JSON Schema: F/d:46, 55, 61
- edges message, messages + tool definitions, tool_call, execute, result: F/d:45-50

## Tool schema (annotated-code, 8 lines)
- "type": "function", "function", "name": "get_weather": F/d:65-67
- description "Get current weather for a city.": F/d:68. Description is a prompt for tool selection: F/d:88
- "parameters", "type": "object": F/d:69-70. Anthropic uses input_schema: F/d:662, A/d:57
- properties city string, units enum celsius/fahrenheit: F/d:71-80
- "required": ["city"]: F/d:82. Missing field gives an error observation: A/d:65

## Providers side by side (comparison, 5 rows)
- tools / tools / function_declarations: F/d:96-98
- tool_calls[].function / content[].type="tool_use" / functionCall: F/d:96-98
- function.parameters / input_schema: A/d:57, F/d:662. Google JSON Schema: F/d:101
- tool_choice="required" / tool_choice={"type":"any"} / function_calling_config: F/d:96-98
- {"role": "tool", "tool_call_id": ...}: F/d:614. "tool_result" in a user message: F/d:657, 662

## Tasks in code (task-table, 8)
- reg.register(ToolDef(...)): A/c:113, 160
- reg.catalog(): A/c:116, 193
- reg.dispatch_many(calls): A/c:138, 204
- validate(args, schema): A/c:75
- run_function_calling_loop(user_message, max_iterations=5): F/fc:322
- lib.search("I need a pickaxe"): V/c:202
- lib.execute("craft_iron_pickaxe"): V/c:206
- python3 code/main.py: A/d:101, V/d:106

## Registry with structured errors (annotated-code, 10 lines)
- ToolRegistry(), register ToolDef classify with enum open/closed/pending, required status: A/c:159, 180-190
- timeout_s default 5.0: A/c:19
- ToolCall("u02", "multiply", {"a": "4", "b": 5}) coerces: A/c:41-43, 198
- ToolCall("u03", "classify", {"status": "in_progress"}) not in enum: A/c:94-95, 199
- dispatch_many loop, result.ok, result.content: A/c:204-206
- errors are strings, never raised: A/c:209-210

## Skill library loop (annotated-code, 10 lines)
- SkillLibrary(), register craft_iron_pickaxe v1 with code, fn, tags, depends_on: V/c:166, 192-199
- search token overlap, top_k=3: V/c:43, 53-56
- execute runs deps first in topo_order: V/c:64, 89
- ctx["failed"] True, need 2 stick, have 0: V/c:105, 132-133, 205
- re-register same name gives v2 with _craft_iron_pick_v2: V/c:30-39, 212-219

## Voyager refinement loop (flow, 6 steps)
1. Curriculum proposes a task just above current capability: V/d:33, 81
2. Library retrieves top-k skills by query-to-description similarity: V/d:34, 61
3. Agent writes or composes a skill as executable code: V/d:41, 63, 71
4. Environment returns success, error, self-verification failure: V/d:72-73
5. Agent rewrites the skill with the signal as context: V/d:74
6. New version stored, loop until success or max rounds: V/d:75, V/c:38

## Validation failures and fixes (troubleshooting, 6)
- error: unknown tool 'subtract': A/c:127, 201. No-op tool to refuse: A/d:116
- missing required: A/c:83. Error back, model retries: A/d:65, 68
- 'in_progress' not in [...]: A/c:95. Reject with descriptive error: A/d:64
- Wrong tool picked from bad descriptions: A/d:57. Say what and when: A/d:53
- Swapped tool_use_id routes results wrong: A/d:76-78
- Retrieval degrades past a few hundred skills, tag filters and hard constraints: V/d:89

## Defaults in the lesson code (defaults, 6)
- timeout_s 5.0: A/c:19
- version 1: V/c:19
- dedup True: V/c:29-39
- top_k 3: V/c:43
- tag_filter None: V/c:44, 48
- max_iterations 5: F/fc:322

## Numbers that matter (concepts, 6)
- BFCL V4 40/30/10/10/10: A/d:3, 37-41
- round trips 2 to 1: F/d:124
- 60-80% latency for 5-10 tool calls per query: F/d:124
- 10-20 calls per conversation: F/d:148
- Voyager 3.3x, 8.5x, 6.4x: V/d:37
- Toolformer keeps calls that reduce next-token loss: A/d:12, 27, 127

## Security rules (tips, 6)
- Never pass model-generated SQL to a database, parameterize: F/d:140
- Allowlist functions, expose only what the user needs: F/d:142
- Validate types, ranges, formats: F/d:144
- Sanitize results, API keys, PII, internal errors: F/d:146
- run_code uses ast.parse, blocks imports and dunder access: F/fc:105-118, F/d:315
- Untrusted code in a separate process or container: F/d:315

## Questions (qa, 5)
- Model never executes, your code does: F/d:57
- Structured outputs for extraction, function calling for external systems: F/d:134
- Models self-correct from structured errors, fail on empty or generic: F/d:164
- Skill is a named chunk of code plus description, retrievable by similarity: V/d:134
- Parent pinned to v1 does not pick up v3: V/d:88
