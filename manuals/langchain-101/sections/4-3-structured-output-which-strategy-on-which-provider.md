# Structured output: which strategy, on which provider

> On Qwen3 4B, ToolStrategy gave no object in 39 of 39 tasks and ProviderStrategy raised in 10 of 10, while an extraction call matched the best score on each model.

Your agent looks up a price, converts it, and must hand your code a number. You pass a Pydantic class as `response_format`, as the documentation shows. On Claude the number arrives. On a local model through Ollama, the same agent finishes every lookup and returns `structured_response=None`, or raises before it calls a tool.

When you finish this section, you can pick a structured output method for each provider from measured rates. You can also explain both Ollama failures from the code, and add the one extra call that works on both providers.

## The position

- **On Ollama, keep `response_format` out of an agent that has tools.** Run the agent to its final reply, then make one `with_structured_output` call on that reply.
- **On Claude, use `ProviderStrategy` or `ToolStrategy`.** They returned the right value in 39 of 39 and 38 of 39 tasks.
- **Never parse the free text with a pattern.** Claude Haiku 5.5 had the right value in its reply in 37 of 39 tasks. The last number of the reply was right in 15.

[Section 4.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) explains how each strategy works and how `AutoStrategy` picks one. This section measures them on real tasks with real lookups.

## The experiment

