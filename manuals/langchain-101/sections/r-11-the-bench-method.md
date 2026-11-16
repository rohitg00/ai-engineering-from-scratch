# The bench method

> The bench ran 99 tasks with state checkers on five local and two Claude models, one run per task, with Wilson intervals and a list of rows to skip.

## The kit

The bench kit is a set of Python files in [the bench folder](manuals/langchain-101/capture/lab/bench). It drives real models only. No fake model, stub server, or scripted reply answers any row.

| File | What it does |
|---|---|
| `kit/gen_tasks.py` | builds the 100 tasks from fixed data: a catalog of 12 items, a SQLite shop of 48 customers and 240 orders, and 26 invented documents |
| `kit/oracle.py` | runs the right tool calls for each task and checks that every task passes, then checks that an agent with no tool calls fails every task |
| `kit/env.py` | the tools of each family, each wrapped to log its arguments, its result, and its time |
| `kit/harnesses.py` | the four harnesses: the plain loop, `create_agent`, the hand-built `StateGraph`, and `create_deep_agent`, with a fifth for `FilesystemBackend` |
| `kit/checks.py` | the checkers, and the failure categories |
| `kit/models.py` | the model settings, the call meter, and the cost ledger |
| `kit/run.py`, `kit/structured.py`, `kit/toolscale.py` | the three runners: the task suite, structured output, and tool count |
| `summarize.py` | reads the raw rows and writes `summary-mac.json`, which every number and chart of the bench sections comes from |

**Checker:** the function that decides a pass from what the tools changed. It reads the lookups that ran and their arguments, the database hash, the files of the task folder, and the notes store. It reads the final text only for a question that has an answer, and only when the model did not call `submit_answer`.

**Failure category:** the first matching reason for a fail, in this order. A raised error is `loop_step_limit`, `parse_error`, or `harness_error`. A tool call written as text is `malformed_output`. A call to an unknown tool, or no call to a required lookup, is `wrong_tool`.

A required lookup that failed is `wrong_args`. A refusal is `gave_up`. Anything else is `wrong_final_state`.

## Tasks and sampling

The suite has 100 tasks in five families of 20. Every table drops `sql19`, so the suite has 99. That task asks for the product category with the most products, and two categories have 5 each. The expected answer named one of them.

**Stratified subset:** the 30 tasks numbered 01, 04, 07, 10, 13, and 16 in each family. The models that did not run the full suite ran this subset. `sql19` is not in it.

| Runner | Models | Tasks per cell |
|---|---|---|
| task suite, plain loop and deep agent | Qwen3 4B, Qwen3 8B, Claude Haiku 5.5 | 99 |
| task suite, plain loop and deep agent | Claude Sonnet 5.5, gpt-oss 20B, Qwen3 14B, Qwen3 30B-A3B | 30 |
| task suite, `create_agent` and `StateGraph` | Qwen3 4B, Qwen3 8B | 30 |
| task suite, `FilesystemBackend` | Qwen3 4B, Qwen3 8B, Claude Haiku 5.5 | 20 file tasks |
| structured output | Qwen3 4B, Qwen3 8B, Claude Haiku 5.5 | 39, and 10 for `ProviderStrategy` on Qwen3 4B |
| tool count | Qwen3 4B and Claude Haiku 5.5 at 4 sizes, Qwen3 8B at 2 | 10 chain tasks |

## Settings

The local models ran on the Mac with Ollama 0.31.1 at temperature 0, seed 42, and a context of 16,384 tokens. The output limit was 1,024 tokens, and 4,096 for gpt-oss 20B and Qwen3 30B-A3B. Thinking was off, except `low` on gpt-oss 20B and on for Qwen3 30B-A3B. Qwen3 4B is the `4b-instruct-2507` build at `Q4_K_M`.

Claude ran through the Anthropic API from the Mac, with `langchain-anthropic` 1.7.10. The API refused a temperature for these models, so the kit sent none, and Claude used its default sampling. The output limit was 1,024 tokens. Every harness had a limit of 10 model calls per user turn, and 20 with the tool selector.

