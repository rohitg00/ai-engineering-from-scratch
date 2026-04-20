# The Agent Loop

> An agent is just a while loop with an LLM inside. Everything else is details.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 (LLM Engineering)
**Time:** ~90 minutes

## Learning Objectives

- Build a complete agent loop from scratch: observe (read LLM output), decide (parse tool calls), act (execute tools), and feed results back
- Implement tool registration, argument parsing, and result formatting so the LLM can invoke external functions
- Add error handling, retry logic, and a maximum-iterations guard to prevent infinite loops
- Compare ReAct-style reasoning traces with direct tool calling and explain when each pattern applies

## The Problem

You can prompt an LLM. You can call its API. But it can only respond — it can't act. It can't read files, run code, search the web, or fix its own mistakes.

An agent can. The difference is one pattern: a loop.

## The Concept

Every AI agent — Claude Code, Cursor, Devin, OpenHands — follows the same core pattern:

```
┌──────────────────────────────────────────┐
│                                          │
│   ┌─────────┐    ┌──────────┐            │
│   │  User    │───▸│  Agent   │            │
│   │  Input   │    │  Loop    │            │
│   └─────────┘    └────┬─────┘            │
│                       │                   │
│                  ┌────▼─────┐            │
│                  │  LLM     │            │
│                  │  Think   │            │
│                  └────┬─────┘            │
│                       │                   │
│               ┌───────▼────────┐         │
│               │ Tool call?     │         │
│               └───┬────────┬───┘         │
│              Yes  │        │  No         │
│            ┌──────▼──┐  ┌──▼──────┐      │
│            │ Execute  │  │ Return  │      │
│            │ Tool     │  │ Answer  │      │
│            └──────┬───┘  └─────────┘     │
│                   │                       │
│              ┌────▼──────┐               │
│              │ Feed      │               │
│              │ result    │               │
│              │ back to   │               │
│              │ LLM       │──────────┐    │
│              └───────────┘          │    │
│                                     │    │
│                       ┌─────────────┘    │
│                       │  (loop)          │
│                       ▼                  │
│                  ┌──────────┐            │
│                  │  LLM     │            │
│                  │  Think   │            │
│                  └──────────┘            │
│                                          │
└──────────────────────────────────────────┘
```

That's it. The LLM thinks, decides to use a tool (or not), the tool runs, the result goes back to the LLM, and the loop continues until the LLM decides it's done.

## Build It

### Step 1: The simplest agent (Python)

```python
import json

def agent_loop(llm, tools, user_message, max_turns=10):
    messages = [{"role": "user", "content": user_message}]

    for turn in range(max_turns):
        response = llm.chat(messages, tools=tools)

        if response.tool_calls:
            messages.append(response.to_message())
            for call in response.tool_calls:
                result = tools[call.name].execute(**call.arguments)
                messages.append({
                    "role": "tool",
                    "tool_use_id": call.id,
                    "content": str(result)
                })
        else:
            return response.content

    return "Max turns reached"
```

15 lines. That's the entire pattern. Everything else — planning, memory, context management, subagents — builds on top of this.

### Step 2: Add real tools (Python)

```python
import os
import subprocess

TOOLS = {
    "read_file": {
        "description": "Read the contents of a file",
        "parameters": {
            "path": {"type": "string", "description": "File path to read"}
        },
        "execute": lambda path: open(path).read() if os.path.exists(path) else f"File not found: {path}"
    },
    "write_file": {
        "description": "Write content to a file",
        "parameters": {
            "path": {"type": "string", "description": "File path to write"},
            "content": {"type": "string", "description": "Content to write"}
        },
        "execute": lambda path, content: (open(path, 'w').write(content), f"Wrote {len(content)} chars to {path}")[1]
    },
    "run_command": {
        "description": "Run a shell command and return output",
        "parameters": {
            "command": {"type": "string", "description": "Shell command to run"}
        },
        "execute": lambda command: subprocess.run(
            command.split(), capture_output=True, text=True, timeout=30
        ).stdout or "No output"
    },
    "list_files": {
        "description": "List files in a directory",
        "parameters": {
            "path": {"type": "string", "description": "Directory path"}
        },
        "execute": lambda path: "\n".join(os.listdir(path)) if os.path.isdir(path) else f"Not a directory: {path}"
    }
}
```

