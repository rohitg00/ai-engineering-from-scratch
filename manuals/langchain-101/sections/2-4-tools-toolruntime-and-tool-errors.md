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
source: capture/out/03-tools.txt
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
    "content": "order A-17: shipped (asked by ada, tool_call_id=call_7)",
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

Test such a tool inside an agent with a fake model, as the kit does.

## Tool errors

**Tool error:** a failure while the agent runs a tool call. Its kind decides if the run raises or goes on.

The agent runs tools with a `ToolNode`. `create_agent` uses the default error handler of `ToolNode`, which turns an invalid call into a message and raises every other exception {{code libs/prebuilt/langgraph/prebuilt/tool_node.py}}. [Figure](#fig-2-4) draws the four cases of the kit.

```figure
id: fig-2-4
kind: decision
title: what each kind of tool failure does to a run
claim: Bad arguments and an unknown tool name become an error ToolMessage, and an exception inside the tool ends the run unless middleware converts it.
caption: Read each row from the failure on the left to the result on the right. Green rows go on to the next model call, and the rose row raises out of invoke. From capture/out/04-tool-errors.txt.
```

Bad arguments become a `ToolMessage` with `status` `error`, and the model gets a second chance:

```listing
title: the model sends bad arguments
source: capture/out/04-tool-errors.txt
lang: json
note: The ToolMessage and the reply after it.
---
    "content": "Error invoking tool 'add' with kwargs {'a': 'two'} with error:\n a: Input should be a valid integer, unable to parse string as an integer\nb: Field required\n Please fix the error and try again.",
    "name": "add",
    "id": "<uuid-3>",
    "tool_call_id": "call_1",
    "status": "error"
  },
  {
    "type": "AIMessage",
    "content": "I could not add them.",
```

An unknown tool name also becomes an error message: `Error: subtract is not a valid tool, try one of [add].`. An exception inside the tool is different. With no middleware, `invoke` raised `RuntimeError: disk on fire`, and the run ended.

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
    "id": "<uuid-7>",
    "tool_call_id": "call_1",
    "status": "error"
```

`ToolErrorMiddleware()` with no `on_error` raises `ValueError` when you build it. A retry is a different choice: `ToolRetryMiddleware` runs the tool again, and Part 3 counts its attempts.

## Tool names and tool call ids

**Tool call id:** the id that the model gives each tool call, which the `ToolMessage` of that call carries back.

**We measured** three cases on the Mac, an Apple M1 Max with 10 cores and 64 GiB. Each case ran once for each call style, because nothing in it varies.

Two tools with the same name raised no error in `create_agent`. We passed `safe_lookup` and `privileged_delete`, both named `account_action`. The later tool in the list won: the model got only its schema, and each call ran only that tool. With `privileged_delete` second, the call of `account_action` ran `privileged_delete`. Issue langgraph#7988 reports this {{issue langgraph#7988}}. Give every tool a unique name.

A server that sends tool calls with no id breaks the run in two ways. We sent two parallel calls with no id from a stub to `ChatOpenAI` and `create_agent`. Under `invoke` and `stream_mode="messages"`, both tools ran, and then the run raised `TypeError: Tool lookup returned unexpected type: <class 'str'>`. So the side effects happened, and the run failed. Under `stream_events` v3, each id became `""`, both tools ran, and both `ToolMessage` objects had the id `""`. Issue langchain#40531 reports this coercion {{issue langchain#40531}}.

Qwen3 4B on Ollama sent ids. Through `ChatOllama` and through `ChatOpenAI` on the `/v1` path, 18 of 18 runs made two calls with ids, and both tools ran. That was 3 runs for each of `invoke`, `messages` mode, and v3 on each path.

Under v3, a tool call piece on the last chunk of a stream is lost. A chunk with `chunk_position="last"` reports parsed tool calls from `content_blocks`, and only the calls with an id, in place of chunk blocks {{code libs/core/langchain_core/messages/ai.py}}. A fragment of arguments does not parse alone, so `chunks_to_events` gets no delta for it {{code libs/core/langchain_core/language_models/_compat_bridge.py}}. In our fake, the second call became an invalid tool call and got an error `ToolMessage`. With no ids, one of the two calls never ran.

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

Sources: capture/common.py, capture/out/03-tools.txt, capture/out/04-tool-errors.txt; capture/lab/summary/parallel-tools-mac.json, capture/lab/T08-parallel-tools-mac/02-idless-and-dupnames.jsonl, capture/lab/T08-parallel-tools-mac/03-ollama-parallel.jsonl, capture/lab/T08-parallel-tools-mac/t08_ids.py, capture/lab/T08-parallel-tools-mac/t08_ollama.py; issue langgraph#7988, issue langchain#40531; libs/core/langchain_core/messages/ai.py and libs/core/langchain_core/language_models/_compat_bridge.py at langchain-core 1.8.0; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/tools); libs/prebuilt/langgraph/prebuilt/tool_node.py and libs/langgraph/langgraph/types.py at langgraph 1.2.22; libs/core/langchain_core/tools at langchain==1.5.0.
