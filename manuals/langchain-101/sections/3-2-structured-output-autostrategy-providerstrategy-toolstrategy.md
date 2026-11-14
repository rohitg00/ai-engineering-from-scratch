# Structured output: AutoStrategy, ProviderStrategy, ToolStrategy

> `ToolStrategy` asks for a tool call and retries without a limit, `ProviderStrategy` asks the provider for JSON and never retries, and `AutoStrategy` picks one before each model call.

You need an order object out of an email, so you pass a Pydantic class as `response_format`. On one model the run returns the object. On a smaller model it loops until the recursion limit. On a third provider it raises before the first request. The strategy that ran decides which of the three you get.

When you finish this section, you can predict which strategy an agent uses, what it sends to the model, and how it fails. You can also choose a strategy from failure rates we measured on four model sizes.

## Three strategies

**Structured output strategy:** the way `create_agent` gets an object of your schema from the model. The result goes in `structured_response` in the output state.

- **ToolStrategy:** binds one tool for each schema, forces `tool_choice="any"`, and parses the arguments of the tool call. On a parse error it sends the error back to the model and asks again.
- **ProviderStrategy:** passes the schema to the provider as `response_format`, and parses the JSON text of the reply. It makes one attempt.
- **AutoStrategy:** holds a schema and resolves to one of the other two before each model call.

A plain schema, such as a Pydantic class, becomes `AutoStrategy` {{code libs/langchain_v1/langchain/agents/factory.py}}. The strategies are in `langchain.agents.structured_output`.

## How AutoStrategy chooses

