---
name: skill-function-calling-patterns
description: Decision framework for implementing function calling in production -- tool design, error handling, security, and provider patterns
version: 1.0.0
phase: 11
lesson: 09
tags: [function-calling, tool-use, agents, mcp, security, openai, anthropic]
---

# Function Calling Patterns

When building an LLM application that uses tools, apply this decision framework.

## When to use function calling

**Use function calling when:**
- The model needs real-time data (weather, stock prices, database queries)
- The task requires side effects (sending emails, creating records, deploying code)
- The model must choose between multiple actions based on user intent
- You are building an agent that interacts with external systems

**Use structured outputs instead when:**
- You need data extraction from text (no external calls needed)
- The output is the final product, not an intermediate step
- You have a single schema, not multiple tools to choose from

**Use both when:**
- The model calls a tool, then structures the tool result into a specific output format

## Tool design guidelines

1. **One tool, one action.** A tool named `manage_database` that handles queries, inserts, updates, and deletes is too broad. Split into `query_records`, `insert_record`, `update_record`. The model selects better with specific tools.

2. **Descriptions are prompts.** The model reads tool descriptions to decide selection. Write them like you would write instructions for a junior developer. Include what the tool returns, not just what it does.

3. **Constrain with enums.** If a parameter has 3-10 valid values, use an enum. The model will invent strings -- "celsius", "Celsius", "C", "metric" -- unless you constrain it.

4. **Fewer tools is better.** GPT-4o handles 5-10 tools well. At 20+ tools, selection accuracy drops. At 50+ tools, expect 10-15% wrong tool selection. Group related functionality or use a routing layer.

5. **Required means required.** Only mark a parameter as required if the tool literally cannot function without it. Optional parameters with good defaults reduce tool call failures.

## Provider-specific patterns

### OpenAI (GPT-4o, o3, GPT-4o-mini)

```python
tools=[{"type": "function", "function": {"name": ..., "parameters": ...}}]
tool_choice="auto"       # model decides
tool_choice="required"   # must call at least one tool
tool_choice={"type": "function", "function": {"name": "specific_tool"}}
```

- Supports parallel tool calls (multiple `tool_calls` in one response)
- Tool call IDs must be passed back with results
- `gpt-4o-mini` is 10x cheaper and handles simple tool routing well
- Structured outputs mode works with tool parameters for guaranteed schema compliance

### Anthropic (Claude 3.5 Sonnet, Claude 4 Opus)

```python
tools=[{"name": ..., "description": ..., "input_schema": ...}]
tool_choice={"type": "auto"}     # model decides
tool_choice={"type": "any"}      # must call at least one tool
tool_choice={"type": "tool", "name": "specific_tool"}
```

- Tool calls appear as content blocks with `type: "tool_use"`
- Results go in user messages with `type: "tool_result"`
- Field name is `input_schema`, not `parameters` (common migration bug)
- Supports multiple tool calls per response

### Google (Gemini 2.0 Flash, Gemini 2.0 Pro)

```python
function_declarations=[{"name": ..., "description": ..., "parameters": ...}]
function_calling_config={"mode": "AUTO"}   # or "ANY" or "NONE"
```

- Uses `function_declarations` at the top level
- Results returned via `function_response` parts
- Supports parallel function calling

### Open-source models (Llama 3, Hermes, Qwen)

- No standardized format -- varies by model and serving framework
- Hermes format (NousResearch) is the most common fine-tuned convention
- vLLM supports OpenAI-compatible tool calling for supported models
- Ollama supports basic tool calling with compatible models
- Test tool selection accuracy before production -- open models are 15-30% less accurate than GPT-4o on the Berkeley Function Calling Leaderboard

## Error handling patterns

### Return structured errors

```json
{"error": true, "message": "City 'Toky' not found. Did you mean 'Tokyo'?", "code": "NOT_FOUND", "suggestions": ["Tokyo"]}
```

Include actionable information. "Not found" is bad. "Not found, did you mean X?" is good. The model uses error messages to self-correct.

### Retry strategy

1. Tool call fails with a correctable error (typo, wrong enum value)
2. Send the error back to the model as a tool result
3. The model adjusts and retries
4. Maximum 3 retries per tool call
5. After 3 failures, return the error to the user

### Timeout handling

Set timeouts on all tool executions. 30 seconds is a reasonable default. If a tool times out, return a structured timeout error so the model can inform the user rather than hanging.

## Security checklist

| Check | Why | How |
|-------|-----|-----|
| Allowlist functions | Prevent arbitrary code execution | Only register tools the user needs |
| Validate argument types | Prevent type confusion attacks | Check types before execution |
| Sanitize string arguments | Prevent injection | Reject or escape special characters |
| Parameterize database queries | Prevent SQL injection | Never pass model-generated SQL directly |
| Filter tool results | Prevent data leakage | Remove API keys, PII, internal errors |
| Rate limit tool calls | Prevent runaway loops | Max 10-20 calls per conversation |
| Log all tool calls | Audit trail | Store tool name, arguments, result, timestamp |
| Block path traversal | Prevent file system access | Reject `..` and absolute paths in file tools |
| Sandbox code execution | Prevent system access | Use containers or restricted builtins |
| Validate return size | Prevent context stuffing | Truncate results over 10KB |

## Performance optimization

- **Parallel calls:** When the model requests multiple independent tools, execute them concurrently with `asyncio.gather()` or `concurrent.futures`
- **Caching:** Cache tool results for identical arguments within the same session (weather does not change in 60 seconds)
- **Streaming:** Stream the model's final response while tool results are being fetched
- **Tool pruning:** If context is tight, only include tool definitions relevant to the current query (use a classifier to filter)
- **Smaller models for routing:** Use `gpt-4o-mini` or `claude-3-5-haiku` for tool selection, then pass results to a stronger model for synthesis

## Common failure patterns

| Failure | Cause | Fix |
|---------|-------|-----|
| Wrong tool selected | Ambiguous descriptions | Rewrite descriptions with specific trigger words |
| Missing required args | Model forgot a parameter | Add clear examples in parameter descriptions |
| Infinite tool loop | Model keeps calling same tool | Set max iterations (5-10) and detect repeated calls |
| Hallucinated arguments | Model invents plausible but wrong values | Use enums, validate against known values |
| Tool result too large | API returned 100KB of data | Truncate or summarize before feeding back |
| Model ignores tool result | Result format confusing | Return clean JSON with clear field names |
