# Evaluation with LangSmith

> `evaluate` from `langsmith` 0.14.17 builds an experiment from a dataset and your evaluators, and with `upload_results=False` it still sends every agent run.

You change the system prompt of an agent and want to know if it still answers your twenty test questions. The docs send you to LangSmith, which needs an account and a key. You want to run the same check on your laptop first, and then as an experiment in your account.

When you finish this section, you can run `evaluate` with local evaluators and no account, and read its rows. You can also predict what each mode of `evaluate` creates in an account, and what the pytest plugin needs.

## The parts of an evaluation

**Example:** one input with its reference output. A `langsmith.schemas.Example` has `inputs`, `outputs`, an id, and the id of its dataset.

**Target:** the function you test. `evaluate` calls it with the inputs of each example and records what it returns.

**Evaluator:** a function that scores one row. It returns a dict with a `key` and a `score`.

**Summary evaluator:** a function that scores all the rows of an experiment at once, such as an accuracy.

**Experiment:** one call of `evaluate` over a set of examples. The docs say that each call creates one experiment {{docs langsmith/evaluate-llm-application}}.

The function is `evaluate(target, /, data=None, evaluators=None, summary_evaluators=None, ...)` {{code src/langsmith/evaluation/_runner.py}}. `data` can be the name of a dataset in LangSmith, a list of examples, or a generator of examples. `max_concurrency` defaults to 0, which runs the rows one at a time. `num_repetitions` runs each example more than once. `upload_results` defaults to `True`. For large jobs, the docs recommend `aevaluate` with a higher `max_concurrency` {{docs langsmith/evaluate-llm-application}}.

An evaluator takes its arguments by name. The names it can use are `run`, `example`, `inputs`, `outputs`, `reference_outputs`, and `attachments` {{code src/langsmith/evaluation/evaluator.py}}. A summary evaluator takes lists of the same values for all rows.

## evaluate with no account

With `upload_results=False`, `evaluate` creates no experiment in LangSmith and sends no results. The kit runs it with a list of three examples and its own client. That client has `auto_batch_tracing=False`, and its HTTP session records each request. The target adds two numbers, and it is wrong on purpose when `a` is 4:

```listing
title: a target and two local evaluators
source: capture/s_integrations.py
lang: python
---
    def adder(inputs: dict) -> dict:
        return {"sum": inputs["a"] + inputs["b"] + (1 if inputs["a"] == 4 else 0)}

    def exact(outputs: dict, reference_outputs: dict) -> dict:
        return {"key": "exact", "score": outputs["sum"] == reference_outputs["sum"]}

    def accuracy(outputs: list, reference_outputs: list) -> dict:
        hits = sum(o["sum"] == r["sum"] for o, r in zip(outputs, reference_outputs))
        return {"key": "accuracy", "score": hits / len(outputs)}
```

`evaluate` returns the rows as you iterate it. Each row holds the example, the run of the target, and the result of each evaluator. The second row failed, and the summary evaluator scored two of three:

```listing
title: the failed row, the summary, and the requests
source: capture/out/42-langsmith.txt
lang: json
note: The second of three rows, then the summary evaluator and the request count.
---
  {
    "inputs": {
      "a": 4,
      "b": 4
    },
    "outputs": {
      "sum": 9
    },
    "reference": {
      "sum": 8
    },
    "scores": {
      "exact": false
    }
  },
…
summary evaluators:
{
  "accuracy": 0.6666666666666666
}

HTTP requests the client received:
{}
```

The kit client received nothing. `evaluate` warned that `upload_results` is in beta. It also printed `Starting evaluation of experiment: %s` with a random name after it. The code passes the format string and the name to `print` as two arguments {{code src/langsmith/evaluation/_runner.py}}. The kit masks the random name.

That empty count belongs to the kit client. When you pass no client, `evaluate` takes the cached default client {{code src/langsmith/evaluation/_runner.py:1084}}. That client sends a request of its own, as the lab run below shows.

## An agent target sends its runs

