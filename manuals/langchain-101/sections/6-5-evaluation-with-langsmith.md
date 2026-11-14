# Evaluation with LangSmith

> `evaluate` from `langsmith` 0.14.17 scores a target with your own evaluators, and with `upload_results=False` its default client still sends agent runs and one settings request.

You change the system prompt of an agent and want to know if it still answers your twenty test questions. The docs send you to LangSmith, which needs an account and a key. You want to run the same check on your laptop first, without sending anything.

When you finish this section, you can run `evaluate` with local evaluators and no account, and read its rows. You can also predict what leaves the process with the default client and with your own, and run the pytest plugin without LangSmith.

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

`evaluate` runs the target inside `tracing_context`, with `enabled` set to `"local"` when `upload_results` is false {{code src/langsmith/evaluation/_runner.py:1945}}. [Section 6.4](#s-langsmith-tracing) shows what `"local"` does to LangChain code: the callback manager reads it as on and sends each run. So an agent target sends its runs even with `upload_results=False`. The kit client sends each run unbatched, as one POST and one PATCH:

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

[Figure](#fig-6-5) sets the two targets side by side, with the kit client.

```figure
id: fig-6-5
kind: comparison
title: evaluate with upload_results=False on two targets
claim: With upload_results=False and the kit client, a plain function sends nothing, while a create_agent target sends its seven LangChain runs.
caption: Read each column from the examples at the top down to what the client received. The rose box is the requests that the agent target sent. The kit client sends one POST and one PATCH for each run. From capture/out/42-langsmith.txt.
```

**We measured** the same call with the default client on the Mac, with `langsmith` 0.14.17 and `langchain-core` 1.8.0. We passed no client and left `LANGSMITH_TRACING` unset. Each condition ran in 5 new processes, with one example each. The agent made 2 model calls and 1 tool call, 7 LangChain runs. Every process of a condition sent the same requests:

| Target | Environment | Requests in each of 5 processes |
|---|---|---|
| `create_agent` | `LANGSMITH_ENDPOINT` set to a local recorder | one `GET /info`, then one `POST /runs/multipart` with the 7 runs |
| `create_agent` inside `tracing_context(enabled=False)` | the same | one `GET /info` |
| a plain function | the same | one `GET /info` |
| `create_agent` | no `LANGSMITH_` or `LANGCHAIN_` variable | the same two requests, to `api.smith.langchain.com` |
| `create_agent` inside `tracing_context(enabled=False)` | no variable | one `GET /info` to `api.smith.langchain.com` |

Every row scored `true`. The default client sent no PATCH and no `POST /runs`, because it batches the runs into one multipart post. With no environment, we replaced the HTTP layer of the child process, so no request reached the default host:

```listing
title: the requests of an agent target with no environment, in one process
source: capture/lab/summary/evaluate-mac.json
lang: json
---
   "requests": [
    [
     "GET https://api.smith.langchain.com/info",
     "POST https://api.smith.langchain.com/runs/multipart"
    ],
```

The `GET /info` comes from the batch thread of the default client, which asks the endpoint for its settings {{code src/langsmith/_internal/_background_thread.py:553}}. It went out for a plain function too, so it does not depend on the target. A second run without the flush of our script sent it in 5 of 5 processes of each condition.

The sent runs have two defects for a real server. The `LangGraph` run had a parent id in all 10 agent processes. That parent is the run that `evaluate` builds around the target, and the client never sent it. So the server gets a child whose parent never arrives. The project name on the sent runs also differed from the experiment name that `evaluate` printed, in 10 of 10 processes. We did not find the cause.

## Keep an agent target offline

To keep the runs of an agent target in the process, turn tracing off inside the target. The kit wraps the agent in `tracing_context(enabled=False)`. The kit client then received nothing, while the row still scored `true`:

```listing
title: the agent target with tracing off inside it
source: capture/s_integrations.py
lang: python
---
    def quiet_target(inputs: dict) -> dict:
        with tracing_context(enabled=False):
            return agent_target(inputs)
```

With the default client, the same wrap stopped the runs, but the `GET /info` still went out in 5 of 5 processes. With no environment, it went to `api.smith.langchain.com`. So the wrap is not enough when no request at all can leave the machine. Pass your own client to `evaluate` as well. A client with `auto_batch_tracing=False` starts no batch thread, and the kit client received no request for the plain function.

## The pytest plugin

`langsmith` registers a pytest plugin through the `pytest11` entry point, so pytest loads it whenever both are installed {{code pyproject.toml}}. The plugin adds the marker `langsmith`. A test marked with `@pytest.mark.langsmith` runs through `test` from `langsmith.testing._internal`, the function behind the public `langsmith.test`. It records its inputs, outputs, and feedback as an experiment in LangSmith {{code src/langsmith/pytest_plugin.py}}. Inside such a test, `log_inputs`, `log_outputs`, `log_reference_outputs`, and `log_feedback` from `langsmith.testing` add to that record.

The record is on unless `LANGSMITH_TEST_TRACKING` is exactly `false` {{code src/langsmith/utils.py:143-145}}. With `false`, the decorated test calls your function directly, and each `log_*` call logs a message and returns {{code src/langsmith/testing/_internal.py}}. The pytest page of the docs gives the same switch for running without LangSmith {{docs langsmith/pytest}}. The option `--langsmith-output` needs the `langsmith[pytest]` extra for `rich`, and it refuses to run when tracking is off {{code src/langsmith/pytest_plugin.py:311-317}}. The cache of `LANGSMITH_TEST_CACHE` needs the `langsmith[vcr]` extra.

**We measured** the plugin on the Mac with `pytest` 8.4.2 in a scratch environment and `langsmith` 0.14.17. Each condition ran in 3 new pytest processes. The test file held five tests. Three were marked with `@pytest.mark.langsmith`, one used `@langsmith.test`, and one unmarked test called `log_outputs`. One marked test failed on purpose, and one ran `create_agent` with a fake model. The pytest header listed `langsmith-0.14.17` as a plugin, with no flag and no line in a conftest file.

- **Tracking on, the default, with no account.** With no `LANGSMITH_` variable, a plain `pytest` run sent `GET /info` and then `GET /datasets` to `api.smith.langchain.com`. We refused the connection, and all five tests failed in 3 of 3 runs. The four tracked tests failed with `LangSmithConnectionError`, and the unmarked test raised `ValueError` from `log_outputs`.
- **Tracking on, with a local endpoint.** The client sent `GET /info`, then `GET /datasets` and `GET /sessions` for each tracked test, 9 requests in all. The suite was named `None.test_ls_plugin`. The errors after those requests came from the empty answers of our recorder, so read only the order of the requests.
- **Tracking off.** With `LANGSMITH_TEST_TRACKING=false`, four tests passed and the intended one failed. No request left, with or without `LANGSMITH_ENDPOINT`. The `log_*` calls logged at INFO, so you see them only with `log_cli` at that level. The unmarked test that called `log_outputs` passed.
- **`--langsmith-output` with tracking off.** pytest stopped with `INTERNALERROR` and exit code 3 before any test ran. [Errors](#s-ref-errors) gives the message.
- **Tracking off and `LANGSMITH_TRACING=true`.** The LangChain runs of the agent test still went to the endpoint, in one or two `POST /runs/multipart` per run, 3 of 3. Tracking off stops the test record only, and tracing is a separate switch.

```listing
title: the requests of a pytest run with tracking on, no environment, and a fake answer of 200
source: capture/lab/summary/pytest-plugin-mac.json
lang: json
note: The first of three processes.
---
   "requests": [
    [
     "GET https://api.smith.langchain.com/info",
     "GET https://api.smith.langchain.com/datasets",
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

## Coming in the next edition

The rest of LangSmith evaluation needs an account, which we did not use for this edition. These runs are coming in the next edition, and [section 7.6](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) lists them with the other account runs:

- A dataset in LangSmith, given to `evaluate` by name, and its versions and splits.
- An experiment with `upload_results=True`, and its retention, which the billing page says is extended by default {{docs langsmith/usage-and-billing}}.
- A comparison of two experiments, which `evaluate` runs when the target is a pair of experiment ids.
- Online evaluators on production traces, and annotation queues.
- The pytest plugin with tracking on against a real account, and its `--langsmith-output` table with real results.

```takeaways
- Run evaluate with upload_results=False and a list of examples to test without an account.
- Write evaluators that take outputs and reference_outputs and return a key and a score.
- Wrap an agent target in tracing_context(enabled=False) to keep its runs in the process.
- Pass a client with auto_batch_tracing=False to evaluate, because the default client sends GET /info to the default host.
- Set LANGSMITH_TEST_TRACKING=false for marked tests, and unset LANGSMITH_TRACING too when nothing must leave.
```

Sources: capture/s_integrations.py, capture/out/42-langsmith.txt; capture/lab/summary/evaluate-mac.json, capture/lab/T18-evaluate-leak-mac/01-evaluate-requests.jsonl, capture/lab/T18-evaluate-leak-mac/02-evaluate-noflush.jsonl, capture/lab/T18-evaluate-leak-mac/04-info-origin.txt, capture/lab/T18-evaluate-leak-mac/t18_evaluate.py; capture/lab/summary/pytest-plugin-mac.json, capture/lab/T19-pytest-plugin-mac/01-pytest-runs.jsonl, capture/lab/T19-pytest-plugin-mac/03-off-tracing-on-runs.jsonl, capture/lab/T19-pytest-plugin-mac/t19_tests/test_ls_plugin.py, the stdout files of T19; src/langsmith/evaluation/_runner.py, src/langsmith/evaluation/evaluator.py, src/langsmith/_internal/_background_thread.py, src/langsmith/pytest_plugin.py, src/langsmith/testing/_internal.py, src/langsmith/testing/__init__.py, src/langsmith/utils.py, and pyproject.toml at langsmith v0.14.17; libs/core/langchain_core/callbacks/manager.py at langchain==1.5.0; docs.langchain.com at docs commit 04d4d4a (langsmith/evaluate-llm-application, langsmith/pytest, langsmith/usage-and-billing, langsmith/evaluation-concepts).
