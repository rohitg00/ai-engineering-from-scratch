# Many tools and the tool selector

> Claude Haiku 5.5 passed 10 of 10 at 100 tools, LLMToolSelectorMiddleware doubled its calls and cost, and the selector cut Qwen3 4B to 1 of 10 at every size.

Your agent has grown to 60 tools, one for each internal API. Someone reads that a long tool list confuses the model, and adds `LLMToolSelectorMiddleware` to send only the relevant few. The idea sounds safe: a smaller list, fewer tokens, fewer wrong calls. We measured it, and it was not safe on either provider.

When you finish this section, you can predict how pass rate, tokens, time, and dollars move as you add tools. You can also explain from the code why the selector fails at `langchain` 1.5.0, and decide what to do with a long tool list.

## The position

- **Bind all your tools to a frontier model.** Claude Haiku 5.5 passed 10 of 10 tasks at 5, 20, 50, and 100 tools, and made one distractor call in 40 runs.
- **Turn on prompt caching, because the tool list is the cost.** At 100 tools the median run sent 44,645 prompt tokens, and the cache cut the bill to 36% of list price.
- **Leave `LLMToolSelectorMiddleware` out at `langchain` 1.5.0.** Its selection request carries no tool description in its messages. On Claude it doubled calls, time, and dollars and gained nothing. On Qwen3 4B it cut the passes to 1 of 10 at every size.
- **On a small local model, keep the list short.** Qwen3 8B fell from 5 to 0 of 10 between 5 and 50 tools. Qwen3 4B held 5 of 10 at 100 tools, but a median run took 53 s.

## The experiment

**Distractor tool:** a tool that a task does not need, with a plausible name and description, such as `get_item_price_history`, `search_catalog`, or `get_delivery_estimate`. The bench has 95 of them. One is a deprecated currency converter whose description says not to use it.

The bench ran 10 chain tasks, `chain01` to `chain19` with odd numbers, through `create_agent`. Each task needs `get_item_info` and two to four other lookups. The agent got the 5 lookup tools, `submit_answer`, and enough distractors to reach 5, 20, 50, or 100 tools in all, not counting `submit_answer`. The order of the tools was shuffled with a fixed seed for each task and size.

Three settings ran at each size:

- **No selector:** every tool bound on every call.
- **Selector:** `LLMToolSelectorMiddleware` with the agent model, `max_tools=6`, and `always_include=["submit_answer"]`, with its default prompt.
- **Selector with a list:** the same, with our own `system_prompt` that adds the name and description of every tool. Only the Qwen3 models ran it.

**We measured** every run on the Mac. Qwen3 4B ran at the four sizes and Qwen3 8B at 5 and 50 tools, on Ollama at temperature 0. Claude Haiku 5.5 ran at the four sizes through the API. Each cell is the 10 tasks, once each.

