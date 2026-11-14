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

`AutoStrategy` picks `ProviderStrategy` when the model profile says `structured_output` is true. A Gemini model before the 3 series is the exception when the agent has tools. In every other case, it checks the model name against a fixed list, such as `gpt-4o`, `gpt-4.1`, and some Claude models. When no name matches, it picks `ToolStrategy` {{code libs/langchain_v1/langchain/agents/factory.py:581-626}}. [Figure](#fig-3-2) draws the choice.

```figure
id: fig-3-2
kind: decision
title: which strategy runs, and how it fails
claim: An explicit strategy is never changed, and AutoStrategy chooses before each call from the profile or the name, so no failure moves a run to the other.
caption: Read from the top. The amber boxes are choices that create_agent makes before the request. The rose boxes are the failures each strategy ends in. From capture/out/07-structured-output.txt, capture/out/08-structured-errors.txt, and capture/lab/summary/structured-output-mac.json.
```

The kit runs the same schema on two `ChatOllama` models with no tools of their own. The first has no profile, and the agent binds a tool named after the schema:

```listing
title: a plain schema on a model with no profile
source: capture/out/07-structured-output.txt
lang: json
note: The first model call, cut to its messages and bound tools.
---
    "messages": [
      "human: What is 2 + 3?"
    ],
    "tools": [
      "Answer"
    ]
```

The agent also asks for `tool_choice="any"`. `ChatOllama.bind_tools` drops that argument, because Ollama has no such option {{code libs/partners/ollama/langchain_ollama/chat_models.py}}. So on Ollama nothing forces the call of the schema tool. Here the model called `Answer` anyway, with `value` 5.

The second model has the profile `{"structured_output": True}`. The agent binds no schema tool and passes `response_format`, which `ChatOllama` sends to Ollama as a JSON schema format:

```listing
title: a plain schema on a model whose profile says structured_output
source: capture/out/07-structured-output.txt
lang: json
note: The first model call, cut to its messages and its format.
---
    "messages": [
      "human: What is 2 + 3?"
    ],
    "format": "json schema"
```

The reply was the text `{"value": 5}`, and the agent filled `unit` from its default.

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
      "Answer",
      "Refusal"
    ]
```

A `TypedDict` gives back a `dict`, and a dataclass gives back an instance of it. A JSON schema `dict` gives back the arguments with no validation {{code libs/langchain_v1/langchain/agents/structured_output.py}}. The kit asked for the value as an English word, to send a string to an integer field. Qwen3 4B sent the number anyway:

```listing
title: the JSON schema run
source: capture/out/07-structured-output.txt
lang: text
note: The structured_response of the JSON schema run.
---
structured_response:
{
  "value": 5
}
```

When the arguments fail validation, `ToolStrategy` writes the error into a `ToolMessage` and calls the model again. The message ends with `Please fix your mistakes.` {{code libs/langchain_v1/langchain/agents/structured_output.py}}. Our model never sent an invalid value. Asked to put 3.5 into the integer field `value`, it sent `value` 3 and `unit` `"5"`, which is valid.

Two structured tool calls in one AI message get the same kind of retry. The kit asked for `Answer` and `Refusal` in one reply, and the model sent both:

```listing
title: the retry message after two structured calls
source: capture/out/08-structured-errors.txt
lang: json
note: The first of the two ToolMessages. The second has the same text.
---
    "content": "Error: Model incorrectly returned multiple structured responses (Answer, Refusal) when only one is expected.\n Please fix your mistakes.",
    "name": "Answer",
…
    "status": "success"
