# The built-in middleware

> `langchain` 1.5.0 has 19 middleware classes, each built on one or two of the six hooks, and the documentation lists three more that come from Deep Agents.

You need a limit on model calls, a retry for a flaky tool, and a review step before an email goes out. Each of these is a class in `langchain.agents.middleware`, and the defaults of some of them do less than their names say.

When you finish this section, you can pick the built-in middleware for a need, say which hook it uses, and name the default that matters. You can also find the section of this manual that tests it.

## The 19 classes at the pin

**Built-in middleware:** a middleware class that the `langchain` package exports from `langchain.agents.middleware`.

The package exports 50 names from that module. Nineteen of them are middleware classes {{code libs/langchain_v1/langchain/agents/middleware/__init__.py}}. This table lists each one with its hooks and the default you must know:

| Class | Hooks | What it does, and the default that matters | Section |
|---|---|---|---|
| `SummarizationMiddleware` | `before_model` | Replaces old messages with a summary from a second model. With the default `trigger=None` it never runs. | [5.5](#s-context-engineering-and-summarization) |
| `ContextEditingMiddleware` | `wrap_model_call` | Clears old tool results from the request with `ClearToolUsesEdit`. The state keeps them. | this section |
| `HumanInTheLoopMiddleware` | `after_model`, `wrap_tool_call` | Pauses for a human decision on named tools. The default mode is `batched`. | [6.5](#s-human-in-the-loop-batched-and-per-call) |
| `ModelCallLimitMiddleware` | `before_model`, `after_model` | Stops after a number of model calls per run or per thread. The default `exit_behavior` is `end`. | this section |
| `ToolCallLimitMiddleware` | `after_model` | Limits tool calls, for one tool or all. The default `exit_behavior` is `continue`. | this section |
| `ToolRetryMiddleware` | `wrap_tool_call` | Runs a failed tool again, 3 attempts in all by default, on any exception. | [4.7](#s-retries-backup-models-rate-limits-and-caching) |
| `ModelRetryMiddleware` | `wrap_model_call` | Calls the model again after an error, 3 attempts in all by default. | [4.7](#s-retries-backup-models-rate-limits-and-caching) |
| `ModelFallbackMiddleware` | `wrap_model_call` | Calls the next model in a list when a model raises. | [4.7](#s-retries-backup-models-rate-limits-and-caching) |
| `ModelRefusalMiddleware` | `wrap_model_call` | Raises `ModelRefusalError` when the reply is a refusal block. | [4.7](#s-retries-backup-models-rate-limits-and-caching) |
| `ToolErrorMiddleware` | `wrap_tool_call` | Turns an exception inside a tool into an error `ToolMessage`. It needs `on_error`. | [3.4](#s-tools-toolruntime-and-tool-errors) |
| `PIIMiddleware` | `before_model`, `after_model` | Finds one kind of personal data and redacts, masks, hashes, or blocks it. Input only by default. | [4.8](#s-guardrails-pii-and-the-decision-middleware-beta) |
| `ModelRouterMiddleware` | `before_agent`, `wrap_model_call` | Asks a decision model which model to use for the run. Beta, new in 1.5.0 by the release notes. | [4.8](#s-guardrails-pii-and-the-decision-middleware-beta) |
| `AutoModeMiddleware` | `wrap_tool_call` | Asks a decision model if a tool call is risky, and blocks it. Beta, new in 1.5.0 by the release notes. | [4.8](#s-guardrails-pii-and-the-decision-middleware-beta) |
| `TodoListMiddleware` | `wrap_model_call`, `after_model` | Adds a `write_todos` tool and a prompt, and keeps the list in `state["todos"]`. | this section |
| `LLMToolSelectorMiddleware` | `wrap_model_call` | Asks a model, by default the agent model itself, which tools to bind before each model call. | this section, [4.4](#s-many-tools-and-the-tool-selector) |
| `LLMToolEmulator` | `wrap_tool_call` | Lets a model invent the result of a tool, for tests. The tool never runs. | this section |
| `ProviderToolSearchMiddleware` | `wrap_model_call` | Defers tools to the server-side tool search of Anthropic or OpenAI. | this section |
| `ShellToolMiddleware` | `before_agent`, `after_agent` | Adds a `shell` tool with one shell session per run. It runs on the host by default. | this section |
| `FilesystemFileSearchMiddleware` | none, tools only | Adds `glob_search` and `grep_search` over one root folder. | this section |

[Figure](#fig-4-6) groups the classes by the hook they use. The hook tells you where a class acts: on the request, on the result, or on the state between steps.

```figure
id: fig-4-6
kind: tree
title: the 19 built-in middleware classes by hook
claim: Ten built-in classes only wrap the model call or the tool call, eight add graph nodes of their own, and one adds only tools.
caption: Read from the root down. Each branch is one kind of hook, and each leaf is a class. Under node hooks, the line below each class names all of its hooks. From libs/langchain_v1/langchain/agents/middleware at langchain==1.5.0 and capture/out/09-middleware-order.txt.
```

## The documentation lists 22

The prebuilt middleware page lists 22 provider-independent middlewares {{docs oss/python/langchain/middleware/built-in}}. Nineteen of them are the classes above. The other three are `FilesystemMiddleware`, `SubAgentMiddleware`, and `RubricMiddleware`, which you import from `deepagents`. The page shows the import, but the table does not mark which package each one needs. This manual counts the 19 that are in `langchain`, and records the difference as conflict D130. Section 7.4 covers the Deep Agents middleware, and the section below measures `RubricMiddleware`.

## Call limits

`ModelCallLimitMiddleware` counts model calls per run with `run_limit`, and per thread with `thread_limit`. With the default `exit_behavior="end"`, the run ends with an AI message in place of the next model call:

```listing
title: ModelCallLimitMiddleware(run_limit=1) after one model call
source: capture/out/11-mw-call-limits.txt
lang: json
note: The last message of the run. The tool call and the tool result before it are cut.
---
    "type": "AIMessage",
    "content": "Model call limits exceeded: run limit (1/1)",
```

With `exit_behavior="error"`, the run raises `ModelCallLimitExceededError` with the same text. The thread count is saved in the checkpoint, so `thread_limit` needs a checkpointer. On the third turn of a thread with `thread_limit=2`, the answer was `Model call limits exceeded: thread limit (2/2)`.

`ToolCallLimitMiddleware` counts tool calls. With the default `exit_behavior="continue"`, a call over the limit gets an error `ToolMessage`, and the other calls run:

```listing
title: ToolCallLimitMiddleware(tool_name='add', run_limit=1) with two calls in one message
source: capture/out/11-mw-call-limits.txt
lang: json
note: The two ToolMessages. The ids are cut.
---
    "type": "ToolMessage",
    "content": "Tool call limit exceeded. Do not call 'add' again.",
    "name": "add",
…
    "tool_call_id": "<uuid-10>",
    "status": "error"
  },
  {
    "type": "ToolMessage",
    "content": "2",
    "name": "add",
…
    "tool_call_id": "<uuid-9>",
    "status": "success"
```

The model asked for `add(1, 1)` as `<uuid-9>` and `add(2, 2)` as `<uuid-10>` in one reply. The second call was blocked, and the error message comes first in the state. The model still answered that 2 + 2 is 4, from its own arithmetic.

With `exit_behavior="end"`, the run stops after that batch with `Tool call limit reached: run limit exceeded (2/1 calls).`. With `error`, it raises `ToolCallLimitExceededError`. The model can still ask again after `continue`, or answer without the tool, so add a model call limit as well when cost matters.

## Planning and context

`TodoListMiddleware` adds the `write_todos` tool and a system prompt section about it. Each call replaces the list in `state["todos"]`. The kit asked Qwen3 4B to plan, add, and mark the plan done. It called `write_todos`, `add`, and `write_todos` again, and its own plan had two items. After the run, the state held the final list:

```listing
title: state["todos"] after the run
source: capture/out/17-mw-todo-context-editing.txt
lang: text
note: The todos key of the output state.
---
todos:
[
  {
    "content": "Understand the task: calculate 2 + 3",
    "status": "completed"
  },
  {
    "content": "Perform the addition: 2 + 3",
    "status": "completed"
  }
]
```

`ContextEditingMiddleware` with `ClearToolUsesEdit` replaces old tool results in the request with `[cleared]`. The kit sent three tool results with `trigger=10` and `keep=1`. The model got the newest result and two placeholders:

```listing
title: what the model received after ClearToolUsesEdit(trigger=10, keep=1)
source: capture/out/17-mw-todo-context-editing.txt
lang: json
---
[
  "Add three pairs: 1 + 1, 2 + 2, and 3 + 3.",
  "",
  "[cleared]",
  "",
  "[cleared]",
  "",
  "result 6 result 6 result 6 result 6 result 6 "
]
```

The model still answered 2, 4, and 6, because the question names the pairs. The edit is a `wrap_model_call` hook, so it changes only the request. The state keeps every tool result, and the checkpoint grows as before. [Section 5.5](#s-context-engineering-and-summarization) compares it with summarization.

## Tool selection, emulation, and tool search

`LLMToolSelectorMiddleware` asks a model which tools to bind. With no `model` argument, it asks the agent model itself {{code libs/langchain_v1/langchain/agents/middleware/tool_selection.py:278}}. [Section 4.4](#s-many-tools-and-the-tool-selector) measures what it does to accuracy and cost. With `max_tools=1`, the agent model saw one of three tools. The selector ran once for each agent model call, so a run of two model calls made four model calls in all:

```listing
title: the agent model with LLMToolSelectorMiddleware(max_tools=1)
source: capture/out/18-mw-selection-emulation.txt
lang: json
note: The first agent model call. The agent had add, get_weather, and send_email.
---
    "model": "agent",
    "call": 1,
    "messages": [
      "human: Weather in Pune?"
    ],
    "tools": [
      "get_weather"
    ]
```

`LLMToolEmulator` sends each listed tool call to a model and returns its text as the result. The tool body never ran. The emulator model wrote the result, and the `ToolMessage` held `Email sent successfully to ops@example.com. 📩`. Pass `model`, because the default is a named Anthropic model, and the default warns that it is deprecated {{code libs/langchain_v1/langchain/agents/middleware/tool_emulator.py}}.

`ProviderToolSearchMiddleware` needs a provider with server-side tool search. On `ChatOllama` it raised `ValueError` with the text `but got 'ollama'; supported providers: anthropic, openai`. With no tools to defer, it passed the request through. We did not run it against a provider, and that test comes in the next edition. [Section 8.8](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) lists it.

## Shell and file search

`ShellToolMiddleware` adds a `shell` tool. It starts one shell in `before_agent` and stops it in `after_agent`. The kit asked Qwen3 4B to run a command in its workspace, in two runs. The model never ran one. It sent the command as an object in place of a string, 13 times in all, and each call failed validation:

```listing
title: the shell tool call that failed
source: capture/out/19-mw-shell-files.txt
lang: json
note: The content of the first ToolMessage of the run that asked for ls.
---
    "content": "Error invoking tool 'shell' with kwargs {'command': {'command': 'ls'}} with error:\n command: Input should be a valid string\n Please fix the error and try again.",
```

The model then said the tool had a problem of its own. So check a middleware tool with the model you will use, before you rely on it.

With no `execution_policy`, the middleware uses `HostExecutionPolicy`, which runs commands on your machine with your rights {{code libs/langchain_v1/langchain/agents/middleware/shell_tool.py}}. `DockerExecutionPolicy` and `CodexSandboxExecutionPolicy` are the isolated choices. [Section 8.4](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) covers the risk.

`FilesystemFileSearchMiddleware` adds `glob_search` and `grep_search` under `root_path`. The paths in the results start at that root. With `use_ripgrep=False` it searches in Python. In the kit, `glob_search` with `**/*.py` returned `/src/app.py`. All 8 `grep_search` calls failed, because the model sent `include` as an object, such as `{'pattern': '*.py'}`. After 10 model calls it gave up and blamed the tool.

## RubricMiddleware, a grader from Deep Agents

**RubricMiddleware:** a middleware of `deepagents` that grades the answer of an agent against a rubric. The caller passes the rubric as the state key `rubric`. With no rubric the middleware does nothing {{code libs/deepagents/deepagents/middleware/rubric.py}}. When the agent would finish, a grader model reads the transcript and gives one verdict per criterion. A `needs_revision` verdict sends the agent back for another round. After `max_iterations` rounds the run ends with `max_iterations_reached`.

**We measured** it on the 25 tasks that a plain loop of Qwen3 8B failed in the first bench. The worker was Qwen3 8B in `create_agent` with the middleware and `max_iterations=3`. The grader was Qwen3 14B on a second Ollama 0.31.1, on the Mac.

The rubric had four criteria. Every fact came from a tool result. The answer was submitted once with the right value. Every requested change was made. Every part of the request was done.

Each task ran once. A cell of 25 tasks is small, and the tasks were chosen because the plain loop failed them. [Figure](#fig-4-6b) shows each run.

```figure
id: fig-4-6b
kind: chart
title: RubricMiddleware on the 25 tasks that Qwen3 8B failed as a plain loop
claim: A Qwen3 14B grader said satisfied on 14 runs, and 12 of those runs still failed the state check.
caption: Each row is one task. Squares give the grader verdicts in order, and the next column is the state check. Calls count model calls of the worker. From capture/lab/bench2/summary-bench2.json.
```

Three tasks passed: `r06`, `sql03`, and `sql09`. Twelve runs got `satisfied` at the first look, and 11 of them failed the check. Eleven runs ended at the round limit, and `r06` was one of them.

The rubric raised the worker calls from 108 to 173 and the worker prompt tokens from 75,987 to 174,192. The grader added 56 calls and 113,851 prompt tokens. The three-turn task `multi13` had grader rounds in each turn, 9 grader calls and 22 worker calls in all. All 25 runs took 16,841 s, against 446 s for the plain runs, and 11,379 s of it was grader time. The Mac was shared, so those times are upper bounds.

So the grader is only as good as its model. A 14B grader said satisfied on runs that the state check failed. Check a grader against your state checker before you rely on its verdict.

```takeaways
- Set trigger on SummarizationMiddleware, because the default never summarizes.
- Pair ToolCallLimitMiddleware with ModelCallLimitMiddleware when a loop must stop.
- Give ModelCallLimitMiddleware a checkpointer when you use thread_limit.
- Pass an execution_policy other than HostExecutionPolicy to ShellToolMiddleware outside a sandbox.
- Import FilesystemMiddleware, SubAgentMiddleware, and RubricMiddleware from deepagents, not from langchain.
- Check a RubricMiddleware grader against a state checker, because a 14B grader accepted 12 failed runs.
```

Sources: capture/out/09-middleware-order.txt, capture/out/11-mw-call-limits.txt, capture/out/17-mw-todo-context-editing.txt, capture/out/18-mw-selection-emulation.txt, capture/out/19-mw-shell-files.txt, capture/s_middleware.py; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/middleware/built-in); libs/langchain_v1/langchain/agents/middleware at langchain==1.5.0; capture/lab/bench2/summary-bench2.json, capture/lab/bench2/runs/rubric.jsonl, capture/lab/bench2/logs/q-rubric.log, capture/lab/bench2/kit2/run2.py; libs/deepagents/deepagents/middleware/rubric.py at deepagents==0.7.38.
