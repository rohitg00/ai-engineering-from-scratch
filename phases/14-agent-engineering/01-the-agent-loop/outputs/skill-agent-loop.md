---
name: skill-agent-loop
description: Build AI agent loops with tool use from first principles
version: 1.0.0
phase: 14
lesson: 1
tags: [agents, tools, loops, engineering]
---

# The Agent Loop Pattern

Every AI agent follows this pattern:

```
while not done:
    response = llm.chat(messages, tools)
    if response.has_tool_calls:
        for call in response.tool_calls:
            result = execute_tool(call)
            messages.append(tool_result(result))
    else:
        done = True
        return response.text
```

## When to use this

- You need an LLM to take actions (read files, call APIs, run code)
- You need multi-step reasoning where each step depends on the previous result
- You want the LLM to decide what to do next, not follow a fixed script

## Implementation checklist

1. Define tools with name, description, parameters, and execute function
2. Start with the user message in the messages array
3. Loop: send messages to LLM, check for tool calls
4. If tool calls: execute them, append results, continue loop
5. If no tool calls: return the text response
6. Always set a max_turns limit to prevent infinite loops

## Common mistakes

- Not feeding tool results back to the LLM (it can't see what happened)
- Missing max_turns (infinite loops when the agent gets confused)
- Not handling tool errors (the agent should see errors so it can try alternatives)
- Making tools too broad (prefer many specific tools over few general ones)