`evaluate` runs the target inside `tracing_context`, with `enabled` set to `"local"` when `upload_results` is false {{code src/langsmith/evaluation/_runner.py:1945}}. [Section 7.6](#s-langsmith-tracing) shows what `"local"` does to LangChain code: the callback manager reads it as on and sends each run. So an agent target sends its runs even with `upload_results=False`. The kit client sends each run unbatched, as one POST and one PATCH:

```listing
title: a create_agent target with upload_results=False and the kit client
source: capture/out/42-langsmith.txt
lang: json
note: The request count after one row of the agent target.
---
HTTP requests the client received:
{
  "PATCH /runs/<run-id>": 7,
  "POST /runs": 7
}
```

The row scored `false`. Qwen3 4B answered `2 + 3 = 5.`, and the evaluator `same_answer` compares the text with the reference `The sum is 5.`. An exact match fails a real model that is right, so score the number, or use a judge.

[Figure](#fig-7-7) sets the two targets side by side, with the kit client.

```figure
id: fig-7-7
kind: comparison
title: evaluate with upload_results=False on two targets
claim: With upload_results=False and the kit client, a plain function sends nothing, while a create_agent target sends its seven LangChain runs.
caption: Read each column from the examples at the top down to what the client received. The rose box is the requests that the agent target sent. The kit client sends one POST and one PATCH for each run. From capture/out/42-langsmith.txt.
```

**We measured** the same call with the default client on the x86 server guest with a Qwen3 4B agent, against a local recorder. We passed no client and left `LANGSMITH_TRACING` unset. Each condition ran in 5 new processes, with one example each. The agent produced 7 LangChain runs. Every process of a condition sent the same requests:

| Target | Environment | Requests in each of 5 processes |
|---|---|---|
| `create_agent` | `LANGSMITH_ENDPOINT` set to a local recorder | one `GET /info`, then three `POST /runs/multipart` that carried the 7 runs and 5 updates |
| `create_agent` inside `tracing_context(enabled=False)` | the same | one `GET /info` |
| a plain function | the same | one `GET /info` |
| `create_agent` | no `LANGSMITH_` or `LANGCHAIN_` variable | the same four requests, to `api.smith.langchain.com` |
| `create_agent` inside `tracing_context(enabled=False)` | no variable | one `GET /info` to `api.smith.langchain.com` |

Every row scored `true`. The default client sent no PATCH request and no `POST /runs`. The updates went as patch parts inside the multipart posts. With no environment, we replaced the HTTP layer of the child process, so no request reached the default host:

```listing
title: the requests of an agent target with no environment, in one process
source: capture/lab/summary/evaluate-x86.json
lang: json
---
   "requests": [
    [
     "GET https://api.smith.langchain.com/info",
     "POST https://api.smith.langchain.com/runs/multipart",
     "POST https://api.smith.langchain.com/runs/multipart",
     "POST https://api.smith.langchain.com/runs/multipart"
    ],
```

The `GET /info` comes from the batch thread of the default client, which asks the endpoint for its settings {{code src/langsmith/_internal/_background_thread.py:553}}. It went out for a plain function too, so it does not depend on the target.

The sent runs had two defects. The `LangGraph` run had a parent id in all 10 agent processes, and the client never sent that parent. The project name on the sent runs also differed from the name that `evaluate` printed. The next part shows what a real server does with both.

## evaluate on a real account

**We measured** three calls on the Mac against the hosted API, with a new account on the free plan. The dataset held 10 sums, and the target was a Qwen3 4B agent. The evaluators were `exact`, a code check, and `judge`, a prompt piped to `ChatOllama` and a parser:

| Call | What the account holds after it | Agent runs |
|---|---|---|
| `evaluate`, `upload_results=True` | an experiment linked to the dataset, 10 `Target` roots that each point to their example, and 20 feedback rows | 70, under the roots |
| `evaluate`, `upload_results=False` | no experiment, and a new project with an automatic name | 70, with no root |
| `aevaluate`, `upload_results=True`, `max_concurrency=2` | an experiment linked to the dataset, 10 `AsyncTarget` roots, and 20 feedback rows | 70, under the roots |

Both scores were 10 of 10 in every call. The feedback rows had the keys `exact` and `judge`, and `model` as their source type. The judge said `CORRECT` on every row, and every answer was right. So this run does not show that the judge can find a wrong answer.

The two uploading calls also created a project named `evaluators`, with no prefix. It holds one root run for each evaluator call, 20 for `exact` and 20 for `judge`. `evaluate` names it, and you cannot set the name from the call.

### What upload_results=False still sends

With `upload_results=False`, the client sent no `POST /sessions`, so it created no experiment. It still read the dataset, and it sent 31 multipart posts:

```listing
title: the requests of evaluate with upload_results=False on the hosted API
source: capture/lab/summary/langsmith-account-mac.json
lang: json
---
   "requests": {
    "GET /datasets 200": 2,
    "GET /examples 200": 1,
    "GET /info 200": 2,
    "GET /sessions 200": 5,
    "POST /runs/multipart 202": 31
   },
```

The posts carried the 70 agent runs. The server stored them in a project that nobody named. The call also gave three names to one experiment:

```listing
title: three names for one call of evaluate with upload_results=False
source: capture/lab/summary/langsmith-account-mac.json
lang: json
---
  "false_names": {
   "experiment_name_returned": "healthy-coast-30",
   "printed": "Starting evaluation of experiment: %s aiefs-lc101-eval-false-3afa8db2",
   "project_with_the_runs": "abandoned-drink-3"
  },
```

- **The printed name** used the prefix of the call, after the literal `%s`.
- **The returned name** in `experiment_name` of the result names no project in the account.
- **The project with the runs** has a random name that the server gave it. It has no prefix, so a filter on your prefix does not find it.

We filed the names and the print in `langchain-ai/langsmith-python` as #106. The runs come from the `"local"` mode, which [section 7.6](#s-langsmith-tracing) shows and #41870 reports.

### Orphan runs on the server

**We measured** where the runs of the `upload_results=False` call ended up. In 10 of 10 traces, the `LangGraph` run had a parent id. That parent is the `Target` run, which the client never sent:

```listing
title: the orphan runs of evaluate with upload_results=False
source: capture/lab/summary/langsmith-account-mac.json
lang: json
---
  "false_orphans": {
   "is_root_count": 0,
   "langgraph_runs_with_unsent_parent": 10,
   "project_runs": 70,
```

A read of the trace root raised `LangSmithNotFoundError`. A list of the project with `is_root=True` returned 0 runs. So the root view of the project shows nothing, and the 70 runs appear only as child runs. The judge sent its own runs to `evaluators` with an unsent parent too. That project holds 30 `RunnableSequence` runs for its 20 judge roots.

So `upload_results=False` does not keep an agent target out of your account. It stores the runs where the trace view does not show them. Wrap the target in `tracing_context(enabled=False)`, as the next part shows, when no run must leave. Wrap the model call inside a judge evaluator the same way, because the judge sends its own runs.

## Keep an agent target offline

To keep the runs of an agent target in the process, turn tracing off inside the target. The kit wraps the agent in `tracing_context(enabled=False)`. The kit client then received nothing, and the row scored the same as before:

```listing
title: the agent target with tracing off inside it
source: capture/s_integrations.py
lang: python
---
    def quiet_target(inputs: dict) -> dict:
        with tracing_context(enabled=False):
            return agent_target(inputs)
```

With the default client and a local recorder, the same wrap stopped the runs, but the `GET /info` still went out in 5 of 5 processes. With no environment, it went to `api.smith.langchain.com`. So the wrap is not enough when no request at all can leave the machine. Pass your own client to `evaluate` as well. A client with `auto_batch_tracing=False` starts no batch thread, and the kit client received no request for the plain function.

## The pytest plugin

`langsmith` registers a pytest plugin through the `pytest11` entry point, so pytest loads it whenever both are installed {{code pyproject.toml}}. The plugin adds the marker `langsmith`. A test marked with `@pytest.mark.langsmith` runs through `test` from `langsmith.testing._internal`, the function behind the public `langsmith.test`. It records its inputs, outputs, and feedback as an experiment in LangSmith {{code src/langsmith/pytest_plugin.py}}. Inside such a test, `log_inputs`, `log_outputs`, `log_reference_outputs`, and `log_feedback` from `langsmith.testing` add to that record.

The record is on unless `LANGSMITH_TEST_TRACKING` is exactly `false` {{code src/langsmith/utils.py:143-145}}. With `false`, the decorated test calls your function directly, and each `log_*` call logs a message and returns {{code src/langsmith/testing/_internal.py}}. The pytest page of the docs gives the same switch for running without LangSmith {{docs langsmith/pytest}}. The option `--langsmith-output` needs the `langsmith[pytest]` extra for `rich`, and it refuses to run when tracking is off {{code src/langsmith/pytest_plugin.py:311-317}}. The cache of `LANGSMITH_TEST_CACHE` needs the `langsmith[vcr]` extra.

The test file held five tests. Three were marked with `@pytest.mark.langsmith`, one used `@langsmith.test`, and one unmarked test called `log_outputs`. One marked test failed on purpose, and one ran `create_agent` with Qwen3 4B on Ollama. The pytest header listed `langsmith-0.14.17` as a plugin, with no flag and no line in a conftest file.

### Tracking on needs LANGSMITH_TRACING too

**We measured** the plugin on the Mac against the hosted API, with `pytest` 8.4.2 in a scratch environment. The key was set, with a suite name and an experiment name:

- **Tracking on, `LANGSMITH_TRACING` unset.** All five tests failed in 3 of 3 runs. Each `log_*` call raised `ValueError`, which asks for a marked test and for tracing. Each run still created an empty experiment, and the first run created the dataset.
- **The same with `--langsmith-output`.** The table showed 3 rows, without the `@langsmith.test` test. Each row was `failed` with inputs `{}`, and the averages row said `0%`. pytest exited with code 1.
- **Tracking on and `LANGSMITH_TRACING=true`.** Three tests passed, and the two expected ones failed, in 2 of 2 runs. These were the marked failure and the unmarked `log_outputs` call.

The message names both conditions. The code checks for tracing inside each `log_*` call {{code src/langsmith/testing/_internal.py:1166-1168}}:

```listing
title: the error of log_inputs with tracking on and tracing unset
source: capture/lab/summary/langsmith-account-mac.json
lang: json
---
  "errors_with_tracing_unset": [
   "ValueError: log_inputs should only be called within a pytest test decorated with @pytest.mark.langsmith, and with tracing enabled (by setting the LANGSMITH_TRACING environment variable to 'true').",
```

With tracing on, each run made one experiment of 11 runs. Four were test roots that each point to an example. The 7 agent runs sat under `test_marked_agent`. The feedback was `pass` with 1 for three tests and 0 for the failure, and `exact` twice.

The plugin ignored `LANGSMITH_PROJECT`, and no project of that name exists. The tests trace into the experiment. After the 8 processes, the account held one dataset `aiefs-lc101-pytest` with 3 examples and the description `Test suite`. It also held 8 experiments, 2 with runs and 6 empty. We filed the need for tracing in `langchain-ai/langsmith-python` as #107.

### The plugin with no account

**We measured** the plugin earlier on the x86 server guest, against a local recorder and with no environment, 3 processes per condition:

- **Tracking on, with no `LANGSMITH_` variable.** A plain `pytest` run sent `GET /info` and `GET /datasets` to `api.smith.langchain.com`. We refused the connection. The four tracked tests failed with `LangSmithConnectionError`, and the unmarked test raised `ValueError` from `log_outputs`.
- **Tracking off.** With `LANGSMITH_TEST_TRACKING=false`, four tests passed and the intended one failed. No request left, with or without `LANGSMITH_ENDPOINT`. The `log_*` calls logged at INFO, so you see them only with `log_cli` at that level.
- **`--langsmith-output` with tracking off.** pytest stopped with `INTERNALERROR` and exit code 3 before any test ran. [Errors](#s-ref-errors) gives the message.
- **Tracking off and `LANGSMITH_TRACING=true`.** The LangChain runs of the agent test still went to the endpoint, in three `POST /runs/multipart` per run, 3 of 3. Tracking off stops the test record only, and tracing is a separate switch.

```listing
title: the requests of a pytest run with tracking on, no environment, and a guard that answers 200
source: capture/lab/summary/pytest-plugin-x86.json
lang: json
note: The first of three processes.
---
   "requests": [
    [
     "GET https://api.smith.langchain.com/datasets",
     "GET https://api.smith.langchain.com/info",
     "GET https://api.smith.langchain.com/sessions",
     "GET https://api.smith.langchain.com/datasets",
     "GET https://api.smith.langchain.com/sessions",
     "GET https://api.smith.langchain.com/datasets",
     "GET https://api.smith.langchain.com/sessions",
     "GET https://api.smith.langchain.com/datasets",
     "GET https://api.smith.langchain.com/sessions"
    ],
```

So an install that has both `pytest` and `langsmith` sends requests from every marked test, unless you set the variable. Set it in the test environment, next to `LANGSMITH_TRACING`.

## The prompt hub on the free plan

The docs teach the hub through `langchain_classic`, and the register records that as D113. The client of `langsmith` has its own methods, `push_prompt` and `pull_prompt`.

**We measured** the hub once on the free plan from the Mac. We pushed a private prompt twice, with the tags `v1` and `v2`:

- **A pull.** Each pull returned the right version. We pulled by tag, by the first 8 characters of the hash, by the full hash, and the latest.
- **A push with no change.** It raised `LangSmithConflictError`, from a 409 with the detail `Nothing to commit: prompt has not changed since latest commit`.
- **A missing tag.** It raised `LangSmithNotFoundError`, from a 404 with the detail `Commit not found`.
- **The cache of the client.** A second pull by full hash made no HTTP request. Each pull by tag made 2 requests, every time.

So pin a prompt by its full hash in production code. A tag is a name that can move, and the client asks the server each time.

## Still open

These runs need more than this edition did, and [section 8.8](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) lists them:

- Versions and splits of a dataset, given to `evaluate` by name.
- A comparison of two experiments, which `evaluate` runs when the target is a pair of experiment ids.
- Online evaluators on production traces, and annotation queues.

```takeaways
- Run evaluate with upload_results=False and a list of examples to test without an account.
- Write evaluators that take outputs and reference_outputs and return a key and a score.
- Wrap an agent target in tracing_context(enabled=False) to keep its runs out of your account.
- Look in the evaluators project and in projects without your prefix after evaluate runs.
- Set LANGSMITH_TRACING=true with tracking on, or every log call in a marked test raises.
- Set LANGSMITH_TEST_TRACKING=false for marked tests, and wrap the target and judge in tracing_context(enabled=False) too.
- Pull a prompt by its full commit hash when the version must not change.
```

Sources: capture/s_integrations.py, capture/out/42-langsmith.txt; capture/lab/summary/langsmith-account-mac.json, capture/lab/T21-langsmith-account-mac/06-e2-true.json, capture/lab/T21-langsmith-account-mac/06-e2-false.json, capture/lab/T21-langsmith-account-mac/06-e2-false-stdout.txt, capture/lab/T21-langsmith-account-mac/06-e2-async.json, capture/lab/T21-langsmith-account-mac/06b-e2-false-where.json, capture/lab/T21-langsmith-account-mac/04-e3-pytest-runs.jsonl, capture/lab/T21-langsmith-account-mac/04-e3-inspect.json, the stdout files of T21, capture/lab/T21-langsmith-account-mac/05-e4-hub.json, capture/lab/T21-langsmith-account-mac/05b-e4-hub-fullhash.json, capture/lab/T21-langsmith-account-mac/_scripts/t21_e2_eval.py, capture/lab/T21-langsmith-account-mac/_scripts/t21_e3_pytest.py, capture/lab/T21-langsmith-account-mac/_scripts/t21_e4_hub.py, capture/lab/T21-langsmith-account-mac/_scripts/t21_tests/test_ls_plugin.py; capture/lab/summary/evaluate-x86.json, capture/lab/T18-evaluate-leak-x86/01-evaluate-requests.jsonl, capture/lab/T18-evaluate-leak-x86/02-evaluate-noflush.jsonl, capture/lab/T18-evaluate-leak-x86/t18_real.py, capture/lab/T18-evaluate-leak-mac/04-info-origin.txt; capture/lab/summary/pytest-plugin-x86.json, capture/lab/T19-pytest-plugin-x86/01-pytest-runs.jsonl, capture/lab/T19-pytest-plugin-x86/t19_tests/test_ls_plugin.py, the stdout files of T19; src/langsmith/evaluation/_runner.py, src/langsmith/evaluation/evaluator.py, src/langsmith/_internal/_background_thread.py, src/langsmith/pytest_plugin.py, src/langsmith/testing/_internal.py, src/langsmith/testing/__init__.py, src/langsmith/utils.py, src/langsmith/client.py, and pyproject.toml at langsmith v0.14.17; libs/core/langchain_core/callbacks/manager.py at langchain==1.5.0; docs.langchain.com at docs commit 04d4d4a (langsmith/evaluate-llm-application, langsmith/pytest, langsmith/usage-and-billing, langsmith/evaluation-concepts); issues langchain-ai/langsmith-python#106 and #107, and langchain-ai/langchain#41870.