`AutoStrategy` picks `ProviderStrategy` when the model profile says `structured_output` is true. With no profile, it checks the model name against a fixed list of names, such as `gpt-4o`, `gpt-4.1`, and some Claude models. Otherwise it picks `ToolStrategy` {{code libs/langchain_v1/langchain/agents/factory.py}}. [Figure](#fig-3-2) draws the choice.

```figure
id: fig-3-2
kind: decision
title: which strategy runs, and how it fails
claim: An explicit strategy is never changed, and AutoStrategy chooses before each call from the profile or the name, so no failure moves a run to the other.
caption: Read from the top. The amber boxes are choices that create_agent makes before the request. The rose boxes are the failures each strategy ends in. From capture/out/07-structured-output.txt, capture/out/08-structured-errors.txt, and capture/lab/summary/structured-output-mac.json.
```

The kit runs the same schema on two fakes. The first has no profile, and the agent binds a tool named after the schema:

```listing
title: a plain schema on a model with no profile
source: capture/out/07-structured-output.txt
lang: json
note: The bound tools of the first model call.
---
    "bound": {
      "tools": [
        "add",
        "Answer"
      ],
      "tool_choice": "any",
      "kwargs": []
    }
```

The second fake has the profile `{"structured_output": True}`. The agent binds only `add`, sets no `tool_choice`, and passes `response_format`:

```listing
title: a plain schema on a model whose profile says structured_output
source: capture/out/07-structured-output.txt
lang: json
note: The bound tools of the first model call.
---
    "bound": {
      "tools": [
        "add"
      ],
      "tool_choice": null,
      "kwargs": [
        "response_format"
      ]
    }
```

`ChatOllama` has no profile, and Ollama model names are not in the list. So on Ollama a plain schema and `AutoStrategy` always run as `ToolStrategy`.

## ToolStrategy

`ToolStrategy` accepts a Pydantic class, a dataclass, a `TypedDict`, a JSON schema `dict`, or a union of classes. It splits a union into one tool for each member, so the model picks the type by picking the tool:

```listing
title: ToolStrategy with a union binds one tool for each schema
source: capture/out/07-structured-output.txt
lang: json
note: The bound tools of the union run.
---
      "tools": [
        "add",
        "Answer",
        "Refusal"
      ],
```

A `TypedDict` gives back a `dict`, and a dataclass gives back an instance of it. A JSON schema `dict` gives back the arguments with no validation. The kit sent `"not a number"` for an integer field, and the run returned it as the result:

```listing
title: a JSON schema dict is not validated
source: capture/out/07-structured-output.txt
lang: text
note: The structured_response of the JSON schema run.
---
structured_response:
{
  "value": "not a number"
}
```

When the arguments fail validation, `ToolStrategy` writes the error into a `ToolMessage` and calls the model again. The message ends with `Please fix your mistakes.`:

```listing
title: the retry message after a validation error
source: capture/out/08-structured-errors.txt
lang: json
note: The ToolMessage between the bad call and the good call. The pydantic help line is part of the content.
---
    "content": "Error: Failed to parse structured output for tool 'Answer': Failed to parse data to Answer: 1 validation error for Answer\nvalue\n  Input should be a valid integer, unable to parse string as an integer [type=int_parsing, input_value='five', input_type=str]\n    For further information visit https://errors.pydantic.dev/2.14/v/int_parsing.\n Please fix your mistakes.",
    "name": "Answer",
    "id": "<uuid-2>",
    "tool_call_id": "call_a",
    "status": "success"
```

The `status` of that message is `success`, though it carries an error. Code that counts error `ToolMessage` objects does not count these retries. Two structured tool calls in one AI message also get a retry, with the text `Model incorrectly returned multiple structured responses (Answer, Refusal) when only one is expected.`

**handle_errors:** the `ToolStrategy` parameter that sets the retry. `True`, the default, retries on every parse error. A string replaces the retry text. An exception type or a tuple retries only those errors. `False` raises `StructuredOutputValidationError` on the first bad call {{code libs/langchain_v1/langchain/agents/structured_output.py}}.

## ProviderStrategy

`ProviderStrategy` sends the schema to the provider and reads the text of the reply as JSON. When the text is not JSON, or fails validation, the run raises on the first call:

```listing
title: ProviderStrategy with text that is not JSON
source: capture/out/08-structured-errors.txt
lang: text
---
raised langchain.agents.structured_output.StructuredOutputValidationError: Failed to parse structured output for tool 'Answer': Native structured output expected valid JSON for Answer, but parsing failed: Expecting value: line 1 column 1 (char 0)..
```

A union does not get that far. `ProviderStrategy(Union[Refund, Exchange])` raised `ValueError: Unsupported schema type` inside `create_agent`, before any request, in every run we made.

## No change of strategy at run time

The structured output page says that an agent uses tool calling in place of provider output when the model does not support structured output. It says this of a plain schema and of `ProviderStrategy` both {{docs oss/python/langchain/structured-output}}. The code keeps an explicit strategy as it is, and resolves `AutoStrategy` from the profile and the name only {{code libs/langchain_v1/langchain/agents/factory.py}}. This manual follows the code and records the disagreement as conflicts D121 and D209.

We tested it against a local stub that answers a request with `response_format` with a 400:

```listing
title: an explicit ProviderStrategy against a server that rejects response_format
source: capture/lab/T06-structured-output-mac/02-d209-fake-and-stub.jsonl
lang: json
note: Cut to the case, the outcome, the error, and the keys of the one request.
---
{"case": "ChatOpenAI(local-model) ProviderStrategy, server 400s on response_format", "user_tools": [], "outcome": "raised", "error_type": "OpenAIInvalidRequestError", "error": "Error code: 400 - response_format json_schema is not supported by this model", …"requests": [{"path": "/v1/chat/completions", "keys": ["messages", "model", "response_format", "stream", "tools"], …}]}
```

One request, one error, and no second request with tools. `AutoStrategy` with the model name `local-model` chose `ToolStrategy` and returned a valid object. With the model name `gpt-4o`, `AutoStrategy` chose `ProviderStrategy` from the name list, and raised the same 400. So the page holds only for a model that the code already knows to lack the feature.

## Two runs that end with nothing

`handle_errors=True` has no retry count. With `tools=[]`, the agent graph has a `model` to `model` edge that loops until a structured response exists. Only the recursion limit stops it, and the agent default is 9999 steps. In the kit, a fake that answered in plain text made 12 model calls under `recursion_limit=12`, and raised `GraphRecursionError`.

With at least one tool of your own, the same plain text answer ends the run. The fake case gave `structured_response` of `None`, one model call, and no exception. `ProviderStrategy` ends the same way when the model answers with a tool call. Check `structured_response` for `None` after every run.

## Failure rates on four model sizes

**We measured** each strategy on the Mac with four Qwen3 models on Ollama, with thinking off and temperature 0. The agent had no tools and a limit of 10 model calls per run. Four schemas: flat, nested, a union, and two enums. Each model and schema had 20 inputs on the 0.6B model and 10 on the others, so 600 runs in all.

`AutoStrategy` and `ToolStrategy` were the same configuration on Ollama, and their runs gave the same outcomes. A run failed when it raised or returned no `structured_response`:

| Model | `ToolStrategy` failed | `ProviderStrategy` failed | `ProviderStrategy` without the union |
|---|---|---|---|
| `qwen3:0.6b` | 36 of 80, 45% | 20 of 80, 25% | 0 of 60 |
| `qwen3:1.7b` | 6 of 40, 15% | 10 of 40, 25% | 0 of 30 |
| `qwen3:4b-instruct` | 11 of 40, 28% | 13 of 40, 32% | 3 of 30 |
| `qwen3:8b` | 10 of 40, 25% | 10 of 40, 25% | 0 of 30 |

Every `ProviderStrategy` failure on the 0.6B, 1.7B, and 8B models was the union at build time. Without the union, `ToolStrategy` failed 36 of 60, 6 of 30, 11 of 30, and 10 of 30. [Figure](#fig-3-2b) shows each run.

```figure
id: fig-3-2b
kind: chart
title: the outcome of each structured output run
claim: ProviderStrategy failed only on the union and on 3 enum runs, and all but 2 ToolStrategy failures were on the nested and enum schemas.
caption: Each dot is one run on the Mac. Each row is one schema and strategy, and each column is one model. Blue is valid on the first call, amber is valid after a retry, and rose raised. From capture/lab/summary/structured-output-mac.json.
```

The nested schema hit the limit of 10 calls in 10 of 10 `ToolStrategy` runs on the 8B model. It hit it in 19 of 20 on the 0.6B model. The model sent the schema back in place of the data, and each retry repeated it. On the 4B model, three nested runs ended with an Ollama error about truncated tool call JSON. Three enum runs ended with an Ollama 400, because the retries left two AI messages in a row.

The structured output page calls `ProviderStrategy` the most reliable method when it is available {{docs oss/python/langchain/structured-output}}. On these models it gave a valid object more often than `ToolStrategy` for the nested and enum schemas. It cannot take a union, and it never retries.

## Valid is not correct

A valid object matches the schema. It can still hold the wrong values. In the enum schema, the model chose a priority and a category for a support ticket. Look at the `ProviderStrategy` runs with a `structured_response`, from the smallest model to the largest. The values agreed with our labels in 4 of 20, 3 of 10, 4 of 7, and 4 of 10. Our labels are judgement calls, so read this as agreement with one reader.

```takeaways
- Choose ToolStrategy or ProviderStrategy explicitly, because AutoStrategy reads only the profile and the model name.
- Use ToolStrategy for a union, because ProviderStrategy rejects it when you build the agent.
- Set recursion_limit on runs with ToolStrategy, because handle_errors=True retries without a count.
- Check structured_response for None after each run that has tools.
- Wrap ProviderStrategy runs in your own retry, because it raises on the first bad reply.
- Test the values of structured output against labels, because a valid object can be wrong.
```

Sources: capture/out/07-structured-output.txt, capture/out/08-structured-errors.txt, capture/s_agents.py; capture/lab/summary/structured-output-mac.json, capture/lab/T06-structured-output-mac/01-ollama-runs.jsonl, capture/lab/T06-structured-output-mac/02-d209-fake-and-stub.jsonl, capture/lab/T06-structured-output-mac/03-ollama-seq-n10.jsonl, capture/lab/T06-structured-output-mac/t06_run.py, capture/lab/T06-structured-output-mac/t06_schemas.py, capture/lab/T06-structured-output-mac/t06_d209.py; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/structured-output); libs/langchain_v1/langchain/agents/factory.py and libs/langchain_v1/langchain/agents/structured_output.py at langchain==1.5.0.
