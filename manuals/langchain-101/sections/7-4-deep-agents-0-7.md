# Deep Agents: when the harness helps

> A deep agent matched the plain loop on Claude at 1.16 to 1.24 times the dollars, and lost on small local models, mostly to its in-state default filesystem.

You read that a deep agent plans, keeps files, and starts subagents, and you build one with `deepagents` 0.7.38. On Claude it passes every task your plain loop passes. On Qwen3 4B it fails 18 of 20 file tasks, and in some of them it tells you that it changed the file. The file on disk never changed.

When you finish this section, you can say what `create_deep_agent` adds to `create_agent` at 0.7.38, and when that helps. You can also choose a backend for its file tools, and budget its tokens with and without a prompt cache.

## The position

- **Use Deep Agents with a frontier model and a prompt cache.** On Claude it passed 99 of 99 and 30 of 30 tasks, the same as a plain loop, for 1.16 and 1.24 times the dollars.
- **Keep the default deep agent away from small local models.** Qwen3 4B passed 55 of 99 as a deep agent and 70 of 99 with a plain loop. Qwen3 8B passed 58 and 74.
- **Pass a `FilesystemBackend` when the work is on real files.** The default backend keeps files in the agent state. With a `FilesystemBackend` on the task folder, Qwen3 4B went from 2 to 16 of 20 file tasks.
- **Hiding the built-in file tools helps a small model on files and loses it elsewhere.** A profile took Qwen3 4B from 2 to 14 of 20 file tasks, and its total stayed at 55 of 99.
- **Test the eval tool before you rely on it.** Claude Haiku 5.5 passed 39 of 39 with it and never called it until the prompt asked, and three local models never called it.
- **Budget 3.6 to 4.3 times the prompt tokens.** On a cached provider that costs little. On a local model it costs time: 22.6 s per task against 9.1 s on Qwen3 4B.

## What create_deep_agent builds

**Deep agent:** an agent built by `create_deep_agent` from the package `deepagents`. It is a `create_agent` graph with a fixed stack of middleware around your own.

`create_deep_agent` takes the same core arguments as `create_agent`: a model, tools, a system prompt, middleware, a checkpointer, and a store. It adds `subagents`, `skills`, `memory`, `permissions`, `backend`, and `interrupt_on` {{code libs/deepagents/deepagents/graph.py}}. It returns the compiled graph of `create_agent`.

The core group comes first, in this order: `FilesystemMiddleware`, `SubAgentMiddleware` with a general-purpose subagent, `_ParentNotifierMiddleware`, summarization, and `PatchToolCallsMiddleware`. Your own middleware comes right after that group.

Then comes a tail: the middleware of the model profile, skills, prompt caching, memory, and human review. `UnsupportedContentMiddleware` and `ModelRefusalMiddleware` come last {{code libs/deepagents/deepagents/graph.py:921-994}}. The prompt caching middleware for Anthropic is added in every case, and does nothing for other providers {{code libs/deepagents/deepagents/graph.py:968}}. A middleware of yours with the name of a built-in one replaces it in place {{code libs/deepagents/deepagents/graph.py:223-262}}. Two of them add graph nodes, as the kit run on Qwen3 4B shows:

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