The bench ran the 20 chain tasks and the 19 SQL tasks of [the task suite](#s-do-you-need-langchain) through `create_agent`. Each task needs two to six lookups before the answer. The schema had one field:

```listing
title: the schema of every structured output run
source: capture/lab/bench/kit/structured.py
lang: python
---
class FinalAnswer(BaseModel):
    answer: str = Field(description="Only the final answer value: a number or a name, with no units and no explanation.")
```

The agent had the lookup tools of the family and no `submit_answer`. The system prompt asked it to finish with the final answer value. Four methods ran on the same tasks:

- **Free text:** no `response_format`. The kit took the last number of the final reply, or the whole reply for a name.
- **`ToolStrategy`:** `response_format=ToolStrategy(FinalAnswer)`.
- **`ProviderStrategy`:** `response_format=ProviderStrategy(FinalAnswer)`.
- **Extraction call:** no `response_format`. After the run, one more call of the same model, through `with_structured_output(FinalAnswer)`, read the question and the final reply.

A run counts as correct when the lookups ran with the right arguments and the structured value matched the truth.

**We measured** every row on the Mac: Qwen3 4B and Qwen3 8B on Ollama at temperature 0, and Claude Haiku 5.5 through the API. Each cell is one run per task, 39 tasks, except `ProviderStrategy` on Qwen3 4B, which ran 10. Qwen3 8B did not run `ProviderStrategy`. [Figure](#fig-4-3) shows every task.

```figure
id: fig-4-3
kind: chart
title: structured output, the answer of every task by method and model
claim: On Qwen3 4B both strategies returned no object, the extraction call kept every value the reply held, and on Claude all but free text worked.
caption: Each column is one task and each row is one model and method. Blue is a correct value, light rose a wrong value, an empty square no structured answer, and solid rose a raised error. From capture/lab/bench/summary-mac.json.
```

| Model | Free text | `ToolStrategy` | `ProviderStrategy` | Extraction call |
|---|---|---|---|---|
| Qwen3 4B | 25 of 39, 0.48 to 0.77 | 0 of 39, 0.00 to 0.09 | 0 of 10, 0.00 to 0.28 | 30 of 39, 0.62 to 0.87 |
| Qwen3 8B | 18 of 39, 0.32 to 0.61 | 14 of 39, 0.23 to 0.52 | not run | 26 of 39, 0.51 to 0.79 |
| Claude Haiku 5.5 | 15 of 39, 0.25 to 0.54 | 38 of 39, 0.87 to 1.00 | 39 of 39, 0.91 to 1.00 | 39 of 39, 0.91 to 1.00 |

The intervals are 95% Wilson intervals.

## Why ToolStrategy returns nothing on Ollama

`ToolStrategy` binds a tool named after the schema and asks for `tool_choice="any"`, so the model must call some tool. `ChatOllama.bind_tools` takes that argument and drops it, because Ollama has no such option {{code libs/partners/ollama/langchain_ollama/chat_models.py:1410-1431}}. Nothing forces the call of `FinalAnswer`.

So the model does what it does without a schema. It calls the lookups, then answers in text. A text reply with no tool call ends the agent loop, and `structured_response` stays `None`. No error tells you.

Qwen3 4B made every required lookup in 39 of 39 tasks and called `FinalAnswer` in none. Qwen3 8B called it in 14 of 39, and all 14 values were right. On Ollama, `AutoStrategy` resolves to `ToolStrategy`, as [section 4.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) shows. So the plain `response_format=FinalAnswer` gives the same result. On `claude-haiku-5-5` at the pin, `AutoStrategy` also resolves to `ToolStrategy`, as section 4.2 explains.

## Why ProviderStrategy raises on Ollama

`ProviderStrategy` sends the schema as the `format` of the Ollama request, next to the tools. The agent parses the reply as JSON only when the reply has no tool call {{code libs/langchain_v1/langchain/agents/factory.py:1260-1275}}. In all 10 runs on Qwen3 4B, the first reply had neither a tool call nor text:

```listing
title: the first and only model call of a ProviderStrategy run on Qwen3 4B
source: capture/lab/bench/runs/structured.jsonl
lang: json
note: One row, cut to the method, the call counts, the tokens, the time, and the error.
---
{"run_id": "bd6e197e", "ts": "2026-11-14T20:21:06", "task_id": "chain01", "family": "chain", "model": "qwen3:4b-instruct-2507-q4_K_M", "variant": "provider", "answer_present": false, …"lookups_ok": false, "model_calls": 1, "tool_calls": 0, "in_tokens": 682, "out_tokens": 1024, "wall_s": 38.814, …"final_text": "", "error": "StructuredOutputValidationError: Failed to parse structured output for tool 'FinalAnswer': Native structured output expected valid JSON for FinalAnswer, but parsing failed: Expecting value: line 1 column 1 (char 0).."}
```

Each of the 10 replies used all 1,024 output tokens that the kit allowed, in 18 to 43 s, and left empty content. The agent parsed the empty text and raised on the first call, before any lookup ran. With the schema as `format`, the model never wrote a tool call in our runs, so the task could not start.

Section 4.2 met the same error with one `add` tool. Here it happened on every task that needs a lookup.

## The extraction call

**Extraction call:** one call of `with_structured_output` after the agent run, which reads the question and the final reply and returns the schema.

```listing
title: the extraction call of the bench
source: capture/lab/bench/kit/structured.py
lang: python
note: The call and its two messages. The error handling around it is cut.
---
                            ex = model.with_structured_output(FinalAnswer).invoke(
                                [{"role": "system", "content": "Extract the final answer value from the assistant reply. Return only the value."},
                                 {"role": "user", "content": f"Question: {t['turns'][0]}\n\nAssistant reply: {ft}"}], config={"callbacks": [meter]})
```

The agent loop runs with no schema, so the model calls its tools as it would anyway. The second call has no tools, so `ChatOllama` can use the `format` of the request without a conflict.

On Qwen3 4B the extraction call was right in 30 of 39 tasks. The right value appeared somewhere in the final reply in exactly those 30. On Qwen3 8B the two counts were 26 and 26. So the extraction lost no answer that the agent had found, on either model. The other failures were wrong lookups or wrong arithmetic in the agent loop, and no output method can repair those.

On Claude Haiku 5.5 the extraction call was right in 39 of 39, the same as `ProviderStrategy`.

## Free text fails on Claude too

Claude Haiku 5.5 wrote the right value in its final reply in 37 of 39 tasks. The last number of the reply was right in 15. It states the answer first, then explains:

```listing
title: a correct reply whose last number is not the answer
source: capture/lab/bench/runs/structured.jsonl
lang: json
note: One row of the free text method, cut to the value the kit read, the truth, and the reply.
---
{"run_id": "d2c25350", "ts": "2026-11-15T11:40:49", …"value": "1.086957", "truth": 138.587, "correct": false, "correct_any_number_in_text": true, …"final_text": "The total for 3 trail lanterns is **$138.59 USD**. The unit price is \u20ac42.50, converted at 1 EUR = 1.086957 USD.", "error": null}
```

The last number is the exchange rate. On Qwen3 4B the same pattern was right in 25 of 39, while 30 replies held the value. A pattern loses answers on every model we ran.

## Cost and time

**We measured** the cost of the four methods on Claude Haiku 5.5 over the 39 tasks, at list price. The structured output runner of the kit added no prompt cache, so these numbers have no cache discount.

| Method on Claude Haiku 5.5 | Correct | Model calls, median | Cost of 39 tasks | Time per task, median |
|---|---|---|---|---|
| Free text | 15 | 4 | $0.0267 | 4.5 s |
| `ToolStrategy` | 38 | 4 | $0.0287 | 4.4 s |
| `ProviderStrategy` | 39 | 4 | $0.0284 | 5.0 s |
| Extraction call | 39 | 5 | $0.0307 | 4.3 s |

The extraction call cost 8% more than `ProviderStrategy`, for one more model call with a short prompt. On Qwen3 4B it took 9.3 s per task at the median, against 9.8 s for free text, because the short extraction call is fast.

## Which method, on which provider

| Provider | The agent has tools | Use | The number behind it |
|---|---|---|---|
| Ollama through `ChatOllama` | yes | the extraction call | 30 of 39 against 0 of 39 and 0 of 10 on Qwen3 4B |
| Ollama through `ChatOllama` | no | `ToolStrategy` or `ProviderStrategy`, with a limit on calls | [section 4.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) gives the failure rates per schema |
| Anthropic through `ChatAnthropic` | yes | `ProviderStrategy` or `ToolStrategy` | 39 and 38 of 39 on Claude Haiku 5.5 |
| Any provider | any | never a pattern on the free text | 15 of 39 on Claude Haiku 5.5 |

Test the provider you run in production. These results hold for `langchain` 1.5.0, `langchain-ollama` 1.1.0, and `langchain-anthropic` 1.7.10.

```takeaways
- Leave response_format off an agent with tools on ChatOllama, and add one extraction call after the run.
- Check structured_response for None after every run, because ToolStrategy on Ollama fails without an error.
- Use ProviderStrategy or ToolStrategy on Claude, where both returned the right value in 38 or more of 39 tasks.
- Parse answers with a schema call, never with a pattern on the reply.
```

Sources: capture/lab/bench/summary-mac.json, capture/lab/bench/summarize.py, capture/lab/bench/runs/structured.jsonl, capture/lab/bench/runs/cost-ledger.jsonl, capture/lab/bench/kit/structured.py, capture/lab/bench/kit/harnesses.py, capture/lab/bench/data/tasks.jsonl; libs/partners/ollama/langchain_ollama/chat_models.py at langchain-ollama 1.1.0; libs/langchain_v1/langchain/agents/factory.py and libs/langchain_v1/langchain/agents/structured_output.py at langchain==1.5.0; libs/partners/anthropic/langchain_anthropic/chat_models.py at langchain-anthropic 1.7.10.
