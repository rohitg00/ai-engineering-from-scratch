# Do you need LangChain? Four harnesses on one task suite

> Three harnesses gave identical runs on 60 of 60 local tasks, Claude passed every task it ran, and only the deep agent on small local models lost tasks.

You have a tool loop of about 40 lines around a provider SDK, and it works. A teammate wants to move it to `create_agent`, and another wants Deep Agents. Both say the agent will get better. Nobody has a number, because nobody ran the same tasks through each choice.

We did. When you finish this section, you can say what a harness changes in an agent run and what it does not. You can also choose between a plain loop, `create_agent`, a hand-built `StateGraph`, and Deep Agents from measured pass rates, time, tokens, and dollars.

## The position

- **The harness does not decide quality. The model does.** A plain loop, `create_agent`, and a hand-built `StateGraph` gave the same outcome on every task they shared, on two models.
- **The frontier model does not care which harness runs it.** Claude Haiku 5.5 passed 99 of 99 tasks with a plain loop and 99 of 99 as a deep agent.
- **A small local model does care, and Deep Agents is the harness that hurts it.** Qwen3 4B passed 70 of 99 with a plain loop and 55 of 99 as a deep agent.
- **The framework time is noise next to the model.** Its median was 5 to 91 ms per task across all models and harnesses. The first chart shows Qwen3 4B and Haiku only, where the medians run 6 to 67 ms. It took under 1.7% of the task time in every cell.
- **Choose a harness for what it does around the model.** Persistence, streaming, approvals, and planning tools are the reasons. Quality is not one of them.

## The suite: 99 tasks, and checkers that read state

**Task suite:** the 99 tasks of the bench kit, in five families of 20, one of which has 19. Each task gives the agent a set of tools and one or more user turns. A checker then reads what the tools changed.

| Family | Tasks | Tools the agent gets | What the checker reads |
|---|---|---|---|
| chain | 20 | item lookup, exchange rate, carrier rate, unit conversion, calculator, `submit_answer` | the lookups made with the right item, and the submitted number |
| sql | 19 | list tables, describe, a read-only `SELECT`, calculator, `submit_answer` | the query tool used, a database hash that did not change, and the answer |
| retrieval | 20 | keyword search over 26 local documents, read one document, `submit_answer` | the supporting document opened, and the answer |
| files | 20 | list, read, write, rename, and delete in a task folder | every file in the folder, byte for byte, after the run |
| multiturn | 20 | a notes store with set, get, delete, and list, a calculator, an exchange rate | every key and value in the store after the last turn, and the answer when one is asked |

The tasks are generated from fixed data: a catalog of 12 items, a SQLite shop with 240 orders, and a set of invented documents. A script checks that the right sequence of tool calls passes every task, and that an agent with no tool calls fails every task.

We dropped one task, `sql19`, from every table in this manual. It asks which category has the most products, and two categories have 5 each. The checker accepted only one of them, so a correct answer could fail.

A checker that reads only the final text would pass runs that did the wrong thing. In task `multi13`, the user gives three numbers over three turns and asks for their sum times 3 in the notes. Qwen3 8B said it saved the result:

```listing
title: a run that says it saved the result, and the store after it
source: capture/lab/bench/runs/main.jsonl
lang: json
note: One row of Qwen3 8B with the plain loop, cut to the outcome, the tool calls, the final text, and the store. The expected value is 150.
---
{"run_id": "724bfc7f", "tag": "main", "ts": "2026-11-14T22:54:10", "task_id": "multi13", "family": "multiturn", "harness": "plain", "model": "qwen3:8b", …"passed": false, …"checks": {"kv_state": false}, "category": "wrong_final_state", …"tool_seq": ["kv_set"], "final_text": "The result has been saved under the key 'result' in your notes.", …"final_state": {"result": "129"}}
```

The sum of 17, 25, and 8 is 50, and the result is 150. The model saved 129. Its reply is true about the action and wrong about the value, and only the store shows it.

**Pass:** the checks of a task hold at the end of the run. A question counts as answered when `submit_answer` got the right value. It also counts when the final text holds the value and no tool call is written out as text.

**Strict pass:** a pass where the answer also came through `submit_answer`. Qwen3 4B with the plain loop passed 70 of 99 tasks and 20 strictly. It often wrote the right number in the reply and never called the tool. Claude Haiku 5.5 called it every time.

