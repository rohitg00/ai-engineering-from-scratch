# Tools, ToolRuntime, and tool errors

> A tool is a typed function with a schema, `ToolRuntime` hides the run from the model, and by default only bad arguments become an error message.

You give an agent a tool that reads a file, the disk fails, and the whole run raises. Another time the model sends a string where the tool wants an integer, and the run goes on with an error message in the conversation. The same agent handled two failures in two different ways.

When you finish this section, you can write a tool with a schema the model can use, and read the run from inside it. You can also predict what each kind of tool failure does to a run.

## The schema the model sees

**Tool:** a function wrapped by `@tool`, with a name, a description, and a JSON schema for its arguments.

The kit defines `add` with two typed arguments and a docstring:

```listing
title: the add tool
source: capture/common.py
lang: python
---
@tool
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b
```

`@tool` builds the schema from the type hints and takes the description from the docstring. This is what a model receives:

```listing
title: the schema of add
source: capture/out/03-tools.txt
lang: json
---
{
  "description": "Add two integers.",
  "properties": {
    "a": {
      "title": "A",
      "type": "integer"
    },
    "b": {
      "title": "B",
      "type": "integer"
    }
  },
  "required": [
    "a",
    "b"
  ],
  "title": "add",
  "type": "object"
}
```

A tool with no type hints gets no useful schema. The tools page says that type hints are required, because they define the input schema {{docs oss/python/langchain/tools}}. Write the docstring for the model, because it is the only explanation the model gets.

## ToolRuntime

**ToolRuntime:** a parameter type that gives a tool the state, the context, the store, the stream writer, and the id of the current tool call.

A parameter named `runtime` with the type `ToolRuntime` is filled in by the agent. The model never sees it. The documentation says the same {{docs oss/python/langchain/tools}}. The kit tool `lookup_order` has two parameters, and its schema has one:

```listing
title: lookup_order and its schema
source: capture/out/03-tools.txt
lang: json
note: The argument list of the tool, then the schema the model sees.
---
lookup_order.args:
[
  "order_id"
]

tool_call_schema:
{
  "description": "Look up an order by its id.",
  "properties": {
    "order_id": {
      "title": "Order Id",
      "type": "string"
    }
  },
```

`runtime` and `config` are reserved names. The tools page warns that a tool argument with either name causes errors at run time {{docs oss/python/langchain/tools}}.

Inside an agent, `lookup_order` reads `runtime.context` and `runtime.tool_call_id`, and it writes one value with `runtime.stream_writer`. The value arrives in the `custom` stream mode, before the `ToolMessage`:

```listing
title: ToolRuntime inside create_agent
source: capture/out/43-tool-runtime-agent.txt
lang: json
note: The custom chunk and the tool update. The two model updates are cut.
---
custom:
{
  "lookup": "A-17"
}

updates tools:
[
  {
    "type": "ToolMessage",
    "content": "order A-17: shipped (asked by ada, tool_call_id=<uuid-2>)",
```

Call `runtime.stream_writer(value)` as a function. The example in the `ToolRuntime` docstring calls `stream_writer.write(...)` {{code libs/prebuilt/langgraph/prebuilt/tool_node.py:1746}}. That method does not exist, because `StreamWriter` is a plain callable {{code libs/langgraph/langgraph/types.py}}. This manual records the disagreement as conflict D3.

A `ToolRuntime` tool cannot run outside an agent. Called with only its arguments, it raises a `ValidationError` because `runtime` is missing:

```listing
title: a ToolRuntime tool invoked by hand
source: capture/out/03-tools.txt
lang: text
note: The help line of pydantic is cut.
---
lookup_order.invoke({'order_id': 'A-17'}):

raised pydantic_core._pydantic_core.ValidationError: 1 validation error for lookup_order
runtime
  Field required [type=missing, input_value={'order_id': 'A-17'}, input_type=dict]
```

Test such a tool inside an agent, as the kit does with Qwen3 4B.

## Tool errors

**Tool error:** a failure while the agent runs a tool call. Its kind decides if the run raises or goes on.