A pass here is the lenient pass of the checker. A strict pass, which also needs `submit_answer`, was 0 to 2 of 10 in the Qwen3 cells. [Figure](#fig-4-4) shows every run.

```figure
id: fig-4-4
kind: chart
title: ten chain tasks at four tool counts, with and without the selector
claim: Without the selector Claude passed 40 of 40 runs, and with the default selector Qwen3 passed at most 2 of 10 in any cell.
caption: Each square is one run of one task. Blue and plum are passes. Solid rose is a distractor call or no item lookup, light rose another failure, and black a raised run. The number after each group counts passes of 10. From capture/lab/bench/summary-mac.json.
```

| Model and setting | 5 tools | 20 tools | 50 tools | 100 tools |
|---|---|---|---|---|
| Claude Haiku 5.5, no selector | 10 | 10 | 10 | 10 |
| Claude Haiku 5.5, selector | 10 | 10 | 10 | 9 |
| Qwen3 4B, no selector | 5 | 6 | 5 | 5 |
| Qwen3 4B, selector | 1 | 1 | 1 | 1 |
| Qwen3 4B, selector with a list | 3 | 2 | 4 | 2 |
| Qwen3 8B, no selector | 5 | not run | 0 | not run |
| Qwen3 8B, selector | 2 | not run | 2 | not run |
| Qwen3 8B, selector with a list | 3 | not run | 3 | not run |

With 10 runs per cell, a 95% Wilson interval is wide. It spans 0.24 to 0.76 for 5 of 10, and 0.02 to 0.40 for 1 of 10. So read the sizes together. Over the four sizes, Qwen3 4B passed 21 of 40 without the selector and 4 of 40 with it. The intervals are 0.37 to 0.67 and 0.04 to 0.23.

One cell went the other way. Qwen3 8B at 50 tools passed 0 of 10 without the selector and 2 with it. Without it, the model made 31 distractor calls in those 10 runs.

The selector hurt even at 5 tools, where it had nothing to remove. Qwen3 8B with the selector never called `get_item_info` in 7 of 10 runs. Without the selector it called it in every run, so the selector most likely dropped it.

## What the selector sends

`LLMToolSelectorMiddleware` runs in `wrap_model_call`, before every model call of the agent. It builds a request of two messages: its system prompt with a note about `max_tools`, and the last user message {{code libs/langchain_v1/langchain/agents/middleware/tool_selection.py:402-405}}. It asks for structured output whose schema lists each tool name as a literal value with the tool description as a field description {{code libs/langchain_v1/langchain/agents/middleware/tool_selection.py:63-94}}.

So the messages hold no tool list. The module has a function that renders each name with its description, and nothing at 1.5.0 calls it {{code libs/langchain_v1/langchain/agents/middleware/tool_selection.py:109-118}}. The descriptions reach the model only if the provider shows the field descriptions of a schema to the model.

The two providers do this differently. `ChatAnthropic` turns a schema into a tool by default {{code libs/partners/anthropic/langchain_anthropic/chat_models.py:2880-2890}}, so Claude reads the descriptions as part of a tool definition. `ChatOllama` sends the schema as the `format` of the request {{code libs/partners/ollama/langchain_ollama/chat_models.py}}. On Qwen3 the selection looked like a choice from names alone:

- At 20 tools, Qwen3 4B never called `get_item_info` in 8 of 10 runs. It called tools such as `search_catalog` and `get_item_price_history` in its place.
- With our list in the system prompt, it made no distractor call in the 10 runs at 20 tools. It still passed only 2. Five answers were wrong, and three runs wrote a tool call as text.

The selector also sees only the last user message. It never sees a tool result, so it cannot add a tool that the agent needs only after the first lookup.

## A selection that ends the run

When the selection names a tool that does not exist, the middleware raises `ValueError` {{code libs/langchain_v1/langchain/agents/middleware/tool_selection.py:311-328}}. The `on_parsing_failure` parameter does not apply here. It handles a reply that is not a list of names, and an unknown name is a valid list {{code libs/langchain_v1/langchain/agents/middleware/tool_selection.py:346-372}}.

Claude Haiku 5.5 at 100 tools had already submitted the right answer when the next selection named a tool that the agent did not have:

```listing
title: a run that found the answer, then raised in the selector
source: capture/lab/bench/runs/toolscale.jsonl
lang: json
note: One row, cut to the checks, the error, the answer, and the tool calls.
---
{"run_id": "e08495cc", "tag": "toolscale", "ts": "2026-11-15T12:04:50", "task_id": "chain17", …"n_tools": 101, "passed": false, …"checks": {"get_item_info(trail lantern)": true, "get_item_info(camp stove)": true, "answer_submitted": true, "answer_correct": true}, "category": "harness_error", "detail": "ValueError: Model selected invalid tools: ['get_item_weight']", "answer": "camp stove", …"tool_seq": ["get_item_info", "get_item_info", "get_exchange_rate", "submit_answer"], …}
```

The exception ended the run, so its caller got an error in place of a finished task. Qwen3 4B raised the same way twice, at 50 and 100 tools, with an empty string as the tool name.

## Tokens, time, and dollars

**We measured** the prompt tokens of every run, with the selector calls included. [Figure](#fig-4-4b) shows each run.

```figure
id: fig-4-4b
kind: chart
title: prompt tokens of each run against the number of tools
claim: Prompt tokens grew six times from 5 to 100 tools on Claude, and the selector cut them while it doubled the calls and, with caching, the dollars.
caption: Each dot is one run, on a log scale, and each line joins the medians. Blue is no selector and plum is the selector. The tables give the billed dollars of the 10 Claude runs and the median seconds of the Qwen3 4B runs. From capture/lab/bench/summary-mac.json.
```

On Claude Haiku 5.5 without the selector, the median run sent 7,380 prompt tokens at 5 tools and 44,645 at 100. Each tool schema adds to every call. The selector cut the median to 33,277 at 100 tools, and raised it at 5 tools. Each run with it made 9 or 10 model calls, against 4.5 to 5.

The selector doubled the time of a run: 10.2 to 12.6 s at the median, against 5.0 to 5.9 s. It also doubled the bill. At 100 tools the 10 runs cost $0.016 without the selector and $0.033 with it.

The cache explains the bill. Without the selector, the 10 runs at 100 tools were billed 36% of their list price. With it, they were billed 87%. Our reading is that the selection changes the tool list of every request, and the tools come first in the prefix that the cache matches. At list price with no cache, the selector would have saved 15% at 100 tools and cost more at 5 and 20.

On Qwen3 4B the selector did save time. Without it, a run at 100 tools took 53 s at the median, against 8 s at 5 tools. Ollama read 29,000 prompt tokens in that run. With the selector a run took 6 to 18 s. It also failed 9 of 10 times.

## What to do with a long tool list

| Situation | Do this | The number behind it |
|---|---|---|
| Claude Haiku 5.5, up to 100 tools | bind them all, with prompt caching on | 40 of 40 runs, $0.016 for 10 runs at 100 tools |
| A small local model | keep the list near the tools the task needs | Qwen3 8B 5 of 10 at 5 tools, 0 of 10 at 50 |
| You still want `LLMToolSelectorMiddleware` | pass a `system_prompt` that lists each name and description, and handle `ValueError` around the run | 2 to 4 of 10 with a list, against 1 of 10 without |
| You know the task type before the run | choose the tools in your own code and bind only those | we did not measure this, and it adds no model call |

```takeaways
- Bind every tool to a frontier model, and turn on prompt caching for the tool schemas.
- Keep LLMToolSelectorMiddleware out of production at langchain 1.5.0.
- Add a tool description list to the selector prompt if you use the selector anyway.
- Handle ValueError around a run with the selector, because an unknown tool name ends the run.
- Measure the time per run on a local model before you add tools, because prompt reading dominates it.
```

Sources: capture/lab/bench/summary-mac.json, capture/lab/bench/summarize.py, capture/lab/bench/runs/toolscale.jsonl, capture/lab/bench/runs/cost-ledger.jsonl, capture/lab/bench/kit/toolscale.py, capture/lab/bench/kit/run.py, capture/lab/bench/kit/harnesses.py; libs/langchain_v1/langchain/agents/middleware/tool_selection.py at langchain==1.5.0; libs/partners/ollama/langchain_ollama/chat_models.py at langchain-ollama 1.1.0; libs/partners/anthropic/langchain_anthropic/chat_models.py at langchain-anthropic 1.7.10.
