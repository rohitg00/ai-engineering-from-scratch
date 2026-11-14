# Deep Agents 0.7

> `create_deep_agent` is `create_agent` with file tools, a subagent tool, and more middleware, and on Qwen3 8B it added 2,075 to 2,251 prompt tokens to every model call.

You read that a deep agent plans with a todo list, and you build one with `deepagents` 0.7.38. The model never calls `write_todos`, because the tool is not there. You also see that a one-word question now costs eighty times the prompt tokens of the same question to a plain agent.

When you finish this section, you can say what `create_deep_agent` adds to `create_agent` at 0.7.38. You can also predict its token cost per call, and restore the todo list when you need it.

## What create_deep_agent builds

**Deep agent:** an agent built by `create_deep_agent` from the package `deepagents`. It is a `create_agent` graph with a fixed stack of middleware around your own.

`create_deep_agent` takes the same core arguments as `create_agent`: a model, tools, a system prompt, middleware, a checkpointer, and a store. It adds `subagents`, `skills`, `memory`, `permissions`, `backend`, and `interrupt_on` {{code libs/deepagents/deepagents/graph.py}}. It returns the compiled graph of `create_agent`.

The core group comes first, in this order: `FilesystemMiddleware`, `SubAgentMiddleware` with a general-purpose subagent, `_ParentNotifierMiddleware`, summarization, and `PatchToolCallsMiddleware`. Your own middleware comes right after that group.

Then comes a tail: the middleware of the model profile, skills, prompt caching, memory, and human review. `UnsupportedContentMiddleware` and `ModelRefusalMiddleware` come last {{code libs/deepagents/deepagents/graph.py:921-994}}. A middleware of yours with the name of a built-in one replaces it in place {{code libs/deepagents/deepagents/graph.py:223-262}}. Two of them add graph nodes. The kit run on the fake model shows them:

```listing
title: the nodes of a deep agent
source: capture/out/41-deep-agent.txt
lang: json
---
[
  "__start__",
  "model",
  "tools",
  "_ParentNotifierMiddleware.after_agent",
  "PatchToolCallsMiddleware.before_agent",
  "__end__"
]
```

