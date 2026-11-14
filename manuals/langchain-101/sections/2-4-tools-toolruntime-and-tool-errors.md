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

Call `runtime.stream_writer(value)` as a function. The example in the `ToolRuntime` docstring calls `stream_writer.write(...)`, and that method does not exist, because `StreamWriter` is a plain callable {{code libs/langgraph/langgraph/types.py}}. This manual records the disagreement as conflict D3.

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

The agent runs tools with a `ToolNode`. `create_agent` uses the default error handler of `ToolNode`, which turns an invalid call into a message and raises every other exception {{code libs/prebuilt/langgraph/prebuilt/tool_node.py}}. [Figure 2.4](#fig-2-4) draws the four cases of the kit.

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

## One ToolMessage for each tool call

The tools page says that each tool call in the history needs a `ToolMessage` that answers it {{docs oss/python/langchain/tools}}. The agent keeps this rule for you in every case above, including the errors. Code that edits the messages, such as a trim or a summary, must keep it too.

```takeaways
- Give every tool argument a type hint and write the docstring for the model.
- Use a runtime parameter of type ToolRuntime for context, state, and the stream writer.
- Call runtime.stream_writer(value) as a function.
- Add ToolErrorMiddleware when an exception inside a tool must not end the run.
- Keep one ToolMessage for each tool call when you edit messages.
```

Sources: capture/common.py, capture/out/03-tools.txt, capture/out/04-tool-errors.txt; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/tools); libs/prebuilt/langgraph/prebuilt/tool_node.py and libs/langgraph/langgraph/types.py at langgraph 1.2.22; libs/core/langchain_core/tools at langchain==1.5.0.