The packages were `langchain` 1.5.0, `langchain-core` 1.8.0, `langgraph` 1.2.22, `deepagents` 0.7.38, and `langchain-ollama` 1.1.0.

## One greedy run is enough on Ollama

**We measured** Qwen3 4B three times on the 30-task subset with each of two harnesses, on the Mac. All three runs gave the same outcome, the same tokens, and the same tool calls on every task. With temperature 0 and a fixed seed, Ollama repeats itself, so a second greedy run adds no information.

**We measured** the plain loop at temperature 0.7 with seeds 1, 2, and 3 on the same 30 tasks. It passed 24, 23, and 23, and 5 tasks changed outcome between seeds. [Figure](#fig-r-11) shows every run.

```figure
id: fig-r-11
kind: chart
title: three greedy runs repeat each other, three sampled runs do not
claim: At temperature 0 three runs of Qwen3 4B gave identical outcomes on all 30 tasks, and at temperature 0.7 five tasks changed between seeds.
caption: Each column is one task of the subset and each row one run. A filled square is a pass, and a rose square a fail. The amber marks are the tasks whose outcome changed between seeds. From capture/lab/bench/summary-mac.json.
```

So the greedy result is one sample of the model. The tasks are fixed and each ran once, so the interval of a cell is a Wilson interval for a rate over this suite. It does not measure the spread between repeated runs, and it applies to this suite only. A different seed or temperature moves single tasks, not the rate: 23 greedy against 23 to 24 sampled.

## Intervals

Every rate in the bench sections comes with a 95% Wilson interval. Its width depends on the count:

| Tasks | Half pass | 80% pass | All pass |
|---|---|---|---|
| 10 | 0.24 to 0.76 | 0.49 to 0.94 | 0.72 to 1.00 |
| 30 | 0.33 to 0.67 | 0.63 to 0.90 | 0.89 to 1.00 |
| 39 | 0.34 to 0.64 | 0.64 to 0.89 | 0.91 to 1.00 |
| 99 | 0.40 to 0.59 | 0.71 to 0.87 | 0.96 to 1.00 |

Two cells on the same tasks are paired, so the bench also counts the tasks where they agree. That count is sharper than two intervals side by side.

## Time

The kit times each model call from the start callback to the end callback, and each tool inside its wrapper. Framework time is the wall time minus those two. It also holds the call meter of the kit, which is the same in every harness.

The Mac was shared with other work. Treat every time as an upper bound, and compare times only inside one table.

## Cost

The kit wrote one ledger row for every Claude call, with the usage that the API returned and the list price of 2026-11-14. It stopped before a call when the ledger reached its cap. The whole bench used 2,589 calls and $0.93. The later runs below are counted apart.

The ledger recorded 0 cache-write tokens on every call, and it priced those tokens at the base input price. If the API billed cache writes at 1.25 times, our dollars are low. The bound is 12.7% for a plain loop cell. For a deep agent cell it is about 6%: 4.6% on Haiku, 6.4% on Sonnet, and 6.1% over both. The deep agent ratio would then be lower, never higher.

## The second bench and the multi-agent runs

Two later runs reuse the kit and the task data of the first bench. They changed only the harness.

| Folder | What it ran | Files |
|---|---|---|
| `bench2/` | harness profiles A and B, the `eval` tool with and without a prompt that asks for it, and `RubricMiddleware` with a Qwen3 14B grader | `kit2/run2.py` runs, `kit2/summarize2.py` writes `summary-bench2.json`, `kit2/docs_table.py` reads the docs table into `docs-eval-table.json` |
| `multiagent/` | five patterns on Haiku and Qwen3 14B, and the Claude Agent SDK against a deep agent on Haiku | `kit/run_patterns.py` and `kit/run_sdk.py` run, `kit/summarize_patterns.py` writes `capture/lab/summary/multiagent-mac.json` |

The local rows of `bench2/` ran on a second Ollama 0.31.1 server that we started for them, with a model cache of its own. Its first start used a quantized key-value cache and flash attention. Eight control rows came from that start, four on Qwen3 4B and four on Qwen3 8B. We restarted the server with the defaults of the first bench and kept those eight rows in `bench2/runs/excluded/`. After the restart, three control tasks gave the same tool calls and prompt tokens as the first bench.

The profile and eval rows of the local models all come from after the restart. The summary reads the plain loop and default deep agent rows from the first bench. The Qwen3 14B and gpt-oss 20B deep agent cells join 12 old runs and 27 new runs at the same settings.

[Figure](#fig-r-11b) shows every cell of the second bench with its interval. 
```figure
id: fig-r-11b
kind: chart
title: the pass rate and its interval for every cell of the second bench
claim: Cells of 99 tasks give intervals of 18 to 19 points, and cells of 30 tasks give intervals up to 34 points.
caption: Each row is one cell. The dot is the pass rate and the whisker is the 95% Wilson interval. Rose counts mark cells of fewer than 30 tasks. From capture/lab/bench2/summary-bench2.json.
```

Haiku in `bench2/` ran 370 calls for $0.0695, and the rows are in `bench2/runs/cost-ledger.jsonl`. The multi-agent runs of Haiku are 1,518 ledger rows for $0.150, in `multiagent/runs/cost-ledger.jsonl`.

We also started the evals of `deepagents` on Qwen3 4B. 
We stopped it after 14 tests, 9 passed and 5 failed, and it wrote no report, so the manual uses none of it.

The Qwen3 8B nudged run failed at its start. The multi-agent run of gpt-oss 20B never started a task. The Qwen3 14B cells of both runs share the Mac with other jobs. Their times are upper bounds, and each cell holds one run per task.

## Rows not to use

| Rows | Why |
|---|---|
| `sql19` in every runner | the expected answer is one of two tied categories |
| `runs/excluded/anthropic-smoke-attempt1-400.jsonl` | the first Claude smoke run, which sent a temperature and got 400 errors |
| `runs/excluded/main-30b-a3b-think-off-leaks.jsonl` | Qwen3 30B-A3B with thinking off, which wrote its reasoning into the reply and hit the output limit |
| `runs/excluded/main-files-before-sandbox-fix.jsonl` | file tasks from before a fix to how the kit resolved the task folder path |
| `bench2/runs/excluded/kvq8-profiles.jsonl`, `bench2/runs/excluded/kvq8-rubric.jsonl` | control rows from the first start of the second server, which did not repeat the first bench |
| `bench2/runs/smoke.jsonl`, `bench2/runs/verify.jsonl` | smoke and check runs that the summary does not read |
| `runs/excluded/structured-dev.jsonl`, `runs/excluded/toolscale-dev.jsonl` | rows from the runs that tested the runners |
| the structured output rows of Claude | valid, but the runner added no prompt cache, so their dollars are list price |
| strict pass as a quality measure | it counts the use of `submit_answer`, and the small models often wrote the answer in text |

The main file keeps every other row. `summarize.py` drops `sql19` when it reads the rows, and `summarize.py --check` rebuilds the summary and compares it.

Sources: capture/lab/bench/summary-mac.json, capture/lab/bench2/summary-bench2.json, capture/lab/bench2/kit2, capture/lab/bench2/runs, capture/lab/bench2/logs, capture/lab/summary/multiagent-mac.json, capture/lab/multiagent, capture/lab/bench/summarize.py, capture/lab/bench/summary-with-sql19.md, capture/lab/bench/runs/main.jsonl, capture/lab/bench/runs/sampling.jsonl, capture/lab/bench/runs/structured.jsonl, capture/lab/bench/runs/toolscale.jsonl, capture/lab/bench/runs/models.jsonl, capture/lab/bench/runs/cost-ledger.jsonl, capture/lab/bench/runs/excluded, capture/lab/bench/data/tasks.jsonl, capture/lab/bench/data/subset30.txt, capture/lab/bench/data/anthropic-prices.json, capture/lab/bench/data/shop.db, capture/lab/bench/kit.