The model and tools nodes are the loop of [section 1.3](#s-one-create-agent-run). The rest of the stack runs inside those two nodes, as hooks around the model call and the tool calls.

[Figure](#fig-7-4e) draws the compiled graph from its Mermaid text. `model` also has a conditional edge back to itself. `create_agent` adds that edge when any middleware has a `wrap_model_call` hook, and the deep agent stack has several {{code libs/langchain_v1/langchain/agents/factory.py:1772-1776}}. `get_graph(xray=True)` gives the same six nodes, because the subagent runs inside the `task` tool and is not a node of this graph.

```figure
id: fig-7-4e
kind: structure
title: the graph of a deep agent
claim: A deep agent adds two hook nodes around the usual loop, and its tools node lists add, execute, and eight built-in tools.
caption: Read from __start__ at the top. Blue boxes are hook nodes. The small loop on model is its conditional edge back to itself. From capture/out/53-draw-deep-agent.txt.
```

## The tools of a deep agent at 0.7.38

The kit called `create_deep_agent` with Qwen3 4B on Ollama, the `add` tool, and the system prompt `You keep notes.`. The model got nine tools on each call of the main agent:

```listing
title: the tools bound on the first model call
source: capture/out/41-deep-agent.txt
lang: json
note: The first of six calls. The fifth call is the subagent, which has the same tools without task.
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

[Figure](#fig-7-4b) shows where each tool and each piece of state comes from.

```figure
id: fig-7-4b
kind: structure
title: the tools and state that create_deep_agent adds
claim: At 0.7.38 a deep agent gets seven file tools and a task tool, a files channel in state, and two middleware nodes, with no todo list.
caption: Read from the call at the top down to the tools, the state, and the subagent. Green boxes are tools, the teal box is state, and the arrow is a task call. From capture/out/41-deep-agent.txt.
```

**Virtual filesystem:** the `files` channel in the state of a deep agent. With the default backend, `StateBackend`, the file tools read and write this channel and never touch the disk {{code libs/deepagents/deepagents/graph.py:684}}.

The model called `add`, wrote `/notes.md` with `write_file`, listed it with `ls`, and asked the general-purpose subagent through `task`. It wrote only the sum, `5`, into the file. The file ended in the state of the thread, with its content and two times:

```listing
title: files in the final state
source: capture/out/41-deep-agent.txt
lang: json
---
{
  "/notes.md": {
    "content": "5",
    "encoding": "utf-8",
    "created_at": "<time>",
    "modified_at": "<time>"
  }
}
```

A checkpointer saves this channel with the rest of the state, so the files of a thread survive a restart when the thread does. [Section 6.7](#s-subgraphs-and-multi-agent-patterns) follows the `task` call and the subagent.

Two sources disagree with this tool list. The docstring of `create_deep_agent` names `execute` among the default tools and does not name `delete` {{code libs/deepagents/deepagents/graph.py}}. `execute` appears only with a backend that can run commands, and the default backend cannot. The register records this as conflict D8. The overview page of the docs says that Deep Agents adds planning {{docs oss/python/deepagents/overview}}, which is conflict D109. The code at the pin wins: no todo list, and a `delete` tool.

## Small model, frontier model

**We measured** the deep agent against a plain loop on the 99-task suite of [section 1.2](#s-do-you-need-langchain), on the Mac. Qwen3 4B and Qwen3 8B ran on Ollama at temperature 0, and the Claude models ran through the API. The deep agent got the tools of each task, our system prompt, and the default backend. [Figure](#fig-1-2) shows every task.

| Model | Tasks | Plain loop | Deep agent | Same outcome |
|---|---|---|---|---|
| Claude Haiku 5.5 | 99 | 99 | 99 | 99 |
| Claude Sonnet 5.5 | 30 | 30 | 30 | 30 |
| gpt-oss 20B | 30 | 28 | 24 | 26 |
| Qwen3 14B | 30 | 26 | 24 | 24 |
| Qwen3 8B | 99 | 74 | 58 | 73 |
| Qwen3 4B | 99 | 70 | 55 | 42 |

On Claude the harness changed nothing that this suite can see. Both harnesses pass every task, so a small effect would not show. On the local models the deep agent lost 2 to 16 tasks.

The loss sits in two families. In the file tasks the default backend is the cause, as the next part shows.

In the retrieval tasks, the deep agent on Qwen3 4B answered 6 of 20 questions with no tool call. It said that it had no access to the data. On the other 59 tasks the deep agent passed more often than the plain loop. It passed 46 against 39 on Qwen3 4B, and 47 against 44 on Qwen3 8B. The harness does not make a small model worse at everything.

## The default backend keeps files in state

A file task gives the agent five tools that act on a task folder, and the checker reads that folder. A deep agent also has its own seven file tools. With the default backend, those seven work on the `files` channel, which starts empty. So a model that picks `ls` sees no files:

```listing
title: a deep agent that looked in its own empty filesystem
source: capture/lab/bench/runs/main.jsonl
lang: json
note: One row of Qwen3 4B, cut to the tool calls, the reply, and the folder after the run. The task asks it to change the port in config.ini.
---
{"run_id": "cd6b9ad2", "tag": "main", "ts": "2026-11-14T19:31:56", "task_id": "files03", "family": "files", "harness": "deep_agent", "model": "qwen3:4b-instruct-2507-q4_K_M", …"tool_seq": ["glob", "ls"], "final_text": "I see that there are no files in the current directory at all. This means there is no config.ini file to modify. …"final_state": {"config.ini": "[server]\nhost=0.0.0.0\nport=8080\nworkers=4\n"}}
```

A model that writes with the built-in tools changes the state and reports success. Qwen3 14B removed a line with `edit_file` and `write_file`, said so, and left the file on disk as it was:

```listing
title: a deep agent that edited the state and not the disk
source: capture/lab/bench/runs/main.jsonl
lang: json
note: One row of Qwen3 14B, cut to the tool calls, the reply, and the folder after the run.
---
{"run_id": "3fc1e4ca", "tag": "main", "ts": "2026-11-15T02:13:58", "task_id": "files16", …"tool_seq": ["edit_file", "ls", "write_file"], "final_text": "The line `DEBUG=true` has been removed from `settings.env`, and the file has been updated.", …"final_state": {"settings.env": "HOST=localhost\nDEBUG=true\nPORT=5000\n"}}
```

**FilesystemBackend:** a backend that maps the file tools of a deep agent to a folder on disk. With `virtual_mode=True`, the default, paths are read under `root_dir`, and a path that leaves it is refused {{code libs/deepagents/deepagents/backends/filesystem.py:130-168}}. It limits paths and does not isolate processes.

**We measured** the 20 file tasks a second time with `FilesystemBackend(root_dir=<task folder>, virtual_mode=True)`, on the Mac, for the same three models. [Figure](#fig-7-4c) shows each run and which file tools it used.

```figure
id: fig-7-4c
kind: chart
title: the 20 file tasks, plain loop, deep agent, and deep agent on the disk
claim: On Qwen3 4B the default deep agent used its own file tools in 18 of 20 runs and failed 17, and FilesystemBackend restored the plain score.
caption: Each square is one task, blue or violet for a pass and rose for a fail. A green dot marks a run that wrote with a Deep Agents file tool, and a grey dot a run that only read with one. The column on the right counts the runs that used one. From capture/lab/bench/summary-mac.json.
```

| Model | Plain loop | Deep agent, default | Deep agent, `FilesystemBackend` |
|---|---|---|---|
| Claude Haiku 5.5 | 20 of 20 | 20 of 20 | 19 of 20 |
| Qwen3 8B | 17 of 20 | 5 of 20 | 9 of 20 |
| Qwen3 4B | 16 of 20 | 2 of 20 | 16 of 20 |

Claude Haiku 5.5 used a built-in file tool in 6 of 20 default runs, only `glob`, and then used the task tools. Qwen3 4B used one in 18 of 20 and failed 17 of those. With the backend on disk it used one in 18 again, and 15 of those wrote a file with it. Twelve of those 15 passed. Qwen3 8B gained less, from 5 to 9, and its other 11 runs left a wrong folder.

So the default backend hurts a model that prefers the built-in tools. Give a deep agent file tools that all act on the real folder, and pass `FilesystemBackend` on that folder. We did not test a deep agent with only the built-in tools on that backend.

## A harness profile that hides the file tools

**Harness profile:** a setting of `deepagents` that changes how `create_deep_agent` treats one provider. A profile can list `excluded_tools` and add text to the system prompt with `system_prompt_suffix`. You register it with `register_harness_profile`.

The kit ran two profiles for the provider `ollama`. Profile A excluded the eight file tools of the earlier listing: `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `delete`, and `execute`. Profile B did the same and added one sentence to the prompt. 

The sentence says three things. The task tools are the only way to reach the data. The built-in workspace is empty. The agent must not delegate. 

Both profiles left `task` in place. On a chain task, the first model call listed 7 tools: `task`, the five task tools, and `submit_answer`.

**We measured** profile B on the 99 tasks, and profile A on the 30-task subset, for Qwen3 4B and Qwen3 8B. The Mac was an Apple M1 Max with 64 GiB. Ollama 0.31.1 ran at temperature 0 and seed 42, with one run per task. Before the runs, three tasks gave the same tool calls and prompt tokens as the first bench on the same server.

| Tasks passed | 4B plain | 4B deep | 4B deep, B | 8B plain | 8B deep | 8B deep, B |
|---|---|---|---|---|---|---|
| chain, 20 | 9 | 17 | 6 | 15 | 17 | 12 |
| sql, 19 | 15 | 11 | 10 | 10 | 11 | 8 |
| retrieval, 20 | 15 | 7 | 11 | 13 | 6 | 10 |
| files, 20 | 16 | 2 | 14 | 17 | 5 | 15 |
| multiturn, 20 | 15 | 18 | 14 | 19 | 19 | 18 |
| all, 99 | 70 | 55 | 55 | 74 | 58 | 63 |

Profile B did what it was made for. Files rose from 2 to 14 of 20 on Qwen3 4B and from 5 to 15 on Qwen3 8B. The total did not follow on 4B. Chain tasks fell from 17 to 6, and 30 runs wrote a tool call as text, against 12 for the default deep agent. On Qwen3 8B the total rose from 58 to 63, which is still 11 below the plain loop.

The prompt shrank too. Qwen3 4B read 608,010 prompt tokens in all, against 1,591,270 for the default deep agent and 365,915 for the plain loop. Qwen3 8B read 467,536, 1,311,726, and 353,608.

On the 30-task subset, profile A passed 19 of 30 on Qwen3 4B and 16 on Qwen3 8B, and profile B passed 18 and 17. The plain loop passed 23 and 18 on the same tasks. A cell of 30 tasks is wide, so treat a gap of 1 or 2 tasks as noise. The profile runs shared the Mac with other jobs, so we give no times for them.

## The eval tool and programmatic tool calling

**Programmatic tool calling:** the model writes one small program that calls several tools, in place of one tool call for each step. In `langchain-quickjs` 0.3.12, `CodeInterpreterMiddleware(ptc=tools)` adds an `eval` tool. The tool runs JavaScript in a QuickJS sandbox and puts the listed tools in a `tools` object.

**We measured** four arms on the 39 chain and sql tasks, where one task needs several lookups and some arithmetic. The arms were a plain loop, the default deep agent, the deep agent with `CodeInterpreterMiddleware(ptc=<the task tools>)`, and the same with one more sentence in the prompt. That sentence asks the model to write one `eval` program for any task with more than one lookup or with arithmetic. Claude Haiku 5.5 ran all four arms through the API from the Mac.

Qwen3 8B, Qwen3 14B, and gpt-oss 20B ran the first three on Ollama, one run per task. The plain rows of Qwen3 14B and gpt-oss 20B cover only the 12 chain and sql tasks of the 30-task subset. The nudged run of Qwen3 8B failed at its start, because the server answered 404 for the model, so it has no rows. [Figure](#fig-7-4f) shows every arm.

```figure
id: fig-7-4f
kind: chart
title: pass counts with and without the eval tool, four models on 39 tasks
claim: The eval tool did not raise the pass count on any of four models, and it raised the prompt tokens by a factor of 1.8 to 2.6.
caption: Each bar is the share of tasks passed, and the text gives the count. Calls and prompt tokens are totals over the cell, and seconds are the median task on a Mac that ran other work. From capture/lab/bench2/summary-bench2.json.
```

Claude Haiku 5.5 passed 39 of 39 in all four arms. With the plain prompt it called `eval` in 0 of 39 runs. The extra tool only added schema tokens: 1.71 million prompt tokens against 0.93 million for the default deep agent. 

With the sentence in the prompt it called `eval` in 12 of 39 runs, 42 times in all. Those 12 runs were chain tasks, and all 12 passed. Three `eval` calls failed with a `SyntaxError`. [Figure](#fig-7-4g) compares the two arms.

```figure
id: fig-7-4g
kind: chart
title: Claude Haiku 5.5 with the eval tool, with and without a prompt that asks for it
claim: With a prompt that asks for eval, Haiku used it in 12 of 39 runs, and the cell cost $0.038 against $0.028 for the same pass count.
caption: Each square is one task. A dark square is a run that called eval. The paired bars give the totals of the two arms, scaled to the larger one. From capture/lab/bench2/summary-bench2.json.
```

The program did not save calls. On those 12 chain tasks the nudged runs made 67 model calls, and the runs with the plain prompt made 53. Over all 39 tasks the totals were 187 and 173 calls. The plain loop cost $0.021 and the default deep agent $0.022 on the same 39 tasks.

No local model called `eval` in any of its 117 runs. Qwen3 8B and gpt-oss 20B used the built-in `glob`, `ls`, or `grep` in some runs instead. Passes were 23 of 39 on Qwen3 8B, 29 on Qwen3 14B, and 35 on gpt-oss 20B. That is 5, 2, and 2 fewer than the default deep agent. The cells hold 39 tasks, so those gaps are within the noise.

The prompt tokens were 2.6, 2.2, and 2.3 times those of the default deep agent. The median task took 142.5 s on Qwen3 8B, against 14.5 s for the default deep agent. That time comes from a shared Mac with a high load, so treat it as an upper bound.

## Tokens, and what a cache does to them

A deep agent sends the schemas of its own tools on every model call. Our earlier run measured that cost on single calls.

**We measured** the prompt tokens of three harnesses on the Mac, Apple M1 Max, 10 cores, 64 GiB. The model was Qwen3 8B on Ollama at temperature 0 and seed 42. Each task ran three times per harness, 27 runs in all. The three harnesses were a plain loop on the `ollama` client, `create_agent`, and `create_deep_agent`. [Figure](#fig-7-4) shows each model call.

```figure
id: fig-7-4
kind: chart
title: prompt tokens of each model call, three harnesses
claim: create_agent sent the same prompt tokens as a plain loop on every call, and Deep Agents added 2,075 to 2,251 tokens to each call.
caption: Each dot is one model call on the Mac with Qwen3 8B, and the three runs of each cell overlap. The number over a cell is the prompt total of one run. From capture/lab/summary/tokens-mac.json.
```

| Task | Model calls | Plain loop | `create_agent` | `create_deep_agent` | Deep over plain |
|---|---|---|---|---|---|
| a one-word answer | 1 | 28 | 28 | 2,279 | 81.4 times |
| two arithmetic tool calls | 2 | 480 | 480 | 4,818 | 10.0 times |
| write a file, then read it | 3 | 773 | 773 | 7,013 | 9.1 times |

On the task suite, the ratio over all tasks was 3.6 to 4.3 times on seven models, as [figure](#fig-1-2b) shows. The deep agent made the same median number of model calls. On Claude Haiku 5.5 it sent about 3,570 more prompt tokens per call, and on Qwen3 8B about 2,160.

On a local model, every one of those tokens is read again on every call. The median task of Qwen3 4B took 22.6 s as a deep agent and 9.1 s with the plain loop. On Qwen3 8B it took 11.6 s and 10.1 s.

On Claude, the cache reads them at a tenth of the price. **We measured** the cache reads that the API reported for every call. Over all calls of each cell, 96% of the prompt tokens of the deep agent came from the cache on Haiku, and 94% on Sonnet. For the plain loop, which marks only its system prompt, it was 67% on both. [Figure](#fig-7-4d) shows the dollars of each task.

```figure
id: fig-7-4d
kind: chart
title: dollars per task, plain loop and deep agent, with and without the cache
claim: At list price a deep agent cost three times the plain loop on Claude, and with prompt caching 1.16 times on Haiku and 1.24 on Sonnet.
caption: Each dot is one task on a log scale, and the black tick is the median. List price is the tokens at the base price, and billed uses the cache reads that the API reported. The totals are on the right. From capture/lab/bench/summary-mac.json.
```

The deep agent on Claude Haiku 5.5 cost $0.052 for 99 tasks, against $0.045 for the plain loop. On Claude Sonnet 5.5 it cost $0.327 for 30 tasks, against $0.263. At list price with no cache, the same tasks would cost 3.10 and 3.14 times the plain loop.

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

## When the harness helps

| Your situation | Deep Agents? | The number behind it |
|---|---|---|
| Claude with prompt caching, tasks that use files, subagents, or a todo list | yes | the same outcome on 129 of 129 tasks, 1.16 to 1.24 times the dollars |
| Claude, short questions with your own tools | no gain, small cost | the same outcome, about 3,570 more prompt tokens per call |
| A local model of 8B or less | no | 55 and 58 of 99 against 70 and 74, and 2.5 times the time on Qwen3 4B |
| A local model of 14B to 20B | only after a test on your tasks | 2 and 4 fewer of 30 than the plain loop |
| Work on real files | yes, with `FilesystemBackend` on the folder | 2 to 16 of 20 on Qwen3 4B |
| A local model of 8B or less, and you want a deep agent anyway | hide the file tools with a profile, and test | 14 of 20 file tasks on Qwen3 4B, 63 of 99 on Qwen3 8B against 74 for the plain loop |
| You want the model to call tools from code | test it on your tasks first | 39 of 39 on Haiku with and without eval, and no eval call from three local models |
| A provider with no prompt cache | budget the tokens | 3.10 to 3.14 times the dollars at list price |

```takeaways
- Pass a model to create_deep_agent, because model=None means Claude and is deprecated.
- Use a deep agent on a frontier model with prompt caching, where it matched the plain loop.
- Use a plain loop or create_agent on local models of 8B or less.
- Pass FilesystemBackend with root_dir set to the folder whenever the work is on real files.
- Add TodoListMiddleware yourself when your agent needs a todo list.
- Pass a profile that excludes the file tools only after you test your own task mix.
- Add CodeInterpreterMiddleware only when a test shows that your model calls eval and passes more.
- Budget 3.6 to 4.3 times the prompt tokens, and time per task on a local model.
- Update parsers of ls, glob, and read_file output when you move to 0.7.
```

Sources: capture/s_integrations.py, capture/out/41-deep-agent.txt, capture/out/53-draw-deep-agent.txt, capture/s_draw.py; libs/langchain_v1/langchain/agents/factory.py at langchain==1.5.0; capture/lab/bench/summary-mac.json, capture/lab/bench/summarize.py, capture/lab/bench/runs/main.jsonl, capture/lab/bench/runs/cost-ledger.jsonl, capture/lab/bench2/summary-bench2.json, capture/lab/bench2/kit2/run2.py, capture/lab/bench2/kit2/summarize2.py, capture/lab/bench2/runs/profiles.jsonl, capture/lab/bench2/runs/ptc.jsonl, capture/lab/bench2/runs/verify.jsonl, capture/lab/bench2/runs/cost-ledger.jsonl, capture/lab/bench2/logs/q-ptc.log, capture/lab/bench/kit/harnesses.py, capture/lab/bench/kit/env.py, capture/lab/bench/kit/checks.py, capture/lab/bench/data/tasks.jsonl, capture/lab/bench/data/anthropic-prices.json; capture/lab/summary/tokens-mac.json, capture/lab/T09-tokens-mac/04-agent-runs.jsonl, capture/lab/T09-tokens-mac/04-agent-runs.log, capture/lab/T09-tokens-mac/05-analysis.txt, capture/lab/T09-tokens-mac/01-baseprompt-0.7.38.jsonl, capture/lab/T09-tokens-mac/02-baseprompt-0.6.12.jsonl, capture/lab/T09-tokens-mac/03-qwen3-token-counts.jsonl, capture/lab/T09-tokens-mac/00-venv-da06-freeze.txt; libs/deepagents/deepagents/graph.py, libs/deepagents/deepagents/backends/filesystem.py, libs/deepagents/deepagents/middleware/_prompt_caching.py, and libs/deepagents/deepagents/middleware/filesystem.py at deepagents==0.7.38; docs.langchain.com at docs commit 04d4d4a (oss/python/releases/changelog, oss/python/deepagents/overview).
