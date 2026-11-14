# Evaluation with LangSmith

> `evaluate` from `langsmith` 0.14.17 scores a target against examples with your own evaluators, and with `upload_results=False` it runs offline, except that it sends agent runs.

You change the system prompt of an agent and want to know if it still answers your twenty test questions. The docs send you to LangSmith, which needs an account and a key. You want to run the same check on your laptop first, without sending anything.

When you finish this section, you can run `evaluate` with local evaluators and no account, and read its rows. You can also keep an agent target from sending its runs, and say which parts of evaluation need an account.

## The parts of an evaluation

**Example:** one input with its reference output. A `langsmith.schemas.Example` has `inputs`, `outputs`, an id, and the id of its dataset.

**Target:** the function you test. `evaluate` calls it with the inputs of each example and records what it returns.

**Evaluator:** a function that scores one row. It returns a dict with a `key` and a `score`.

**Summary evaluator:** a function that scores all the rows of an experiment at once, such as an accuracy.

**Experiment:** one call of `evaluate` over a set of examples. The docs say that each call creates one experiment {{docs langsmith/evaluate-llm-application}}.

The function is `evaluate(target, /, data=None, evaluators=None, summary_evaluators=None, ...)` {{code src/langsmith/evaluation/_runner.py}}. `data` can be the name of a dataset in LangSmith, a list of examples, or a generator of examples. `max_concurrency` defaults to 0, which runs the rows one at a time. `num_repetitions` runs each example more than once. `upload_results` defaults to `True`. For large jobs, the docs recommend `aevaluate` with a higher `max_concurrency` {{docs langsmith/evaluate-llm-application}}.

An evaluator takes its arguments by name. The names it can use are `run`, `example`, `inputs`, `outputs`, `reference_outputs`, and `attachments` {{code src/langsmith/evaluation/evaluator.py}}. A summary evaluator takes lists of the same values for all rows.

## evaluate with no account

With `upload_results=False`, `evaluate` creates no experiment in LangSmith and sends no results. The kit runs it with a list of three examples and a client whose HTTP session records each request. The target adds two numbers, and it is wrong on purpose when `a` is 4:

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

The client received nothing. `evaluate` warned that `upload_results` is in beta. It also printed `Starting evaluation of experiment: %s` with a random name after it. The code passes the format string and the name to `print` as two arguments {{code src/langsmith/evaluation/_runner.py}}. The kit masks the random name.

## An agent target sends its runs

`evaluate` runs the target inside `tracing_context`, with `enabled` set to `"local"` when `upload_results` is false {{code src/langsmith/evaluation/_runner.py}}. [Section 6.4](#s-langsmith-tracing) shows what `"local"` does to LangChain code: the callback manager reads it as on and sends each run. So an agent target sends its runs even with `upload_results=False`:

```listing
title: a create_agent target with upload_results=False
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

[Figure](#fig-6-5) sets the two targets side by side.

```figure
id: fig-6-5
kind: comparison
title: evaluate with upload_results=False on two targets
claim: With upload_results=False a plain function sends nothing, while a create_agent target sends its seven LangChain runs to the client.
caption: Read each column from the examples at the top down to what the client received. The rose box is the requests that the agent target sent. From capture/out/42-langsmith.txt.
```

The kit passes its own client to `evaluate`. Without one, the tracer uses the default client, which is the path that sent the local agent run of section 6.4 to the default host. To keep an agent target offline, turn tracing off inside the target. The kit wraps the agent in `tracing_context(enabled=False)`, and the client then received nothing, while the row still scored `true`:

```listing
title: the agent target with tracing off inside it
source: capture/s_integrations.py
lang: python
---
    def quiet_target(inputs: dict) -> dict:
        with tracing_context(enabled=False):
            return agent_target(inputs)
```

## The pytest plugin

`langsmith` registers a pytest plugin through the `pytest11` entry point, so pytest loads it whenever both are installed {{code pyproject.toml}}. The plugin adds the marker `langsmith`. A test marked with `@pytest.mark.langsmith` runs through `langsmith.testing.test`, which records its inputs, outputs, and feedback as an experiment in LangSmith {{code src/langsmith/pytest_plugin.py}}. Inside such a test, `log_inputs`, `log_outputs`, `log_reference_outputs`, and `log_feedback` from `langsmith.testing` add to that record.

The variable `LANGSMITH_TEST_TRACKING=false` turns the record off. The decorated test then calls your function directly, and each `log_*` call logs a message and returns {{code src/langsmith/testing/_internal.py}}. The pytest page of the docs gives the same switch for running without LangSmith {{docs langsmith/pytest}}. The option `--langsmith-output` needs the `langsmith[pytest]` extra for `rich`, and it refuses to run when tracking is off. The cache of `LANGSMITH_TEST_CACHE` needs the `langsmith[vcr]` extra. The kit does not install pytest, and this edition did not run the plugin.

## Coming in the next edition

The rest of LangSmith evaluation needs an account, which we did not use for this edition. These runs are coming in the next edition, and [section 7.6](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) lists them with the other account runs:

- A dataset in LangSmith, given to `evaluate` by name, and its versions and splits.
- An experiment with `upload_results=True`, and its retention, which the billing page says is extended by default {{docs langsmith/usage-and-billing}}.
- A comparison of two experiments, which `evaluate` runs when the target is a pair of experiment ids.
- Online evaluators on production traces, and annotation queues.
- The pytest plugin with tracking on, and its `--langsmith-output` table.

```takeaways
- Run evaluate with upload_results=False and a list of examples to test without an account.
- Write evaluators that take outputs and reference_outputs and return a key and a score.
- Wrap an agent target in tracing_context(enabled=False) when nothing must leave the machine.
- Pass your own client to evaluate, so you control where any request goes.
- Set LANGSMITH_TEST_TRACKING=false to run marked pytest tests without LangSmith.
```

Sources: capture/s_integrations.py, capture/out/42-langsmith.txt; src/langsmith/evaluation/_runner.py, src/langsmith/evaluation/evaluator.py, src/langsmith/pytest_plugin.py, src/langsmith/testing/_internal.py, src/langsmith/testing/__init__.py, and pyproject.toml at langsmith v0.14.17; libs/core/langchain_core/callbacks/manager.py at langchain==1.5.0; docs.langchain.com at docs commit 04d4d4a (langsmith/evaluate-llm-application, langsmith/pytest, langsmith/usage-and-billing, langsmith/evaluation-concepts).