### Step 3: TypeScript version

```typescript
type Tool = {
  description: string;
  parameters: Record<string, { type: string; description: string }>;
  execute: (...args: any[]) => Promise<string>;
};

type Message = {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_use_id?: string;
};

type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

async function agentLoop(
  llm: LLM,
  tools: Record<string, Tool>,
  userMessage: string,
  maxTurns = 10
): Promise<string> {
  const messages: Message[] = [{ role: "user", content: userMessage }];

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await llm.chat(messages, tools);

    if (response.toolCalls?.length) {
      messages.push(response.toMessage());

      for (const call of response.toolCalls) {
        const tool = tools[call.name];
        const result = await tool.execute(
          ...Object.values(call.arguments)
        );
        messages.push({
          role: "tool",
          tool_use_id: call.id,
          content: String(result),
        });
      }
    } else {
      return response.content;
    }
  }

  return "Max turns reached";
}
```

### Step 4: Make it real with the Anthropic API

```python
import anthropic

client = anthropic.Anthropic()

def chat_with_tools(messages, tools):
    tool_definitions = [
        {
            "name": name,
            "description": tool["description"],
            "input_schema": {
                "type": "object",
                "properties": tool["parameters"],
                "required": list(tool["parameters"].keys())
            }
        }
        for name, tool in tools.items()
    ]

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=messages,
        tools=tool_definitions
    )
    return response


def run_agent(user_message, max_turns=10):
    messages = [{"role": "user", "content": user_message}]

    for turn in range(max_turns):
        print(f"\n--- Turn {turn + 1} ---")
        response = chat_with_tools(messages, TOOLS)

        assistant_content = response.content
        messages.append({"role": "assistant", "content": assistant_content})

        tool_uses = [block for block in assistant_content if block.type == "tool_use"]

        if not tool_uses:
            text_blocks = [block.text for block in assistant_content if block.type == "text"]
            return "\n".join(text_blocks)

        tool_results = []
        for tool_use in tool_uses:
            print(f"  Tool: {tool_use.name}({tool_use.input})")
            result = TOOLS[tool_use.name]["execute"](**tool_use.input)
            print(f"  Result: {result[:200]}")
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_use.id,
                "content": str(result)
            })

        messages.append({"role": "user", "content": tool_results})

    return "Max turns reached"


if __name__ == "__main__":
    answer = run_agent("List the files in the current directory and tell me what you see.")
    print(f"\nFinal answer: {answer}")
```

## Use It

That's it. You just built an AI agent. It can read files, write files, run commands, and reason about the results. Every agent you've ever used — Claude Code, GitHub Copilot, Cursor — is this pattern with more tools and better engineering.

The next 14 lessons in this phase add:
- Planning (how to break big tasks into steps)
- Memory (how to remember across sessions)
- Context management (how to stay within the token limit)
- Subagents (how to delegate to specialized agents)
- Safety (how to prevent the agent from doing dangerous things)

But they all build on this loop.

## Ship It

This lesson produces:
- `outputs/skill-agent-loop.md` — a skill that teaches AI agents how to build agent loops
- `outputs/prompt-agent-debugger.md` — a prompt for debugging agent behavior

## Exercises

1. Add a `search_web` tool using a free API and have the agent answer questions about current events
2. Add a turn counter that the agent can see, so it knows how many turns it has left
3. Make the agent explain its reasoning before each tool call (hint: add a system prompt that says "think step by step before using tools")

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Agent | "An autonomous AI that thinks for itself" | A loop: LLM thinks → tool runs → result feeds back → repeat |
| Tool use | "Function calling" | The LLM outputs structured JSON instead of text, which triggers code execution |
| Agentic | "AI that can do things" | Any system where the LLM controls the flow — deciding what to do next based on results |
| ReAct | "Reasoning and Acting" | The academic name for think → act → observe → repeat |