```

The model then sent one `Answer` call, and the run ended with `value` 5. The `status` of each retry message is `success`, though it carries an error. Code that counts error `ToolMessage` objects does not count these retries.

**handle_errors:** the `ToolStrategy` parameter that sets the retry. `True`, the default, retries on every parse error. A string replaces the retry text. An exception type or a tuple retries only those errors. A callable gets the error and returns the retry text. `False` raises `StructuredOutputValidationError` on the first bad call {{code libs/langchain_v1/langchain/agents/structured_output.py}}.

## ProviderStrategy

`ProviderStrategy` sends the schema to the provider and reads the text of the reply as JSON. When the text is not JSON, or fails validation, the run raises on the first call.

On Ollama the schema becomes the format of the request, and the reply must fit it. The kit asked for a word, for 3.5, and for one plain English sentence. Each time the model returned valid JSON, such as `{ "value": 5 }`. The failure came from a tool. With `add` bound, the reply had no text, and the agent parsed the empty content as JSON:

```listing
title: ProviderStrategy with the add tool bound
source: capture/out/07-structured-output.txt
lang: text
---
raised langchain.agents.structured_output.StructuredOutputValidationError: Failed to parse structured output for tool 'Answer': Native structured output expected valid JSON for Answer, but parsing failed: Expecting value: line 1 column 1 (char 0)..
```

A union does not get that far. `ProviderStrategy(Union[Refund, Exchange])` raised `ValueError: Unsupported schema type` when the strategy was built, before `create_agent` ran, in every run we made {{code libs/langchain_v1/langchain/agents/structured_output.py:180-194}}.

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

`handle_errors=True` has no retry count. With `tools=[]`, the agent graph has a `model` to `model` edge that loops until a structured response exists. Only the recursion limit stops it, and the agent default is 9999 steps. In the lab, a fake that answered in plain text made 12 model calls under `recursion_limit=12`, and raised `GraphRecursionError`.

The kit ran into this loop with Qwen3 4B. With a `TypedDict` and with a dataclass, the model answered `2 + 3 = 5.` in text, twice. The agent sent the third request with two AI messages at the end, and Ollama refused it:

```listing
title: the third request of the TypedDict run
source: capture/out/07-structured-output.txt
lang: text
note: The error, then the messages of the third model call.
---
raised ollama._types.ResponseError: {"error":{"code":400,"message":"Cannot have 2 or more assistant messages at the end of the list.","type":"invalid_request_error"}} (status code: 400)
…
    "call": 3,
    "messages": [
      "human: What is 2 + 3?",
      "ai: 2 + 3 = 5.",
      "ai: 2 + 3 = 5."
    ],
```

With at least one tool of your own, a plain text answer ends the run. With `add` bound, the model called `add`, then answered in text. `structured_response` was `None` after two model calls, with no exception. Check `structured_response` for `None` after every run.

## Failure rates on four model sizes

**We measured** each strategy on the Mac with four Qwen3 models on Ollama, with thinking off and temperature 0. The agent had no tools and a limit of 10 model calls per run. Four schemas: flat, nested, a union, and two enums. Each model and schema had 20 inputs on the 0.6B model and 10 on the others, so 600 runs in all.

`AutoStrategy` and `ToolStrategy` were the same configuration on Ollama, and their runs gave the same outcomes. A run failed when it raised or returned no `structured_response`:

| Model | `ToolStrategy` failed | `ProviderStrategy` failed | `ProviderStrategy` without the union |
|---|---|---|---|
| `qwen3:0.6b` | 36 of 80, 45% | 20 of 80, 25% | 0 of 60 |
| `qwen3:1.7b` | 6 of 40, 15% | 10 of 40, 25% | 0 of 30 |
| `qwen3:4b-instruct` | 11 of 40, 27.5% | 13 of 40, 32.5% | 3 of 30 |
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

The structured output page calls `ProviderStrategy` the most reliable method when it is available {{docs oss/python/langchain/structured-output}}. On the nested schema it gave more valid objects than `ToolStrategy` on three models, and tied on the 1.7B model. On the enum schema it gave more on the 0.6B and 1.7B models, and tied on the 4B and 8B models. It cannot take a union, and it never retries.

## Valid is not correct

A valid object matches the schema. It can still hold the wrong values. In the enum schema, the model chose a priority and a category for a support ticket. Look at the `ProviderStrategy` runs with a `structured_response`, from the smallest model to the largest. The values agreed with our labels in 4 of 20, 3 of 10, 4 of 7, and 4 of 10. Our labels are judgement calls, so read this as agreement with one reader.

```takeaways
- Choose ToolStrategy or ProviderStrategy explicitly, because AutoStrategy reads only the profile and the model name.
- Use ToolStrategy for a union, because ProviderStrategy rejects it when you build the strategy.
- Set recursion_limit on runs with ToolStrategy, because handle_errors=True retries without a count.
- Check structured_response for None after each run that has tools.
- Wrap ProviderStrategy runs in your own retry, because it raises on the first bad reply.
- Test the values of structured output against labels, because a valid object can be wrong.
```

Sources: capture/out/07-structured-output.txt, capture/out/08-structured-errors.txt, capture/s_agents.py; libs/partners/ollama/langchain_ollama/chat_models.py at langchain-ollama 1.1.0; capture/lab/summary/structured-output-mac.json, capture/lab/T06-structured-output-mac/01-ollama-runs.jsonl, capture/lab/T06-structured-output-mac/02-d209-fake-and-stub.jsonl, capture/lab/T06-structured-output-mac/03-ollama-seq-n10.jsonl, capture/lab/T06-structured-output-mac/t06_run.py, capture/lab/T06-structured-output-mac/t06_schemas.py, capture/lab/T06-structured-output-mac/t06_d209.py; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/structured-output); libs/langchain_v1/langchain/agents/factory.py and libs/langchain_v1/langchain/agents/structured_output.py at langchain==1.5.0.