The agent runs tools with a `ToolNode`. `create_agent` uses the default error handler of `ToolNode`, which turns an invalid call into a message and raises every other exception {{code libs/prebuilt/langgraph/prebuilt/tool_node.py}}. [Figure](#fig-3-4) draws the four cases of the kit.

```figure
id: fig-3-4
kind: decision
title: what each kind of tool failure does to a run
claim: Bad arguments and an unknown tool name become an error ToolMessage, and an exception inside the tool ends the run unless middleware converts it.
caption: Read each row from the failure on the left to the result on the right. Green rows go on to the next model call, and the rose row raises out of invoke. From capture/out/04-tool-errors.txt and capture/out/19-mw-shell-files.txt.
```

Bad arguments become a `ToolMessage` with `status` `error`, and the model gets a second chance. The kit could not make Qwen3 4B send a bad argument to `add`. Asked for `2.5 + 3`, it sent 2 and 3, and then told the user that the tool takes integers. Asked to set a volume of 0 to 10 to 11, it called no tool and said that 10 is the maximum.

The bad arguments came from the shell tool of [section 4.6](#s-the-built-in-middleware). The model sent the command as an object in place of a string, six times in a row:

```listing
title: the model sends bad arguments
source: capture/out/19-mw-shell-files.txt
lang: json
note: The first ToolMessage of the run that asked for ls.
---
    "content": "Error invoking tool 'shell' with kwargs {'command': {'command': 'ls'}} with error:\n command: Input should be a valid string\n Please fix the error and try again.",
    "name": "shell",
…
    "status": "error"
```

A second chance does not help when the model repeats the same mistake, so set a recursion limit or a tool call limit.

A real model rarely names a tool that it was not given. Told about a `subtract` tool that did not exist, Qwen3 4B called `add` with 5 and -3. An unknown name comes when the tools change under a thread. The kit paused an agent that had `subtract`, then resumed the thread with an agent that had only `add`. The saved call became an error message: `Error: subtract is not a valid tool, try one of [add].`.

An exception inside the tool is different. With no middleware, `invoke` raised `RuntimeError: disk on fire`, and the run ended.

`ToolErrorMiddleware` turns that exception into a message. Its `on_error` function returns the text, and the run goes on:

```listing
title: ToolErrorMiddleware turns the exception into a message
source: capture/out/04-tool-errors.txt
lang: json
note: The ToolMessage only.
---
    "type": "ToolMessage",
    "content": "RuntimeError in flaky_disk: disk on fire",
    "name": "flaky_disk",
    "id": "<uuid-11>",
    "tool_call_id": "<uuid-10>",
    "status": "error"
```

`ToolErrorMiddleware()` with no `on_error` raises `ValueError` when you build it. A retry is a different choice: `ToolRetryMiddleware` runs the tool again, and Part 4 counts its attempts.

## Tool names and tool call ids

**Tool call id:** the id that the model gives each tool call, which the `ToolMessage` of that call carries back.

**We measured** three cases with Qwen3 4B. The duplicate-name case ran 3 times on the x86 server guest and gave the same result in 3 of 3 runs. The call-count case ran once for each count. The id-less case is a stub on the Mac, with one row for each case.

Two tools with the same name raised no error in `create_agent`. We passed `safe_lookup` and `privileged_delete`, both named `account_action`. The later tool in the list won: the model got only its schema, and each call ran only that tool. With `privileged_delete` second, the call of `account_action` ran `privileged_delete`.

With a real model, the choice of the model followed the description of the later tool. It refused a lookup when it saw `Delete an account.`. It ran `privileged_delete` for a delete request. Issue langgraph#7988 reports this {{issue langgraph#7988}}. Give every tool a unique name.

A server that sends tool calls with no id breaks the run in two ways. We sent two parallel calls with no id from a stub to `ChatOpenAI` and `create_agent`. Under `invoke` and `stream_mode="messages"`, both tools ran, and then the run raised `TypeError: Tool lookup returned unexpected type: <class 'str'>`. So the side effects happened, and the run failed. Under `stream_events` v3, each id became `""`, both tools ran, and both `ToolMessage` objects had the id `""`. Issue langchain#40531 reports this coercion {{issue langchain#40531}}.

No real model produced id-less calls: Ollama 0.31.1 sends ids on both paths, so these rows come from a stub on the Mac.

Qwen3 4B made 2, 2, 4, 8, and 16 calls when asked for 1, 2, 4, 8, and 16. Each count ran once on the x86 server guest. Every call had an id, on both paths. The paths were `ChatOllama` and `ChatOpenAI` on the `/v1` path of Ollama.

Under v3, a tool call piece on the last chunk of a stream is lost. A chunk with `chunk_position="last"` reports parsed tool calls from `content_blocks`, and only the calls with an id, in place of chunk blocks {{code libs/core/langchain_core/messages/ai.py}}. A fragment of arguments does not parse alone, so `chunks_to_events` gets no delta for it {{code libs/core/langchain_core/language_models/_compat_bridge.py}}. In a fake model (no real model produces this), the second call became an invalid tool call and got an error `ToolMessage`. With no ids, one of the two calls never ran.

`ChatOpenAI` ends its stream with an empty chunk, so it is safe. Make a custom model do the same.

## One ToolMessage for each tool call

The tools page says that each tool call in the history needs a `ToolMessage` that answers it {{docs oss/python/langchain/tools}}. The agent keeps this rule for you in every case above, including the errors. Code that edits the messages, such as a trim or a summary, must keep it too.

```takeaways
- Give every tool argument a type hint and write the docstring for the model.
- Use a runtime parameter of type ToolRuntime for context, state, and the stream writer.
- Call runtime.stream_writer(value) as a function.
- Add ToolErrorMiddleware when an exception inside a tool must not end the run.
- Keep one ToolMessage for each tool call when you edit messages.
- Give every tool a unique name, because the last duplicate wins without an error.
- End a custom model stream with an empty chunk marked last.
```

Sources: capture/common.py, capture/s_start.py, capture/out/03-tools.txt, capture/out/43-tool-runtime-agent.txt, capture/out/04-tool-errors.txt, capture/out/19-mw-shell-files.txt; capture/lab/summary/parallel-tools-x86.json, capture/lab/T08-parallel-tools-x86/01-counts.jsonl, capture/lab/T08-parallel-tools-x86/02-raw-ollama.jsonl, capture/lab/T08-parallel-tools-x86/03-dupnames.jsonl, capture/lab/T08-parallel-tools-x86/t08_real.py; capture/lab/summary/parallel-tools-mac.json, capture/lab/T08-parallel-tools-mac/02-idless-and-dupnames.jsonl, capture/lab/T08-parallel-tools-mac/t08_ids.py; issue langgraph#7988, issue langchain#40531; libs/core/langchain_core/messages/ai.py and libs/core/langchain_core/language_models/_compat_bridge.py at langchain-core 1.8.0; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/tools); libs/prebuilt/langgraph/prebuilt/tool_node.py and libs/langgraph/langgraph/types.py at langgraph 1.2.22; libs/core/langchain_core/tools at langchain==1.5.0.