## Four harnesses, one prompt

Each harness got the same system prompt, the same tools, and a limit of 10 model calls per user turn.

- **Plain loop:** our own loop on `bind_tools`. It calls the model, runs each tool call, appends a `ToolMessage`, and stops when the model asks for no tool. It is 27 lines in the kit.
- **`create_agent`:** the agent of `langchain` 1.5.0 with `InMemorySaver`.
- **Hand-built `StateGraph`:** a model node, a `ToolNode`, and `tools_condition` from `langgraph` 1.2.22, with `InMemorySaver`. It is the graph that `create_agent` builds, written by hand.
- **Deep agent:** `create_deep_agent` from `deepagents` 0.7.38 with its default backend and our tools. It adds file tools, a `task` tool, and its middleware stack, as [section 7.4](#s-deep-agents-0-7) shows.

The local models ran on Ollama at temperature 0 and seed 42. Claude takes no temperature for these models, so the kit sent none and ran each task once. On Claude, the plain loop marked its system prompt for the prompt cache. The deep agent adds a caching middleware of its own.

## Results

**We measured** every row on the Mac. The local models ran on Ollama there, and Claude ran through the Anthropic API from the same Mac. Qwen3 4B, Qwen3 8B, and Claude Haiku 5.5 ran all 99 tasks. The other models ran a stratified subset of 30 tasks, six from each family. Every cell is one run per task, and the interval is a 95% Wilson interval.

```figure
id: fig-1-2
kind: chart
title: the outcome of every task, for each model and harness
claim: Plain loop, create_agent, and StateGraph rows match task for task, Claude passes everything in both harnesses, and the deep agent loses tasks only on local models.
caption: Each column is one task, grouped by family, and each row is one model and harness. A filled square is a pass in the colour of the harness layer, and a rose square is a fail. Rows with 30 tasks ran the subset, so their other columns are blank. From capture/lab/bench/summary-mac.json.
```

| Model | Tasks | Plain loop | `create_agent` | `StateGraph` | Deep agent |
|---|---|---|---|---|---|
| Claude Haiku 5.5 | 99 | 99, 0.96 to 1.00 | not run | not run | 99, 0.96 to 1.00 |
| Qwen3 8B | 99 | 74, 0.65 to 0.82 | not run | not run | 58, 0.49 to 0.68 |
| Qwen3 4B | 99 | 70, 0.61 to 0.79 | not run | not run | 55, 0.46 to 0.65 |
| Claude Sonnet 5.5 | 30 | 30, 0.89 to 1.00 | not run | not run | 30, 0.89 to 1.00 |
| gpt-oss 20B | 30 | 28, 0.79 to 0.98 | not run | not run | 24, 0.63 to 0.91 |
| Qwen3 14B | 30 | 26, 0.70 to 0.95 | not run | not run | 24, 0.63 to 0.91 |
| Qwen3 4B | 30 | 23, 0.59 to 0.88 | 23 | 23 | 13, 0.27 to 0.61 |
| Qwen3 8B | 30 | 18, 0.42 to 0.75 | 18 | 18 | 16, 0.36 to 0.70 |
| Qwen3 30B-A3B, thinking on | 30 | 15, 0.33 to 0.67 | not run | not run | 15, 0.33 to 0.67 |

### Three harnesses, one set of requests

On Qwen3 4B and Qwen3 8B, the plain loop, `create_agent`, and the `StateGraph` gave the same outcome on 30 of 30 tasks each. They also gave the same final text, the same tool calls, and the same token counts. The kit kept the prompt tokens of each call for 42 of those task pairs, and all 198 calls matched.

With greedy decoding, the same output means the model saw the same request. So `create_agent` and LangGraph add no hidden prompt, no extra tool, and no reordering. [Section 8.3](#s-cost-the-framework-against-a-plain-sdk-loop) found the same prompt tokens with a proxy.

### Deep Agents: equal on Claude, worse on small models

On Claude Haiku 5.5 the plain loop and the deep agent agreed on 99 of 99 tasks. On Claude Sonnet 5.5 they agreed on 30 of 30. The suite cannot separate them there, because both pass everything.

On Qwen3 4B they agreed on 42 of 99 tasks. The plain loop alone passed 36, and the deep agent alone passed 21. On Qwen3 8B they agreed on 73, with 21 and 5. All of the loss is in two families:

| Family | Qwen3 4B plain | Qwen3 4B deep | Qwen3 8B plain | Qwen3 8B deep |
|---|---|---|---|---|
| files | 16 of 20 | 2 of 20 | 17 of 20 | 5 of 20 |
| retrieval | 15 of 20 | 7 of 20 | 13 of 20 | 6 of 20 |
| the other 59 tasks | 39 | 46 | 44 | 47 |

The file loss comes from the default backend of Deep Agents, whose file tools write to the agent state and not to the disk. [Section 7.4](#s-deep-agents-0-7) shows each of those runs. In retrieval, the 4B deep agent answered 6 of 20 questions with no tool call and said that it had no access to the data. The plain loop did that in none. On the other 59 tasks the deep agent passed more: 46 against 39 on Qwen3 4B, and 47 against 44 on Qwen3 8B.

### Three more settings and the Claude Agent SDK

We ran more variants after the first bench. [Section 7.4](#s-deep-agents-0-7) gives the details. A harness profile hides the built-in file tools. It left the deep agent on Qwen3 4B at 55 of 99. It raised the deep agent on Qwen3 8B from 58 to 63. The plain loop passed 70 and 74. 

The eval tool of `langchain-quickjs` gave no gain on four models. [Section 4.6](#s-the-built-in-middleware) measures a grader middleware.

**We measured** the Claude Agent SDK 0.2.182, with its bundled Claude Code CLI 2.1.325, against the deep agent on the 30-task subset. Both ran Claude Haiku 5.5 on the Mac with the same five task tools, one run per task. The SDK got the tools through an in-process MCP server. [Figure](#fig-1-2c) shows the two.

```figure
id: fig-1-2c
kind: chart
title: the Claude Agent SDK and Deep Agents on the same 30 tasks
claim: Both harnesses passed 30 of 30 tasks on Haiku, and the SDK read 9.3k input tokens for a task against 23.7k for the deep agent.
caption: The top rows give the pass count, the median model calls, the median input tokens, and the dollars of the 30 tasks. Each dot below is one task. Counts are as each harness reported them. From capture/lab/summary/multiagent-mac.json.
```

The two harnesses gave the same outcome on 30 of 30 tasks, so the suite cannot rank them on quality. The 30 tasks cost $0.0168 as a deep agent and $0.0139 with the SDK, using the cost that each one reported.

### The model sets the score

On the 30-task subset with the plain loop, the five local models passed from 15 to 28 tasks, and both Claude models passed 30. On one model, the three plain harnesses moved the score by 0 tasks. Spend your effort on the model before the harness.

Model size alone does not order the local models. Qwen3 4B Instruct passed 23 of the subset and Qwen3 8B passed 18, but on all 99 tasks they passed 70 and 74. Their intervals overlap. Qwen3 30B-A3B ran with thinking on, and it wrote a tool call as text in 10 of its 15 plain loop failures.

## Time and tokens

**Framework time:** the wall time of a task minus the time inside the model calls and the tool functions. It holds the loop, the graph, the checkpointer, and the middleware.

**We measured** the framework time of every task on the Mac. [Figure](#fig-1-2b) shows each task.

```figure
id: fig-1-2b
kind: chart
title: time outside the model, and the prompt tokens of a deep agent
claim: The framework took 6 to 67 ms per task at the median against seconds of model time, and a deep agent sent 3.6 to 4.3 times the tokens.
caption: Left, each dot is one task, on a log scale, and the black line is the median. Right, each dot is one task: the prompt tokens of the deep agent over those of the plain loop. The black line is the ratio of the sums. From capture/lab/bench/summary-mac.json.
```

On the 30-task subset with Qwen3 4B, the plain loop took 6.2 ms at the median and `create_agent` 22.5 ms. The `StateGraph` took 18.5 ms, and the deep agent 55.2 ms. The model took 9.7 s per task for the plain loop. With Claude Haiku 5.5 on 99 tasks, the median was 8.4 ms plain and 66.5 ms deep, against 5.0 s of model time.

As a share of the wall time, the framework took under 0.5% in every local cell. On Claude it took 0.24% for the plain loop and 1.43% for the deep agent, because a hosted model answers faster. On Claude Sonnet 5.5 the deep agent median was 90.8 ms. Over 498 model calls, the deep agent on Haiku spent about 14 ms per call more than the plain loop.

The deep agent sent more tokens on every model. Over the tasks that both harnesses ran, it sent 3.6 to 4.3 times the prompt tokens of the plain loop. The cause is the schemas of its own tools on every call. On Qwen3 4B and 8B, gpt-oss, and Claude, its median call count matched the plain loop: 4 locally and 5 on Claude. On Qwen3 14B the plain loop made 5 and the deep agent 4. On the 30B model the plain loop made 3.5 and the deep agent 4.

On a local model those tokens cost time. On Qwen3 4B the median task took 22.6 s as a deep agent and 9.1 s with the plain loop.

## Cost

**We measured** the dollars of every Claude call from the usage that the API returned, at the list prices of 2026-11-14. Claude Haiku 5.5 costs $0.10 per million input tokens and $0.50 per million output tokens. Claude Sonnet 5.5 costs $2 and $10.

| Model and harness | Tasks | Billed | Per task | At list price with no cache |
|---|---|---|---|---|
| Claude Haiku 5.5, plain loop | 99 | $0.045 | $0.00045 | $0.085 |
| Claude Haiku 5.5, deep agent | 99 | $0.052 | $0.00053 | $0.264 |
| Claude Sonnet 5.5, plain loop | 30 | $0.263 | $0.0088 | $0.507 |
| Claude Sonnet 5.5, deep agent | 30 | $0.327 | $0.0109 | $1.591 |

Prompt caching closes most of the token gap. The deep agent cost 1.16 times the plain loop on Haiku and 1.24 times on Sonnet. At list price with no cache, it would cost 3.10 and 3.14 times. [Section 7.4](#s-deep-agents-0-7) shows each task.

The whole bench cost $0.93 for 2,589 API calls. The evals of [section 9.6](#s-evals-that-check-state) added 64 Claude calls for $0.011. The second bench added 370 calls for $0.069, and the multi-agent runs of [section 6.7](#s-subgraphs-and-multi-agent-patterns) added 1,518 calls for $0.150.

### What the docs table says about models

The models page of Deep Agents shows scores of an eval suite for 13 models {{docs oss/python/deepagents/models}}. We read the page on 2026-11-15 and kept its numbers. We did not run these models. The table shows three of the seven columns.

| Model | Overall | Tool use | File operations | CI runs in the row |
|---|---|---|---|---|
| `google_genai:gemini-3.6-flash` | 0.82 | 0.90 | 1.00 | 2 |
| `openai:gpt-5.4` | 0.18 | 0.18 | 1.00 | 3 |
| `openai:gpt-5.5` | 0.80 | 0.84 | 0.92 | 2 |
| `anthropic:claude-opus-4-6` | 0.26 | 0.26 | 0.92 | 3 |
| `anthropic:claude-opus-4-7` | 0.80 | 0.82 | 1.00 | 1 |
| `baseten:moonshotai/Kimi-K2.6` | 0.79 | 0.84 | 0.92 | 1 |
| `baseten:zai-org/GLM-5` | 0.77 | 0.89 | 1.00 | 2 |
| `fireworks:accounts/fireworks/models/glm-5p1` | 0.81 | 0.87 | 1.00 | 1 |
| `fireworks:accounts/fireworks/models/minimax-m2p7` | 0.79 | 0.85 | 1.00 | 1 |
| `ollama:minimax-m2.7:cloud` | 0.73 | 0.82 | 0.92 | 2 |
| `openrouter:deepseek/deepseek-v4-flash` | 0.81 | 0.90 | 1.00 | 1 |
| `openrouter:minimax/minimax-m2.7` | 0.80 | 0.89 | 0.92 | 1 |
| `openrouter:z-ai/glm-5.1` | 0.89 | 0.89 | 0.92 | 5 |

No row is a local model of 20B parameters or fewer. So the page cannot tell you how a smaller model behaves. Seven rows mix cells from two to five different CI runs. 

Seven rows have no memory score. Two rows are odd: `openai:gpt-5.4` and `anthropic:claude-opus-4-6`. Their overall scores, 0.18 and 0.26, equal their tool use scores. Their file operations, retrieval, and summarization cells are 0.92 to 1.00. 

The register records this as conflict D137. Read the page as a ranking of large hosted models on one suite, and run your own tasks for anything else.

## Which one to use

| Your situation | Choose | The number behind it |
|---|---|---|
| One model call, no tools, no state | the provider SDK | no harness has anything to add |
| A tool loop in one process, no pause, no resume, no history across restarts | a plain loop | same outcome, tokens, and text as `create_agent` on 60 of 60 tasks, and 6 ms per task |
| You need a checkpointer, streaming modes, approvals, or middleware | `create_agent` | same requests as the plain loop, 12 to 16 ms more per task, 0.20% to 0.25% of the task time |
| You need branches, parallel nodes, or subgraphs | a hand-built `StateGraph` | the same requests as `create_agent` on the loop shape, and 18.5 ms per task |
| A frontier model with prompt caching, and you want file tools and subagents | Deep Agents | 99 of 99 on Haiku, 30 of 30 on Sonnet, 1.16 to 1.24 times the dollars |
| A local model on Ollama | a plain loop or `create_agent`, never the default deep agent | 15 and 16 fewer of 99 on Qwen3 4B and 8B, 2 to 4 fewer of 30 on 14B and 20B |
| A frontier model, and you want the Claude tool loop with no framework | the Claude Agent SDK | 30 of 30 on Haiku, 9.3k median input tokens against 23.7k for the deep agent |
| You want a better score | a better model | 15 to 30 of 30 across models, and 0 across the three plain harnesses |

Part 2 shows what `create_agent` gives you for those milliseconds: the superstep loop, the checkpoints, and the streams. [Part 9](#p-9) puts `create_agent` in a service with approvals, a Postgres checkpointer, and spans, on three real models.

## What this suite cannot tell you

The Claude rows are at the ceiling. A suite that both Claude models pass in full cannot rank them, and it cannot show a harness effect of a few percent on them. A harder suite would. We did not run one, to keep the API spend small.

Each Claude task ran once, with the default sampling of the API. Each local task ran once too, and [the method note](#s-ref-the-bench-method) shows why one greedy run is enough there. The suite tests short tasks of 1 to 12 model calls, with a median of 4. It says nothing about threads of hundreds of turns, which [section 5.5](#s-context-engineering-and-summarization) covers. It also says nothing about a service under load, which [section 9.7](#s-workers-the-advisory-lock-and-cost) measures.

```takeaways
- Pick the harness for persistence, streaming, approvals, or files, never for answer quality.
- Check agents by the state their tools leave, never by their final text.
- Run your own tasks on two models before you change harness.
- Keep small local models off the default deep agent.
- Turn on prompt caching before you judge the token cost of Deep Agents.
```

Sources: capture/lab/bench/summary-mac.json, capture/lab/bench/summarize.py, capture/lab/bench2/docs-eval-table.json, capture/lab/bench2/summary-bench2.json, capture/lab/summary/multiagent-mac.json, capture/lab/multiagent/runs/n9-sdk-haiku.jsonl, capture/lab/multiagent/runs/n9-deep-haiku.jsonl, capture/lab/bench/runs/main.jsonl, capture/lab/bench/runs/models.jsonl, capture/lab/bench/runs/cost-ledger.jsonl, capture/lab/bench/data/tasks.jsonl, capture/lab/bench/data/subset30.txt, capture/lab/bench/data/anthropic-prices.json, capture/lab/bench/kit/harnesses.py, capture/lab/bench/kit/checks.py, capture/lab/bench/kit/env.py, capture/lab/bench/kit/gen_tasks.py, capture/lab/bench/kit/oracle.py, capture/lab/bench/kit/run.py, capture/lab/bench/kit/models.py; libs/langchain_v1/langchain/agents/factory.py at langchain==1.5.0; libs/langgraph/langgraph/prebuilt at langgraph 1.2.22; libs/deepagents/deepagents/graph.py at deepagents==0.7.38; the Anthropic pricing page, read 2026-11-14; docs.langchain.com at docs commit 04d4d4a (oss/python/deepagents/models).