The model and tools nodes are the loop of [section 1.2](#s-one-create-agent-run). The rest of the stack runs inside those two nodes, as hooks around the model call and the tool calls.

## The tools of a deep agent at 0.7.38

The kit called `create_deep_agent` with the fake model, the `add` tool, and the system prompt `You keep notes.`. The model got nine tools on each call of the main agent:

```listing
title: the tools bound on the first model call
source: capture/out/41-deep-agent.txt
lang: json
note: The first of five calls. The fourth call is the subagent, which has the same tools without task.
---
    "call": 1,
    "tools": [
      "ls",
      "read_file",
      "write_file",
      "edit_file",
      "delete",
      "glob",
      "grep",
      "task",
      "add"
    ],
    "first message": "system: You keep notes.",
    "message count": 2
```

[Figure](#fig-6-3b) shows where each tool and each piece of state comes from.

```figure
id: fig-6-3b
kind: structure
title: the tools and state that create_deep_agent adds
claim: At 0.7.38 a deep agent gets seven file tools and a task tool, a files channel in state, and two middleware nodes, with no todo list.
caption: Read from the call at the top down to the tools, the state, and the subagent. Green boxes are tools, the teal box is state, and the arrow is a task call. From capture/out/41-deep-agent.txt.
```

**Virtual filesystem:** the `files` channel in the state of a deep agent. With the default backend, the file tools read and write this channel and never touch the disk.

The run wrote `/notes.md` with `write_file`, listed it with `ls`, and asked the general-purpose subagent through `task`. The file ended in the state of the thread, with its content and two times:

```listing
title: files in the final state
source: capture/out/41-deep-agent.txt
lang: json
---
{
  "/notes.md": {
    "content": "2 + 3 = 5\n",
    "encoding": "utf-8",
    "created_at": "<time>",
    "modified_at": "<time>"
  }
}
```

A checkpointer saves this channel with the rest of the state, so the files of a thread survive a restart when the thread does. [Section 5.7](#s-subgraphs-and-multi-agent-patterns) follows the `task` call and the subagent.

Two sources disagree with this tool list.

The docstring of `create_deep_agent` names `execute` among the default tools and does not name `delete` {{code libs/deepagents/deepagents/graph.py}}. `execute` appears only with a backend that can run commands, and the default backend cannot. The register records this as conflict D8. The overview page of the docs says that Deep Agents adds planning {{docs oss/python/deepagents/overview}}, which is conflict D109. The code at the pin wins: no todo list, and a `delete` tool.

## What changed in 0.7

The changelog lists the changes of `deepagents` 0.7.0 {{docs oss/python/releases/changelog}}:

- **Todos are opt-in.** `create_deep_agent` no longer adds `TodoListMiddleware`. To get `write_todos`, the `todos` channel, and the planning prompt back, pass `middleware=[TodoListMiddleware()]`, imported from `langchain.agents.middleware`.
- **The base prompt is empty.** The authored base prompt is gone, and `BASE_AGENT_PROMPT` is deprecated until its removal in 0.9.0 {{code libs/deepagents/deepagents/graph.py}}. A harness profile for a known model can still add a short block.
- **The `delete` tool.** It removes a file or a directory. `write_file` now overwrites an existing file instead of failing.
- **New output text.** An empty `ls` or `glob` returns `No files found` instead of `[]`, and `read_file` has no line-number gutter. Code that parses tool output must change.
- **Backend factories removed.** Pass a backend instance, and give `StoreBackend` an explicit `namespace`.

`model=None` is still accepted and still means Claude Sonnet 4.6 through `langchain-anthropic`, but it is deprecated since 0.5.3 {{code libs/deepagents/deepagents/graph.py}}. Always pass a model.

A model without a harness profile, such as a model on Ollama, gets an empty base prompt. When you pass no system prompt, `deepagents` 0.7.38 still sends a `SystemMessage` with empty content. Our runs on Qwen3 8B show it as two messages and zero system characters on the first call:

```listing
title: the first call of a deep agent on Qwen3 8B
source: capture/lab/T09-tokens-mac/05-analysis.txt
lang: text
note: The summary line of the trivial task and its one call.
---
('trivial', 'deep_agent') n 3 ok 3 calls [1, 1, 1] in_total [2279] out_total [2] secs median 46.07
    call: in 2279 out 2 msgs 2 sys_chars 0 tools 8 schema_chars 10527 -> []
```

The empty message costs no tokens. On Qwen3, the request with it and the request without it both counted 17 prompt tokens.

## The token cost of the harness

**We measured** the prompt tokens of three harnesses on the Mac, Apple M1 Max, 10 cores, 64 GiB. The model was Qwen3 8B on Ollama at temperature 0 and seed 42. Each task ran three times per harness, 27 runs in all. The three harnesses were a plain loop on the `ollama` client, `create_agent`, and `create_deep_agent`. [Figure](#fig-6-3) shows each model call.

All three harnesses got the same user tools in the tools task. In the files task, the plain loop and `create_agent` got our `write_file` and `read_file`. The deep agent got no user tools there and used its own.

All 27 final answers passed a check on the answer text. That check did not look at files or tool calls, so we read them in the rows. Every run of the tools task called `add` and `multiply`. Every run of the files task called `write_file` and then `read_file`, and `/notes.txt` existed at the end.

```figure
id: fig-6-3
kind: chart
title: prompt tokens of each model call, three harnesses
claim: create_agent sent the same prompt tokens as a plain loop on every call, and Deep Agents added 2,075 to 2,251 tokens to each call.
caption: Each dot is one model call on the Mac with Qwen3 8B, and the three runs of each cell overlap. The number over a cell is the prompt total of one run. From capture/lab/summary/tokens-mac.json.
```

`create_agent` sent exactly the prompt tokens of the plain loop, on every call of every task. Deep Agents added 2,251 tokens to the one call of the trivial task and 2,169 to each call of the tools task. It added 2,075 to 2,086 to each call of the files task. The cost is the schemas of eight or ten tools, about 10,500 characters of JSON, sent with every call. Deep Agents made the same number of model calls as the other two harnesses, with no extra planning call.

| Task | Model calls | Plain loop | `create_agent` | `create_deep_agent` | Deep over plain |
|---|---|---|---|---|---|
| a one-word answer | 1 | 28 | 28 | 2,279 | 81.4 times |
| two arithmetic tool calls | 2 | 480 | 480 | 4,818 | 10.0 times |
| write a file, then read it | 3 | 773 | 773 | 7,013 | 9.1 times |

The ratio falls as the conversation grows, because the fixed cost stays the same while the messages add up. For a short question it dominates the bill. A provider with prompt caching charges less for the repeated part, and Deep Agents adds a caching middleware for providers that support it.

## The 0.6 to 0.7 prompt cut

The changelog says that the input tokens of a default agent turn drop 65%, from 5,395 to 1,895 {{docs oss/python/releases/changelog}}. It also says that the tool descriptions alone drop 43%, from 4,005 to 2,302. Neither number names the tokenizer.

**We measured** the first request of a default `create_deep_agent()` for the message `hi` on the Mac. It used the default Claude profile, at `deepagents` 0.6.12 and at 0.7.38. No model was called. We counted the request with two tiktoken tokenizers. We also sent it to Qwen3 8B on Ollama three times, to count it there. The Claude tokenizer is not available offline, so our counts cannot match the changelog exactly.

| Count | 0.6.12 | 0.7.38 | Drop |
|---|---|---|---|
| system prompt and tool schemas, `o200k_base` | 5,899 | 2,500 | 57.6% |
| system prompt and tool schemas, `cl100k_base` | 5,903 | 2,488 | 57.9% |
| the whole request, Qwen3 | 5,814 | 2,543 | 56.3% |
| tool descriptions only, `o200k_base` | 3,099 | 1,126 | 63.7% |
| tool and parameter descriptions, `o200k_base` | 3,417 | 1,711 | 49.9% |

The direction of the claim holds, and the size does not: we measured a drop of 56 to 58%, not 65%. The 43% for descriptions matches neither of our two description counts. Most of the cut comes from three places. The system prompt fell from 1,813 to 275 tokens. `write_todos` left the default set with its 824 tokens of description. The description of `task` fell from 1,448 to 280 tokens.

```takeaways
- Pass a model to create_deep_agent, because model=None means Claude and is deprecated.
- Add TodoListMiddleware yourself when your agent needs a todo list.
- Budget 2,075 to 2,251 extra prompt tokens per model call for a default deep agent.
- Use create_agent for short questions, where the fixed tool cost dominates.
- Update parsers of ls, glob, and read_file output when you move to 0.7.
```

Sources: capture/s_integrations.py, capture/out/41-deep-agent.txt; capture/lab/summary/tokens-mac.json, capture/lab/T09-tokens-mac/04-agent-runs.jsonl, capture/lab/T09-tokens-mac/04-agent-runs.log, capture/lab/T09-tokens-mac/05-analysis.txt, capture/lab/T09-tokens-mac/01-baseprompt-0.7.38.jsonl, capture/lab/T09-tokens-mac/02-baseprompt-0.6.12.jsonl, capture/lab/T09-tokens-mac/03-qwen3-token-counts.jsonl, capture/lab/T09-tokens-mac/00-venv-da06-freeze.txt; libs/deepagents/deepagents/graph.py and libs/deepagents/deepagents/middleware/filesystem.py at deepagents==0.7.38; docs.langchain.com at docs commit 04d4d4a (oss/python/releases/changelog, oss/python/deepagents/overview).
