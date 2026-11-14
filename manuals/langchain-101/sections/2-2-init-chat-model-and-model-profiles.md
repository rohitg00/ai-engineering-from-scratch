# init_chat_model and model profiles

> `init_chat_model` turns a `provider:model` string into a chat model of the provider package, and that package, not LangChain, decides how often a failed call is retried.

You pass `"qwen3:4b"` to `create_agent` and get a `ValueError` before the first request. Or you set a client timeout of 1 s, and a failed call returns after 16 s. Both come from how a model string resolves and which layer retries.

When you finish this section, you can write a model string that resolves and read the profile of a model. You can also count the attempts of one failed model call.

## Model strings

**Model string:** the text form of a model, such as `openai:gpt-4.1`, that `init_chat_model` and `create_agent` accept in place of a model object.

The documentation gives the form as the provider, a colon, and the model, such as `openai:o1` {{docs oss/python/langchain/models}}. `init_chat_model` splits the string at the first colon only when the part before it is one of 30 known providers {{code libs/langchain_v1/langchain/chat_models/base.py}}. It then imports the class from the provider package:

```listing
title: three model strings and the class each one built
source: capture/out/01-init-chat-model.txt
lang: text
note: Cut to the three result lines. The profiles between them are cut.
---
openai:gpt-4.1 -> langchain_openai.chat_models.base.ChatOpenAI
…
anthropic:claude-sonnet-4-6 -> langchain_anthropic.chat_models.ChatAnthropic
…
ollama:qwen3:4b -> langchain_ollama.chat_models.ChatOllama
```

With no known prefix, `init_chat_model` guesses the provider from the start of the name. `gpt-` and `o3` mean OpenAI, and `claude` means Anthropic. A name that matches no rule raises at once:

```listing
title: a name with no known provider
source: capture/out/01-init-chat-model.txt
lang: text
note: The list of providers and the help line are cut.
---
init_chat_model('qwen3:4b'):

raised builtins.ValueError: Unable to infer model provider for model='qwen3:4b'. Please specify 'model_provider' directly.
```

So `ollama:qwen3:4b` works and `qwen3:4b` does not. The colon inside an Ollama tag is part of the model name, because only the first colon splits. [Figure](#fig-2-2) draws the three paths.

```figure
id: fig-2-2
kind: decision
title: how init_chat_model resolves a model string
claim: A known prefix picks the provider, a known name start picks it next, and any other string raises ValueError before a request is sent.
caption: Read from the top. Each row is one test in the order the code runs it, with a string from the capture on the path it takes. From capture/out/01-init-chat-model.txt.
```

`init_chat_model` with no model and `configurable_fields` returns a `_ConfigurableModel`. Its model is chosen at run time from the config, under the prefix you give, such as `llm_model`.

## Model profiles

**Model profile:** a dict on `model.profile` with the limits and features of one model, such as its context size and whether it supports structured output.

The provider packages read profiles from data files inside each package. This is part of the profile of `gpt-4.1`:

```listing
title: part of the profile of openai:gpt-4.1
source: capture/out/01-init-chat-model.txt
lang: json
note: Cut to the size limits and four features.
---
  "max_input_tokens": 1047576,
  "max_output_tokens": 32768,
…
  "tool_calling": true,
  "structured_output": true,
…
  "tool_call_streaming": true,
…
  "mid_conversation_tools": false
```

The profile of `ollama:qwen3:4b` is `null`, and so is the profile of the fake model of the kit. Code that reads a profile must accept `None`. `create_agent` reads `structured_output` from it to choose a structured output strategy, which Part 3 explains.

## Retries

**Retry layer:** one piece of code that calls the model again after a failure. The client inside a provider package is one layer, and `ModelRetryMiddleware` is another.

The models page says that a chat model retries up to 6 times by default for network errors, 429, and 5xx {{docs oss/python/langchain/models}}. The retry middleware page says that its defaults make 3 attempts in total {{docs oss/python/langchain/middleware/built-in}}. We counted both at the pin.

**We measured** the attempts on the Mac, 3 runs for each cell. `ChatOpenAI` from `langchain-openai` 1.8.0 called a local stub that failed on a schedule. The counts were the same in all 3 runs. [Figure](#fig-2-2b) shows each run.

| Failure at the stub | Client default | Middleware only | Both layers |
|---|---|---|---|
| 429 on every call | 3 attempts, then `OpenAIRateLimitError` | 3 attempts, then an `AIMessage` | 9 attempts |
| 500 on every call | 3 attempts, then `OpenAIAPIError` | 3 attempts, then an `AIMessage` | 9 attempts |
| timeout on every call | 3 attempts, then `OpenAITimeoutError` | 3 attempts, then an `AIMessage` | 9 attempts |
| 400 on every call | 1 attempt, then `OpenAIInvalidRequestError` | 1 attempt | 1 attempt |

The client default made 3 attempts, which is 2 retries. `ChatOpenAI` leaves `max_retries` to the `openai` client, whose default is 2 {{code libs/partners/openai/langchain_openai/chat_models/base.py}}. The same 3 attempts came from `init_chat_model("openai:...")`. The 6 of the documentation did not hold for this package.

With both layers on, the layers multiply. Each of the 3 middleware attempts made 3 client attempts. The client timeout was 1 s and the stub slept 3 s. So the 9 attempts took 15.9 to 16.3 s across the 3 runs. With the middleware alone, the run did not raise. It ended with an `AIMessage` that said `Model call failed after 3 attempts with OpenAIRateLimitError`, because the default of `on_failure` is `continue`.

```figure
id: fig-2-2b
kind: chart
title: model attempts at the stub for one failing model call
claim: The client default and the middleware each made 3 attempts, and the two layers together made 9, in every run of every persistent failure.
caption: Each dot is one run, and each column is one configuration. The three rows are a persistent 429, 500, and timeout. A 400 made 1 attempt in every configuration and is not drawn. From capture/lab/summary/retries-mac.json.
```

A one-time 429, 500, or timeout recovered inside the client in every configuration, with 3 model attempts on the run. That count includes the tool step that came after it.

Choose one layer. Set `max_retries=0` on the model when you use `ModelRetryMiddleware`, or leave the middleware out. Then set your own timeout from the attempts that layer makes.

```takeaways
- Write a model string as provider:model, such as ollama:qwen3:4b.
- Check model.profile for None before you read a field of it.
- Count the retries of your own provider package, because the documented 6 did not hold for ChatOpenAI.
- Turn off client retries with max_retries=0 when you add ModelRetryMiddleware.
- Expect a 400 to fail at once in every configuration.
```

Sources: capture/out/01-init-chat-model.txt; capture/lab/summary/retries-mac.json, capture/lab/T05-retries-mac/01-model-faults.jsonl, capture/lab/T05-retries-mac/04-timeouts-arrival-count.jsonl; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/models, oss/python/langchain/middleware/built-in); libs/langchain_v1/langchain/chat_models/base.py at langchain==1.5.0; libs/partners/openai/langchain_openai/chat_models/base.py at langchain-openai==1.8.0.
